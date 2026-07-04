import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { SalaryHistoryService } from '../../services/payroll/SalaryHistoryService.js';
import { PayrollCalculationService } from '../../services/payroll/PayrollCalculationService.js';
import { PayrollFinalizationService } from '../../services/payroll/PayrollFinalizationService.js';
import { PayslipService } from '../../services/payroll/PayslipService.js';
import { PackageService } from '../../services/payroll/PackageService.js';

/**
 * Controller to handle payroll operations.
 */
export const getEmployeeSalary = catchAsync(async (req, res, next) => {
    const employeeId = Number(req.params.id);
    const activeSalary = await SalaryHistoryService.getActiveSalary(employeeId, new Date());
    
    res.status(200).json({
        status: 'success',
        data: activeSalary
    });
});

export const getEmployeeSalaryHistory = catchAsync(async (req, res, next) => {
    const employeeId = Number(req.params.id);
    const history = await SalaryHistoryService.getSalaryHistory(employeeId);
    
    res.status(200).json({
        status: 'success',
        data: history
    });
});

export const updateEmployeeSalary = catchAsync(async (req, res, next) => {
    const employeeId = Number(req.params.id);
    const { grossMonthlySalary, overtimeEnabled, overtimeRate, effectiveFrom } = req.body;
    const orgId = req.user.org_id;
    const createdBy = req.user.id;

    if (!grossMonthlySalary || Number(grossMonthlySalary) <= 0) {
        return next(new AppError('Gross monthly salary must be a positive number.', 400));
    }
    if (!effectiveFrom) {
        return next(new AppError('Effective From date is required.', 400));
    }

    // Auto-create setting for the org if not exists
    const existingSettings = await attendanceDB('payroll_settings').where('org_id', orgId).first();
    if (!existingSettings) {
        await attendanceDB('payroll_settings').insert({
            org_id: orgId,
            overtime_enabled: 1,
            overtime_requires_approval: 0
        });
    }

    const newSalary = await SalaryHistoryService.createSalaryRevision({
        orgId,
        employeeId,
        grossMonthlySalary: Number(grossMonthlySalary),
        overtimeEnabled: overtimeEnabled ? 1 : 0,
        overtimeRate: Number(overtimeRate || 0.00),
        effectiveFrom,
        createdBy
    });

    // Recalculate cached payroll entries for the affected month in the background
    try {
        const parts = effectiveFrom.split('-');
        const year = Number(parts[0]);
        const monthNum = Number(parts[1]);
        PayrollCalculationService.updateDraftEntry(orgId, year, monthNum, employeeId).catch(err => {
            console.error("Failed to update draft payroll after salary revision:", err);
        });
    } catch (e) {
        console.error("Failed to trigger background payroll calculation for salary revision:", e);
    }

    res.status(200).json({
        status: 'success',
        message: 'Salary revision saved successfully.',
        data: newSalary
    });
});

