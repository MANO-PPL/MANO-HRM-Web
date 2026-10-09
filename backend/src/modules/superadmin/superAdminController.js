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

// --- Session & Token Management ---
export const getSessions = catchAsync(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const {
        page = 1,
        limit = 20,
        search,
        status = 'all',
        device_type = 'all',
        browser = 'all',
        os = 'all',
        user_type = 'all',
        org_id,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = req.query;

    const result = await superAdminService.getSessions({
        page,
        limit,
        search,
        status,
        device_type,
        browser,
        os,
        user_type,
        org_id,
        sortBy,
        sortOrder
    });

    res.status(200).json({
        status: 'success',
        data: result.sessions,
        pagination: result.pagination,
        stats: result.stats,
        organizations: result.organizations
    });
});

export const getSessionStats = catchAsync(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const stats = await superAdminService.getSessionMetrics();
    res.status(200).json({
        status: 'success',
        data: stats
    });
});

export const revokeSession = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const result = await superAdminService.revokeSessionById(id);
    res.status(200).json({
        status: 'success',
        message: result.message
    });
});

export const bulkRevokeSessions = catchAsync(async (req, res, next) => {
    const { ids } = req.body;
    const result = await superAdminService.bulkRevokeSessions(ids);
    res.status(200).json({
        status: 'success',
        count: result.count,
        message: result.message
    });
});

export const revokeAllUserSessions = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const result = await superAdminService.revokeAllUserSessions(userId);
    res.status(200).json({
        status: 'success',
        count: result.count,
        message: result.message
    });
});

export const cleanupExpiredSessions = catchAsync(async (req, res, next) => {
    const result = await superAdminService.cleanupExpiredSessions();
    res.status(200).json({
        status: 'success',
        count: result.count,
        message: result.message
    });
});

// --- FCM Device Push Tokens ---
export const getDeviceTokens = catchAsync(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { page = 1, limit = 20, search, device_type = 'all' } = req.query;
    const result = await superAdminService.getDeviceTokens({ page, limit, search, device_type });
    res.status(200).json({
        status: 'success',
        data: result.deviceTokens,
        pagination: result.pagination
    });
});

export const deleteDeviceToken = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const result = await superAdminService.deleteDeviceToken(id);
    res.status(200).json({
        status: 'success',
        message: result.message
    });
});

