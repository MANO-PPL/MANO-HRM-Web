import { attendanceDB } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import PayrollSettingsService from './PayrollSettingsService.js';
import SalaryAssignmentService from './SalaryAssignmentService.js';
import PayrollEngineService from './PayrollEngineService.js';
import { getCardRecords } from '../../attendance/attendanceService.js';
import { getShiftsForOrg, getUserShift } from '../../shifts/shiftService.js';

/**
 * Helper: Calculate total calendar days between two dates inclusive
 */
export const getDaysBetween = (startDateStr, endDateStr) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Helper: Normalize transaction_type to satisfy chk_payroll_lines_type constraint
 */
export const sanitizeTransactionType = (type) => {
  if (type === 'benefit') return 'employer_contribution';
  if (['earning', 'deduction', 'employer_contribution', 'adjustment'].includes(type)) {
    return type;
  }
  return 'earning';
};

/**
 * Helper: Extract whether overtime is permitted from shift policy_rules JSON
 */
export const extractShiftOvertimeEnabled = (policyRules) => {
  if (!policyRules) return false;
  try {
    const rules = typeof policyRules === 'string' ? JSON.parse(policyRules) : policyRules;
    if (typeof rules?.overtime === 'boolean') {
      return rules.overtime;
    }
    if (rules?.overtime?.enabled !== undefined) {
      return Boolean(rules.overtime.enabled);
    }
    if (rules?.is_overtime_enabled !== undefined) {
      return Boolean(rules.is_overtime_enabled);
    }
    if (rules?.allow_overtime !== undefined) {
      return Boolean(rules.allow_overtime);
    }
  } catch {
    // Fallback
  }
  return false;
};

/**
 * Helper: Normalize date input (Date instance, ISO timestamp, or string) to 'YYYY-MM-DD'
 */
export const formatIsoDate = (val) => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  return str.substring(0, 10);
};

/**
 * Helper: Fetch and aggregate attendance metrics dynamically matching the Attendance Monitoring matrix
 */
