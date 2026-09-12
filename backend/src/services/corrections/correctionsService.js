import { attendanceDB } from '../../config/database.js';
import { toMySQLDate } from '../../utils/dateUtils.js';
import * as S3Service from '../s3/s3Service.js';
import { syncDailyAttendance } from '../attendance/attendanceService.js';
import { handleAttendanceCorrectionApprovedHook } from '../darServices/darReconciliationService.js';




// ========== CORRECTION REQUESTS ==========

/**
 * Create or update a correction request.
 * - Only 2 correction types: 'punch' and 'summary'.
 * - For 'summary', target_id points to the attn_daily_summary_v2 id.
 * - For 'punch', target_id is null.
 * - Attachments are stored directly in proposed_data JSON.
 * - If an existing pending request exists for the user on this date (or matching existing_request_id),
 *   it updates the row in-place and logs an 'updated' action in audit_trail.
 * - If the request is already approved/rejected, it rejects edits with a 409 Conflict.
 */
export async function createCorrectionRequest({
  org_id,
  user_id,
  user_type,
  correction_type,
  request_date,
  original_data,
  proposed_data,
  reason,
  attachmentMeta,
  existing_request_id
}) {
  const isAdminOrHr = ["admin", "hr", "superadmin"].includes(String(user_type || "").toLowerCase());

  // DYNAMIC DEADLINE FROM SHIFT RULES (Bypassed / unlimited for testing)
  /*
  if (!isAdminOrHr) {
    const userShift = await getUserShift(user_id);
    const rules = ShiftService.getShiftRules(userShift || {});
    const deadlineDays = rules.correction_deadline || 2;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reqDate = new Date(request_date);
    reqDate.setHours(0, 0, 0, 0);

    const diffTime = today - reqDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > deadlineDays) {
      throw new Error(`Correction requests can only be submitted within ${deadlineDays} days of the attendance date.`);
    }
  }
  */

  // Sanitize request date
  const cleanDate = toMySQLDate(request_date) || request_date;

  // Resolve target_id: for 'summary', find id in attn_daily_summary_v2
  const normType = correction_type === "summary" ? "summary" : "punch";
  let targetId = null;
  if (normType === "summary") {
    const summaryRow = await attendanceDB("attn_daily_summary_v2")
      .where({ user_id, date: cleanDate })
      .select("id")
      .first();
    targetId = summaryRow ? summaryRow.id : null;
  }

  // Merge attachment into proposed_data JSON if provided
  let finalProposed = proposed_data;
  if (attachmentMeta && attachmentMeta.file_key) {
    if (Array.isArray(finalProposed)) {
      if (finalProposed.length > 0) {
        finalProposed = finalProposed.map((s, idx) => idx === 0 ? { ...s, attachment: attachmentMeta } : s);
      } else {
        finalProposed = [{ attachment: attachmentMeta }];
      }
    } else if (typeof finalProposed === 'object' && finalProposed !== null) {
      finalProposed = { ...finalProposed, attachment: attachmentMeta };
    } else {
      finalProposed = { attachment: attachmentMeta };
    }
  }

  // 1. Check if user is targeting a specific existing request ID
  let pendingRecord = null;
  if (existing_request_id) {
    const existing = await attendanceDB("attn_corrections")
      .where({ id: existing_request_id })
      .first();

    if (!existing) {
      const err = new Error("Correction request not found.");
      err.status = 404;
      throw err;
    }

    // Verify permission: caller must be owner or belong to the same organization
    if (existing.user_id !== user_id) {
      const targetUser = await attendanceDB("core_users").where({ user_id: existing.user_id }).first();
      if (!targetUser || (org_id && Number(targetUser.org_id) !== Number(org_id))) {
        const err = new Error("Correction request not found or access denied.");
        err.status = 403;
        throw err;
      }
    }

    if (existing.status !== "pending") {
      const err = new Error("This correction request has already been reviewed/confirmed by an administrator. Please submit a new request.");
      err.status = 409;
      err.code = "CORRECTION_ALREADY_CONFIRMED";
      throw err;
    }

    pendingRecord = existing;
  } else {
    // 2. Check if a pending request already exists for this (user_id, request_date)
    pendingRecord = await attendanceDB("attn_corrections")
      .where({ user_id, request_date: cleanDate, status: "pending" })
      .first();
  }

  // CASE A: UPDATE PENDING REQUEST IN-PLACE (No new row created)
  if (pendingRecord) {
    let auditTrail = [];
    if (pendingRecord.audit_trail) {
      try {
        auditTrail = typeof pendingRecord.audit_trail === "string"
          ? JSON.parse(pendingRecord.audit_trail)
          : pendingRecord.audit_trail;
      } catch (_) {
        auditTrail = [];
      }
    }

    auditTrail.push({
      action: "updated",
      by: user_id,
      at: new Date().toISOString(),
      reason: reason || "Correction details updated"
    });

    const updatePayload = {
      correction_type: normType,
      target_id: targetId,
      proposed_data: finalProposed ? JSON.stringify(finalProposed) : null,
      reason,
      audit_trail: JSON.stringify(auditTrail),
      updated_at: attendanceDB.fn.now()
    };

    await attendanceDB("attn_corrections")
      .where({ id: pendingRecord.id })
      .update(updatePayload);

    return { id: pendingRecord.id, is_updated: true };
  }

  // CASE B: INSERT NEW CORRECTION REQUEST ROW
  const [newId] = await attendanceDB("attn_corrections").insert({
    user_id,
    submitted_by: user_id,
    correction_type: normType,
    target_id: targetId,
    request_date: cleanDate,
    original_data: original_data ? JSON.stringify(original_data) : null,
    proposed_data: finalProposed ? JSON.stringify(finalProposed) : null,
    reason,
    correction_data: null, // Reserved strictly for final applied data upon review
    status: "pending",
    audit_trail: JSON.stringify([
      { action: "submitted", by: user_id, at: new Date().toISOString() }
    ]),
    submitted_at: attendanceDB.fn.now(),
    updated_at: attendanceDB.fn.now()
  });

  return { id: newId, is_updated: false };
}

