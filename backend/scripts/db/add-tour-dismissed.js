import 'dotenv/config';
import knex from 'knex';
import '../../src/config/config.js'; // to load env vars

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT) || 3306;

const db = knex({
  client: 'mysql2',
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.DB_ADMIN_USER,
    password: process.env.DB_ADMIN_PASSWORD,
    database: process.env.ATTENDANCE_DB_NAME, // Need to alter the attendance DB
    timezone: 'Z',
  },
});

async function main() {
  console.log('Checking for tour_dismissed column in users table using admin credentials...');
  try {
    const hasColumn = await db.schema.hasColumn('core_users', 'tour_dismissed');
    
    if (!hasColumn) {
      console.log('Adding tour_dismissed column to users table...');
      await db.schema.alterTable('core_users', (table) => {
        table.boolean('tour_dismissed').defaultTo(false).notNullable();
      });
      console.log('Successfully added tour_dismissed column.');
    } else {
      console.log('tour_dismissed column already exists. Skipping.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

main();
