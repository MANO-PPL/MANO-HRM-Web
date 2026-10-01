/**
 * Sessions on several devices (web + mobile app): ending one session must not
 * sign the user out elsewhere, and a password change keeps the device that
 * made it signed in, also in the apps (which send only the access token).
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const TokenService = await import('../../src/modules/auth/tokenService.js');
const { seed } = await import('./support/seed.js');

let ids;
let server;
let baseUrl;

before(async () => {
    ({ ids } = await seed(db));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const post = (path, { body, cookie, bearer } = {}) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: `refreshToken=${cookie}` } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body || {}),
});

// The web app sends the refresh token as a cookie, the mobile app in the body
const webRefresh = (token) => post('/auth/refresh', { cookie: token });
const appRefresh = (token) => post('/auth/refresh', { body: { refreshToken: token } });

async function newSession(userId) {
    const token = TokenService.generateRefreshToken();
    await TokenService.saveRefreshToken(userId, token, '127.0.0.1', 'test');
    return token;
}

test('logging out on the web does not sign the phone out, even if the old token is sent again', async () => {
    const web = await newSession(ids.empA);
    const phone = await newSession(ids.empA);

    assert.equal((await post('/auth/logout', { cookie: web })).status, 200);
    assert.equal((await webRefresh(web)).status, 401, 'the logged-out session is refused');
    assert.equal((await appRefresh(phone)).status, 200, 'the phone stays signed in');
});

test('a token sent by the app wins over a stale cookie from an earlier login', async () => {
    const stale = await newSession(ids.empA);
    await post('/auth/logout', { cookie: stale });
    const current = await newSession(ids.empA);

    const res = await post('/auth/refresh', { cookie: stale, body: { refreshToken: current } });
    assert.equal(res.status, 200);
});

test('refreshed access tokens carry the session id', async () => {
    const phone = await newSession(ids.empB);
    const { accessToken } = await (await appRefresh(phone)).json();
    const { sid } = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
    const row = await db('core_refresh_tokens').where({ token: TokenService.hashRefreshToken(phone) }).first();
    assert.equal(sid, row.id);
});

test('changing the password in the app keeps the app signed in and ends other sessions', async () => {
    const phone = await newSession(ids.emp2A);
    const web = await newSession(ids.emp2A);
    const { accessToken } = await (await appRefresh(phone)).json();

    // The app sends only its access token, not the refresh token
    const res = await post('/auth/change-password', { bearer: accessToken, body: { newPassword: 'N3w-password-123' } });
    assert.equal(res.status, 200, await res.clone().text());

    assert.equal((await appRefresh(phone)).status, 200, 'the phone that changed the password stays signed in');
    assert.equal((await webRefresh(web)).status, 401, 'other sessions are ended');
});
