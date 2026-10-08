import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { requireOrgId, assertSelfOrStaffInOrg } from '../../utils/tenant.js';
import PayrollSettingsService from './services/PayrollSettingsService.js';
import SalaryPackageService from './services/SalaryPackageService.js';
import SalaryAssignmentService from './services/SalaryAssignmentService.js';
import PayrollRunService from './services/PayrollRunService.js';

// ==========================================
// 1. SETTINGS CONTROLLERS
// ==========================================

export const getPayrollSettings = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const settings = await PayrollSettingsService.getSettings(orgId);
  res.status(200).json({ ok: true, data: settings });
});

export const getSetupStatus = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const setupStatus = await PayrollSettingsService.getSetupStatus(orgId);
  res.status(200).json({ ok: true, data: setupStatus });
});

export const updatePayrollSettings = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const settings = await PayrollSettingsService.saveSettings(orgId, req.body);
  res.status(200).json({ ok: true, message: 'Settings saved successfully.', data: settings });
});

// ==========================================
// 2. SALARY PACKAGES CONTROLLERS
// ==========================================

export const listPackages = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const packages = await SalaryPackageService.listPackages(orgId);
  res.status(200).json({ ok: true, data: packages });
});

export const getPackageById = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { id } = req.params;
  const pkg = await SalaryPackageService.getPackageById(orgId, id);
  res.status(200).json({ ok: true, data: pkg });
});

export const createPackage = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const pkg = await SalaryPackageService.createPackage(orgId, req.body);
  res.status(201).json({ ok: true, message: 'Salary package created successfully.', data: pkg });
});

export const updatePackage = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { id } = req.params;
  const pkg = await SalaryPackageService.updatePackage(orgId, id, req.body);
  res.status(200).json({ ok: true, message: 'Salary package updated successfully.', data: pkg });
});

export const deletePackage = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { id } = req.params;
  const result = await SalaryPackageService.deletePackage(orgId, id);
  res.status(200).json({ ok: true, ...result });
});

// Components inside packages
export const addPackageComponent = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { packageId } = req.params;
  const component = await SalaryPackageService.addComponent(orgId, packageId, req.body);
  res.status(201).json({ ok: true, message: 'Component added successfully.', data: component });
});

export const updatePackageComponent = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { packageId, componentId } = req.params;
  const component = await SalaryPackageService.updateComponent(orgId, packageId, componentId, req.body);
  res.status(200).json({ ok: true, message: 'Component updated successfully.', data: component });
});

export const deletePackageComponent = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { packageId, componentId } = req.params;
  const result = await SalaryPackageService.deleteComponent(orgId, packageId, componentId);
  res.status(200).json({ ok: true, ...result });
});

// ==========================================
// 3. EMPLOYEE PACKAGE ASSIGNMENT CONTROLLERS
// ==========================================

export const listEmployeeAssignments = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { department_id, search } = req.query;
  const assignments = await SalaryAssignmentService.listEmployeeAssignments(orgId, { department_id, search });
  res.status(200).json({ ok: true, data: assignments });
});

export const getEmployeePackage = catchAsync(async (req, res) => {
  const orgId = requireOrgId(req);
  const employeeId = Number(req.params.employeeId || req.user.id || req.user.user_id);
  await assertSelfOrStaffInOrg(req, employeeId);
  const { as_of } = req.query;
  const pkg = await SalaryAssignmentService.getEmployeeActivePackage(orgId, employeeId, as_of || new Date());
  res.status(200).json({ ok: true, data: pkg });
});

export const assignPackageToEmployee = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { employeeId } = req.params;
  const { package_id, effective_from } = req.body;

  const assignment = await SalaryAssignmentService.assignPackage(orgId, {
    employee_id: employeeId,
    package_id,
    effective_from
  });

  res.status(200).json({ ok: true, message: 'Package assigned to employee successfully.', data: assignment });
});

export const unassignPackageFromEmployee = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { employeeId } = req.params;
  const { effective_to } = req.body;

  const result = await SalaryAssignmentService.unassignPackage(orgId, employeeId, effective_to || new Date());
  res.status(200).json({ ok: true, ...result });
});

// ==========================================
// 4. PAYROLL RUNS & PAYSLIPS CONTROLLERS
// ==========================================

/**
 * Trigger a Payroll Run (Batch or Individual)
 */
export const triggerPayrollRun = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { employee_id, period_start, period_end, batch_name, manualAdjustments } = req.body;

  if (employee_id) {
    const run = await PayrollRunService.createIndividualRun(orgId, {
      employee_id,
      period_start,
      period_end,
      batch_name,
      manualAdjustments
    });
    return res.status(201).json({ ok: true, message: 'Individual payroll run generated.', data: run });
  }

  // Batch run
  const run = await PayrollRunService.createBatchRun(orgId, {
    period_start,
    period_end,
    batch_name,
    processed_by: req.user.user_id
  });

  res.status(201).json({ ok: true, message: 'Batch payroll run generated successfully.', data: run });
});

export const listPayrollRuns = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { run_type, status } = req.query;
  const runs = await PayrollRunService.listRuns(orgId, { run_type, status });
  res.status(200).json({ ok: true, data: runs });
});

export const getPayrollRunDetails = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { runId } = req.params;
  const run = await PayrollRunService.getRunDetails(orgId, runId);
  res.status(200).json({ ok: true, data: run });
});

export const updatePayrollRunStatus = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { runId } = req.params;
  const run = await PayrollRunService.updateRunStatus(orgId, runId, req.body);
  res.status(200).json({ ok: true, message: 'Payroll run updated successfully.', data: run });
});


export const getEmployeePayslip = catchAsync(async (req, res) => {
  const orgId = requireOrgId(req);
  const { runId, employeeId } = req.params;

  // Normal employees can only view their own payslip
  await assertSelfOrStaffInOrg(req, Number(employeeId));

  const payslip = await PayrollRunService.getEmployeePayslip(orgId, runId, Number(employeeId));
  res.status(200).json({ ok: true, data: payslip });
});

/**
 * Preview / Projection calculation for an employee prior to creating a run
 */
export const getEmployeeProjection = catchAsync(async (req, res) => {
  const orgId = req.user.org_id;
  const { employeeId } = req.params;
  const { period_start, period_end } = req.query;

  if (!period_start || !period_end) {
    throw new AppError('period_start and period_end are required query parameters.', 400);
  }

  const projection = await PayrollRunService.getEmployeeProjection(orgId, {
    employeeId,
    period_start,
    period_end
  });

  if (!projection) {
    return res.status(200).json({
      ok: true,
      data: null,
      message: 'No active package assigned to employee.'
    });
  }

  res.status(200).json({
    ok: true,
    data: projection
  });
});



