import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as payrollController from '../../controllers/payroll/payrollController.js';

const router = express.Router();

// Apply JWT authentication to all payroll endpoints
router.use(authenticateJWT);

// Salary APIs
router.get('/employees/:id/salary', payrollController.getEmployeeSalary);
router.post('/employees/:id/salary', authorize('admin', 'hr'), payrollController.updateEmployeeSalary);
router.get('/employees/:id/salary/history', authorize('admin', 'hr'), payrollController.getEmployeeSalaryHistory);

// Payroll Dashboard & Calculation APIs (restricted to admin & hr)
router.get('/dashboard', authorize('admin', 'hr'), payrollController.getPayrollDashboard);
router.get('/dashboard/:employeeId', authorize('admin', 'hr'), payrollController.getEmployeeProjectedDetails);
router.post('/finalize', authorize('admin', 'hr'), payrollController.finalizePayrollRun);
router.post('/employees/:employeeId/finalize', authorize('admin', 'hr'), payrollController.finalizeEmployeePayroll);
router.post('/employees/:employeeId/pay', authorize('admin', 'hr'), payrollController.payEmployeePayroll);
router.get('/runs', authorize('admin', 'hr'), payrollController.getPayrollRuns);
router.get('/runs/:runId', authorize('admin', 'hr'), payrollController.getPayrollRunDetails);
router.post('/runs/:runId/mark-paid', authorize('admin', 'hr'), payrollController.markPayrollRunAsPaid);

// Payslip PDF Stream API (accessible by employees for their own, or admin/hr)
router.put('/entries/:entryId/adjustments', authorize('admin', 'hr'), payrollController.updateEntryAdjustments);
router.get('/entries/:entryId/payslip', payrollController.getPayslip);

// Package APIs
router.get('/packages', authorize('admin', 'hr'), payrollController.getPackageGroups);
router.post('/packages', authorize('admin', 'hr'), payrollController.createPackageGroup);
router.get('/packages/:packageGroupId/revisions', authorize('admin', 'hr'), payrollController.getPackageRevisions);
router.post('/packages/:packageGroupId/revisions', authorize('admin', 'hr'), payrollController.createPackageRevision);
router.put('/packages/:packageGroupId', authorize('admin', 'hr'), payrollController.updatePackageGroup);
router.delete('/packages/:packageGroupId', authorize('admin', 'hr'), payrollController.deletePackageGroup);

// Package Assignment APIs
router.get('/employees/packages', authorize('admin', 'hr'), payrollController.getEmployeesWithPackages);
router.post('/employees/:employeeId/assign-package', authorize('admin', 'hr'), payrollController.assignPackageToEmployee);
router.post('/employees/:employeeId/unassign-package', authorize('admin', 'hr'), payrollController.unassignPackageFromEmployee);

// Payroll Settings APIs
router.get('/settings', authorize('admin', 'hr'), payrollController.getPayrollSettings);
router.put('/settings', authorize('admin', 'hr'), payrollController.updatePayrollSettings);

export default router;
