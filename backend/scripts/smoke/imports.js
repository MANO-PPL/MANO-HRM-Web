/**
 * Import smoke test: loads the Express app so broken ESM imports (wrong paths,
 * missing exports) fail here instead of on the production server.
 * Needs no database; Redis connection warnings are expected when it is down.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

try {
    const { default: app } = await import('../../src/app.js');
    if (typeof app !== 'function') throw new Error('src/app.js did not export an Express app');
    console.log('Import smoke test: OK');
    process.exit(0);
} catch (err) {
    console.error('Import smoke test: FAILED\n', err);
    process.exit(1);
}