export const getEmployeeAttendanceMetrics = async (employeeId, periodStart, periodEnd, orgId = null) => {
  const startStr = formatIsoDate(periodStart);
  const endStr = formatIsoDate(periodEnd);
  const calendarDays = getDaysBetween(startStr, endStr);

    let effectiveOrgId = orgId;
    if (!effectiveOrgId) {
      const user = await attendanceDB('core_users')
        .where({ user_id: employeeId })
        .select('org_id')
        .first();
      effectiveOrgId = user?.org_id;
    }

    try {
      const cardRecords = await getCardRecords({
        org_id: effectiveOrgId,
        targetUserId: employeeId,
        startDate: startStr,
        endDate: endStr
      });

      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let missedPunchDays = 0;
      let paidLeaveDays = 0;
      let holidayDays = 0;
      let weeklyOffDays = 0;
      let totalOvertimeHours = 0;

      for (const r of cardRecords) {
        const s = String(r.status || '').trim();
        const sLower = s.toLowerCase();
        const sUpper = s.toUpperCase();

        const otHrs = parseFloat(r.overtime_hours ?? r.ot_hours ?? r.overtime ?? 0);
        if (!isNaN(otHrs) && otHrs > 0) {
          totalOvertimeHours += otHrs;
        }

        if (sLower.includes('missed') || sUpper === 'MP' || sUpper === 'MISSED_PUNCH') {
          missedPunchDays += 1;
        } else if (sLower.includes('leave') || sUpper === 'L' || sLower === 'on_leave') {
          paidLeaveDays += 1;
        } else if (sLower.includes('half') || sUpper === 'HD' || sLower === 'half_day') {
          halfDays += 1;
        } else if (
          sUpper === 'SUN' || sUpper === 'SAT' || sLower.includes('sunday') || sLower.includes('saturday') ||
          sUpper === 'WO' || sLower === 'wo' || sLower.includes('week') || sLower.includes('holiday') || sUpper === 'H'
        ) {
          weeklyOffDays += 1;
        } else if (
          sLower.includes('present') || s === '1.0' || s === '1' || sUpper === 'P' ||
          sLower.includes('late') || sLower.includes('overtime') || sUpper === 'OT' ||
          sLower.includes('on duty') || sUpper === 'OD' || sLower.includes('work from home') || sUpper === 'WFH'
        ) {
          presentDays += 1;
        } else if (sLower.includes('absent') || s === '0.0' || s === '0' || sUpper === 'A') {
          absentDays += 1;
        }
      }

      return {
        calendar_days: calendarDays,
        present_days: presentDays,
        half_days: halfDays,
        absent_days: absentDays,
        missed_punch_days: missedPunchDays,
        paid_leave_days: paidLeaveDays,
        holiday_days: holidayDays,
        weekly_off_days: weeklyOffDays,
        overtime_hours: Number(totalOvertimeHours.toFixed(2))
      };
    } catch (err) {
      console.error('[PayrollRunService] Dynamic attendance fetch failed, falling back to daily summary:', err);

      const records = await attendanceDB('attn_daily_summary')
        .where({ user_id: employeeId })
        .whereBetween('date', [periodStart, periodEnd]);

      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let paidLeaveDays = 0;
      let holidayDays = 0;
      let weeklyOffDays = 0;
      let totalOvertimeHours = 0;

      for (const rec of records) {
        const st = (rec.status || '').toUpperCase();
        totalOvertimeHours += Number(rec.overtime_hours || 0);

        if (['PRESENT', 'LATE', 'OVERTIME'].includes(st)) {
          presentDays += 1;
        } else if (st === 'HALF_DAY') {
          halfDays += 1;
        } else if (['ABSENT', 'MISSED_PUNCH'].includes(st)) {
          absentDays += 1;
        } else if (st === 'LEAVE') {
          paidLeaveDays += 1;
        } else if (st === 'HOLIDAY') {
          holidayDays += 1;
        } else if (['WEEKEND', 'WEEK_OFF'].includes(st)) {
          weeklyOffDays += 1;
        } else {
          presentDays += 1;
        }
      }

      const recordedDays = records.length;
      if (recordedDays < calendarDays) {
        const missing = calendarDays - recordedDays;
        presentDays += missing;
      }

      return {
        calendar_days: calendarDays,
        present_days: presentDays,
        half_days: halfDays,
        absent_days: absentDays,
        paid_leave_days: paidLeaveDays,
        holiday_days: holidayDays,
        weekly_off_days: weeklyOffDays,
        overtime_hours: totalOvertimeHours
      };
    }
  }

/**
 * Create a Company-Wide Batch Payroll Run for all active assigned employees
 */
