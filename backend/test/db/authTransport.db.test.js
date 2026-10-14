import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const TokenService = await import('../../src/modules/auth/tokenService.js');
const { seed } = await import('./support/seed.js');

let ids;
let server;
let baseUrl;
const transportLogs = [];
const originalInfo = console.info;

before(async () => {
    // Intercept console.info to capture [AUTH_TRANSPORT] logs
    console.info = (...args) => {
        const msg = args.map(a => String(a)).join(' ');
        if (msg.includes('[AUTH_TRANSPORT]')) {
            transportLogs.push(msg);
        }
        originalInfo.apply(console, args);
    };

    ({ ids } = await seed(db));

    // Set a known bcrypt hash for empA
    const hash = await bcrypt.hash('TestPassword123!', 10);
    await db('core_users').where({ user_id: ids.empA }).update({ user_password: hash });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    console.info = originalInfo;
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const post = (path, { body, headers = {} } = {}) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...headers,
    },
    body: JSON.stringify(body || {}),
});

test('mobile login returns refresh token and sessionId in the body, with NO Set-Cookie', async () => {
    const res = await post('/auth/login', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-App-Version': '3.2.0',
            'X-Device-Id': 'mob-dev-001',
            'X-Device-Name': 'Pixel 9 Pro'
        },
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken, 'accessToken present in body');
    assert.ok(data.refreshToken, 'refreshToken present in body');
    assert.ok(data.sessionId, 'sessionId present in body');
    assert.equal(data.user.email, 'emp.a@authz.test');

    const setCookie = res.headers.get('set-cookie');
    assert.equal(setCookie, null, 'No Set-Cookie header on mobile login');

    // Verify structured [AUTH_TRANSPORT] log
    const log = transportLogs.find(l => l.includes('endpoint=/auth/login') && l.includes('clientType=mobile'));
    assert.ok(log, 'AUTH_TRANSPORT emitted for mobile login');
    assert.match(log, /transport=body/);
    assert.match(log, /appVersion=3.2.0/);
    assert.match(log, new RegExp(`sessionId=${data.sessionId}`));
});

test('mobile refresh and logout work with the body token, with NO Set-Cookie', async () => {
    // 1. Mobile Login
    const loginRes = await post('/auth/login', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-App-Version': '3.2.0'
        },
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });
    const { refreshToken, sessionId } = await loginRes.json();

    // 2. Mobile Refresh with token in body
    const refreshRes = await post('/auth/refresh', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-App-Version': '3.2.0'
        },
        body: { refreshToken }
    });

    assert.equal(refreshRes.status, 200);
    const refreshData = await refreshRes.json();
    assert.ok(refreshData.accessToken);
    assert.ok(refreshData.refreshToken);
    assert.equal(refreshData.sessionId, sessionId);
    assert.equal(refreshRes.headers.get('set-cookie'), null, 'No Set-Cookie header on mobile refresh');

    const refreshLog = transportLogs.find(l => l.includes('endpoint=/auth/refresh') && l.includes('clientType=mobile'));
    assert.ok(refreshLog, 'AUTH_TRANSPORT emitted for mobile refresh');
    assert.match(refreshLog, /transport=body/);

    // 3. Mobile Logout with token in body
    const logoutRes = await post('/auth/logout', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-App-Version': '3.2.0'
        },
        body: { refreshToken }
    });

    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.headers.get('set-cookie'), null, 'No Set-Cookie header on mobile logout');

    const logoutLog = transportLogs.find(l => l.includes('endpoint=/auth/logout') && l.includes('clientType=mobile'));
    assert.ok(logoutLog, 'AUTH_TRANSPORT emitted for mobile logout');
    assert.match(logoutLog, /transport=body/);

    // 4. Session is revoked: refreshing again fails with SESSION_REVOKED
    const revokedRes = await post('/auth/refresh', {
        headers: { 'X-Client-Type': 'mobile' },
        body: { refreshToken }
    });
    assert.equal(revokedRes.status, 401);
    const revokedData = await revokedRes.json();
    assert.equal(revokedData.code, 'SESSION_REVOKED');
});

