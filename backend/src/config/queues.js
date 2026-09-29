import { Queue } from 'bullmq';
import { onShutdown } from '../lifecycle/shutdown.js';
import { createRedisClient, closeRedisClient } from './redis.js';

// Shared BullMQ connection for the queues and workers
export const redisConnection = createRedisClient('queue', { bullmq: true });

// Applied to every job unless overridden at add() time:
// - retry failed jobs with exponential backoff (5 s, 10 s, 20 s)
// - keep finished jobs only as long as they are useful, so Redis memory does
//   not grow forever (BullMQ keeps every job by default)
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const reportQueue = new Queue('{ReportQueue}', { connection: redisConnection, defaultJobOptions });

// Connection problems are logged once by the shared Redis client
reportQueue.on('error', () => {});

export const attendanceQueue = new Queue('{AttendanceQueue}', { connection: redisConnection, defaultJobOptions });

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