/**
 * Fetch correction requests with pagination, filters, and presigned attachment URLs from proposed_data
 */
export async function fetchCorrectionRequests({
  org_id,
  user_id,
  user_type,
  status,
  date,
  month,
  year,
  page,
  limit
}) {
  const offset = (page - 1) * limit;

  const applyFilters = qb => {
    const lowerType = String(user_type || "").toLowerCase();
    if (lowerType !== "admin" && lowerType !== "hr") qb.where("c.user_id", user_id);
    if (status) qb.where("c.status", status);
    if (date) qb.where("c.request_date", date);
    if (month) qb.whereRaw('MONTH(c.request_date) = ?', [month]);
    if (year) qb.whereRaw('YEAR(c.request_date) = ?', [year]);
    qb.where(function () {
      this.where("u.is_active", 1).orWhere("u.is_active", true);
    }).where(function () {
      this.where("u.is_deleted", 0).orWhere("u.is_deleted", false).orWhereNull("u.is_deleted");
    });
  };

  const data = await attendanceDB("attn_corrections as c")
    .join("core_users as u", "u.user_id", "c.user_id")
    .where("u.org_id", org_id)
    .modify(applyFilters)
    .select(
      "c.id as acr_id",
      "c.id",
      "c.correction_type",
      "c.target_id",
      "c.request_date",
      "c.original_data",
      "c.proposed_data",
      "c.status",
      "c.reason",
      "c.correction_data",
      "c.audit_trail",
      "c.submitted_at",
      "c.updated_at",
      "u.user_id",
      "u.user_name",
      "u.desg_id",
      "u.profile_image_url"
    )
    .orderBy("c.submitted_at", "desc")
    .limit(limit)
    .offset(offset);

  const countResult = await attendanceDB("attn_corrections as c")
    .join("core_users as u", "u.user_id", "c.user_id")
    .where("u.org_id", org_id)
    .modify(applyFilters)
    .count("* as total")
    .first();

  const parsedData = await Promise.all((data || []).map(async (item) => {
    const copy = { ...item };
    ['original_data', 'proposed_data', 'audit_trail', 'correction_data'].forEach(col => {
      if (copy[col] && typeof copy[col] === 'string') {
        try {
          copy[col] = JSON.parse(copy[col]);
        } catch (_) {
          copy[col] = col === 'audit_trail' ? [] : (col === 'correction_data' ? {} : null);
        }
      }
    });

    // Extract attachment metadata stored inside proposed_data JSON
    const att = Array.isArray(copy.proposed_data)
      ? (copy.proposed_data.find(s => s && s.attachment)?.attachment || null)
      : (copy.proposed_data?.attachment || null);

    if (att && att.file_key) {
      try {
        const { url } = await S3Service.getFileUrl({ key: att.file_key });
        copy.attachment_url = url;
        copy.attachment = { ...att, url, file_url: url };
      } catch (e) {
        copy.attachment_url = null;
        copy.attachment = null;
      }
    } else {
      copy.attachment_url = null;
      copy.attachment = null;
    }

    return copy;
  }));

  return {
    data: parsedData,
    count: Number(countResult?.total || 0)
  };
}

