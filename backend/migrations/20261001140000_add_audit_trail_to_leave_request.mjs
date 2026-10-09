/**
 * Adds audit_trail JSON column to leave_request if missing.
 * This supports the leave approval audit trails and history drawer.
 */

export async function up(knex) {
    const hasAuditTrail = await knex.schema.hasColumn('leave_request', 'audit_trail');
    if (!hasAuditTrail) {
        await knex.schema.alterTable('leave_request', (table) => {
            table.json('audit_trail').nullable();
        });
    }
}

export async function down(knex) {
    const hasAuditTrail = await knex.schema.hasColumn('leave_request', 'audit_trail');
    if (hasAuditTrail) {
        await knex.schema.alterTable('leave_request', (table) => {
            table.dropColumn('audit_trail');
        });
    }
}
