import { attendanceDB } from '../../config/database.js';
import * as S3Service from '../s3/s3Service.js';
import { getShiftRules, getDayType, getExpectedHours } from '../attendance/shiftManagementService.js';

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

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(new Date());
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        return `${year}-${month}-${day}`;
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
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

export const calculateOvertime = (totalHours, rules) => {
    const timing = rules?.shift_timing || {};
    const [sH, sM] = (timing.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timing.end_time || '18:00:00').split(':').map(Number);
    let expectedHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (expectedHours < 0) expectedHours += 24;

    let threshold = Number(rules?.overtime?.threshold || 8);
    threshold = Math.max(threshold, expectedHours);

    const buffer = Number(rules?.overtime?.buffer ?? 0.5);
    const isEnabled = rules?.overtime?.enabled !== false;

    if (isEnabled && totalHours >= (threshold + buffer)) {
        let overtime = parseFloat((totalHours - threshold).toFixed(2));
        const maxOvertimeVal = rules?.overtime?.max_overtime ?? rules?.overtime?.maxOvertime;
        if (maxOvertimeVal !== undefined && maxOvertimeVal !== null) {
            const maxOvertime = Number(maxOvertimeVal);
            if (overtime > maxOvertime) {
                overtime = maxOvertime;
            }
        }
        return overtime;
    }
    return 0;
};

