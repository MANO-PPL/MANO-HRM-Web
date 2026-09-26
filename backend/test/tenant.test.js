import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { requireOrgId, assertUserInOrg, assertSelfOrStaffInOrg } = await import('../src/utils/tenant.js');

// Minimal knex-like stub: users is a list of { user_id, org_id }
function fakeDb(users) {
    return () => {
        let filter = {};
        const query = {
            where(conditions) { filter = conditions; return query; },
            async first() {
                return users.find((u) => Object.entries(filter).every(([k, v]) => u[k] === v));
            },
        };
        return query;
    };
}

const db = fakeDb([
    { user_id: 1, org_id: 10 },
    { user_id: 2, org_id: 10 },
    { user_id: 3, org_id: 20 },
]);

const req = (id, user_type, org_id) => ({ user: { id, user_type, org_id } });

test('requireOrgId rejects requests without an org (no tenant fallback)', () => {
    assert.throws(() => requireOrgId(req(1, 'super_admin', null)), { statusCode: 403 });
    assert.equal(requireOrgId(req(1, 'admin', 10)), 10);
});

test('assertUserInOrg: same org passes, other org is 404', async () => {
    await assertUserInOrg(2, 10, db);
    await assert.rejects(assertUserInOrg(3, 10, db), { statusCode: 404 });
});

test('assertSelfOrStaffInOrg: employee can read own record only', async () => {
    await assertSelfOrStaffInOrg(req(1, 'employee', 10), 1, db);
    await assert.rejects(assertSelfOrStaffInOrg(req(1, 'employee', 10), 2, db), { statusCode: 403 });
});

test('assertSelfOrStaffInOrg: admin/HR limited to their own org', async () => {
    await assertSelfOrStaffInOrg(req(2, 'hr', 10), 1, db);
    await assertSelfOrStaffInOrg(req(2, 'admin', 10), '1', db); // string IDs from req.params
    await assert.rejects(assertSelfOrStaffInOrg(req(2, 'admin', 10), 3, db), { statusCode: 404 });
});
