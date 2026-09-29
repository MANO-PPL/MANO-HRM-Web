import { Worker } from 'bullmq';
import { redisConnection } from '../config/queues.js';
import { processAttendanceJob } from '../modules/attendance/attendanceJobProcessor.js';

/**
 * Starts the attendance worker. Called once at boot; importing this module
 * has no side effects.
 */
export function startAttendanceWorker() {
    const attendanceWorker = new Worker('{AttendanceQueue}', async (job) => {
        // Retries only help while attempts remain (attemptsMade counts earlier attempts)
        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
        return processAttendanceJob(job.data, { isFinalAttempt });
    }, {
        connection: redisConnection,
        concurrency: 4 // Max 4 concurrent check-ins/outs processed in parallel
    });

    attendanceWorker.on('completed', (job) => {
        console.log(`🏁 [AttendanceWorker] Job #${job.id} completed.`);
    });

    attendanceWorker.on('failed', (job, err) => {
        console.error(`💥 [AttendanceWorker] Job #${job.id} failed with error:`, err);
    });

    attendanceWorker.on('error', (err) => {
        // Suppressed or logged by connection error handler
    });

    return attendanceWorker;
}