export const aggregateDayRecords = (dayRecs, userPolicyRules) => {
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
    
    const worked_hours = sorted.reduce((sum, r) => sum + parseFloat(calculateWorkHours(r.time_in, r.time_out)), 0);
    const late_minutes = first.late_minutes || 0;
    let overtime_hours = 0;
    
    let status = "Present";
    const hasLeave = sorted.some(r => r.status === 'ON_LEAVE');
    const hasHalfDay = sorted.some(r => r.status === 'HALF_DAY');
    const hasAbsent = sorted.every(r => r.status === 'ABSENT');
    
    if (hasLeave) status = "On Leave";
    else if (hasHalfDay) status = "Half Day";
    else if (hasAbsent) status = "Absent";
    else {
        let statusParts = [];
        if (late_minutes > 0) statusParts.push("Late");
        
        if (userPolicyRules) {
            const rules = safeParseRules(userPolicyRules);
            overtime_hours = calculateOvertime(worked_hours, rules);
        } else {
            overtime_hours = sorted.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
        }
        
        if (overtime_hours > 0) statusParts.push("Overtime");
        if (statusParts.length > 0) status = statusParts.join(" & ");
    }
    
    return {
        time_in: first.time_in,
        time_out: last.time_out,
        worked_hours,
        late_minutes,
        overtime_hours,
        late_reason: first.late_reason || null,
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
export const deriveStatus = (r) => {
    if (!r.time_in) return "Absent";
    if (r.status === 'ON_LEAVE') return "On Leave";
    if (r.status === 'HALF_DAY') return "Half Day";
    if (r.status === 'ABSENT') return "Absent";

    let statusParts = [];
    if (r.late_minutes > 0) statusParts.push("Late");
    if (r.overtime_hours > 0) statusParts.push("Overtime");

    if (statusParts.length > 0) return statusParts.join(" & ");

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
export const getRequiredHoursForPeriod = (user, dateHeaders) => {
    let total = 0;
    const rules = getShiftRules(user);
    dateHeaders.forEach(d => {
        const dateStr = d.toISOString().split('T')[0];
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
        endDate = new Date().toISOString().split("T")[0];
    } else if (["matrix_daily", "attendance_matrix_daily"].includes(type)) {
        startDate = date;
        endDate = date;
    } else if (["matrix_weekly", "attendance_matrix_weekly"].includes(type)) {
        const start = new Date(date);
        startDate = start.toISOString().split("T")[0];
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        endDate = end.toISOString().split("T")[0];
    } else if (["matrix_monthly", "attendance_matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) || month) {
        const [year, monthNum] = month.split("-");
        startDate = `${month}-01`;
        endDate = new Date(Date.UTC(year, monthNum, 0)).toISOString().split("T")[0];
    }

    return { startDate, endDate };
};

export async function getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id }) {
    return attendanceDB("core_users as u")
        .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("org_designations as dg", "u.desg_id", "dg.desg_id")
        .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
        .select("u.user_id", "u.user_name", "d.dept_name", "dg.desg_name", "u.email", "u.phone_no", "u.user_type", "s.policy_rules", "s.shift_name")
        .where("u.org_id", org_id)
        .modify(qb => {
            if (targetUserId) {
                qb.where("u.user_id", targetUserId);
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
}

export async function getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id }) {
    return attendanceDB("attn_records as ar")
        .modify(qb => {
            if (isValidDeptId(dept_id) || isValidDesgId(desg_id) || isValidShiftId(shift_id)) {
                qb.join("core_users as u", "ar.user_id", "u.user_id")
                  .select("ar.*");
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
            }
        })
        .where("ar.org_id", org_id)
        .whereRaw("DATE(ar.time_in) >= ?", [startDate])
        .whereRaw("DATE(ar.time_in) <= ?", [endDate])
        .modify(qb => { if (targetUserId) qb.where("ar.user_id", targetUserId); });
}

export async function getDetailedRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id }) {
    return attendanceDB("attn_records as ar")
        .join("core_users as u", "ar.user_id", "u.user_id")
        .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
        .select("ar.time_in", "u.user_id", "u.user_name", "d.dept_name", "s.shift_name", "ar.time_out", "ar.status", "ar.time_in_address", "ar.time_out_address", "ar.late_minutes", "ar.overtime_hours")
        .where("ar.org_id", org_id)
        .whereRaw("DATE(ar.time_in) >= ?", [startDate])
        .whereRaw("DATE(ar.time_in) <= ?", [endDate])
        .modify(qb => {
            if (targetUserId) {
                qb.where("ar.user_id", targetUserId);
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
        .orderBy("ar.time_in", "asc");
}



export async function getCardRecords({ org_id, targetUserId, startDate, endDate, dept_id, desg_id, shift_id }) {
    const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id });
    const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    const dateHeaders = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        dateHeaders.push(d.toISOString().split('T')[0]);
    }

    const todayStr = await getTodayStr(org_id);

    const list = [];
    for (const u of users) {
        const userRecs = records.filter(r => r.user_id === u.user_id);

        for (const dateStr of dateHeaders) {
            const dayRecs = userRecs.filter(r => {
                const rDate = new Date(r.time_in).toISOString().split('T')[0];
                return rDate === dateStr;
            });

            const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
            const formattedDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
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

            const dayOfWeekNum = new Date(dateStr + 'T00:00:00Z').getUTCDay();
            let status = aggregated.status;

            const rules = getShiftRules(u);
            const dayType = getDayType(dateStr, rules.week_off_policy);

            if (dateStr > todayStr) {
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
                late_reason: aggregated.late_reason || "-",
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
        const users = await attendanceDB("core_users as u")
            .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("org_designations as dg", "u.desg_id", "dg.desg_id")
            .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
            .select("u.user_id", "u.user_name", "d.dept_name", "dg.desg_name", "s.policy_rules", "s.shift_name")
            .where("u.org_id", org_id)
            .modify(qb => {
                if (targetUserId) {
                    qb.where("u.user_id", targetUserId);
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

        const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });

        if (type === "matrix_daily") {
            const cols = [];
            const colIndices = [];

            cols.push("Name", "Dept");

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
            pushCol("In Location", "location", 6);
            pushCol("Out Location", "location", 7);

            data.columns = cols;
            data.rows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = aggregateDayRecords(userRecs, u.policy_rules);
                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    formatLocalTimeStr(aggregated.time_in),
                    formatLocalTimeStr(aggregated.time_out),
                    aggregated.worked_hours.toFixed(2),
                    aggregated.status,
                    aggregated.time_in_address,
                    aggregated.time_out_address
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
        } else if (type === "attendance_matrix_daily") {
            const cols = [];
            const colIndices = [];
            cols.push("Name", "Dept");

            const pushCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    cols.push(name);
                    colIndices.push(index);
                }
            };

            cols.push("Attendance");
            pushCol("Required Hours", "requiredHours", 3);
            pushCol("Worked Hours", "workedHours", 4);
            pushCol("Late Hours", "late", 5);
            pushCol("Late Count", "late", 6);
            pushCol("Present Days", "attendanceDays", 7);
            pushCol("Absent Days", "attendanceDays", 8);

            data.columns = cols;
            data.rows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = aggregateDayRecords(userRecs, u.policy_rules);
                const rules = getShiftRules(u);
                const dayType = getDayType(startDate, rules.week_off_policy);
                const dayOfWeek = new Date(startDate + 'T00:00:00Z').getUTCDay();
                const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave' ? 1 : 0;
                
                let attendanceStatus = isPresent.toString() + ".0";
                if (!isPresent) {
                    if (startDate > todayStr && dayType !== 'week_off') {
                        attendanceStatus = "Not Recorded";
                    } else if (dayType === 'week_off') {
                        attendanceStatus = dayOfWeek === 0 ? "Sun" : dayOfWeek === 6 ? "Sat" : "WEEK_OFF";
                    }
                }
                
                const isAbsent = !isPresent && dayType !== 'week_off' && attendanceStatus !== "Not Recorded" ? 1 : 0;

                const reqHrs = getExpectedHours(startDate, rules.week_off_policy, rules);
                const workedHrs = aggregated.worked_hours;
                const lateMins = aggregated.late_minutes;
                const lateHrs = lateMins / 60;
                const lateCount = lateMins > 0 ? 1 : 0;

                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    attendanceStatus,
                    reqHrs.toFixed(2),
                    workedHrs.toFixed(2),
                    lateHrs.toFixed(2),
                    lateCount,
                    isPresent,
                    isAbsent
                ];

                const row = [fullRow[0], fullRow[1], fullRow[2]];
                colIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

            // Calculate totals
            const totalsRow = data.columns.map(c => {
                if (c === "Name") return "TOTALS";
                if (["Required Hours", "Worked Hours", "Late Hours"].includes(c)) {
                    const colIdx = data.columns.indexOf(c);
                    let sum = 0;
                    data.rows.forEach(r => { sum += parseFloat(r[colIdx]) || 0; });
                    return sum.toFixed(2);
                }
                if (["Late Count", "Present Days", "Absent Days"].includes(c)) {
                    const colIdx = data.columns.indexOf(c);
                    let sum = 0;
                    data.rows.forEach(r => { sum += parseInt(r[colIdx]) || 0; });
                    return sum;
                }
                return "";
            });
            data.rows.push(totalsRow);
        } else if (type === "attendance_matrix_weekly" || type === "attendance_matrix_monthly") {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const dateHeaders = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dateHeaders.push(new Date(d));
            }

            const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
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
            data.rows = users.map((u, index) => {
                const userRecs = records.filter(r => r.user_id === u.user_id);

                const userRow = [
                    index + 1,
                    u.user_name,
                    u.desg_name || "-",
                    u.dept_name || "-"
                ];
                if (colsObj.shift !== false) {
                    userRow.push(u.shift_name || "-");
                }

                let totalWorkedHrs = 0;
                let totalLateMins = 0;
                let presentDays = 0;

                const dateCells = [];
                dateHeaders.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    if (aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave') {
                        dateCells.push("1.0");
                        presentDays++;
                        totalWorkedHrs += aggregated.worked_hours;
                        if (aggregated.late_minutes > 0) {
                            totalLateMins += aggregated.late_minutes;
                        }
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

                const reqHrs = getRequiredHoursForPeriod(u, dateHeaders);
                const workedHrs = totalWorkedHrs;
                const lateHrs = totalLateMins / 60;
                const lateCount = userRecs.filter(r => r.late_minutes > 0).length;

                let calculatedAbsentDays = 0;
                dateHeaders.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave';
                    if (!isPresent && dateStr <= todayStr && dayType !== 'week_off') {
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

            // Calculate totals row
            const totalsRow = ["TOTALS", "", "", ""];
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
        } else {
            // Multi-day Matrix Preview (Weekly or Monthly) - Original matrix_weekly, matrix_monthly
            const start = new Date(startDate);
            const end = new Date(endDate);
            const dateHeaders = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dateHeaders.push(new Date(d));
            }

            const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
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
                { label: "SR No.", rowspan: 2, colspan: 1 },
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
            data.rows = users.map((u, index) => {
                const userRecs = records.filter(r => r.user_id === u.user_id);

                const userRow = [index + 1, u.user_name, u.desg_name || "-", u.dept_name || "-"];
                if (colsObj.shift !== false) {
                    userRow.push(u.shift_name || "-");
                }

                let totalHrs = 0;
                let lateCount = 0;
                let lateMins = 0;

                dateHeaders.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    if (aggregated.time_in) {
                        subCols.forEach(sc => {
                            if (sc.label === "Status") userRow.push(aggregated.status);
                            else if (sc.label === "In Time") userRow.push(formatLocalTimeStr(aggregated.time_in));
                            else if (sc.label === "Out Time") userRow.push(formatLocalTimeStr(aggregated.time_out));
                            else if (sc.label === "Work Hrs") userRow.push(aggregated.worked_hours.toFixed(2));
                            else if (sc.label === "Req Hrs") {
                                const req = getExpectedHours(dateStr, rules.week_off_policy, rules);
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
                        let statusStr = "Absent";
                        if (dateStr > todayStr) {
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

                        subCols.forEach((sc, scIdx) => {
                            if (sc.label === "Status") userRow.push(statusStr);
                            else if (sc.label === "Req Hrs") {
                                const req = getExpectedHours(dateStr, rules.week_off_policy, rules);
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
        const records = await getDetailedRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id });
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
                deriveStatus(r),
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

        const users = await attendanceDB("core_users as u")
            .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("org_designations as dg", "u.desg_id", "dg.desg_id")
            .leftJoin("org_shifts as s", "u.shift_id", "s.shift_id")
            .select("u.user_id", "u.user_name", "d.dept_name", "s.policy_rules", "s.shift_name")
            .where("u.org_id", org_id)
            .modify(qb => {
                if (targetUserId) {
                    qb.where("u.user_id", targetUserId);
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
            });

        const records = await getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });

        const cols = ["Name", "Dept", "Total Days"];
        const colIndices = [];

        const pushCol = (name, check, index) => {
            if (colsObj[check] !== false) {
                cols.push(name);
                colIndices.push(index);
            }
        };

        if (colsObj.attendanceDays !== false) {
            cols.push("Present", "Absent", "Half Day", "On Leave");
            colIndices.push(3, 4, 5, 6);
        }
        if (colsObj.late !== false) {
            cols.push("Late Days", "Late Mins");
            colIndices.push(7, 8);
        }
        if (colsObj.workedHours !== false) {
            cols.push("Overtime Hrs", "Total Hrs");
            colIndices.push(9, 10);
        }
        if (colsObj.attendanceDays !== false) {
            cols.push("Payable Days");
            colIndices.push(11);
        }

        data.columns = cols;

        // Generate calendar day dates for this month timezone-independently
        const dateStrings = [];
        const startD = new Date(startDate + 'T00:00:00Z');
        const endD = new Date(endDate + 'T00:00:00Z');
        for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
            dateStrings.push(d.toISOString().split('T')[0]);
        }

        const baseRows = users.map(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            
            let presentDays = 0;
            let halfDayCount = 0;
            let leaveCount = 0;
            let absentDays = 0;
            let lateCount = 0;
            let totalLateMins = 0;
            let totalOvertimeHrs = 0;
            let totalHrs = 0;

            dateStrings.forEach(dateStr => {
                const dayRecs = userRecs.filter(r => {
                    const rDate = new Date(r.time_in).toISOString().split('T')[0];
                    return rDate === dateStr;
                });

                if (dayRecs.length > 0) {
                    const aggregated = aggregateDayRecords(dayRecs, u.policy_rules);
                    
                    if (aggregated.status === "On Leave") {
                        leaveCount++;
                    } else if (aggregated.status === "Half Day") {
                        halfDayCount++;
                        presentDays++;
                    } else if (aggregated.status === "Absent") {
                        absentDays++;
                    } else {
                        presentDays++;
                    }

                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        totalLateMins += aggregated.late_minutes;
                    }

                    totalHrs += aggregated.worked_hours;

                    let overtime_hours = 0;
                    if (u.policy_rules) {
                        const rules = safeParseRules(u.policy_rules);
                        overtime_hours = calculateOvertime(aggregated.worked_hours, rules);
                    } else {
                        overtime_hours = dayRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                    }
                    totalOvertimeHrs += overtime_hours;
                } else {
                    const rules = getShiftRules(u);
                    const dayType = getDayType(dateStr, rules.week_off_policy);
                    if (dateStr <= todayStr && dayType !== 'week_off') {
                        absentDays++;
                    }
                }
            });

            const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;

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
                Math.round(payableDays).toFixed(0)
            ];

            const row = [fullRow[0], fullRow[1], fullRow[2]];
            colIndices.forEach(idx => {
                row.push(fullRow[idx]);
            });
            return row;
        });

        // Calculate totals dynamically
        const totalsRow = ["TOTALS", "", ""];
        colIndices.forEach(idx => {
            if ([3, 4, 5, 6, 7, 8, 11].includes(idx)) {
                let sum = 0;
                baseRows.forEach(r => {
                    const mappedIdx = cols.indexOf(
                        idx === 3 ? "Present" :
                        idx === 4 ? "Absent" :
                        idx === 5 ? "Half Day" :
                        idx === 6 ? "On Leave" :
                        idx === 7 ? "Late Days" :
                        idx === 8 ? "Late Mins" : "Payable Days"
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
            }
        });

        data.rows = [...baseRows, totalsRow];

    } else if (type === "employee_master") {
        const users = await attendanceDB("core_users as u")
            .leftJoin("org_departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("org_designations as dg", "u.desg_id", "dg.desg_id")
            .select("u.user_id", "u.user_name", "u.email", "u.phone_no", "d.dept_name", "dg.desg_name", "u.user_type")
            .where("u.org_id", org_id)
            .modify(qb => {
                if (isValidDeptId(dept_id)) {
                    qb.where("u.dept_id", dept_id);
                }
                if (isValidDesgId(desg_id)) {
                    qb.where("u.desg_id", desg_id);
                }
            });

        data.columns = ["Name", "Email", "Phone", "Dept", "Designation", "Role"];
        data.rows = users.map(u => [u.user_name, u.email, u.phone_no, u.dept_name || "-", u.desg_name || "-", u.user_type]);
    }

    if (type !== "employee_master") {
        data.cardRecords = await getCardRecords({ org_id, targetUserId, startDate, endDate, dept_id, desg_id });
    } else {
        data.cardRecords = [];
    }

    return data;
}