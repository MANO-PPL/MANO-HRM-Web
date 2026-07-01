import { attendanceDB } from '../../config/database.js';
import { getDayType, getShiftRules } from '../attendance/shiftManagementService.js';
import { SalaryHistoryService } from './SalaryHistoryService.js';

export class PayrollCalculationService {
    /**
     * Calculate realtime salary projection for all eligible employees in an organization for a given month and year.
     * 
     * @param {number} orgId 
     * @param {number} year 
     * @param {number} month 
     * @returns {Promise<Array<Object>>} List of calculated employee payroll records
     */
    static async calculateProjectedPayroll(orgId, year, month) {
        const activeSalaryDate = `${year}-${String(month).padStart(2, '0')}-01`;
        
        // Fetch employees who have a salary configuration for this month
        const employees = await attendanceDB('users as u')
            .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
            .leftJoin('shifts as sh', 'u.shift_id', 'sh.shift_id')
            .leftJoin('payroll_packages as p', function() {
                this.on('s.package_group_id', '=', 'p.package_group_id')
                    .andOn('p.effective_from', '<=', attendanceDB.raw('?', [activeSalaryDate]))
                    .andOn(function() {
                        this.onNull('p.effective_to')
                            .orOn('p.effective_to', '>=', attendanceDB.raw('?', [activeSalaryDate]));
                    });
            })
            .where('u.org_id', orgId)
            .where('u.is_deleted', 0)
            .where('s.effective_from', '<=', activeSalaryDate)
            .andWhere(function() {
                this.whereNull('s.effective_to')
                    .orWhere('s.effective_to', '>=', activeSalaryDate);
            })
            .select(
                'u.user_id',
                'u.user_name',
                'u.email',
                'sh.policy_rules',
                's.salary_history_id',
                's.package_group_id',
                's.gross_monthly_salary as history_gross_salary',
                's.overtime_enabled as history_ot_enabled',
                's.overtime_rate as history_ot_rate',
                'p.gross_salary as package_gross_salary',
                'p.overtime_enabled as package_overtime_enabled',
                'p.overtime_rate as package_overtime_rate'
            );

        const results = [];
        for (const emp of employees) {
            const resolvedEmp = {
                ...emp,
                gross_monthly_salary: emp.package_group_id !== null && emp.package_gross_salary !== null
                    ? Number(emp.package_gross_salary)
                    : Number(emp.history_gross_salary),
                employee_ot_enabled: emp.package_group_id !== null && emp.package_overtime_enabled !== null
                    ? emp.package_overtime_enabled === 1
                    : emp.history_ot_enabled === 1,
                overtime_rate: emp.package_group_id !== null && emp.package_overtime_rate !== null
                    ? Number(emp.package_overtime_rate)
                    : Number(emp.history_ot_rate)
            };
            const calculation = await this.calculateEmployeePayroll(resolvedEmp, year, month, orgId);
            results.push({
                employee_id: emp.user_id,
                user_name: emp.user_name,
                email: emp.email,
                ...calculation
            });
        }
        return results;
    }

