import { initAttendanceProcessor } from './AttendanceProcessor.js';
import { initCleanupScheduler } from './cleanupScheduler.js';
import { initDARReportScheduler } from './DARReportScheduler.js';
import { onShutdown } from '../lifecycle/shutdown.js';

let started = false;

/**
 * Starts every cron schedule once per process and registers them for
 * graceful shutdown (no new runs start once shutdown begins).
 */
export function startSchedulers() {
    if (started) return;
    started = true;

    const tasks = [
        ...initAttendanceProcessor(),
        ...initCleanupScheduler(),
        ...initDARReportScheduler(),
    ];

    onShutdown('cron schedules', () => Promise.all(tasks.map((task) => task.destroy())), 'producers');
    console.log(`🕒 ${tasks.length} cron schedules started`);
}
