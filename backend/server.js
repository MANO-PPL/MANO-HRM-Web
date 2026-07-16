import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import './src/config/config.js';
import app from './src/app.js';
import { initAttendanceProcessor } from './src/cron/AttendanceProcessor.js';
import { initCleanupScheduler } from './src/cron/cleanupScheduler.js';
import { initDARReportScheduler } from './src/cron/DARReportScheduler.js';

import { sendPushNotification } from './src/services/notifications/fcmService.js';
import EventBus from './src/utils/EventBus.js';
import { attendanceDB } from './src/config/database.js';
import './src/workers/reportWorker.js';
import './src/workers/attendanceWorker.js';
import fs from 'fs';
import { getLogPaths, parseLogLine } from './src/services/superAdmin/pm2Service.js';
import { cacheService } from './src/services/cache/cacheService.js';

const PORT = Number(process.env.PORT) || 5003;

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

const server = createServer(app);
let activePort = PORT;
let hasStartedSchedulers = false;
const MAX_PORT_RETRIES = 5;
let portRetries = 0;

const io = new SocketIO(server, {
  path: '/socket.io/',
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.includes(origin)
        || isLocalDevOrigin(origin)
        || origin.startsWith('http://192.') || origin.startsWith('https://192.')
        || origin.startsWith('http://10.') || origin.startsWith('https://10.')
        || origin.startsWith('http://172.') || origin.startsWith('https://172.');

      return isAllowed ? callback(null, true) : callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  // Allow both WebSocket and HTTP long-polling so the client can fall back
  // gracefully if the WebSocket upgrade is blocked by a proxy layer.
  transports: ['websocket', 'polling'],
  // Ping settings: detect dead connections within 30 s and drop them.
  // Clients that are still alive will respond to the ping and stay connected.
  pingInterval: 10000,   // How often to send a ping (ms)
  pingTimeout:  20000,   // How long to wait for a pong before dropping (ms)
  // Allow Socket.IO v2 clients to connect (backwards-compat)
  allowEIO3: true,
  // Maximum HTTP buffer size for a single message
  maxHttpBufferSize: 1e6,
});

app.set('io', io);

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    jwt.verify(actualToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.user = decoded;
      next();
    });
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.user_id ?? socket.user?.id;
  const orgId = socket.user?.org_id || 1;
  
  if (userId) {
    // Join personal notification channel
    socket.join(`user_${userId}`);
    
    // Presence tracking: Set presence key in Redis with 60s TTL
    if (cacheService) {
      cacheService.set(`org:${orgId}:user:presence:${userId}`, 'online', 60);
    }
  }

  socket.on('heartbeat', () => {
    if (userId && cacheService) {
      cacheService.set(`org:${orgId}:user:presence:${userId}`, 'online', 60);
    }
  });

  socket.on('join_room', (roomId) => {
    socket.join(`org_${orgId}:conversation_${roomId}`);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(`org_${orgId}:conversation_${roomId}`);
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(`org_${orgId}:conversation_${roomId}`).emit('user_typing', { roomId, userId, username });
  });

  socket.on('stop_typing', ({ roomId }) => {
    socket.to(`org_${orgId}:conversation_${roomId}`).emit('user_stop_typing', { roomId, userId });
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

  socket.on('disconnect', (reason) => {
    if (userId && cacheService) {
      cacheService.del(`org:${orgId}:user:presence:${userId}`);
    }
  });
});

// Listen to the EventBus saved notifications and push real-time alerts
EventBus.on('notification_saved', async (notification) => {
  let enrichedNotification = { ...notification };
  const isChat = notification.type === 'CHAT' || notification.type === 'CHAT_MESSAGE' || notification.related_entity_type === 'CHAT_MESSAGE';

  if (isChat) {
    enrichedNotification.type = 'CHAT';
  }

  if (isChat && notification.related_entity_id) {
    try {
      const room = await attendanceDB('chat_conversations')
        .where('id', notification.related_entity_id)
        .first();
      if (room && room.last_message_id) {
        const lastMsg = await attendanceDB('chat_messages')
          .where('id', room.last_message_id)
          .first();
        if (lastMsg) {
          const sender = await attendanceDB('users')
            .where('user_id', lastMsg.sender_id)
            .select('profile_image_url')
            .first();
          if (sender && sender.profile_image_url) {
            enrichedNotification.sender_avatar = sender.profile_image_url;
          }
        }
      }
    } catch (e) {
      console.error('Error enriching notification with sender avatar:', e);
    }
  }

  io.to(`user_${notification.user_id}`).emit('new-notification', enrichedNotification);
  console.log(`📡 Real-time notification push sent to user_${notification.user_id} for alert #${notification.notification_id}`);
  
  // Trigger FCM push notification to user's registered devices
  sendPushNotification(
    notification.user_id,
    notification.title,
    notification.message,
    {
      notification_id: String(notification.notification_id || ''),
      type: isChat ? 'CHAT' : String(notification.type || 'INFO'),
      related_entity_type: String(notification.related_entity_type || ''),
      related_entity_id: String(notification.related_entity_id || ''),
      sender_avatar: String(enrichedNotification.sender_avatar || '')
    }
  );
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE' && portRetries < MAX_PORT_RETRIES) {
    portRetries += 1;
    activePort += 1;
    console.warn(`Port in use. Retrying backend on port ${activePort}...`);
    server.listen(activePort, '0.0.0.0');
    return;
  }
  throw err;
});

// Start PM2 Log Tailing & Streaming
const logFileOffsets = {};
function startLogTailing(ioInstance) {
  const paths = getLogPaths();
  const setupWatcher = (filePath, sourceName) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[PM2 Monitor] Log file does not exist: ${filePath}`);
        return;
      }
      logFileOffsets[filePath] = fs.statSync(filePath).size;
      fs.watchFile(filePath, { interval: 1000 }, async (curr, prev) => {
        if (curr.size > prev.size) {
          let fileHandle;
          try {
            const readLen = curr.size - prev.size;
            const buffer = Buffer.alloc(readLen);
            fileHandle = await fs.promises.open(filePath, 'r');
            await fileHandle.read(buffer, 0, readLen, prev.size);
            const newText = buffer.toString('utf8');
            const lines = newText.split('\n');
            lines.forEach(line => {
              if (line.trim() !== '') {
                const parsed = parseLogLine(line, sourceName);
                if (parsed) {
                  ioInstance.to('super_admin_pm2_logs').emit('pm2:log', parsed);
                }
              }
            });
          } catch (err) {
            console.error(`[PM2 Monitor] Error reading new tail bytes for ${sourceName}:`, err);
          } finally {
            if (fileHandle) await fileHandle.close();
          }
        }
      });
      console.log(`[PM2 Monitor] Tailing initialized for ${sourceName}: ${filePath}`);
    } catch (err) {
      console.error(`[PM2 Monitor] Failed to initialize tailing for ${sourceName}:`, err);
    }
  };
  setupWatcher(paths.out, 'stdout');
  setupWatcher(paths.err, 'stderr');
}

server.listen(activePort, '0.0.0.0', () => {
  console.log(`Backend server listening at http://0.0.0.0:${activePort}`);

  if (!hasStartedSchedulers) {
    hasStartedSchedulers = true;
    initAttendanceProcessor();
    initCleanupScheduler();
    initDARReportScheduler();
  }

  // Initialize PM2 logs monitoring tailer
  startLogTailing(io);
});