    /**
     * Calculate projected payroll for a single employee.
     * 
     * @param {Object} emp - Employee db object with policy_rules and active salary
     * @param {number} year 
     * @param {number} month 
     * @param {number} orgId 
     * @returns {Promise<Object>} Calculated payroll record
     */
    static async calculateEmployeePayroll(emp, year, month, orgId) {
        const totalDays = new Date(year, month, 0).getDate();
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

        // Get organization settings
        const settings = await attendanceDB('payroll_settings')
            .where('org_id', orgId)
            .first();
        const orgOtEnabled = settings ? settings.overtime_enabled === 1 : false;

        // Fetch attendance logs
        const attendanceRecords = await attendanceDB('daily_attendance')
            .where('user_id', emp.user_id)
            .whereBetween('date', [startDateStr, endDateStr]);

        const attendanceMap = new Map();
        for (const rec of attendanceRecords) {
            const dateStr = rec.date instanceof Date 
                ? rec.date.toISOString().split('T')[0] 
                : String(rec.date).split('T')[0];
            attendanceMap.set(dateStr, rec);
        }

        // Fetch approved leaves
        const leaves = await attendanceDB('leave_request')
            .where('user_id', emp.user_id)
            .where('status', 'Approved')
            .where('start_date', '<=', endDateStr)
            .where('end_date', '>=', startDateStr);

        // Fetch holidays
        const holidays = await attendanceDB('holidays')
            .where('org_id', orgId)
            .whereBetween('holiday_date', [startDateStr, endDateStr]);

        const holidayDates = new Set(holidays.map(h => {
            const d = h.holiday_date instanceof Date 
                ? h.holiday_date.toISOString().split('T')[0] 
                : String(h.holiday_date).split('T')[0];
            return d;
        }));

        let present_days = 0;
        let half_days = 0;
        let absent_days = 0;
        let paid_leave_days = 0;
        let holiday_days = 0;
        let weekly_off_days = 0;
        let overtime_hours = 0;
        let lop_days = 0;

        const factorPresent = settings && settings.lop_factor_present !== undefined ? Number(settings.lop_factor_present) : 1.0;
        const factorHalfDay = settings && settings.lop_factor_half_day !== undefined ? Number(settings.lop_factor_half_day) : 0.5;
        const factorAbsent = settings && settings.lop_factor_absent !== undefined ? Number(settings.lop_factor_absent) : 0.0;

        const shiftRules = getShiftRules({ policy_rules: emp.policy_rules });
        const weekOffPolicy = shiftRules.week_off_policy;

        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localToday = new Date(today.getTime() - (offset * 60 * 1000));
        const todayStr = localToday.toISOString().split('T')[0];

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const isRunningMonth = (year > currentYear) || (year === currentYear && month >= currentMonth);

        // Loop through each calendar day of the month
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isFutureOrToday = dateStr >= todayStr;

            const record = attendanceMap.get(dateStr);
            const isHoliday = holidayDates.has(dateStr);
            
            // Check for leave covering this date
            const matchingLeave = leaves.find(l => {
                const start = l.start_date instanceof Date ? l.start_date.toISOString().split('T')[0] : String(l.start_date).split('T')[0];
                const end = l.end_date instanceof Date ? l.end_date.toISOString().split('T')[0] : String(l.end_date).split('T')[0];
                return dateStr >= start && dateStr <= end;
            });

            // Determine if week off
            const dayType = getDayType(dateStr, weekOffPolicy);
            const isWeekOff = dayType === 'week_off';

            if (record) {
                const status = String(record.status).toUpperCase();
                
                if (status === 'PRESENT' || status === 'LATE' || status === 'OVERTIME') {
                    present_days += 1;
                    if (record.overtime_hours && Number(record.overtime_hours) > 0) {
                        overtime_hours += Number(record.overtime_hours);
                    }
                    lop_days += Math.max(0, 1.0 - factorPresent);
                } else if (status === 'HALF_DAY' || status === 'HALF DAY') {
                    half_days += 1;
                    lop_days += Math.max(0, 1.0 - factorHalfDay);
                } else if (status === 'ABSENT' || status === 'MISSED_PUNCH') {
                    absent_days += 1;
                    lop_days += Math.max(0, 1.0 - factorAbsent);
                } else if (status === 'LEAVE' || status === 'ON_LEAVE') {
                    if (matchingLeave) {
                        const payType = matchingLeave.pay_type || 'Paid';
                        const percentage = matchingLeave.pay_percentage !== undefined ? matchingLeave.pay_percentage : 100;
                        if (payType === 'Paid') {
                            paid_leave_days += 1;
                        } else if (payType === 'Unpaid') {
                            lop_days += 1;
                        } else { // Partial
                            paid_leave_days += (percentage / 100);
                            lop_days += ((100 - percentage) / 100);
                        }
                    } else {
                        paid_leave_days += 1;
                    }
                } else if (status === 'HOLIDAY') {
                    holiday_days += 1;
                } else if (status === 'WEEK_OFF' || status === 'WEEKEND') {
                    weekly_off_days += 1;
                } else {
                    present_days += 1; // Default fallback
                    lop_days += Math.max(0, 1.0 - factorPresent);
                }
            } else {
                // No record exists
                if (isHoliday) {
                    holiday_days += 1;
                } else if (isWeekOff) {
                    weekly_off_days += 1;
                } else if (matchingLeave) {
                    const payType = matchingLeave.pay_type || 'Paid';
                    const percentage = matchingLeave.pay_percentage !== undefined ? matchingLeave.pay_percentage : 100;
                    if (payType === 'Paid') {
                        paid_leave_days += 1;
                    } else if (payType === 'Unpaid') {
                        lop_days += 1;
                    } else { // Partial
                        paid_leave_days += (percentage / 100);
                        lop_days += ((100 - percentage) / 100);
                    }
                } else if (isFutureOrToday) {
                    // Today or future day: leave empty, do not count as present or absent/lop
                } else {
                    // Past working day with no punches: Absent
                    absent_days += 1;
                    lop_days += Math.max(0, 1.0 - factorAbsent);
                }
            }
        }

