import path from 'path';
import { fileURLToPath } from 'url';

// Knex migration settings shared by scripts/db/migrate.js and the DB tests.
// Migration files are ES modules (.mjs) in backend/migrations/.
export const migrationConfig = {
    directory: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'),
    loadExtensions: ['.mjs'],
    // Reverting a commit whose migration already ran removes the file but not
    // its row in knex_migrations. Knex would then refuse every later migrate
    // ("migration directory is corrupt") and every deploy would fail. The
    // applied change stays in the database; migrations are written so the
    // previous code still works with them.
    disableMigrationsListValidation: true,
};
