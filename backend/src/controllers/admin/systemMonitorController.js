import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getFileUrl } from '../../services/s3/s3Service.js';
import { getHistoryLogs, getFilteredLogs } from '../../services/superAdmin/pm2Service.js';

// --- Security Alerts ---
export const getSecurityAlerts = async (req, res, next) => {
    try {
        const alerts = await attendanceDB('security_alerts')
            .leftJoin('users', 'security_alerts.user_id', 'users.user_id')
            .leftJoin('organizations', 'security_alerts.org_id', 'organizations.org_id')
            .select(
                'security_alerts.*',
                'users.user_name', 'users.email',
                'organizations.org_name'
            )
            .orderBy('security_alerts.created_at', 'desc');

        res.status(200).json({ status: 'success', data: alerts });
    } catch (error) {
        next(error);
    }
};

export const updateSecurityAlertStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'open', 'resolved'

        if (!['open', 'resolved'].includes(status)) {
            throw new AppError("Status must be 'open' or 'resolved'", 400);
        }

        const affected = await attendanceDB('security_alerts')
            .where({ id })
            .update({ status });

        if (affected === 0) throw new AppError("Security alert not found", 404);

        res.status(200).json({ status: 'success', message: 'Alert status updated successfully' });
    } catch (error) {
        next(error);
    }
};

// --- User Feedback ---
export const getUserFeedback = async (req, res, next) => {
    try {
        const feedback = await attendanceDB('feedback')
            .leftJoin('users', 'feedback.user_id', 'users.user_id')
            .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
            .select(
                'feedback.*',
                'users.user_name', 'users.email',
                'organizations.org_name', 'organizations.org_id'
            )
            .orderBy('feedback.created_at', 'desc');

        // Fetch attachments for all feedback
        const feedbackIds = feedback.map(f => f.feedback_id);
        let attachments = [];
        if (feedbackIds.length > 0) {
            attachments = await attendanceDB('feedback_attachments')
                .whereIn('feedback_id', feedbackIds)
                .select('attachment_id', 'feedback_id', 'file_name', 'file_key', 'file_type');
        }

        // Generate map of attachments
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

        // Stitch attachments
        const feedbackWithAttachments = feedback.map(f => ({
            ...f,
            attachments: feedbackAttachmentsMap[f.feedback_id] || []
        }));

        res.status(200).json({ status: 'success', data: feedbackWithAttachments });
    } catch (error) {
        next(error);
    }
};

export const updateFeedbackStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pending', 'reviewed', 'resolved'

        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            throw new AppError("Invalid feedback status", 400);
        }

        const affected = await attendanceDB('feedback')
            .where({ feedback_id: id })
            .update({ status, updated_at: attendanceDB.fn.now() });

        if (affected === 0) throw new AppError("Feedback not found", 404);

        res.status(200).json({ status: 'success', message: 'Feedback status updated successfully' });
    } catch (error) {
        next(error);
    }
};

// Helper to classify Express route path to specific application module
const getModuleFromPath = (path) => {
    if (!path) return 'General';
    const lowerPath = path.toLowerCase();
    
    // Normalize path by stripping the global /api prefix if present
    let apiPath = lowerPath;
    if (apiPath.startsWith('/api')) {
        apiPath = apiPath.slice(4);
    }
    if (!apiPath.startsWith('/')) {
        apiPath = '/' + apiPath;
    }

    if (apiPath.startsWith('/auth')) return 'Authentication';
    
    if (apiPath.startsWith('/attendance')) {
        if (apiPath.includes('monitor') || apiPath.includes('realtime') || apiPath.includes('live')) {
            return 'Live Attendance';
        }
        return 'Attendance';
    }
    
    if (apiPath.startsWith('/leaves')) return 'Leaves';
    if (apiPath.startsWith('/holiday')) return 'Holidays';
    if (apiPath.startsWith('/policies')) return 'Shift Policies';
    if (apiPath.startsWith('/notifications')) return 'Notifications';
    
    if (apiPath.startsWith('/dar')) {
        if (apiPath.includes('report')) return 'DAR Reports & AI';
        return 'DAR (Daily Activity)';
    }
    
    if (apiPath.startsWith('/organizations')) return 'Organizations';
    if (apiPath.startsWith('/employee')) return 'Employees';
    if (apiPath.startsWith('/profile')) return 'Profile';
    if (apiPath.startsWith('/feedback')) return 'Feedback';
    if (apiPath.startsWith('/payment')) return 'Payments';
    if (apiPath.startsWith('/website-chatbot') || apiPath.startsWith('/chatbot')) return 'Chatbot';
    if (apiPath.startsWith('/locations')) return 'Work Locations';
    
    if (apiPath.startsWith('/admin/reports') || apiPath.startsWith('/reports')) {
        return 'Reports & Summaries';
    }
    
    if (apiPath.startsWith('/super-admin/monitor')) {
        return 'System Monitor';
    }
    
    if (apiPath.startsWith('/super-admin')) {
        return 'Super Admin';
    }
    
    if (apiPath.startsWith('/admin')) {
        return 'Admin Portal';
    }
    
    return 'General';
};

