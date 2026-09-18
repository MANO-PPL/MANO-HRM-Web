import catchAsync from '../../utils/catchAsync.js';
import * as superAdminService from './superAdminService.js';

// --- Platform Dashboard Stats ---
export const getDashboardStats = catchAsync(async (req, res, next) => {
    // Only super_admin allowed
    if (req.user.user_type !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const stats = await superAdminService.getDashboardStats();
    res.json({ success: true, data: stats });
});

// --- Security Alerts ---
export const getSecurityAlerts = catchAsync(async (req, res, next) => {
    const alerts = await superAdminService.getSecurityAlerts();
    res.status(200).json({ status: 'success', data: alerts });
});

export const updateSecurityAlertStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;
    await superAdminService.updateSecurityAlertStatus(id, status);
    res.status(200).json({ status: 'success', message: 'Alert status updated successfully' });
});

// --- User Feedback ---
export const getUserFeedback = catchAsync(async (req, res, next) => {
    const feedback = await superAdminService.getUserFeedback();
    res.status(200).json({ status: 'success', data: feedback });
});

export const updateFeedbackStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;
    await superAdminService.updateFeedbackStatus(id, status);
    res.status(200).json({ status: 'success', message: 'Feedback status updated successfully' });
});

// --- PM2 Logs ---
export const getPM2Logs = catchAsync(async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const search = req.query.search || '';
    const startTime = req.query.startTime || null;
    const endTime = req.query.endTime || null;
    
    const severities = req.query.severities ? (Array.isArray(req.query.severities) ? req.query.severities : [req.query.severities]) : [];
    const categories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : [];
    const sources = req.query.sources ? (Array.isArray(req.query.sources) ? req.query.sources : [req.query.sources]) : [];

    const result = await superAdminService.getPM2Logs({
        startTime,
        endTime,
        search,
        severities,
        categories,
        sources,
        page,
        limit
    });

    res.status(200).json({ 
        status: 'success', 
        data: result.logs,
        hasMore: result.hasMore,
        total: result.total
    });
});

// --- API Analytics ---
export const getAPIAnalytics = catchAsync(async (req, res, next) => {
    const { timeframe = '24h' } = req.query;
    const data = await superAdminService.getAPIAnalytics(timeframe);

    res.status(200).json({
        status: 'success',
        data
    });
});

// --- Post Client Error ---
export const postClientError = catchAsync(async (req, res, next) => {
    const { errorMessage, stackTrace, requestPath, platform, extraContext } = req.body;

    await superAdminService.logClientError({
        errorMessage,
        stackTrace,
        requestPath,
        platform,
        extraContext,
        userId: req.user?.user_id || req.user?.id || null,
        orgId: req.user?.org_id || null,
        clientIp: req.clientIp || req.ip || null,
        userAgent: req.get('User-Agent') || 'Unknown'
    });

    res.status(201).json({
        status: 'success',
        message: 'Client error logged successfully'
    });
});

// --- Get Debug Logs ---
export const getDebugLogs = catchAsync(async (req, res, next) => {
    const { 
        userId, 
        orgId, 
        platform, 
        type = 'all', 
        search, 
        limit = 50, 
        page = 1 
    } = req.query;

    const result = await superAdminService.getDebugLogs({
        userId,
        orgId,
        platform,
        type,
        search,
        limit,
        page
    });

    res.status(200).json({
        status: 'success',
        data: result.logs,
        pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: result.pages
        }
    });
});
