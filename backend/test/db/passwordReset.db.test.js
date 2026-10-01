/**
 * Forgot-password (M-08): the response does not reveal whether an email is
 * registered, and verification code requests are limited per email and IP.
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { seed } = await import('./support/seed.js');

let server;
let baseUrl;

before(async () => {
    await seed(db);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const requestCode = (email) => fetch(`${baseUrl}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
});

test('an unregistered email gets the same success answer, and no code is issued', async () => {
    const res = await requestCode('nobody@example.com');
    assert.equal(res.status, 200);
    assert.match((await res.json()).message, /If an account exists/);

    const verify = await fetch(`${baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com', otp: '123456' }),
    });
    assert.equal(verify.status, 400);
});

test('code requests are limited to 5 per email and IP in 15 minutes', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await requestCode('limit@example.com')).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
    assert.equal((await requestCode('other@example.com')).status, 200, 'another email is counted separately');
});