export const createBatchRun = async (orgId, { period_start, period_end, batch_name, processed_by }) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);
  if (!period_start || !period_end) throw new AppError('period_start and period_end are required (YYYY-MM-DD).', 400);

  return await attendanceDB.transaction(async (trx) => {
    // Check duplicate batch run
    const existing = await trx('payroll_runs_v1')
      .where({
        org_id: orgId,
        run_type: 'batch',
        period_start: period_start,
        period_end: period_end
      })
      .first();

    if (existing) {
      throw new AppError(`A batch payroll run for period ${period_start} to ${period_end} already exists (Run #${existing.id}).`, 400);
    }

    const settings = await PayrollSettingsService.getSettings(orgId);

    // Create Run Header
    const defaultName = batch_name || `Workforce Payroll (${period_start} to ${period_end})`;
    const [runId] = await trx('payroll_runs_v1').insert({
      org_id: orgId,
      run_type: 'batch',
      employee_id: null,
      batch_name: defaultName,
      period_start: period_start,
      period_end: period_end,
      status: 'draft'
    });

    // Find all active employees in org with package assignments
    const employees = await trx('core_users as u')
      .where({ 'u.org_id': orgId, 'u.is_deleted': 0, 'u.is_active': 1 })
      .select('u.user_id', 'u.user_name', 'u.user_code', 'u.shift_id');

    const shifts = await getShiftsForOrg(orgId);
    const shiftMap = new Map((shifts || []).map(s => [s.shift_id, s]));

    const allLines = [];
    let processedCount = 0;

    for (const emp of employees) {
      // Fetch active package for this employee
      const pkgDetails = await SalaryAssignmentService.getEmployeeActivePackage(orgId, emp.user_id, period_end);
      if (!pkgDetails) continue; // Skip employee if no salary package assigned

      const attendanceMetrics = await getEmployeeAttendanceMetrics(emp.user_id, period_start, period_end, orgId);
      const empShift = emp.shift_id ? shiftMap.get(emp.shift_id) : null;
      const shiftOtEnabled = empShift
        ? (empShift.is_overtime_enabled === 1 || extractShiftOvertimeEnabled(empShift.policy_rules))
        : false;

      const calculation = PayrollEngineService.calculateEmployeePayroll({
        employee: emp,
        packageDetails: pkgDetails,
        attendanceMetrics: attendanceMetrics,
        shift: { is_overtime_enabled: shiftOtEnabled },
        settings: settings
      });

      for (const line of calculation.lines) {
        allLines.push({
          payroll_run_id: runId,
          employee_id: emp.user_id,
          salary_package_component_id: line.salary_package_component_id || null,
          transaction_type: sanitizeTransactionType(line.transaction_type),
          name: line.name,
          amount: line.amount,
          description: line.description || null
        });
      }
      processedCount += 1;
    }

    // Bulk insert lines if any
    if (allLines.length > 0) {
      // Chunk inserts by 500 rows for large organizations
      const chunkSize = 500;
      for (let i = 0; i < allLines.length; i += chunkSize) {
        await trx('payroll_lines').insert(allLines.slice(i, i + chunkSize));
      }
    }

    return await getRunDetails(orgId, runId, trx);
  });
};

/**
 * Create an Individual Employee Payroll Run (e.g. Settlement / Off-cycle)
 */
export const createIndividualRun = async (orgId, { employee_id, period_start, period_end, batch_name, manualAdjustments = [] }) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);
  if (!employee_id) throw new AppError('Employee ID is required.', 400);
  if (!period_start || !period_end) throw new AppError('period_start and period_end are required (YYYY-MM-DD).', 400);

  const emp = await attendanceDB('core_users as u')
    .where({ 'u.user_id': employee_id, 'u.org_id': orgId, 'u.is_deleted': 0 })
    .select('u.user_id', 'u.user_name', 'u.user_code', 'u.shift_id')
    .first();

  if (!emp) throw new AppError('Employee not found in this organization.', 404);

  const pkgDetails = await SalaryAssignmentService.getEmployeeActivePackage(orgId, employee_id, period_end);
  if (!pkgDetails) {
    throw new AppError('No active salary package assigned to this employee.', 400);
  }

  const userShift = await getUserShift(employee_id);
  const shiftOtEnabled = userShift
    ? (userShift.is_overtime_enabled === 1 || extractShiftOvertimeEnabled(userShift.policy_rules))
    : false;

  return await attendanceDB.transaction(async (trx) => {
    const settings = await PayrollSettingsService.getSettings(orgId);

    const defaultName = batch_name || `Individual Run - ${emp.user_name} (${period_start} to ${period_end})`;
    const [runId] = await trx('payroll_runs_v1').insert({
      org_id: orgId,
      run_type: 'individual',
      employee_id: employee_id,
      batch_name: defaultName,
      period_start: period_start,
      period_end: period_end,
      status: 'draft'
    });

    const attendanceMetrics = await getEmployeeAttendanceMetrics(employee_id, period_start, period_end, orgId);

    const calculation = PayrollEngineService.calculateEmployeePayroll({
      employee: emp,
      packageDetails: pkgDetails,
      attendanceMetrics: attendanceMetrics,
      shift: { is_overtime_enabled: shiftOtEnabled },
      settings: settings,
      manualAdjustments: manualAdjustments
    });

    const lines = calculation.lines.map(line => ({
      payroll_run_id: runId,
      employee_id: employee_id,
      salary_package_component_id: line.salary_package_component_id || null,
      transaction_type: sanitizeTransactionType(line.transaction_type),
      name: line.name,
      amount: line.amount,
      description: line.description || null
    }));

    if (lines.length > 0) {
      await trx('payroll_lines').insert(lines);
    }

    return await getRunDetails(orgId, runId, trx);
  });
};

