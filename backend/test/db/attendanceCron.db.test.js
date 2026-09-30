/**
 * Runs the attendance cron passes against the real schema and fails if they
 * log an error (e.g. a broken query). Covers the bounded missed-punch pass and
 * users with several work locations.
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { processHourlyAttendance, checkAndSendShiftReminders } = await import('../../src/cron/AttendanceProcessor.js');
const { seed } = await import('./support/seed.js');

let ids;
const errors = [];
const originalError = console.error;

before(async () => {
    ({ ids } = await seed(db));
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // An employee assigned to two work locations
    const locations = [];
    for (const name of ['HQ', 'Branch']) {
        const [id] = await db('org_work_locations').insert({ org_id: ids.orgA, location_name: name, latitude: 12.9, longitude: 77.6 });
        locations.push(id);
    }
    await db('org_user_work_locations').insert(locations.map((location_id) => ({ user_id: ids.empA, location_id })));
    await db('org_shifts').where('shift_id', ids.shiftA).update({
        policy_rules: JSON.stringify({ shift_timing: { start_time: '09:00:00', end_time: '18:00:00' }, correction_deadline: 45 }),
    });

    // A missed punch inside the lookback window and one far outside it
    await db('attn_daily_summary_v2').insert([
        { user_id: ids.empA, date: lastWeek, status: 'MISSED_PUNCH' },
        { user_id: ids.emp2A, date: '2020-01-01', status: 'MISSED_PUNCH' },
    ]);
    await db('attn_punches').insert({ user_id: ids.empA, punch_time: `${today} 09:00:00`, punch_type: 'in' });

    // Redis is not needed here; its connection warnings are not query errors
    console.error = (...args) => {
        const text = args.map(String).join(' ');
        if (!text.includes('[Redis:')) errors.push(text);
        originalError(...args);
    };
});

after(async () => {
    console.error = originalError;
    await runShutdownHooks();
});

test('hourly attendance pass (incl. missed-punch notifications) runs without errors', async () => {
    await processHourlyAttendance();
    assert.deepEqual(errors, []);
});

test('shift reminder pass runs without errors', async () => {
    await checkAndSendShiftReminders();
    assert.deepEqual(errors, []);
});