test('the web cookie flow behaves as before', async () => {
    // 1. Web Login (no X-Client-Type)
    const loginRes = await post('/auth/login', {
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.accessToken);
    assert.ok(loginData.refreshToken);

    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Web login sets refreshToken cookie');
    assert.match(setCookie, /refreshToken=/);

    // Extract cookie value
    const match = setCookie.match(/refreshToken=([^;]+)/);
    const cookieToken = match[1];

    const webLoginLog = transportLogs.find(l => l.includes('endpoint=/auth/login') && l.includes('clientType=other'));
    assert.ok(webLoginLog, 'AUTH_TRANSPORT emitted for web login');
    assert.match(webLoginLog, /transport=cookie/);

    // 2. Web Refresh via Cookie
    const refreshRes = await post('/auth/refresh', {
        headers: { Cookie: `refreshToken=${cookieToken}` }
    });

    assert.equal(refreshRes.status, 200);
    const refreshCookie = refreshRes.headers.get('set-cookie');
    assert.ok(refreshCookie, 'Web refresh sets updated refreshToken cookie');

    const webRefreshLog = transportLogs.find(l => l.includes('endpoint=/auth/refresh') && l.includes('clientType=other') && l.includes('transport=cookie'));
    assert.ok(webRefreshLog, 'AUTH_TRANSPORT emitted for web refresh');

    // 3. Web Logout via Cookie
    const logoutRes = await post('/auth/logout', {
        headers: { Cookie: `refreshToken=${cookieToken}` }
    });

    assert.equal(logoutRes.status, 200);
    const clearCookie = logoutRes.headers.get('set-cookie');
    assert.ok(clearCookie, 'Web logout clears refreshToken cookie');
    assert.match(clearCookie, /refreshToken=;/);

    const webLogoutLog = transportLogs.find(l => l.includes('endpoint=/auth/logout') && l.includes('clientType=other') && l.includes('transport=cookie'));
    assert.ok(webLogoutLog, 'AUTH_TRANSPORT emitted for web logout');
});

test('a request without X-Client-Type still works through existing X-Refresh-Token header path', async () => {
    // Create session directly
    const token = TokenService.generateRefreshToken();
    await TokenService.saveRefreshToken(ids.empA, token, '127.0.0.1', 'legacy-app-ua');

    // Refresh via X-Refresh-Token header
    const refreshRes = await post('/auth/refresh', {
        headers: { 'X-Refresh-Token': token }
    });

    assert.equal(refreshRes.status, 200);
    const headerRefreshLog = transportLogs.find(l => l.includes('endpoint=/auth/refresh') && l.includes('clientType=other') && l.includes('transport=header'));
    assert.ok(headerRefreshLog, 'AUTH_TRANSPORT emitted with transport=header');

    // Logout via X-Refresh-Token header
    const logoutRes = await post('/auth/logout', {
        headers: { 'X-Refresh-Token': token }
    });

    assert.equal(logoutRes.status, 200);
    const headerLogoutLog = transportLogs.find(l => l.includes('endpoint=/auth/logout') && l.includes('clientType=other') && l.includes('transport=header'));
    assert.ok(headerLogoutLog, 'AUTH_TRANSPORT emitted with transport=header for logout');
});

test('structured [AUTH_TRANSPORT] logs never leak token values and handle missing appVersion', async () => {
    // Request with no X-App-Version
    const res = await post('/auth/login', {
        headers: { 'X-Client-Type': 'mobile' },
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });

    const data = await res.json();
    const token = data.refreshToken;

    const noVersionLog = transportLogs.find(l => l.includes('appVersion=none'));
    assert.ok(noVersionLog, 'appVersion defaults to "none" when header is missing');

    // Verify token values are NEVER logged in any transport line
    for (const line of transportLogs) {
        assert.equal(line.includes(token), false, `Token must never be present in log: ${line}`);
        assert.equal(line.includes(data.accessToken), false, `Access token must never be present in log: ${line}`);
    }
});

test('error contract returns stable machine-readable codes for failures', async () => {
    // 1. Missing refresh token
    const noTokenRes = await post('/auth/refresh', {
        headers: { 'X-Client-Type': 'mobile' },
        body: {}
    });
    assert.equal(noTokenRes.status, 401);
    const noTokenData = await noTokenRes.json();
    assert.equal(noTokenData.code, 'NO_REFRESH_TOKEN');

    // 2. Invalid refresh token
    const invalidTokenRes = await post('/auth/refresh', {
        headers: { 'X-Client-Type': 'mobile' },
        body: { refreshToken: 'non_existent_token_12345' }
    });
    assert.equal(invalidTokenRes.status, 401);
    const invalidData = await invalidTokenRes.json();
    assert.equal(invalidData.code, 'INVALID_REFRESH_TOKEN');

    // 3. Bad credentials
    const badLoginRes = await post('/auth/login', {
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'WrongPassword999!'
        }
    });
    assert.equal(badLoginRes.status, 401);
    const badLoginData = await badLoginRes.json();
    assert.equal(badLoginData.code, 'INVALID_CREDENTIALS');
});

test('mobile login feeds per-device deduplication via x-device-id', async () => {
    const devId = 'unique-pixel-9-id';

    // First login
    const res1 = await post('/auth/login', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-Device-Id': devId,
            'X-Device-Name': 'Pixel 9'
        },
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();

    // Second login on same device_id
    const res2 = await post('/auth/login', {
        headers: {
            'X-Client-Type': 'mobile',
            'X-Device-Id': devId,
            'X-Device-Name': 'Pixel 9'
        },
        body: {
            user_input: 'emp.a@authz.test',
            user_password: 'TestPassword123!'
        }
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();

    // The session should be replaced in place on the same device_id (same session id)
    assert.equal(data1.sessionId, data2.sessionId);

    // Active session count for this device is exactly 1
    const activeRows = await db('sessions')
        .where({ user_id: ids.empA, device_id: devId, revoked: 0 });
    assert.equal(activeRows.length, 1);
});
