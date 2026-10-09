import crypto from 'crypto';
import { unpackUserAgent, parseUserAgent, getDeterministicDeviceId } from '../../../src/utils/deviceParser.js';
import { toMySQLDateTime } from '../../../src/utils/dateUtils.js';

/**
 * Migration: Create consolidated `sessions` table with individual device columns
 * and migrate existing data from `core_refresh_tokens`.
 */
export async function up(knex) {
    const hasSessionsTable = await knex.schema.hasTable('sessions');
    if (!hasSessionsTable) {
        await knex.schema.createTable('sessions', (table) => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable();
            table.string('token_hash', 64).notNullable();
            table.string('device_id', 128).notNullable().defaultTo('');
            table.string('device_name', 255).nullable();
            table.string('device_type', 50).notNullable().defaultTo('desktop');
            table.string('os', 100).nullable();
            table.string('browser', 100).nullable();
            table.string('ip_address', 45).nullable();
            table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
            table.dateTime('last_used_at').nullable().defaultTo(knex.fn.now());
            table.dateTime('expires_at').notNullable();
            table.boolean('revoked').notNullable().defaultTo(false);
            table.dateTime('revoked_at').nullable();
            table.string('revoked_reason', 255).nullable();
            table.boolean('remember_me').notNullable().defaultTo(false);
            table.text('user_agent').nullable();

            // Foreign keys & Indexes
            table.foreign('user_id', 'fk_sessions_users').references('core_users.user_id').onDelete('CASCADE');
            table.index('token_hash', 'idx_sessions_token_hash');
            table.index('user_id', 'idx_sessions_user_id');
            table.index(['user_id', 'device_id'], 'idx_sessions_user_device');
            table.index(['revoked', 'expires_at'], 'idx_sessions_status');
        });
        console.log('[migration] Created `sessions` table successfully.');
    }

    // Migrate data from core_refresh_tokens if it exists
    const hasLegacyTable = await knex.schema.hasTable('core_refresh_tokens');
    if (hasLegacyTable) {
        const now = new Date();
        const activeRows = await knex('core_refresh_tokens')
            .where((qb) => {
                qb.where('revoked', false).orWhereNull('revoked').orWhere('revoked', 0);
            })
            .andWhere('expires_at', '>', now)
            .orderBy('id', 'desc');

        // Pick only the latest active token per user
        const userLatestMap = new Map();
        for (const row of (activeRows || [])) {
            if (!userLatestMap.has(row.user_id)) {
                userLatestMap.set(row.user_id, row);
            }
        }
        const legacyRows = Array.from(userLatestMap.values());

        if (legacyRows && legacyRows.length > 0) {
            console.log(`[migration] Found ${legacyRows.length} latest active user session(s) to migrate...`);
            const sessionRows = [];

            for (const row of legacyRows) {
                // Ensure SHA-256 hash for token_hash
                const rawToken = String(row.token || '');
                const tokenHash = rawToken.length === 64 && /^[0-9a-f]{64}$/i.test(rawToken)
                    ? rawToken
                    : crypto.createHash('sha256').update(rawToken).digest('hex');

                // Unpack user agent metadata
                const { rawUa, metadata } = unpackUserAgent(row.user_agent || '');
                const parsed = parseUserAgent(row.user_agent || '');

                const deviceId = metadata?.device_id || parsed.device_id || getDeterministicDeviceId(row.user_id, rawUa);
                const deviceName = metadata?.device_name || parsed.device_name || parsed.device_label || 'Unknown Device';
                const deviceType = metadata?.device_type || parsed.device_type || 'desktop';
                const os = parsed.os || 'Unknown OS';
                const browser = parsed.browser || 'Unknown Browser';
                const ipAddress = metadata?.client_ip || row.ip_address || null;
                const createdAt = row.created_at || new Date();
                const lastUsedAt = metadata?.last_active_at ? new Date(metadata.last_active_at) : createdAt;

                sessionRows.push({
                    id: row.id,
                    user_id: row.user_id,
                    token_hash: tokenHash,
                    device_id: deviceId.substring(0, 128),
                    device_name: deviceName.substring(0, 255),
                    device_type: deviceType.substring(0, 50),
                    os: os.substring(0, 100),
                    browser: browser.substring(0, 100),
                    ip_address: ipAddress ? ipAddress.substring(0, 45) : null,
                    created_at: toMySQLDateTime(createdAt),
                    last_used_at: toMySQLDateTime(lastUsedAt),
                    expires_at: toMySQLDateTime(row.expires_at || new Date(Date.now() + 30 * 864e5)),
                    revoked: 0,
                    revoked_at: null,
                    revoked_reason: null,
                    remember_me: row.remember_me ? 1 : 0,
                    user_agent: (rawUa || row.user_agent || '').substring(0, 2000)
                });
            }

            // Batch insert in chunks of 50
            for (let i = 0; i < sessionRows.length; i += 50) {
                const chunk = sessionRows.slice(i, i + 50);
                await knex('sessions')
                    .insert(chunk)
                    .onConflict('id')
                    .ignore();
            }

            console.log(`[migration] Successfully migrated ${sessionRows.length} latest active sessions into \`sessions\` table.`);
        } else {
            console.log('[migration] No active sessions found to migrate.');
        }
    }
}

export async function down(knex) {
    if (await knex.schema.hasTable('sessions')) {
        await knex.schema.dropTable('sessions');
        console.log('[migration] Dropped `sessions` table.');
    }
}
