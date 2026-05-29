import { Queue } from 'bullmq';
import Redis from 'ioredis';
import './config.js'; // Ensure .env is loaded

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Critical setting for BullMQ
  retryStrategy(times) {
    // Back off retries to every 10 seconds to avoid spamming the console
    return 10000;
  }
};

export const redisConnection = new Redis(REDIS_CONFIG);

// Suppress unhandled connection error crash & log warning once
redisConnection.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    const now = Date.now();
    if (!redisConnection._lastLoggedError || now - redisConnection._lastLoggedError > 300000) {
      console.warn(`⚠️ Redis is offline at ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}. Background report queues will automatically connect once Redis is online.`);
      redisConnection._lastLoggedError = now;
    }
  } else {
    console.error('Redis connection error:', err);
  }
});

export const reportQueue = new Queue('ReportQueue', { connection: redisConnection });

// Handle BullMQ Queue error events to avoid process crashes
reportQueue.on('error', (err) => {
  // Silent fallback: redisConnection error handler manages console logging
});