export const getPayrollDashboard = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { month } = req.query; // YYYY-MM
    
    let year, monthNum;
    if (month) {
        const parts = month.split('-');
        year = Number(parts[0]);
        monthNum = Number(parts[1]);
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthNum = now.getMonth() + 1;
    }

    if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return next(new AppError('Invalid month or year parameter.', 400));
    }

    // Seed payroll settings if they don't exist
    const settings = await attendanceDB('payroll_settings').where('org_id', orgId).first();
    if (!settings) {
        await attendanceDB('payroll_settings').insert({
            org_id: orgId,
            overtime_enabled: 1,
            overtime_requires_approval: 0
        });
    }

    // Check if payroll run is finalized/paid
    const run = await PayrollFinalizationService.getRunByMonth(orgId, year, monthNum);

    if (run && run.status !== 'Live') {
        const entries = await PayrollFinalizationService.getRunEntries(run.run_id);
        return res.status(200).json({
            status: 'success',
            isFinalized: true,
            run,
            data: entries.map(e => ({ ...e, status: e.status || run.status }))
        });
    }

    // Ensure payroll run exists in Live status for caching
    let activeRun = run;
    if (!activeRun) {
        const [newRunId] = await attendanceDB('payroll_runs').insert({
            org_id: orgId,
            year,
            month: monthNum,
            status: 'Live'
        });
        activeRun = await attendanceDB('payroll_runs').where('run_id', newRunId).first();
    }

    // Get all eligible employees for this month
    const activeSalaryDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const employees = await attendanceDB('core_users as u')
        .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
        .leftJoin('org_shifts as sh', 'u.shift_id', 'sh.shift_id')
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
            's.gross_monthly_salary',
            's.overtime_enabled as employee_ot_enabled',
            's.overtime_rate'
        );

    // Fetch existing entries from database
    const existingEntries = await PayrollFinalizationService.getRunEntries(activeRun.run_id);
    const entriesMap = new Map(existingEntries.map(e => [e.employee_id, e]));

    const mergedData = [];
    for (const emp of employees) {
        if (entriesMap.has(emp.user_id)) {
            const entry = entriesMap.get(emp.user_id);
            mergedData.push({
                employee_id: emp.user_id,
                user_name: emp.user_name,
                email: emp.email,
                ...entry,
                status: entry.status || 'Draft'
            });
        } else {
            // Lazy load / calculate on-the-fly and cache it in the database
            const record = await PayrollCalculationService.calculateEmployeePayroll(emp, year, monthNum, orgId);
            
            await attendanceDB('payroll_entries').insert({
                run_id: activeRun.run_id,
                employee_id: emp.user_id,
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

            const insertedEntry = await attendanceDB('payroll_entries')
                .where({ run_id: activeRun.run_id, employee_id: emp.user_id })
                .first();

            mergedData.push({
                employee_id: emp.user_id,
                user_name: emp.user_name,
                email: emp.email,
                ...insertedEntry,
                status: 'Draft'
            });
        }
    }

    res.status(200).json({
        status: 'success',
        isFinalized: false,
        run: activeRun,
        data: mergedData
    });
});

export const getEmployeeProjectedDetails = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const employeeId = Number(req.params.employeeId);
    const { month } = req.query; // YYYY-MM
    
    let year, monthNum;
    if (month) {
        const parts = month.split('-');
        year = Number(parts[0]);
        monthNum = Number(parts[1]);
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthNum = now.getMonth() + 1;
    }

    // Check if finalized/locked or draft-cached
    const run = await PayrollFinalizationService.getRunByMonth(orgId, year, monthNum);
    let entry = null;
    if (run) {
        entry = await attendanceDB('payroll_entries')
            .where({ run_id: run.run_id, employee_id: employeeId })
            .first();
    }

    if (entry) {
        return res.status(200).json({
            status: 'success',
            isFinalized: entry.status !== 'Draft',
            data: {
                ...entry,
                status: entry.status || 'Draft',
                salary_snapshot: typeof entry.salary_snapshot_json === 'string' ? JSON.parse(entry.salary_snapshot_json) : entry.salary_snapshot_json,
                attendance_snapshot: typeof entry.attendance_snapshot_json === 'string' ? JSON.parse(entry.attendance_snapshot_json) : entry.attendance_snapshot_json,
                calculation_snapshot: typeof entry.calculation_snapshot_json === 'string' ? JSON.parse(entry.calculation_snapshot_json) : entry.calculation_snapshot_json
            }
        });
    }

    // Realtime projection (fallback if no run or entry was seeded/precalculated)
    const activeSalaryDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const emp = await attendanceDB('core_users as u')
        .join('payroll_salary_history as s', 'u.user_id', 's.employee_id')
        .leftJoin('org_shifts as sh', 'u.shift_id', 'sh.shift_id')
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
            's.gross_monthly_salary',
            's.overtime_enabled as employee_ot_enabled',
            's.overtime_rate'
        )
        .first();

    if (!emp) {
        return next(new AppError('Employee has no active salary configuration for this period.', 400));
    }

    const calc = await PayrollCalculationService.calculateEmployeePayroll(emp, year, monthNum, orgId);
    res.status(200).json({
        status: 'success',
        isFinalized: false,
        data: {
            employee_id: emp.user_id,
            user_name: emp.user_name,
            ...calc
        }
    });
});

export const finalizePayrollRun = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { month } = req.body; // YYYY-MM
    const finalizedBy = req.user.id;

    if (!month) {
        return next(new AppError('Month parameter is required (format: YYYY-MM).', 400));
    }

    const parts = month.split('-');
    const year = Number(parts[0]);
    const monthNum = Number(parts[1]);

    const run = await PayrollFinalizationService.finalizePayroll(orgId, year, monthNum, finalizedBy);
    
    res.status(200).json({
        status: 'success',
        message: 'Payroll finalized successfully.',
        data: run
    });
});

