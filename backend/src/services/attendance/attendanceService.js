import ExcelJS from "exceljs";
import { attendanceDB } from "../../config/database.js";
import * as S3Service from "../s3/s3Service.js";
import EventBus from "../../utils/EventBus.js";
import * as ShiftService from "./shiftManagementService.js";
import * as StatusService from "./statusEvaluationService.js";
import { PayrollCalculationService } from '../payroll/PayrollCalculationService.js';
import { toMySQLDateTime, toMySQLDate, toMySQLTime } from "../../utils/dateUtils.js";
import * as MapsService from "../google_api_services/maps.js";
import { handleAttendanceCheckinHook, handleAttendanceCheckoutHook, handleAttendanceCorrectionApprovedHook } from "../darServices/darReconciliationService.js";


/**
 * Fetch User Shift
 */
export async function getUserShift(user_id) {
  const user = await attendanceDB("core_users")
    .where("user_id", user_id)
    .select("shift_id", "org_id")
    .first();

  if (!user) return null;

  if (user.shift_id) {
    const assignedShift = await attendanceDB("org_shifts")
      .where({ shift_id: user.shift_id, org_id: user.org_id })
      .first();
    if (assignedShift) return assignedShift;
  }

  const openShift = await attendanceDB("org_shifts")
    .where({ org_id: user.org_id })
    .whereRaw("LOWER(shift_name) LIKE ?", ["%open%"])
    .where(function () { this.where('is_active', 1).orWhereNull('is_active'); })
    .first();

  if (openShift) {
    return openShift;
  }

  return null;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Format timestamp to MySQL date string (YYYY-MM-DD)
 */
export function formatLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  return String(val).split('T')[0].split(' ')[0];
}

export function formatLocalDatetime(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  return String(val).replace('T', ' ').replace('Z', '').split('.')[0];
}

