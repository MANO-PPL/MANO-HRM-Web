import { createServer } from 'http';
import './src/config/config.js';
import app from './src/app.js';
import { initSocketServer } from './src/socket/index.js';
import { startSchedulers } from './src/cron/index.js';

import { initEventSubscribers } from './src/subscribers/index.js';
import { startWorkers } from './src/workers/index.js';
import { startLogTailing } from './src/modules/superadmin/pm2Service.js';

const PORT = Number(process.env.PORT) || 5003;

const server = createServer(app);

let activePort = PORT;
const MAX_PORT_RETRIES = 5;
let portRetries = 0;

const io = initSocketServer(server, app);

// Background job workers (selfie uploads, geocoding, report generation)
startWorkers();

// Real-time delivery of saved notifications: Sockets (Web) + FCM (Mobile)
initEventSubscribers({ io });

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

server.listen(activePort, '0.0.0.0', () => {
  console.log(`Backend server listening at http://0.0.0.0:${activePort}`);

  startSchedulers();

  // Initialize PM2 logs monitoring tailer
  startLogTailing(io);
});

// Graceful shutdown handlers to ensure exit code 0 and no console errors
const gracefulShutdown = () => {
  if (server?.listening) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

