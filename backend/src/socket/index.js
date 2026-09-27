import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import { cacheService } from '../services/cache/cacheService.js';
import { socketCorsOptions } from '../config/cors.js';
import { onShutdown } from '../lifecycle/shutdown.js';

const conversationRoom = (orgId, roomId) => `org_${orgId}:conversation_${roomId}`;

/**
 * Verifies the handshake JWT.
 */
function authenticateSocket(socket, next) {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;

        jwt.verify(actualToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
            // Purpose-specific tokens (e.g. password_reset) carry a `type` claim
            if (err || decoded?.type) {
                return next(new Error('Authentication error: Invalid token'));
            }
            socket.user = decoded;
            next();
        });
    } catch (err) {
        next(new Error('Authentication error'));
    }
}

function registerConnectionHandlers(io, socket) {
    const userId = socket.user?.user_id ?? socket.user?.id;
    const orgId = socket.user?.org_id || 1;

    if (userId) {
        // Personal channel for notifications
        socket.join(`user_${userId}`);
        // Presence tracking: Set presence key in Redis with 60s TTL
        cacheService.set(`org:${orgId}:user:presence:${userId}`, 'online', 60);
    }

    socket.on('heartbeat', () => {
        if (userId) cacheService.set(`org:${orgId}:user:presence:${userId}`, 'online', 60);
    });

    socket.on('join_room', (roomId) => {
        socket.join(conversationRoom(orgId, roomId));
    });

    socket.on('leave_room', (roomId) => {
        socket.leave(conversationRoom(orgId, roomId));
    });

    socket.on('typing', ({ roomId, username } = {}) => {
        socket.to(conversationRoom(orgId, roomId)).emit('user_typing', { roomId, userId, username });
    });

    socket.on('stop_typing', ({ roomId } = {}) => {
        socket.to(conversationRoom(orgId, roomId)).emit('user_stop_typing', { roomId, userId });
    });

    socket.on('subscribe_pm2_logs', () => {
        if (socket.user?.user_type === 'super_admin') {
            socket.join('super_admin_pm2_logs');
            console.log(`[PM2 Monitor] Socket ${socket.id} (user ${userId}) subscribed to PM2 logs`);
        }
    });

    socket.on('unsubscribe_pm2_logs', () => {
        socket.leave('super_admin_pm2_logs');
        console.log(`[PM2 Monitor] Socket ${socket.id} (user ${userId}) unsubscribed from PM2 logs`);
    });

    socket.on('disconnect', () => {
        if (userId) cacheService.del(`org:${orgId}:user:presence:${userId}`);
    });
}

/**
 * Creates the Socket.IO server on the given HTTP server, exposes it to route
 * handlers via app.get('io') and registers it for graceful shutdown.
 */
export function initSocketServer(httpServer, app) {
    const io = new SocketIO(httpServer, {
        path: '/socket.io/',
        cors: socketCorsOptions,
        // Allow both WebSocket and HTTP long-polling so the client can fall back
        // gracefully if the WebSocket upgrade is blocked by a proxy layer.
        transports: ['websocket', 'polling'],
        // Detect dead connections within 30 s and drop them
        pingInterval: 10000,
        pingTimeout: 20000,
        // Allow Socket.IO v2 clients to connect (backwards-compat)
        allowEIO3: true,
        // Maximum HTTP buffer size for a single message
        maxHttpBufferSize: 1e6,
    });

    app.set('io', io);
    io.use(authenticateSocket);
    io.on('connection', (socket) => registerConnectionHandlers(io, socket));

    // Disconnect clients so they reconnect to the next process
    onShutdown('socket.io', () => new Promise((resolve) => io.close(() => resolve())), 'ingress');

    return io;
}
