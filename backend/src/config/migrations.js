import path from 'path';
import { fileURLToPath } from 'url';

// Knex migration settings shared by scripts/db/migrate.js and the DB tests.
// Migration files are ES modules (.mjs) in backend/migrations/.
export const migrationConfig = {
    directory: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'),
    loadExtensions: ['.mjs'],
};
