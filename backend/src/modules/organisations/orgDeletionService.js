/**
 * Permanent deletion of an organization and everything that belongs to it.
 *
 * DELETION_PLAN lists every table holding org data, children before parents
 * so no foreign key blocks a delete. Rows are deleted in chunks rather than
 * in one transaction (large log tables would hold locks for a long time).
 * The organization row is deleted last: if anything fails, the org stays
 * 'pending_deletion' and the next nightly run resumes where this one stopped.
 *
 * Files in S3 are collected before the rows are deleted and removed after,
 * best-effort (a failed S3 delete is logged, not retried).
 *
 * When adding a table that stores org or user data, add it to DELETION_PLAN;
 * test/db/orgDeletion.db.test.js fails for any table left behind.
 */
import { attendanceDB } from '../../config/database.js';
import * as S3Service from '../../services/s3/s3Service.js';
import { safeJsonParse } from '../../utils/dataUtils.js';

const BATCH_SIZE = 5000;
const S3_DELETE_CONCURRENCY = 10;

// Subqueries identifying the org's rows in parent tables
function scopes(db, orgId) {
    const users = () => db('core_users').select('user_id').where('org_id', orgId);
    const conversations = () => db('chat_conversations').select('id').where('org_id', orgId);
    const messages = () => db('chat_messages').select('id').whereIn('conversation_id', conversations());
    const feedback = () => db('feedback_tickets').select('feedback_id').whereIn('user_id', users());
    // leave_attachments.leave_id holds leave_request ids (see leaveService). Its
    // foreign key points at the legacy leave_requests table, whose ids overlap:
    // never match attachments against legacy ids (that could hit another org).
    const leaveIds = () => db('leave_request').select('lr_id').whereIn('user_id', users());
    const orgRows = (table, column = 'id') => () => db(table).select(column).where('org_id', orgId);

    const byOrg = (q) => q.where('org_id', orgId);
    const byUser = (column = 'user_id') => (q) => q.whereIn(column, users());
    const byOrgOrUser = (q) => q.where('org_id', orgId).orWhereIn('user_id', users());
    const byParent = (column, parent) => (q) => q.whereIn(column, parent());

    return { users, conversations, messages, feedback, leaveIds, orgRows, byOrg, byUser, byOrgOrUser, byParent };
}

