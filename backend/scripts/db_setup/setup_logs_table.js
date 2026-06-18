import knex from 'knex';
import '../../src/config/config.js';

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT) || 3306;

// Create admin DB connection to run DDL schema commands
const adminDB = knex({
    client: 'mysql2',
    connection: {
        host: DB_HOST,
        port: DB_PORT,
        user: process.env.DB_ADMIN_USER,
        password: process.env.DB_ADMIN_PASSWORD,
        database: process.env.DB_ADMIN_NAME,
        timezone: 'Z',
    },
});

async function run() {
    try {
        console.log('🔄 Connecting to database as ADMIN and checking schema...');

        // 1. Check if api_request_logs exists
        const tableExists = await adminDB.schema.hasTable('api_request_logs');
        if (!tableExists) {
            console.log('🚧 Creating api_request_logs table...');
            await adminDB.schema.createTable('api_request_logs', (table) => {
                table.bigIncrements('id').primary();
                table.timestamp('occurred_at').notNullable().defaultTo(adminDB.fn.now());
                table.integer('user_id').unsigned().nullable();
                table.integer('org_id').unsigned().nullable();
                table.string('request_path', 255).notNullable();
                table.string('route_pattern', 255).nullable();
                table.string('method', 10).notNullable();
                table.smallint('status_code').notNullable();
                table.integer('duration_ms').notNullable();
                table.boolean('is_success').notNullable();
                table.string('event_source', 50).nullable(); // e.g. 'WEB', 'MOBILE_APP', 'API'
                table.string('module_name', 100).nullable();
                table.string('client_os', 50).nullable();     // e.g. 'Android', 'iOS', 'Windows', 'macOS'
                table.string('client_type', 50).nullable();   // e.g. 'Android App', 'iOS App', 'Web Browser'
                table.string('device_type', 50).nullable();   // e.g. 'Mobile', 'Tablet', 'Desktop'
                table.string('request_ip', 45).nullable();
                table.string('user_agent', 255).nullable();
                table.json('payload_details').nullable();

                // Add Indexes for fast aggregates
                table.index('occurred_at', 'idx_api_request_logs_occurred_at');
                table.index('org_id', 'idx_api_request_logs_org_id');
                table.index('user_id', 'idx_api_request_logs_user_id');
                table.index('status_code', 'idx_api_request_logs_status_code');
                table.index('duration_ms', 'idx_api_request_logs_duration_ms');
                table.index('route_pattern', 'idx_api_request_logs_route_pattern');
                table.index('module_name', 'idx_api_request_logs_module_name');
                table.index('client_type', 'idx_api_request_logs_client_type');
                table.index('device_type', 'idx_api_request_logs_device_type');
            });
            console.log('✅ Table api_request_logs created successfully.');

            // 2. Migrate existing API_CALL records from user_activity_logs to api_request_logs
            console.log('🚚 Migrating historical API logs from user_activity_logs to api_request_logs...');
            const countToMigrateRes = await adminDB('user_activity_logs')
                .where({ event_type: 'API_CALL' })
                .count('* as count')
                .first();

            const countToMigrate = Number(countToMigrateRes?.count) || 0;

            if (countToMigrate > 0) {
                console.log(`🚚 Found ${countToMigrate} rows to migrate...`);

                // Helper to parse User Agent inline for basic migration matching
                // We will use standard SQL string matching for speed in raw insertion
                await adminDB.raw(`
                    INSERT INTO api_request_logs (
                        occurred_at, user_id, org_id, request_path, route_pattern, method, 
                        status_code, duration_ms, is_success, event_source, module_name, 
                        client_os, client_type, device_type, request_ip, user_agent, payload_details
                    )
                    SELECT 
                        occurred_at, 
                        user_id, 
                        org_id, 
                        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.path')), '/'),
                        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.path')), '/'),
                        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.method')), 'GET'),
                        COALESCE(CAST(JSON_EXTRACT(metadata, '$.status_code') AS UNSIGNED), 200),
                        COALESCE(CAST(JSON_EXTRACT(metadata, '$.duration_ms') AS UNSIGNED), 0),
                        COALESCE(CAST(JSON_EXTRACT(metadata, '$.is_success') AS UNSIGNED), 1),
                        COALESCE(event_source, 'API'),
                        COALESCE(object_type, 'General'),
                        CASE 
                            WHEN LOWER(user_agent) LIKE '%android%' THEN 'Android'
                            WHEN LOWER(user_agent) LIKE '%iphone%' OR LOWER(user_agent) LIKE '%ipad%' THEN 'iOS'
                            WHEN LOWER(user_agent) LIKE '%windows%' THEN 'Windows'
                            WHEN LOWER(user_agent) LIKE '%macintosh%' OR LOWER(user_agent) LIKE '%mac os x%' THEN 'macOS'
                            WHEN LOWER(user_agent) LIKE '%linux%' THEN 'Linux'
                            ELSE 'Unknown OS'
                        END,
                        CASE 
                            WHEN LOWER(user_agent) LIKE '%postman%' OR LOWER(user_agent) LIKE '%curl%' OR LOWER(user_agent) LIKE '%axios%' THEN 'API Client'
                            WHEN LOWER(user_agent) LIKE '%dart%' OR LOWER(user_agent) LIKE '%flutter%' THEN 
                                CASE 
                                    WHEN LOWER(user_agent) LIKE '%android%' THEN 'Android App'
                                    ELSE 'iOS App'
                                END
                            WHEN LOWER(user_agent) LIKE '%edg/%' THEN 'Web Browser (Edge)'
                            WHEN LOWER(user_agent) LIKE '%chrome/%' THEN 'Web Browser (Chrome)'
                            WHEN LOWER(user_agent) LIKE '%firefox/%' THEN 'Web Browser (Firefox)'
                            WHEN LOWER(user_agent) LIKE '%safari/%' THEN 'Web Browser (Safari)'
                            ELSE 'Web Browser'
                        END,
                        CASE 
                            WHEN LOWER(user_agent) LIKE '%ipad%' THEN 'Tablet'
                            WHEN LOWER(user_agent) LIKE '%android%' OR LOWER(user_agent) LIKE '%iphone%' OR LOWER(user_agent) LIKE '%dart%' OR LOWER(user_agent) LIKE '%flutter%' THEN 'Mobile'
                            ELSE 'Desktop'
                        END,
                        COALESCE(request_ip, '127.0.0.1'),
                        COALESCE(SUBSTRING(user_agent, 1, 255), ''),
                        metadata
                    FROM user_activity_logs
                    WHERE event_type = 'API_CALL'
                `);

                console.log('Purging migrated API_CALL records from user_activity_logs...');
                await adminDB('user_activity_logs').where({ event_type: 'API_CALL' }).del();
                console.log('✅ Purged successfully. user_activity_logs is now clean of raw API logs.');
            } else {
                console.log('ℹ️ No historical API logs to migrate.');
            }
        } else {
            console.log('✅ api_request_logs table already exists.');
        }

        console.log('🎉 Database refactoring complete!');
        await adminDB.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during setup:', error);
        if (adminDB) await adminDB.destroy();
        process.exit(1);
    }
}

run();
