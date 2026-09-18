import { attendanceDB } from '../../config/database.js';
import {
    getDayType,
    getExpectedHours,
    getShiftRules,
    normalizeMaxOvertimeHours,
    getShiftById,
    getOffPatternFallbackRules,
    getEffectiveRulesForDate,
    getOpenShiftFallback
} from '../../modules/shifts/shiftService.js';
import { getOrgAttendanceSettings } from '../../modules/attendance/orgAttendanceSettingsService.js';
import { toMySQLTime, toMySQLDate, toMySQLDateTime, calculateDurationHours, pad, DAY_NAMES, timeToMinutes } from '../../utils/dateUtils.js';
import { safeJsonParse } from '../../utils/dataUtils.js';
import { formatDateInTimezone } from '../../utils/timezoneUtils.js';

/**
 * Status Evaluation Service
 * 
 * Centralized service for all attendance status logic:
 * - Late arrival calculation
 * - Single-session status evaluation
 * - Multi-session (batch) evaluation
 * - Daily status derivation
 * - Session context building
 */

// Helpers & Backward-Compatibility Re-exports
export const safeParseJSON = safeJsonParse;
export { calculateDurationHours };

export function getLocalNow(timezone = 'Asia/Kolkata') {
    const tz = timezone || 'Asia/Kolkata';
    return getLocalTimeString(new Date(), tz);
}

export function getLocalTimeString(date = new Date(), timezone = 'UTC') {
    const d = date instanceof Date ? date : new Date(date);
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        let hour = parts.find(p => p.type === 'hour').value;
        const minute = parts.find(p => p.type === 'minute').value;
        const second = parts.find(p => p.type === 'second').value;
        if (hour === '24') hour = '00';
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (e) {
        return d.toISOString().replace('Z', '');
    }
}

//  Late Arrival
/**
 * Single shared definition of "late enough to count" — minutes late strictly beyond the grace
 * period. Used by every status-evaluation path so the threshold behavior can't drift between them.
 */
function isLateBeyondGrace(minutesLate, graceMinutes) {
    return Number(minutesLate || 0) > Number(graceMinutes || 0);
}

/**
 * Calculate late arrival and grace period compliance.
 * @param {string} localTime - Local time in ISO format
 * @param {Object} rules - Unified shift rules
 * @returns {{ minutesLate: number, isLate: boolean, gracePeriod: number, shiftStartTime: string }}
 */
export function calculateLateArrival(localTime, rules) {
    let minutesLate = 0;
    const timing = rules?.shift_timing || {};
    const startTimeStr = timing.start_time;
    const endTimeStr = timing.end_time;

    if (startTimeStr && localTime) {
        const timePart = toMySQLTime(localTime);
        if (timePart) {
            const [curH, curM] = timePart.split(':').map(Number);
            let currentMinutes = curH * 60 + curM;

            const [shiftH, shiftM] = startTimeStr.split(':').map(Number);
            const shiftMinutes = shiftH * 60 + shiftM;

            // For a shift that crosses midnight, a punch-in in the early-morning tail (before
            // the shift's own end time) is a late arrival for the *previous* day's instance —
            // wrap it forward so the comparison against shiftMinutes is correct. Replaces the
            // old hardcoded "shift starts >=18:00 and punch before noon" approximation with the
            // shift's actual crosses_midnight flag and its own end time.
            if (rules?.crosses_midnight && endTimeStr) {
                const [endH, endM] = endTimeStr.split(':').map(Number);
                const endMinutes = endH * 60 + endM;
                if (currentMinutes < endMinutes) {
                    currentMinutes += 1440;
                }
            }

            if (currentMinutes > shiftMinutes) {
                minutesLate = currentMinutes - shiftMinutes;
            }
        }
    }

    const gracePeriod = Number(rules?.grace_period?.minutes || 0);
    const isLate = isLateBeyondGrace(minutesLate, gracePeriod);

    return {
        minutesLate,
        isLate,
        gracePeriod,
        shiftStartTime: startTimeStr
    };
}

// ─────────────────────────────────────────────────────────────
// Single Session Status
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate status for a single session based on shift rules and session context.
 * @param {Object} rules - Shift rules
 * @param {Object} data - Session data (total_hours, total_hours_today, minutes_late, event_type)
 * @returns {"PRESENT"|"LATE"|"OVERTIME"|"ABSENT"}
 */
