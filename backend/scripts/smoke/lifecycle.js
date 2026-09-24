/**
 * Lifecycle smoke test: boots server.js, waits for /health, sends SIGTERM and
 * checks that the process shuts down gracefully:
 *   - exits within SHUTDOWN_DEADLINE_MS
 *   - exits with code 0
 *   - logs the "[lifecycle] shutdown complete" marker (all hooks ran)
 *
 *   node scripts/smoke/lifecycle.js
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = String(5900 + Math.floor(Math.random() * 90));
const BOOT_TIMEOUT_MS = 60000;
const SHUTDOWN_DEADLINE_MS = 20000;

const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (d) => { output += d; });
child.stderr.on('data', (d) => { output += d; });

const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));

function fail(message) {
    console.error(`Lifecycle smoke test: FAILED — ${message}\n--- server output (tail) ---\n${output.slice(-3000)}`);
    child.kill('SIGKILL');
    process.exit(1);
}

async function waitForHealth() {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/health`);
            if (res.ok) return;
        } catch { /* not listening yet */ }
        await new Promise((r) => setTimeout(r, 500));
    }
    fail(`/health did not respond within ${BOOT_TIMEOUT_MS / 1000}s`);
}

await waitForHealth();
const started = Date.now();
child.kill('SIGTERM');

const result = await Promise.race([
    exited,
    new Promise((r) => setTimeout(() => r(null), SHUTDOWN_DEADLINE_MS)),
]);
const elapsed = Date.now() - started;

if (!result) fail(`process still running ${SHUTDOWN_DEADLINE_MS / 1000}s after SIGTERM`);
if (result.code !== 0) fail(`exit code ${result.code} (signal ${result.signal})`);
if (!output.includes('[lifecycle] shutdown complete')) {
    fail('graceful shutdown marker "[lifecycle] shutdown complete" not logged (hooks did not all run)');
}

console.log(`Lifecycle smoke test: OK (clean exit in ${elapsed} ms)`);
process.exit(0);