export const getPM2Logs = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 100;
        const search = req.query.search || '';
        const startTime = req.query.startTime || null;
        const endTime = req.query.endTime || null;
        
        // Parse filters which can be sent as arrays
        const severities = req.query.severities ? (Array.isArray(req.query.severities) ? req.query.severities : [req.query.severities]) : [];
        const categories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : [];
        const sources = req.query.sources ? (Array.isArray(req.query.sources) ? req.query.sources : [req.query.sources]) : [];

        const result = await getFilteredLogs({
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
    } catch (error) {
        next(error);
    }
};

// --- API Analytics ---
export const getAPIAnalytics = async (req, res, next) => {
    try {
        const { timeframe = '24h' } = req.query;
        
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
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    attendanceDB.raw('COUNT(*) as total_calls'),
                    attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_latency'),
                    attendanceDB.raw('MAX(duration_ms) as max_latency'),
                    attendanceDB.raw('SUM(CASE WHEN is_success = 0 THEN 1 ELSE 0 END) as error_calls'),
                    attendanceDB.raw('COUNT(DISTINCT user_id) as active_users'),
                    attendanceDB.raw('COUNT(DISTINCT org_id) as active_orgs')
                ).first(),

            // 2. Volume & Stress per Route Pattern (Cleaned parameterized endpoints)
            attendanceDB('api_request_logs')
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
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    'module_name as module',
                    attendanceDB.raw('COUNT(*) as count'),
                    attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_duration_ms')
                )
                .groupBy('module_name')
                .orderBy('count', 'desc'),

            // 4. Status Code Distribution
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    'status_code',
                    attendanceDB.raw('COUNT(*) as count')
                )
                .groupBy('status_code')
                .orderBy('status_code', 'asc'),

            // 5. Timeline Chart
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    attendanceDB.raw(`DATE_FORMAT(occurred_at, '${groupFormat}') as time_bucket`),
                    attendanceDB.raw('COUNT(*) as count'),
                    attendanceDB.raw('ROUND(AVG(duration_ms), 2) as avg_duration_ms')
                )
                .groupBy('time_bucket')
                .orderBy('time_bucket', 'asc'),

            // 6. Platform / Source Distribution (WEB, MOBILE_APP, API)
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    'event_source as platform',
                    attendanceDB.raw('COUNT(*) as count')
                )
                .groupBy('event_source'),

            // 7. Client Type Distribution (e.g. Android App, iOS App, Chrome Browser)
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    'client_type',
                    attendanceDB.raw('COUNT(*) as count')
                )
                .groupBy('client_type')
                .orderBy('count', 'desc'),

            // 8. Device Type Distribution (Mobile, Tablet, Desktop)
            attendanceDB('api_request_logs')
                .where('occurred_at', '>=', intervalQuery)
                .select(
                    'device_type',
                    attendanceDB.raw('COUNT(*) as count')
                )
                .groupBy('device_type')
                .orderBy('count', 'desc'),

            // 9. OS Distribution (Android, iOS, Windows, macOS, Linux)
            attendanceDB('api_request_logs')
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

        res.status(200).json({
            status: 'success',
            data: {
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
            }
        });
    } catch (error) {
        next(error);
    }
};

