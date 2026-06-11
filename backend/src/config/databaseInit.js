import { adminDB, attendanceDB } from './database.js';
import { encryptText, decryptText } from '../utils/encryption.js';

export const runLegacyChatMigration = async (db) => {
    try {
        const legacyRooms = await db('chat_rooms');
        console.log(`[Migration] Found ${legacyRooms.length} legacy rooms to migrate.`);

        for (const room of legacyRooms) {
            let memberIds = [];
            try {
                memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
            } catch (e) {
                memberIds = [];
            }
            if (!Array.isArray(memberIds)) memberIds = [];

            let lastReadTimes = {};
            try {
                lastReadTimes = typeof room.last_read_times === 'string' ? JSON.parse(room.last_read_times || '{}') : (room.last_read_times || {});
            } catch (e) {
                lastReadTimes = {};
            }

            let removedMembers = {};
            try {
                removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members || '{}') : (room.removed_members || {});
                if (Array.isArray(removedMembers)) {
                    const temp = {};
                    removedMembers.forEach(rm => {
                        temp[rm.user_id] = { removed_at: rm.removed_at };
                    });
                    removedMembers = temp;
                }
            } catch (e) {
                removedMembers = {};
            }

            // Decrypt room name
            let decryptedName = null;
            if (room.room_name) {
                decryptedName = decryptText(room.room_name);
            }

            // Insert into conversations table preserving room_id
            await db('conversations').insert({
                id: room.room_id,
                org_id: room.org_id,
                type: room.room_type === 'group' ? 'group' : 'dm',
                name: decryptedName,
                created_by: room.created_by,
                created_at: room.created_at,
                updated_at: room.updated_at
            });

            // Decrypt and process messages
            let msgs = [];
            try {
                const decryptedMsgsStr = decryptText(room.messages);
                msgs = typeof decryptedMsgsStr === 'string' ? JSON.parse(decryptedMsgsStr || '[]') : (decryptedMsgsStr || []);
            } catch (e) {
                msgs = [];
            }

            let lastMessageId = null;

            if (Array.isArray(msgs)) {
                for (const msg of msgs) {
                    let msgType = 'text';
                    let metadata = null;
                    let msgText = msg.message_text;

                    // Parse system cards if matching format
                    if (msgText && msgText.startsWith('[SYSTEM_CARD:')) {
                        const closeBracketIdx = msgText.indexOf(']');
                        if (closeBracketIdx !== -1) {
                            const header = msgText.substring(13, closeBracketIdx);
                            const parts = header.split(':');
                            const cardType = parts[0] || 'system';
                            const entityId = parts[1] || '';
                            const status = parts[2] || '';
                            
                            const body = msgText.substring(closeBracketIdx + 1).trim();
                            let payload = {};
                            try {
                                payload = JSON.parse(body);
                            } catch (e) {}

                            msgType = 'workflow_card';
                            metadata = {
                                card_type: cardType,
                                entity_id: entityId,
                                status: status,
                                ...payload
                            };
                        } else {
                            msgType = 'system';
                        }
                    } else if (room.room_type === 'group' && msg.sender_id === 0) {
                        msgType = 'system';
                    }

                    // Insert message preserving message_id
                    await db('messages').insert({
                        id: msg.message_id || undefined,
                        org_id: room.org_id,
                        conversation_id: room.room_id,
                        sender_id: msg.sender_id || 0,
                        type: msgType,
                        content: encryptText(msgText),
                        metadata_json: metadata ? JSON.stringify(metadata) : null,
                        created_at: msg.created_at || new Date().toISOString(),
                        updated_at: msg.created_at || new Date().toISOString()
                    });

                    const msgIdToUse = msg.message_id;
                    if (msgIdToUse) {
                        lastMessageId = msgIdToUse;
                    }

                    // Handle attachments
                    if (msg.attachment) {
                        await db('message_attachments').insert({
                            org_id: room.org_id,
                            message_id: msgIdToUse,
                            type: msg.attachment.type || 'file',
                            file_name: msg.attachment.name || 'Attachment',
                            mime_type: msg.attachment.type || null,
                            size_bytes: msg.attachment.size || null,
                            storage_provider: 's3',
                            storage_key: msg.attachment.key || '',
                            public_url: msg.attachment.url || null,
                            created_at: msg.created_at || new Date().toISOString()
                        });
                    }
                }
            }

            // Insert conversation members
            const allMembers = new Set([...memberIds, ...Object.keys(removedMembers).map(Number)]);
            for (const memberId of allMembers) {
                const isRemoved = Object.keys(removedMembers).map(Number).includes(memberId);
                
                let role = 'member';
                if (Number(room.created_by) === Number(memberId)) {
                    role = 'owner';
                }

                // Retrieve last read message ID checkpoint
                let lastReadMsgId = null;
                const userReadTime = lastReadTimes[memberId];
                if (userReadTime && Array.isArray(msgs)) {
                    const readCutoff = new Date(userReadTime);
                    const readMsgs = msgs.filter(m => new Date(m.created_at) <= readCutoff);
                    if (readMsgs.length > 0) {
                        lastReadMsgId = readMsgs[readMsgs.length - 1].message_id;
                    }
                }

                await db('conversation_members').insert({
                    org_id: room.org_id,
                    conversation_id: room.room_id,
                    user_id: memberId,
                    role: role,
                    joined_at: room.created_at,
                    last_read_message_id: lastReadMsgId || null,
                    is_archived: isRemoved,
                    created_at: room.created_at,
                    updated_at: room.updated_at
                });
            }

            // Update conversation last_message_id
            if (lastMessageId) {
                await db('conversations')
                    .where({ id: room.room_id })
                    .update({ last_message_id: lastMessageId });
            }
        }
        console.log('✅ Legacy chat data migration completed successfully.');
    } catch (migrateErr) {
        console.error('❌ Error during legacy chat data migration:', migrateErr);
    }
};