export function evaluateStatus(rules, data) {
    // 1. Overtime Check (Priority)
    // Use total_hours_today if available, otherwise fallback to session total_hours
    const rawTotal = data.total_hours_today ?? data.total_hours ?? 0;
    const totalHours = Number(rawTotal) || 0;

    // Calculate expected shift hours dynamically from timing
    const timing = rules?.shift_timing || {};
    const [sH, sM] = (timing.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timing.end_time || '18:00:00').split(':').map(Number);
    let expectedHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (expectedHours < 0) expectedHours += 24;

    // Threshold defaults to 8 if missing, NaN, or 0
    let threshold = Number(rules?.overtime?.threshold);
    if (isNaN(threshold) || threshold <= 0) threshold = 8;

    // The overtime threshold should not be less than the expected hours of the shift.
    threshold = Math.max(threshold, expectedHours);

    const maxOvertimeVal = rules?.overtime?.max_overtime !== undefined
        ? rules.overtime.max_overtime
        : rules?.overtime?.maxOvertime;
    const maxOvertime = normalizeMaxOvertimeHours(maxOvertimeVal);

    // "Overtime Starts After" alone decides the label — once crossed, OT is in effect immediately.
    if (rules?.overtime?.enabled !== false && maxOvertime > 0 && totalHours >= threshold) {
        return "OVERTIME";
    }

    // 2. Absent Check (Less than 4 hours total at checkout)
    // Only apply if the shift timing has a start_time (i.e. it is not an open/flexible shift)
    if (rules?.shift_timing?.start_time && totalHours < 4 && data.event_type === "time_out") {
        return "ABSENT";
    }

    // 3. Late Check
    const graceMins = Number(rules.grace_period?.minutes || 0);
    const minutesLate = Number(data.minutes_late || 0);

    if (isLateBeyondGrace(minutesLate, graceMins)) {
        return "LATE";
    }

    return "PRESENT";
}

// ─────────────────────────────────────────────────────────────
// Overtime Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Compute both the real (uncapped) and payable (capped) overtime for a session.
 * The daily cap only limits what gets counted for pay/reporting — it never discards
 * the fact that the extra hours were actually worked.
 * @param {number} totalHours
 * @param {Object} rules - Shift rules
 * @param {boolean} [allowHistorical] - If true, compute OT even when the shift's overtime is
 *   currently disabled — for reporting on a past date under whatever policy was in effect then.
 *   Callers that must reflect the shift's CURRENT setting (e.g. live status) must leave this
 *   false and gate the result themselves; this flag only affects the raw calculation.
 * @returns {{ actualOvertime: number, cappedOvertime: number, maxOvertime: number }}
 */
export function computeOvertimeBreakdown(totalHours, rules, allowHistorical = false) {
    const timing = rules?.shift_timing || {};
    const [sH, sM] = (timing.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timing.end_time || '18:00:00').split(':').map(Number);
    let expectedHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (expectedHours < 0) expectedHours += 24;

    // "Overtime Starts After" — when the OT label triggers. Can be set above the shift's own
    // duration (e.g. 9h30m on a 9-6 shift) but never below it.
    let threshold = Number(rules?.overtime?.threshold || 8);
    threshold = Math.max(threshold, expectedHours);

    const isEnabled = rules?.overtime?.enabled !== false || allowHistorical;

    const maxOvertimeVal = rules?.overtime?.max_overtime !== undefined
        ? rules.overtime.max_overtime
        : rules?.overtime?.maxOvertime;
    const maxOvertime = normalizeMaxOvertimeHours(maxOvertimeVal);

    if (isEnabled && totalHours >= threshold) {
        // Credited hours are always measured from the shift's own duration, not from the
        // (possibly later) "Overtime Starts After" trigger point — so raising the trigger to
        // avoid noisy OT labels for marginal overruns never shortchanges genuine OT worked.
        const actualOvertime = parseFloat(Math.max(0, totalHours - expectedHours).toFixed(2));
        const cappedOvertime = actualOvertime > maxOvertime ? maxOvertime : actualOvertime;
        return { actualOvertime, cappedOvertime, maxOvertime };
    }
    return { actualOvertime: 0, cappedOvertime: 0, maxOvertime };
}

/**
 * Calculate payable overtime hours (capped at the shift's daily max) based on
 * total hours worked and shift rules. See computeOvertimeBreakdown() for the
 * uncapped/actual figure and the allowHistorical parameter.
 * @param {number} totalHours
 * @param {Object} rules - Shift rules
 * @param {boolean} [allowHistorical]
 * @returns {number} Overtime hours (capped)
 */
export function calculateOvertime(totalHours, rules, allowHistorical = false) {
    return computeOvertimeBreakdown(totalHours, rules, allowHistorical).cappedOvertime;
}

/**
 * Live-gates a stored overtime figure by the shift's CURRENT overtime.enabled setting, without
 * ever touching the underlying stored value — so disabling OT on a shift hides it everywhere
 * (Reports, exports) immediately, and re-enabling it restores correct display with no
 * recomputation needed. Never retroactive to payroll that's already been calculated/closed —
 * callers decide separately whether a given consumer should apply this gate.
 * @param {number} storedHours - The already-computed/stored overtime figure
 * @param {Object} currentRules - The shift's CURRENT rules (not necessarily what was in effect
 *   when storedHours was computed)
 * @returns {number}
 */
export function formatOvertimeForDisplay(storedHours, currentRules) {
    const hours = Number(storedHours) || 0;
    if (currentRules?.overtime?.enabled === false) return 0;
    return hours;
}

// ─────────────────────────────────────────────────────────────
// Batch Session Evaluation
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a list of sessions for a single day.
 * Calculates duration, late minutes, and status for each session,
 * maintaining running totals for accurate overtime detection.
 * 
 * @param {Object} rules - Shift rules
 * @param {Array<{time_in: string, time_out: string}>} sessions - Sorted sessions
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Array<Object>} Sessions enriched with duration_hours, late_minutes, status
 */
