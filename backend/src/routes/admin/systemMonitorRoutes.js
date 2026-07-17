import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import AppError from '../../utils/AppError.js';
import * as monitorController from '../../controllers/admin/systemMonitorController.js';

const router = express.Router();

// Middleware to ensure only Super Admins can access these routes
const requireSuperAdmin = (req, res, next) => {
    if (req.user.user_type !== 'super_admin') {
        return next(new AppError('Forbidden: System Monitor access requires Super Admin privileges', 403));
    }
    next();
};

router.use(authenticateJWT, requireSuperAdmin);

// Security Alerts
router.get('/alerts', monitorController.getSecurityAlerts);
router.put('/alerts/:id', monitorController.updateSecurityAlertStatus);

// User Feedback
router.get('/feedback', monitorController.getUserFeedback);
router.put('/feedback/:id', monitorController.updateFeedbackStatus);

// PM2 Logs Console
router.get('/pm2-logs', monitorController.getPM2Logs);

// API Analytics
router.get('/api-analytics', monitorController.getAPIAnalytics);

// Debug Logs & Client Errors
router.get('/debug-logs', monitorController.getDebugLogs);
router.post('/client-errors', monitorController.postClientError);

export default router;