// [table, scope] in deletion order (children first)
function deletionPlan(s) {
    return [
        // Chat
        ['chat_message_attachments', s.byParent('message_id', s.messages)],
        ['chat_message_mentions', s.byParent('message_id', s.messages)],
        ['chat_message_reactions', s.byParent('message_id', s.messages)],
        ['chat_message_reactions', s.byUser()],
        ['chat_messages', s.byParent('conversation_id', s.conversations)],
        ['chat_conversation_members', s.byParent('conversation_id', s.conversations)],
        ['chat_conversation_members', s.byUser()],
        ['chat_conversations', s.byOrg],
        ['chat_rooms', s.byOrg],

        // Feedback
        ['feedback_attachments', s.byParent('feedback_id', s.feedback)],
        ['feedback_tickets', s.byUser()],

        // Leave
        ['leave_attachments', s.byParent('leave_id', s.leaveIds)],
        ['leave_request', s.byUser()],
        ['leave_requests', s.byUser()],
        ['leave_balances', s.byUser()],
        ['leave_policies_rules', s.byParent('lp_id', s.orgRows('leave_policies', 'lp_id'))],
        ['leave_policies', s.byOrg],

        // HR documents, onboarding, performance, recruitment
        ['doc_generated_hr_documents', s.byOrg],
        ['doc_custom_templates', s.byOrg],
        ['doc_required_items', s.byParent('template_id', s.orgRows('doc_required_templates'))],
        ['doc_required_templates', s.byOrg],
        ['doc_employee_uploads', s.byUser('employee_id')],
        ['onboard_checklist_items', s.byParent('template_id', s.orgRows('onboard_checklist_templates'))],
        ['onboard_checklist_progress', s.byUser('employee_id')],
        ['onboard_checklist_templates', s.byOrg],
        ['perf_employee_goals', s.byParent('cycle_id', s.orgRows('perf_cycles'))],
        ['perf_employee_goals', s.byUser('employee_id')],
        ['perf_employee_reviews', s.byParent('cycle_id', s.orgRows('perf_cycles'))],
        ['perf_employee_reviews', s.byUser('employee_id')],
        ['perf_cycles', s.byOrg],
        ['recruit_candidates', s.byParent('template_id', s.orgRows('recruit_form_templates'))],
        ['recruit_openings', s.byOrg],
        ['recruit_pipeline_stages', s.byOrg],
        ['recruit_form_templates', s.byOrg],

        // Labour
        ['labour_advances', s.byOrg],
        ['labour_attendance', s.byOrg],
        ['labour_monthly_payouts', s.byOrg],
        ['labour_daily_schedule', s.byOrg],
        ['labour_site_relations', s.byOrg],
        ['labour_wage_history', s.byOrg],
        ['labours', s.byOrg],
        ['labour_sites', s.byOrg],

        // Payroll (entries/history reference users with RESTRICT: before core_users)
        ['payroll_lines', s.byUser('employee_id')],
        ['payroll_lines', s.byParent('payroll_run_id', s.orgRows('payroll_runs_v1', 'id'))],
        ['payroll_employee_salary_assignments', s.byUser('employee_id')],
        ['payroll_employee_salary_assignments', s.byParent('package_id', s.orgRows('payroll_salary_packages', 'id'))],
        ['payroll_salary_package_components', s.byParent('package_id', s.orgRows('payroll_salary_packages', 'id'))],
        ['payroll_salary_packages', s.byOrg],
        ['payroll_runs_v1', s.byOrg],
        ['payroll_settings_v1', s.byOrg],
        ['payroll_entries', s.byUser('employee_id')],
        ['payroll_entries', s.byParent('run_id', s.orgRows('payroll_runs', 'run_id'))],
        ['payroll_audit_logs', s.byUser('employee_id')],
        ['payroll_salary_history', s.byUser('employee_id')],
        ['employee_salary_history', s.byUser('employee_id')],
        ['payroll_packages', s.byParent('package_group_id', s.orgRows('payroll_package_groups', 'package_group_id'))],
        ['payroll_package_groups', s.byOrg],
        ['payroll_runs', s.byOrg],
        ['payroll_settings', s.byOrg],

        // Attendance, DAR, events, notifications, sessions
        ['attn_correction_requests', s.byUser()],
        ['attn_corrections', s.byUser()],
        ['attn_daily_activities', s.byUser()],
        ['attn_daily_summary', s.byUser()],
        ['attn_daily_summary_v2', s.byUser()],
        ['attn_dar_requests', s.byUser()],
        ['attn_punches', s.byUser()],
        ['attn_records', s.byUser()],
        ['comm_events_meetings', s.byUser()],
        ['comm_notifications', s.byUser()],
        ['sessions', s.byUser()],
        ['core_refresh_tokens', s.byUser()],
        ['core_user_fcm_tokens', s.byUser()],
        ['org_user_work_locations', s.byUser()],

        // Logs and generated reports
        ['sys_activity_logs', s.byOrgOrUser],
        ['sys_api_logs', s.byOrgOrUser],
        ['sys_error_logs', s.byOrgOrUser],
        ['sys_generated_reports', s.byOrgOrUser],
        ['sys_security_alerts', s.byOrgOrUser],

        // Users, then org configuration they referenced, then the org itself
        ['core_users', s.byOrg],
        ['org_holidays', s.byOrg],
        ['org_shifts', s.byOrg],
        ['org_work_locations', s.byOrg],
        ['org_departments', s.byOrg],
        ['org_designations', s.byOrg],
        ['org_attendance_settings', s.byOrg],
        ['attn_dar_settings', s.byOrg],
        ['core_subscription_history', s.byOrg],
    ];
}