        // Apply calculations
        const gross_salary = Number(emp.gross_monthly_salary);
        
        // Resolve dynamic daily rate based on policy
        const lopMethod = settings?.lop_calculation_method || 'calendar_days';
        const fixedDaysVal = Number(settings?.lop_fixed_days_value || 30);
        
        let daily_rate = 0;
        let lop_method_label = 'calendar_days';
        
        if (lopMethod === 'calendar_days') {
            daily_rate = Number((gross_salary / totalDays).toFixed(4));
            lop_method_label = 'calendar_days';
        } else if (lopMethod === 'fixed_days') {
            daily_rate = Number((gross_salary / fixedDaysVal).toFixed(4));
            lop_method_label = 'fixed_days';
        } else if (lopMethod === 'working_days') {
            // Expected working days = total calendar days in month minus weekly offs and organization holidays
            const totalWorkingDays = totalDays - weekly_off_days - holiday_days;
            daily_rate = totalWorkingDays > 0 
                ? Number((gross_salary / totalWorkingDays).toFixed(4))
                : Number((gross_salary / totalDays).toFixed(4));
            lop_method_label = 'working_days';
        }

        const lop_deduction = Number((lop_days * daily_rate).toFixed(2));

        // Overtime rate
        let overtime_amount = 0.00;
        const isOtApplicable = orgOtEnabled && emp.employee_ot_enabled === 1;
        if (isOtApplicable && overtime_hours > 0) {
            const ot_rate = Number(emp.overtime_rate || 0);
            overtime_amount = Number((overtime_hours * ot_rate).toFixed(2));
        }

        const net_salary = Number((gross_salary - lop_deduction + overtime_amount).toFixed(2));

