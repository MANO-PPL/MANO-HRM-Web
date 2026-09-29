/**
 * Authorization tests against a real (throwaway) MySQL database.
 *   npm run test:db     (see test/db/support/testDb.js for setup)
 *
 * Each case is an HTTP call made with a real JWT, checking that:
 * - employees cannot use admin/HR endpoints (403)
 * - admin/HR cannot reach another organization's records (404)
 * - nobody reviews their own leave / DAR / correction request (403)
 * - the legitimate owner/admin flows still work (2xx)
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { seed } = await import('./support/seed.js');

let server;
let baseUrl;
let ids;
let tokens;

before(async () => {
    ({ ids, tokens } = await seed(attendanceDB));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

async function call(method, path, as, body) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON (e.g. PDF) */ }
    return { status: res.status, json };
}

function expectStatus(label, method, path, as, expected, body) {
    test(`${label}: ${method} ${path} as ${as} → ${expected}`, async () => {
        const { status, json } = await call(method, path(), as, body?.());
        const ok = Array.isArray(expected) ? expected.includes(status) : status === expected;
        assert.ok(ok, `expected ${expected}, got ${status}: ${JSON.stringify(json)}`);
    });
}

// ── Employees are refused on admin/HR endpoints (Stage 1 + Stage 3) ─────────
const adminOnly = [
    ['POST', () => '/policies/shifts', () => ({ shift_name: 'x' })],
    ['PUT', () => `/policies/shifts/${ids.shiftA}`, () => ({ shift_name: 'x' })],
    ['DELETE', () => `/policies/shifts/${ids.shiftA}`],
    ['GET', () => '/dar/requests/list'],
    ['POST', () => `/dar/requests/approve/${ids.dar_empA}`],
    ['POST', () => '/dar/settings/update', () => ({ buffer_minutes: 5 })],
    ['GET', () => '/attendance/daily-summary/admin?date=2026-01-01'],
    ['GET', () => '/admin/dashboard-stats'],
    ['POST', () => '/admin/departments', () => ({ dept_name: 'x' })],
    ['POST', () => '/admin/designations', () => ({ desg_name: 'x' })],
    ['GET', () => '/labour/sites'],
    ['POST', () => '/labour/finances/payout', () => ({})],
    ['GET', () => '/payroll/runs'],
    ['GET', () => `/payroll/employees/${ids.emp2A}/salary/history`],
    ['PUT', () => `/leaves/admin/status/${ids.leave_empA}`, () => ({ status: 'approved' })],
    ['PUT', () => `/leaves/balances/${ids.lbA}`, () => ({ allocated: 99 })],
    ['GET', () => '/feedback'],
];
for (const [method, path, body] of adminOnly) {
    expectStatus('employee blocked', method, path, 'empA', 403, body);
}

// ── Removed public S3 proxy ──────────────────────────────────────────────────
expectStatus('image proxy removed', 'GET', () => '/attendance/image?key=attendance_images/1_in', null, 404);

// ── Payroll: own record vs other employees vs other orgs ─────────────────────
expectStatus('own salary', 'GET', () => `/payroll/employees/${ids.empA}/salary`, 'empA', 200);
expectStatus('colleague salary', 'GET', () => `/payroll/employees/${ids.emp2A}/salary`, 'empA', 403);
expectStatus('same-org salary', 'GET', () => `/payroll/employees/${ids.empA}/salary`, 'adminA', 200);
expectStatus('other-org salary', 'GET', () => `/payroll/employees/${ids.empB}/salary`, 'adminA', 404);
expectStatus('other-org salary history', 'GET', () => `/payroll/employees/${ids.empB}/salary/history`, 'adminA', 404);
expectStatus('other-org run', 'GET', () => `/payroll/runs/${ids.runB}`, 'adminA', 404);
expectStatus('same-org run', 'GET', () => `/payroll/runs/${ids.runA}`, 'adminA', 200);
expectStatus('other-org mark paid', 'POST', () => `/payroll/runs/${ids.runB}/mark-paid`, 'adminA', 404);
expectStatus('colleague payslip', 'GET', () => `/payroll/entries/${ids.entry_emp2A}/payslip`, 'empA', 403);
expectStatus('other-org payslip', 'GET', () => `/payroll/entries/${ids.entry_empB}/payslip`, 'adminA', 404);
expectStatus('other-org package revisions', 'GET', () => `/payroll/packages/${ids.pkgB}/revisions`, 'adminA', 404);
expectStatus('same-org package revisions', 'GET', () => `/payroll/packages/${ids.pkgA}/revisions`, 'adminA', 200);

