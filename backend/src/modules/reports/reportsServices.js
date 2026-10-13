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

export const formatMusterTime = (dateVal) => {
    if (!dateVal) return "";
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const h12 = h % 12 || 12;
    return `${h12}:${m}`;
};

export async function buildMusterRollData({
    org_id,
    users,
    records,
    approvedLeaves,
    holidayByDate,
    startDate,
    endDate,
    month,
    todayStr
}) {
    let companyName = "Mano Project Consultant Pvt Ltd";
    try {
        const org = await attendanceDB("core_organizations").where({ org_id }).select("org_name").first();
        if (org?.org_name) companyName = org.org_name;
    } catch {
        // Fallback default
    }

    const dateStrings = getDateRangeArray(startDate, endDate);
    const [y, m] = (month || startDate).split('-').map(Number);
    const baseDate = new Date(y, (m || 1) - 1, 1);
    const monthFull = baseDate.toLocaleDateString('en-US', { month: 'long' });
    const monthTitle = `Staff Attendance ${monthFull} ${y}`;

    const dateHeaders = dateStrings.map(dateStr => {
        const [dy, dm, dd] = dateStr.split('-').map(Number);
        const d = new Date(dy, dm - 1, dd);
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
        const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = String(dy).slice(-2);
        const dateFormatted = `${String(dd).padStart(2, '0')}-${monthShort}-${yearShort}`;
        const isSunday = d.getDay() === 0;
        const isHoliday = !!getHolidayOverride(dateStr, holidayByDate);
        const holidayName = holidayByDate[dateStr]?.name || holidayByDate[dateStr]?.holiday_name || '';
        return {
            dateStr,
            dayOfWeek,
            dayNum: dd,
            dateFormatted,
            isSunday,
            isHoliday,
            holidayName,
            isHighlight: isSunday || isHoliday
        };
    });

    const employees = users.map((u, index) => {
        const userRecs = records.filter(r => r.user_id === u.user_id);
        const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);
        const rules = getShiftRules(u);
        const userStartDate = getUserStartDate(u);

        const statusRow = [];
        const workHourRow = [];
        const inRow = [];
        const outRow = [];

        let presentUnits = 0;

        dateHeaders.forEach(dh => {
            const dateStr = dh.dateStr;
            const dayRecs = userRecs.filter(r => getRecordDateStr(r) === dateStr);
            const aggregated = aggregateDayRecords(dayRecs, u.policy_rules, todayStr);
            const dayType = getDayType(dateStr, rules.week_off_policy);
            const isSunday = dh.isSunday || dayType === 'week_off';
            const isHoliday = dh.isHoliday;
            const isOff = isSunday || isHoliday;
            const leaveOnDate = isDateInApprovedLeave(userLeaves, dateStr);
            const isJoined = !userStartDate || dateStr >= userStartDate;

            if (aggregated.time_in) {
                const workedHours = aggregated.worked_hours || 0;
                workHourRow.push(workedHours > 0 ? workedHours.toFixed(1) : "0.0");
                inRow.push(formatMusterTime(aggregated.time_in));
                outRow.push(formatMusterTime(aggregated.time_out));

                if (isOff) {
                    statusRow.push("1.0");
                    presentUnits += 1.0;
                } else if (aggregated.status === 'Half Day') {
                    statusRow.push("0.5");
                    presentUnits += 0.5;
                } else if (aggregated.status === 'Absent') {
                    statusRow.push("0.0");
                } else {
                    statusRow.push("1.0");
                    presentUnits += 1.0;
                }
            } else {
                if (isOff) {
                    statusRow.push("1.0");
                    presentUnits += 1.0;
                    workHourRow.push("");
                    inRow.push("");
                    outRow.push("");
                } else if (leaveOnDate) {
                    statusRow.push("1.0");
                    presentUnits += 1.0;
                    workHourRow.push("");
                    inRow.push("");
                    outRow.push("");
                } else if (!isJoined) {
                    statusRow.push("-");
                    workHourRow.push("");
                    inRow.push("");
                    outRow.push("");
                } else if (dateStr > todayStr) {
                    statusRow.push("");
                    workHourRow.push("");
                    inRow.push("");
                    outRow.push("");
                } else {
                    statusRow.push("0.0");
                    workHourRow.push("0.0");
                    inRow.push("");
                    outRow.push("");
                }
            }
        });

        const presentDaysFormatted = presentUnits.toFixed(2);
        const gradeFormatted = u.grade || `G-${String(u.desg_id || ((index % 10) + 1)).padStart(2, '0')}`;
        const codeFormatted = u.user_code || `M-${u.user_id}`;

        return {
            srNo: index + 1,
            userId: u.user_id,
            name: u.user_name,
            position: u.desg_name || "-",
            employeeCode: codeFormatted,
            grade: gradeFormatted,
            daysInMonth: dateStrings.length,
            presentDays: presentDaysFormatted,
            statusRow,
            workHourRow,
            inRow,
            outRow
        };
    });

    return {
        monthTitle,
        companyName,
        daysInMonth: dateStrings.length,
        dateHeaders,
        employees
    };
}

