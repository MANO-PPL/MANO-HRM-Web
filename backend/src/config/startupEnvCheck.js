// Imported by server.js right after config.js and before the app, whose
// modules read settings while loading (static imports run before server.js's
// own code, so calling assertEnv() there would be too late).
import { assertEnv } from './env.js';

assertEnv();
