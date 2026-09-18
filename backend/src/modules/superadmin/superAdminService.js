import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getFileUrl } from '../../services/s3/s3Service.js';
import { getFilteredLogs } from './pm2Service.js';

export const getDashboardStats = async () => {
    const [
        totalOrgsRes,
        totalUsersRes,
        pendingFeedbackRes,
        openAlertsRes,
        totalApiCountRes,
        totalErrorsRes,
        moduleDistribution,
        orgStatusDistribution
    ] = await Promise.all([
        attendanceDB('core_organizations').count('* as count').first(),
        attendanceDB('core_users').count('* as count').where('is_deleted', 0).first(),
        attendanceDB('feedback_tickets')
            .count('* as count')
            .whereIn('status', ['pending', 'open', 'OPEN', 'PENDING', ''])
            .orWhereNull('status')
            .first(),
        attendanceDB('sys_security_alerts')
            .count('* as count')
            .whereIn('status', ['open', 'unseen', 'OPEN', 'UNSEEN'])
            .first(),
        attendanceDB('sys_api_logs').count('* as count').first(),
        attendanceDB('sys_error_logs').count('error_id as count').first(),
        attendanceDB('sys_api_logs').select('module_name as module').count('* as count').groupBy('module_name'),
        attendanceDB('core_organizations').select('status').count('* as count').groupBy('status')
    ]);

    // Clean module distribution names
    const cleanedModuleDistribution = (moduleDistribution || [])
        .map(item => {
            let name = item.module || 'General';
            if (name === 'API_ENDPOINT' || name === 'API') name = 'General';
            return {
                module: name,
                count: Number(item.count) || 0
            };
        })
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.module === curr.module);
            if (existing) {
                existing.count += curr.count;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

    // Clean organization status names
    const cleanedOrgStatusDistribution = (orgStatusDistribution || [])
        .map(item => {
            let status = item.status || 'active';
            if (!status || status === '') status = 'active';
            return {
                status,
                count: Number(item.count) || 0
            };
        })
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.status === curr.status);
            if (existing) {
                existing.count += curr.count;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

    return {
        totalOrgs: Number(totalOrgsRes?.count) || 0,
        totalUsers: Number(totalUsersRes?.count) || 0,
        pendingFeedback: Number(pendingFeedbackRes?.count) || 0,
        openAlerts: Number(openAlertsRes?.count) || 0,
        totalApiCalls: Number(totalApiCountRes?.count) || 0,
        totalErrors: Number(totalErrorsRes?.count) || 0,
        moduleDistribution: cleanedModuleDistribution,
        orgStatusDistribution: cleanedOrgStatusDistribution
    };
};

// --- Security Alerts ---
export const getSecurityAlerts = async () => {
    return await attendanceDB('sys_security_alerts')
        .leftJoin('core_users', 'sys_security_alerts.user_id', 'core_users.user_id')
        .leftJoin('core_organizations', 'sys_security_alerts.org_id', 'core_organizations.org_id')
        .select(
            'sys_security_alerts.*',
            'core_users.user_name', 'core_users.email',
            'core_organizations.org_name'
        )
        .orderBy('sys_security_alerts.created_at', 'desc');
};

export const updateSecurityAlertStatus = async (id, status) => {
    if (!['open', 'resolved'].includes(status)) {
        throw new AppError("Status must be 'open' or 'resolved'", 400);
    }

    const affected = await attendanceDB('sys_security_alerts')
        .where({ id })
        .update({ status });

    if (affected === 0) throw new AppError("Security alert not found", 404);

    return affected;
};

// --- User Feedback ---
export const getUserFeedback = async () => {
    const feedback = await attendanceDB('feedback_tickets')
        .leftJoin('core_users', 'feedback_tickets.user_id', 'core_users.user_id')
        .leftJoin('core_organizations', 'core_users.org_id', 'core_organizations.org_id')
        .select(
            'feedback_tickets.*',
            'core_users.user_name', 'core_users.email',
            'core_organizations.org_name', 'core_organizations.org_id'
        )
        .orderBy('feedback_tickets.created_at', 'desc');

    const feedbackIds = feedback.map(f => f.feedback_id);
    let attachments = [];
    if (feedbackIds.length > 0) {
        attachments = await attendanceDB('feedback_attachments')
            .whereIn('feedback_id', feedbackIds)
            .select('attachment_id', 'feedback_id', 'file_name', 'file_key', 'file_type');
    }

    const feedbackAttachmentsMap = {};
    for (const attachment of attachments) {
        if (!feedbackAttachmentsMap[attachment.feedback_id]) {
            feedbackAttachmentsMap[attachment.feedback_id] = [];
        }
        let url = null;
        try {
            if (attachment.file_key) {
                const res = await getFileUrl({ key: attachment.file_key });
                if (res.success) url = res.url;
            }
        } catch (err) { }

        feedbackAttachmentsMap[attachment.feedback_id].push({
            ...attachment,
            url
        });
    }

    return feedback.map(f => ({
        ...f,
        attachments: feedbackAttachmentsMap[f.feedback_id] || []
    }));
};

