/**
 * Permanent organization deletion against the real schema:
 * - deletes org A's rows from every table (no foreign key blocks it)
 * - leaves org B untouched
 * - sends org A's S3 keys for deletion
 * - DELETION_PLAN covers every table that has org_id / user_id / employee_id
 */
import './support/testDb.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { deleteOrganization, DELETION_TABLES } = await import('../../src/modules/organisations/orgDeletionService.js');
const { seed } = await import('./support/seed.js');

let ids;
const fakeS3 = { deleted: [], listed: [] };
fakeS3.deleteFile = async ({ key }) => { fakeS3.deleted.push(key); };
fakeS3.listFiles = async (prefix) => { fakeS3.listed.push(prefix); return { files: [] }; };

// Rows in the tables most likely to break a deletion (foreign keys) or to
// hold S3 files, for both orgs
async function seedExtra(org) {
    const orgId = ids[`org${org}`];
    const emp = ids[`emp${org}`];
    const today = new Date().toISOString().slice(0, 10);

    await db('core_users').where('user_id', emp).update({ profile_image_url: 'https://cdn.example/p.webp' });
    await db('attn_punches').insert({ user_id: emp, punch_time: `${today} 09:00:00`, punch_type: 'in', metadata: JSON.stringify({ image_key: `attendance_images/${org}_in.webp` }) });
    await db('attn_daily_summary_v2').insert({ user_id: emp, date: today, status: 'PRESENT' });
    await db('attn_daily_activities').insert({ user_id: emp, activity_date: today, start_time: '09:00', end_time: '10:00', title: 'Work' });
    await db('comm_notifications').insert({ user_id: emp, title: 'Hello' });
    await db('sessions').insert({ user_id: emp, token_hash: `token_hash_${org}`, expires_at: `${today} 23:59:59` });
    await db('core_user_fcm_tokens').insert({ user_id: emp, token: `fcm-${org}` });
    await db('sys_api_logs').insert({ org_id: orgId, user_id: emp, request_path: '/x', method: 'GET', status_code: 200, duration_ms: 1, is_success: 1 });
    await db('sys_activity_logs').insert({ org_id: orgId, user_id: emp, event_type: 'TEST' });

    const [deptId] = await db('org_departments').insert({ org_id: orgId, dept_name: `Dept ${org}` });
    await db('core_users').where('user_id', emp).update({ dept_id: deptId, shift_id: ids[`shift${org}`] });
    await db('org_holidays').insert({ org_id: orgId, holiday_name: 'Holiday', holiday_date: today });
    const [locationId] = await db('org_work_locations').insert({ org_id: orgId, location_name: 'HQ', latitude: 12.9, longitude: 77.6 });
    await db('org_user_work_locations').insert({ user_id: emp, location_id: locationId });

    const [conversationId] = await db('chat_conversations').insert({ org_id: orgId, type: 'group', created_by: emp });
    await db('chat_conversation_members').insert({ conversation_id: conversationId, user_id: emp });
    const [messageId] = await db('chat_messages').insert({ conversation_id: conversationId, sender_id: emp });
    await db('chat_message_attachments').insert({ message_id: messageId, file_name: 'a.pdf', storage_key: `chat/${org}/a.pdf` });

    await db('feedback_attachments').insert({ feedback_id: ids[`feedback${org}`], file_key: `feedback/${org}/f.png` });
    await db('leave_requests').insert({ user_id: emp, leave_type: 'Casual', start_date: today, end_date: today });
    // leave_attachments.leave_id holds leave_request ids. FK checks are off for
    // this insert so the test works whether or not the foreign key migration
    // (20260929120000) has been applied.
    await db.transaction(async (trx) => {
        await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
        await trx('leave_attachments').insert({ leave_id: ids[`leave_emp${org}`], file_key: `leaves/${org}/l.pdf` });
        await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    });
    await db('doc_employee_uploads').insert({ employee_id: emp, doc_key: 'pan', file_name: 'pan.pdf', file_key: `docs/${org}/pan.pdf` });

    const [siteId] = await db('labour_sites').insert({ org_id: orgId, site_name: `Site ${org}` });
    const [labourId] = await db('labours').insert({ org_id: orgId, site_id: siteId, name: 'Worker', role: 'Mason', monthly_salary: 1000 });
    await db('labour_attendance').insert({ org_id: orgId, labour_id: labourId, site_id: siteId, date: today });
    await db('labour_advances').insert({ org_id: orgId, labour_id: labourId, amount: 100, date: today });
    await db('payroll_packages').insert({ package_group_id: ids[`pkgGroup${org}`] || ids[`pkg${org}`], effective_from: today });
}

// Rows in `table` that belong to the given org, by whichever reference columns it has
async function countOwned(table, orgId, userIds) {
    const cols = (await db.raw(
        `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN ('org_id','user_id','employee_id','sender_id')`,
        [table]
    ))[0].map((r) => r.c);
    if (cols.length === 0) return null;
    const q = db(table).count({ n: '*' }).where((w) => {
        for (const c of cols) {
            if (c === 'org_id') w.orWhere('org_id', orgId);
            else w.orWhereIn(c, userIds.length ? userIds : [-1]);
        }
    });
    return Number((await q)[0].n);
}

