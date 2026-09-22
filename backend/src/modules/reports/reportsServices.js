import { attendanceDB } from '../../config/database.js';
import * as S3Service from '../../services/s3/s3Service.js';
import { getShiftRules, getDayType, getExpectedHours, getOpenShiftFallback } from '../shifts/shiftService.js';
import { calculateLateArrival, calculateOvertime } from '../../services/statusEvalution/statusEvaluationService.js';
import { getOrgTodayStr } from '../../utils/timezoneUtils.js';

export { getShiftRules, getDayType, getExpectedHours, calculateOvertime };

const isValidDeptId = (deptId) => {
    return deptId && deptId !== 'All' && deptId !== 'undefined' && deptId !== 'null' && String(deptId).trim() !== '';
};

const isValidDesgId = (desgId) => {
    return desgId && desgId !== 'All' && desgId !== 'undefined' && desgId !== 'null' && String(desgId).trim() !== '';
};

const isValidShiftId = (shiftId) => {
    return shiftId && shiftId !== 'All' && shiftId !== 'undefined' && shiftId !== 'null' && String(shiftId).trim() !== '';
};


export async function getTodayStr(org_id) {
    return getOrgTodayStr(org_id, attendanceDB);
}


// Helper: Calculate Work Hours
export const calculateWorkHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return "0.00";
    const start = new Date(timeIn);
    const end = new Date(timeOut);
    const diffMs = end - start;
    if (diffMs < 0) return "0.00";
    return (diffMs / (1000 * 60 * 60)).toFixed(2);
};

// Timezone-independent formatting helpers
export const formatLocalTimeStr = (dateVal, includeSeconds = false) => {
    if (!dateVal) return "-";
    let date;
    if (dateVal instanceof Date) {
        date = dateVal;
    } else {
        const str = String(dateVal).trim();
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
            date = new Date(str.replace(' ', 'T') + 'Z');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            date = new Date(str + 'T00:00:00Z');
        } else {
            date = new Date(str);
        }
    }
    if (isNaN(date.getTime())) return "-";

    let hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');

    if (includeSeconds) {
        return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }
    return `${hoursStr}:${minutes} ${ampm}`;
};

export const formatLocalDateStr = (dateVal) => {
    if (!dateVal) return "-";
    let date;
    if (dateVal instanceof Date) {
        date = dateVal;
    } else {
        const str = String(dateVal).trim();
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
            date = new Date(str.replace(' ', 'T') + 'Z');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            date = new Date(str + 'T00:00:00Z');
        } else {
            date = new Date(str);
        }
    }
    if (isNaN(date.getTime())) return "-";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
};

