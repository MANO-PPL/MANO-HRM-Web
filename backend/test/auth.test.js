import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { authenticateJWT } = await import('../src/middleware/auth.js');

function run(middleware, token) {
    return new Promise((resolve) => {
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, body }); },
        };
        middleware(req, res, (err) => resolve({ next: true, err }));
    });
}

test('purpose-specific tokens (e.g. password_reset) cannot authenticate API calls (SEC-12)', async () => {
    const token = jwt.sign({ user_id: 1, type: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const result = await run(authenticateJWT, token);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'TOKEN_INVALID');
});

test('tokens signed with a non-HS256 algorithm are rejected', async () => {
    const token = jwt.sign({ user_id: 1 }, process.env.JWT_SECRET, { algorithm: 'HS512' });
    const result = await run(authenticateJWT, token);
    assert.equal(result.status, 401);
});
