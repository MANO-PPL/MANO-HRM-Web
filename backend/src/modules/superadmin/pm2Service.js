import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root of backend directory: backend/src/modules/superadmin -> ../../../
const BACKEND_DIR = path.resolve(__dirname, '../../..');

// Production candidate paths on Linux / EC2
const PROD_CANDIDATE_PATHS = [
    { out: '/home/ubuntu/.pm2/logs/ATTENDANCE-BACKEND-out.log', err: '/home/ubuntu/.pm2/logs/ATTENDANCE-BACKEND-error.log' },
    { out: '/home/ubuntu/.pm2/logs/backend-out.log', err: '/home/ubuntu/.pm2/logs/backend-error.log' },
    { out: '/root/.pm2/logs/ATTENDANCE-BACKEND-out.log', err: '/root/.pm2/logs/ATTENDANCE-BACKEND-error.log' },
    { out: '/root/.pm2/logs/backend-out.log', err: '/root/.pm2/logs/backend-error.log' },
];

export const getLogPaths = () => {
    // 1. Explicit environment variables
    if (process.env.PM2_OUT_LOG_PATH && process.env.PM2_ERR_LOG_PATH) {
        if (fs.existsSync(process.env.PM2_OUT_LOG_PATH)) {
            return { out: process.env.PM2_OUT_LOG_PATH, err: process.env.PM2_ERR_LOG_PATH };
        }
    }

    // 2. Production EC2 candidate paths
    for (const cand of PROD_CANDIDATE_PATHS) {
        try {
            if (fs.existsSync(cand.out)) {
                return { out: cand.out, err: cand.err };
            }
        } catch (e) {}
    }

    // 3. User PM2 directory (e.g. ~/.pm2/logs or %USERPROFILE%\.pm2\logs)
    try {
        const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
        const pm2LogsDir = path.join(pm2Home, 'logs');
        if (fs.existsSync(pm2LogsDir)) {
            const possibleNames = ['ATTENDANCE-BACKEND', 'backend', 'mano-backend', 'app', 'server'];
            for (const name of possibleNames) {
                const outPath = path.join(pm2LogsDir, `${name}-out.log`);
                const errPath = path.join(pm2LogsDir, `${name}-error.log`);
                if (fs.existsSync(outPath)) {
                    return { out: outPath, err: errPath };
                }
            }
        }
    } catch (e) {}

    // 4. Backend workspace local log files
    const localOut = path.join(BACKEND_DIR, 'backend-pm2-out.log');
    const localErr = path.join(BACKEND_DIR, 'backend-pm2-error.log');

    // Ensure the local dev log files exist so they can always be read and tailed
    try {
        if (!fs.existsSync(localOut)) {
            fs.writeFileSync(localOut, `[${new Date().toISOString()}] [INFO] [System] Application log stream initialized.\n`, 'utf8');
        }
        if (!fs.existsSync(localErr)) {
            fs.writeFileSync(localErr, `[${new Date().toISOString()}] [WARN] [System] Application error stream initialized.\n`, 'utf8');
        }
    } catch (e) {
        console.error('[PM2 Service] Error initializing local log files:', e);
    }

    return { out: localOut, err: localErr };
};

// Regex classification rules
const SEVERITY_RULES = {
    CRITICAL: /(error:|typeerror:|referenceerror:|syntaxerror:|uncaughtexception|unhandledrejection|fatal|crashed|app crashed|econnrefused|etimedout|enotfound)/i,
    WARNING: /(warning|warn|deprecated|slow query|timeout|disconnected|redis connection error|401 unauthorized|403 forbidden|token invalid|rate limit exceeded)/i,
    INFO: /(listening|connected|ready|initialized|200 ok|201 created|304 not modified|scheduled|scheduler)/i
};

const CATEGORY_RULES = {
    Database: /(knex|mysql|db_host|3306|3307|database|query|table initialization)/i,
    'Cache & Queues': /(redis|bullmq|cache|6379|queue|job|worker|elasticache)/i,
    'Security & Auth': /(auth|login|token|jwt|unauthorized|forbidden|otp|captcha|fcmService|security alert)/i,
    'FCM & Push': /(fcm|firebase|push notification|registered devices|admin sdk)/i,
    'API & Requests': /(get\s\/|post\s\/|put\s\/|delete\s\/|api_call|route path|status_code)/i
};