/**
 * Fetch a single correction request by ID with presigned attachment URL from proposed_data
 */
export async function fetchCorrectionRequestById({ acr_id, org_id, user_id, role }) {
  let query = attendanceDB("attn_corrections as c")
    .join("core_users as u", "u.user_id", "c.user_id")
    .leftJoin("org_designations as d", "d.desg_id", "u.desg_id")
    .select(
      "c.id as acr_id",
      "c.id",
      "c.correction_type",
      "c.target_id",
      "c.request_date",
      "c.original_data",
      "c.proposed_data",
      "c.reason",
      "c.correction_data",
      "c.status",
      "c.reviewed_by",
      "c.reviewed_at",
      "c.review_comments",
      "c.audit_trail",
      "c.submitted_at",
      "c.updated_at",
      "u.user_id",
      "u.user_name",
      "u.profile_image_url",
      "d.desg_name as designation"
    )
    .where("c.id", acr_id)
    .andWhere("u.org_id", org_id);

  if (role !== "admin" && role !== "hr") {
    query.andWhere("c.user_id", user_id);
  }
  const correction = await query.first();

  if (!correction) {
    return null;
  }

  // Parse JSON columns
  const jsonCols = ['audit_trail', 'original_data', 'proposed_data', 'correction_data'];
  for (const col of jsonCols) {
    if (correction[col] && typeof correction[col] === 'string') {
      try {
        correction[col] = JSON.parse(correction[col]);
      } catch {
        correction[col] = col === 'audit_trail' ? [] : (col === 'correction_data' ? {} : null);
      }
    } else if (!correction[col]) {
      correction[col] = col === 'audit_trail' ? [] : (col === 'correction_data' ? {} : null);
    }
  }

  // Extract attachment from proposed_data JSON
  const att = Array.isArray(correction.proposed_data)
    ? (correction.proposed_data.find(s => s && s.attachment)?.attachment || null)
    : (correction.proposed_data?.attachment || null);

  if (att && att.file_key) {
    try {
      const { url } = await S3Service.getFileUrl({ key: att.file_key });
      correction.attachment_url = url;
      correction.attachment = { ...att, url, file_url: url };
    } catch (e) {
      correction.attachment_url = null;
      correction.attachment = null;
    }
  } else {
    correction.attachment_url = null;
    correction.attachment = null;
  }

  return correction;
}

/**
 * Review (approve/reject) a correction request
 * If approved, apply the corrections to attendance records
 */
