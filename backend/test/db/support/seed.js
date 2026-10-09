import jwt from 'jsonwebtoken';
import { migrationConfig } from '../../../src/config/migrations.js';

/**
 * Wipes the test database and seeds two organizations (A and B), each with
 * an admin, an HR user and two employees, plus records owned by each user.
 * Returns the ids and a JWT per user.
 */
export async function seed(db) {
    // Belt and braces on top of testDb.js: never wipe a non-test database
    const [[{ name }]] = await db.raw('SELECT DATABASE() AS name');
    if (!/test/i.test(name)) throw new Error(`Refusing to wipe database "${name}"`);

    // Same schema production has after `npm run migrate`
    await db.migrate.latest(migrationConfig);

    const [tables] = await db.raw(
        "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT LIKE 'knex\\_migrations%'"
    );
    await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of tables) await db.raw('TRUNCATE TABLE ??', [t]);
    await db.raw('SET FOREIGN_KEY_CHECKS = 1');

    const ids = {};
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();

    for (const org of ['A', 'B']) {
        const [orgId] = await db('core_organizations').insert({ org_name: `Authz Org ${org}`, org_code: `AUTHZ${org}`, status: 'active' });
        ids[`org${org}`] = orgId;

        const users = { admin: 'admin', hr: 'HR', emp: 'employee', emp2: 'employee' };
        for (const [key, userType] of Object.entries(users)) {
            const [userId] = await db('core_users').insert({
                user_name: `${key} ${org}`,
                user_password: 'not-a-real-hash',
                org_id: orgId,
                user_type: userType,
                email: `${key}.${org.toLowerCase()}@authz.test`,
                user_code: `AUTHZ${org}-${key}`,
            });
            ids[`${key}${org}`] = userId;
        }

        const [shiftId] = await db('org_shifts').insert({ org_id: orgId, shift_name: `Shift ${org}`, policy_rules: JSON.stringify({}) });
        ids[`shift${org}`] = shiftId;

        // Payroll (v1)
        const [pkgId] = await db('payroll_salary_packages').insert({
            org_id: orgId, name: `Package ${org}`, description: 'Standard Package', packages_rules: JSON.stringify({}), is_active: 1,
        });
        ids[`pkg${org}`] = pkgId;
        await db('payroll_salary_package_components').insert({
            package_id: pkgId, name: 'Basic Salary', category: 'earning', calc_type: 'fixed', value: 50000, sort_order: 1, is_taxable: 1, is_active: 1,
        });
        for (const who of ['emp', 'emp2']) {
            await db('payroll_employee_salary_assignments').insert({
                employee_id: ids[`${who}${org}`], package_id: pkgId, effective_from: `${year}-01-01`,
            });
        }
        const [runId] = await db('payroll_runs_v1').insert({
            org_id: orgId, period_start: `${year}-01-01`, period_end: `${year}-01-31`, status: 'draft',
        });
        ids[`run${org}`] = runId;
        for (const who of ['emp', 'emp2']) {
            await db('payroll_lines').insert({
                payroll_run_id: runId, employee_id: ids[`${who}${org}`], transaction_type: 'earning', name: 'Basic Salary', amount: 50000,
            });
        }
        const [pkgGroupId] = await db('payroll_package_groups').insert({ org_id: orgId, package_name: `Package Group ${org}` });
        ids[`pkgGroup${org}`] = pkgGroupId;

        // Leave: policy, rule, balances and requests (one by HR themselves)
        const [lpId] = await db('leave_policies').insert({ org_id: orgId, name: `Policy ${org}` });
        const [ruleId] = await db('leave_policies_rules').insert({
            lp_id: lpId, name: 'Casual', code: `CL${org}`, accural_type: 'yearly', accural_amount: 12, max_balance: 12,
            carry_forward: 0, carry_forward_max: 0, encashable: 0, is_paid: 1, requires_doc: 0, is_active: 1,
        });
        const [lbId] = await db('leave_balances').insert({ user_id: ids[`emp${org}`], rule_id: ruleId, year, allocated: 12, used: 0 });
        ids[`lb${org}`] = lbId;
        for (const who of ['emp', 'hr']) {
            const [lrId] = await db('leave_request').insert({
                user_id: ids[`${who}${org}`], rule_id: ruleId, start_date: today, end_date: today, total_days: 1,
            });
            ids[`leave_${who}${org}`] = lrId;
        }

        // DAR change requests (one by HR themselves)
        for (const who of ['emp', 'hr']) {
            const [requestId] = await db('attn_dar_requests').insert({
                user_id: ids[`${who}${org}`], request_date: today, proposed_data: JSON.stringify([]),
            });
            ids[`dar_${who}${org}`] = requestId;
        }

        // DAR events owned by each employee
        for (const who of ['emp', 'emp2']) {
            const [eventId] = await db('comm_events_meetings').insert({
                user_id: ids[`${who}${org}`], title: `Event of ${who} ${org}`, event_date: today,
                start_time: '10:00:00', end_time: '11:00:00', type: 'MEETING',
            });
            ids[`event_${who}${org}`] = eventId;
        }

        // Attendance correction submitted by HR themselves
        const [acrId] = await db('attn_corrections').insert({
            user_id: ids[`hr${org}`], submitted_by: ids[`hr${org}`], correction_type: 'summary',
            proposed_data: JSON.stringify({}), request_date: today, reason: 'test',
        });
        ids[`correction_hr${org}`] = acrId;

        // Feedback ticket
        const [feedbackId] = await db('feedback_tickets').insert({ user_id: ids[`emp${org}`], title: `Feedback ${org}` });
        ids[`feedback${org}`] = feedbackId;
    }

    // Access tokens with the same claims as a real login
    const tokens = {};
    const users = await db('core_users').select('user_id', 'user_name', 'email', 'user_type', 'org_id');
    for (const [key, id] of Object.entries(ids)) {
        const user = users.find((u) => u.user_id === id && /^(admin|hr|emp|emp2)[AB]$/.test(key));
        if (user) {
            tokens[key] = jwt.sign(
                { user_id: user.user_id, user_name: user.user_name, email: user.email, user_type: user.user_type, org_id: user.org_id },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
        }
    }
    return { ids, tokens };
}
