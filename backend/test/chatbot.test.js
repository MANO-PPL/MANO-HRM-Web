import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Every request is written to sys_api_logs. These tests need no database, so
// point the app at an unreachable port instead of the one in .env (config.js
// never overrides variables that are already set).
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';

const { default: app } = await import('../src/app.js');
const { runShutdownHooks } = await import('../src/lifecycle/shutdown.js');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const ask = (body) => fetch(`${baseUrl}/website-chatbot/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// Both cases are rejected before the question reaches the LLM
test('website chatbot rejects empty and overlong questions (M-10)', async () => {
    assert.equal((await ask({ question: '   ' })).status, 400);
    const res = await ask({ question: 'x'.repeat(2001) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /under 2000 characters/);
});

test('website chatbot is rate limited per visitor (M-10)', async () => {
    const statuses = [];
    for (let i = 0; i < 30; i++) statuses.push((await ask({ question: '' })).status);
    assert.equal(statuses.filter((s) => s === 429).length, 2, 'limit is 30 per 15 minutes, 2 used above');
});
