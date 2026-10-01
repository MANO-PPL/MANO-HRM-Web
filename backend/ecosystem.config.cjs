/**
 * PM2 process definition for the backend (single instance, fork mode).
 *
 * First time, replacing a process started with `pm2 start server.js`:
 *   sudo pm2 delete MANO-Attendance
 *   sudo pm2 start ecosystem.config.cjs
 *   sudo pm2 save
 * Deploys keep using `pm2 reload MANO-Attendance`, which reuses these settings.
 *
 * Settings come from .env (loaded by src/config/config.js), not from here.
 */
module.exports = {
    apps: [
        {
            name: 'MANO-Attendance',
            script: 'server.js',
            cwd: __dirname,
            exec_mode: 'fork',
            instances: 1,

            // Graceful shutdown finishes within SHUTDOWN_TIMEOUT_MS (15 s);
            // PM2 must wait longer than that before sending SIGKILL.
            kill_timeout: 20000,

            // server.js sends 'ready' once it is listening
            wait_ready: true,
            listen_timeout: 30000,

            // Restart before the instance runs out of memory; size to the EC2 instance
            max_memory_restart: '1G',

            // A process that keeps crashing (e.g. database down) is restarted
            // with an increasing delay instead of in a tight loop
            exp_backoff_restart_delay: 200,
        },
    ],
};