export const getPayrollRuns = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const runs = await PayrollFinalizationService.getPayrollRuns(orgId);
    
    res.status(200).json({
        status: 'success',
        data: runs
    });
});

export const getPayrollRunDetails = catchAsync(async (req, res, next) => {
    const runId = Number(req.params.runId);
    const entries = await PayrollFinalizationService.getRunEntries(runId);
    
    res.status(200).json({
        status: 'success',
        data: entries
    });
});

export const markPayrollRunAsPaid = catchAsync(async (req, res, next) => {
    const runId = Number(req.params.runId);
    const paidBy = req.user.id;

    const run = await PayrollFinalizationService.markAsPaid(runId, paidBy);

    res.status(200).json({
        status: 'success',
        message: 'Payroll run status updated to Paid.',
        data: run
    });
});

export const getPayslip = catchAsync(async (req, res, next) => {
    const entryId = Number(req.params.entryId);

    // Security check: regular employee should only access their own payslip
    if (req.user.user_type === 'employee') {
        const entry = await attendanceDB('payroll_entries')
            .where('entry_id', entryId)
            .first();
        if (!entry || entry.employee_id !== req.user.id) {
            return next(new AppError('You do not have permission to view this payslip.', 403));
        }
    }

    const pdfBuffer = await PayslipService.generatePayslipPDF(entryId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${entryId}.pdf`);
    res.send(pdfBuffer);
});

export const finalizeEmployeePayroll = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const employeeId = Number(req.params.employeeId);
    const { month } = req.body; // YYYY-MM
    const finalizedBy = req.user.id;

    if (!month) {
        return next(new AppError('Month parameter is required (format: YYYY-MM).', 400));
    }

    const parts = month.split('-');
    const year = Number(parts[0]);
    const monthNum = Number(parts[1]);

    const entry = await PayrollFinalizationService.finalizeEmployee(orgId, year, monthNum, employeeId, finalizedBy);

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', employeeId).first();
        const performer = await attendanceDB('core_users').where('user_id', finalizedBy).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'LOCK',
            employee_id: employeeId,
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: month,
            performed_by: finalizedBy,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Locked payroll. Net salary: ₹${entry.net_salary || 0}`
        });
    } catch (auditErr) {
        console.error('Audit logger failed:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Employee payroll locked successfully.',
        data: entry
    });
});