// Safe record date string extractor (guaranteed YYYY-MM-DD, zero UTC drift)
export const getRecordDateStr = (r) => {
    if (!r) return "";
    if (r.record_date) return String(r.record_date).trim();
    const val = r.time_in;
    if (!val) return "";
    if (typeof val === 'string') {
        const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return "";
};

// Generate calendar dates array ['YYYY-MM-DD', ...] timezone-independently
export const getDateRangeArray = (startDate, endDate) => {
    const dates = [];
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    let cur = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
};

export const aggregateDayRecords = (dayRecs, userPolicyRules, customTodayStr) => {
    if (!dayRecs || dayRecs.length === 0) {
        return {
            time_in: null,
            time_out: null,
            worked_hours: 0,
            late_minutes: 0,
            overtime_hours: 0,
            status: "Absent",
            time_in_address: "-",
            time_out_address: "-"
        };
    }

    const sorted = [...dayRecs].sort((a, b) => new Date(a.time_in) - new Date(b.time_in));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const todayStr = customTodayStr || new Date().toISOString().slice(0, 10);
    const recDate = getRecordDateStr(first);
    const isPastDate = recDate && todayStr ? recDate < todayStr : false;

    const worked_hours = sorted.reduce((sum, r) => sum + parseFloat(calculateWorkHours(r.time_in, r.time_out)), 0);

    // Retain original recorded values to ensure historical status/overtime/late are never lost
    const originalOvertime = sorted.reduce((sum, r) => Math.max(sum, parseFloat(r.overtime_hours || 0)), 0);
    const originalHasOvertimeStatus = sorted.some(r => String(r.status || '').toUpperCase() === 'OVERTIME');
    const originalLateMinutes = sorted.reduce((sum, r) => Math.max(sum, Number(r.late_minutes || 0)), 0);
    const originalHasLateStatus = sorted.some(r => String(r.status || '').toUpperCase().includes('LATE'));

    let effectiveLateMinutes = originalLateMinutes;
    let overtime_hours = originalOvertime;

    let status = "Present";
    const hasLeave = sorted.some(r => r.status === 'ON_LEAVE' || r.status === 'On Leave');
    const hasHalfDay = sorted.some(r => r.status === 'HALF_DAY' || r.status === 'Half Day');
    // Only flag missed punch if it is a past day with missing checkout or explicit MISSED_PUNCH
    const hasMissedPunch = isPastDate && sorted.some(r => r.status === 'MISSED_PUNCH' || r.status === 'missed_punch' || r.status === 'Missed Punch' || (r.time_in && !r.time_out));
    const hasAbsent = sorted.every(r => r.status === 'ABSENT' || r.status === 'Absent');

    if (hasLeave) status = "On Leave";
    else if (hasHalfDay) status = "Half Day";
    else if (hasMissedPunch) status = "Missed Punch";
    else if (hasAbsent) status = "Absent";
    else {
        let graceMins = 0;
        let rules = null;
        // Whether the shift's OT setting is CURRENTLY enabled — gates OT display live, below,
        // regardless of what was stored historically or computed via allowHistorical.
        let otCurrentlyEnabled = true;
        if (userPolicyRules) {
            rules = safeParseRules(userPolicyRules);
            graceMins = Number(rules?.grace_period?.minutes || 0);
            otCurrentlyEnabled = rules?.overtime?.enabled !== false;
            const calculatedOT = calculateOvertime(worked_hours, rules, isPastDate);
            overtime_hours = otCurrentlyEnabled ? Math.max(originalOvertime, calculatedOT) : 0;

            // If late_minutes was 0 in original record, dynamically evaluate against shift start time & grace
            if (first.time_in && rules?.shift_timing?.start_time) {
                const lateCheck = calculateLateArrival(first.time_in, rules);
                if (lateCheck.isLate) {
                    effectiveLateMinutes = Math.max(effectiveLateMinutes, lateCheck.minutesLate);
                }
            }
        }

        // If employee originally had LATE status, ensure effectiveLateMinutes > 0
        if (originalHasLateStatus && effectiveLateMinutes === 0) {
            effectiveLateMinutes = graceMins > 0 ? graceMins + 1 : 1;
        }

        // If punch was within the allowed grace period and not explicitly marked late in DB, employee is not late
        if (!originalHasLateStatus && effectiveLateMinutes <= graceMins) {
            effectiveLateMinutes = 0;
        }

        // Gate the "Overtime" status label the same way as the number itself — a shift with OT
        // currently disabled must never show a leftover Overtime label, even if the original
        // stored record (from when OT was enabled) said otherwise.
        if (overtime_hours > 0 || (originalHasOvertimeStatus && otCurrentlyEnabled)) {
            status = "Overtime";
        } else if (effectiveLateMinutes > 0 || originalHasLateStatus) {
            status = "Late";
        }
    }

    return {
        time_in: first.time_in,
        time_out: last.time_out,
        worked_hours,
        late_minutes: effectiveLateMinutes,
        overtime_hours,
        late_reason: effectiveLateMinutes > 0 ? (first.late_reason || null) : null,
        status,
        time_in_address: first.time_in_address || "-",
        time_out_address: last.time_out_address || "-"
    };
};

// Helper: Safe JSON parse policy rules
export const safeParseRules = (policyRules) => {
    if (!policyRules) return {};
    if (typeof policyRules === 'object') return policyRules;
    try {
        return JSON.parse(policyRules);
    } catch (e) {
        return {};
    }
};

// Helper: Derive Status dynamically
export const deriveStatus = (r, customTodayStr) => {
    const todayStr = customTodayStr || new Date().toISOString().slice(0, 10);
    const recDate = getRecordDateStr(r);
    const isPastDate = recDate && todayStr ? recDate < todayStr : false;

    if (r.status === 'ON_LEAVE' || r.status === 'On Leave') return "On Leave";
    if (r.status === 'HALF_DAY' || r.status === 'Half Day') return "Half Day";
    if (r.status === 'MISSED_PUNCH' || r.status === 'missed_punch' || r.status === 'Missed Punch') {
        if (!isPastDate && r.time_in && !r.time_out) {
            return (Number(r.late_minutes || 0) > 0) ? "Late" : "Present";
        }
        return "Missed Punch";
    }
    if (isPastDate && r.time_in && !r.time_out) return "Missed Punch";
    if (!r.time_in || r.status === 'ABSENT' || r.status === 'Absent') return "Absent";

    if (parseFloat(r.overtime_hours || 0) > 0 || String(r.status || '').toUpperCase() === 'OVERTIME') return "Overtime";
    if (Number(r.late_minutes || 0) > 0 || String(r.status || '').toUpperCase().includes('LATE')) return "Late";

    return "Present";
};

// Helper: Get shift hours for a user
export const getShiftHoursForUser = (user) => {
    try {
        const rules = safeParseRules(user.policy_rules);
        const startTime = rules.shift_timing?.start_time;
        const endTime = rules.shift_timing?.end_time;
        if (startTime && endTime) {
            const [startH, startM] = startTime.split(":").map(Number);
            let [endH, endM] = endTime.split(":").map(Number);
            if (endH < startH || (endH === startH && endM < startM)) {
                endH += 24; // Overnight shift
            }
            const diffMins = (endH * 60 + endM) - (startH * 60 + startM);
            return (diffMins / 60);
        }
    } catch (e) {
        console.error("Error parsing shift timing", e);
    }
    return 8.0; // default to 8 hours
};

// Helper: Get total required hours for a period
// `holidayByDate` is optional (defaults to none) so any caller that hasn't been updated to pass
// it keeps its exact previous behavior — only call sites that explicitly pass it get the fix.
export const getRequiredHoursForPeriod = (user, dateHeaders, holidayByDate = {}) => {
    let total = 0;
    const rules = getShiftRules(user);
    dateHeaders.forEach(d => {
        const dateStr = typeof d === 'string' ? d : (d.toISOString ? d.toISOString().split('T')[0] : String(d));
        if (getHolidayOverride(dateStr, holidayByDate)) return; // declared holiday — nothing required that day
        total += getExpectedHours(dateStr, rules.week_off_policy, rules);
    });
    return total;
};

// Helper: Resolve date range from query params
export const resolveDateRange = ({ type, month, date, startDate: customStart, endDate: customEnd }) => {
    if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
    }

    let startDate, endDate;

    if (type === "employee_master") {
        startDate = "2000-01-01";
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        endDate = `${yyyy}-${mm}-${dd}`;
    } else if (type === "matrix_daily") {
        startDate = date;
        endDate = date;
    } else if (["matrix_weekly", "attendance_matrix_weekly"].includes(type)) {
        startDate = date;
        const [y, m, d] = date.split('-').map(Number);
        const endDt = new Date(y, m - 1, d + 6);
        const ey = endDt.getFullYear();
        const em = String(endDt.getMonth() + 1).padStart(2, '0');
        const ed = String(endDt.getDate()).padStart(2, '0');
        endDate = `${ey}-${em}-${ed}`;
    } else if (["matrix_monthly", "attendance_matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) || month) {
        const [year, monthNum] = month.split("-").map(Number);
        startDate = `${month}-01`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    return { startDate, endDate };
};

export const getUserStartDate = (u) => {
    if (!u) return null;
    const val = u.joining_date || u.created_at;
    if (!val) return null;
    if (typeof val === 'string') return val.slice(0, 10);
    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return null;
};

export async function getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate, include_inactive }) {
    return attendanceDB("core_users as u")
        .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("org_designations as dg", "u.desg_id", "dg.desg_id")
        .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
        .select("u.user_id", "u.user_name", "u.is_active", "u.is_deleted", "u.dept_id", "u.desg_id", "u.shift_id", "d.dept_name", "dg.desg_name", "u.email", "u.phone_no", "u.user_type", "s.policy_rules", "s.shift_name", "u.created_at", "u.joining_date")
        .where("u.org_id", org_id)
        .modify(qb => {
            if (targetUserId) {
                qb.where("u.user_id", targetUserId);
            }
            if (include_inactive) {
                // For employee directory / master: include all employees across all statuses (Active, Inactive, Deleted)
            } else if (startDate && endDate) {
                // User must have joined on/before the period's endDate 
                // OR must have at least 1 attendance punch in that period (even if inactive/deleted/joined later).
                qb.where(function () {
                    this.where(function () {
                        this.where(function () {
                            this.where("u.is_active", 1).orWhere("u.is_active", true);
                        }).andWhere(function () {
                            this.whereNull("u.is_deleted").orWhere("u.is_deleted", 0).orWhere("u.is_deleted", false);
                        }).andWhere(function () {
                            this.whereRaw("COALESCE(DATE(u.joining_date), DATE(u.created_at)) <= ?", [endDate]);
                        });
                    }).orWhereExists(function () {
                        this.select(1)
                            .from("attn_punches as ap")
                            .whereRaw("ap.user_id = u.user_id")
                            .whereNull("ap.deleted_at")
                            .whereRaw("DATE(ap.punch_time) >= ?", [startDate])
                            .whereRaw("DATE(ap.punch_time) <= ?", [endDate]);
                    });
                });
            } else {
                qb.where(function () {
                    this.where("u.is_active", 1).orWhere("u.is_active", true);
                }).andWhere(function () {
                    this.whereNull("u.is_deleted").orWhere("u.is_deleted", 0).orWhere("u.is_deleted", false);
                });
            }

            if (isValidDeptId(dept_id)) {
                qb.where("u.dept_id", dept_id);
            }
            if (isValidDesgId(desg_id)) {
                qb.where("u.desg_id", desg_id);
            }
            if (shift_id === 'open_shift') {
                qb.whereNull("u.shift_id");
            } else if (isValidShiftId(shift_id)) {
                qb.where("u.shift_id", shift_id);
            }
        })
        .orderBy("u.user_name", "asc");

    const users = await usersQuery;
    const openShift = await getOpenShiftFallback(org_id);

    return users.map(u => {
        if (!u.shift_id) {
            return {
                ...u,
                shift_name: openShift?.shift_name || "Open Shift",
                policy_rules: u.policy_rules || openShift?.policy_rules || null
            };
        }
        return u;
    });
}