/**
 * List all payroll runs for an organization with aggregated summaries
 */
export const listRuns = async (orgId, { run_type, status } = {}) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);

  let query = attendanceDB('payroll_runs_v1 as r')
    .leftJoin('core_users as u', 'r.employee_id', 'u.user_id')
    .where('r.org_id', orgId)
    .select(
      'r.*',
      'u.user_name as individual_employee_name',
      'u.user_code as individual_employee_code'
    )
    .orderBy('r.period_start', 'desc')
    .orderBy('r.id', 'desc');

  if (run_type === 'individual') {
    query = query.whereNotNull('r.employee_id');
  } else if (run_type === 'batch') {
    query = query.whereNull('r.employee_id');
  }
  if (status) query = query.where('r.status', status);

  const runs = await query;

  // Attach summary stats (employee_count, gross, deductions, net)
  const runIds = runs.map(r => r.id);
  if (runIds.length === 0) return [];

  const lineStats = await attendanceDB('payroll_lines')
    .whereIn('payroll_run_id', runIds)
    .select('payroll_run_id')
    .countDistinct('employee_id as employee_count')
    .sum({
      total_gross: attendanceDB.raw("CASE WHEN transaction_type = 'earning' THEN amount ELSE 0 END"),
      total_deductions: attendanceDB.raw("CASE WHEN transaction_type = 'deduction' THEN amount ELSE 0 END")
    })
    .groupBy('payroll_run_id');

  const statsMap = new Map();
  for (const stat of lineStats) {
    const gross = Number(stat.total_gross || 0);
    const deductions = Number(stat.total_deductions || 0);
    statsMap.set(stat.payroll_run_id, {
      employee_count: Number(stat.employee_count || 0),
      total_gross: gross,
      total_deductions: deductions,
      total_net: Math.max(0, gross - deductions)
    });
  }

  return runs.map(r => ({
    ...r,
    run_type: r.employee_id ? 'individual' : 'batch',
    summary: statsMap.get(r.id) || {
      employee_count: r.employee_id ? 1 : 0,
      total_gross: 0,
      total_deductions: 0,
      total_net: 0
    }
  }));
};

/**
 * Get full details of a specific payroll run including employee payslip breakdown
 */
export const getRunDetails = async (orgId, runId, trx = attendanceDB) => {
  const run = await trx('payroll_runs_v1 as r')
    .leftJoin('core_users as u', 'r.employee_id', 'u.user_id')
    .where({ 'r.id': runId, 'r.org_id': orgId })
    .select('r.*', 'u.user_name as individual_employee_name', 'u.user_code as individual_employee_code')
    .first();

  if (!run) throw new AppError('Payroll run not found.', 404);

  // Fetch all lines for this run
  const lines = await trx('payroll_lines as l')
    .leftJoin('core_users as u', 'l.employee_id', 'u.user_id')
    .leftJoin('org_departments as d', 'u.dept_id', 'd.dept_id')
    .leftJoin('org_designations as desg', 'u.desg_id', 'desg.desg_id')
    .where('l.payroll_run_id', runId)
    .select(
      'l.*',
      'u.user_name as employee_name',
      'u.user_code as employee_code',
      'd.dept_name as department',
      'desg.desg_name as designation'
    )
    .orderBy('u.user_name', 'asc')
    .orderBy('l.id', 'asc');

  // Group lines by employee
  const empMap = new Map();
  for (const line of lines) {
    if (!empMap.has(line.employee_id)) {
      empMap.set(line.employee_id, {
        employee_id: line.employee_id,
        employee_name: line.employee_name,
        employee_code: line.employee_code,
        department: line.department,
        designation: line.designation,
        gross_pay: 0,
        total_deductions: 0,
        net_pay: 0,
        lines: []
      });
    }

    const empEntry = empMap.get(line.employee_id);
    empEntry.lines.push({
      id: line.id,
      salary_package_component_id: line.salary_package_component_id,
      transaction_type: line.transaction_type,
      name: line.name,
      amount: Number(line.amount),
      description: line.description
    });

    if (line.transaction_type === 'earning') {
      empEntry.gross_pay += Number(line.amount);
    } else if (line.transaction_type === 'deduction') {
      empEntry.total_deductions += Number(line.amount);
    }
  }

  const employeePayslips = Array.from(empMap.values()).map(emp => ({
    ...emp,
    gross_pay: Number(emp.gross_pay.toFixed(2)),
    total_deductions: Number(emp.total_deductions.toFixed(2)),
    net_pay: Number(Math.max(0, emp.gross_pay - emp.total_deductions).toFixed(2))
  }));

  const totalGross = employeePayslips.reduce((sum, e) => sum + e.gross_pay, 0);
  const totalDeductions = employeePayslips.reduce((sum, e) => sum + e.total_deductions, 0);

  return {
    ...run,
    summary: {
      employee_count: employeePayslips.length,
      total_gross: Number(totalGross.toFixed(2)),
      total_deductions: Number(totalDeductions.toFixed(2)),
      total_net: Number(Math.max(0, totalGross - totalDeductions).toFixed(2))
    },
    employees: employeePayslips
  };
};

