/**
 * Single CORS policy for Express and Socket.IO (previously duplicated in
 * server.js and app.js).
 */
import './config.js';

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
    'http://localhost:5174',
    'https://localhost:5174',
    process.env.FRONTEND_URL,
].filter(Boolean);

function isLocalDevOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|localhost\.localdomain|lvh\.me|vite\.lvh\.me)(:\d+)?$/i.test(origin);
}

export function isOriginAllowed(origin) {
    if (!origin) return true;
    return allowedOrigins.includes(origin) ||
        isLocalDevOrigin(origin) ||
        origin.startsWith('http://192.') || origin.startsWith('https://192.') ||
        origin.startsWith('http://10.') || origin.startsWith('https://10.') ||
        origin.startsWith('http://172.') || origin.startsWith('https://172.');
}

const originCallback = (origin, callback) => {
    if (isOriginAllowed(origin)) {
        callback(null, true);
    } else {
        callback(new Error('Not allowed by CORS'));
    }
};

export const corsOptions = {
    origin: originCallback,
    credentials: true,
};

export const socketCorsOptions = {
    origin: originCallback,
    credentials: true,
};