export async function getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id }) {
    const todayStr = await getTodayStr(org_id);

    const punchRows = await attendanceDB("attn_punches as ap")
        .join("core_users as u", "ap.user_id", "u.user_id")
        .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
        .select(
            "ap.id as attendance_id",
            "ap.user_id",
            "ap.punch_time",
            "ap.punch_type",
            "ap.location",
            "ap.metadata",
            "u.user_name",
            "d.dept_name",
            "s.shift_name",
            "s.policy_rules",
            attendanceDB.raw("DATE_FORMAT(ap.punch_time, '%Y-%m-%d') as record_date")
        )
        .where("u.org_id", org_id)
        .whereNull("ap.deleted_at")
        .whereIn("ap.punch_type", ["in", "out"])
        .modify(qb => {
            if (targetUserId) qb.where("ap.user_id", targetUserId);
            if (isValidDeptId(dept_id)) qb.where("u.dept_id", dept_id);
            if (isValidDesgId(desg_id)) qb.where("u.desg_id", desg_id);
            if (shift_id === 'open_shift') qb.whereNull("u.shift_id");
            else if (isValidShiftId(shift_id)) qb.where("u.shift_id", shift_id);
        })
        .whereRaw("DATE(ap.punch_time) >= ?", [startDate])
        .whereRaw("DATE(ap.punch_time) <= DATE_ADD(?, INTERVAL 1 DAY)", [endDate])
        .orderBy("ap.punch_time", "asc")
        .orderBy("ap.id", "asc")
        .catch(() => []);

    const records = [];
    if (punchRows && punchRows.length > 0) {
        const punchesByUser = {};
        for (const p of punchRows) {
            if (!punchesByUser[p.user_id]) punchesByUser[p.user_id] = [];
            punchesByUser[p.user_id].push(p);
        }

        for (const [key, userPunches] of Object.entries(punchesByUser)) {
            let i = 0;
            while (i < userPunches.length) {
                const inPunch = userPunches[i];
                if (inPunch.punch_type === 'in') {
                    let outPunch = null;
                    if (i + 1 < userPunches.length && userPunches[i + 1].punch_type === 'out') {
                        outPunch = userPunches[i + 1];
                        i += 2;
                    } else {
                        i += 1;
                    }

                    if (inPunch.record_date < startDate || inPunch.record_date > endDate) {
                        continue;
                    }

                    let inLoc = {};
                    let inMeta = {};
                    try { inLoc = typeof inPunch.location === 'string' ? JSON.parse(inPunch.location) : (inPunch.location || {}); } catch (_) { }
                    try { inMeta = typeof inPunch.metadata === 'string' ? JSON.parse(inPunch.metadata) : (inPunch.metadata || {}); } catch (_) { }

                    let outLoc = {};
                    let outMeta = {};
                    if (outPunch) {
                        try { outLoc = typeof outPunch.location === 'string' ? JSON.parse(outPunch.location) : (outPunch.location || {}); } catch (_) { }
                        try { outMeta = typeof outPunch.metadata === 'string' ? JSON.parse(outPunch.metadata) : (outPunch.metadata || {}); } catch (_) { }
                    }

                    const isPastPunch = inPunch.record_date && todayStr && inPunch.record_date < todayStr;
                    const defaultStatus = outPunch ? 'PRESENT' : (isPastPunch ? 'MISSED_PUNCH' : 'PRESENT');

                    const workedHours = outPunch ? parseFloat(((new Date(outPunch.punch_time) - new Date(inPunch.punch_time)) / (1000 * 60 * 60)).toFixed(2)) : 0;
                    // Shift-aware and live-gated on the shift's CURRENT overtime.enabled — not a
                    // flat ">9h" guess that ignores per-shift OT settings entirely.
                    const rowRules = inPunch.policy_rules ? safeParseRules(inPunch.policy_rules) : null;
                    const overtimeHours = rowRules ? calculateOvertime(workedHours, rowRules) : 0;

                    records.push({
                        attendance_id: inPunch.attendance_id,
                        user_id: inPunch.user_id,
                        user_name: inPunch.user_name,
                        dept_name: inPunch.dept_name,
                        shift_name: inPunch.shift_name,
                        time_in: inPunch.punch_time,
                        time_out: outPunch ? outPunch.punch_time : null,
                        status: inMeta.missed_punch ? 'MISSED_PUNCH' : defaultStatus,
                        time_in_address: inLoc.address && inLoc.address !== 'Locating...' && inLoc.address !== 'Pending...' ? inLoc.address : '-',
                        time_out_address: outLoc.address && outLoc.address !== 'Locating...' && outLoc.address !== 'Pending...' ? outLoc.address : '-',
                        time_in_image_key: inMeta.image_key || null,
                        time_out_image_key: outMeta.image_key || null,
                        late_minutes: inMeta.late_minutes || 0,
                        overtime_hours: overtimeHours,
                        record_date: inPunch.record_date
                    });
                } else {
                    i += 1;
                }
            }
        }
    }

    return records;
}

