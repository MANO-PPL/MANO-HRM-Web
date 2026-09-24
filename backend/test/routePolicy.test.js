/**
 * Route policy test (no database needed).
 *
 * Loads the Express app, inspects the guard middleware on every route and
 * asserts the access rules the audit requires. A new unauthenticated route
 * fails this test until it is added to PUBLIC_ROUTES on purpose.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { collectRoutes, describeGuards } = await import('./support/routeIntrospection.js');

// Routes that are intentionally reachable without a JWT.
const PUBLIC_ROUTES = new Set([
    'GET /health',
    'GET /api/health',
    'GET /auth/captcha/generate',
    'POST /auth/login',
    'POST /auth/super-admin/login',
    'POST /auth/forgot-password',
    'POST /auth/verify-otp',
    'POST /auth/reset-password',
    'POST /auth/onboard',
    'POST /auth/refresh',
    'POST /auth/logout',
    'POST /website-chatbot/ask',
    'GET /geo/countries',
    'GET /geo/states/:country_code',
    'GET /geo/cities/:country_code/:state_code',
    'ALL /(.*)', // 404 handler
    // Unauthenticated S3 image proxy (SEC-01) — removed in a later commit
    'GET /attendance/image',
    'GET /attendance/image/*key',
    // Payments are deferred by decision until billing is implemented.
    'POST /payment/create-customer',
    'POST /payment/create-order',
    'POST /payment/verify',
]);

let routeMap;

before(async () => {
    routeMap = new Map();
    for (const route of await collectRoutes()) {
        const guards = await describeGuards(route);
        for (const method of route.methods) {
            routeMap.set(`${method} ${route.path}`, guards);
        }
    }
});

test('every route requires authentication unless explicitly public', () => {
    const unexpected = [...routeMap]
        .filter(([key, guards]) => !guards.authenticated && !PUBLIC_ROUTES.has(key))
        .map(([key]) => key);
    assert.deepEqual(unexpected, [], `Unauthenticated routes not in PUBLIC_ROUTES:\n${unexpected.join('\n')}`);
});