export async function reviewCorrectionRequest({
  acr_id,
  org_id,
  reviewer_id,
  status,
  review_comments,
  adminOverrideSessions
}) {
  const correction = await attendanceDB("attn_corrections as c")
    .join("core_users as u", "u.user_id", "c.user_id")
    .where({ "c.id": acr_id, "u.org_id": org_id })
    .select("c.*")
    .first();

  if (!correction) {
    throw { status: 404, message: "Request not found" };
  }

  // Parse audit_trail
  let auditTrail = [];
  if (correction.audit_trail) {
    try {
      auditTrail = typeof correction.audit_trail === 'string'
        ? JSON.parse(correction.audit_trail)
        : correction.audit_trail;
    } catch {
      auditTrail = [];
    }
  }

  auditTrail.push({
    action: status,
    by: reviewer_id,
    at: new Date(),
    comments: review_comments || null
  });

  // Determine the sessions to apply: admin override takes priority, else use proposed_data
  const adminOverride = adminOverrideSessions && Array.isArray(adminOverrideSessions) && adminOverrideSessions.length > 0
    ? adminOverrideSessions
    : null;

  // Parse stored proposed_data
  let proposedSessions = [];
  try {
    const raw = typeof correction.proposed_data === 'string'
      ? JSON.parse(correction.proposed_data)
      : correction.proposed_data;
    proposedSessions = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  } catch {
    proposedSessions = [];
  }

  // Use admin override if provided, otherwise fall back to the stored proposal
  const sessionsToApply = adminOverride || proposedSessions;

  // If admin provided an override, update proposed_data in DB to reflect what was ACTUALLY applied
  let updatedProposedData = null;
  if (adminOverride) {
    updatedProposedData = JSON.stringify(adminOverride);
  }

  const dbUpdate = {
    status,
    reviewed_by: reviewer_id,
    reviewed_at: attendanceDB.fn.now(),
    review_comments: review_comments || null,
    audit_trail: JSON.stringify(auditTrail),
    updated_at: attendanceDB.fn.now()
  };

  if (adminOverrideSessions) {
    dbUpdate.proposed_data = JSON.stringify(adminOverrideSessions);
  }

  await attendanceDB("attn_corrections").where({ id: acr_id }).update(dbUpdate);

  // --- APPLY CORRECTION IF APPROVED ---
  if (status === 'approved') {
    // Resolve final date string (YYYY-MM-DD)
    const targetDate = correction.request_date;
    const finalDateStr = toMySQLDate(targetDate);

    // Case 8: Summary Override
    if (correction.correction_type === 'summary') {
      let summaryData = {};
      try {
        summaryData = typeof correction.proposed_data === 'string'
          ? JSON.parse(correction.proposed_data)
          : (correction.proposed_data || {});
      } catch (e) {
        summaryData = {};
      }

      const updatePayload = {
        updated_at: attendanceDB.fn.now()
      };
      if (summaryData.status !== undefined) updatePayload.status = summaryData.status;
      if (summaryData.late_minutes !== undefined) updatePayload.late_minutes = Number(summaryData.late_minutes);
      if (summaryData.total_hours !== undefined) updatePayload.total_hours = Number(summaryData.total_hours);
      if (summaryData.overtime_hours !== undefined) updatePayload.overtime_hours = Number(summaryData.overtime_hours);

      await attendanceDB('attn_daily_summary_v2')
        .where({ user_id: correction.user_id, date: finalDateStr })
        .update(updatePayload);
    } else if (sessionsToApply.length > 0) {
      // Cases 1 - 7: Punch Corrections (Add, Edit, Remove, Merge, Overnight)
      // Calculate next calendar date string for overnight shifts crossing midnight (e.g. 22:00 -> 06:00)
      const nextDate = new Date(`${finalDateStr}T12:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Soft-delete existing non-deleted punches for that day in attn_punches (stamped with correction_id)
      await attendanceDB("attn_punches")
        .where({ user_id: correction.user_id })
        .whereNull("deleted_at")
        .whereRaw("DATE(punch_time) = ?", [finalDateStr])
        .update({ 
          deleted_at: attendanceDB.fn.now(),
          correction_id: acr_id
        });

      // Insert approved punches into attn_punches
      const newPunches = [];
      sessionsToApply.forEach(s => {
        const tIn = typeof s.time_in === 'string' && s.time_in.length === 5 ? s.time_in + ':00' : s.time_in;
        const tOut = typeof s.time_out === 'string' && s.time_out.length === 5 ? s.time_out + ':00' : s.time_out;

        // Detect overnight crossing midnight (e.g. 22:00 -> 06:00)
        const isOvernight = Boolean(tIn && tOut && tOut.slice(0, 5) <= tIn.slice(0, 5));
        const outDateStr = isOvernight ? nextDateStr : finalDateStr;

        if (tIn) {
          newPunches.push({
            user_id: correction.user_id,
            punch_time: `${finalDateStr} ${tIn}`,
            punch_type: 'in',
            punch_nature: 'fabricated',
            correction_id: acr_id,
            location: JSON.stringify({ address: 'Manual Correction', is_geofence_violation: false }),
            metadata: JSON.stringify({ note: 'Correction Approved', correction_id: acr_id, is_overnight: isOvernight }),
            created_at: attendanceDB.fn.now()
          });
        }

        if (tOut) {
          newPunches.push({
            user_id: correction.user_id,
            punch_time: `${outDateStr} ${tOut}`,
            punch_type: 'out',
            punch_nature: 'fabricated',
            correction_id: acr_id,
            location: JSON.stringify({ address: 'Manual Correction', is_geofence_violation: false }),
            metadata: JSON.stringify({ note: 'Correction Approved', correction_id: acr_id, is_overnight: isOvernight }),
            created_at: attendanceDB.fn.now()
          });
        }
      });

      if (newPunches.length > 0) {
        await attendanceDB("attn_punches").insert(newPunches);
      }

      // Sync Daily Summary (Uses the combined state of attn_punches into attn_daily_summary_v2)
      await syncDailyAttendance(correction.user_id, finalDateStr, {
        remarks: `Correction Request #${acr_id}`
      });

      // DAR Auto-Healing Hook on Attendance Correction Approval
      try {
        await handleAttendanceCorrectionApprovedHook(correction.user_id, finalDateStr);
      } catch (darErr) {
        console.warn("DAR Correction Reconciliation Hook warning:", darErr);
      }
    }
  }
}