export async function getApprovedLeaves({ org_id, startDate, endDate, targetUserId }) {
    const query = attendanceDB("leave_request as lr")
        .join("core_users as u", "lr.user_id", "u.user_id")
        .select(
            "lr.lr_id",
            "lr.user_id",
            "lr.start_date",
            "lr.end_date",
            "lr.total_days",
            "lr.status",
            "lr.pay_percentage",
            "lr.pay_type",
            "lr.reason"
        )
        .where("u.org_id", org_id)
        .whereRaw("LOWER(lr.status) = 'approved'")
        .whereRaw("DATE(lr.start_date) <= ?", [endDate])
        .whereRaw("DATE(lr.end_date) >= ?", [startDate]);

    if (targetUserId) {
        query.where("lr.user_id", targetUserId);
    }
    return query;
}

export const isDateInApprovedLeave = (userLeaves, dateStr) => {
    if (!userLeaves || userLeaves.length === 0) return null;
    return userLeaves.find(l => {
        const s = getRecordDateStr({ time_in: l.start_date }) || (typeof l.start_date === 'string' ? l.start_date.slice(0, 10) : '');
        const e = getRecordDateStr({ time_in: l.end_date }) || (typeof l.end_date === 'string' ? l.end_date.slice(0, 10) : '');
        return dateStr >= s && dateStr <= e;
    });
};

// Org holidays for a date range, indexed by date string — same query shape already proven
// correct in statusEvaluationService.js's getDailySummary. Reports rebuilds day status from raw
// punches independently of that live-view path, and previously never consulted this table at
// all, which is why a no-punch holiday day used to fall through to "Absent" everywhere in Reports.
export async function getHolidaysByDate({ org_id, startDate, endDate }) {
    const holidays = await attendanceDB('org_holidays')
        .where('org_id', org_id)
        .where('holiday_date', '>=', startDate)
        .where('holiday_date', '<=', endDate);
    const byDate = {};
    for (const h of holidays) {
        byDate[getRecordDateStr({ time_in: h.holiday_date })] = h;
    }
    return byDate;
}

// A no-punch day that's a declared organization holiday should show Holiday, taking priority
// over leave/week-off/absent — matching the priority already proven correct in
// statusEvaluationService.js's resolveNoShowStatus. Only call this for a day with NO punch
// record at all; if the employee has any punch data, use their real computed status instead —
// never let a holiday override an actual worked day (Present/Late/Half Day/Overtime).
export function getHolidayOverride(dateStr, holidayByDate) {
    const holiday = holidayByDate?.[dateStr];
    if (!holiday) return null;
    return { status: 'Holiday', reason: holiday.holiday_name || 'Organization Holiday' };
}

export async function getDetailedRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id }) {
    return getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
}

