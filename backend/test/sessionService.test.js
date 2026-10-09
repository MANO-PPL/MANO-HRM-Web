import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sessionService from '../src/modules/auth/sessionService.js';
import * as tokenService from '../src/modules/auth/tokenService.js';

test('sessionService exports all required core methods', () => {
    assert.equal(typeof sessionService.createSession, 'function');
    assert.equal(typeof sessionService.validateSession, 'function');
    assert.equal(typeof sessionService.extendSession, 'function');
    assert.equal(typeof sessionService.revokeSession, 'function');
    assert.equal(typeof sessionService.revokeAllSessions, 'function');
    assert.equal(typeof sessionService.listSessions, 'function');
    assert.equal(typeof sessionService.getSessionMetrics, 'function');
    assert.equal(typeof sessionService.cleanupExpiredSessions, 'function');
    assert.equal(typeof sessionService.cleanupOldSessions, 'function');
    assert.equal(typeof sessionService.hashRefreshToken, 'function');
    assert.equal(typeof sessionService.generateToken, 'function');
});

test('hashRefreshToken produces standard 64-character SHA-256 hex string', () => {
    const token = 'sample_refresh_token_string_1234567890';
    const hash = sessionService.hashRefreshToken(token);
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);

    // Deterministic check
    assert.equal(sessionService.hashRefreshToken(token), hash);
    assert.notEqual(sessionService.hashRefreshToken('different_token'), hash);
});

test('generateToken produces strong random 80-character hex tokens', () => {
    const token1 = sessionService.generateToken();
    const token2 = sessionService.generateToken();
    assert.equal(token1.length, 80);
    assert.equal(token2.length, 80);
    assert.notEqual(token1, token2);
    assert.match(token1, /^[0-9a-f]{80}$/);
});

test('tokenService delegates cleanly to sessionService', () => {
    assert.equal(tokenService.hashRefreshToken, sessionService.hashRefreshToken);
    assert.equal(tokenService.generateRefreshToken, sessionService.generateToken);
    assert.equal(typeof tokenService.saveRefreshToken, 'function');
    assert.equal(typeof tokenService.verifyRefreshToken, 'function');
    assert.equal(typeof tokenService.extendRefreshToken, 'function');
    assert.equal(typeof tokenService.revokeRefreshToken, 'function');
    assert.equal(typeof tokenService.revokeAllTokensForUser, 'function');
    assert.equal(typeof tokenService.getUserActiveSessions, 'function');
    assert.equal(typeof tokenService.revokeUserSession, 'function');
    assert.equal(typeof tokenService.revokeOtherUserSessions, 'function');
});
