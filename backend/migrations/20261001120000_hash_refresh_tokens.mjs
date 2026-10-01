/**
 * core_refresh_tokens.token held the refresh tokens themselves, so anyone
 * with read access to the database or a backup could sign in as any user
 * (M-05). The app now stores SHA-256 hashes (modules/auth/tokenService.js).
 *
 * 1. Existing tokens are replaced by their hash. Signed-in users stay signed
 *    in: their browser still has the token, and the app hashes it on lookup.
 *    Tokens are 80 hex characters, hashes 64, so converted rows are skipped
 *    when this runs again.
 * 2. replaced_by_token (left over from token rotation, no longer used) also
 *    held tokens; it is cleared.
 * 3. Lookups by token get an index (every refresh scanned the whole table).
 *
 * Hashes cannot be turned back into tokens: `down` only removes the index.
 * Running the previous app version after this migration signs everyone out
 * once.
 */

const INDEX = 'idx_core_refresh_tokens_token';

async function hasIndex(knex) {
    const [rows] = await knex.raw('SHOW INDEX FROM core_refresh_tokens WHERE Key_name = ?', [INDEX]);
    return rows.length > 0;
}

export async function up(knex) {
    const [result] = await knex.raw(
        'UPDATE core_refresh_tokens SET token = SHA2(token, 256) WHERE CHAR_LENGTH(token) <> 64'
    );
    await knex.raw('UPDATE core_refresh_tokens SET replaced_by_token = NULL WHERE replaced_by_token IS NOT NULL');
    console.log(`[migration] hashed ${result.affectedRows} stored refresh tokens`);

    if (!(await hasIndex(knex))) {
        await knex.raw('ALTER TABLE core_refresh_tokens ADD INDEX ?? (token)', [INDEX]);
    }
}

export async function down(knex) {
    if (await hasIndex(knex)) {
        await knex.raw('ALTER TABLE core_refresh_tokens DROP INDEX ??', [INDEX]);
    }
}