export async function getCardRecords({ org_id, targetUserId, startDate, endDate, dept_id, desg_id, shift_id }) {
    const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate });
    const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
    const approvedLeaves = await getApprovedLeaves({ org_id, startDate, endDate, targetUserId });
    const holidayByDate = await getHolidaysByDate({ org_id, startDate, endDate });

    const dateHeaders = getDateRangeArray(startDate, endDate);
    const todayStr = await getTodayStr(org_id);

    const list = [];
    for (const u of users) {
        const userRecs = records.filter(r => r.user_id === u.user_id);
        const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

        for (const dateStr of dateHeaders) {
            const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
            const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);

            const aggregated = aggregateDayRecords(dayRecs, u.policy_rules, todayStr);
            const [y, m, d] = dateStr.split('-').map(Number);
            const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let timeInImage = null;
            let timeOutImage = null;

            if (aggregated.time_in) {
                const firstRec = [...dayRecs].sort((a, b) => new Date(a.time_in) - new Date(b.time_in))[0];
                const lastRec = [...dayRecs].sort((a, b) => new Date(a.time_in) - new Date(b.time_in))[dayRecs.length - 1];

                if (firstRec && firstRec.time_in_image_key) {
                    try {
                        const s3Res = await S3Service.getFileUrl({ key: firstRec.time_in_image_key });
                        if (s3Res.success) timeInImage = s3Res.url;
                    } catch (e) {
                        console.error("S3 sign error", e);
                    }
                }
                if (lastRec && lastRec.time_out_image_key) {
                    try {
                        const s3Res = await S3Service.getFileUrl({ key: lastRec.time_out_image_key });
                        if (s3Res.success) timeOutImage = s3Res.url;
                    } catch (e) {
                        console.error("S3 sign error", e);
                    }
                }
            }

            const dayOfWeekNum = new Date(y, m - 1, d).getDay();
            let status = aggregated.status;
            let lateReason = aggregated.late_reason || "-";

            const rules = getShiftRules(u);
            const dayType = getDayType(dateStr, rules.week_off_policy);

            const holidayOverride = !aggregated.time_in ? getHolidayOverride(dateStr, holidayByDate) : null;

            if (holidayOverride) {
                status = holidayOverride.status;
                lateReason = holidayOverride.reason;
            } else if (!aggregated.time_in && leaveOnDate) {
                status = "On Leave";
                lateReason = leaveOnDate.reason || "Approved Leave";
            } else if (dateStr > todayStr) {
                if (dayType === 'week_off') {
                    if (dayOfWeekNum === 0) status = "Sun";
                    else if (dayOfWeekNum === 6) status = "Sat";
                    else status = "WEEK_OFF";
                } else {
                    status = "Not Recorded";
                }
            } else if (!aggregated.time_in && status === "Absent") {
                if (dayType === 'week_off') {
                    if (dayOfWeekNum === 0) status = "Sun";
                    else if (dayOfWeekNum === 6) status = "Sat";
                    else status = "WEEK_OFF";
                }
            }

            // Calculate required hours from shift policy
            const requiredHours = getExpectedHours(dateStr, rules.week_off_policy, rules);

            list.push({
                date: formattedDate,
                rawDate: dateStr,
                user_id: u.user_id,
                user_name: u.user_name,
                designation: u.desg_name || "-",
                department: u.dept_name || "-",
                status: status,
                time_in: aggregated.time_in ? formatLocalTimeStr(aggregated.time_in) : "-",
                time_out: aggregated.time_out ? formatLocalTimeStr(aggregated.time_out) : "-",
                worked_hours: parseFloat(aggregated.worked_hours.toFixed(2)),
                required_hours: parseFloat(requiredHours.toFixed(2)),
                late_minutes: aggregated.late_minutes || 0,
                overtime_hours: aggregated.overtime_hours || 0,
                late_reason: lateReason,
                time_in_address: aggregated.time_in_address || "-",
                time_out_address: aggregated.time_out_address || "-",
                time_in_image: timeInImage,
                time_out_image: timeOutImage
            });
        }
    }
    return list;
}


