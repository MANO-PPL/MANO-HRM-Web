import ExcelJS from "exceljs";
import { attendanceDB } from "../../config/database.js";
import * as S3Service from "../../services/s3/s3Service.js";
import EventBus from "../../utils/EventBus.js";
import * as ShiftService from "../shifts/shiftService.js";
import * as StatusService from "../../services/statusEvalution/statusEvaluationService.js";
import * as OrgAttendanceSettingsService from "./orgAttendanceSettingsService.js";
import { PayrollCalculationService } from '../payroll/PayrollCalculationService.js';
import { toMySQLDateTime, toMySQLDate, toMySQLTime, pad, timeToMinutes } from "../../utils/dateUtils.js";
import { safeJsonParse } from "../../utils/dataUtils.js";
import * as MapsService from "../../services/google_api_services/maps.js";
import { handleAttendanceCheckinHook, handleAttendanceCheckoutHook, handleAttendanceCorrectionApprovedHook } from "../DAR/darReconciliationService.js";

// How long a gap between a closed session and a new check-in still counts as "resuming the same
// shift instance after a break" rather than "starting a new day" — matters for a shift whose
// break happens to straddle midnight (see processTimeInSync's break-continuation check).
const BREAK_CONTINUATION_WINDOW_MINUTES = 120;

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

  const openShift = await ShiftService.getOpenShiftFallback(user.org_id);
  if (openShift) {
    return openShift;
  }

  return null;
}

/**
 * Resolve which shift's rules govern a specific check-in session — the assigned shift if the
 * punch is close to its normal start time, another org shift template if the punch matches one
 * better, or a neutral off-pattern fallback if nothing matches. core_users.shift_id is never
 * modified. Pattern-matching only applies for employees with a real assigned shift — Open-Shift
 * and no-shift users always just get their existing (single) shift, unchanged from today.
 */
export async function resolveUserShiftForSession(user_id, punchInTimestamp = null) {
  const assignedShift = await getUserShift(user_id);
  const assignedRules = ShiftService.getShiftRules(assignedShift);

  if (!punchInTimestamp) {
    return { shift: assignedShift, rules: assignedRules, matchType: assignedShift ? 'assigned' : 'no_shift' };
  }

  const userRow = await attendanceDB('core_users').where('user_id', user_id).select('shift_id', 'org_id').first();
  if (!userRow || !userRow.shift_id) {
    return { shift: assignedShift, rules: assignedRules, matchType: assignedShift ? 'assigned' : 'no_shift' };
  }

  return ShiftService.resolveShiftForPunch({ assignedShift, org_id: userRow.org_id, punchInTimestamp });
}

/**
 * Reconstruct which shift/rules governed an already-created in-punch, from the resolution it
 * recorded in its own metadata at check-in time — so checkout/aggregation agree with what
 * check-in decided rather than risking a different result from re-matching live. Falls back to
 * live resolution for punches created before this metadata existed.
 */
async function resolveShiftFromPunchRecord(inPunchRow) {
  const meta = safeParseJSON(inPunchRow.metadata);
  if (meta && meta.match_type === 'off_pattern_fallback') {
    return { shift: null, rules: ShiftService.getOffPatternFallbackRules(), matchType: 'off_pattern_fallback' };
  }
  if (meta && meta.resolved_shift_id) {
    const userRow = await attendanceDB('core_users').where('user_id', inPunchRow.user_id).select('org_id').first();
    if (userRow) {
      const matchedShift = await ShiftService.getShiftById(userRow.org_id, meta.resolved_shift_id);
      if (matchedShift) {
        return { shift: matchedShift, rules: ShiftService.getShiftRules(matchedShift), matchType: meta.match_type || 'assigned' };
      }
    }
  }
  return resolveUserShiftForSession(inPunchRow.user_id, formatLocalDatetime(inPunchRow.punch_time));
}

/**
 * Format timestamp to MySQL date string (YYYY-MM-DD)
 */
export function formatLocalDate(val) {
  return toMySQLDate(val);
}

export function formatLocalDatetime(val) {
  return toMySQLDateTime(val);
}

export function toSqlDatetime(val) {
  return toMySQLDateTime(val) || toMySQLDateTime(new Date());
}

/**
 * Format timestamp to time string HH:MM:SS
 */
export function getTimeStr(d) {
  return toMySQLTime(d);
}

/**
 * Safely parse a JSON column value.
 */
export const safeParseJSON = safeJsonParse;

/**
 * Pair punches sequentially into sessions for a specific date.
 */
