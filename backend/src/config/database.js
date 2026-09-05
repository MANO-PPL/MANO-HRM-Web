import knex from 'knex';
import './config.js';

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

//admin access only for local dev environment
export let adminDB = null;

if (process.env.NODE_ENV === 'development') {
  adminDB = knex({
    client: 'mysql2',
    connection: {
      host: DB_HOST,
      port: DB_PORT,
      user: process.env.DB_ADMIN_USER,
      password: process.env.DB_ADMIN_PASSWORD,
      database: process.env.DB_ADMIN_NAME,
      timezone: 'Z',
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    },
    pool: poolConfig,
  });
}

export const attendanceDB = knex({
  client: 'mysql2',
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.ATTENDANCE_DB_USER,
    password: process.env.ATTENDANCE_DB_PASSWORD,
    database: process.env.ATTENDANCE_DB_NAME,
    timezone: 'Z',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  },
  pool: poolConfig,
});

export const paymentDB = knex({
  client: 'mysql2',
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.PAYMENT_DB_USER,
    password: process.env.PAYMENT_DB_PASSWORD,
    database: process.env.PAYMENT_DB_NAME,
    timezone: 'Z',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  },
  pool: { ...poolConfig, max: 5 },
});