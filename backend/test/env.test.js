import { test } from 'node:test';
import assert from 'node:assert/strict';

const { checkEnv } = await import('../src/config/env.js');

const complete = {
    NODE_ENV: 'production',
    PORT: '5002',
    JWT_SECRET: 's',
    JWT_REFRESH_SECRET: 'r',
    DB_HOST: 'db',
    ATTENDANCE_DB_USER: 'u',
    ATTENDANCE_DB_PASSWORD: 'p',
    ATTENDANCE_DB_NAME: 'n',
    RAZORPAY_KEY_ID: 'k',
    RAZORPAY_KEY_SECRET: 'ks',
    FRONTEND_URL: 'https://attendance.mano.co.in',
    REDIS_HOST: 'redis',
    SMTP_USER: 'mail',
    GROQ_API_KEY: 'g',
    RECAPTCHA_SECRET_KEY: 'c',
};

test('a complete production environment passes without warnings', () => {
    assert.deepEqual(checkEnv(complete), { missing: [], warnings: [] });
});

test('missing secrets and database settings are reported (M-16)', () => {
    const { missing } = checkEnv({ ...complete, JWT_SECRET: '', ATTENDANCE_DB_PASSWORD: undefined });
    assert.deepEqual(missing, ['JWT_SECRET', 'ATTENDANCE_DB_PASSWORD']);
});

test('FRONTEND_URL is required only in production', () => {
    assert.deepEqual(checkEnv({ ...complete, FRONTEND_URL: '' }).missing, ['FRONTEND_URL']);
    assert.deepEqual(checkEnv({ ...complete, NODE_ENV: 'development', FRONTEND_URL: '' }).missing, []);
});

test('an invalid PORT is reported', () => {
    assert.deepEqual(checkEnv({ ...complete, PORT: 'abc' }).missing, ['PORT (must be a port number)']);
});

test('optional services only produce warnings', () => {
    const { missing, warnings } = checkEnv({ ...complete, REDIS_HOST: '', REDIS_URL: 'rediss://x', SMTP_USER: '', GROQ_API_KEY: '' });
    assert.deepEqual(missing, []);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /SMTP_USER/);
    assert.match(warnings[1], /GROQ_API_KEY/);
});
