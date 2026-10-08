import express from 'express';
import { authenticateJWT, authorize } from '../../middleware/auth.js';
import * as payrollController from './payrollController.js';

const router = express.Router();

// Apply JWT authentication to all payroll endpoints
router.use(authenticateJWT);

// ==========================================
// 1. Settings & Setup Endpoints
// ==========================================
router.get('/setup-status', authorize('admin', 'hr'), payrollController.getSetupStatus);
router.get('/settings', authorize('admin', 'hr'), payrollController.getPayrollSettings);
router.post('/settings', authorize('admin', 'hr'), payrollController.updatePayrollSettings);
router.put('/settings', authorize('admin', 'hr'), payrollController.updatePayrollSettings);

// ==========================================
// 2. Salary Packages Endpoints
// ==========================================
router.get('/packages', authorize('admin', 'hr'), payrollController.listPackages);
router.post('/packages', authorize('admin', 'hr'), payrollController.createPackage);
router.get('/packages/:id', authorize('admin', 'hr'), payrollController.getPackageById);
router.put('/packages/:id', authorize('admin', 'hr'), payrollController.updatePackage);
router.delete('/packages/:id', authorize('admin', 'hr'), payrollController.deletePackage);

// Package Components
router.post('/packages/:packageId/components', authorize('admin', 'hr'), payrollController.addPackageComponent);
router.put('/packages/:packageId/components/:componentId', authorize('admin', 'hr'), payrollController.updatePackageComponent);
router.delete('/packages/:packageId/components/:componentId', authorize('admin', 'hr'), payrollController.deletePackageComponent);

// ==========================================
// 3. Employee Package Assignments Endpoints
// ==========================================
router.get('/assignments', authorize('admin', 'hr'), payrollController.listEmployeeAssignments);
router.get('/employees/:employeeId/package', authorize('admin', 'hr'), payrollController.getEmployeePackage);
router.post('/employees/:employeeId/assign-package', authorize('admin', 'hr'), payrollController.assignPackageToEmployee);
router.post('/employees/:employeeId/unassign-package', authorize('admin', 'hr'), payrollController.unassignPackageFromEmployee);

// ==========================================
// 4. Payroll Runs & Payslips Endpoints
// ==========================================
router.post('/runs', authorize('admin', 'hr'), payrollController.triggerPayrollRun);
router.get('/runs', authorize('admin', 'hr'), payrollController.listPayrollRuns);
router.get('/runs/:runId', authorize('admin', 'hr'), payrollController.getPayrollRunDetails);
router.patch('/runs/:runId', authorize('admin', 'hr'), payrollController.updatePayrollRunStatus);

// Payslip & Projection
router.get('/runs/:runId/employees/:employeeId/payslip', authorize('admin', 'hr'), payrollController.getEmployeePayslip);
router.get('/employees/:employeeId/projection', authorize('admin', 'hr'), payrollController.getEmployeeProjection);

export default router;
