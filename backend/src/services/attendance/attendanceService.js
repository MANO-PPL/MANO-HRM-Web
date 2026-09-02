import ExcelJS from "exceljs";
import { attendanceDB } from "../../config/database.js";
import * as S3Service from "../s3/s3Service.js";
import EventBus from "../../utils/EventBus.js";
import * as ShiftService from "./shiftManagementService.js";
import * as StatusService from "./statusEvaluationService.js";
import { PayrollCalculationService } from '../payroll/PayrollCalculationService.js';
import { toMySQLDateTime, toMySQLDate, toMySQLTime } from "../../utils/dateUtils.js";

/**
 * Fetch User Shift
 */
export async function getUserShift(user_id) {
  const user = await attendanceDB("core_users")
    .join("org_shifts", "core_users.shift_id", "org_shifts.shift_id")
    .where("core_users.user_id", user_id)
    .select("org_shifts.*")
    .first();
  return user;
}

/**
 * Format timestamp to MySQL datetime string (YYYY-MM-DD HH:MM:SS)
 */
export function toSqlDatetime(val) {
  if (!val) return new Date();
  if (typeof val === 'string') {
    return val.replace('T', ' ').replace('Z', '').split('.')[0];
  }
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${val.getUTCFullYear()}-${pad(val.getUTCMonth() + 1)}-${pad(val.getUTCDate())} ${pad(val.getUTCHours())}:${pad(val.getUTCMinutes())}:${pad(val.getUTCSeconds())}`;
  }
  return String(val);
}

/**
 * Format timestamp to time string HH:MM:SS
 */
export function getTimeStr(d) {
  if (!d) return null;
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
}

/**
 * Safely parse a JSON column value.
 */
export function safeParseJSON(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return {}; }
}

/**
 * Pair punches sequentially into sessions for a specific date.
 */
export function pairPunchesForDate(punches, dateStr) {
  const sessions = [];
  let i = 0;
  while (i < punches.length) {
    const p = punches[i];
    const punchDate = new Date(p.punch_time).toISOString().split('T')[0];

    if (p.punch_type === 'in' && punchDate === dateStr) {
      const inPunch = p;
      let outPunch = null;

      if (i + 1 < punches.length && punches[i + 1].punch_type === 'out') {
        outPunch = punches[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      const duration = outPunch
        ? parseFloat(((new Date(outPunch.punch_time) - new Date(inPunch.punch_time)) / (1000 * 60 * 60)).toFixed(2))
        : 0;

      sessions.push({ in_punch: inPunch, out_punch: outPunch, duration_hours: duration });
    } else {
      i += 1;
    }
  }
  return sessions;
}

// ========== TIME IN/OUT PROCESSING ==========

/**
 * Process Time In
 * Delegates to processTimeInSync and persists address if provided
 */
export async function processTimeIn(context) {
  const result = await processTimeInSync({
    ...context,
    punch_nature: context.event_source === "SIMULATION" ? "simulated" : "default"
  });

  if (result.ok && context.address && context.address !== "Locating...") {
    try {
      const punch = await attendanceDB("attn_punches").where({ id: result.punch_id }).first();
      if (punch) {
        const loc = safeParseJSON(punch.location);
        loc.address = context.address;
        await attendanceDB("attn_punches").where({ id: result.punch_id }).update({
          location: JSON.stringify(loc)
        });
      }
    } catch (_) {}
  }

  return result;
}

/**
 * Process Time Out
 * Delegates to processTimeOutSync and persists address if provided
 */
export async function processTimeOut(context) {
  const result = await processTimeOutSync({
    ...context,
    punch_nature: context.event_source === "SIMULATION" ? "simulated" : "default"
  });

  if (result.ok && context.address && context.address !== "Locating...") {
    try {
      const punch = await attendanceDB("attn_punches").where({ id: result.punch_id }).first();
      if (punch) {
        const loc = safeParseJSON(punch.location);
        loc.address = context.address;
        await attendanceDB("attn_punches").where({ id: result.punch_id }).update({
          location: JSON.stringify(loc)
        });
      }
    } catch (_) {}
  }

  return result;
}

/**
 * Sync Daily Attendance (Punch-Based Aggregation Engine)
 * Reads from attn_punches, pairs in/out, computes daily summary, upserts attn_daily_summary.
 * Handles overnight shifts (out punch on next calendar day).
 */
export async function syncDailyAttendance(user_id, dateStr, overrides = {}) {
  try {
    const sanitizedDate = dateStr.split('T')[0];

    // Calculate next date for overnight out-punch matching
    const nextDate = new Date(sanitizedDate + 'T12:00:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    // 1. Fetch punches: all in/out on target date + out punches on next day (overnight)
    const punches = await attendanceDB("attn_punches")
      .where({ user_id })
      .whereNull("deleted_at")
      .whereIn("punch_type", ["in", "out"])
      .where(function() {
        this.whereRaw("DATE(punch_time) = ?", [sanitizedDate])
          .orWhere(function() {
            this.where("punch_type", "out")
              .whereRaw("DATE(punch_time) = ?", [nextDateStr]);
          });
      })
      .orderBy("punch_time", "asc")
      .orderBy("id", "asc");

    // 2. Pair punches into sessions (only in-punches from target date start sessions)
    const sessions = pairPunchesForDate(punches, sanitizedDate);

    if (sessions.length === 0 && !overrides.status) {
      const existing = await attendanceDB("attn_daily_summary")
        .where({ user_id, date: sanitizedDate })
        .first();
      if (existing) {
        await attendanceDB("attn_daily_summary")
          .where({ user_id, date: sanitizedDate })
          .update({
            first_in: null, last_out: null, total_hours: 0, late_minutes: 0, overtime_hours: 0,
            status: "ABSENT", updated_at: attendanceDB.fn.now(), ...overrides
          });
      }
      return;
    }

    // 3. Compute aggregates
    let totalHours = 0;
    let sessionCount = 0;
    for (const s of sessions) {
      if (s.out_punch) {
        totalHours += s.duration_hours;
        sessionCount += 1;
      }
    }
    totalHours = parseFloat(totalHours.toFixed(2));

    // 4. Shift rules
    const shift = await getUserShift(user_id);
    const rules = ShiftService.getShiftRules(shift);

    // 5. Late calculation (first session only)
    let lateMinutes = 0;
    let lateReason = null;
    if (sessions.length > 0) {
      const firstIn = sessions[0].in_punch;
      const lateCheck = StatusService.calculateLateArrival(
        new Date(firstIn.punch_time).toISOString(), rules
      );
      lateMinutes = lateCheck.minutesLate;

      const firstMeta = safeParseJSON(firstIn.metadata);
      lateReason = firstMeta?.late_reason || null;
    }

    // 6. Overtime
    const overtimeHours = StatusService.calculateOvertime(totalHours, rules);

    // 7. Status determination
    let finalStatus;
    if (overrides.status) {
      finalStatus = overrides.status;
    } else if (sessions.some(s => !s.out_punch)) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const isPastDate = sanitizedDate < todayDateStr;
      finalStatus = isPastDate ? "MISSED_PUNCH" : "PRESENT";
    } else if (sessionCount === 0) {
      finalStatus = "ABSENT";
    } else {
      finalStatus = StatusService.evaluateStatus(rules, {
        total_hours: totalHours,
        total_hours_today: totalHours,
        minutes_late: lateMinutes,
        event_type: "time_out"
      });
    }

    // 8. Remarks
    const remarks = [];
    if (sessions.some(s => !s.out_punch)) remarks.push("Open Session");
    if (punches.some(p => p.punch_nature === "fabricated")) remarks.push("Manual Entry");
    for (const s of sessions) {
      const inLoc = safeParseJSON(s.in_punch.location);
      if (inLoc.is_geofence_violation) { remarks.push("Geofence Violation"); break; }
      if (s.out_punch) {
        const outLoc = safeParseJSON(s.out_punch.location);
        if (outLoc.is_geofence_violation) { remarks.push("Geofence Violation"); break; }
      }
    }

    // 9. Upsert into attn_daily_summary_v2
    const summaryDataV2 = {
      session_count: sessionCount,
      total_hours: totalHours,
      late_minutes: lateMinutes,
      late_reason: lateReason,
      overtime_hours: overtimeHours,
      status: (finalStatus === 'LATE' || finalStatus === 'OVERTIME') ? 'PRESENT' : finalStatus,
      shift_id: shift ? shift.shift_id : null,
      remarks: [...new Set(remarks)].join("; ") || null,
      updated_at: attendanceDB.fn.now(),
      ...overrides
    };

    try {
      const existingV2 = await attendanceDB("attn_daily_summary_v2")
        .where({ user_id, date: sanitizedDate })
        .first();

      if (existingV2) {
        await attendanceDB("attn_daily_summary_v2")
          .where({ user_id, date: sanitizedDate })
          .update(summaryDataV2);
      } else {
        await attendanceDB("attn_daily_summary_v2").insert({
          user_id,
          date: sanitizedDate,
          ...summaryDataV2,
          created_at: attendanceDB.fn.now()
        });
      }
    } catch (v2Err) {
      console.error("attn_daily_summary_v2 sync error:", v2Err);
    }

    // Also sync legacy attn_daily_summary if it exists
    const firstIn = sessions.length > 0 ? sessions[0].in_punch : null;
    const lastOut = sessions.length > 0 && sessions[sessions.length - 1].out_punch ? sessions[sessions.length - 1].out_punch : null;
    const summaryDataLegacy = {
      first_in: firstIn ? getTimeStr(firstIn.punch_time) : null,
      last_out: lastOut ? getTimeStr(lastOut.punch_time) : null,
      total_hours: totalHours,
      late_minutes: lateMinutes,
      late_reason: lateReason,
      overtime_hours: overtimeHours,
      status: finalStatus,
      shift_id: shift ? shift.shift_id : null,
      updated_at: attendanceDB.fn.now(),
      ...overrides
    };

    try {
      const existingLegacy = await attendanceDB("attn_daily_summary")
        .where({ user_id, date: sanitizedDate })
        .first();

      if (existingLegacy) {
        await attendanceDB("attn_daily_summary")
          .where({ user_id, date: sanitizedDate })
          .update(summaryDataLegacy);
      } else {
        await attendanceDB("attn_daily_summary").insert({
          user_id,
          date: sanitizedDate,
          ...summaryDataLegacy,
          created_at: attendanceDB.fn.now()
        });
      }
    } catch (_) {}

    // 10. Trigger payroll recalculation
    PayrollCalculationService.triggerRecalculation(user_id, sanitizedDate).catch(err => {
      console.error("Failed to trigger background payroll recalculation in syncDailyAttendance:", err);
    });

  } catch (err) {
    console.error("Sync Daily Attendance Error:", err);
    throw err;
  }
}

// ========== RECORDS MANAGEMENT ==========

/**
 * Helper to build sessions from attn_punches
 */
async function fetchSessionsFromPunches({ user_id = null, org_id = null, date_from = null, date_to = null, limit = 100 }) {
  let query = attendanceDB("attn_punches as ap")
    .join("core_users as u", "ap.user_id", "u.user_id")
    .leftJoin("org_designations as d", "u.desg_id", "d.desg_id")
    .whereNull("ap.deleted_at")
    .whereIn("ap.punch_type", ["in", "out"]);

  if (user_id) query = query.where("ap.user_id", user_id);
  if (org_id) query = query.where("u.org_id", org_id);
  if (date_from) query = query.whereRaw("DATE(ap.punch_time) >= DATE(?)", [date_from]);
  if (date_to) query = query.whereRaw("DATE(ap.punch_time) <= DATE_ADD(DATE(?), INTERVAL 1 DAY)", [date_to]);

  query = query.select(
    "ap.*",
    "u.user_name",
    "u.email",
    "d.desg_name as designation"
  ).orderBy("ap.punch_time", "asc").orderBy("ap.id", "asc");

  const punches = await query;
  if (!punches.length) return [];

  const byUser = {};
  for (const p of punches) {
    if (!byUser[p.user_id]) byUser[p.user_id] = [];
    byUser[p.user_id].push(p);
  }

  const allSessions = [];
  for (const uid of Object.keys(byUser)) {
    const userPunches = byUser[uid];
    let i = 0;
    while (i < userPunches.length) {
      const inP = userPunches[i];
      if (inP.punch_type === "in") {
        let outP = null;
        if (i + 1 < userPunches.length && userPunches[i + 1].punch_type === "out") {
          outP = userPunches[i + 1];
          i += 2;
        } else {
          i += 1;
        }

        const inLoc = safeParseJSON(inP.location);
        const inMeta = safeParseJSON(inP.metadata);
        const outLoc = outP ? safeParseJSON(outP.location) : {};
        const outMeta = outP ? safeParseJSON(outP.metadata) : {};

        let totalHours = null;
        if (outP) {
          const diffMs = new Date(outP.punch_time) - new Date(inP.punch_time);
          if (diffMs > 0) totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        }

        const timeInStr = inP.punch_time instanceof Date ? inP.punch_time.toISOString() : new Date(inP.punch_time).toISOString();
        const timeOutStr = outP ? (outP.punch_time instanceof Date ? outP.punch_time.toISOString() : new Date(outP.punch_time).toISOString()) : null;

        const punchDate = new Date(inP.punch_time);
        const today = new Date();
        const isPastDay = punchDate.toDateString() !== today.toDateString() && punchDate < today;

        let sessionStatus = "PRESENT";
        if (inP.status === "closed" || outP) {
          sessionStatus = "CLOSED";
        } else if (inP.status === "missed_punch" || isPastDay) {
          sessionStatus = "MISSED_PUNCH";
        }

        allSessions.push({
          attendance_id: inP.id,
          user_id: inP.user_id,
          user_name: inP.user_name,
          email: inP.email,
          designation: inP.designation,
          time_in: timeInStr,
          time_out: timeOutStr,
          time_in_lat: inLoc.lat || null,
          time_in_lng: inLoc.lng || null,
          time_in_address: inLoc.address || null,
          time_out_lat: outLoc.lat || null,
          time_out_lng: outLoc.lng || null,
          time_out_address: outLoc.address || null,
          time_in_image_key: inMeta.image_key || null,
          time_out_image_key: outMeta.image_key || null,
          late_minutes: inMeta.late_minutes || 0,
          late_reason: inMeta.late_reason || null,
          total_hours: totalHours,
          status: sessionStatus,
          metadata: JSON.stringify({
            time_in: { timezone: inMeta.timezone || "Asia/Kolkata" },
            time_out: { timezone: outMeta?.timezone || "Asia/Kolkata" }
          }),
          created_at: inP.created_at,
          updated_at: outP ? outP.created_at : inP.created_at
        });
      } else {
        i += 1;
      }
    }
  }

  allSessions.sort((a, b) => new Date(b.time_in) - new Date(a.time_in));
  return allSessions.slice(0, Math.min(parseInt(limit) || 100, 100));
}

/**
 * Fetch attendance records for admin view with user details
 */
export async function fetchAdminRecords({ org_id, user_id, date_from, date_to, limit }) {
  const records = await fetchSessionsFromPunches({ org_id, user_id, date_from, date_to, limit }).catch(() => []);

  // Fetch pre-signed URLs for images
  const withUrls = await Promise.all(
    records.map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key }).catch(() => ({ url: null }));
        timeInUrl = url;
      }
      if (row.time_out_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key }).catch(() => ({ url: null }));
        timeOutUrl = url;
      }

      const time_in = row.time_in_ts || (row.time_in ? String(row.time_in) : null);
      const time_out = row.time_out_ts || (row.time_out ? String(row.time_out) : null);
      const created_at = row.created_at_ts || (row.created_at ? String(row.created_at) : null);
      const updated_at = row.updated_at_ts || (row.updated_at ? String(row.updated_at) : null);

      return {
        ...row,
        time_in,
        time_out,
        created_at,
        updated_at,
        time_in_image: timeInUrl,
        time_out_image: timeOutUrl,
      };
    })
  );

  return withUrls;
}

/**
 * Fetch attendance records for a specific user
 */
export async function fetchUserRecords({ user_id, date_from, date_to, limit }) {
  const records = await fetchSessionsFromPunches({ user_id, date_from, date_to, limit }).catch(() => []);

  const withUrls = await Promise.all(
    (records || []).map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key }).catch(() => ({ url: null }));
        timeInUrl = url;
      }
      if (row.time_out_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key }).catch(() => ({ url: null }));
        timeOutUrl = url;
      }

      const time_in = row.time_in_ts || (row.time_in ? String(row.time_in) : null);
      const time_out = row.time_out_ts || (row.time_out ? String(row.time_out) : null);
      const created_at = row.created_at_ts || (row.created_at ? String(row.created_at) : null);
      const updated_at = row.updated_at_ts || (row.updated_at ? String(row.updated_at) : null);

      return {
        ...row,
        time_in,
        time_out,
        created_at,
        updated_at,
        time_in_image: timeInUrl,
        time_out_image: timeOutUrl,
      };
    })
  );

  return withUrls;
}

// ========== CORRECTION REQUESTS ==========

/**
 * Create or update a correction request.
 * - Only 2 correction types: 'punch' and 'summary'.
 * - For 'summary', target_id points to the attn_daily_summary daily_id.
 * - For 'punch', target_id is null.
 * - Attachments are stored directly in proposed_data JSON.
 * - If an existing pending request exists for the user on this date (or matching existing_request_id),
 *   it updates the row in-place and logs an 'updated' action in audit_trail.
 * - If the request is already approved/rejected, it rejects edits with a 409 Conflict.
 */
export async function createCorrectionRequest({
  org_id,
  user_id,
  correction_type,
  request_date,
  original_data,
  proposed_data,
  reason,
  attachmentMeta,
  existing_request_id
}) {
  // FETCH DYNAMIC DEADLINE FROM SHIFT RULES
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

  // Resolve target_id: for 'summary', find daily_id in attn_daily_summary
  const normType = correction_type === "summary" ? "summary" : "punch";
  let targetId = null;
  if (normType === "summary") {
    const summaryRow = await attendanceDB("attn_daily_summary")
      .where({ user_id, date: request_date })
      .select("daily_id")
      .first();
    targetId = summaryRow ? summaryRow.daily_id : null;
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
      .where({ id: existing_request_id, user_id })
      .first();

    if (!existing) {
      const err = new Error("Correction request not found.");
      err.status = 404;
      throw err;
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
      .where({ user_id, request_date, status: "pending" })
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
    request_date,
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

      await attendanceDB('attn_daily_summary')
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

      // Delete all existing records for the day in legacy attn_records
      await attendanceDB("attn_records")
        .where({ user_id: correction.user_id })
        .whereRaw("DATE(time_in) = ?", [finalDateStr])
        .del().catch(() => {});

      // Insert the approved sessions into legacy attn_records
      const newRecords = sessionsToApply.map(s => {
        const tIn = typeof s.time_in === 'string' && s.time_in.length === 5 ? s.time_in + ':00' : s.time_in;
        const tOut = typeof s.time_out === 'string' && s.time_out.length === 5 ? s.time_out + ':00' : s.time_out;
        const isOvernight = Boolean(tIn && tOut && tOut.slice(0, 5) <= tIn.slice(0, 5));
        const outDateStr = isOvernight ? nextDateStr : finalDateStr;

        return {
          user_id: correction.user_id,
          time_in: `${finalDateStr} ${tIn}`,
          time_out: tOut ? `${outDateStr} ${tOut}` : null,
          status: 'CLOSED',
          created_at: attendanceDB.fn.now(),
          updated_at: attendanceDB.fn.now(),
          time_in_address: 'Manual Correction',
          time_out_address: 'Manual Correction',
          altered_by: reviewer_id
        };
      });

      if (newRecords.length > 0) {
        await attendanceDB("attn_records").insert(newRecords).catch(() => {});
      }

      // Sync Daily Summary (Now uses the combined state of the punches)
      await syncDailyAttendance(correction.user_id, finalDateStr);
    }
  }
}

// ========== EXPORT ==========

/**
 * Export attendance records to Excel for a given month
 */
export async function exportRecordsToExcel({ user_id, org_id, month, year, monthNum }) {
  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  let records = await fetchSessionsFromPunches({ user_id, date_from: startDate, date_to: endDate, limit: 1000 }).catch(() => []);
  if (!records || records.length === 0) {
    records = await attendanceDB("attn_records")
      .where({ user_id })
      .whereRaw("DATE(time_in) >= ?", [startDate])
      .whereRaw("DATE(time_in) <= ?", [endDate])
      .orderBy("time_in", "asc");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Attendance");

  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Time In", key: "time_in", width: 15 },
    { header: "Time Out", key: "time_out", width: 15 },
    { header: "Total Hours", key: "total_hours", width: 12 },
    { header: "Status", key: "status", width: 15 },
    { header: "Late (Mins)", key: "late_minutes", width: 12 },
    { header: "Location (In)", key: "location", width: 40 },
    { header: "Location (Out)", key: "location_out", width: 40 }
  ];

  records.forEach(r => {
    let duration = "0.00";
    if (r.time_in && r.time_out) {
      const diffMs = new Date(r.time_out) - new Date(r.time_in);
      if (diffMs > 0) duration = (diffMs / (1000 * 60 * 60)).toFixed(2);
    }

    worksheet.addRow({
      date: new Date(r.time_in).toLocaleDateString(),
      time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      total_hours: duration,
      status: r.status || "PRESENT",
      late_minutes: r.late_minutes || 0,
      location: r.time_in_address || "-",
      location_out: r.time_out_address || "-"
    });
  });

  // Style Header
  worksheet.getRow(1).font = { bold: true };

  return workbook;
}

/**
 * Wrapper for daily summary status evaluation service with pre-signed S3 image URLs
 */
export async function getDailySummary({ org_id, user_id = null, date_from, date_to }) {
  const summaries = await StatusService.getDailySummary({ org_id, user_id, date_from, date_to });

  // Resolve pre-signed URLs for all records/sessions
  for (const userSummary of summaries) {
    for (const day of userSummary.days) {
      if (day.sessions && day.sessions.length > 0) {
        day.sessions = await Promise.all(
          day.sessions.map(async (row) => {
            let timeInUrl = null;
            let timeOutUrl = null;

            if (row.time_in_image_key) {
              try {
                const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key });
                timeInUrl = url;
              } catch (e) {
                console.error("Error signing S3 image time_in_image_key", e);
              }
            }
            if (row.time_out_image_key) {
              try {
                const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key });
                timeOutUrl = url;
              } catch (e) {
                console.error("Error signing S3 image time_out_image_key", e);
              }
            }

            return {
              ...row,
              time_in_image: timeInUrl,
              time_out_image: timeOutUrl,
            };
          })
        );
      }
    }
  }

  return summaries;
}

/**
 * Process Time In (Synchronous Part)
 * Checks compliance and inserts 'in' punch into attn_punches. Returns punch_id.
 */
export async function processTimeInSync(context) {
  const {
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file,
    localTime,
    ip,
    user_agent
  } = context;

  const todayDate = localTime ? localTime.split('T')[0] : new Date().toISOString().split('T')[0];
  const isSimulation = context.event_source === "SIMULATION" || context.punch_nature === "simulated";
  const punchNature = isSimulation ? "simulated" : (context.punch_nature || "default");
  const punchTime = localTime ? toSqlDatetime(localTime) : toSqlDatetime(new Date());
  const addressStr = context.address || (isSimulation ? "Simulated Location" : "Locating...");

  // 1. Check for open session on the target date
  const lastPunchOnDate = await attendanceDB("attn_punches")
    .where({ user_id })
    .whereNull("deleted_at")
    .whereIn("punch_type", ["in", "out"])
    .whereRaw("DATE(punch_time) = ?", [todayDate])
    .orderBy("punch_time", "desc")
    .orderBy("id", "desc")
    .first();

  if (lastPunchOnDate && lastPunchOnDate.punch_type === "in") {
    return { ok: false, status: 400, message: `Already timed in on ${todayDate}. Please time out first.` };
  }

  // If real-time check-in, ensure the latest global punch is not an open in-punch from today
  if (!isSimulation) {
    const latestGlobal = await attendanceDB("attn_punches")
      .where({ user_id })
      .whereNull("deleted_at")
      .whereIn("punch_type", ["in", "out"])
      .orderBy("punch_time", "desc")
      .orderBy("id", "desc")
      .first();

    if (latestGlobal && latestGlobal.punch_type === "in") {
      const lastPunchDate = new Date(latestGlobal.punch_time).toISOString().split('T')[0];
      if (lastPunchDate === todayDate) {
        return { ok: false, status: 400, message: "Already timed in. Please time out first." };
      }

      // Prior-day open session — re-aggregate that day (aggregator flags as MISSED_PUNCH)
      try {
        await syncDailyAttendance(user_id, lastPunchDate);
      } catch (err) {
        console.error("Error re-aggregating prior open session:", err);
      }
    }
  }

  // 2. Count today's sessions for session numbering
  const todayInPunches = await attendanceDB("attn_punches")
    .where({ user_id, punch_type: "in" })
    .whereNull("deleted_at")
    .whereRaw("DATE(punch_time) = ?", [todayDate]);

  const sessionNumber = todayInPunches.length + 1;
  const isFirstSession = todayInPunches.length === 0;

  // 3. Shift Context & Compliance
  const shift = await getUserShift(user_id);
  const rules = ShiftService.getShiftRules(shift);

  if (!isSimulation) {
    const geoCheck = await ShiftService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.entry_requirements);
    if (!geoCheck.ok) {
      return { ok: false, status: 400, message: "Shift Policy Violation: " + geoCheck.error };
    }

    const bioCheck = ShiftService.checkBiometricCompliance(file, rules.entry_requirements);
    if (!bioCheck.ok) {
      return { ok: false, status: 400, message: "Shift Policy Violation: " + bioCheck.error };
    }
  }

  // 4. Late Calculation (first session only)
  let lateCheck = { minutesLate: 0, isLate: false, gracePeriod: 0 };
  if (isFirstSession) {
    lateCheck = StatusService.calculateLateArrival(localTime, rules);
  }
  const minutesLate = lateCheck.minutesLate;

  if (lateCheck.isLate && !late_reason) {
    return {
      ok: false,
      status: 400,
      message: `You are ${minutesLate} minutes late. Please provide a reason to check in.`
    };
  }

  // 5. Build location JSON (image_key starts null — worker fills it after S3 upload)
  const locationData = {
    lat: latitude,
    lng: longitude,
    address: addressStr,
    is_geofence_violation: false
  };

  // 6. Build metadata JSON
  const metadata = {
    image_key: null,
    late_reason: isFirstSession ? (late_reason || (lateCheck.isLate ? "Late Entry" : null)) : null,
    accuracy: Math.round(accuracy),
    ip_address: ip,
    user_agent: user_agent,
    timezone: context.timezone || "N/A"
  };

  // 7. Insert 'in' punch
  const [punch_id] = await attendanceDB("attn_punches").insert({
    user_id,
    punch_time: punchTime,
    punch_type: "in",
    location: JSON.stringify(locationData),
    punch_nature: punchNature,
    metadata: JSON.stringify(metadata),
    created_at: attendanceDB.fn.now()
  });

  // 8. Sync daily summary
  try {
    await syncDailyAttendance(user_id, todayDate);
  } catch (dailyErr) {
    console.error("Daily Sync Error:", dailyErr);
  }

  const expectedHours = ShiftService.getExpectedHours(localTime, rules.week_off_policy, rules);

  return {
    ok: true,
    attendance_id: punch_id,
    punch_id,
    local_time: localTime,
    address: addressStr,
    tz_name: context.timezone,
    timezone: context.timezone,
    session_number: sessionNumber,
    is_first_session: isFirstSession,
    working_hours: expectedHours,
    message: "Timed in successfully",
  };
}

/**
 * Process Time Out (Synchronous Part)
 * Inserts 'out' punch into attn_punches and triggers aggregation.
 */
export async function processTimeOutSync(context) {
  const {
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    file,
    localTime,
    ip,
    user_agent
  } = context;

  const isSimulation = context.event_source === "SIMULATION" || context.punch_nature === "simulated";
  const punchNature = isSimulation ? "simulated" : (context.punch_nature || "default");
  const punchTime = localTime ? toSqlDatetime(localTime) : toSqlDatetime(new Date());
  const addressStr = context.address || (isSimulation ? "Simulated Location" : "Locating...");
  const targetDate = localTime ? localTime.split('T')[0] : null;

  // 1. Find open session (latest non-deleted punch is 'in' on target date if simulating)
  let lastPunchQuery = attendanceDB("attn_punches")
    .where({ user_id })
    .whereNull("deleted_at")
    .whereIn("punch_type", ["in", "out"]);

  if (isSimulation && targetDate) {
    lastPunchQuery = lastPunchQuery.whereRaw("DATE(punch_time) = ?", [targetDate]);
  }

  const lastPunch = await lastPunchQuery
    .orderBy("punch_time", "desc")
    .orderBy("id", "desc")
    .first();

  if (!lastPunch || lastPunch.punch_type !== "in") {
    return { ok: false, status: 400, message: isSimulation ? `No active time-in found on ${targetDate} to time out.` : "No active time-in found to time out." };
  }

  const openInPunch = lastPunch;

  // 2. Check if the open session was flagged as MISSED_PUNCH by aggregator
  const sessionDate = new Date(openInPunch.punch_time).toISOString().split('T')[0];
  const daySummary = await attendanceDB("attn_daily_summary")
    .where({ user_id, date: sessionDate })
    .first();
  if (daySummary && daySummary.status === 'MISSED_PUNCH') {
    return {
      ok: false,
      status: 400,
      message: "This session has been flagged as a missed punch. Please submit a correction request to adjust your hours."
    };
  }

  // 3. Check session age (> 24h → require correction)
  const durationHours = (new Date(localTime) - new Date(openInPunch.punch_time)) / (1000 * 60 * 60);
  if (durationHours > 24) {
    return {
      ok: false,
      status: 400,
      message: "Your active session is older than 24 hours. Please submit a correction request to adjust your hours."
    };
  }

  // 4. Shift Context & Compliance
  const shift = await getUserShift(user_id);
  const rules = ShiftService.getShiftRules(shift);

  if (!isSimulation) {
    const geoCheck = await ShiftService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.exit_requirements);
    if (!geoCheck.ok) {
      return { ok: false, status: 400, message: "Shift Policy Violation: " + geoCheck.error };
    }

    const bioCheck = ShiftService.checkBiometricCompliance(file, rules.exit_requirements);
    if (!bioCheck.ok) {
      return { ok: false, status: 400, message: "Shift Policy Violation: " + bioCheck.error };
    }
  }

  // 5. Calculate session hours for immediate response
  const totalHours = StatusService.calculateDurationHours(openInPunch.punch_time, localTime);

  // 6. Build location + metadata JSON (image_key starts null — worker fills it)
  const locationData = {
    lat: latitude,
    lng: longitude,
    address: addressStr,
    is_geofence_violation: false
  };

  const metadata = {
    image_key: null,
    accuracy: Math.round(accuracy),
    ip_address: ip,
    user_agent: user_agent,
    timezone: context.timezone || "N/A",
    local_time: toMySQLDateTime(localTime),
    total_hours: parseFloat(totalHours.toFixed(2))
  };

  // 7. Insert 'out' punch
  const [punch_id] = await attendanceDB("attn_punches").insert({
    user_id,
    punch_time: punchTime,
    punch_type: "out",
    location: JSON.stringify(locationData),
    punch_nature: punchNature,
    metadata: JSON.stringify(metadata),
    created_at: attendanceDB.fn.now()
  });

  // 8. Sync daily summary (use punch-in date for overnight shifts)
  try {
    await syncDailyAttendance(user_id, sessionDate);
  } catch (dailyErr) {
    console.error("Daily Sync Error (Timeout):", dailyErr);
  }

  // 9. Get aggregated status + totals for response
  let status = "PRESENT";
  let totalHoursToday = parseFloat(totalHours.toFixed(2));
  try {
    const updatedSummary = await attendanceDB("attn_daily_summary")
      .where({ user_id, date: sessionDate })
      .first();
    if (updatedSummary) {
      status = updatedSummary.status;
      totalHoursToday = updatedSummary.total_hours;
    }
  } catch (e) { /* fallback to session hours */ }

  const expectedHours = ShiftService.getExpectedHours(localTime, rules.week_off_policy, rules);

  // EventBus logging (moved from legacy processTimeOut)
  EventBus.emitActivityLog({
    user_id,
    org_id,
    event_type: "CHECK_OUT",
    event_source: context.event_source || "WEB",
    object_type: "ATTENDANCE",
    object_id: punch_id,
    description: `User checked out (Status: ${status})`,
    location: `${latitude},${longitude}`,
    request_ip: ip,
    user_agent: user_agent
  });

  return {
    ok: true,
    attendance_id: punch_id,
    punch_id,
    local_time_out: localTime,
    address: addressStr,
    tz_name: context.timezone,
    timezone: context.timezone,
    status,
    session_hours: parseFloat(totalHours.toFixed(2)),
    total_hours_today: totalHoursToday,
    working_hours: expectedHours,
    message: "Timed out successfully",
  };
}

export async function recordLocationPing({ userId, latitude, longitude, ip, userAgent, isGeofenceViolation = false }) {
  const [punch_id] = await attendanceDB("attn_punches").insert({
    user_id: userId,
    punch_time: attendanceDB.fn.now(),
    punch_type: "normal_punch",
    location: JSON.stringify({ lat: latitude, lng: longitude, is_geofence_violation: isGeofenceViolation }),
    punch_nature: "default",
    metadata: JSON.stringify({ ip, user_agent: userAgent }),
    created_at: attendanceDB.fn.now()
  });

  return { ok: true, punch_id, message: "Location ping recorded" };
}
