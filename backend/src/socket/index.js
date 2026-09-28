import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import { attendanceDB } from '../config/database.js';
import { socketCorsOptions } from '../config/cors.js';
import { onShutdown } from '../lifecycle/shutdown.js';
import { markOnline, markOfflineIfLastSocket } from './presence.js';

const conversationRoom = (orgId, roomId) => `org_${orgId}:conversation_${roomId}`;

/**
 * Verifies the handshake JWT. The token is read from the `auth` payload only:
 * query-string tokens end up in proxy/access logs.
 */
function authenticateSocket(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;

        jwt.verify(actualToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
            // Purpose-specific tokens (e.g. password_reset) carry a `type` claim
            if (err || decoded?.type) {
                return next(new Error('Authentication error: Invalid token'));
            }
            // Every tenant user must have an org; there is no default tenant
            if (!decoded.org_id && decoded.user_type !== 'super_admin') {
                return next(new Error('Authentication error: No organization context'));
            }
            socket.user = decoded;
            next();
        });
    } catch (err) {
        next(new Error('Authentication error'));
    }
}

/**
 * True when the user is an active (not removed/archived) member of the
 * conversation and the conversation belongs to their org. Mirrors the REST
 * membership check in collaboration/chatController.js.
 */
async function isActiveMember(conversationId, userId, orgId) {
    const membership = await attendanceDB('chat_conversation_members as m')
        .join('chat_conversations as c', 'c.id', 'm.conversation_id')
        .where({ 'm.conversation_id': conversationId, 'm.user_id': userId, 'c.org_id': orgId })
        .first('m.is_archived');
    return Boolean(membership) && !membership.is_archived;
}

function registerConnectionHandlers(io, socket) {
    const userId = socket.user?.user_id ?? socket.user?.id;
    const orgId = socket.user?.org_id;

    if (userId) {
        // Personal channel for notifications
        socket.join(`user_${userId}`);
        if (orgId) markOnline(orgId, userId);
    }

    socket.on('heartbeat', () => {
        if (userId && orgId) markOnline(orgId, userId);
    });

    socket.on('join_room', async (roomId) => {
        const conversationId = Number(roomId);
        if (!userId || !orgId || !Number.isInteger(conversationId)) return;
        try {
            if (await isActiveMember(conversationId, userId, orgId)) {
                socket.join(conversationRoom(orgId, conversationId));
            }
        } catch (err) {
            console.error(`[Socket] join_room membership check failed for user ${userId}, room ${conversationId}:`, err);
        }
    });

    socket.on('leave_room', (roomId) => {
        socket.leave(conversationRoom(orgId, roomId));
    });

    // Typing events are only relayed to rooms the socket has actually joined
    socket.on('typing', ({ roomId, username } = {}) => {
        const room = conversationRoom(orgId, roomId);
        if (socket.rooms.has(room)) {
            socket.to(room).emit('user_typing', { roomId, userId, username });
        }
    });

    socket.on('stop_typing', ({ roomId } = {}) => {
        const room = conversationRoom(orgId, roomId);
        if (socket.rooms.has(room)) {
            socket.to(room).emit('user_stop_typing', { roomId, userId });
        }
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
        if (userId && orgId) {
            markOfflineIfLastSocket(io, orgId, userId).catch((err) => {
                console.error(`[Socket] Failed to clear presence for user ${userId}:`, err);
            });
        }
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
