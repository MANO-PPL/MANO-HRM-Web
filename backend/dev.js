import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodemonBin = path.join(__dirname, 'node_modules', 'nodemon', 'bin', 'nodemon.js');

process.env.VIPS_WARNING = process.env.VIPS_WARNING || '0';
process.env.G_MESSAGES_DEBUG = process.env.G_MESSAGES_DEBUG || 'none';

const child = spawn(process.execPath, [nodemonBin, 'server.js'], {
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
  // Allow child a moment to terminate, then exit 0
  setTimeout(() => process.exit(0), 300).unref();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

child.on('exit', () => {
  process.exit(0);
});

child.on('error', (err) => {
  console.error('[Backend Dev] Process error:', err);
  process.exit(1);
});