export const payEmployeePayroll = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const employeeId = Number(req.params.employeeId);
    const { month } = req.body; // YYYY-MM
    const paidBy = req.user.id;

    if (!month) {
        return next(new AppError('Month parameter is required (format: YYYY-MM).', 400));
    }

    const parts = month.split('-');
    const year = Number(parts[0]);
    const monthNum = Number(parts[1]);

    const entry = await PayrollFinalizationService.payEmployee(orgId, year, monthNum, employeeId, paidBy);

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', employeeId).first();
        const performer = await attendanceDB('core_users').where('user_id', paidBy).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PAY',
            employee_id: employeeId,
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: month,
            performed_by: paidBy,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Disbursed and paid salary: ₹${entry.net_salary || 0}`
        });
    } catch (auditErr) {
        console.error('Audit logger failed:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Employee payroll marked as Paid.',
        data: entry
    });
});

export const updateEntryAdjustments = catchAsync(async (req, res, next) => {
    const entryId = Number(req.params.entryId);
    const orgId = req.user.org_id;
    const { adjustments } = req.body; // Array of adjustments: [ { type, label, amount, reason } ]
    const adderName = req.user.user_name || 'Admin';

    if (!Array.isArray(adjustments)) {
        return next(new AppError('Adjustments must be an array.', 400));
    }

    // Validate adjustments
    for (const adj of adjustments) {
        if (!adj.type || !['addition', 'deduction'].includes(adj.type)) {
            return next(new AppError('Each adjustment must have a type of "addition" or "deduction".', 400));
        }
        if (!adj.label || typeof adj.label !== 'string' || adj.label.trim() === '') {
            return next(new AppError('Each adjustment must have a valid label.', 400));
        }
        const amount = Number(adj.amount);
        if (isNaN(amount) || amount <= 0) {
            return next(new AppError('Adjustment amount must be a positive number.', 400));
        }
        if (!adj.reason || typeof adj.reason !== 'string' || adj.reason.trim() === '') {
            return next(new AppError('Each adjustment must have a valid reason.', 400));
        }
    }

    const entry = await attendanceDB('payroll_entries as pe')
        .join('payroll_runs as pr', 'pe.run_id', 'pr.run_id')
        .where({ 'pe.entry_id': entryId, 'pr.org_id': orgId })
        .select('pe.*')
        .first();

    if (!entry) {
        return next(new AppError('Payroll entry not found.', 404));
    }

    if (entry.status !== 'Draft') {
        return next(new AppError('Adjustments can only be updated for draft entries.', 400));
    }

    // Map new and stamp with audit info
    const stampedAdjustments = adjustments.map(adj => ({
        id: adj.id || `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: adj.type,
        label: adj.label.trim(),
        amount: Number(Number(adj.amount).toFixed(2)),
        reason: adj.reason.trim(),
        added_by: adj.added_by || adderName,
        added_at: adj.added_at || new Date().toISOString()
    }));

    // Calculate adjusted net salary
    const baseNetSalary = Number(entry.gross_salary) - Number(entry.lop_deduction) + Number(entry.overtime_amount);

    const additionsSum = stampedAdjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + a.amount, 0);
    const deductionsSum = stampedAdjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + a.amount, 0);
    
    const finalNetSalary = Number((baseNetSalary + additionsSum - deductionsSum).toFixed(2));

    await attendanceDB('payroll_entries')
        .where({ entry_id: entryId })
        .update({
            adjustments_json: JSON.stringify(stampedAdjustments),
            net_salary: finalNetSalary,
            updated_at: attendanceDB.fn.now()
        });

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', entry.employee_id).first();
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        const run = await attendanceDB('payroll_runs').where('run_id', entry.run_id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'ADJUSTMENT_UPDATE',
            employee_id: entry.employee_id,
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: run ? `${run.year}-${String(run.month).padStart(2, '0')}` : '2026-06',
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Updated manual adjustments. Additions: +₹${additionsSum}, Deductions: -₹${deductionsSum}. Net: ₹${finalNetSalary}`
        });
    } catch (auditErr) {
        console.error('Audit logger failed:', auditErr);
    }

    const updatedEntry = await attendanceDB('payroll_entries').where({ entry_id: entryId }).first();

    res.status(200).json({
        status: 'success',
        message: 'Adjustments updated successfully.',
        data: {
            ...updatedEntry,
            adjustments: stampedAdjustments
        }
    });
});

export const getPackageGroups = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const packages = await PackageService.getPackageGroups(orgId);
    res.status(200).json({
        status: 'success',
        data: packages
    });
});

export const createPackageGroup = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { packageName, grossSalary, overtimeEnabled, overtimeRate, effectiveFrom } = req.body;
    const newGroup = await PackageService.createPackageGroup({
        orgId,
        packageName,
        grossSalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom
    });

    // Write audit log
    try {
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_CREATE',
            employee_id: null,
            employee_name: null,
            month: effectiveFrom ? effectiveFrom.substring(0, 7) : null,
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Created package group "${packageName}" with gross salary ₹${Number(grossSalary).toLocaleString()} and overtime ${overtimeEnabled ? `enabled at ₹${overtimeRate}/hr` : 'disabled'}.`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package creation:', auditErr);
    }

    res.status(201).json({
        status: 'success',
        data: newGroup
    });
});

export const getPackageRevisions = catchAsync(async (req, res, next) => {
    const { packageGroupId } = req.params;
    const revisions = await PackageService.getPackageRevisions(Number(packageGroupId));
    res.status(200).json({
        status: 'success',
        data: revisions
    });
});

