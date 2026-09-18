import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import AppError from '../../utils/AppError.js';
import * as superAdminController from './superAdminController.js';

const router = express.Router();

// Middleware to ensure only Super Admins can access these routes
const requireSuperAdmin = (req, res, next) => {
    if (req.user?.user_type !== 'super_admin') {
        return next(new AppError('Forbidden: Super Admin privileges required', 403));
    }
    next();
};

router.use(authenticateJWT, requireSuperAdmin);

// Platform Dashboard Stats
router.get('/dashboard-stats', superAdminController.getDashboardStats);

// Security Alerts
router.get('/monitor/alerts', superAdminController.getSecurityAlerts);
router.put('/monitor/alerts/:id', superAdminController.updateSecurityAlertStatus);

// User Feedback
router.get('/monitor/feedback', superAdminController.getUserFeedback);
router.put('/monitor/feedback/:id', superAdminController.updateFeedbackStatus);

// PM2 Logs Console
router.get('/monitor/pm2-logs', superAdminController.getPM2Logs);

// API Analytics
router.get('/monitor/api-analytics', superAdminController.getAPIAnalytics);

// Debug Logs & Client Errors
router.get('/monitor/debug-logs', superAdminController.getDebugLogs);
router.post('/monitor/client-errors', superAdminController.postClientError);

export default router;
