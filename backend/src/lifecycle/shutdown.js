/**
 * Shutdown hook registry.
 *
 * Modules that own a long-lived resource (server, sockets, workers, crons,
 * Redis, DB pools) register a close function here. shutdown() runs them in
 * fixed phases so the order does not depend on import order:
 *
 *   ingress    stop accepting HTTP requests / socket connections
 *   producers  stop things that create new work (crons, log tailing, listeners)
 *   workers    let in-flight background jobs finish
 *   infra      close queues, Redis and database pools last
 *
 * Hooks in the same phase run in parallel. Each hook is time-boxed so one
 * stuck resource cannot prevent the others (e.g. DB pools) from closing.
 */

export const PHASES = ['ingress', 'producers', 'workers', 'infra'];

const HOOK_TIMEOUT_MS = Number(process.env.SHUTDOWN_HOOK_TIMEOUT_MS) || 10000;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15000;

const hooks = [];
let shuttingDown = false;

export function onShutdown(name, fn, phase = 'infra') {
    if (!PHASES.includes(phase)) {
        throw new Error(`Unknown shutdown phase "${phase}" for hook "${name}"`);
    }
    hooks.push({ name, fn, phase });
}

export function isShuttingDown() {
    return shuttingDown;
}

// The timer is deliberately *not* unref'd: while a hook is pending it keeps
// the event loop alive, so a hung hook times out instead of the process
// exiting early (with code 0) before later phases run.
function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs every registered hook, phase by phase. Returns true if all succeeded.
 */
export async function runShutdownHooks() {
    let ok = true;
    for (const phase of PHASES) {
        const phaseHooks = hooks.filter((h) => h.phase === phase);
        const results = await Promise.allSettled(
            phaseHooks.map((h) => withTimeout(Promise.resolve().then(h.fn), HOOK_TIMEOUT_MS))
        );
        results.forEach((result, i) => {
            const { name } = phaseHooks[i];
            if (result.status === 'fulfilled') {
                console.log(`[lifecycle] closed ${name}`);
            } else {
                ok = false;
                console.error(`[lifecycle] failed to close ${name}: ${result.reason?.message || result.reason}`);
            }
        });
    }
    return ok;
}

/**
 * Gracefully stops the process: runs all hooks, then exits. Safe to call more
 * than once (later calls are ignored). A hard deadline forces exit(1) if the
 * hooks do not finish in time.
 */
export async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.warn(`[lifecycle] shutdown started (${reason})`);

    // Referenced on purpose (see withTimeout); shutdown always ends in exit().
    setTimeout(() => {
        console.error(`[lifecycle] shutdown exceeded ${SHUTDOWN_TIMEOUT_MS} ms, forcing exit`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    const ok = await runShutdownHooks();
    console.log('[lifecycle] shutdown complete');
    process.exit(ok ? exitCode : 1);
}