export function evaluateSessionList(rules, sessions, dateStr) {
    let runningTotalHours = 0;

    return sessions.map((s, idx) => {
        const tIn = typeof s.time_in === 'string' && s.time_in.length === 5 ? s.time_in + ':00' : s.time_in;
        const tOut = typeof s.time_out === 'string' && s.time_out.length === 5 ? s.time_out + ':00' : s.time_out;

        // For overnight sessions (e.g. 22:30 → 06:30), time_out is on the NEXT calendar day.
        // Detect this by comparing the raw time strings; if end ≤ start, add 1 day to the end date.
        const nextDateStr = (() => {
            const d = new Date(`${dateStr}T12:00:00`);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        })();
        const isOvernight = tOut <= tIn;
        const outDateStr = isOvernight ? nextDateStr : dateStr;

        const durationHours = calculateDurationHours(`${dateStr} ${tIn}`, `${outDateStr} ${tOut}`);
        runningTotalHours += durationHours;

        // Late Calculation (only for the first session of the day)
        let lateMins = 0;
        if (idx === 0) {
            const lateCheck = calculateLateArrival(`${dateStr}T${tIn}`, rules);
            lateMins = lateCheck.isLate ? lateCheck.minutesLate : 0;
        }

        // Determine Session Status
        const status = evaluateStatus(rules, {
            total_hours: durationHours,
            total_hours_today: runningTotalHours,
            minutes_late: lateMins,
            event_type: "time_out"
        });

        return {
            ...s,
            time_in: `${dateStr} ${tIn}`,
            time_out: `${outDateStr} ${tOut}`,
            duration_hours: durationHours,
            total_hours_today: runningTotalHours,
            late_minutes: lateMins,
            status
        };
    });
}


// ─────────────────────────────────────────────────────────────
// Daily Status Derivation
// ─────────────────────────────────────────────────────────────

const STATUS_PRIORITY = { "MISSED_PUNCH": 5, "OVERTIME": 4, "LATE": 3, "ABSENT": 2, "PRESENT": 1 };

/**
 * Derive the daily status from a list of attendance records.
 * Returns the highest-priority status found across all sessions.
 * 
 * @param {Array<{status: string}>} records - Session records for the day
 * @returns {string} The derived daily status
 */
export function deriveDailyStatus(records) {
    let highestPriority = 0;
    let calculatedStatus = "PRESENT";

    records.forEach(r => {
        const p = STATUS_PRIORITY[r.status] || 0;
        if (p > highestPriority) {
            highestPriority = p;
            calculatedStatus = r.status;
        }
    });

    return calculatedStatus;
}

// ─────────────────────────────────────────────────────────────
// Session Context
// ─────────────────────────────────────────────────────────────

/**
 * Build session context for a user's day.
 * Aggregates all sessions from the DB to provide running totals.
 *
 * @param {number} user_id
 * @param {string|Date} localTime - Current local time
 * @param {string} eventType - "time_in" or "time_out"
 * @returns {Promise<Object>} Session context data
 */
export async function buildSessionContext(user_id, localTime, eventType) {
    const dateOnly = toMySQLDate(localTime);

    const punches = await attendanceDB("attn_punches")
        .where({ user_id })
        .whereNull("deleted_at")
        .whereIn("punch_type", ["in", "out"])
        .whereRaw("DATE(punch_time) = ?", [dateOnly])
        .orderBy("punch_time", "asc")
        .orderBy("id", "asc")
        .catch(() => []);

    const sessions = [];
    let i = 0;
    while (i < punches.length) {
        const inP = punches[i];
        if (inP.punch_type === 'in') {
            const outP = (i + 1 < punches.length && punches[i + 1].punch_type === 'out') ? punches[i + 1] : null;
            if (outP) i += 2; else i += 1;
            sessions.push({ in_punch: inP, out_punch: outP });
        } else {
            i += 1;
        }
    }

    const isFirstSession = sessions.length === 0;
    const sessionNumber = sessions.length + (eventType === 'time_in' ? 1 : 0);

    // Calculate total hours worked today using centralized helper
    let totalHoursToday = 0;
    sessions.forEach(session => {
        if (session.out_punch) {
            totalHoursToday += calculateDurationHours(session.in_punch.punch_time, session.out_punch.punch_time);
        }
    });

    const firstTimeIn = sessions[0]?.in_punch?.punch_time || null;
    const lastTimeOut = sessions[sessions.length - 1]?.out_punch?.punch_time || null;

    return {
        is_first_session: isFirstSession,
        session_number: sessionNumber,
        total_sessions: todaySessions.length,

        // Time data
        first_time_in: firstTimeIn,
        last_time_out: lastTimeOut,

        // Aggregates
        total_hours_today: parseFloat(totalHoursToday.toFixed(2)),
        first_session_late_mins: todaySessions[0]?.late_minutes || 0,

        // Event context
        event_type: eventType
    };
}



// ─────────────────────────────────────────────────────────────
// Dynamic Daily Summary
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a date value to YYYY-MM-DD string.
 */
function normalizeDate(d) {
    if (!d) return null;
    if (typeof d === 'string') return d.split('T')[0].split(' ')[0];
    if (d instanceof Date || (typeof d === 'object' && typeof d.getUTCFullYear === 'function')) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return null;
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
}

