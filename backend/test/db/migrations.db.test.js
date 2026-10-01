/**
 * Migrations keep running after a commit containing an already applied
 * migration is reverted (its file is gone, its row in knex_migrations stays).
 * Otherwise every later `npm run migrate`, and with it every deploy, fails.
 */
import './support/testDb.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const { attendanceDB: db } = await import('../../src/config/database.js');
const { runShutdownHooks } = await import('../../src/lifecycle/shutdown.js');
const { migrationConfig } = await import('../../src/config/migrations.js');

const REVERTED = '20000101000000_reverted_example.mjs';

after(async () => {
    await db('knex_migrations').where({ name: REVERTED }).del();
    await runShutdownHooks();
});

test('an applied migration whose file was removed does not block migrate latest', async () => {
    await db.migrate.latest(migrationConfig);
    await db('knex_migrations').insert({ name: REVERTED, batch: 99, migration_time: new Date() });

    const [, applied] = await db.migrate.latest(migrationConfig);
    assert.deepEqual(applied, [], 'nothing pending, and no "migration directory is corrupt" error');
});
