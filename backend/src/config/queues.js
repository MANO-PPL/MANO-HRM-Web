import { Queue } from 'bullmq';
import { onShutdown } from '../lifecycle/shutdown.js';
import { createRedisClient, closeRedisClient } from './redis.js';

// Shared BullMQ connection for the queues and workers
export const redisConnection = createRedisClient('queue', { bullmq: true });

export const reportQueue = new Queue('{ReportQueue}', { connection: redisConnection });

// Connection problems are logged once by the shared Redis client
reportQueue.on('error', () => {});

export const attendanceQueue = new Queue('{AttendanceQueue}', { connection: redisConnection });

attendanceQueue.on('error', () => {});

// Close queues and their shared Redis connection on shutdown (after workers,
// which run in an earlier phase). When Redis is not connected there is
// nothing to flush, so the connection is dropped without waiting.
onShutdown('queue redis', async () => {
  if (redisConnection.status === 'ready') {
    await Promise.allSettled([reportQueue.close(), attendanceQueue.close()]);
  }
  await closeRedisClient(redisConnection);
}, 'infra');
