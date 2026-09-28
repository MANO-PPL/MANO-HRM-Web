import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Runs a tiny program that installs the guards, registers one shutdown hook
// and then triggers `failure`; returns its exit code and output.
function runWithGuards(failure) {
    const program = `
        import { installProcessGuards } from './src/lifecycle/processGuards.js';
        import { onShutdown } from './src/lifecycle/shutdown.js';
        installProcessGuards();
        onShutdown('test resource', () => console.log('HOOK RAN'), 'infra');
        setInterval(() => {}, 1000); // keep the process alive like a server would
        ${failure}
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
        cwd: root,
        encoding: 'utf8',
        timeout: 20000,
    });
    return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

test('uncaught exception: logged as FATAL, hooks run, exit code 1', () => {
    const { code, output } = runWithGuards(`setTimeout(() => { throw new Error('boom'); }, 10);`);
    assert.match(output, /\[FATAL\] uncaughtException/);
    assert.match(output, /HOOK RAN/);
    assert.match(output, /shutdown complete/);
    assert.equal(code, 1);
});

test('unhandled rejection: logged as FATAL, hooks run, exit code 1', () => {
    const { code, output } = runWithGuards(`setTimeout(() => { Promise.reject(new Error('lost')); }, 10);`);
    assert.match(output, /\[FATAL\] unhandledRejection/);
    assert.match(output, /HOOK RAN/);
    assert.equal(code, 1);
});

test('SIGTERM: graceful shutdown with exit code 0', () => {
    const { code, output } = runWithGuards(`setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10);`);
    assert.match(output, /shutdown started \(SIGTERM\)/);
    assert.match(output, /HOOK RAN/);
    assert.equal(code, 0);
});
