import fs from 'fs';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
};

// Default log level configurations: INFO in production, DEBUG in dev
const getActiveLogLevel = () => {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
        return LOG_LEVELS[envLevel];
    }
    return process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const ACTIVE_LOG_LEVEL = getActiveLogLevel();

// Keep references to original console methods to prevent infinite loop
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

const CATEGORY_RULES = {
    Database: /(knex|mysql|db_host|3306|3307|database|query|table initialization)/i,
    'Cache & Queues': /(redis|bullmq|cache|6379|queue|job|worker|elasticache)/i,
    'Security & Auth': /(auth|login|token|jwt|unauthorized|forbidden|otp|captcha|fcmService|security alert)/i,
    'FCM & Push': /(fcm|firebase|push notification|registered devices|admin sdk)/i,
    'API & Requests': /(get\s\/|post\s\/|put\s\/|delete\s\/|api_call|route path|status_code)/i
};

const SEVERITY_RULES = {
    CRITICAL: /(uncaughtexception|unhandledrejection|fatal|crashed|app crashed|econnrefused|etimedout|enotfound)/i
};

// Helper to determine category from string content
const detectCategory = (str) => {
    for (const [cat, regex] of Object.entries(CATEGORY_RULES)) {
        if (regex.test(str)) return cat;
    }
    return 'System';
};

// Helper to check for critical keywords in errors
const detectSeverity = (str, defaultSev) => {
    if (defaultSev === 'ERROR' && SEVERITY_RULES.CRITICAL.test(str)) {
        return 'CRITICAL';
    }
    return defaultSev;
};

// Helper to format argument objects to string
const argsToString = (args) => {
    return args.map(arg => {
        if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack || ''}`;
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
};

// Format standard telemetry log line: [Timestamp] [Severity] [Category] Message
const formatLogLine = (severity, category, message) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${severity}] [${category}] ${message}`;
};

export const initializeLogger = () => {
    // Override console.log (Mapped to INFO)
    console.log = (...args) => {
        if (LOG_LEVELS.INFO < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        originalLog(formatLogLine('INFO', category, msg));
    };

    // Override console.info (Mapped to INFO)
    console.info = (...args) => {
        if (LOG_LEVELS.INFO < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        originalInfo(formatLogLine('INFO', category, msg));
    };

    // Override console.warn (Mapped to WARN)
    console.warn = (...args) => {
        if (LOG_LEVELS.WARN < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        originalWarn(formatLogLine('WARN', category, msg));
    };

    // Override console.error (Mapped to ERROR/CRITICAL)
    console.error = (...args) => {
        if (LOG_LEVELS.ERROR < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        const severity = detectSeverity(msg, 'ERROR');
        originalError(formatLogLine(severity, category, msg));
    };
    
    // Explicitly expose custom debug and critical logs
    console.critical = (...args) => {
        if (LOG_LEVELS.CRITICAL < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        originalError(formatLogLine('CRITICAL', category, msg));
    };

    console.debug = (...args) => {
        if (LOG_LEVELS.DEBUG < ACTIVE_LOG_LEVEL) return;
        const msg = argsToString(args);
        const category = detectCategory(msg);
        originalLog(formatLogLine('DEBUG', category, msg));
    };
};
