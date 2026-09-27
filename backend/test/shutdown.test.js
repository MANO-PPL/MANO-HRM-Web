import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SHUTDOWN_HOOK_TIMEOUT_MS = '200';

const { onShutdown, runShutdownHooks } = await import('../src/lifecycle/shutdown.js');

test('hooks run phase by phase; failures and hangs do not block later phases', async () => {
    const order = [];
    // Registered out of order on purpose: phases, not registration order, decide.
    onShutdown('db', () => { order.push('infra'); }, 'infra');
    onShutdown('stuck worker', () => new Promise(() => {}), 'workers');
    onShutdown('broken cron', () => { throw new Error('boom'); }, 'producers');
    onShutdown('http', async () => { order.push('ingress'); }, 'ingress');

    const started = Date.now();
    const ok = await runShutdownHooks();

    assert.deepEqual(order, ['ingress', 'infra']);
    assert.equal(ok, false, 'a failed or timed-out hook makes the run unsuccessful');
    assert.ok(Date.now() - started < 1000, 'stuck hook is cut off by the per-hook timeout');
});

test('unknown phases are rejected', () => {
    assert.throws(() => onShutdown('x', () => {}, 'later'), /Unknown shutdown phase/);
});
