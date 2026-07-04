import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { PayrollCalculationService } from './PayrollCalculationService.js';

export class PayrollFinalizationService {
    /**
     * Finalize payroll for a month. Runs calculations, inserts snapshots and freezes entries.
     * 
     * @param {number} orgId 
     * @param {number} year 
     * @param {number} month 
     * @param {number} finalizedBy 
     * @returns {Promise<Object>} The finalized payroll run
     */
    static async finalizePayroll(orgId, year, month, finalizedBy) {
        return await attendanceDB.transaction(async (trx) => {
            // Check if run already exists
            let existingRun = await trx('payroll_runs')
                .where({ org_id: orgId, year, month })
                .first();

            if (existingRun) {
                if (existingRun.status === 'Finalized' || existingRun.status === 'Paid') {
                    throw new AppError(`Payroll for ${year}-${String(month).padStart(2, '0')} has already been finalized/paid.`, 400);
                }
                
                // If it was Live, we clear old entries first
                await trx('payroll_entries')
                    .where('run_id', existingRun.run_id)
                    .del();
            }

            // Calculate payroll for all employees in real-time
            const calculatedRecords = await PayrollCalculationService.calculateProjectedPayroll(orgId, year, month);

            if (calculatedRecords.length === 0) {
                throw new AppError('No employees with active salary configurations were found to finalize.', 400);
            }

            let runId;
            if (existingRun) {
                runId = existingRun.run_id;
                await trx('payroll_runs')
                    .where('run_id', runId)
                    .update({
                        status: 'Finalized',
                        finalized_by: finalizedBy,
                        finalized_at: trx.fn.now(),
                        updated_at: trx.fn.now()
                    });
            } else {
                const [newRunId] = await trx('payroll_runs').insert({
                    org_id: orgId,
                    year,
                    month,
                    status: 'Finalized',
                    finalized_by: finalizedBy,
                    finalized_at: trx.fn.now()
                });
                runId = newRunId;
            }

            // Insert entries
            for (const record of calculatedRecords) {
                await trx('payroll_entries').insert({
                    run_id: runId,
                    employee_id: record.employee_id,
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
                    salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                    attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                    calculation_snapshot_json: JSON.stringify(record.calculation_snapshot)
                });
            }

            const finalizedRun = await trx('payroll_runs')
                .where('run_id', runId)
                .first();

            return finalizedRun;
        });
    }

    /**
     * Mark a finalized payroll run as Paid.
     * 
     * @param {number} runId 
     * @param {number} paidBy 
     * @returns {Promise<Object>} The updated payroll run
     */
    static async markAsPaid(runId, paidBy) {
        return await attendanceDB.transaction(async (trx) => {
            const run = await trx('payroll_runs')
                .where('run_id', runId)
                .first();

            if (!run) {
                throw new AppError('Payroll run not found.', 404);
            }

            if (run.status === 'Paid') {
                throw new AppError('Payroll has already been marked as paid.', 400);
            }

            if (run.status !== 'Finalized') {
                throw new AppError('Only finalized payroll runs can be marked as paid.', 400);
            }

            await trx('payroll_runs')
                .where('run_id', runId)
                .update({
                    status: 'Paid',
                    paid_by: paidBy,
                    paid_at: trx.fn.now(),
                    updated_at: trx.fn.now()
                });

            return await trx('payroll_runs')
                .where('run_id', runId)
                .first();
        });
    }

    /**
     * Get historical runs for an organization.
     * 
     * @param {number} orgId 
     * @returns {Promise<Array>} List of runs
     */
    static async getPayrollRuns(orgId) {
        return await attendanceDB('payroll_runs')
            .where('org_id', orgId)
            .orderBy('year', 'desc')
            .orderBy('month', 'desc');
    }

    /**
     * Get detailed entries inside a finalized/paid payroll run.
     * 
     * @param {number} runId 
     * @returns {Promise<Array>} List of payroll entries with employee details
     */
    static async getRunEntries(runId) {
        return await attendanceDB('payroll_entries as pe')
            .join('core_users as u', 'pe.employee_id', 'u.user_id')
            .select(
                'pe.*',
                'u.user_name',
                'u.user_code',
                'u.email',
                'u.profile_image_url'
            )
            .where('pe.run_id', runId)
            .orderBy('u.user_name', 'asc');
    }

    /**
     * Get a specific payroll run by details.
     */
    static async getRunByMonth(orgId, year, month) {
        return await attendanceDB('payroll_runs')
            .where({ org_id: orgId, year, month })
            .first();
    }

