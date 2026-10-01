/**
 * Refresh tokens are stored hashed (M-05): the database never holds a usable
 * token, sessions from before the change keep working, and the migration
 * converts existing rows.
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const TokenService = await import('../../src/modules/auth/tokenService.js');
const migration = await import('../../migrations/20261001120000_hash_refresh_tokens.mjs');
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

const refresh = (token) => fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `refreshToken=${token}` },
});

const insertPlainToken = async (token, extra = {}) => {
    await db('core_refresh_tokens').insert({
        user_id: ids.empA, token, expires_at: '2099-01-01 00:00:00', ...extra,
    });
};

test('a new session stores only the hash, and the token still refreshes', async () => {
    const token = TokenService.generateRefreshToken();
    await TokenService.saveRefreshToken(ids.empA, token, '127.0.0.1', 'test');

    assert.equal(await db('core_refresh_tokens').where({ token }).first(), undefined, 'token itself is not stored');
    assert.ok(await db('core_refresh_tokens').where({ token: TokenService.hashRefreshToken(token) }).first());

    const res = await refresh(token);
    assert.equal(res.status, 200, await res.clone().text());
    assert.ok((await res.json()).accessToken);
});

test('a session saved before hashing keeps working and is converted on use', async () => {
    const token = TokenService.generateRefreshToken();
    await insertPlainToken(token);

    assert.equal((await refresh(token)).status, 200);
    assert.equal(await db('core_refresh_tokens').where({ token }).first(), undefined);
    assert.ok(await db('core_refresh_tokens').where({ token: TokenService.hashRefreshToken(token) }).first());
});

test('after logout the token no longer refreshes', async () => {
    const token = TokenService.generateRefreshToken();
    await TokenService.saveRefreshToken(ids.empA, token, '127.0.0.1', 'test');

    const logout = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { Cookie: `refreshToken=${token}` } });
    assert.equal(logout.status, 200);
    assert.equal((await refresh(token)).status, 401);
});

test('changing the password keeps the current session, even one saved before hashing', async () => {
    const current = TokenService.generateRefreshToken();
    const other = TokenService.generateRefreshToken();
    await db('core_refresh_tokens').where({ user_id: ids.empA }).del();
    await insertPlainToken(current);
    await TokenService.saveRefreshToken(ids.empA, other, '127.0.0.1', 'test');

    await TokenService.revokeAllTokensForUser(ids.empA, { except: current });

    const rows = await db('core_refresh_tokens').where({ user_id: ids.empA }).select('token', 'revoked');
    assert.deepEqual(rows.find((r) => r.token === current)?.revoked, 0);
    assert.equal(rows.find((r) => r.token === TokenService.hashRefreshToken(other))?.revoked, 1);
});

test('the migration hashes stored tokens, clears replaced_by_token and can be re-run', async () => {
    const token = TokenService.generateRefreshToken();
    await insertPlainToken(token, { replaced_by_token: TokenService.generateRefreshToken() });

    await migration.up(db);
    await migration.up(db);

    const row = await db('core_refresh_tokens').where({ token: TokenService.hashRefreshToken(token) }).first();
    assert.ok(row, 'hashed exactly once');
    assert.equal(row.replaced_by_token, null);
    const [plain] = await db.raw('SELECT COUNT(*) AS n FROM core_refresh_tokens WHERE CHAR_LENGTH(token) <> 64');
    assert.equal(Number(plain[0].n), 0);
    const [index] = await db.raw("SHOW INDEX FROM core_refresh_tokens WHERE Key_name = 'idx_core_refresh_tokens_token'");
    assert.equal(index.length, 1);
});