export const createPackageRevision = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { packageGroupId } = req.params;
    const { grossSalary, overtimeEnabled, overtimeRate, effectiveFrom } = req.body;
    const newRevision = await PackageService.createPackageRevision({
        orgId,
        packageGroupId: Number(packageGroupId),
        grossSalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom
    });

    // Write audit log
    try {
        const pGroup = await attendanceDB('payroll_package_groups').where('package_group_id', packageGroupId).first();
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_REVISION_CREATE',
            employee_id: null,
            employee_name: null,
            month: effectiveFrom ? effectiveFrom.substring(0, 7) : null,
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Added new rate revision for package "${pGroup ? pGroup.package_name : packageGroupId}" starting ${effectiveFrom}: Gross Salary ₹${Number(grossSalary).toLocaleString()}, Overtime ${overtimeEnabled ? `enabled at ₹${overtimeRate}/hr` : 'disabled'}.`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package revision:', auditErr);
    }

    res.status(201).json({
        status: 'success',
        data: newRevision
    });
});

export const updatePackageGroup = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { packageGroupId } = req.params;
    const { packageName, isActive, grossSalary, overtimeEnabled, overtimeRate, effectiveFrom } = req.body;
    const updated = await PackageService.updatePackageGroup(Number(packageGroupId), orgId, {
        packageName,
        isActive,
        grossSalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom
    });

    // Write audit log
    try {
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        const updatedFields = [];
        if (packageName !== undefined) updatedFields.push(`name to "${packageName}"`);
        if (isActive !== undefined) updatedFields.push(`status to ${isActive ? 'Active' : 'Inactive'}`);
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_UPDATE',
            employee_id: null,
            employee_name: null,
            month: new Date().toISOString().substring(0, 7),
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Updated package group (ID: ${packageGroupId}): ${updatedFields.join(', ')}.`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package update:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        data: updated
    });
});

export const deletePackageGroup = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { packageGroupId } = req.params;
    await PackageService.deletePackageGroup(Number(packageGroupId), orgId);

    // Write audit log
    try {
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_DELETE',
            employee_id: null,
            employee_name: null,
            month: new Date().toISOString().substring(0, 7),
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Deleted package group (ID: ${packageGroupId}).`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package delete:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Package group deleted successfully.'
    });
});

export const getEmployeesWithPackages = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const employees = await PackageService.getEmployeesWithPackages(orgId);
    res.status(200).json({
        status: 'success',
        data: employees
    });
});

export const assignPackageToEmployee = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { employeeId } = req.params;
    const { packageGroupId, effectiveFrom } = req.body;
    const createdBy = req.user.id;
    
    const assigned = await PackageService.assignPackageToEmployee({
        orgId,
        employeeId: Number(employeeId),
        packageGroupId: Number(packageGroupId),
        effectiveFrom,
        createdBy
    });

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', employeeId).first();
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        const pGroup = await attendanceDB('payroll_package_groups').where('package_group_id', packageGroupId).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_ASSIGN',
            employee_id: Number(employeeId),
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: effectiveFrom ? effectiveFrom.substring(0, 7) : new Date().toISOString().substring(0, 7),
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Assigned salary package "${pGroup ? pGroup.package_name : packageGroupId}" to employee ${empUser ? (empUser.user_name || empUser.email) : employeeId} effective from ${effectiveFrom}.`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package assignment:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Package assigned successfully.',
        data: assigned
    });
});

export const unassignPackageFromEmployee = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { employeeId } = req.params;
    const { grossMonthlySalary, overtimeEnabled, overtimeRate, effectiveFrom } = req.body;
    const createdBy = req.user.id;

    const unassigned = await PackageService.unassignPackageFromEmployee({
        orgId,
        employeeId: Number(employeeId),
        grossMonthlySalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom,
        createdBy
    });

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', employeeId).first();
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'PACKAGE_UNASSIGN',
            employee_id: Number(employeeId),
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: effectiveFrom ? effectiveFrom.substring(0, 7) : new Date().toISOString().substring(0, 7),
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: `Unassigned salary package from employee ${empUser ? (empUser.user_name || empUser.email) : employeeId} and configured custom salary of ₹${Number(grossMonthlySalary).toLocaleString()}${overtimeEnabled ? ` with overtime at ₹${overtimeRate}/hr` : ' (no overtime)'} effective from ${effectiveFrom}.`
        });
    } catch (auditErr) {
        console.error('Audit logger failed for package unassignment:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Package unassigned successfully.',
        data: unassigned
    });
});

export const getPayrollSettings = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    let settings = await attendanceDB('payroll_settings').where('org_id', orgId).first();
    if (!settings) {
        await attendanceDB('payroll_settings').insert({
            org_id: orgId,
            overtime_enabled: 1,
            overtime_requires_approval: 0,
            lop_calculation_method: 'calendar_days',
            lop_fixed_days_value: 30,
            lop_factor_present: 1.00,
            lop_factor_half_day: 0.50,
            lop_factor_absent: 0.00
        });
        settings = await attendanceDB('payroll_settings').where('org_id', orgId).first();
    }
    res.status(200).json({
        status: 'success',
        data: settings
    });
});