export async function getPreviewData({ type, org_id, month, startDate, endDate, targetUserId, columns, dept_id, desg_id, shift_id }) {
    const colsObj = typeof columns === 'string' ? JSON.parse(columns) : (columns || {});
    let data = { columns: [], rows: [] };
    const todayStr = await getTodayStr(org_id);

    if (type.startsWith("matrix_") || type.startsWith("attendance_matrix_")) {
        const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate });
        if (users.length === 0) {
            data.cardRecords = [];
            return data;
        }
        const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
        const approvedLeaves = await getApprovedLeaves({ org_id, startDate, endDate, targetUserId });
        const holidayByDate = await getHolidaysByDate({ org_id, startDate, endDate });

        if (type === "matrix_daily") {
            const cols = [];
            const colIndices = [];

            cols.push("Name", "Position");

            const pushCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    cols.push(name);
                    colIndices.push(index);
                }
            };

            pushCol("Time In", "timeIn", 2);
            pushCol("Time Out", "timeOut", 3);
            pushCol("Work Hrs", "workedHours", 4);
            pushCol("Status", "status", 5);
            pushCol("Late (mins)", "late", 6);

            data.columns = cols;
            data.rows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = aggregateDayRecords(userRecs, u.policy_rules, todayStr);
                const holidayOverride = !aggregated.time_in ? getHolidayOverride(startDate, holidayByDate) : null;
                const fullRow = [
                    u.user_name,
                    u.desg_name || "-",
                    formatLocalTimeStr(aggregated.time_in),
                    formatLocalTimeStr(aggregated.time_out),
                    aggregated.worked_hours.toFixed(2),
                    holidayOverride ? holidayOverride.status : aggregated.status,
                    aggregated.late_minutes || 0
                ];

                const row = [fullRow[0], fullRow[1]];
                colIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

            // Calculate totals
            const workHrsIdx = data.columns.indexOf("Work Hrs");
            let totalWorkHrs = 0;
            data.rows.forEach(r => {
                if (workHrsIdx !== -1) {
                    totalWorkHrs += parseFloat(r[workHrsIdx]) || 0;
                }
            });
            const totalsRow = data.columns.map(c => {
                if (c === "Name") return "TOTALS";
                if (c === "Work Hrs") return totalWorkHrs.toFixed(2);
                return "";
            });
            data.rows.push(totalsRow);
        } else if (type === "attendance_matrix_weekly" || type === "attendance_matrix_monthly") {
            const dateStrings = getDateRangeArray(startDate, endDate);
            const dateHeaders = dateStrings.map(dateStr => {
                const [y, m, d] = dateStr.split('-').map(Number);
                return new Date(y, m - 1, d);
            });

            const baseHeaders = ["Name", "Position", "Dept"];
            if (colsObj.shift !== false) {
                baseHeaders.push("Shift");
            }
            const dateLabels = dateHeaders.map(d => {
                return `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
            });

            const summaryCols = [];
            const summaryColIndices = [];
            const pushSummary = (name, check, index) => {
                if (colsObj[check] !== false) {
                    summaryCols.push(name);
                    summaryColIndices.push(index);
                }
            };
            pushSummary("Required Hrs", "requiredHours", 0);
            pushSummary("Worked Hrs", "workedHours", 1);
            pushSummary("Late Hours", "late", 2);
            pushSummary("Late Count", "late", 3);
            pushSummary("Present Days", "attendanceDays", 4);
            pushSummary("Absent Days", "attendanceDays", 5);

            data.columns = [...baseHeaders, ...dateLabels, ...summaryCols];
            data.rows = users.map((u) => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

                const userRow = [
                    u.user_name,
                    u.desg_name || "-",
                    u.dept_name || "-"
                ];
                if (colsObj.shift !== false) {
                    userRow.push(u.shift_name || "-");
                }

                let totalWorkedHrs = 0;
                let totalLateMins = 0;
                let lateCount = 0;
                let presentDays = 0;

                const dateCells = [];
                dateHeaders.forEach((d, dIdx) => {
                    const dateStr = dateStrings[dIdx];
                    const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules, todayStr);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    const userStartDate = getUserStartDate(u);
                    const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);

                    const holidayOverride = !aggregated.time_in ? getHolidayOverride(dateStr, holidayByDate) : null;

                    if (aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave') {
                        if (aggregated.status === 'Missed Punch') {
                            dateCells.push("MP");
                        } else {
                            dateCells.push("1.0");
                            presentDays++;
                        }
                        totalWorkedHrs += aggregated.worked_hours;
                        if (aggregated.late_minutes > 0) {
                            totalLateMins += aggregated.late_minutes;
                            lateCount++;
                        }
                    } else if (holidayOverride) {
                        dateCells.push("Holiday");
                    } else if (leaveOnDate) {
                        dateCells.push("L");
                    } else if (userStartDate && dateStr < userStartDate) {
                        dateCells.push("-");
                    } else if (dateStr > todayStr) {
                        if (dayType === 'week_off') {
                            const day = d.getDay();
                            dateCells.push(day === 0 ? "Sun" : day === 6 ? "Sat" : "WEEK_OFF");
                        } else {
                            dateCells.push("Not Recorded");
                        }
                    } else {
                        if (dayType === 'week_off') {
                            const day = d.getDay();
                            dateCells.push(day === 0 ? "Sun" : day === 6 ? "Sat" : "WEEK_OFF");
                        } else {
                            dateCells.push("0.0");
                        }
                    }
                });

                const reqHrs = getRequiredHoursForPeriod(u, dateStrings, holidayByDate);
                const workedHrs = totalWorkedHrs;
                const lateHrs = totalLateMins / 60;

                let calculatedAbsentDays = 0;
                dateHeaders.forEach((d, dIdx) => {
                    const dateStr = dateStrings[dIdx];
                    const userStartDate = getUserStartDate(u);
                    if (userStartDate && dateStr < userStartDate) return;
                    const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);
                    const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave' && aggregated.status !== 'Missed Punch';
                    const isMissedPunch = aggregated.status === 'Missed Punch';
                    const isHoliday = !aggregated.time_in && !!getHolidayOverride(dateStr, holidayByDate);
                    if (!isPresent && !isMissedPunch && !isHoliday && !leaveOnDate && dateStr <= todayStr && dayType !== 'week_off') {
                        calculatedAbsentDays++;
                    }
                });

                userRow.push(...dateCells);

                const fullSummaryPart = [
                    reqHrs.toFixed(2),
                    workedHrs.toFixed(2),
                    lateHrs.toFixed(2),
                    lateCount,
                    presentDays,
                    calculatedAbsentDays
                ];
                summaryColIndices.forEach(idx => {
                    userRow.push(fullSummaryPart[idx]);
                });

                return userRow;
            });

            // Calculate totals row if rows exist
            if (data.rows.length > 0) {
                const totalsRow = ["TOTALS", "", ""];
                if (colsObj.shift !== false) totalsRow.push("");
                dateHeaders.forEach(() => {
                    totalsRow.push("");
                });

                summaryCols.forEach(c => {
                    const colIdx = data.columns.indexOf(c);
                    if (["Required Hrs", "Worked Hrs", "Late Hours"].includes(c)) {
                        let sum = 0;
                        data.rows.forEach(r => { sum += parseFloat(r[colIdx]) || 0; });
                        totalsRow.push(sum.toFixed(2));
                    } else {
                        let sum = 0;
                        data.rows.forEach(r => { sum += parseInt(r[colIdx]) || 0; });
                        totalsRow.push(sum);
                    }
                });
                data.rows.push(totalsRow);
            }
        } else {
            // Multi-day Matrix Preview (Weekly or Monthly) - Original matrix_weekly, matrix_monthly
            const dateStrings = getDateRangeArray(startDate, endDate);
            const dateHeaders = dateStrings.map(dateStr => {
                const [y, m, d] = dateStr.split('-').map(Number);
                return new Date(y, m - 1, d);
            });

            const baseHeaders = ["Name", "Position", "Dept"];
            if (colsObj.shift !== false) {
                baseHeaders.push("Shift");
            }
            const timeHeaders = [];

            let dailyColspan = 0;
            const subCols = [];

            if (colsObj.status !== false) {
                dailyColspan++;
                subCols.push({ label: "Status", key: "status" });
            }

            if (colsObj.timeIn !== false) {
                dailyColspan++;
                subCols.push({ label: "In Time", key: "timeIn" });
            }
            if (colsObj.timeOut !== false) {
                dailyColspan++;
                subCols.push({ label: "Out Time", key: "timeOut" });
            }
            if (colsObj.workedHours !== false) {
                dailyColspan++;
                subCols.push({ label: "Work Hrs", key: "workedHours" });
            }
            if (colsObj.requiredHours !== false) {
                dailyColspan++;
                subCols.push({ label: "Req Hrs", key: "requiredHours" });
            }
            if (colsObj.late !== false) {
                dailyColspan++;
                subCols.push({ label: "Late Mins", key: "late" });
            }
            if (colsObj.location !== false) {
                dailyColspan += 2;
                subCols.push({ label: "In Location", key: "location" });
                subCols.push({ label: "Out Location", key: "location" });
            }

            // Build grouped headers for the frontend table
            const row1 = [
                { label: "Name", rowspan: 2, colspan: 1 },
                { label: "Position", rowspan: 2, colspan: 1 },
                { label: "Dept", rowspan: 2, colspan: 1 }
            ];
            if (colsObj.shift !== false) {
                row1.push({ label: "Shift", rowspan: 2, colspan: 1 });
            }

            dateHeaders.forEach(d => {
                const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
                if (dailyColspan > 0) {
                    row1.push({ label: datePrefix, rowspan: 1, colspan: dailyColspan });
                }
            });

            const summaryCols = [];
            const summaryColIndices = [];
            const pushSummary = (name, check, index) => {
                if (colsObj[check] !== false) {
                    summaryCols.push(name);
                    summaryColIndices.push(index);
                }
            };
            pushSummary("Present Days", "attendanceDays", 0);
            pushSummary("Total Hrs", "workedHours", 1);
            pushSummary("Late Count", "late", 2);
            pushSummary("Late Mins", "late", 3);

            row1.push(
                ...summaryCols.map(c => ({ label: c, rowspan: 2, colspan: 1 }))
            );

            const row2 = [];
            if (dailyColspan > 0) {
                dateHeaders.forEach(() => {
                    subCols.forEach(sc => {
                        row2.push({ label: sc.label });
                    });
                });
            }

            data.headers = [row1, row2];

            const gridHeaders = [];
            if (dailyColspan > 0) {
                dateHeaders.forEach(d => {
                    const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
                    subCols.forEach(sc => {
                        gridHeaders.push(`${datePrefix}\n${sc.label}`);
                    });
                });
            }

            data.columns = [...baseHeaders, ...timeHeaders, ...gridHeaders, ...summaryCols];
            data.rows = users.map((u) => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

                const userRow = [u.user_name, u.desg_name || "-", u.dept_name || "-"];
                if (colsObj.shift !== false) {
                    userRow.push(u.shift_name || "-");
                }

                let totalHrs = 0;
                let lateCount = 0;
                let lateMins = 0;

                dateHeaders.forEach((d, dIdx) => {
                    const dateStr = dateStrings[dIdx];
                    const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules, todayStr);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);

                    if (aggregated.time_in) {
                        subCols.forEach(sc => {
                            if (sc.label === "Status") userRow.push(aggregated.status);
                            else if (sc.label === "In Time") userRow.push(formatLocalTimeStr(aggregated.time_in));
                            else if (sc.label === "Out Time") userRow.push(formatLocalTimeStr(aggregated.time_out));
                            else if (sc.label === "Work Hrs") userRow.push(aggregated.worked_hours.toFixed(2));
                            else if (sc.label === "Req Hrs") {
                                // A declared holiday requires nothing, even on a day the employee
                                // chose to come in anyway — matches the period total below.
                                const req = getHolidayOverride(dateStr, holidayByDate) ? 0 : getExpectedHours(dateStr, rules.week_off_policy, rules);
                                userRow.push(req.toFixed(2));
                            }
                            else if (sc.label === "Late Mins") userRow.push(aggregated.late_minutes.toString());
                            else if (sc.label === "In Location") userRow.push(aggregated.time_in_address || "-");
                            else if (sc.label === "Out Location") userRow.push(aggregated.time_out_address || "-");
                        });

                        totalHrs += aggregated.worked_hours;
                        if (aggregated.late_minutes > 0) {
                            lateCount++;
                            lateMins += aggregated.late_minutes;
                        }
                    } else {
                        const day = d.getDay();
                        const userStartDate = getUserStartDate(u);
                        let statusStr = "Absent";
                        if (getHolidayOverride(dateStr, holidayByDate)) {
                            statusStr = "Holiday";
                        } else if (leaveOnDate) {
                            statusStr = "On Leave";
                        } else if (userStartDate && dateStr < userStartDate) {
                            statusStr = "-";
                        } else if (dateStr > todayStr) {
                            if (dayType === 'week_off') {
                                statusStr = day === 0 ? "Sun" : day === 6 ? "Sat" : "WEEK_OFF";
                            } else {
                                statusStr = "Not Recorded";
                            }
                        } else {
                            if (dayType === 'week_off') {
                                statusStr = day === 0 ? "Sun" : day === 6 ? "Sat" : "WEEK_OFF";
                            }
                        }

                        subCols.forEach((sc) => {
                            if (sc.label === "Status") userRow.push(statusStr);
                            else if (sc.label === "Req Hrs") {
                                const req = (userStartDate && dateStr < userStartDate) || getHolidayOverride(dateStr, holidayByDate) ? 0 : getExpectedHours(dateStr, rules.week_off_policy, rules);
                                userRow.push(req.toFixed(2));
                            }
                            else userRow.push("-");
                        });
                    }
                });

                const fullSummaryPart = [userRecs.length, totalHrs.toFixed(2), lateCount, lateMins];
                summaryColIndices.forEach(idx => {
                    userRow.push(fullSummaryPart[idx]);
                });
                return userRow;
            });
        }
    } else if (type === "attendance_detailed") {
        const records = await getDetailedRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
        const cols = ["Date", "Name", "Dept"];
        const colIndices = [];

        const pushCol = (name, check, index) => {
            if (colsObj[check] !== false) {
                cols.push(name);
                colIndices.push(index);
            }
        };

        pushCol("Shift", "shift", 3);
        pushCol("Time In", "timeIn", 4);
        pushCol("Time Out", "timeOut", 5);
        pushCol("Work Hrs", "workedHours", 6);
        pushCol("Status", "status", 7);
        pushCol("In Location", "location", 8);
        pushCol("Out Location", "location", 9);

        data.columns = cols;
        data.rows = records.map(r => {
            const fullRow = [
                formatLocalDateStr(r.time_in),
                r.user_name,
                r.dept_name || "-",
                r.shift_name || "-",
                formatLocalTimeStr(r.time_in, true),
                formatLocalTimeStr(r.time_out, true),
                calculateWorkHours(r.time_in, r.time_out),
                deriveStatus(r, todayStr),
                r.time_in_address || "-",
                r.time_out_address || "-"
            ];

            const row = [fullRow[0], fullRow[1], fullRow[2]];
            colIndices.forEach(idx => {
                row.push(fullRow[idx]);
            });
            return row;
        });
    } else if (type === "attendance_summary") {
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

        const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate });
        if (users.length === 0) {
            data.cardRecords = [];
            return data;
        }
        const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
        const approvedLeaves = await getApprovedLeaves({ org_id, startDate, endDate, targetUserId });
        const holidayByDate = await getHolidaysByDate({ org_id, startDate, endDate });
        const holidayWorkedHeader = `Holidays Worked (of ${Object.keys(holidayByDate).length})`;

        const cols = ["Name", "Dept", "Total Days"];
        const colIndices = [];

        const pushCol = (name, check, index) => {
            if (colsObj[check] !== false) {
                cols.push(name);
                colIndices.push(index);
            }
        };

        if (colsObj.attendanceDays !== false) {
            cols.push("Present", "Absent", "Half Day", "On Leave", holidayWorkedHeader);
            colIndices.push(3, 4, 5, 6, 13);
        }
        if (colsObj.late !== false) {
            cols.push("Late Days", "Late Mins");
            colIndices.push(7, 8);
        }
        if (colsObj.workedHours !== false) {
            cols.push("Overtime Hrs", "Total Hrs");
            colIndices.push(9, 10);
        }
        if (colsObj.requiredHours !== false) {
            cols.push("Required Hrs");
            colIndices.push(12);
        }
        if (colsObj.attendanceDays !== false) {
            cols.push("Payable Days");
            colIndices.push(11);
        }

        data.columns = cols;

        // Generate calendar day dates for this month timezone-independently
        const dateStrings = getDateRangeArray(startDate, endDate);

        const baseRows = users.map(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

            let presentDays = 0;
            let halfDayCount = 0;
            let leaveCount = 0;
            let absentDays = 0;
            let holidayWorkedCount = 0;
            let lateCount = 0;
            let totalLateMins = 0;
            let totalOvertimeHrs = 0;
            let totalHrs = 0;

            dateStrings.forEach(dateStr => {
                const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
                const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);

                if (dayRecs.length > 0) {
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules, todayStr);

                    if (aggregated.status === "On Leave" || leaveOnDate) {
                        leaveCount++;
                    } else if (aggregated.status === "Half Day") {
                        halfDayCount++;
                        presentDays++;
                    } else if (aggregated.status === "Absent") {
                        if (leaveOnDate) {
                            leaveCount++;
                        } else {
                            absentDays++;
                        }
                    } else {
                        presentDays++;
                    }

                    // Worked-on-holiday is a supplementary tag, not a separate bucket — the day
                    // above is already counted under Present/Late/Half Day/etc., so this
                    // deliberately does not participate in the Total Days reconciliation.
                    if (getHolidayOverride(dateStr, holidayByDate)) {
                        holidayWorkedCount++;
                    }

                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        totalLateMins += aggregated.late_minutes;
                    }

                    totalHrs += aggregated.worked_hours;

                    totalOvertimeHrs += (aggregated.overtime_hours || 0);
                } else {
                    if (getHolidayOverride(dateStr, holidayByDate)) {
                        // No punch, declared holiday — correctly excluded from Absent (Phase 2),
                        // but since nothing was worked, it does not add to holidayWorkedCount.
                    } else if (leaveOnDate) {
                        leaveCount++;
                    } else {
                        const rules = getShiftRules(u);
                        const dayType = getDayType(dateStr, rules.week_off_policy);
                        const userStartDate = getUserStartDate(u);
                        if (dateStr <= todayStr && dayType !== 'week_off' && (!userStartDate || dateStr >= userStartDate)) {
                            absentDays++;
                        }
                    }
                }
            });

            const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
            const requiredHrs = getRequiredHoursForPeriod(u, dateStrings, holidayByDate);

            const fullRow = [
                u.user_name,
                u.dept_name || "-",
                totalDaysInMonth,
                presentDays,
                absentDays,
                halfDayCount,
                leaveCount,
                lateCount,
                totalLateMins,
                totalOvertimeHrs.toFixed(2),
                totalHrs.toFixed(2),
                Math.round(payableDays).toFixed(0),
                requiredHrs.toFixed(2),
                holidayWorkedCount
            ];

            const row = [fullRow[0], fullRow[1], fullRow[2]];
            colIndices.forEach(idx => {
                row.push(fullRow[idx]);
            });
            return row;
        });

        // Calculate totals dynamically if rows exist
        if (baseRows.length > 0) {
            const totalsRow = ["TOTALS", "", ""];
            colIndices.forEach(idx => {
                if ([3, 4, 5, 6, 7, 8, 11, 13].includes(idx)) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const mappedIdx = cols.indexOf(
                            idx === 3 ? "Present" :
                                idx === 4 ? "Absent" :
                                    idx === 5 ? "Half Day" :
                                        idx === 6 ? "On Leave" :
                                            idx === 7 ? "Late Days" :
                                                idx === 8 ? "Late Mins" :
                                                    idx === 11 ? "Payable Days" : holidayWorkedHeader
                        );
                        if (mappedIdx !== -1) sum += parseInt(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum);
                } else if ([9, 10].includes(idx)) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const mappedIdx = cols.indexOf(idx === 9 ? "Overtime Hrs" : "Total Hrs");
                        if (mappedIdx !== -1) sum += parseFloat(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum.toFixed(2));
                } else if (idx === 12) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const mappedIdx = cols.indexOf("Required Hrs");
                        if (mappedIdx !== -1) sum += parseFloat(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum.toFixed(2));
                }
            });
            data.rows = [...baseRows, totalsRow];
        } else {
            data.rows = [];
        }

    } else if (type === "employee_master") {
        const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate, include_inactive: true });

        data.columns = ["Name", "Email", "Phone", "Dept", "Designation", "Role", "Status"];
        data.rows = users.map(u => [u.user_name, u.email || "-", u.phone_no || "-", u.dept_name || "-", u.desg_name || "-", u.user_type || "-", u.is_deleted ? "Deleted" : (u.is_active ? "Active" : "Inactive")]);
    }

    if (type !== "employee_master") {
        data.cardRecords = await getCardRecords({ org_id, targetUserId, startDate, endDate, dept_id, desg_id, shift_id });
    } else {
        data.cardRecords = [];
    }

    return data;
}
