import { shutdown, isShuttingDown } from './shutdown.js';

/**
 * Process-level handlers:
 * - SIGTERM / SIGINT (PM2 reload/stop, Ctrl+C, nodemon restart): graceful
 *   shutdown with exit code 0.
 * - unhandledRejection / uncaughtException: the process state can no longer
 *   be trusted, so it is logged and shut down gracefully with exit code 1;
 *   PM2 then starts a clean process. (Node already exits on these by default;
 *   this adds logging and closes connections, jobs and pools first.)
 */
export function installProcessGuards() {
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => {
            // A second signal (e.g. Ctrl+C twice) skips the graceful wait
            if (isShuttingDown()) process.exit(1);
            shutdown(signal, 0);
        });
    }

    const onFatal = (kind) => (error) => {
        console.error(`[FATAL] ${kind}:`, error);
        if (isShuttingDown()) {
            // A crash during shutdown: do not wait for the remaining hooks
            process.exit(1);
        }
        shutdown(kind, 1);
    };

    process.on('unhandledRejection', onFatal('unhandledRejection'));
    process.on('uncaughtException', onFatal('uncaughtException'));
}
