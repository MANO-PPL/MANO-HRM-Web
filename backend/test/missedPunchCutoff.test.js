import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { computeMissedPunchCutoffMinutes } = await import('../src/cron/AttendanceProcessor.js');
const { runShutdownHooks } = await import('../src/lifecycle/shutdown.js');
after(() => runShutdownHooks());

// Line-for-line copy of the logic that was duplicated in AttendanceProcessor
function previousImplementation(rules) {
    const startTimeStr = rules.shift_timing?.start_time || rules.start_time || "09:00:00";
    const endTimeStr = rules.shift_timing?.end_time || rules.end_time || "18:00:00";
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    let latestCheckoutMinutes;
    if (rules.missed_punch_check_time) {
        const [checkH, checkM] = rules.missed_punch_check_time.split(':').map(Number);
        latestCheckoutMinutes = checkH * 60 + checkM;
        if (latestCheckoutMinutes < (startH * 60 + startM)) latestCheckoutMinutes += 24 * 60;
    } else {
        latestCheckoutMinutes = (endH * 60) + endM + (8 * 60) + 30;
    }
    return latestCheckoutMinutes;
}

const cases = [
    {},
    { shift_timing: { start_time: '09:00:00', end_time: '18:00:00' } },
    { shift_timing: { start_time: '22:00:00', end_time: '06:00:00' } },
    { start_time: '14:00:00', end_time: '23:00:00' },
    { shift_timing: { start_time: '09:00:00', end_time: '18:00:00' }, missed_punch_check_time: '23:30' },
    { shift_timing: { start_time: '09:00:00', end_time: '18:00:00' }, missed_punch_check_time: '02:00' },
    { shift_timing: { start_time: '22:00:00', end_time: '06:00:00' }, missed_punch_check_time: '10:00' },
];

test('computeMissedPunchCutoffMinutes matches the previous inline logic', () => {
    for (const rules of cases) {
        assert.equal(computeMissedPunchCutoffMinutes(rules), previousImplementation(rules), JSON.stringify(rules));
    }
});