export const updateFeedbackStatus = async (id, status) => {
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
        throw new AppError("Invalid feedback status", 400);
    }

    const affected = await attendanceDB('feedback_tickets')
        .where({ feedback_id: id })
        .update({ status, updated_at: attendanceDB.fn.now() });

    if (affected === 0) throw new AppError("Feedback not found", 404);

    return affected;
};

// --- PM2 Logs ---
export const getPM2Logs = async ({ startTime, endTime, search, severities, categories, sources, page, limit }) => {
    return await getFilteredLogs({
        startTime,
        endTime,
        search,
        severities,
        categories,
        sources,
        page,
        limit
    });
};

// --- API Analytics ---
export const getAPIAnalytics = async (timeframe = '24h') => {
    let intervalQuery = attendanceDB.raw("NOW() - INTERVAL 24 HOUR");
    if (timeframe === '2h') intervalQuery = attendanceDB.raw("NOW() - INTERVAL 2 HOUR");
    else if (timeframe === '7d') intervalQuery = attendanceDB.raw("NOW() - INTERVAL 7 DAY");
    else if (timeframe === '30d') intervalQuery = attendanceDB.raw("NOW() - INTERVAL 30 DAY");

    let groupFormat = '%Y-%m-%d %H:00:00'; // Hourly
    if (timeframe === '7d' || timeframe === '30d') {
        groupFormat = '%Y-%m-%d 00:00:00'; // Daily
    }

    const [
        overviewRes,
        routesRes,
        modulesRes,
        statusCodesRes,
        timelineRes,
        platformsRes,
        clientsRes,
        devicesRes,
        osRes
    ] = await Promise.all([
        // 1. High-level Overview Metrics
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                attendanceDB.raw('COUNT(*) as total_calls'),
                attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_latency'),
                attendanceDB.raw('MAX(duration_ms) as max_latency'),
                attendanceDB.raw('SUM(CASE WHEN is_success = 0 THEN 1 ELSE 0 END) as error_calls'),
                attendanceDB.raw('COUNT(DISTINCT user_id) as active_users'),
                attendanceDB.raw('COUNT(DISTINCT org_id) as active_orgs')
            ).first(),

        // 2. Volume & Stress per Route Pattern
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'route_pattern as path',
                'method',
                'module_name as module',
                attendanceDB.raw('COUNT(*) as count'),
                attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_duration_ms'),
                attendanceDB.raw('MAX(duration_ms) as max_duration_ms'),
                attendanceDB.raw('SUM(CASE WHEN is_success = 0 THEN 1 ELSE 0 END) as errors')
            )
            .groupBy('route_pattern', 'method', 'module_name')
            .orderBy('count', 'desc')
            .limit(100),

        // 3. Usage by Feature/Module
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'module_name as module',
                attendanceDB.raw('COUNT(*) as count'),
                attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_duration_ms')
            )
            .groupBy('module_name')
            .orderBy('count', 'desc'),

        // 4. Status Code Distribution
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'status_code',
                attendanceDB.raw('COUNT(*) as count')
            )
            .groupBy('status_code')
            .orderBy('status_code', 'asc'),

        // 5. Timeline Chart
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                attendanceDB.raw(`DATE_FORMAT(occurred_at, '${groupFormat}') as time_bucket`),
                attendanceDB.raw('COUNT(*) as count'),
                attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_duration_ms')
            )
            .groupBy('time_bucket')
            .orderBy('time_bucket', 'asc'),

        // 6. Platform / Source Distribution
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'event_source as platform',
                attendanceDB.raw('COUNT(*) as count')
            )
            .groupBy('event_source'),

        // 7. Client Type Distribution
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'client_type',
                attendanceDB.raw('COUNT(*) as count')
            )
            .groupBy('client_type')
            .orderBy('count', 'desc'),

        // 8. Device Type Distribution
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'device_type',
                attendanceDB.raw('COUNT(*) as count')
            )
            .groupBy('device_type')
            .orderBy('count', 'desc'),

        // 9. OS Distribution
        attendanceDB('sys_api_logs')
            .where('occurred_at', '>=', intervalQuery)
            .select(
                'client_os as os',
                attendanceDB.raw('COUNT(*) as count')
            )
            .groupBy('client_os')
            .orderBy('count', 'desc')
    ]);

    const totalCalls = Number(overviewRes?.total_calls) || 0;
    const errorCalls = Number(overviewRes?.error_calls) || 0;
    const errorRate = totalCalls > 0 ? parseFloat(((errorCalls / totalCalls) * 100).toFixed(2)) : 0;

    return {
        overview: {
            total_calls: totalCalls,
            avg_latency_ms: Number(overviewRes?.avg_latency) || 0,
            max_latency_ms: Number(overviewRes?.max_latency) || 0,
            error_rate: errorRate,
            active_users: Number(overviewRes?.active_users) || 0,
            active_orgs: Number(overviewRes?.active_orgs) || 0
        },
        routes: routesRes,
        modules: modulesRes,
        statusCodes: statusCodesRes,
        platforms: platformsRes,
        clients: clientsRes,
        devices: devicesRes,
        os: osRes,
        timeline: timelineRes
    };
};

