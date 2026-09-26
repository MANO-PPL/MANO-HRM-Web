import EventBus from '../utils/EventBus.js';
import { parseClientInfo } from '../utils/clientInfo.js';

// Keys are compared after normalizing case and removing "_" / "-", so
// newPassword, new_password and NEW-PASSWORD all match "newpassword".
const SENSITIVE_KEYS = new Set([
    'password', 'userpassword', 'adminpassword', 'adminpasswordconfirm',
    'newpassword', 'oldpassword', 'currentpassword', 'confirmpassword',
    'token', 'accesstoken', 'refreshtoken', 'resettoken', 'jwt',
    'otp', 'pin', 'secret', 'captcha', 'captchatoken', 'captchatext',
    'authorization', 'cookie', 'razorpaysignature'
]);

const normalizeKey = (key) => key.toLowerCase().replace(/[_-]/g, '');

// Request bodies on these paths carry credentials; never persist them
const BODY_EXCLUDED_PREFIXES = ['/auth/', '/api/auth/'];

// Recursive helper to mask sensitive fields in request bodies
export function maskSensitiveFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (SENSITIVE_KEYS.has(normalizeKey(key))) {
                masked[key] = '********';
            } else if (typeof val === 'object' && val !== null) {
                masked[key] = maskSensitiveFields(val);
            } else {
                masked[key] = val;
            }
        }
    }
    
    return masked;
}

// Helper to classify Express route path to specific application module
function getModuleFromPath(path) {
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
}

export const apiMonitor = (req, res, next) => {
    // Record start time
    const startTime = process.hrtime();
    
    // Track original path (ignoring query strings)
    const requestPath = req.originalUrl.split('?')[0];

    // Mask request body/query for privacy compliance
    const skipBody = BODY_EXCLUDED_PREFIXES.some((prefix) => requestPath.toLowerCase().startsWith(prefix));
    const maskedBody = skipBody ? null : maskSensitiveFields(req.body);
    const maskedQuery = maskSensitiveFields(req.query);

    // Listen to response finish event (fires when response is fully sent)
    res.on('finish', () => {
        // Calculate response duration in milliseconds
        const diff = process.hrtime(startTime);
        const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

        // Capture user context (extracted downstream by authenticateJWT middleware)
        const userId = req.user?.id || req.user?.user_id || null;
        const orgId = req.user?.org_id || null;

        // Classify path into application module
        const moduleName = getModuleFromPath(requestPath);

        // Determine if request was a success or failure
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

        // Skip standard high-frequency health checks to avoid noise
        if (requestPath === '/health' || requestPath === '/api/health') return;

        // Parse client and device details
        const clientInfo = parseClientInfo(req);

        // Extract Express route pattern
        const routePattern = req.route ? `${req.baseUrl || ''}${req.route.path}` : requestPath;

        // Emit log event
        try {
            EventBus.emitApiRequest({
                user_id: userId,
                org_id: orgId,
                request_path: requestPath,
                route_pattern: routePattern,
                method: req.method,
                status_code: res.statusCode,
                duration_ms: durationMs,
                is_success: isSuccess,
                event_source: clientInfo.event_source,
                module_name: moduleName,
                client_os: clientInfo.client_os,
                client_type: clientInfo.client_type,
                device_type: clientInfo.device_type,
                request_ip: req.clientIp || req.ip || null,
                user_agent: req.headers['user-agent'] || null,
                payload_details: {
                    body: (maskedBody && typeof maskedBody === 'object' && Object.keys(maskedBody).length > 0) ? maskedBody : null,
                    query: (maskedQuery && typeof maskedQuery === 'object' && Object.keys(maskedQuery).length > 0) ? maskedQuery : null,
                }
            });
        } catch (err) {
            console.error('[API Monitor Error] Failed to emit log:', err);
        }
    });

    next();
};