export function toSqlDatetime(val) {
  if (!val) {
    const d = new Date();
    return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  if (typeof val === 'string') {
    return val.replace('T', ' ').replace('Z', '').split('.')[0];
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  return String(val);
}

/**
 * Format timestamp to time string HH:MM:SS
 */
export function getTimeStr(d) {
  if (!d) return null;
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[1].split('.')[0];
  }
  const str = String(d).trim().replace('Z', '');
  if (str.includes('T')) return str.split('T')[1].split('.')[0];
  if (str.includes(' ')) return str.split(' ')[1].split('.')[0];
  return str.split('.')[0];
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
    const punchDate = formatLocalDate(p.punch_time);

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

  // DAR Reconciliation Hook on Checkin
  if (result.ok) {
    try {
      await handleAttendanceCheckinHook(context.user_id, context.localTime);
    } catch (darErr) {
      console.warn("DAR Checkin Reconciliation Hook warning:", darErr);
    }
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

  // DAR Reconciliation Hook on Checkout
  if (result.ok) {
    try {
      await handleAttendanceCheckoutHook(context.user_id, context.localTime);
    } catch (darErr) {
      console.warn("DAR Checkout Reconciliation Hook warning:", darErr);
    }
  }

  return result;
}

/**
 * Sync Daily Attendance (Punch-Based Aggregation Engine)
 * Reads from attn_punches, pairs in/out, computes daily summary, upserts attn_daily_summary_v2.
 * Handles overnight shifts (out punch on next calendar day).
 */
export async function syncDailyAttendance(user_id, dateStr, overrides = {}) {
  try {
    const { skipPayroll, v2Only, ...dbOverrides } = overrides;
    const sanitizedDate = dateStr.split('T')[0];

    // Calculate next date for overnight out-punch matching
    const nextDate = new Date(sanitizedDate + 'T12:00:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = formatLocalDate(nextDate);

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

    // Separate column overrides safely for v2 vs legacy schema
    const v2ValidColumns = new Set([
      'shift_id', 'session_count', 'total_hours', 'late_minutes', 'late_reason',
      'overtime_hours', 'status', 'remarks', 'updated_at'
    ]);
    const legacyValidColumns = new Set([
      'shift_id', 'first_in', 'last_out', 'total_hours', 'late_minutes', 'late_reason',
      'overtime_hours', 'status', 'remarks', 'is_finalized', 'is_manual_adjustment',
      'adjusted_by', 'adjustment_reason', 'created_at', 'updated_at', 'is_altered'
    ]);

    const v2Overrides = {};
    const legacyOverrides = {};

    for (const [key, val] of Object.entries(dbOverrides)) {
      if (v2ValidColumns.has(key)) v2Overrides[key] = val;
      if (legacyValidColumns.has(key)) legacyOverrides[key] = val;
    }

    if (sessions.length === 0 && !dbOverrides.status) {
      // Check if user has an approved leave covering this date
      const approvedLeave = await attendanceDB("leave_request")
        .where("user_id", user_id)
        .whereRaw("LOWER(status) = 'approved'")
        .where("start_date", "<=", sanitizedDate)
        .where("end_date", ">=", sanitizedDate)
        .first()
        .catch(() => null);

      const defaultStatus = approvedLeave ? "ON_LEAVE" : "ABSENT";
      const defaultRemarks = approvedLeave ? (approvedLeave.reason || "Approved Leave") : null;
      if (defaultRemarks && !v2Overrides.remarks) v2Overrides.remarks = defaultRemarks;

      const existingV2 = await attendanceDB("attn_daily_summary_v2")
        .where({ user_id, date: sanitizedDate })
        .first();
      if (existingV2) {
        await attendanceDB("attn_daily_summary_v2")
          .where({ user_id, date: sanitizedDate })
          .update({
            session_count: 0, total_hours: 0, late_minutes: 0, overtime_hours: 0,
            status: defaultStatus, updated_at: attendanceDB.fn.now(), ...v2Overrides
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
        formatLocalDatetime(firstIn.punch_time), rules
      );
      lateMinutes = lateCheck.isLate ? lateCheck.minutesLate : 0;

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
      const todayDateStr = formatLocalDate(new Date());
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
    if (dbOverrides.adjustment_reason) remarks.push(dbOverrides.adjustment_reason);
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
      ...v2Overrides
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
      throw v2Err;
    }

    // 10. Trigger payroll recalculation
    if (!skipPayroll) {
      PayrollCalculationService.triggerRecalculation(user_id, sanitizedDate).catch(err => {
        console.error("Failed to trigger background payroll recalculation in syncDailyAttendance:", err);
      });
    }

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
    .whereIn("ap.punch_type", ["in", "out", "normal_punch"]);

  if (user_id) query = query.where("ap.user_id", user_id);
  if (org_id) query = query.where("u.org_id", org_id);
  // Expand search window slightly so midnight cross-over checkpoints are fetched
  if (date_from) query = query.whereRaw("DATE(ap.punch_time) >= DATE_SUB(DATE(?), INTERVAL 1 DAY)", [date_from]);
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
    const userShift = await getUserShift(uid).catch(() => null);
    const shiftRules = ShiftService.getShiftRules(userShift);
    const seenDaysForLate = new Set();

    // Sort punches within the same session/day window by ID to preserve strict chronological insertion order
    userPunches.sort((a, b) => {
      const timeA = new Date(a.punch_time).getTime();
      const timeB = new Date(b.punch_time).getTime();
      if (Math.abs(timeA - timeB) > 12 * 60 * 60 * 1000) {
        return timeA - timeB;
      }
      return a.id - b.id;
    });

    let i = 0;
    while (i < userPunches.length) {
      const inP = userPunches[i];
      if (inP.punch_type === "in") {
        let outP = null;
        let checkpoints = [];
        let j = i + 1;
        while (j < userPunches.length && userPunches[j].punch_type !== "in") {
          if (userPunches[j].punch_type === "normal_punch") {
            const chk = userPunches[j];
            const chkLoc = safeParseJSON(chk.location);
            const chkMeta = safeParseJSON(chk.metadata);
            checkpoints.push({
              id: chk.id,
              punch_time: formatLocalDatetime(chk.punch_time),
              lat: chkLoc.lat || null,
              lng: chkLoc.lng || null,
              accuracy: chkLoc.accuracy || chkMeta.accuracy || null,
              address: (chkLoc.address && chkLoc.address !== 'Locating...') ? chkLoc.address : null,
              note: chkMeta.note || null,
              image_key: chkMeta.image_key || null,
              is_geofence_violation: chkLoc.is_geofence_violation || false
            });
          } else if (userPunches[j].punch_type === "out") {
            outP = userPunches[j];
            j += 1;
            break;
          }
          j += 1;
        }
        i = j;

        const inLoc = safeParseJSON(inP.location);
        const inMeta = safeParseJSON(inP.metadata);
        const outLoc = outP ? safeParseJSON(outP.location) : {};
        const outMeta = outP ? safeParseJSON(outP.metadata) : {};

        let totalHours = null;
        if (outP) {
          const diffMs = new Date(outP.punch_time) - new Date(inP.punch_time);
          if (diffMs > 0) totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        }

        const timeInStr = formatLocalDatetime(inP.punch_time);
        const timeOutStr = outP ? formatLocalDatetime(outP.punch_time) : null;

        const punchDateStr = formatLocalDate(inP.punch_time);
        const todayDateStr = formatLocalDate(new Date());
        const isPastDay = punchDateStr && todayDateStr && punchDateStr < todayDateStr;

        // Evaluate lateness against shift rules only for the first punch-in of each day
        const isFirstSessionOfDay = punchDateStr ? !seenDaysForLate.has(punchDateStr) : false;
        if (punchDateStr && isFirstSessionOfDay) {
          seenDaysForLate.add(punchDateStr);
        }

        const lateCheck = isFirstSessionOfDay
          ? StatusService.calculateLateArrival(timeInStr, shiftRules)
          : { isLate: false, minutesLate: 0 };
        const lateMinutes = lateCheck.isLate ? lateCheck.minutesLate : Number(inMeta.late_minutes || 0);
        const isLate = lateCheck.isLate || lateMinutes > 0 || Boolean(inMeta.late_reason);

        let sessionStatus = "PRESENT";
        if (inP.status === "closed" || outP) {
          sessionStatus = isLate ? "LATE" : "CLOSED";
        } else if (inP.status === "missed_punch" || isPastDay) {
          sessionStatus = "MISSED_PUNCH";
        } else {
          sessionStatus = isLate ? "LATE" : "ACTIVE";
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
          time_in_address: (inLoc.address && inLoc.address !== 'Locating...') ? inLoc.address : null,
          time_out_lat: outLoc.lat || null,
          time_out_lng: outLoc.lng || null,
          time_out_address: (outLoc.address && outLoc.address !== 'Locating...') ? outLoc.address : null,
          time_in_image_key: inMeta.image_key || null,
          time_out_image_key: outMeta.image_key || null,
          late_minutes: lateMinutes,
          is_late: isLate,
          late_reason: inMeta.late_reason || null,
          total_hours: totalHours,
          status: sessionStatus,
          metadata: JSON.stringify({
            time_in: { timezone: inMeta.timezone || "Asia/Kolkata" },
            time_out: { timezone: outMeta?.timezone || "Asia/Kolkata" }
          }),
          created_at: inP.created_at,
          updated_at: outP ? outP.created_at : inP.created_at,
          checkpoints
        });
      } else {
        i += 1;
      }
    }
  }

  let finalSessions = allSessions;
  if (date_from || date_to) {
    finalSessions = allSessions.filter(s => {
      const d = s.time_in ? s.time_in.split('T')[0].split(' ')[0] : null;
      if (!d) return true;
      if (date_from && d < date_from) return false;
      if (date_to && d > date_to) return false;
      return true;
    });
  }

  finalSessions.sort((a, b) => new Date(b.time_in) - new Date(a.time_in));
  return finalSessions.slice(0, Math.min(parseInt(limit) || 100, 100));
}

/**
 * Fetch attendance records for admin view with user details
 */
export async function fetchAdminRecords({ org_id, user_id, date_from, date_to, limit }) {
  const records = await fetchSessionsFromPunches({ org_id, user_id, date_from, date_to, limit }).catch(() => []);

  // Fetch pre-signed URLs for images
  const withUrls = await Promise.all(
    (records || []).map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        if (row.time_in_image_key.startsWith('http://') || row.time_in_image_key.startsWith('https://')) {
          timeInUrl = row.time_in_image_key;
        } else {
          const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key }).catch(() => ({ url: null }));
          timeInUrl = url;
        }
      }
      if (row.time_out_image_key) {
        if (row.time_out_image_key.startsWith('http://') || row.time_out_image_key.startsWith('https://')) {
          timeOutUrl = row.time_out_image_key;
        } else {
          const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key }).catch(() => ({ url: null }));
          timeOutUrl = url;
        }
      }

      const checkpoints = await Promise.all(
        (row.checkpoints || []).map(async (chk) => {
          let chkImgUrl = null;
          if (chk.image_key) {
            if (chk.image_key.startsWith('http://') || chk.image_key.startsWith('https://')) {
              chkImgUrl = chk.image_key;
            } else {
              const { url } = await S3Service.getFileUrl({ key: chk.image_key }).catch(() => ({ url: null }));
              chkImgUrl = url;
            }
          }
          return {
            ...chk,
            image_url: chkImgUrl,
            image: chkImgUrl
          };
        })
      );

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
        checkpoints
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
        if (row.time_in_image_key.startsWith('http://') || row.time_in_image_key.startsWith('https://')) {
          timeInUrl = row.time_in_image_key;
        } else {
          const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key }).catch(() => ({ url: null }));
          timeInUrl = url;
        }
      }
      if (row.time_out_image_key) {
        if (row.time_out_image_key.startsWith('http://') || row.time_out_image_key.startsWith('https://')) {
          timeOutUrl = row.time_out_image_key;
        } else {
          const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key }).catch(() => ({ url: null }));
          timeOutUrl = url;
        }
      }

      const checkpoints = await Promise.all(
        (row.checkpoints || []).map(async (chk) => {
          let chkImgUrl = null;
          if (chk.image_key) {
            if (chk.image_key.startsWith('http://') || chk.image_key.startsWith('https://')) {
              chkImgUrl = chk.image_key;
            } else {
              const { url } = await S3Service.getFileUrl({ key: chk.image_key }).catch(() => ({ url: null }));
              chkImgUrl = url;
            }
          }
          return {
            ...chk,
            image_url: chkImgUrl,
            image: chkImgUrl
          };
        })
      );

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
        checkpoints
      };
    })
  );

  return withUrls;
}