/**
 * Calculate live payroll projection breakdown without persisting to database
 */
export const getEmployeeProjection = async (orgId, { employeeId, period_start, period_end }) => {
  const pkgDetails = await SalaryAssignmentService.getEmployeeActivePackage(orgId, employeeId, period_end);
  if (!pkgDetails) {
    return null;
  }

  const settings = await PayrollSettingsService.getSettings(orgId);
  const attendanceMetrics = await getEmployeeAttendanceMetrics(employeeId, period_start, period_end, orgId);

  const emp = await attendanceDB('core_users as u')
    .where({ 'u.user_id': employeeId, 'u.org_id': orgId, 'u.is_deleted': 0 })
    .select('u.user_id', 'u.user_name', 'u.user_code', 'u.shift_id')
    .first();

  const userShift = await getUserShift(employeeId);
  const shiftOtEnabled = userShift
    ? (userShift.is_overtime_enabled === 1 || extractShiftOvertimeEnabled(userShift.policy_rules))
    : false;

  const calculation = PayrollEngineService.calculateEmployeePayroll({
    employee: emp,
    packageDetails: pkgDetails,
    attendanceMetrics,
    shift: { is_overtime_enabled: shiftOtEnabled },
    settings
  });

  return {
    employee_id: employeeId,
    period_start,
    period_end,
    package: pkgDetails,
    attendance: attendanceMetrics,
    calculation
  };
};

/**
 * Get single employee payslip from a run
 */
