/**
 * Database migrations (knex). Migration files live in backend/migrations/.
 *
 *   npm run migrate:status     list applied and pending migrations
 *   npm run migrate            apply pending migrations
 *   npm run migrate:rollback   undo the last batch
 *
 * Schema changes need ALTER privileges, which the app's DB user may not have.
 * Credentials: MIGRATION_DB_USER / MIGRATION_DB_PASSWORD if set, otherwise
 * DB_ADMIN_USER / DB_ADMIN_PASSWORD, otherwise the app user. The database is
 * ATTENDANCE_DB_NAME on DB_HOST:DB_PORT.
 */
import knex from 'knex';
import '../../src/config/config.js';
import { migrationConfig } from '../../src/config/migrations.js';

const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.MIGRATION_DB_USER || process.env.DB_ADMIN_USER || process.env.ATTENDANCE_DB_USER,
        password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_ADMIN_PASSWORD || process.env.ATTENDANCE_DB_PASSWORD,
        database: process.env.ATTENDANCE_DB_NAME,
        timezone: 'Z',
    },
});

const command = process.argv[2] || 'status';
try {
    const target = `${db.client.config.connection.database} on ${db.client.config.connection.host}:${db.client.config.connection.port} as ${db.client.config.connection.user}`;
    if (command === 'latest') {
        const [batch, applied] = await db.migrate.latest(migrationConfig);
        console.log(applied.length ? `Applied batch ${batch} to ${target}:\n  ${applied.join('\n  ')}` : `Already up to date (${target}).`);
    } else if (command === 'rollback') {
        const [batch, reverted] = await db.migrate.rollback(migrationConfig);
        console.log(reverted.length ? `Rolled back batch ${batch} on ${target}:\n  ${reverted.join('\n  ')}` : 'Nothing to roll back.');
    } else if (command === 'status') {
        const [completed, pending] = await db.migrate.list(migrationConfig);
        console.log(`Migrations for ${target}`);
        console.log(`  applied: ${completed.map((m) => m.name ?? m).join(', ') || '(none)'}`);
        console.log(`  pending: ${pending.map((m) => m.file ?? m).join(', ') || '(none)'}`);
    } else {
        throw new Error(`Unknown command "${command}" (use status | latest | rollback)`);
    }
    await db.destroy();
    process.exit(0);
} catch (err) {
    console.error('Migration failed:', err.message);
    await db.destroy();
    process.exit(1);
}