export function pairPunchesForDate(punches, dateStr) {
  const sessions = [];
  let i = 0;
  while (i < punches.length) {
    const p = punches[i];
    // Use the punch's resolved attendance date (Phase 3/4 late-arrival rollback or
    // break-continuation can date a punch to a day other than its own raw calendar date),
    // falling back to the raw date for punches with no such resolution recorded.
    const meta = safeParseJSON(p.metadata);
    const punchDate = meta.attendance_date || formatLocalDate(p.punch_time);

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
    } catch (_) { }
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
    } catch (_) { }
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

    // 1. Fetch punches: all in/out on target date + out punches on next day (overnight) + any
    // punch explicitly resolved (Phase 3 late-arrival rollback) to this date regardless of its
    // own raw calendar date — e.g. a night-shift punch-in that landed just after midnight.
    const punches = await attendanceDB("attn_punches")
      .where({ user_id })
      .whereNull("deleted_at")
      .whereIn("punch_type", ["in", "out"])
      .where(function () {
        this.whereRaw("DATE(punch_time) = ?", [sanitizedDate])
          .orWhere(function () {
            this.where("punch_type", "out")
              .whereRaw("DATE(punch_time) = ?", [nextDateStr]);
          })
          .orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.attendance_date')) = ?", [sanitizedDate]);
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

    // 4. Shift rules — resolved from whichever shift actually matched this session's first
    // punch-in (assigned, pattern-matched, or off-pattern fallback; Phase 3), not blindly the
    // employee's assigned shift.
    let shift, rules;
    if (sessions.length > 0) {
      ({ shift, rules } = await resolveShiftFromPunchRecord(sessions[0].in_punch));
    } else {
      shift = await getUserShift(user_id);
      rules = ShiftService.getShiftRules(shift);
    }

    // A half-day (Special Weekend & Alternate Rules) is judged against its own window/duration,
    // not the full shift's — otherwise a completed half-day gets evaluated as if it fell short
    // of a full day.
    const effectiveRules = ShiftService.getEffectiveRulesForDate(sanitizedDate, rules);

    // 5. Late calculation (first session only)
    let lateMinutes = 0;
    let lateReason = null;
    if (sessions.length > 0) {
      const firstIn = sessions[0].in_punch;
      const lateCheck = StatusService.calculateLateArrival(
        formatLocalDatetime(firstIn.punch_time), effectiveRules
      );
      lateMinutes = lateCheck.isLate ? lateCheck.minutesLate : 0;

      const firstMeta = safeParseJSON(firstIn.metadata);
      lateReason = firstMeta?.late_reason || null;
    }

    // 6. Overtime
    const { actualOvertime, cappedOvertime } = StatusService.computeOvertimeBreakdown(totalHours, effectiveRules);
    const overtimeHours = cappedOvertime;
    const overtimeHoursActual = actualOvertime;

    // 7. Status determination
    let finalStatus;
    const dayTypeForStatus = ShiftService.getDayType(sanitizedDate, rules.week_off_policy);
    if (overrides.status) {
      finalStatus = overrides.status;
    } else if (sessions.some(s => !s.out_punch)) {
      const todayDateStr = formatLocalDate(new Date());
      const isPastDate = sanitizedDate < todayDateStr;
      finalStatus = isPastDate ? "MISSED_PUNCH" : "PRESENT";
    } else if (sessionCount === 0) {
      finalStatus = "ABSENT";
    } else if (dayTypeForStatus === 'half_day') {
      // Half-day: too little time worked (relative to the half-day's own expected hours, not a
      // full day's) reads ABSENT — same "showed up too briefly to count" idea as a full day,
      // just proportioned. Otherwise a completed half-day reads HALF_DAY, not a bare PRESENT
      // indistinguishable from a full day.
      const halfDayExpectedHours = ShiftService.getExpectedHours(sanitizedDate, rules.week_off_policy, rules);
      const graceMins = Number(rules?.grace_period?.minutes || 0);
      if (totalHours < (halfDayExpectedHours * 0.5)) {
        finalStatus = "ABSENT";
      } else if (overtimeHours > 0) {
        finalStatus = "OVERTIME";
      } else if (lateMinutes > graceMins) {
        finalStatus = "LATE";
      } else {
        finalStatus = "HALF_DAY";
      }
    } else {
      finalStatus = StatusService.evaluateStatus(effectiveRules, {
        total_hours: totalHours,
        total_hours_today: totalHours,
        minutes_late: lateMinutes,
        event_type: "time_out"
      });

      // Org-wide threshold half-day policy — only ever applies on a date the shift itself
      // classifies as a normal WORKING day (dayTypeForStatus === 'working'), never stacking with
      // the shift's own half-day/week-off rule handled above. Only downgrades an otherwise
      // unremarkable PRESENT/LATE day — never "upgrades" a genuine ABSENT, and never overrides a
      // day that already earned OVERTIME (working extra hours despite a late start is still a
      // full, or more than full, day's effort).
      if ((finalStatus === 'PRESENT' || finalStatus === 'LATE') && dayTypeForStatus === 'working') {
        const orgIdForSettings = shift?.org_id || (await attendanceDB('core_users').where('user_id', user_id).select('org_id').first())?.org_id;
        if (orgIdForSettings) {
          const orgSettings = await OrgAttendanceSettingsService.getOrgAttendanceSettings(orgIdForSettings);
          if (orgSettings?.half_day_threshold_enabled) {
            const firstInMinutes = timeToMinutes(toMySQLTime(sessions[0].in_punch.punch_time));
            const lastSessionWithOut = [...sessions].reverse().find(s => s.out_punch);
            const lastOutMinutes = lastSessionWithOut ? timeToMinutes(toMySQLTime(lastSessionWithOut.out_punch.punch_time)) : null;

            const lateThresholdMinutes = orgSettings.half_day_late_after_time ? timeToMinutes(orgSettings.half_day_late_after_time) : null;
            const earlyThresholdMinutes = orgSettings.half_day_early_before_time ? timeToMinutes(orgSettings.half_day_early_before_time) : null;

            const arrivedLate = lateThresholdMinutes !== null && firstInMinutes > lateThresholdMinutes;
            const leftEarly = earlyThresholdMinutes !== null && lastOutMinutes !== null && lastOutMinutes < earlyThresholdMinutes;

            if (arrivedLate || leftEarly) {
              finalStatus = 'HALF_DAY';
            }
          }
        }
      }
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
      overtime_hours_actual: overtimeHoursActual,
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
              image_key: chkMeta.image_key || chkLoc.image_key || chkMeta.image || chkLoc.image || chk.image_key || null,
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
          time_in_image_key: inMeta.image_key || inLoc.image_key || inMeta.image || inLoc.image || inP.image_key || null,
          time_out_image_key: outMeta.image_key || outLoc.image_key || outMeta.image || outLoc.image || (outP ? outP.image_key : null) || null,
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
      const timeInUrl = await S3Service.resolveS3ImageUrl(row.time_in_image_key || row.time_in_image || row.time_in_photo);
      const timeOutUrl = await S3Service.resolveS3ImageUrl(row.time_out_image_key || row.time_out_image || row.time_out_photo);

      const checkpoints = await Promise.all(
        (row.checkpoints || []).map(async (chk) => {
          const chkImgUrl = await S3Service.resolveS3ImageUrl(chk.image_key || chk.image_url || chk.image || chk.photo);
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
      const timeInUrl = await S3Service.resolveS3ImageUrl(row.time_in_image_key || row.time_in_image || row.time_in_photo);
      const timeOutUrl = await S3Service.resolveS3ImageUrl(row.time_out_image_key || row.time_out_image || row.time_out_photo);

      const checkpoints = await Promise.all(
        (row.checkpoints || []).map(async (chk) => {
          const chkImgUrl = await S3Service.resolveS3ImageUrl(chk.image_key || chk.image_url || chk.image || chk.photo);
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
            const timeInUrl = await S3Service.resolveS3ImageUrl(row.time_in_image_key || row.time_in_image || row.time_in_photo);
            const timeOutUrl = await S3Service.resolveS3ImageUrl(row.time_out_image_key || row.time_out_image || row.time_out_photo);

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

  const isSimulation = context.event_source === "SIMULATION" || context.punch_nature === "simulated";
  const punchNature = isSimulation ? "simulated" : (context.punch_nature || "default");
  const punchTime = localTime ? toSqlDatetime(localTime) : toSqlDatetime(new Date());
  const addressStr = (context.address && context.address !== 'Locating...') ? context.address : (isSimulation ? "Simulated Location" : "Pending...");

  // Resolve which shift governs this session before deciding the attendance date — for a
  // crosses-midnight shift, a late arrival after midnight still belongs to the day the shift
  // itself started, not the punch's own raw calendar date (rollback below).
  const { shift, rules, matchType } = await resolveUserShiftForSession(user_id, localTime);

  const rawPunchDate = localTime ? localTime.split('T')[0] : formatLocalDate(new Date());
  let todayDate = rawPunchDate;

  // Break continuation: a session closed very recently (within BREAK_CONTINUATION_WINDOW_MINUTES)
  // on the previous calendar day means this punch-in is resuming that same shift instance after
  // a break, not starting a fresh day — even if the break itself straddled midnight. This takes
  // priority over the crosses-midnight rollback below, since it's actual evidence (a real
  // just-closed session), not an inference from shift timing alone.
  if (localTime) {
    const prevDateObj = new Date(rawPunchDate + 'T12:00:00');
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const previousDate = formatLocalDate(prevDateObj);

    const priorClose = await attendanceDB("attn_punches")
      .where({ user_id, punch_type: "out" })
      .whereNull("deleted_at")
      .whereRaw("DATE(punch_time) = ?", [previousDate])
      .orderBy("punch_time", "desc")
      .orderBy("id", "desc")
      .first();

    if (priorClose) {
      const gapMinutes = (new Date(toSqlDatetime(localTime)).getTime() - new Date(priorClose.punch_time).getTime()) / 60000;
      if (gapMinutes >= 0 && gapMinutes <= BREAK_CONTINUATION_WINDOW_MINUTES) {
        todayDate = previousDate; // continuation, not a new day
      }
    }
  }

  // Late-arrival rollback for a crosses-midnight shift — only applies if break-continuation
  // above didn't already resolve this session to the previous day.
  if (todayDate === rawPunchDate && rules.crosses_midnight && rules.shift_timing.end_time && localTime) {
    const punchTimePart = String(localTime).split('T')[1];
    const punchMinutes = timeToMinutes(punchTimePart);
    const endMinutes = timeToMinutes(rules.shift_timing.end_time);
    if (punchMinutes !== null && endMinutes !== null && punchMinutes < endMinutes) {
      // Late arrival (however many hours late) for the instance that started the PREVIOUS day.
      const prevDateObj = new Date(rawPunchDate + 'T12:00:00');
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      todayDate = formatLocalDate(prevDateObj);
    }
  }

  // 1. Check for open session on the target date — match by the resolved attendance date (not
  // just the punch's own raw date), so a rolled-back late-night arrival is found correctly.
  const lastPunchOnDate = await attendanceDB("attn_punches")
    .where({ user_id })
    .whereNull("deleted_at")
    .whereIn("punch_type", ["in", "out"])
    .whereRaw("(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.attendance_date')) = ? OR DATE(punch_time) = ?)", [todayDate, todayDate])
    .orderBy("punch_time", "desc")
    .orderBy("id", "desc")
    .first();

  if (lastPunchOnDate && lastPunchOnDate.punch_type === "in") {
    return { ok: false, status: 400, message: `Already timed in on ${todayDate}. Please time out first.` };
  }

  // If real-time check-in, ensure the latest global punch is not an open in-punch from a prior day
  if (!isSimulation) {
    const latestGlobal = await attendanceDB("attn_punches")
      .where({ user_id })
      .whereNull("deleted_at")
      .whereIn("punch_type", ["in", "out"])
      .orderBy("punch_time", "desc")
      .orderBy("id", "desc")
      .first();

    if (latestGlobal && latestGlobal.punch_type === "in") {
      const latestMeta = safeParseJSON(latestGlobal.metadata);
      const lastPunchDate = latestMeta.attendance_date || formatLocalDate(latestGlobal.punch_time);
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
    .whereRaw("(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.attendance_date')) = ? OR DATE(punch_time) = ?)", [todayDate, todayDate]);

  const sessionNumber = todayInPunches.length + 1;
  const isFirstSession = todayInPunches.length === 0;

  // 3. Shift Compliance (shift/rules already resolved above)
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
    timezone: context.timezone || "N/A",
    local_time: toMySQLDateTime(localTime),
    // Records what check-in resolved, so checkout/aggregation/live-view agree with it later
    // instead of risking a different result from re-matching live.
    attendance_date: todayDate,
    resolved_shift_id: shift ? shift.shift_id : null,
    match_type: matchType
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

  const timeInMessage = matchType === 'pattern_matched'
    ? `Timed in successfully (matched to ${shift.shift_name})`
    : matchType === 'off_pattern_fallback'
      ? "Timed in successfully (off-pattern session — no matching shift template)"
      : "Timed in successfully";

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
    message: timeInMessage,
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

  // 2. Determine which day this session belongs to — read back from what check-in itself
  // resolved (Phase 3), not the punch's own raw date, so a late-night arrival rolled back to
  // the previous day stays on that same day at checkout. Falls back to the raw punch date for
  // sessions opened before this metadata existed.
  // Note: an employee is never blocked from checking out just because the cron
  // pre-emptively flagged this open session as a possible missed punch — only a
  // genuinely stale session (>24h, checked next) requires a correction request.
  const openInMeta = safeParseJSON(openInPunch.metadata);
  const sessionDate = openInMeta.attendance_date || formatLocalDate(openInPunch.punch_time);

  // 3. Check session age (> 24h → require correction)
  const durationHours = StatusService.calculateDurationHours(openInPunch.punch_time, localTime);
  if (durationHours > 24) {
    return {
      ok: false,
      status: 400,
      message: "Your active session is older than 24 hours. Please submit a correction request to adjust your hours."
    };
  }

  // 4. Shift Context & Compliance — resolved from what check-in itself matched, so checkout
  // can't disagree with it (e.g. by re-matching a slightly different candidate hours later).
  const { shift, rules } = await resolveShiftFromPunchRecord(openInPunch);

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
    total_hours: parseFloat(totalHours.toFixed(2)),
    attendance_date: sessionDate
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