// Helper to classify log line
export const parseLogLine = (line, type = 'stdout') => {
    if (!line || typeof line !== 'string' || line.trim() === '') return null;

    // Check if it fits the new standardized format: [Timestamp] [Severity] [Category] Message
    const stdMatch = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/s);
    if (stdMatch) {
        let timestamp = stdMatch[1];
        try {
            timestamp = new Date(timestamp).toISOString();
        } catch (e) {}
        
        return {
            timestamp,
            severity: stdMatch[2].toUpperCase(),
            category: stdMatch[3],
            message: stdMatch[4],
            source: type === 'stderr' ? 'stderr' : 'stdout'
        };
    }

    // Check if it fits the standardized format without timestamp: [Severity] [Category] Message
    const stdMatchNoTs = line.match(/^\[(DEBUG|INFO|WARN|ERROR|CRITICAL)\]\s+\[([^\]]+)\]\s+(.*)$/is);
    if (stdMatchNoTs) {
        return {
            timestamp: new Date().toISOString(),
            severity: stdMatchNoTs[1].toUpperCase(),
            category: stdMatchNoTs[2],
            message: stdMatchNoTs[3],
            source: type === 'stderr' ? 'stderr' : 'stdout'
        };
    }

    // Fallback: dynamic parsing for unformatted logs
    let timestamp = new Date().toISOString();
    let message = line;

    const tsMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)\]?\s*(.*)/);
    if (tsMatch) {
        try {
            timestamp = new Date(tsMatch[1]).toISOString();
        } catch (e) {}
        message = tsMatch[2];
    }

    let severity = 'INFO';
    if (type === 'stderr') {
        severity = 'WARNING';
    }
    if (SEVERITY_RULES.CRITICAL.test(line)) {
        severity = 'CRITICAL';
    } else if (SEVERITY_RULES.WARNING.test(line)) {
        severity = 'WARNING';
    } else if (SEVERITY_RULES.INFO.test(line)) {
        severity = 'INFO';
    }

    let category = 'System';
    for (const [key, regex] of Object.entries(CATEGORY_RULES)) {
        if (regex.test(line)) {
            category = key;
            break;
        }
    }

    return {
        timestamp,
        message,
        severity,
        category,
        source: type === 'stderr' ? 'stderr' : 'stdout'
    };
};