    /**
     * Finalize (lock) payroll for an individual employee.
     */
    static async finalizeEmployee(orgId, year, month, employeeId, finalizedBy) {
        return await attendanceDB.transaction(async (trx) => {
            // Ensure payroll run exists in Live status
            let run = await trx('payroll_runs')
                .where({ org_id: orgId, year, month })
                .first();

            if (!run) {
                const [newRunId] = await trx('payroll_runs').insert({
                    org_id: orgId,
                    year,
                    month,
                    status: 'Live'
                });
                run = await trx('payroll_runs').where('run_id', newRunId).first();
            } else if (run.status !== 'Live') {
                throw new AppError(`Cannot lock individual employee payroll. The entire payroll run for ${year}-${String(month).padStart(2, '0')} is already ${run.status.toLowerCase()}.`, 400);
            }

            // Check if entry already exists
            const existingEntry = await trx('payroll_entries')
                .where({ run_id: run.run_id, employee_id: employeeId })
                .first();

            if (existingEntry && existingEntry.status === 'Paid') {
                throw new AppError('This employee\'s payroll is already paid and locked.', 400);
            }

            // Get employee active salary config
            const activeSalaryDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const emp = await trx('core_users as u')
                .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
                .leftJoin('org_shifts as sh', 'u.shift_id', 'sh.shift_id')
                .leftJoin('payroll_packages as p', function() {
                    this.on('s.package_group_id', '=', 'p.package_group_id')
                        .andOn('p.effective_from', '<=', trx.raw('?', [activeSalaryDate]))
                        .andOn(function() {
                            this.onNull('p.effective_to')
                                .orOn('p.effective_to', '>=', trx.raw('?', [activeSalaryDate]));
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

            if (!emp) {
                throw new AppError('Employee has no active salary configuration for this period.', 400);
            }

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

            // Calculate payroll
            const record = await PayrollCalculationService.calculateEmployeePayroll(resolvedEmp, year, month, orgId);

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
                // Update
                await trx('payroll_entries')
                    .where({ run_id: run.run_id, employee_id: employeeId })
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
                        status: 'Finalized',
                        salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                        attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                        calculation_snapshot_json: JSON.stringify(record.calculation_snapshot),
                        updated_at: trx.fn.now()
                    });
            } else {
                // Insert
                await trx('payroll_entries').insert({
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
                    status: 'Finalized',
                    salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                    attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                    calculation_snapshot_json: JSON.stringify(record.calculation_snapshot)
                });
            }

            return await trx('payroll_entries')
                .where({ run_id: run.run_id, employee_id: employeeId })
                .first();
        });
    }

    /**
     * Mark payroll for an individual employee as Paid.
     */
    static async payEmployee(orgId, year, month, employeeId, paidBy) {
        return await attendanceDB.transaction(async (trx) => {
            // Ensure payroll run exists in Live status
            let run = await trx('payroll_runs')
                .where({ org_id: orgId, year, month })
                .first();

            if (!run) {
                const [newRunId] = await trx('payroll_runs').insert({
                    org_id: orgId,
                    year,
                    month,
                    status: 'Live'
                });
                run = await trx('payroll_runs').where('run_id', newRunId).first();
            } else if (run.status !== 'Live') {
                throw new AppError(`Cannot pay individual employee payroll. The entire payroll run for ${year}-${String(month).padStart(2, '0')} is already ${run.status.toLowerCase()}.`, 400);
            }

            const existingEntry = await trx('payroll_entries')
                .where({ run_id: run.run_id, employee_id: employeeId })
                .first();

            if (existingEntry) {
                if (existingEntry.status === 'Paid') {
                    throw new AppError('This employee\'s payroll is already marked as paid.', 400);
                }
                
                await trx('payroll_entries')
                    .where({ run_id: run.run_id, employee_id: employeeId })
                    .update({
                        status: 'Paid',
                        updated_at: trx.fn.now()
                    });
            } else {
                // If they haven't been locked yet, we run calculations and lock/pay them
                const activeSalaryDate = `${year}-${String(month).padStart(2, '0')}-01`;
                const emp = await trx('core_users as u')
                    .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
                    .leftJoin('org_shifts as sh', 'u.shift_id', 'sh.shift_id')
                    .leftJoin('payroll_packages as p', function() {
                        this.on('s.package_group_id', '=', 'p.package_group_id')
                            .andOn('p.effective_from', '<=', trx.raw('?', [activeSalaryDate]))
                            .andOn(function() {
                                this.onNull('p.effective_to')
                                    .orOn('p.effective_to', '>=', trx.raw('?', [activeSalaryDate]));
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

                if (!emp) {
                    throw new AppError('Employee has no active salary configuration for this period.', 400);
                }

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

                const record = await PayrollCalculationService.calculateEmployeePayroll(resolvedEmp, year, month, orgId);

                await trx('payroll_entries').insert({
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
                    status: 'Paid',
                    salary_snapshot_json: JSON.stringify(record.salary_snapshot),
                    attendance_snapshot_json: JSON.stringify(record.attendance_snapshot),
                    calculation_snapshot_json: JSON.stringify(record.calculation_snapshot)
                });
            }

            return await trx('payroll_entries')
                .where({ run_id: run.run_id, employee_id: employeeId })
                .first();
        });
    }

}
