import knex from 'knex';
import './config.js';
import { onShutdown } from '../lifecycle/shutdown.js';

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT) || 3306;

const poolConfig = {
  min: 0,
  max: 10,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  afterCreate: (conn, done) => {
    conn.on('error', (err) => {
      // Suppress unhandled socket resets on dropped idle connections
      if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        return;
      }
    });
    done(null, conn);
  },
};

// One connection factory for every database the app uses
function makeKnex({ user, password, database, pool = poolConfig }) {
  return knex({
    client: 'mysql2',
    connection: {
      host: DB_HOST,
      port: DB_PORT,
      user,
      password,
      database,
      timezone: 'Z',
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    },
    pool,
  });
}

//admin access only for local dev environment
export const adminDB = process.env.NODE_ENV === 'development'
  ? makeKnex({
    user: process.env.DB_ADMIN_USER,
    password: process.env.DB_ADMIN_PASSWORD,
    database: process.env.DB_ADMIN_NAME,
  })
  : null;

export const attendanceDB = makeKnex({
  user: process.env.ATTENDANCE_DB_USER,
  password: process.env.ATTENDANCE_DB_PASSWORD,
  database: process.env.ATTENDANCE_DB_NAME,
});

export const paymentDB = makeKnex({
  user: process.env.PAYMENT_DB_USER,
  password: process.env.PAYMENT_DB_PASSWORD,
  database: process.env.PAYMENT_DB_NAME,
  pool: { ...poolConfig, max: 5 },
});

// Close all connection pools on shutdown (after in-flight work has finished)
onShutdown('database pools', async () => {
  const results = await Promise.allSettled(
    [attendanceDB, paymentDB, adminDB].filter(Boolean).map((db) => db.destroy())
  );
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
}, 'infra');
