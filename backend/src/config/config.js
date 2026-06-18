// backend/config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend 2.0 project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Suppress GLib and sharp (libvips) console warnings/errors
process.env.VIPS_WARNING = '0';
process.env.G_MESSAGES_DEBUG = 'none';

// Try to suppress sharp-related GLib errors on Windows
import sharp from 'sharp';
try {
    sharp.cache(false);
    sharp.concurrency(1);
} catch (e) {
    // Ignore if sharp is not loaded yet or fails
}

import { initializeLogger } from '../utils/Logger.js';
initializeLogger();

