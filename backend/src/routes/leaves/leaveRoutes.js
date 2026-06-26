import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import multer from 'multer';
import * as LeaveController from '../../controllers/leaves/leaveController.js';
import * as LeavePolicyController from '../../controllers/leaves/leavepolicyController.js';
import * as LeaveBalanceController from '../../controllers/leaves/leaveBalanceController.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';

// Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB limit, max 5 files
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images and PDFs are allowed.'));
        }
    }
});

const router = express.Router();

// Apply common middleware to all routes in this file
router.use(authenticateJWT, requireActiveOrg);

// Employee Routes
router.get('/my-history', LeaveController.getMyHistory);
router.post('/request', upload.array('attachments', 5), LeaveController.submitLeaveRequest);
router.delete('/request/:id', LeaveController.withdrawLeaveRequest);

// Admin Routes
router.get('/admin/pending', ensureAdmin, LeaveController.getPendingRequests);
router.get('/admin/history', ensureAdmin, LeaveController.getAdminHistory);
router.put('/admin/status/:id', ensureAdmin, LeaveController.updateLeaveStatus);

// Admin Leave Policy Routes
router.get('/policies', ensureAdmin, LeavePolicyController.getLeavePolicies);
router.post('/policies', ensureAdmin, LeavePolicyController.createLeavePolicy);
router.get('/policies/:lp_id', ensureAdmin, LeavePolicyController.getLeavePolicyById);
router.put('/policies/:lp_id', ensureAdmin, LeavePolicyController.updateLeavePolicy);
router.delete('/policies/:lp_id', ensureAdmin, LeavePolicyController.deleteLeavePolicy);

// Admin Leave Policy Rule Routes
router.post('/policies/:lp_id/rules', ensureAdmin, LeavePolicyController.createLeavePolicyRule);
router.put('/policies/:lp_id/rules/:rule_id', ensureAdmin, LeavePolicyController.updateLeavePolicyRule);
router.delete('/policies/:lp_id/rules/:rule_id', ensureAdmin, LeavePolicyController.deleteLeavePolicyRule);

// Admin Leave Balance Routes
router.get('/balances', LeaveBalanceController.getMyLeaveBalance);
router.get('/balances/all', ensureAdmin, LeaveBalanceController.getAllEmployeesLeaveBalances);
router.get('/balances/:user_id', ensureAdmin, LeaveBalanceController.getEmployeeLeaveBalance);
router.put('/balances/:lb_id', ensureAdmin, LeaveBalanceController.updateLeaveBalance);
router.post('/balances', ensureAdmin, LeaveBalanceController.setLeaveBalance);
router.delete('/balances/:lb_id', ensureAdmin, LeaveBalanceController.deleteLeaveBalance);

export default router;