async function referenceTables() {
    const [rows] = await db.raw(
        `SELECT DISTINCT table_name AS t FROM information_schema.columns WHERE table_schema = DATABASE()
         AND column_name IN ('org_id','user_id','employee_id') AND table_name <> 'core_super_admins'`
    );
    return rows.map((r) => r.t).sort();
}

let tables;
let userIdsA;
let userIdsB;
let countsBBefore;
let result;

before(async () => {
    ({ ids } = await seed(db));
    await seedExtra('A');
    await seedExtra('B');
    tables = await referenceTables();
    userIdsA = (await db('core_users').where('org_id', ids.orgA).pluck('user_id'));
    userIdsB = (await db('core_users').where('org_id', ids.orgB).pluck('user_id'));
    countsBBefore = {};
    for (const t of tables) countsBBefore[t] = await countOwned(t, ids.orgB, userIdsB);
    result = await deleteOrganization(ids.orgA, { db, s3: fakeS3 });
});

after(() => runShutdownHooks());

test('DELETION_PLAN covers every table that references an org or a user', () => {
    const missing = tables.filter((t) => !DELETION_TABLES.includes(t));
    assert.deepEqual(missing, [], `Tables with org_id/user_id/employee_id not in the deletion plan: ${missing.join(', ')}`);
});

test('no row belonging to the deleted org remains in any table', async () => {
    const leftovers = [];
    for (const t of tables) {
        const n = await countOwned(t, ids.orgA, userIdsA);
        if (n) leftovers.push(`${t}: ${n}`);
    }
    // Tables reached only through a parent
    const orphanChecks = {
        chat_message_attachments: 'SELECT COUNT(*) AS n FROM chat_message_attachments a LEFT JOIN chat_messages m ON m.id = a.message_id WHERE m.id IS NULL',
        feedback_attachments: 'SELECT COUNT(*) AS n FROM feedback_attachments a LEFT JOIN feedback_tickets f ON f.feedback_id = a.feedback_id WHERE f.feedback_id IS NULL',
        leave_attachments: 'SELECT COUNT(*) AS n FROM leave_attachments a LEFT JOIN leave_request l ON l.lr_id = a.leave_id WHERE l.lr_id IS NULL',
        payroll_packages: 'SELECT COUNT(*) AS n FROM payroll_packages p LEFT JOIN payroll_package_groups g ON g.package_group_id = p.package_group_id WHERE g.package_group_id IS NULL',
        leave_policies_rules: 'SELECT COUNT(*) AS n FROM leave_policies_rules r LEFT JOIN leave_policies p ON p.lp_id = r.lp_id WHERE p.lp_id IS NULL',
    };
    for (const [t, sql] of Object.entries(orphanChecks)) {
        const n = Number((await db.raw(sql))[0][0].n);
        if (n) leftovers.push(`${t} (orphaned): ${n}`);
    }
    assert.deepEqual(leftovers, []);
    assert.equal(await db('core_organizations').where('org_id', ids.orgA).first(), undefined);
    assert.ok(result.rowsDeleted > 40, `expected many rows deleted, got ${result.rowsDeleted}`);
});

test('the other organization is untouched', async () => {
    const changed = [];
    for (const t of tables) {
        const now = await countOwned(t, ids.orgB, userIdsB);
        if (now !== countsBBefore[t]) changed.push(`${t}: ${countsBBefore[t]} → ${now}`);
    }
    assert.deepEqual(changed, []);
    assert.ok(await db('core_organizations').where('org_id', ids.orgB).first());

    // Child tables with no org/user column of their own (checked by their keys)
    for (const [table, where] of [
        ['chat_message_attachments', { storage_key: 'chat/B/a.pdf' }],
        ['feedback_attachments', { file_key: 'feedback/B/f.png' }],
        ['leave_attachments', { file_key: 'leaves/B/l.pdf' }],
        ['payroll_packages', { package_group_id: ids.pkgB }],
    ]) {
        assert.ok(await db(table).where(where).first(), `org B row missing from ${table}`);
    }
});

test("the org's files are sent for deletion", () => {
    const expected = [
        'attendance_images/A_in.webp', 'chat/A/a.pdf', 'feedback/A/f.png', 'leaves/A/l.pdf',
        'docs/A/pan.pdf', 'public/profile_pics/AUTHZA-emp.webp',
    ];
    for (const key of expected) assert.ok(fakeS3.deleted.includes(key), `missing S3 delete for ${key}`);
    assert.ok(!fakeS3.deleted.some((k) => k.includes('/B/') || k.startsWith('attendance_images/B')), `must not delete org B files: ${JSON.stringify(fakeS3.deleted)}`);
    assert.deepEqual(fakeS3.listed, [`reports/${ids.orgA}/`]);
});

test('deleting again is a no-op (resumable)', async () => {
    const again = await deleteOrganization(ids.orgA, { db, s3: fakeS3 });
    assert.equal(again.rowsDeleted, 0);
});
