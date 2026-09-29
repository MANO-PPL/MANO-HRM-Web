/**
 * "Postman probe": calls every authenticated route as a plain employee of
 * org A, using org B's record ids in URLs, and prints what the server
 * returned. Runs against the throwaway test database only (see
 * support/testDb.js).
 *
 *   node test/db/employee-probe.js
 *
 * 403 = refused, 404 = not found / other org hidden, 400 = passed auth but
 * rejected the (empty) input, 2xx = allowed. Anything that is not 403/404
 * should be a route employees are meant to use (self-service).
 */
import './support/testDb.js';

const { collectRoutes, describeGuards } = await import('../support/routeIntrospection.js');
const { attendanceDB } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { seed } = await import('./support/seed.js');

const { ids, tokens } = await seed(attendanceDB);
const routes = await collectRoutes();
const { default: app } = await import('../../src/app.js');
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// Route params → another organization's records (or a non-existent id)
function fillParams(path) {
    const byContext = [
        [/^\/payroll\/employees\/:id/, { id: ids.empB }],
        [/^\/leaves\/admin\/status\/:id/, { id: ids.leave_empB }],
        [/^\/leaves\/request\/:id/, { id: ids.leave_empB }],
        [/^\/dar\/requests\/(approve|reject)\/:id/, { id: ids.dar_empB }],
        [/^\/dar\/events\/(update|delete)\/:id/, { id: ids.event_empB }],
        [/^\/feedback\/:id/, { id: ids.feedbackB }],
    ];
    const named = {
        user_id: ids.empB, employeeId: ids.empB, entryId: ids.entry_empB, runId: ids.runB,
        packageGroupId: ids.pkgB, lb_id: ids.lbB, shift_id: ids.shiftB, acr_id: ids.correction_hrB,
    };
    const ctx = byContext.find(([re]) => re.test(path))?.[1] || {};
    return path
        .replace(/\*\w+/g, 'x')
        .replace(/:(\w+)/g, (_, name) => String(ctx[name] ?? named[name] ?? 999999));
}

const SKIP = new Set([
    'POST /attendance/ai-summary', // proxies to the Python service on port 8001
    'POST /auth/logout',
]);

const results = [];
for (const route of routes) {
    const guards = await describeGuards(route);
    if (!guards.authenticated) continue;
    for (const method of route.methods) {
        const key = `${method} ${route.path}`;
        if (SKIP.has(key) || method === 'ALL') continue;
        const url = base + fillParams(route.path);
        const hasBody = !['GET', 'DELETE'].includes(method);
        let status;
        try {
            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${tokens.empA}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
                body: hasBody ? '{}' : undefined,
                signal: AbortSignal.timeout(10000),
            });
            status = res.status;
            await res.arrayBuffer();
        } catch (err) {
            status = `ERR ${err.name}`;
        }
        results.push({ key, status, roles: guards.roles ? guards.roles.join('|') : '-' });
    }
}

const bucket = (s) => (s === 403 ? 'refused (403)' : s === 404 ? 'not found (404)' : s === 401 ? 'unauthenticated (401)'
    : typeof s === 'number' && s >= 500 ? 'SERVER ERROR (5xx)' : typeof s === 'number' && s >= 400 ? 'input rejected (4xx)'
    : typeof s === 'number' && s < 300 ? 'ALLOWED (2xx)' : String(s));
const groups = {};
for (const r of results) (groups[bucket(r.status)] ||= []).push(r);
for (const [name, rows] of Object.entries(groups)) {
    console.log(`\n## ${name}: ${rows.length}`);
    if (!/^(refused|not found)/.test(name)) {
        for (const r of rows) console.log(`  ${r.status}  ${r.key}`);
    }
}

server.close();
await runShutdownHooks();
process.exit(0);
