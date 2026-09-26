import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { maskSensitiveFields } = await import('../src/middleware/apiMonitor.js');

test('masks credentials regardless of key casing or separators (SEC-11)', () => {
    const masked = maskSensitiveFields({
        newPassword: 'hunter2',
        refreshToken: 'abc',
        resetToken: 'def',
        user_password: 'p',
        'confirm-password': 'p',
        nested: { accessToken: 'x', otp: '123456' },
        name: 'Asha',
    });
    assert.equal(masked.newPassword, '********');
    assert.equal(masked.refreshToken, '********');
    assert.equal(masked.resetToken, '********');
    assert.equal(masked.user_password, '********');
    assert.equal(masked['confirm-password'], '********');
    assert.equal(masked.nested.accessToken, '********');
    assert.equal(masked.nested.otp, '********');
    assert.equal(masked.name, 'Asha');
});
