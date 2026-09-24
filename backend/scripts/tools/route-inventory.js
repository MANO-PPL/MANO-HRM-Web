/**
 * Route inventory: prints every HTTP route with its route-level guards as CSV.
 *
 *   node scripts/tools/route-inventory.js > route-inventory.csv
 *
 * "roles" only reflects route-level gates (authorize()/ensureAdmin). Routes
 * showing "-" may still have an inline role check inside the controller.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { collectRoutes, describeGuards } = await import('../../test/support/routeIntrospection.js');

const routes = await collectRoutes();
const rows = [['method', 'path', 'authenticated', 'active_org', 'roles']];

for (const route of routes) {
    const guards = await describeGuards(route);
    for (const method of route.methods) {
        rows.push([
            method,
            route.path,
            guards.authenticated ? 'yes' : 'NO',
            guards.activeOrg ? 'yes' : 'no',
            guards.roles ? guards.roles.join('|') : '-',
        ]);
    }
}

process.stdout.write(rows.map((r) => r.join(',')).join('\n') + '\n');
process.exit(0);