// ========== EXPORT ==========

/**
 * Export attendance records to Excel for a given month
 */
export async function exportRecordsToExcel({ user_id, org_id, month, year, monthNum }) {
  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  const records = (await fetchSessionsFromPunches({ user_id, date_from: startDate, date_to: endDate, limit: 1000 }).catch(() => [])) || [];

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

  const todayDate = localTime ? localTime.split('T')[0] : formatLocalDate(new Date());
  const isSimulation = context.event_source === "SIMULATION" || context.punch_nature === "simulated";
  const punchNature = isSimulation ? "simulated" : (context.punch_nature || "default");
  const punchTime = localTime ? toSqlDatetime(localTime) : toSqlDatetime(new Date());
  const addressStr = (context.address && context.address !== 'Locating...') ? context.address : (isSimulation ? "Simulated Location" : "Pending...");

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
      const lastPunchDate = formatLocalDate(latestGlobal.punch_time);
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
    late_minutes: lateCheck.isLate ? minutesLate : 0,
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

  // 9. Async geocode & image update (runs immediately, independent of BullMQ)
  //    This ensures address/image are always updated even when Redis is offline.
  if (!isSimulation && latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
    const punchIdForGeo = punch_id;
    setImmediate(async () => {
      try {
        const geoRes = await MapsService.coordsToAddress(latitude, longitude);
        const resolvedAddress = (geoRes && geoRes.address) ? geoRes.address : 'Unknown Location';
        const punch = await attendanceDB('attn_punches').where({ id: punchIdForGeo }).first();
        if (punch) {
          const loc = safeParseJSON(punch.location);
          if (!loc.address || loc.address === 'Locating...' || loc.address === 'Pending...') {
            loc.address = resolvedAddress;
            await attendanceDB('attn_punches').where({ id: punchIdForGeo }).update({
              location: JSON.stringify(loc)
            });
          }
        }
      } catch (geoErr) {
        console.warn('[processTimeInSync] Inline geocoding failed:', geoErr.message);
      }
    });
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
  const addressStr = (context.address && context.address !== 'Locating...') ? context.address : (isSimulation ? "Simulated Location" : "Pending...");
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
  const sessionDate = formatLocalDate(openInPunch.punch_time);
  const daySummary = await attendanceDB("attn_daily_summary_v2")
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
  const durationHours = StatusService.calculateDurationHours(openInPunch.punch_time, localTime);
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

  // 9. Async geocode for time-out address (independent of BullMQ)
  if (!isSimulation && latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
    const outPunchId = punch_id;
    setImmediate(async () => {
      try {
        const geoRes = await MapsService.coordsToAddress(latitude, longitude);
        const resolvedAddress = (geoRes && geoRes.address) ? geoRes.address : 'Unknown Location';
        const punch = await attendanceDB('attn_punches').where({ id: outPunchId }).first();
        if (punch) {
          const loc = safeParseJSON(punch.location);
          if (!loc.address || loc.address === 'Locating...' || loc.address === 'Pending...') {
            loc.address = resolvedAddress;
            await attendanceDB('attn_punches').where({ id: outPunchId }).update({
              location: JSON.stringify(loc)
            });
          }
        }
      } catch (geoErr) {
        console.warn('[processTimeOutSync] Inline geocoding failed:', geoErr.message);
      }
    });
  }

  // 10. Get aggregated status + totals for response
  let status = "PRESENT";
  let totalHoursToday = parseFloat(totalHours.toFixed(2));
  try {
    const updatedSummary = await attendanceDB("attn_daily_summary_v2")
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

export async function recordLocationPing({
  userId,
  latitude,
  longitude,
  accuracy = null,
  address = null,
  note = null,
  file = null,
  ip,
  userAgent,
  isGeofenceViolation = false,
  localTime = null
}) {
  // 1. Shift Policy Enforcement for Checkpoints
  const shift = await getUserShift(userId);
  const rules = ShiftService.getShiftRules(shift);
  const checkpointPolicy = rules?.checkpoint_requirements || { enabled: true, selfie: false };

  if (checkpointPolicy.enabled === false) {
    return {
      ok: false,
      status: 403,
      message: "Checkpoints are disabled by your assigned shift policy."
    };
  }

  const hasSelfie = Boolean(file && (file.buffer || file.path));
  if (checkpointPolicy.selfie === true && !hasSelfie) {
    return {
      ok: false,
      status: 400,
      message: "Shift Policy Violation: Selfie is required to mark a checkpoint."
    };
  }

  let initialAddress = (address && address !== "Locating...") ? address : null;
  const punchTime = localTime ? toSqlDatetime(localTime) : toSqlDatetime(new Date());

  const metadata = {
    ip,
    user_agent: userAgent,
    note: note || null,
    accuracy: accuracy ? Math.round(accuracy) : null,
    image_key: null,
    local_time: localTime ? toMySQLDateTime(localTime) : undefined
  };

  const locationData = {
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ? Math.round(accuracy) : null,
    address: initialAddress,
    is_geofence_violation: isGeofenceViolation
  };

  const [punch_id] = await attendanceDB("attn_punches").insert({
    user_id: userId,
    punch_time: punchTime,
    punch_type: "normal_punch",
    location: JSON.stringify(locationData),
    punch_nature: "default",
    metadata: JSON.stringify(metadata),
    created_at: attendanceDB.fn.now()
  });

  // Async or immediate image upload to S3 only if selfie is enabled in shift policy and file provided
  if (checkpointPolicy.selfie === true && file && (file.buffer || file.path)) {
    try {
      const uploadRes = await S3Service.uploadCompressedImage({
        fileBuffer: file.buffer,
        key: `${punch_id}_checkpoint`,
        directory: "attendance_images"
      });
      if (uploadRes && uploadRes.key) {
        metadata.image_key = uploadRes.key;
        await attendanceDB("attn_punches").where({ id: punch_id }).update({
          metadata: JSON.stringify(metadata)
        });
      }
    } catch (s3Err) {
      console.error(`[Checkpoint] S3 upload error for punch #${punch_id}:`, s3Err.message);
    }
  }

  // Reverse geocode address if missing
  if (!initialAddress && latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
    setImmediate(async () => {
      try {
        const geoRes = await MapsService.coordsToAddress(latitude, longitude);
        if (geoRes && geoRes.address) {
          locationData.address = geoRes.address;
          await attendanceDB("attn_punches").where({ id: punch_id }).update({
            location: JSON.stringify(locationData)
          });
        }
      } catch (geoErr) {
        console.warn(`[Checkpoint] Geocoding error for punch #${punch_id}:`, geoErr.message);
      }
    });
  }

  return { ok: true, punch_id, message: "Checkpoint marked successfully" };
}
