import { adminDB, attendanceDB } from './database.js';

export const initDatabase = async () => {
    try {
        const db = adminDB || attendanceDB;
        if (!db) {
            console.error('No database connection found for initialization.');
            return;
        }

        // 1. Initialize chat_rooms
        try {
            await db.schema.dropTableIfExists('chat_room_members');
            await db.schema.dropTableIfExists('chat_messages');
        } catch (dropErr) {
            // Ignore silently if permission lacks
        }

        const hasRooms = await db.schema.hasTable('chat_rooms');
        if (hasRooms) {
            const hasMessagesCol = await db.schema.hasColumn('chat_rooms', 'messages');
            if (!hasMessagesCol) {
                try {
                    await db.schema.dropTable('chat_rooms');
                    console.log('Old chat_rooms table dropped for single-row optimization.');
                } catch (dropErr) {
                    console.warn('⚠️ Unable to drop legacy chat_rooms table.');
                }
            }
        }

        const hasRoomsUpdated = await db.schema.hasTable('chat_rooms');
        if (!hasRoomsUpdated) {
            await db.schema.createTable('chat_rooms', (table) => {
                table.increments('room_id').primary();
                table.integer('org_id').unsigned().notNullable();
                table.string('room_name', 255).nullable();
                table.enum('room_type', ['direct', 'group']).defaultTo('direct');
                table.integer('created_by').unsigned().nullable();
                table.text('member_ids').notNullable();
                table.text('messages', 'longtext').notNullable();
                table.text('last_read_times').notNullable();
                table.text('removed_members').nullable();
                table.timestamps(true, true);

                table.index(['org_id']);
            });
            console.log('✅ Table "chat_rooms" initialized.');
        } else {
            const hasRemovedMembers = await db.schema.hasColumn('chat_rooms', 'removed_members');
            if (!hasRemovedMembers) {
                await db.schema.table('chat_rooms', (table) => {
                    table.text('removed_members').nullable();
                });
                console.log('Column "removed_members" added to "chat_rooms" successfully.');
            }
        }

        // 2. Initialize generated_reports
        const hasReports = await db.schema.hasTable('generated_reports');
        if (!hasReports) {
            console.log('Creating "generated_reports" table...');
            await db.schema.createTable('generated_reports', (table) => {
                table.string('report_id', 255).primary();
                table.integer('user_id').notNullable();
                table.integer('org_id').notNullable();
                table.string('report_type', 100).notNullable();
                table.string('format', 10).notNullable();
                table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
                table.text('file_url').nullable();
                table.string('error_message', 255).nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());
            });
            console.log('✅ "generated_reports" table initialized.');
        }

        // 3. Initialize user_fcm_tokens
        const hasFcm = await db.schema.hasTable('user_fcm_tokens');
        if (!hasFcm) {
            console.log('Creating "user_fcm_tokens" table...');
            await db.schema.createTable('user_fcm_tokens', (table) => {
                table.increments('id').primary();
                table.integer('user_id').notNullable();
                table.string('token', 500).notNullable().unique();
                table.string('device_type', 50).nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());
                table.timestamp('updated_at').defaultTo(db.fn.now());

                table.index(['user_id']);
            });
            console.log('✅ "user_fcm_tokens" table initialized.');
        }

    } catch (error) {
        console.error('Error during database table initialization:', error);
    }
};