        return {
            is_running_month: isRunningMonth,
            gross_salary,
            present_days: parseFloat(present_days.toFixed(2)),
            half_days: parseFloat(half_days.toFixed(2)),
            absent_days: parseFloat(absent_days.toFixed(2)),
            paid_leave_days: parseFloat(paid_leave_days.toFixed(2)),
            holiday_days: parseFloat(holiday_days.toFixed(2)),
            weekly_off_days: parseFloat(weekly_off_days.toFixed(2)),
            overtime_hours: parseFloat(overtime_hours.toFixed(2)),
            overtime_amount,
            lop_days: parseFloat(lop_days.toFixed(2)),
            lop_deduction,
            net_salary,
            salary_snapshot: {
                salary_history_id: emp.salary_history_id,
                gross_monthly_salary: gross_salary,
                overtime_enabled: emp.employee_ot_enabled,
                overtime_rate: emp.overtime_rate
            },
            attendance_snapshot: {
                present_days,
                half_days,
                absent_days,
                paid_leave_days,
                holiday_days,
                weekly_off_days,
                overtime_hours,
                lop_days
            },
            calculation_snapshot: {
                calendar_days: totalDays,
                daily_rate,
                lop_deduction,
                overtime_amount,
                net_salary,
                lop_method: lop_method_label,
                overtime_enabled: isOtApplicable
            }
        };
    }

    /**
     * Recalculate and update the cached Draft entry for a single employee.
     * Does nothing if the entry is already Finalized or Paid.
     */
    static async updateDraftEntry(orgId, year, month, employeeId) {
        try {
            // Find or create payroll run in Live status
            let run = await attendanceDB('payroll_runs')
                .where({ org_id: orgId, year, month })
                .first();

            if (!run) {
                const [newRunId] = await attendanceDB('payroll_runs').insert({
                    org_id: orgId,
                    year,
                    month,
                    status: 'Live'
                });
                run = await attendanceDB('payroll_runs').where('run_id', newRunId).first();
            }

            // Check if entry exists and is already frozen
            const existingEntry = await attendanceDB('payroll_entries')
                .where({ run_id: run.run_id, employee_id: employeeId })
                .first();

            if (existingEntry && existingEntry.status !== 'Draft') {
                return; // Do not overwrite finalized or paid entries
            }

            // Get active salary config for employee
            const activeSalaryDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const emp = await attendanceDB('users as u')
                .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
                .leftJoin('shifts as sh', 'u.shift_id', 'sh.shift_id')
                .leftJoin('payroll_packages as p', function() {
                    this.on('s.package_group_id', '=', 'p.package_group_id')
                        .andOn('p.effective_from', '<=', attendanceDB.raw('?', [activeSalaryDate]))
                        .andOn(function() {
                            this.onNull('p.effective_to')
                                .orOn('p.effective_to', '>=', attendanceDB.raw('?', [activeSalaryDate]));
                        });
                })
                .where('u.user_id', employeeId)
                .where('s.effective_from', '<=', activeSalaryDate)
                .andWhere(function() {
                    this.whereNull('s.effective_to')
                        .orWhere('s.effective_to', '>=', activeSalaryDate);
                })
                .select(
                    'u.user_id',
                    'u.user_name',
                    'u.email',
                    'sh.policy_rules',
                    's.salary_history_id',
                    's.package_group_id',
                    's.gross_monthly_salary as history_gross_salary',
                    's.overtime_enabled as history_ot_enabled',
                    's.overtime_rate as history_ot_rate',
                    'p.gross_salary as package_gross_salary',
                    'p.overtime_enabled as package_overtime_enabled',
                    'p.overtime_rate as package_overtime_rate'
                )
                .first();

            if (!emp) return; // No active salary configuration

            const resolvedEmp = {
                ...emp,
                gross_monthly_salary: emp.package_group_id !== null && emp.package_gross_salary !== null
                    ? Number(emp.package_gross_salary)
                    : Number(emp.history_gross_salary),
                employee_ot_enabled: emp.package_group_id !== null && emp.package_overtime_enabled !== null
                    ? emp.package_overtime_enabled === 1
                    : emp.history_ot_enabled === 1,
                overtime_rate: emp.package_group_id !== null && emp.package_overtime_rate !== null
                    ? Number(emp.package_overtime_rate)
                    : Number(emp.history_ot_rate)
            };

            const record = await this.calculateEmployeePayroll(resolvedEmp, year, month, orgId);

            let finalNetSalary = record.net_salary;
            let adjustments = [];
            if (existingEntry && existingEntry.adjustments_json) {
                adjustments = typeof existingEntry.adjustments_json === 'string'
                    ? JSON.parse(existingEntry.adjustments_json)
                    : existingEntry.adjustments_json;
                
                const additionsSum = adjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + Number(a.amount), 0);
                const deductionsSum = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + Number(a.amount), 0);
                finalNetSalary = Number((finalNetSalary + additionsSum - deductionsSum).toFixed(2));
            }

            if (existingEntry) {
                await attendanceDB('payroll_entries')
                    .where({ entry_id: existingEntry.entry_id })
                    .update({
                        gross_salary: record.gross_salary,
                        present_days: record.present_days,
                        half_days: record.half_days,
                        absent_days: record.absent_days,
                        paid_leave_days: record.paid_leave_days,
                        holiday_days: record.holiday_days,
                        weekly_off_days: record.weekly_off_days,
                        overtime_hours: record.overtime_hours,
                        overtime_amount: record.overtime_amount,
                        lop_days: record.lop_days,
                        lop_deduction: record.lop_deduction,
                        net_salary: finalNetSalary,
                        salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                        attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                        calculation_snapshot_json: JSON.stringify(record.calculation_snapshot),
                        updated_at: attendanceDB.fn.now()
                    });
            } else {
                await attendanceDB('payroll_entries').insert({
                    run_id: run.run_id,
                    employee_id: employeeId,
                    gross_salary: record.gross_salary,
                    present_days: record.present_days,
                    half_days: record.half_days,
                    absent_days: record.absent_days,
                    paid_leave_days: record.paid_leave_days,
                    holiday_days: record.holiday_days,
                    weekly_off_days: record.weekly_off_days,
                    overtime_hours: record.overtime_hours,
                    overtime_amount: record.overtime_amount,
                    lop_days: record.lop_days,
                    lop_deduction: record.lop_deduction,
                    net_salary: record.net_salary,
                    status: 'Draft',
                    salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                    attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                    calculation_snapshot_json: JSON.stringify(record.calculation_snapshot)
                });
            }
        } catch (err) {
            console.error(`Failed to update draft payroll entry for employee ${employeeId}:`, err);
        }
    }

    /**
     * Recalculate and update the cached Draft entries for all employees in an organization.
     */
    static async updateDraftEntriesForOrg(orgId, year, month) {
        try {
            const activeSalaryDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const employees = await attendanceDB('users as u')
                .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
                .where('u.org_id', orgId)
                .where('u.is_deleted', 0)
                .where('s.effective_from', '<=', activeSalaryDate)
                .andWhere(function() {
                    this.whereNull('s.effective_to')
                        .orWhere('s.effective_to', '>=', activeSalaryDate);
                })
                .select('u.user_id');

            for (const emp of employees) {
                await this.updateDraftEntry(orgId, year, month, emp.user_id);
            }
        } catch (err) {
            console.error(`Failed to update draft payroll entries for org ${orgId}:`, err);
        }
    }

    /**
     * Trigger payroll recalculation for a user and date.
     * Runs in the background.
     */
    static async triggerRecalculation(userId, dateStr) {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            const user = await attendanceDB('users').where('user_id', userId).select('org_id').first();
            if (user) {
                this.updateDraftEntry(user.org_id, year, month, userId).catch(err => {
                    console.error("Background payroll calculation failed:", err);
                });
            }
        } catch (e) {
            console.error("Error triggering payroll recalculation:", e);
        }
    }

    /**
     * Trigger payroll recalculation for a leave request.
     * Recalculates all months between start_date and end_date.
     */
    static async triggerLeaveRecalculation(leaveRequest) {
        try {
            const start = new Date(leaveRequest.start_date);
            const end = new Date(leaveRequest.end_date);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

            const userId = leaveRequest.user_id;
            const orgId = leaveRequest.org_id;

            let current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                const year = current.getFullYear();
                const month = current.getMonth() + 1;
                
                this.updateDraftEntry(orgId, year, month, userId).catch(err => {
                    console.error("Background leave payroll calculation failed:", err);
                });

                current.setMonth(current.getMonth() + 1);
            }
        } catch (e) {
            console.error("Error triggering leave payroll recalculation:", e);
        }
    }
}