export async function getPreviewData({ type, org_id, month, startDate, endDate, targetUserId, columns, dept_id, desg_id, shift_id }) {
    let colsObj = {};
    try {
        colsObj = typeof columns === 'string' ? (columns.trim() ? JSON.parse(columns) : {}) : (columns || {});
    } catch {
        colsObj = {};
    }
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
        } else if (["matrix_monthly", "attendance_matrix_monthly", "matrix_weekly", "attendance_matrix_weekly"].includes(type)) {
            const musterRoll = await buildMusterRollData({
                org_id,
                users,
                records,
                approvedLeaves,
                holidayByDate,
                startDate,
                endDate,
                month,
                todayStr
            });

            const showPosition = colsObj.position !== false && colsObj.positionName !== false;
            const showWorkHour = colsObj.workedHours !== false && colsObj.workHour !== false;
            const showIn = colsObj.timeIn !== false && colsObj.inPunch !== false && colsObj.in !== false;
            const showOut = colsObj.timeOut !== false && colsObj.outPunch !== false && colsObj.out !== false;
            const showEmpCode = colsObj.employeeCode !== false && colsObj.empCode !== false;
            const showDaysInMonth = colsObj.daysInMonth !== false;
            const showPresentDays = colsObj.presentDays !== false;

            musterRoll.columnsConfig = colsObj;
            data.musterRoll = musterRoll;

            // Columns and dynamic layout
            const baseCols = ["SR No.", "Name", "Attributes"];
            if (showEmpCode) baseCols.push("Employee Code");
            if (showDaysInMonth) baseCols.push("Days in Month");
            if (showPresentDays) baseCols.push("Present Days");

            const dateLabels = musterRoll.dateHeaders.map(dh => `${dh.dayOfWeek}\n${dh.dateFormatted}`);
            data.columns = [...baseCols, ...dateLabels];

            // Structured rows per employee based on user selected attributes
            const formattedRows = [];
            musterRoll.employees.forEach(emp => {
                const prefixRow1 = [
                    emp.srNo,
                    emp.name,
                    showPosition ? (emp.position || "Status") : "Status"
                ];
                if (showEmpCode) prefixRow1.push(emp.employeeCode);
                if (showDaysInMonth) prefixRow1.push(emp.daysInMonth);
                if (showPresentDays) prefixRow1.push(emp.presentDays);
                formattedRows.push([...prefixRow1, ...emp.statusRow]);

                const emptyPrefix = (label) => {
                    const row = ["", "", label];
                    if (showEmpCode) row.push("");
                    if (showDaysInMonth) row.push("");
                    if (showPresentDays) row.push("");
                    return row;
                };

                if (showWorkHour) {
                    formattedRows.push([...emptyPrefix("Work Hour"), ...emp.workHourRow]);
                }
                if (showIn) {
                    formattedRows.push([...emptyPrefix("In"), ...emp.inRow]);
                }
                if (showOut) {
                    formattedRows.push([...emptyPrefix("Out"), ...emp.outRow]);
                }
            });

            data.rows = formattedRows;
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

        data.columns = ["Code", "Name", "Department", "Designation", "Shift", "Phone", "Email", "Joining Date", "Role", "Status"];
        data.rows = users.map(u => [
            u.user_code || `EMP-${u.user_id}`,
            u.user_name,
            u.dept_name || "-",
            u.desg_name || "-",
            u.shift_name || "Open Shift",
            u.phone_no || "-",
            u.email || "-",
            u.joining_date ? String(u.joining_date).slice(0, 10) : (u.created_at ? String(u.created_at).slice(0, 10) : "-"),
            u.user_type || "employee",
            u.is_deleted ? "Deleted" : (u.is_active ? "Active" : "Inactive")
        ]);
        data.users = users.map(u => ({
            id: u.user_id,
            code: u.user_code || `EMP-${u.user_id}`,
            name: u.user_name,
            department: u.dept_name || "-",
            designation: u.desg_name || "-",
            shift: u.shift_name || "Open Shift",
            phone: u.phone_no || "-",
            email: u.email || "-",
            joiningDate: u.joining_date ? String(u.joining_date).slice(0, 10) : (u.created_at ? String(u.created_at).slice(0, 10) : "-"),
            role: u.user_type || "employee",
            status: u.is_deleted ? "Deleted" : (u.is_active ? "Active" : "Inactive"),
            is_active: Boolean(u.is_active),
            is_deleted: Boolean(u.is_deleted)
        }));
    }

    if (type !== "employee_master") {
        data.cardRecords = await getCardRecords({ org_id, targetUserId, startDate, endDate, dept_id, desg_id, shift_id });
    } else {
        data.cardRecords = [];
    }

    return data;
}