export const DELETION_TABLES = [...new Set(deletionPlan(scopes(attendanceDB, 0)).map(([table]) => table)), 'core_organizations'];

// S3 object keys owned by the org, collected before the rows are deleted
async function collectFileKeys(db, s) {
    const keys = new Set();
    const add = (key) => { if (key && !/^https?:\/\//i.test(key)) keys.add(key); };

    for (const row of await db('attn_punches').whereIn('user_id', s.users()).whereNotNull('metadata').select('metadata')) {
        add(safeJsonParse(row.metadata)?.image_key);
    }
    for (const row of await db('attn_records').whereIn('user_id', s.users()).select('time_in_image_key', 'time_out_image_key')) {
        add(row.time_in_image_key);
        add(row.time_out_image_key);
    }
    for (const row of await db('chat_message_attachments').whereIn('message_id', s.messages()).select('storage_key')) add(row.storage_key);
    for (const row of await db('doc_employee_uploads').whereIn('employee_id', s.users()).select('file_key')) add(row.file_key);
    for (const row of await db('feedback_attachments').whereIn('feedback_id', s.feedback()).select('file_key')) add(row.file_key);
    for (const row of await db('leave_attachments').whereIn('leave_id', s.leaveIds()).select('file_key')) add(row.file_key);
    // Profile pictures are stored as public/profile_pics/<user_code>.webp (see profileService)
    for (const row of await db('core_users').whereIn('user_id', s.users()).whereNotNull('profile_image_url').select('user_code')) {
        if (row.user_code) add(`public/profile_pics/${row.user_code}.webp`);
    }
    return [...keys];
}

async function deleteInBatches(db, table, scope) {
    let total = 0;
    for (;;) {
        const deleted = await scope(db(table)).limit(BATCH_SIZE).del();
        total += deleted;
        if (deleted < BATCH_SIZE) return total;
    }
}

async function deleteS3Objects(s3, keys, orgId) {
    let deleted = 0;
    let failed = 0;
    const queue = [...keys];
    const worker = async () => {
        for (let key = queue.shift(); key; key = queue.shift()) {
            try {
                await s3.deleteFile({ key });
                deleted++;
            } catch {
                failed++;
            }
        }
    };
    await Promise.all(Array.from({ length: S3_DELETE_CONCURRENCY }, worker));

    // Generated reports live under reports/<org_id>/; listing returns up to 1000 keys per call
    for (let round = 0; round < 1000; round++) {
        let files;
        try {
            ({ files } = await s3.listFiles(`reports/${orgId}/`));
        } catch {
            failed++;
            break;
        }
        if (!files || files.length === 0) break;
        const before = deleted;
        for (const file of files) {
            try {
                await s3.deleteFile({ key: file.key });
                deleted++;
            } catch {
                failed++;
            }
        }
        if (deleted === before) break; // nothing could be deleted; avoid looping forever
    }
    return { deleted, failed };
}

/**
 * Permanently deletes an organization and all of its data.
 * @returns {{ rowsDeleted: number, filesDeleted: number, fileDeleteFailures: number }}
 */
export async function deleteOrganization(orgId, { db = attendanceDB, s3 = S3Service } = {}) {
    if (!Number.isInteger(Number(orgId)) || Number(orgId) <= 0) {
        throw new Error(`Invalid org id: ${orgId}`);
    }
    const s = scopes(db, orgId);
    const fileKeys = await collectFileKeys(db, s);

    let rowsDeleted = 0;
    for (const [table, scope] of deletionPlan(s)) {
        rowsDeleted += await deleteInBatches(db, table, scope);
    }
    rowsDeleted += await db('core_organizations').where('org_id', orgId).del();

    const files = await deleteS3Objects(s3, fileKeys, orgId);
    return { rowsDeleted, filesDeleted: files.deleted, fileDeleteFailures: files.failed };
}
