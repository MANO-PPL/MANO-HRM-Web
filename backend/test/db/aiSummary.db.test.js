/**
 * POST /attendance/ai-summary sends attendance data to the Python summary
 * service only when AI_SUMMARY_URL is set (M-14). Port 8001 on the server
 * belongs to another application.
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

delete process.env.AI_SUMMARY_URL;

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { seed } = await import('./support/seed.js');

let tokens;
let server;
let baseUrl;
let summaryService;
let summaryServiceUrl;
const serviceRequests = [];

before(async () => {
    ({ tokens } = await seed(db));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Stand-in for the Python service
    summaryService = http.createServer((req, res) => {
        serviceRequests.push(req.url);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ overall_summary: 'from the service' }));
    });
    summaryService.listen(0, '127.0.0.1');
    await new Promise((resolve) => summaryService.once('listening', resolve));
    summaryServiceUrl = `http://127.0.0.1:${summaryService.address().port}`;
});

after(async () => {
    delete process.env.AI_SUMMARY_URL;
    await new Promise((resolve) => summaryService.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const requestSummary = () => fetch(`${baseUrl}/attendance/ai-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.adminA}` },
    body: JSON.stringify({ date: '2026-09-30', employees: [{ name: 'Asha', department: 'Ops', status: 'present' }], analytics: {} }),
});

test('without AI_SUMMARY_URL the built-in summary is returned and no data is sent anywhere', async () => {
    const res = await requestSummary();
    assert.equal(res.status, 200);
    assert.match((await res.json()).overall_summary, /Attendance summary for 2026-09-30/);
    assert.deepEqual(serviceRequests, []);
});

test('with AI_SUMMARY_URL the configured service is used', async () => {
    process.env.AI_SUMMARY_URL = summaryServiceUrl;
    const res = await requestSummary();
    assert.equal((await res.json()).overall_summary, 'from the service');
    assert.deepEqual(serviceRequests, ['/summarize']);
});
