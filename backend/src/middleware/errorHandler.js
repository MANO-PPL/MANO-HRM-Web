import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EventBus from '../utils/EventBus.js';
import { getEventSource } from '../utils/clientInfo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log to EventBus (which writes to DB)
    if (err.statusCode === 500) {
        EventBus.emitError({
            level: 'ERROR',
            user_id: req.user?.user_id || req.user?.id || null,
            org_id: req.user?.org_id || null,
            error_message: err.message,
            stack_trace: err.stack,
            request_method: req.method,
            request_path: req.originalUrl,
            client_ip: req.clientIp || req.ip,
            extra_context: { platform: getEventSource(req) }
        });
    }

    if (process.env.NODE_ENV === 'development') {
        if (err.isOperational) {
            console.warn(`⚠️  [OperationalError] ${err.statusCode} - ${err.message}`);
        } else {
            console.error('ERROR 💥', err);
        }

        try {
            const logPath = path.resolve(__dirname, '../../error-debug.log');
            const timestamp = new Date().toISOString();
            const logMsg = `[${timestamp}] ${req.method} ${req.originalUrl}\nStatusCode: ${err.statusCode}\nError: ${err.message}\nStack: ${err.stack}\n\n`;
            fs.appendFileSync(logPath, logMsg, 'utf8');
        } catch (e) {
            console.error('Failed to write to error-debug.log:', e.message);
        }
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    // In strict default mode, we hide details unless explicitly in 'development'
    const message = (!isDevelopment && err.statusCode === 500)
        ? 'Something went wrong! Please contact support.'
        : err.message;

    res.status(err.statusCode).json({
        ok: false,
        status: err.status,
        message: message,
        ...(err.code && { code: err.code }),
        ...(isDevelopment && { stack: err.stack, error: err })
    });
};

export default errorHandler;
