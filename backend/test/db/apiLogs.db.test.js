/**
 * API request logging: rows are buffered and written in batches, nothing is
 * lost at shutdown, and the retention job only deletes old rows.
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { default: EventBus } = await import('../../src/utils/EventBus.js');
const { cleanupApiLogs } = await import('../../src/cron/cleanupScheduler.js');
const { seed } = await import('./support/seed.js');

let server;
let baseUrl;
let tokens;

before(async () => {
    ({ tokens } = await seed(db));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

test('requests are logged in batches, and buffered rows are written by the flush', async () => {
    for (let i = 0; i < 5; i++) {
        await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokens.empA}` } });
    }
    await EventBus.flushApiLogs();
    const rows = await db('sys_api_logs').where({ request_path: '/auth/me' }).count({ n: '*' });
    assert.equal(Number(rows[0].n), 5);
});

test('retention deletes only rows older than API_LOG_RETENTION_DAYS (default 90)', async () => {
    const base = { request_path: '/retention-test', method: 'GET', status_code: 200, duration_ms: 1, is_success: 1 };
    await db('sys_api_logs').insert([
        { ...base, occurred_at: db.raw('NOW() - INTERVAL 120 DAY') },
        { ...base, occurred_at: db.raw('NOW() - INTERVAL 91 DAY') },
        { ...base, occurred_at: db.raw('NOW() - INTERVAL 10 DAY') },
    ]);
    await cleanupApiLogs();
    const remaining = await db('sys_api_logs').where({ request_path: '/retention-test' }).count({ n: '*' });
    assert.equal(Number(remaining[0].n), 1);
});
