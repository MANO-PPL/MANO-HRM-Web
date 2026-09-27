import { redisConnection } from '../config/queues.js';
import { onShutdown } from '../lifecycle/shutdown.js';
import { startAttendanceWorker } from './attendanceWorker.js';
import { startReportWorker } from './reportWorker.js';

/**
 * Starts all BullMQ workers and registers them for graceful shutdown.
 * On shutdown each worker stops taking new jobs and waits for the jobs it is
 * running (selfie uploads, report generation) to finish.
 */
export function startWorkers() {
    const workers = [startAttendanceWorker(), startReportWorker()];

    onShutdown('bullmq workers', async () => {
        // Without a Redis connection there are no running jobs to wait for
        const force = redisConnection.status !== 'ready';
        await Promise.all(workers.map((worker) => worker.close(force)));
    }, 'workers');

    console.log('👷 Background workers started (attendance, reports)');
    return workers;
}
