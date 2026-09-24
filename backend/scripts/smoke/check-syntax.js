/**
 * Runs `node --check` on server.js and every .js file under src/.
 * Exits non-zero if any file fails to parse.
 */
import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function listJs(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listJs(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

const files = [path.join(root, 'server.js'), ...listJs(path.join(root, 'src'))];
let failed = 0;

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failed++;
        console.error(`✗ ${path.relative(root, file)}\n${result.stderr}`);
    }
}

console.log(`Syntax check: ${files.length - failed}/${files.length} files OK`);
process.exit(failed ? 1 : 0);
