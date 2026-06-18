import fs from 'fs';
import path from 'path';
import os from 'os';

// Production paths on Ubuntu EC2
const PROD_OUT_LOG = '/home/ubuntu/.pm2/logs/ATTENDANCE-BACKEND-out.log';
const PROD_ERR_LOG = '/home/ubuntu/.pm2/logs/ATTENDANCE-BACKEND-error.log';

// Local dev fallback paths (simulated logs in workspace)
const DEV_OUT_LOG = path.resolve('./backend-pm2-out.log');
const DEV_ERR_LOG = path.resolve('./backend-pm2-error.log');

export const getLogPaths = () => {
    try {
        if (fs.existsSync(PROD_OUT_LOG)) {
            return { out: PROD_OUT_LOG, err: PROD_ERR_LOG };
        }
    } catch (e) {}
    
    try {
        if (fs.existsSync(DEV_OUT_LOG)) {
            return { out: DEV_OUT_LOG, err: DEV_ERR_LOG };
        }
    } catch (e) {}
    
    return { out: null, err: null };
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
    if (!line || line.trim() === '') return null;

    // Check if it fits the new standardized format: [Timestamp] [Severity] [Category] Message
    const stdMatch = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/s);
    if (stdMatch) {
        let timestamp = stdMatch[1];
        try {
            timestamp = new Date(timestamp).toISOString();
        } catch (e) {}
        
        return {
            timestamp,
            severity: stdMatch[2],
            category: stdMatch[3],
            message: stdMatch[4],
            source: type === 'stderr' ? 'stderr' : 'stdout'
        };
    }

    // Fallback: old dynamic parsing for unformatted logs (e.g. process startup banners)
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
        if (!fs.existsSync(filePath)) return [];
        
        const stats = await fs.promises.stat(filePath);
        if (stats.size === 0) return [];

        fileHandle = await fs.promises.open(filePath, 'r');
        
        // Read last 128KB max (reasonable buffer size for 150 lines of logs)
        const bufferSize = Math.min(1024 * 128, stats.size);
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
