import { attendanceDB } from '../../config/database.js';
import * as S3Service from '../../services/s3/s3Service.js';
import { getShiftRules, getDayType, getExpectedHours } from '../shifts/shiftService.js';
import { calculateOvertime } from '../../services/statusEvalution/statusEvaluationService.js';
import { getUsers } from '../users/userService.js';
import { getApprovedLeaves, isDateInApprovedLeave } from '../leaves/leaveService.js';
import { getHolidays } from '../holidays/holidayService.js';
import {
    getCardRecords,
    getAttendanceRecords,
    aggregateDayRecords,
    getDateRangeArray,
    getRecordDateStr,
    getDetailedRecords,
    groupRecordsByUserAndDay,
    formatLocalTimeStr,
    safeParseRules,
    getUserStartDate,
    getTodayStr,
    isValidDeptId,
    isValidDesgId,
    isValidShiftId
} from '../attendance/attendanceService.js';

export {
    getShiftRules,
    getDayType,
    getExpectedHours,
    calculateOvertime,
    getCardRecords,
    getAttendanceRecords,
    getApprovedLeaves,
    aggregateDayRecords,
    getDateRangeArray,
    getRecordDateStr,
    isDateInApprovedLeave,
    getDetailedRecords,
    groupRecordsByUserAndDay,
    formatLocalTimeStr,
    safeParseRules,
    getUserStartDate,
    getUsers,
    getTodayStr,
    isValidDeptId,
    isValidDesgId,
    isValidShiftId
};

// Timezone-independent formatting helpers
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

// Org holidays for a date range, indexed by date string, leveraging Redis-cached holidayService
export async function getHolidaysByDate({ org_id, startDate, endDate }) {
    const holidays = await getHolidays(org_id);
    const byDate = {};
    for (const h of (holidays || [])) {
        const rawDate = h.holiday_date;
        const d = typeof rawDate === 'string'
            ? rawDate.slice(0, 10)
            : (rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : '');
        if (!d) continue;

        if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
            byDate[d] = {
                ...h,
                holiday_date: d
            };
        }
    }
    return byDate;
}

// A no-punch day that's a declared organization holiday should show Holiday
export function getHolidayOverride(dateStr, holidayByDate) {
    const holiday = holidayByDate?.[dateStr];
    if (!holiday) return null;
    return { status: 'Holiday', reason: holiday.holiday_name || 'Organization Holiday' };
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
                        } else if (aggregated.status === 'Half Day') {
                            dateCells.push("Half Day");
                            presentDays++;
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
        const users = await getUsers({ org_id, targetUserId, dept_id, desg_id, shift_id, startDate, endDate });
        const records = await getDetailedRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
        const dayRows = groupRecordsByUserAndDay(records, users, todayStr);
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
        data.rows = dayRows.map(r => {
            const fullRow = [
                formatLocalDateStr(r.time_in),
                r.user_name,
                r.dept_name || "-",
                r.shift_name || "-",
                formatLocalTimeStr(r.time_in, true),
                formatLocalTimeStr(r.time_out, true),
                r.worked_hours.toFixed(2),
                r.status,
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
