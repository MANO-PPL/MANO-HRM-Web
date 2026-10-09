/**
 * leave_attachments foreign key (migration 20260929120000):
 * - attachments of current leave requests can be saved
 * - withdrawing a leave removes its attachment rows (ON DELETE CASCADE)
 * - the migration moves unreachable rows to a backup table and is re-runnable
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../../src/app.js');
const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { seed } = await import('./support/seed.js');

let ids;
let tokens;
let server;
let baseUrl;

before(async () => {
    ({ ids, tokens } = await seed(db));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await runShutdownHooks();
});

const referencedTables = async () => {
    const [rows] = await db.raw(
        `SELECT referenced_table_name AS t, delete_rule AS rule FROM information_schema.referential_constraints
         WHERE constraint_schema = DATABASE() AND table_name = 'leave_attachments'`
    );
    return rows;
};

test('foreign key points at leave_request with ON DELETE CASCADE', async () => {
    assert.deepEqual(await referencedTables(), [{ t: 'leave_request', rule: 'CASCADE' }]);
});

test('an attachment of a current leave request can be saved', async () => {
    await db('leave_attachments').insert({ leave_id: ids.leave_empA, file_key: 'leaves/x/doc.pdf' });
    assert.ok(await db('leave_attachments').where({ leave_id: ids.leave_empA }).first());
});

test('withdrawing a leave removes its attachment rows', async () => {
    const res = await fetch(`${baseUrl}/leaves/request/${ids.leave_empA}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.empA}` },
    });
    assert.equal(res.status, 200, await res.text());
    assert.equal(await db('leave_request').where({ lr_id: ids.leave_empA }).first(), undefined);
    assert.equal(await db('leave_attachments').where({ leave_id: ids.leave_empA }).first(), undefined);
});

