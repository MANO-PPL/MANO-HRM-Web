import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn(process.execPath, [viteBin, '--host'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

let isExiting = false;
const cleanExit = () => {
  if (isExiting) return;
  isExiting = true;
  if (child && !child.killed) {
    try {
      child.kill('SIGINT');
    } catch (_) {}
  }
  setTimeout(() => process.exit(0), 300).unref();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

child.on('exit', () => {
  process.exit(0);
});

child.on('error', (err) => {
  console.error('[Frontend Dev] Process error:', err);
  process.exit(1);
});
