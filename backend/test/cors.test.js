import { test } from 'node:test';
import assert from 'node:assert/strict';

// cors.js reads NODE_ENV/FRONTEND_URL at load time; a query string gives each
// case its own module instance.
async function loadPolicy(nodeEnv, tag) {
    process.env.NODE_ENV = nodeEnv;
    process.env.FRONTEND_URL = 'https://attendance.mano.co.in';
    process.env.CORS_ORIGINS = '';
    return import(`../src/config/cors.js?${tag}`);
}

test('production allows only the configured frontend origin', async () => {
    const { isOriginAllowed } = await loadPolicy('production', 'prod');
    assert.equal(isOriginAllowed('https://attendance.mano.co.in'), true);
    assert.equal(isOriginAllowed(undefined), true, 'no Origin header (same-origin GET, curl)');
    assert.equal(isOriginAllowed('http://localhost:5173'), false);
    assert.equal(isOriginAllowed('http://192.168.1.20:5173'), false);
    assert.equal(isOriginAllowed('https://evil.example.com'), false);
});

test('development also allows localhost and private LAN, but not public 172.x (SEC-14)', async () => {
    const { isOriginAllowed } = await loadPolicy('development', 'dev');
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('http://192.168.1.20:5173'), true);
    assert.equal(isOriginAllowed('http://10.0.0.5:5173'), true);
    assert.equal(isOriginAllowed('http://172.20.1.2:5173'), true);
    assert.equal(isOriginAllowed('http://172.217.1.1'), false, '172.217.x is public (Google), not LAN');
    assert.equal(isOriginAllowed('http://192.evil.com'), false);
});