// --- Client Errors ---
export const logClientError = async ({ errorMessage, stackTrace, requestPath, platform, extraContext, userId, orgId, clientIp, userAgent }) => {
    if (!errorMessage) {
        throw new AppError("Error message is required", 400);
    }

    const occurredAt = new Date();

    return await attendanceDB('sys_error_logs').insert({
        level: 'CLIENT_ERROR',
        service_name: platform === 'MOBILE_APP' ? 'frontend-mobile' : 'frontend-web',
        environment: process.env.NODE_ENV || 'production',
        user_id: userId || null,
        org_id: orgId || null,
        error_message: errorMessage,
        stack_trace: stackTrace || null,
        request_path: requestPath || null,
        client_ip: clientIp || null,
        extra_context: JSON.stringify({
            platform: platform || 'WEB',
            userAgent: userAgent || 'Unknown',
            ...extraContext
        }),
        occurred_at: occurredAt
    });
};

// --- Debug Logs ---
export const getDebugLogs = async ({ userId, orgId, platform, type = 'all', search, limit = 50, page = 1 }) => {
    const parsedLimit = Math.min(parseInt(limit), 200);
    const parsedPage = Math.max(parseInt(page), 1);
    const offset = (parsedPage - 1) * parsedLimit;

    let query;
    let countQuery;

    if (type === 'errors' || type === 'client_errors') {
        query = attendanceDB('sys_error_logs as el')
            .leftJoin('core_users as u', 'el.user_id', 'u.user_id')
            .leftJoin('core_organizations as o', 'el.org_id', 'o.org_id')
            .select('el.*', 'u.user_name', 'u.email', 'o.org_name')
            .orderBy('el.occurred_at', 'desc');

        countQuery = attendanceDB('sys_error_logs');

        if (type === 'client_errors') {
            query = query.where('el.level', 'CLIENT_ERROR');
            countQuery = countQuery.where('level', 'CLIENT_ERROR');
        } else {
            query = query.where('el.level', '!=', 'CLIENT_ERROR');
            countQuery = countQuery.where('level', '!=', 'CLIENT_ERROR');
        }

        if (userId) {
            query = query.where('el.user_id', userId);
            countQuery = countQuery.where('user_id', userId);
        }
        if (orgId) {
            query = query.where('el.org_id', orgId);
            countQuery = countQuery.where('org_id', orgId);
        }
        if (platform) {
            const searchPlatform = `%"platform":"${platform}"%`;
            query = query.where('el.extra_context', 'like', searchPlatform);
            countQuery = countQuery.where('extra_context', 'like', searchPlatform);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            query = query.andWhere(function() {
                this.where('el.error_message', 'like', searchQuery)
                    .orWhere('el.request_path', 'like', searchQuery)
                    .orWhere('u.user_name', 'like', searchQuery)
                    .orWhere('o.org_name', 'like', searchQuery);
            });
            countQuery = countQuery.andWhere(function() {
                this.where('error_message', 'like', searchQuery)
                    .orWhere('request_path', 'like', searchQuery);
            });
        }
    } else {
        query = attendanceDB('sys_api_logs as al')
            .leftJoin('core_users as u', 'al.user_id', 'u.user_id')
            .leftJoin('core_organizations as o', 'al.org_id', 'o.org_id')
            .select('al.*', 'u.user_name', 'u.email', 'o.org_name')
            .where('al.is_success', 0)
            .orderBy('al.occurred_at', 'desc');

        countQuery = attendanceDB('sys_api_logs').where('is_success', 0);

        if (userId) {
            query = query.where('al.user_id', userId);
            countQuery = countQuery.where('user_id', userId);
        }
        if (orgId) {
            query = query.where('al.org_id', orgId);
            countQuery = countQuery.where('org_id', orgId);
        }
        if (platform) {
            query = query.where('al.event_source', platform);
            countQuery = countQuery.where('event_source', platform);
        }
        if (search) {
            const searchQuery = `%${search}%`;
            query = query.andWhere(function() {
                this.where('al.request_path', 'like', searchQuery)
                    .orWhere('al.route_pattern', 'like', searchQuery)
                    .orWhere('u.user_name', 'like', searchQuery)
                    .orWhere('o.org_name', 'like', searchQuery)
                    .orWhere('al.client_os', 'like', searchQuery)
                    .orWhere('al.device_type', 'like', searchQuery);
            });
            countQuery = countQuery.andWhere(function() {
                this.where('request_path', 'like', searchQuery)
                    .orWhere('route_pattern', 'like', searchQuery);
            });
        }
    }

    const [totalRes, logs] = await Promise.all([
        countQuery.count('* as count').first(),
        query.limit(parsedLimit).offset(offset)
    ]);

    const total = totalRes ? parseInt(totalRes.count) : 0;

    return {
        logs,
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
    };
};