export const getEmployeePayslip = async (orgId, runId, employeeId) => {
  const run = await attendanceDB('payroll_runs_v1')
    .where({ id: runId, org_id: orgId })
    .first();

  if (!run) throw new AppError('Payroll run not found.', 404);

  const employee = await attendanceDB('core_users as u')
    .leftJoin('org_departments as d', 'u.dept_id', 'd.dept_id')
    .leftJoin('org_designations as desg', 'u.desg_id', 'desg.desg_id')
    .leftJoin('core_organizations as o', 'u.org_id', 'o.org_id')
    .where({ 'u.user_id': employeeId, 'u.org_id': orgId })
    .select(
      'u.user_id',
      'u.user_name',
      'u.user_code',
      'u.email',
      'u.joining_date',
      'u.work_location',
      'd.dept_name',
      'desg.desg_name',
      'o.org_name'
    )
    .first();

  if (!employee) throw new AppError('Employee not found.', 404);

  const lines = await attendanceDB('payroll_lines')
    .where({ payroll_run_id: runId, employee_id: employeeId })
    .orderBy('id', 'asc');

  const isAdjustment = (l) => {
    if (l.salary_package_component_id === null || l.salary_package_component_id === undefined) return true;
    const n = (l.name || '').toLowerCase();
    return n.includes('overtime') || n.includes('loss of pay') || n.includes('lop') || n.includes('adjustment') || n.includes('advance') || n.includes('arrear') || n.includes('reimbursement');
  };

  const contractualEarnings = lines.filter(l => l.transaction_type === 'earning' && !isAdjustment(l));
  const contractualDeductions = lines.filter(l => l.transaction_type === 'deduction' && !isAdjustment(l));
  const adjustments = lines.filter(l => isAdjustment(l));

  const contractualGross = contractualEarnings.reduce((sum, l) => sum + Number(l.amount), 0);
  const contractualTotalDeductions = contractualDeductions.reduce((sum, l) => sum + Number(l.amount), 0);
  const netAdjustments = adjustments.reduce((sum, l) => {
    const amt = Number(l.amount);
    return l.transaction_type === 'earning' ? sum + amt : sum - amt;
  }, 0);

  const earnings = lines.filter(l => l.transaction_type === 'earning');
  const deductions = lines.filter(l => l.transaction_type === 'deduction');

  const gross = earnings.reduce((sum, l) => sum + Number(l.amount), 0);
  const totalDeductions = deductions.reduce((sum, l) => sum + Number(l.amount), 0);
  const net = Math.max(0, contractualGross - contractualTotalDeductions + netAdjustments);
  const attendance = await getEmployeeAttendanceMetrics(employeeId, run.period_start, run.period_end, run.org_id);

  return {
    run_id: run.id,
    run_type: run.run_type,
    period_start: run.period_start,
    period_end: run.period_end,
    status: run.status,
    paid_at: run.paid_at,
    employee,
    attendance,
    summary: {
      gross_pay: Number(contractualGross.toFixed(2)),
      full_gross_pay: Number(gross.toFixed(2)),
      total_deductions: Number(contractualTotalDeductions.toFixed(2)),
      full_total_deductions: Number(totalDeductions.toFixed(2)),
      total_adjustments: Number(netAdjustments.toFixed(2)),
      net_pay: Number(net.toFixed(2))
    },
    earnings: contractualEarnings,
    deductions: contractualDeductions,
    all_earnings: earnings,
    all_deductions: deductions,
    adjustments,
    lines
  };
};

/**
 * Partially update run attributes (status, batch_name, paid_at) or trigger rerun action
 */