// Memory-efficient reader for last N lines of a log file
const readLastLines = async (filePath, maxLines = 150) => {
    let fileHandle;
    try {
        if (!filePath || !fs.existsSync(filePath)) return [];
        
        const stats = await fs.promises.stat(filePath);
        if (stats.size === 0) return [];

        fileHandle = await fs.promises.open(filePath, 'r');
        
        // Dynamically scale buffer based on requested maxLines (up to 4MB max)
        const requestedBytes = Math.max(1024 * 256, maxLines * 500);
        const bufferSize = Math.min(requestedBytes, stats.size, 1024 * 1024 * 4);
        const buffer = Buffer.alloc(bufferSize);
        
        await fileHandle.read(buffer, 0, bufferSize, stats.size - bufferSize);
        
        const text = buffer.toString('utf8');
        const lines = text.split('\n').filter(l => l.trim() !== '');
        
        return lines.slice(-maxLines);
    } catch (err) {
        console.error(`[PM2 Service] Failed to read lines from ${filePath}:`, err);
        return [];
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
};

// Fetch combined history from stdout and stderr
export const getHistoryLogs = async (maxLines = 150) => {
    const paths = getLogPaths();
    if (!paths.out || !paths.err) {
        return [];
    }
    
    const [outLines, errLines] = await Promise.all([
        readLastLines(paths.out, maxLines),
        readLastLines(paths.err, maxLines)
    ]);

    const parsedOut = outLines.map(line => parseLogLine(line, 'stdout')).filter(Boolean);
    const parsedErr = errLines.map(line => parseLogLine(line, 'stderr')).filter(Boolean);

    // Merge and sort chronologically by timestamp
    const combined = [...parsedOut, ...parsedErr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Return the last N logs of the merged array
    return combined.slice(-maxLines);
};

// Fetch filtered and paginated logs for infinite scrolling & time range search
export const getFilteredLogs = async ({
    startTime = null,
    endTime = null,
    search = '',
    severities = [],
    categories = [],
    sources = [],
    page = 1,
    limit = 100
}) => {
    const paths = getLogPaths();
    if (!paths.out || !paths.err) {
        return { logs: [], hasMore: false, total: 0 };
    }

    // Read up to 10k lines to execute paging and search filters on
    const maxReadLines = 10000;
    const [outLines, errLines] = await Promise.all([
        readLastLines(paths.out, maxReadLines),
        readLastLines(paths.err, maxReadLines)
    ]);

    const parsedOut = outLines.map(line => parseLogLine(line, 'stdout')).filter(Boolean);
    const parsedErr = errLines.map(line => parseLogLine(line, 'stderr')).filter(Boolean);

    // Merge and sort newest first for infinite scroll paging
    let combined = [...parsedOut, ...parsedErr].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply Time Range Filters
    if (startTime) {
        const startTs = new Date(startTime).getTime();
        combined = combined.filter(l => new Date(l.timestamp).getTime() >= startTs);
    }
    if (endTime) {
        const endTs = new Date(endTime).getTime();
        combined = combined.filter(l => new Date(l.timestamp).getTime() <= endTs);
    }

    // Apply Search Query Filter
    if (search && search.trim() !== '') {
        const q = search.toLowerCase();
        combined = combined.filter(l => 
            (l.message && l.message.toLowerCase().includes(q)) ||
            (l.category && l.category.toLowerCase().includes(q)) ||
            (l.severity && l.severity.toLowerCase().includes(q))
        );
    }

    // Apply Severity Filters
    if (severities && severities.length > 0) {
        const sevSet = new Set(severities.map(s => s.toUpperCase()));
        combined = combined.filter(l => sevSet.has(l.severity));
    }

    // Apply Category Filters
    if (categories && categories.length > 0) {
        const catSet = new Set(categories);
        combined = combined.filter(l => catSet.has(l.category));
    }

    // Apply Source Filters
    if (sources && sources.length > 0) {
        const srcSet = new Set(sources);
        combined = combined.filter(l => srcSet.has(l.source));
    }

    // Perform Pagination
    const startIndex = (page - 1) * limit;
    const paginatedLogs = combined.slice(startIndex, startIndex + limit);
    const hasMore = (startIndex + limit) < combined.length;

    return {
        logs: paginatedLogs,
        hasMore,
        total: combined.length
    };
};

// Real-time log capture & file writer for local / standalone dev environments
let isLogCaptureInitialized = false;
export const initLogCapture = (ioInstance) => {
    if (isLogCaptureInitialized) return;
    isLogCaptureInitialized = true;

    const paths = getLogPaths();
    if (!paths.out || !paths.err) return;

    // Helper to safely append to log file without crashing
    const appendToLogFile = (filePath, text) => {
        try {
            fs.appendFile(filePath, text + '\n', (err) => {
                if (err) {
                    // Suppress to prevent recursion
                }
            });
        } catch (e) {}
    };

    // Tap into console methods so all application output is logged and streamed
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const origInfo = console.info;

    const formatArgs = (args) => {
        return args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return arg.stack || arg.message;
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }).join(' ');
    };

    console.log = function (...args) {
        origLog.apply(console, args);
        const text = formatArgs(args);
        appendToLogFile(paths.out, text);
        if (ioInstance) {
            const parsed = parseLogLine(text, 'stdout');
            if (parsed) {
                ioInstance.to('super_admin_pm2_logs').emit('pm2:log', parsed);
            }
        }
    };

    console.info = function (...args) {
        origInfo.apply(console, args);
        const text = formatArgs(args);
        appendToLogFile(paths.out, text);
        if (ioInstance) {
            const parsed = parseLogLine(text, 'stdout');
            if (parsed) {
                ioInstance.to('super_admin_pm2_logs').emit('pm2:log', parsed);
            }
        }
    };

    console.warn = function (...args) {
        origWarn.apply(console, args);
        const text = formatArgs(args);
        appendToLogFile(paths.err, text);
        if (ioInstance) {
            const parsed = parseLogLine(text, 'stderr');
            if (parsed) {
                ioInstance.to('super_admin_pm2_logs').emit('pm2:log', parsed);
            }
        }
    };

    console.error = function (...args) {
        origError.apply(console, args);
        const text = formatArgs(args);
        appendToLogFile(paths.err, text);
        if (ioInstance) {
            const parsed = parseLogLine(text, 'stderr');
            if (parsed) {
                ioInstance.to('super_admin_pm2_logs').emit('pm2:log', parsed);
            }
        }
    };
};

