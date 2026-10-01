import { createServer } from 'http';
import './src/config/config.js';
// Stop with a clear message if required settings are missing from .env
import './src/config/startupEnvCheck.js';
import app from './src/app.js';
import { initSocketServer } from './src/socket/index.js';
import { startSchedulers } from './src/cron/index.js';

import { initEventSubscribers } from './src/subscribers/index.js';
import { startWorkers } from './src/workers/index.js';
import { startLogTailing } from './src/modules/superadmin/pm2Service.js';
import { installProcessGuards } from './src/lifecycle/processGuards.js';
import { onShutdown, shutdown } from './src/lifecycle/shutdown.js';

// Crash protection and graceful shutdown on SIGTERM/SIGINT
installProcessGuards();

const PORT = Number(process.env.PORT) || 5003;

const server = createServer(app);

// Stop accepting new connections; in-flight requests are allowed to finish
onShutdown('http server', () => new Promise((resolve) => {
  if (!server.listening) return resolve();
  server.close(() => resolve());
  server.closeIdleConnections();
}), 'ingress');

let activePort = PORT;
const MAX_PORT_RETRIES = 5;
let portRetries = 0;

const io = initSocketServer(server, app);

// Background job workers (selfie uploads, geocoding, report generation)
startWorkers();

// Real-time delivery of saved notifications: Sockets (Web) + FCM (Mobile)
initEventSubscribers({ io });

// In development a busy port moves to the next one. In production the port must
// match the reverse proxy, so a busy port is fatal instead of silently moving.
server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE' && process.env.NODE_ENV === 'development' && portRetries < MAX_PORT_RETRIES) {
    portRetries += 1;
    activePort += 1;
    console.warn(`Port in use. Retrying backend on port ${activePort}...`);
    server.listen(activePort, '0.0.0.0');
    return;
  }
  console.error(`[FATAL] HTTP server error on port ${activePort}:`, err);
  shutdown('http server error', 1);
});

server.listen(activePort, '0.0.0.0', () => {
  console.log(`Backend server listening at http://0.0.0.0:${activePort}`);

  startSchedulers();

  // Initialize PM2 logs monitoring tailer
  startLogTailing(io);

  // Tells PM2 the app is ready (used with wait_ready in the PM2 config)
  process.send?.('ready');
});
