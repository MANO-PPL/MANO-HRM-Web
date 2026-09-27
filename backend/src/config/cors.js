/**
 * Single CORS policy for Express and Socket.IO.
 *
 * Production allows only the configured frontend origin(s):
 *   FRONTEND_URL=https://attendance.mano.co.in
 *   CORS_ORIGINS=https://a.example.com,https://b.example.com   (optional, extra)
 *
 * Other environments additionally allow localhost, lvh.me and private LAN
 * addresses (10.x, 172.16-31.x, 192.168.x) so the app can be opened from
 * another device on the same network during development.
 */
import './config.js';
import AppError from '../utils/AppError.js';

const isProduction = process.env.NODE_ENV === 'production';

const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
].map((o) => (o || '').trim().replace(/\/$/, '')).filter(Boolean);

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|localhost\.localdomain|lvh\.me|vite\.lvh\.me)(:\d+)?$/i;
const PRIVATE_LAN_ORIGIN = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

if (isProduction && configuredOrigins.length === 0) {
    console.error('[CORS] FRONTEND_URL is not set: browsers will be blocked from calling the API cross-origin');
}

export function isOriginAllowed(origin) {
    // Requests without an Origin header (same-origin GETs, curl, server-to-server)
    if (!origin) return true;
    if (configuredOrigins.includes(origin)) return true;
    if (isProduction) return false;
    return LOCAL_DEV_ORIGIN.test(origin) || PRIVATE_LAN_ORIGIN.test(origin);
}

// Express: disallowed origins are stopped before any route runs, with a 403
// (previously a generic Error, which surfaced as a 500 in sys_error_logs).
export const corsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        callback(new AppError('Origin not allowed by CORS policy', 403, 'CORS_ORIGIN_DENIED'));
    },
    credentials: true,
};

// Socket.IO: a false result rejects the handshake.
export const socketCorsOptions = {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true,
};
