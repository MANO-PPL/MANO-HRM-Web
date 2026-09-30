/**
 * leave_attachments.leave_id stores ids from leave_request (see
 * leaveService.submitLeaveRequest), but its foreign key pointed at the legacy
 * leave_requests table. Saving an attachment failed with a foreign key error
 * whenever no legacy row happened to have the same id.
 *
 * 1. Attachments whose leave_id is not a leave_request id (e.g. of withdrawn
 *    leaves) can never be shown by the app and would block the new key. They
 *    are copied to leave_attachments_orphans_backup, then removed.
 * 2. The foreign key to leave_requests is dropped.
 * 3. A foreign key to leave_request(lr_id) is added with ON DELETE CASCADE, so
 *    withdrawing a leave (which deletes its leave_request row) also removes
 *    its attachment rows instead of failing.
 *
 * Safe to run more than once.
 */

const NEW_FK = 'fk_leave_attachments_leave_request';
const ORPHAN_BACKUP = 'leave_attachments_orphans_backup';
const ORPHANS = 'FROM leave_attachments a LEFT JOIN leave_request r ON r.lr_id = a.leave_id WHERE r.lr_id IS NULL';

async function foreignKeys(knex, referencedTable) {
    const [rows] = await knex.raw(
        `SELECT constraint_name AS name FROM information_schema.referential_constraints
         WHERE constraint_schema = DATABASE() AND table_name = 'leave_attachments' AND referenced_table_name = ?`,
        [referencedTable]
    );
    return rows.map((r) => r.name);
}

export async function up(knex) {
    const [[{ n: orphanCount }]] = await knex.raw(`SELECT COUNT(*) AS n ${ORPHANS}`);
    if (Number(orphanCount) > 0) {
        await knex.raw(`CREATE TABLE IF NOT EXISTS ?? AS SELECT a.* FROM leave_attachments a WHERE 1 = 0`, [ORPHAN_BACKUP]);
        await knex.raw(`INSERT INTO ?? SELECT a.* ${ORPHANS}`, [ORPHAN_BACKUP]);
        await knex.raw(`DELETE a ${ORPHANS}`);
        console.log(`[migration] moved ${orphanCount} unreachable leave_attachments rows to ${ORPHAN_BACKUP}`);
    }

    for (const name of await foreignKeys(knex, 'leave_requests')) {
        await knex.raw('ALTER TABLE leave_attachments DROP FOREIGN KEY ??', [name]);
    }

    if ((await foreignKeys(knex, 'leave_request')).length === 0) {
        await knex.raw(
            `ALTER TABLE leave_attachments ADD CONSTRAINT ?? FOREIGN KEY (leave_id) REFERENCES leave_request (lr_id) ON DELETE CASCADE`,
            [NEW_FK]
        );
    }
}

export async function down(knex) {
    for (const name of await foreignKeys(knex, 'leave_request')) {
        await knex.raw('ALTER TABLE leave_attachments DROP FOREIGN KEY ??', [name]);
    }
    // Restoring the old key fails if attachments reference ids that do not
    // exist in leave_requests, which is exactly the original problem.
    if ((await foreignKeys(knex, 'leave_requests')).length === 0) {
        await knex.raw(
            'ALTER TABLE leave_attachments ADD CONSTRAINT fk_leave_attachments_leave_requests FOREIGN KEY (leave_id) REFERENCES leave_requests (lr_id)'
        );
    }
}