export const updateRunStatus = async (orgId, runId, { status, batch_name, paid_at, action } = {}) => {
  if (action === 'rerun' || action === 'recalculate') {
    return await recalculateDraftRun(orgId, runId);
  }

  const run = await attendanceDB('payroll_runs_v1')
    .where({ id: runId, org_id: orgId })
    .first();

  if (!run) throw new AppError('Payroll run not found.', 404);

  const updatePayload = {
    updated_at: attendanceDB.fn.now()
  };

  if (status !== undefined) {
    const validStatuses = ['draft', 'processing', 'approved', 'paid'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Allowed: ${validStatuses.join(', ')}`, 400);
    }
    updatePayload.status = status;
    if (status === 'paid') {
      updatePayload.paid_at = paid_at || attendanceDB.fn.now();
    }
  }

  if (batch_name !== undefined) {
    updatePayload.batch_name = batch_name ? batch_name.trim() : null;
  }

  await attendanceDB('payroll_runs_v1')
    .where({ id: runId, org_id: orgId })
    .update(updatePayload);

  return await getRunDetails(orgId, runId);
};

/**
 * Re-run / Recalculate a draft payroll run with latest attendance & packages in-place
 */
export const recalculateDraftRun = async (orgId, runId) => {
  const run = await attendanceDB('payroll_runs_v1')
    .where({ id: runId, org_id: orgId })
    .first();

  if (!run) throw new AppError('Payroll run not found.', 404);
  if (run.status !== 'draft') {
    throw new AppError(`Only 'draft' runs can be recalculated. This run is currently '${run.status}'.`, 400);
  }

  return await attendanceDB.transaction(async (trx) => {
    // 1. Wipe previous draft ledger lines
    await trx('payroll_lines').where({ payroll_run_id: runId }).delete();

    const settings = await PayrollSettingsService.getSettings(orgId);

    if (run.employee_id) {
      // Individual run recalculation
      const emp = await trx('core_users as u')
        .where({ 'u.user_id': run.employee_id, 'u.org_id': orgId })
        .select('u.user_id', 'u.user_name', 'u.user_code', 'u.shift_id')
        .first();

      if (emp) {
        const pkgDetails = await SalaryAssignmentService.getEmployeeActivePackage(orgId, run.employee_id, run.period_end);
        if (pkgDetails) {
          const userShift = await getUserShift(run.employee_id);
          const shiftOtEnabled = userShift
            ? (userShift.is_overtime_enabled === 1 || extractShiftOvertimeEnabled(userShift.policy_rules))
            : false;

          const attendanceMetrics = await getEmployeeAttendanceMetrics(run.employee_id, run.period_start, run.period_end, orgId);
          const calculation = PayrollEngineService.calculateEmployeePayroll({
            employee: emp,
            packageDetails: pkgDetails,
            attendanceMetrics,
            shift: { is_overtime_enabled: shiftOtEnabled },
            settings
          });

          const lines = calculation.lines.map(line => ({
            payroll_run_id: runId,
            employee_id: run.employee_id,
            salary_package_component_id: line.salary_package_component_id || null,
            transaction_type: sanitizeTransactionType(line.transaction_type),
            name: line.name,
            amount: line.amount,
            description: line.description || null
          }));

          if (lines.length > 0) {
            await trx('payroll_lines').insert(lines);
          }
        }
      }
    } else {
      // Batch run recalculation for active workforce
      const employees = await trx('core_users as u')
        .where({ 'u.org_id': orgId, 'u.is_deleted': 0, 'u.is_active': 1 })
        .select('u.user_id', 'u.user_name', 'u.user_code', 'u.shift_id');

      const shifts = await getShiftsForOrg(orgId);
      const shiftMap = new Map((shifts || []).map(s => [s.shift_id, s]));

      const allLines = [];
      for (const emp of employees) {
        const pkgDetails = await SalaryAssignmentService.getEmployeeActivePackage(orgId, emp.user_id, run.period_end);
        if (!pkgDetails) continue;

        const empShift = emp.shift_id ? shiftMap.get(emp.shift_id) : null;
        const shiftOtEnabled = empShift
          ? (empShift.is_overtime_enabled === 1 || extractShiftOvertimeEnabled(empShift.policy_rules))
          : false;

        const attendanceMetrics = await getEmployeeAttendanceMetrics(emp.user_id, run.period_start, run.period_end, orgId);
        const calculation = PayrollEngineService.calculateEmployeePayroll({
          employee: emp,
          packageDetails: pkgDetails,
          attendanceMetrics,
          shift: { is_overtime_enabled: shiftOtEnabled },
          settings
        });

        for (const line of calculation.lines) {
          allLines.push({
            payroll_run_id: runId,
            employee_id: emp.user_id,
            salary_package_component_id: line.salary_package_component_id || null,
            transaction_type: sanitizeTransactionType(line.transaction_type),
            name: line.name,
            amount: line.amount,
            description: line.description || null
          });
        }
      }

      const chunkSize = 500;
      for (let i = 0; i < allLines.length; i += chunkSize) {
        await trx('payroll_lines').insert(allLines.slice(i, i + chunkSize));
      }
    }

    await trx('payroll_runs_v1')
      .where({ id: runId })
      .update({ updated_at: trx.fn.now() });

    return await getRunDetails(orgId, runId, trx);
  });
};

export const PayrollRunService = {
  getDaysBetween,
  sanitizeTransactionType,
  extractShiftOvertimeEnabled,
  formatIsoDate,
  getEmployeeAttendanceMetrics,
  createBatchRun,
  createIndividualRun,
  listRuns,
  getRunDetails,
  getEmployeeProjection,
  getEmployeePayslip,
  updateRunStatus,
  recalculateDraftRun
};

export default PayrollRunService;