/**
 * Evaluate the attendance status for a single user on a single date.
 * Uses cron-processed daily_attendance when available, otherwise derives dynamically.
 */
function evaluateDayStatus({ dateStr, todayStr, dayRecords, dailyRecord, holiday, leave, rules, timezone = 'UTC', orgAttendanceSettings = null }) {
    let status = null;
    let totalHours = 0;
    let firstIn = null;
    let lastOut = null;
    let lateMinutes = 0;
    let lateReason = '';
    let overtimeHours = 0;

    const graceMins = Number(rules?.grace_period?.minutes || 0);

    if (dailyRecord && dateStr < todayStr) {
        // ── Past date already processed by cron ──
        status = dailyRecord.status;
        // If past date was recorded as ABSENT (or empty), but employee has an approved leave, respect the leave
        if ((status === 'ABSENT' || !status) && leave) {
            status = 'ON_LEAVE';
        } else if ((status === 'ABSENT' || !status) && holiday) {
            status = 'HOLIDAY';
        }
        totalHours = Number(dailyRecord.total_hours) || 0;
        firstIn = dailyRecord.first_in || null;
        lastOut = dailyRecord.last_out || null;
        // Live-gated on the shift's CURRENT overtime.enabled — a stored figure from when OT was
        // enabled must not keep showing (here or in the OVERTIME status label below) once OT is
        // disabled, without needing to touch the stored value itself.
        overtimeHours = formatOvertimeForDisplay(dailyRecord.overtime_hours, rules);

        lateMinutes = Number(dailyRecord.late_minutes || 0);
        if (!lateMinutes && dayRecords.length > 0) {
            lateMinutes = Number(dayRecords[0].late_minutes || 0);
        }
        if (!lateMinutes && firstIn && rules) {
            const lateCheck = calculateLateArrival(firstIn, rules);
            if (lateCheck.isLate) {
                lateMinutes = lateCheck.minutesLate;
            }
        }
        lateReason = (dayRecords.length > 0 ? dayRecords[0].late_reason : '') || dailyRecord.late_reason || '';

        // If stored as PRESENT, check if overtime or late according to shift rules
        if (status === 'PRESENT' || status === 'present') {
            if (overtimeHours > 0) {
                status = 'OVERTIME';
            } else if (isLateBeyondGrace(lateMinutes, graceMins)) {
                status = 'LATE';
            }
        }
    } else if (dayRecords.length > 0) {
        // ── Has punch records - derive status dynamically ──
        const hasOpenSession = dayRecords.some(r => !r.time_out && r.status !== 'MISSED_PUNCH' && r.status !== 'ABSENT');
        const hasMissedPunch = dayRecords.some(r => r.status === 'MISSED_PUNCH');

        const localNow = getLocalNow(timezone);

        // A half-day (Special Weekend & Alternate Rules) is judged against its own
        // window/duration, not the full shift's — otherwise a completed half-day gets evaluated
        // as if it fell short of a full day.
        const dayType = getDayType(dateStr, rules.week_off_policy);
        const effectiveRules = dayType === 'half_day' ? getEffectiveRulesForDate(dateStr, rules) : rules;

        for (const r of dayRecords) {
            if (r.time_in && r.time_out) {
                totalHours += calculateDurationHours(r.time_in, r.time_out);
            } else if (r.time_in && !r.time_out && r.status !== 'MISSED_PUNCH' && r.status !== 'ABSENT') {
                // Active session - count running hours using local time
                totalHours += calculateDurationHours(r.time_in, localNow);
            }
        }
        totalHours = parseFloat(totalHours.toFixed(2));

        firstIn = dayRecords[0].time_in;
        lastOut = dayRecords[dayRecords.length - 1].time_out;

        // Calculate dynamic late arrival from firstIn and shift rules
        let dynamicLateMinutes = 0;
        if (firstIn && effectiveRules) {
            const lateCheck = calculateLateArrival(firstIn, effectiveRules);
            if (lateCheck.isLate) {
                dynamicLateMinutes = lateCheck.minutesLate;
            }
        }

        lateMinutes = Number(dailyRecord?.late_minutes || 0) || dynamicLateMinutes || Number(dayRecords[0].late_minutes || 0);
        lateReason = dayRecords[0].late_reason || dailyRecord?.late_reason || '';

        const calculatedOT = calculateOvertime(totalHours, effectiveRules);
        overtimeHours = Math.max(calculatedOT, Number(dailyRecord?.overtime_hours || 0));

        if (hasOpenSession) {
            status = isLateBeyondGrace(lateMinutes, graceMins) ? 'Late Active' : 'Active';
        } else if (hasMissedPunch) {
            status = 'MISSED_PUNCH';
        } else if (dayType === 'half_day') {
            // Too little time worked (relative to the half-day's own expected hours, not a full
            // day's) reads ABSENT — same "showed up too briefly to count" idea as a full day,
            // just proportioned. Otherwise a completed half-day reads HALF_DAY, not a bare
            // PRESENT indistinguishable from a full day.
            const halfDayExpectedHours = getExpectedHours(dateStr, rules.week_off_policy, rules);
            if (totalHours < (halfDayExpectedHours * 0.5)) {
                status = 'ABSENT';
            } else if (overtimeHours > 0) {
                status = 'OVERTIME';
            } else if (isLateBeyondGrace(lateMinutes, graceMins)) {
                status = 'LATE';
            } else {
                status = 'HALF_DAY';
            }
        } else {
            const derived = deriveDailyStatus(dayRecords);
            if (derived === 'PRESENT' && isLateBeyondGrace(lateMinutes, graceMins)) {
                status = 'LATE';
            } else {
                status = derived;
            }
            if (overtimeHours > 0 && (status === 'PRESENT' || status === 'LATE')) {
                status = 'OVERTIME';
            }

            // Org-wide threshold half-day policy — only ever applies on a date the shift itself
            // classifies as a normal WORKING day, never stacking with the shift's own
            // half-day/week-off rule handled above. Only downgrades an otherwise unremarkable
            // PRESENT/LATE day — never "upgrades" a genuine ABSENT, and never overrides a day
            // that already earned OVERTIME.
            if ((status === 'PRESENT' || status === 'LATE') && dayType === 'working' && orgAttendanceSettings?.half_day_threshold_enabled) {
                const firstInMinutes = firstIn ? timeToMinutes(toMySQLTime(firstIn)) : null;
                const lastOutMinutes = lastOut ? timeToMinutes(toMySQLTime(lastOut)) : null;

                const lateThresholdMinutes = orgAttendanceSettings.half_day_late_after_time ? timeToMinutes(orgAttendanceSettings.half_day_late_after_time) : null;
                const earlyThresholdMinutes = orgAttendanceSettings.half_day_early_before_time ? timeToMinutes(orgAttendanceSettings.half_day_early_before_time) : null;

                const arrivedLate = lateThresholdMinutes !== null && firstInMinutes !== null && firstInMinutes > lateThresholdMinutes;
                const leftEarly = earlyThresholdMinutes !== null && lastOutMinutes !== null && lastOutMinutes < earlyThresholdMinutes;

                if (arrivedLate || leftEarly) {
                    status = 'HALF_DAY';
                }
            }
        }
    } else {
        // ── No punch records - determine from shift policies ──
        const dayType = getDayType(dateStr, rules.week_off_policy);
        const dayIdx = new Date(dateStr + 'T12:00:00').getDay();
        const dayName = DAY_NAMES[dayIdx];
        const isWorkingSunday = Array.isArray(rules?.working_days || rules?.workingDays)
            && (rules.working_days || rules.workingDays).includes('Sun');

        if (holiday) {
            // National / org holidays take precedence over week-off
            status = 'HOLIDAY';
        } else if (dayName === 'Sun' && !isWorkingSunday) {
            // Sunday is statutory / standard weekly Holiday unless shift explicitly mandates working on Sundays
            status = 'HOLIDAY';
        } else if (dayType === 'week_off') {
            // Week Off is used when a shift policy designates days off (e.g. Saturday or scheduled weekday off)
            status = 'WEEK_OFF';
        } else if (leave) {
            status = 'ON_LEAVE';
        } else if (dateStr > todayStr) {
            // Future working day - no status yet
            status = null;
        } else {
            status = 'ABSENT';
        }
    }

    const expectedHours = getExpectedHours(dateStr, rules.week_off_policy, rules);

    // Serialize Date objects to plain "YYYY-MM-DD HH:mm:ss" strings so the
    // frontend receives the stored local time without UTC re-interpretation.
    const toPlainStr = (v) => {
        if (!v) return null;
        if (v instanceof Date) {
            return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
        }
        return String(v).split('.')[0];
    };

    // Whether an employee (not admin/HR — that bypass lives in the request-submission endpoint
    // itself) could still submit a correction request for this date, per the shift's configured
    // correction_deadline. Exposed so the frontend has a real signal instead of re-deriving this
    // day-diff itself.
    const correctionDeadlineDays = rules?.correction_deadline ?? 2;
    const daysSinceDate = Math.ceil((new Date(todayStr) - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    const isCorrectable = daysSinceDate <= correctionDeadlineDays;

    return {
        status,
        total_hours: totalHours,
        first_in: toPlainStr(firstIn),
        last_out: toPlainStr(lastOut),
        late_minutes: lateMinutes,
        late_reason: lateReason,
        overtime_hours: overtimeHours,
        overtime_minutes: Math.round(overtimeHours * 60),
        expected_hours: expectedHours,
        is_correctable: isCorrectable
    };
}

// ─────────────────────────────────────────────────────────────
// No-Show Status Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the attendance status for a day where the employee did not punch in at all.
 * Checks week-off policy, national/org holidays, and approved leaves in priority order.
 *
 * This is the single source of truth for no-show logic, shared by both the
 * nightly cron (AttendanceProcessor) and the dynamic daily summary view.
 *
 * Priority (highest → lowest):
 *   1. National/org holiday   → HOLIDAY
 *   2. Week-off policy        → WEEK_OFF (or HOLIDAY for Sunday)
 *   3. Approved leave         → LEAVE
 *   4. Half-day week-off      → ABSENT (employee was expected but didn't show)
 *   5. Regular working day    → ABSENT
 *
 * @param {Object} params
 * @param {string}      params.dateStr  - YYYY-MM-DD string of the day to evaluate
 * @param {Object}      params.rules    - Shift rules from ShiftService.getShiftRules()
 * @param {Object|null} params.holiday  - Holiday record from DB (or null)
 * @param {Object|null} params.leave    - Approved leave record covering this date (or null)
 * @returns {{ status: string, remarks: string }}
 */
export function resolveNoShowStatus({ dateStr, rules, holiday, leave }) {
    let status = 'ABSENT';
    let remarks = 'No show';

    const dayType = getDayType(dateStr, rules?.week_off_policy);
    const dayIdx = new Date(dateStr + 'T12:00:00').getDay();
    const dayName = DAY_NAMES[dayIdx];
    const isWorkingSunday = Array.isArray(rules?.working_days || rules?.workingDays)
        && (rules.working_days || rules.workingDays).includes('Sun');

    // 1. Holiday takes highest priority (overrides even week-off)
    if (holiday) {
        return { status: 'HOLIDAY', remarks: holiday.holiday_name || 'Organization Holiday' };
    }

    // 2. Sunday is classified under Holiday (not Week Off)
    if (dayName === 'Sun' && !isWorkingSunday) {
        return { status: 'HOLIDAY', remarks: 'Sunday - Holiday' };
    }

    // 3. Shift Week-off policy (for Saturday or scheduled weekdays off)
    if (dayType === 'week_off') {
        return { status: 'WEEK_OFF', remarks: `${dayName} - Weekly Off` };
    }

    // 4. Half-day week-off - employee was still expected; treat as absent
    if (dayType === 'half_day') {
        status = 'ABSENT';
        remarks = `${dayName} - Half Day (No show)`;
    }

    // 5. Approved leave (only overrides ABSENT, not WEEK_OFF / HOLIDAY)
    if (status === 'ABSENT' && leave) {
        return { status: 'LEAVE', remarks: `${leave.leave_type} (${leave.pay_type})` };
    }

    return { status, remarks };
}

/**
 * Compute daily attendance summaries for one or all users across a date range.
 * Dynamically evaluates status using shift week-off policies, organization
 * holidays, approved leaves, and real-time punch data for dates not yet
 * processed by the hourly cron.
 *
 * @param {Object} params
 * @param {number} params.org_id
 * @param {number} [params.user_id] - Single user (user endpoint) or null (admin, all users)
 * @param {string} params.date_from - YYYY-MM-DD
 * @param {string} params.date_to   - YYYY-MM-DD
 * @returns {Promise<Array<{user_id,user_name,desg_name,dept_name,profile_image_url,shift_id,days:Array}>>}
 */
export async function getDailySummary({ org_id, user_id = null, date_from, date_to }) {
    // 1. Fetch users with shift + designation info
    let usersQuery = attendanceDB('core_users')
        .leftJoin('org_shifts', 'core_users.shift_id', 'org_shifts.shift_id')
        .leftJoin('org_designations', 'core_users.desg_id', 'org_designations.desg_id')
        .where('core_users.org_id', org_id)
        .where(function () { this.where('core_users.is_active', 1).orWhereNull('core_users.is_active'); })
        .where(function () { this.where('core_users.is_deleted', 0).orWhereNull('core_users.is_deleted'); })
        .select(
            'core_users.user_id', 'core_users.user_name', 'core_users.org_id', 'core_users.shift_id',
            'core_users.profile_image_url',
            'core_users.user_type',
            'org_designations.desg_name',
            'org_shifts.shift_name',
            'org_shifts.policy_rules'
        );

    if (user_id) usersQuery = usersQuery.where('core_users.user_id', user_id);
    const users = await usersQuery;

    const openShift = await getOpenShiftFallback(org_id);

    for (const u of users) {
        if (!u.shift_id) {
            u.shift_name = openShift?.shift_name || "Open Shift";
            u.policy_rules = u.policy_rules || openShift?.policy_rules || null;
        }
    }

    // Try to resolve department names (graceful if table missing)
    let deptMap = {};
    try {
        const deptRows = await attendanceDB('core_users')
            .leftJoin('org_departments', 'core_users.dept_id', 'org_departments.dept_id')
            .whereIn('core_users.user_id', users.map(u => u.user_id))
            .select('core_users.user_id', 'org_departments.dept_name');
        for (const r of deptRows) if (r.dept_name) deptMap[r.user_id] = r.dept_name;
    } catch (_) { /* departments table may not exist */ }

    if (users.length === 0) return [];

    // 2. Fetch all supporting data in parallel
    const userIds = users.map(u => u.user_id);
    const [punchRows, dailyRecords, holidays, leaves] = await Promise.all([
        attendanceDB('attn_punches')
            .whereIn('user_id', userIds)
            .whereNull('deleted_at')
            .whereIn('punch_type', ['in', 'out'])
            .whereRaw('DATE(punch_time) >= ?', [date_from])
            .whereRaw('DATE(punch_time) <= DATE_ADD(?, INTERVAL 1 DAY)', [date_to])
            .modify(qb => { if (user_id) qb.where('user_id', user_id); })
            .orderBy('punch_time', 'asc')
            .orderBy('id', 'asc')
            .catch(() => []),
        attendanceDB('attn_daily_summary_v2')
            .whereIn('user_id', userIds)
            .where('date', '>=', date_from)
            .where('date', '<=', date_to)
            .modify(qb => { if (user_id) qb.where('user_id', user_id); })
            .catch(() => []),
        attendanceDB('org_holidays')
            .where('org_id', org_id)
            .where('holiday_date', '>=', date_from)
            .where('holiday_date', '<=', date_to),
        attendanceDB('leave_request as lr')
            .leftJoin('leave_policies_rules as lpr', 'lr.rule_id', 'lpr.rule_id')
            .select('lr.*', 'lpr.name as leave_type')
            .whereRaw('LOWER(lr.status) = ?', ['approved'])
            .where('lr.start_date', '<=', date_to)
            .where('lr.end_date', '>=', date_from)
            .modify(qb => {
                if (user_id) qb.where('lr.user_id', user_id);
                else qb.whereIn('lr.user_id', users.map(u => u.user_id));
            })
    ]);

    // 3. Index data for O(1) lookups
    const recordsByUserDate = {};

    // Build sessions from attn_punches and override if punches exist
    if (punchRows && punchRows.length > 0) {
        const punchesByUser = {};
        for (const p of punchRows) {
            if (!punchesByUser[p.user_id]) punchesByUser[p.user_id] = [];
            punchesByUser[p.user_id].push(p);
        }

        const userMap = {};
        for (const u of users) userMap[u.user_id] = u;
        const firstPunchSeenByDay = {};

        for (const uid of Object.keys(punchesByUser)) {
            const uPunches = punchesByUser[uid];
            const userObj = userMap[uid];
            const userRules = userObj ? getShiftRules(userObj) : null;
            let i = 0;
            while (i < uPunches.length) {
                const inP = uPunches[i];
                if (inP.punch_type === 'in') {
                    const ds = normalizeDate(inP.punch_time);
                    let outP = null;
                    if (i + 1 < uPunches.length && uPunches[i + 1].punch_type === 'out') {
                        outP = uPunches[i + 1];
                        i += 2;
                    } else {
                        i += 1;
                    }

                    const inLoc = safeParseJSON(inP.location);
                    const inMeta = safeParseJSON(inP.metadata);
                    const outLoc = outP ? safeParseJSON(outP.location) : {};
                    const outMeta = outP ? safeParseJSON(outP.metadata) : {};

                    const punchDate = new Date(inP.punch_time);
                    const today = new Date();
                    const isPastDay = punchDate.toDateString() !== today.toDateString() && punchDate < today;

                    let sessionStatus = "PRESENT";
                    if (inP.status === "closed" || outP) {
                        sessionStatus = "CLOSED";
                    } else if (inP.status === "missed_punch" || isPastDay) {
                        sessionStatus = "MISSED_PUNCH";
                    }

                    const toPlainIso = (v) => {
                        if (!v) return null;
                        if (typeof v === 'string') return v.includes('T') ? v.split('.')[0] : v.replace(' ', 'T').split('.')[0];
                        if (v instanceof Date) {
                            const pad = (n) => String(n).padStart(2, '0');
                            return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}T${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
                        }
                        return String(v);
                    };

                    const timeInLocal = toPlainIso(inP.punch_time);
                    const timeOutLocal = outP?.punch_time ? toPlainIso(outP.punch_time) : null;

                    const userDayKey = `${uid}_${ds}`;
                    // This session's own shift (Phase 3: may be pattern-matched or off-pattern,
                    // not necessarily the user's assigned shift) — falls back to the user's
                    // assigned rules for punches with no resolution metadata (pre-Phase-3).
                    let sessionRules = userRules;
                    if (inMeta.match_type === 'off_pattern_fallback') {
                        sessionRules = getOffPatternFallbackRules();
                    } else if (inMeta.resolved_shift_id && userObj) {
                        const matchedShift = await getShiftById(userObj.org_id, inMeta.resolved_shift_id);
                        if (matchedShift) sessionRules = getShiftRules(matchedShift);
                    }

                    // `late_minutes` can legitimately be 0 (on-time) — check whether a value was
                    // actually stored, not just whether it's truthy, so a correctly-matched
                    // on-time session doesn't get silently re-evaluated against the wrong rules.
                    const hasStoredLateMinutes = inMeta.late_minutes !== undefined && inMeta.late_minutes !== null;
                    let lateMins = hasStoredLateMinutes ? Number(inMeta.late_minutes) : 0;
                    let lateReason = inMeta.late_reason || null;
                    if (!hasStoredLateMinutes && !firstPunchSeenByDay[userDayKey] && sessionRules) {
                        const lateCheck = calculateLateArrival(inP.punch_time, sessionRules);
                        if (lateCheck.isLate) {
                            lateMins = lateCheck.minutesLate;
                        }
                    }
                    firstPunchSeenByDay[userDayKey] = true;

                    const session = {
                        attendance_id: inP.id,
                        user_id: inP.user_id,
                        time_in: timeInLocal,
                        time_out: timeOutLocal,
                        time_in_lat: inLoc.lat || null,
                        time_in_lng: inLoc.lng || null,
                        time_in_address: (inLoc.address && inLoc.address !== 'Locating...' && inLoc.address !== 'Pending...') ? inLoc.address : null,
                        time_out_lat: outLoc.lat || null,
                        time_out_lng: outLoc.lng || null,
                        time_out_address: (outLoc.address && outLoc.address !== 'Locating...' && outLoc.address !== 'Pending...') ? outLoc.address : null,
                        time_in_image_key: inMeta.image_key || null,
                        time_out_image_key: outMeta.image_key || null,
                        late_minutes: lateMins,
                        late_reason: lateReason,
                        status: sessionStatus,
                        resolved_shift_id: inMeta.resolved_shift_id || null,
                        match_type: inMeta.match_type || null,
                        metadata: JSON.stringify({
                            time_in: { timezone: inMeta.timezone || 'Asia/Kolkata' },
                            time_out: { timezone: outMeta?.timezone || 'Asia/Kolkata' }
                        }),
                        created_at: inP.created_at,
                        updated_at: outP ? outP.created_at : inP.created_at
                    };

                    const k = `${uid}_${ds}`;
                    if (!recordsByUserDate[k]) {
                        recordsByUserDate[k] = [];
                    }
                    recordsByUserDate[k].push(session);
                } else {
                    i += 1;
                }
            }
        }
    }

    const dailyByUserDate = {};
    for (const d of dailyRecords) dailyByUserDate[`${d.user_id}_${normalizeDate(d.date)}`] = d;

    const holidayByDate = {};
    for (const h of holidays) holidayByDate[normalizeDate(h.holiday_date)] = h;

    const leavesByUser = {};
    for (const l of leaves) {
        if (!leavesByUser[l.user_id]) leavesByUser[l.user_id] = [];
        leavesByUser[l.user_id].push(l);
    }

    // 4. Generate date array
    const dates = [];
    const cur = new Date(date_from + 'T12:00:00');
    const endDate = new Date(date_to + 'T12:00:00');
    while (cur <= endDate) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

    // Fetch organization timezone for timezone-aware todayStr calculation
    let timezone = 'UTC';
    try {
        const org = await attendanceDB('core_organizations')
            .where('org_id', org_id)
            .select('timezone')
            .first();
        if (org && org.timezone) {
            timezone = org.timezone;
        }
    } catch (err) {
        console.warn(`Failed to fetch organization ${org_id} timezone, defaulting to UTC`, err);
    }

    // timezone was already resolved just above for this same org — reuse it instead of a second lookup.
    const todayStr = formatDateInTimezone(new Date(), timezone);

    // Fetched once for the whole batch (same org for every user/date in this call) rather than
    // per-user/per-date, to avoid N+1 queries.
    const orgAttendanceSettings = await getOrgAttendanceSettings(org_id);

    // 5. Evaluate each user × date. Per-day (not per-user-once) rules resolution: a day whose
    // first session was pattern-matched or off-pattern (Phase 3) must be evaluated against that
    // session's own resolved shift, not the user's assigned shift — otherwise the live view
    // (this function) can disagree with what actually gets stored once the day syncs.
    return Promise.all(users.map(async user => {
        const assignedRules = getShiftRules(user);
        const days = await Promise.all(dates.map(async dateStr => {
            const key = `${user.user_id}_${dateStr}`;
            const dayRecords = recordsByUserDate[key] || [];
            const dailyRecord = dailyByUserDate[key];
            const holiday = holidayByDate[dateStr];
            const userLeaves = leavesByUser[user.user_id] || [];
            const leave = userLeaves.find(l => {
                const s = normalizeDate(l.start_date);
                const e = normalizeDate(l.end_date);
                return dateStr >= s && dateStr <= e;
            });

            let rules = assignedRules;
            const firstRecord = dayRecords[0];
            if (firstRecord?.match_type === 'off_pattern_fallback') {
                rules = getOffPatternFallbackRules();
            } else if (firstRecord?.match_type === 'pattern_matched' && firstRecord?.resolved_shift_id) {
                const matchedShift = await getShiftById(user.org_id, firstRecord.resolved_shift_id);
                if (matchedShift) rules = getShiftRules(matchedShift);
            }

            const result = evaluateDayStatus({ dateStr, todayStr, dayRecords, dailyRecord, holiday, leave, rules, timezone, orgAttendanceSettings });
            // Serialize time fields to plain strings (prevent UTC shift from JS Date serialization)
            const serializedSessions = dayRecords.map(r => ({
                ...r,
                time_in: r.time_in
                    ? (r.time_in instanceof Date
                        ? r.time_in.toISOString().replace('T', ' ').split('.')[0]
                        : String(r.time_in).split('.')[0])
                    : null,
                time_out: r.time_out
                    ? (r.time_out instanceof Date
                        ? r.time_out.toISOString().replace('T', ' ').split('.')[0]
                        : String(r.time_out).split('.')[0])
                    : null,
            }));
            return { date: dateStr, ...result, sessions: serializedSessions };
        }));

        return {
            user_id: user.user_id,
            user_name: user.user_name,
            desg_name: user.desg_name || null,
            dept_name: deptMap[user.user_id] || null,
            profile_image_url: user.profile_image_url || null,
            shift_id: user.shift_id,
            days
        };
    }));
}
