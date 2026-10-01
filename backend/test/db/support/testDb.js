/**
 * Points the app at a throwaway test database. Must be imported BEFORE any
 * app module: it sets the DB env vars, and config.js (dotenv) never
 * overrides variables that are already set.
 *
 * Start a test database, for example:
 *   docker run -d --name mano-authz-mysql -e MYSQL_ROOT_PASSWORD=authz_test_pw \
 *     -e MYSQL_DATABASE=mano_authz_test -p 127.0.0.1:3310:3306 mysql:8.4
 *   docker exec -i mano-authz-mysql mysql -uroot -pauthz_test_pw mano_authz_test < test/db/schema.sql
 *
 * test/db/schema.sql is the production table structure without any data;
 * GitHub CI creates its test database the same way (backend-ci.yml).
 *
 * Override with TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD / TEST_DB_NAME.
 */
export const TEST_DB = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: process.env.TEST_DB_PORT || '3310',
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || 'authz_test_pw',
    database: process.env.TEST_DB_NAME || 'mano_authz_test',
};

// These tests create and delete data. Refuse anything that could be a real database.
if (!['127.0.0.1', 'localhost'].includes(TEST_DB.host)) {
    throw new Error(`Refusing to run DB tests against non-local host ${TEST_DB.host}`);
}
if (TEST_DB.port === '3307' || TEST_DB.port === '3306') {
    throw new Error(`Refusing to run DB tests on port ${TEST_DB.port} (used by real databases / tunnels)`);
}
if (!/test/i.test(TEST_DB.database)) {
    throw new Error(`Refusing to run DB tests against database "${TEST_DB.database}" (name must contain "test")`);
}

process.env.NODE_ENV = 'test';
process.env.DB_HOST = TEST_DB.host;
process.env.DB_PORT = TEST_DB.port;
for (const prefix of ['ATTENDANCE_DB', 'PAYMENT_DB']) {
    process.env[`${prefix}_USER`] = TEST_DB.user;
    process.env[`${prefix}_PASSWORD`] = TEST_DB.password;
    process.env[`${prefix}_NAME`] = TEST_DB.database;
}