export const updatePayrollSettings = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { 
        overtimeEnabled, 
        overtimeRequiresApproval, 
        lopCalculationMethod, 
        lopFixedDaysValue,
        lopFactorPresent,
        lopFactorHalfDay,
        lopFactorAbsent
    } = req.body;
    
    const updates = {};
    if (overtimeEnabled !== undefined) updates.overtime_enabled = overtimeEnabled ? 1 : 0;
    if (overtimeRequiresApproval !== undefined) updates.overtime_requires_approval = overtimeRequiresApproval ? 1 : 0;
    if (lopCalculationMethod !== undefined) updates.lop_calculation_method = lopCalculationMethod;
    if (lopFixedDaysValue !== undefined) updates.lop_fixed_days_value = Number(lopFixedDaysValue);
    if (lopFactorPresent !== undefined) updates.lop_factor_present = Number(lopFactorPresent);
    if (lopFactorHalfDay !== undefined) updates.lop_factor_half_day = Number(lopFactorHalfDay);
    if (lopFactorAbsent !== undefined) updates.lop_factor_absent = Number(lopFactorAbsent);

    await attendanceDB('payroll_settings')
        .where('org_id', orgId)
        .update(updates);

    const updatedSettings = await attendanceDB('payroll_settings').where('org_id', orgId).first();

    // Invalidate/Recalculate draft payroll for all users for current month in background
    try {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = now.getMonth() + 1;
        PayrollCalculationService.updateDraftEntriesForOrg(orgId, year, monthNum).catch(err => {
            console.error("Failed to update draft entries after global settings update:", err);
        });
    } catch (e) {
        console.error("Failed to trigger background calculation for global settings update:", e);
    }

    res.status(200).json({
        status: 'success',
        message: 'Payroll settings updated successfully.',
        data: updatedSettings
    });
});

export const unlockEmployeePayroll = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const employeeId = Number(req.params.employeeId);
    const { month } = req.body; // YYYY-MM

    if (!month) {
        return next(new AppError('Month parameter is required (format: YYYY-MM).', 400));
    }

    const parts = month.split('-');
    const year = Number(parts[0]);
    const monthNum = Number(parts[1]);

    const run = await attendanceDB('payroll_runs')
        .where({ org_id: orgId, year, month: monthNum })
        .first();

    if (!run) {
        return next(new AppError('No payroll run found for this period.', 404));
    }

    if (run.status !== 'Live') {
        return next(new AppError(`Cannot unlock employee payroll. The entire payroll run is already ${run.status.toLowerCase()}.`, 400));
    }

    await attendanceDB('payroll_entries')
        .where({ run_id: run.run_id, employee_id: employeeId })
        .update({ status: 'Draft', updated_at: attendanceDB.fn.now() });

    // Write audit log
    try {
        const empUser = await attendanceDB('core_users').where('user_id', employeeId).first();
        const performer = await attendanceDB('core_users').where('user_id', req.user.id).first();
        await attendanceDB('payroll_audit_logs').insert({
            org_id: orgId,
            action: 'UNLOCK',
            employee_id: employeeId,
            employee_name: empUser ? (empUser.user_name || empUser.email) : 'Employee',
            month: month,
            performed_by: req.user.id,
            performed_by_name: performer ? (performer.user_name || performer.email) : 'Admin',
            details: 'Unlocked employee monthly payroll, reverting status to Draft.'
        });
    } catch (auditErr) {
        console.error('Audit logger failed:', auditErr);
    }

    res.status(200).json({
        status: 'success',
        message: 'Employee payroll unlocked successfully.'
    });
});

export const getPayrollAuditLogs = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const { month, employeeId } = req.query;

    let query = attendanceDB('payroll_audit_logs')
        .where('org_id', orgId)
        .orderBy('created_at', 'desc');

    if (month) {
        query = query.where('month', month);
    }
    if (employeeId) {
        query = query.where('employee_id', Number(employeeId));
    }

    const logs = await query.limit(100);

    res.status(200).json({
        status: 'success',
        data: logs
    });
});




