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
    'GET /ready',
    'GET /api/ready',
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
    // Payments are deferred by decision until billing is implemented.
    'POST /payment/create-customer',
    'POST /payment/create-order',
    'POST /payment/verify',
]);

// Routes that must be limited to admin/HR at the route level.
const STAFF_ONLY_ROUTES = [
    'POST /policies/shifts',
    'PUT /policies/shifts/:shift_id',
    'DELETE /policies/shifts/:shift_id',
    'GET /dar/requests/list',
    'POST /dar/requests/approve/:id',
    'POST /dar/requests/reject/:id',
    'POST /dar/settings/update',
    'GET /attendance/daily-summary/admin',
];

const REMOVED_ROUTES = ['GET /attendance/image', 'GET /attendance/image/*key'];

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

test('unauthenticated S3 image proxy is removed (SEC-01)', () => {
    for (const key of REMOVED_ROUTES) {
        assert.equal(routeMap.has(key), false, `${key} should not exist`);
    }
});

for (const key of STAFF_ONLY_ROUTES) {
    test(`${key} is limited to admin/HR (SEC-02/03/06)`, () => {
        const guards = routeMap.get(key);
        assert.ok(guards, `${key} not found`);
        assert.ok(guards.authenticated, `${key} must require authentication`);
        assert.ok(guards.roles, `${key} has no route-level role gate`);
        const disallowed = guards.roles.filter((r) => !['admin', 'hr'].includes(r));
        assert.deepEqual(disallowed, [], `${key} also allows: ${disallowed.join(', ')}`);
    });
}