// ── Leave ────────────────────────────────────────────────────────────────────
expectStatus('other-org leave review', 'PUT', () => `/leaves/admin/status/${ids.leave_empB}`, 'hrA', 404, () => ({ status: 'approved', pay_type: 'Paid' }));
expectStatus('own leave review', 'PUT', () => `/leaves/admin/status/${ids.leave_hrA}`, 'hrA', 403, () => ({ status: 'approved', pay_type: 'Paid' }));
expectStatus('other-org leave balance update', 'PUT', () => `/leaves/balances/${ids.lbB}`, 'hrA', 404, () => ({ allocated: 99 }));
expectStatus('other-org leave balance delete', 'DELETE', () => `/leaves/balances/${ids.lbB}`, 'hrA', 404);
expectStatus('same-org leave balance update', 'PUT', () => `/leaves/balances/${ids.lbA}`, 'hrA', 200, () => ({ allocated: 12 }));

test('leave approval deducts the balance exactly once (transaction)', async () => {
    const before = await attendanceDB('leave_balances').where({ lb_id: ids.lbA }).first('used');
    const [first, second] = await Promise.all([
        call('PUT', `/leaves/admin/status/${ids.leave_empA}`, 'hrA', { status: 'approved', pay_type: 'Paid' }),
        call('PUT', `/leaves/admin/status/${ids.leave_empA}`, 'hrA', { status: 'approved', pay_type: 'Paid' }),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.json));
    assert.equal(second.status, 200, JSON.stringify(second.json));
    const afterApproval = await attendanceDB('leave_balances').where({ lb_id: ids.lbA }).first('used');
    assert.equal(Number(afterApproval.used) - Number(before.used), 1, 'two concurrent approvals of a 1-day leave must deduct 1 day');
});

// ── DAR change requests ─────────────────────────────────────────────────────
expectStatus('other-org DAR approval', 'POST', () => `/dar/requests/approve/${ids.dar_empB}`, 'hrA', 404);
expectStatus('own DAR approval', 'POST', () => `/dar/requests/approve/${ids.dar_hrA}`, 'hrA', 403);
expectStatus('same-org DAR approval', 'POST', () => `/dar/requests/approve/${ids.dar_empA}`, 'hrA', 200);

// ── DAR events ──────────────────────────────────────────────────────────────
expectStatus('other-org event edit', 'PUT', () => `/dar/events/update/${ids.event_empB}`, 'empA', 404, () => ({ title: 'x' }));
expectStatus('colleague event edit', 'PUT', () => `/dar/events/update/${ids.event_emp2A}`, 'empA', 403, () => ({ title: 'x' }));
expectStatus('colleague event delete', 'DELETE', () => `/dar/events/delete/${ids.event_emp2A}`, 'empA', 403);
expectStatus('own event edit', 'PUT', () => `/dar/events/update/${ids.event_empA}`, 'empA', 200, () => ({ title: 'mine' }));
expectStatus('HR edits same-org event', 'PUT', () => `/dar/events/update/${ids.event_emp2A}`, 'hrA', 200, () => ({ title: 'by hr' }));

// ── Attendance corrections ──────────────────────────────────────────────────
expectStatus('own correction review', 'PATCH', () => `/corrections/request/${ids.correction_hrA}`, 'hrA', 403, () => ({ status: 'approved' }));
expectStatus('other-org correction review', 'PATCH', () => `/corrections/request/${ids.correction_hrB}`, 'hrA', 404, () => ({ status: 'approved' }));

// ── Feedback ────────────────────────────────────────────────────────────────
test('feedback list only shows the caller\'s organization', async () => {
    const { status, json } = await call('GET', '/feedback', 'adminA');
    assert.equal(status, 200, JSON.stringify(json));
    const titles = json.data.map((f) => f.title);
    assert.deepEqual(titles, ['Feedback A']);
});
expectStatus('other-org feedback status', 'PATCH', () => `/feedback/${ids.feedbackB}/status`, 'adminA', 404, () => ({ status: 'CLOSED' }));
expectStatus('same-org feedback status', 'PATCH', () => `/feedback/${ids.feedbackA}/status`, 'adminA', 200, () => ({ status: 'CLOSED' }));

// ── Input validation found by the employee probe ────────────────────────────
expectStatus('event create without fields', 'POST', () => '/dar/events/create', 'empA', 400, () => ({}));
expectStatus('event create (mixed-case type)', 'POST', () => '/dar/events/create', 'empA', 200, () => ({
    title: 'Standup', event_date: '2026-09-29', start_time: '10:00', end_time: '10:15', type: 'Meeting',
}));