export const initDatabase = async () => {
    try {
        const db = adminDB || attendanceDB;
        if (!db) {
            console.error('No database connection found for initialization.');
            return;
        }

        // 1. Drop old tables if cleanup requested
        try {
            await db.schema.dropTableIfExists('chat_room_members');
            await db.schema.dropTableIfExists('chat_messages');
        } catch (dropErr) {
            // Ignore silently if permission lacks
        }

        // 2. Initialize new relational tables (Expand Phase)
        const hasConversations = await db.schema.hasTable('conversations');
        if (!hasConversations) {
            await db.schema.createTable('conversations', (table) => {
                table.increments('id').primary();
                table.enum('type', ['dm', 'group', 'department', 'announcement']).notNullable();
                table.string('name', 255).nullable();
                table.text('description').nullable();
                table.string('avatar_url', 500).nullable();
                table.integer('created_by').unsigned().nullable();
                table.integer('org_id').unsigned().notNullable();
                table.integer('department_id').unsigned().nullable();
                table.bigInteger('last_message_id').unsigned().nullable();
                table.boolean('is_private').defaultTo(false);
                table.boolean('is_archived').defaultTo(false);
                table.timestamps(true, true);

                table.index(['org_id']);
                table.index(['type']);
            });
            console.log('✅ Table "conversations" initialized.');
        }

        const hasConvMembers = await db.schema.hasTable('conversation_members');
        if (!hasConvMembers) {
            await db.schema.createTable('conversation_members', (table) => {
                table.increments('id').primary();
                table.integer('conversation_id').unsigned().notNullable();
                table.integer('user_id').unsigned().notNullable();
                table.integer('org_id').unsigned().notNullable();
                table.enum('role', ['owner', 'admin', 'member']).defaultTo('member');
                table.timestamp('joined_at').defaultTo(db.fn.now());
                table.bigInteger('last_read_message_id').unsigned().nullable();
                table.boolean('is_muted').defaultTo(false);
                table.boolean('is_pinned').defaultTo(false);
                table.boolean('is_archived').defaultTo(false);
                table.enum('notification_level', ['all', 'mentions', 'none']).defaultTo('all');
                table.timestamps(true, true);

                table.unique(['conversation_id', 'user_id']);
                table.index(['org_id']);
                table.index(['user_id']);
            });
            console.log('✅ Table "conversation_members" initialized.');
        }

        const hasMessages = await db.schema.hasTable('messages');
        if (!hasMessages) {
            await db.schema.createTable('messages', (table) => {
                table.bigIncrements('id').primary();
                table.integer('conversation_id').unsigned().notNullable();
                table.integer('sender_id').unsigned().notNullable();
                table.integer('org_id').unsigned().notNullable();
                table.string('type', 50).defaultTo('text');
                table.text('content').nullable();
                table.json('metadata_json').nullable();
                table.bigInteger('reply_to_message_id').unsigned().nullable();
                table.boolean('is_edited').defaultTo(false);
                table.timestamp('edited_at').nullable();
                table.boolean('is_deleted').defaultTo(false);
                table.timestamp('deleted_at').nullable();
                table.timestamps(true, true);

                table.index(['org_id']);
                table.index(['conversation_id', 'id']);
                table.index(['sender_id']);
            });
            console.log('✅ Table "messages" initialized.');
        }

        const hasMsgAttachments = await db.schema.hasTable('message_attachments');
        if (!hasMsgAttachments) {
            await db.schema.createTable('message_attachments', (table) => {
                table.increments('id').primary();
                table.bigInteger('message_id').unsigned().notNullable();
                table.integer('org_id').unsigned().notNullable();
                table.string('type', 50).nullable();
                table.string('file_name', 255).notNullable();
                table.string('mime_type', 100).nullable();
                table.bigInteger('size_bytes').unsigned().nullable();
                table.string('storage_provider', 50).defaultTo('s3');
                table.string('storage_key', 500).notNullable();
                table.text('public_url').nullable();
                table.text('thumbnail_url').nullable();
                table.integer('width').nullable();
                table.integer('height').nullable();
                table.integer('duration_seconds').nullable();
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.index(['org_id']);
                table.index(['message_id']);
            });
            console.log('✅ Table "message_attachments" initialized.');
        }

        const hasMsgMentions = await db.schema.hasTable('message_mentions');
        if (!hasMsgMentions) {
            await db.schema.createTable('message_mentions', (table) => {
                table.increments('id').primary();
                table.bigInteger('message_id').unsigned().notNullable();
                table.integer('mentioned_user_id').unsigned().notNullable();
                table.integer('org_id').unsigned().notNullable();
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.unique(['message_id', 'mentioned_user_id']);
                table.index(['org_id']);
                table.index(['mentioned_user_id']);
            });
            console.log('✅ Table "message_mentions" initialized.');
        }

        const hasMsgReactions = await db.schema.hasTable('message_reactions');
        if (!hasMsgReactions) {
            await db.schema.createTable('message_reactions', (table) => {
                table.increments('id').primary();
                table.bigInteger('message_id').unsigned().notNullable();
                table.integer('user_id').unsigned().notNullable();
                table.integer('org_id').unsigned().notNullable();
                table.string('emoji', 50).notNullable();
                table.timestamp('created_at').defaultTo(db.fn.now());

                table.unique(['message_id', 'user_id', 'emoji']);
                table.index(['org_id']);
            });
            console.log('✅ Table "message_reactions" initialized.');
        }

        // 3. Initialize generated_reports
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

        // 4. Initialize user_fcm_tokens
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

        // 5. Update attendance_records schema if missing columns
        const hasAttendanceRecords = await db.schema.hasTable('attendance_records');
        if (hasAttendanceRecords) {
            const hasStatus = await db.schema.hasColumn('attendance_records', 'status');
            const hasLateMinutes = await db.schema.hasColumn('attendance_records', 'late_minutes');
            const hasLateReason = await db.schema.hasColumn('attendance_records', 'late_reason');
            const hasOvertimeHours = await db.schema.hasColumn('attendance_records', 'overtime_hours');

            if (!hasStatus || !hasLateMinutes || !hasLateReason || !hasOvertimeHours) {
                console.log('Updating "attendance_records" schema with missing columns...');
                await db.schema.table('attendance_records', (table) => {
                    if (!hasStatus) {
                        table.string('status', 50).defaultTo('PRESENT');
                    }
                    if (!hasLateMinutes) {
                        table.integer('late_minutes').defaultTo(0);
                    }
                    if (!hasLateReason) {
                        table.string('late_reason', 255).nullable();
                    }
                    if (!hasOvertimeHours) {
                        table.decimal('overtime_hours', 5, 2).defaultTo(0.00);
                    }
                });
                console.log('✅ Added missing columns to "attendance_records" successfully.');
            }
        }

        // 6. Run Legacy Data Migration if conversations is empty and old chat_rooms exists
        const conversationsCount = await db('conversations').count('id as cnt').first();
        const legacyRoomsTableExists = await db.schema.hasTable('chat_rooms');
        if (legacyRoomsTableExists && conversationsCount?.cnt === 0) {
            const legacyRoomsCount = await db('chat_rooms').count('room_id as cnt').first();
            if (legacyRoomsCount?.cnt > 0) {
                console.log(`🚀 Starting legacy chat migration for ${legacyRoomsCount.cnt} rooms...`);
                await runLegacyChatMigration(db);
            }
        }

    } catch (error) {
        console.error('Error during database table initialization:', error);
    }
};

