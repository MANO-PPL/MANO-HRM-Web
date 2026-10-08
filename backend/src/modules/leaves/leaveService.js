import { attendanceDB } from '../../config/database.js';
// S3 helper lives in the top-level services/s3 folder
import * as S3Service from '../../services/s3/s3Service.js';
import EventBus from '../../utils/EventBus.js';
import { PayrollCalculationService } from '../payroll/PayrollCalculationService.js';
import { toMySQLDate } from '../../utils/dateUtils.js';

export function formatLeaveAuditTrail(leave) {
    if (!leave) return [];
    let trail = [];
    if (leave.audit_trail) {
        try {
            trail = typeof leave.audit_trail === 'string'
                ? JSON.parse(leave.audit_trail)
                : leave.audit_trail;
        } catch (_) {
            trail = [];
        }
    }

    if (!Array.isArray(trail) || trail.length === 0) {
        trail = [];
        if (leave.applied_at || leave.user_id) {
            trail.push({
                action: 'submitted',
                by: leave.user_id,
                by_name: leave.user_name || 'Employee',
                at: leave.applied_at ? new Date(leave.applied_at).toISOString() : new Date().toISOString()
            });
        }
        const lowerStatus = String(leave.status || 'pending').toLowerCase();
        if (['approved', 'rejected', 'cancelled'].includes(lowerStatus)) {
            trail.push({
                action: lowerStatus,
                by: leave.reviewed_by || null,
                by_name: leave.reviewer_name || (leave.reviewed_by ? 'Admin' : 'System'),
                at: leave.reviewed_at ? new Date(leave.reviewed_at).toISOString() : (leave.applied_at ? new Date(leave.applied_at).toISOString() : new Date().toISOString()),
                comments: leave.admin_comment || null
            });
        }
    }

    return Array.isArray(trail) ? trail : [];
}


function applyActiveUserFilter(query, prefix = 'u') {
    return query
        .where(function () {
            this.where(`${prefix}.is_active`, 1).orWhere(`${prefix}.is_active`, true);
        })
        .where(function () {
            this.where(`${prefix}.is_deleted`, 0).orWhere(`${prefix}.is_deleted`, false).orWhereNull(`${prefix}.is_deleted`);
        });
}

function calculateBalance(b) {
    const allocated = Number(b.allocated) > 0 ? Number(b.allocated) : Number(b.max_balance || 0);
    const carried = Number(b.carried_forward || 0);
    const total = allocated + carried;
    const used = Number(b.used || 0);
    return {
        ...b,
        allocated,
        available: Math.max(0, total - used)
    };
}

function baseBalanceQuery() {
    return attendanceDB('leave_balances as lb')
        .join('leave_policies_rules as lpr', 'lb.rule_id', 'lpr.rule_id')
        .leftJoin('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id');
}

async function attachRulesToPolicies(policies, activeOnly = false) {
    if (!policies.length) return [];
    const policyIds = policies.map(p => p.lp_id);
    let rulesQuery = attendanceDB('leave_policies_rules')
        .whereIn('lp_id', policyIds)
        .orderBy('name', 'asc');

    if (activeOnly) {
        rulesQuery = rulesQuery.andWhere({ is_active: 1 });
    }

    const rules = await rulesQuery;
    const rulesMap = new Map();
    for (const rule of rules) {
        if (!rulesMap.has(rule.lp_id)) rulesMap.set(rule.lp_id, []);
        rulesMap.get(rule.lp_id).push(rule);
    }

    return policies.map(p => ({
        ...p,
        rules: rulesMap.get(p.lp_id) || []
    }));
}

async function areRulesReferenced(ruleIds) {
    const ids = Array.isArray(ruleIds) ? ruleIds : [ruleIds];
    if (!ids.length) return false;
    const hasReq = await attendanceDB('leave_request').whereIn('rule_id', ids).first();
    if (hasReq) return true;
    const hasBal = await attendanceDB('leave_balances').whereIn('rule_id', ids).first();
    return !!hasBal;
}

function baseLeaveQuery() {
    return attendanceDB('leave_request as lr')
        .join('core_users as u', 'lr.user_id', 'u.user_id')
        .leftJoin('leave_policies_rules as lpr', 'lr.rule_id', 'lpr.rule_id')
        .leftJoin('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
        .leftJoin('core_users as reviewer', 'lr.reviewed_by', 'reviewer.user_id')
        .select(
            'lr.*',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.profile_image_url',
            'u.is_active',
            'u.is_deleted',
            attendanceDB.raw('COALESCE(lpr.name, lr.leave_type, "Leave") as leave_type'),
            'lpr.code as leave_code',
            'lp.name as policy_name',
            'reviewer.user_name as reviewer_name'
        );
}

async function populateLeaveMetadata(leaves = []) {
    if (!leaves.length) return [];
    const leaveIds = leaves.map(l => l.lr_id);
    const attachments = await attendanceDB('leave_attachments').whereIn('leave_id', leaveIds);
    const attachmentMap = new Map();

    await Promise.all(attachments.map(async (a) => {
        const { url } = await S3Service.getFileUrl({ key: a.file_key });
        if (!attachmentMap.has(a.leave_id)) attachmentMap.set(a.leave_id, []);
        attachmentMap.get(a.leave_id).push({ ...a, file_url: url });
    }));

    return leaves.map(leave => ({
        ...leave,
        attachments: attachmentMap.get(leave.lr_id) || [],
        audit_trail: formatLeaveAuditTrail(leave)
    }));
}

export async function getMyHistory({ user_id, org_id }) {
    const leaves = await baseLeaveQuery()
        .where({ 'lr.user_id': user_id })
        .orderBy('lr.applied_at', 'desc');

    const populated = await populateLeaveMetadata(leaves);

    // In my leave requests for employees, show the approver as "Admin" instead of their personal name
    return populated.map(leave => ({
        ...leave,
        reviewer_name: leave.reviewed_by ? 'Admin' : null,
        audit_trail: (leave.audit_trail || []).map(event => {
            const isSubmission = String(event.action).toLowerCase() === 'submitted';
            if (!isSubmission) {
                return {
                    ...event,
                    by_name: 'Admin'
                };
            }
            return event;
        })
    }));
}

export async function submitLeaveRequest({ user_id, org_id, leave_type, start_date, end_date, reason, files }) {
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw { status: 400, message: "Invalid date format" };
    }

    if (end < start) {
        throw { status: 400, message: "End date cannot be before start date" };
    }

    // Resolve leave_type to rule_id and human-readable leave_type string
    let resolvedRuleId = 0;
    let resolvedLeaveTypeName = typeof leave_type === 'string' ? leave_type.trim() : '';

    const numericRuleId = Number(leave_type);
    if (!isNaN(numericRuleId) && numericRuleId > 0) {
        resolvedRuleId = numericRuleId;
        const rule = await attendanceDB('leave_policies_rules').where({ rule_id: numericRuleId }).first();
        if (rule) {
            resolvedLeaveTypeName = rule.name;
        }
    } else if (resolvedLeaveTypeName) {
        // Find matching rule in organization's policy rules
        let rule = await attendanceDB('leave_policies_rules as lpr')
            .join('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
            .where({ 'lp.org_id': org_id })
            .where(builder => {
                builder.where('lpr.name', 'like', resolvedLeaveTypeName)
                       .orWhere('lpr.code', 'like', resolvedLeaveTypeName);
            })
            .select('lpr.rule_id', 'lpr.name')
            .first();

        if (!rule) {
            rule = await attendanceDB('leave_policies_rules')
                .where(builder => {
                    builder.where('name', 'like', resolvedLeaveTypeName)
                           .orWhere('code', 'like', resolvedLeaveTypeName);
                })
                .select('rule_id', 'name')
                .first();
        }

        if (rule) {
            resolvedRuleId = rule.rule_id;
            resolvedLeaveTypeName = rule.name;
        } else {
            // Fallback heuristics (e.g. "Casual Leave" -> CL, "Sick Leave" -> SL)
            let searchCode = '';
            const typeLower = resolvedLeaveTypeName.toLowerCase();
            if (typeLower.includes('casual')) searchCode = 'CL';
            else if (typeLower.includes('sick')) searchCode = 'SL';
            else if (typeLower.includes('med')) searchCode = 'MED';

            if (searchCode) {
                const fallbackRule = await attendanceDB('leave_policies_rules')
                    .where({ code: searchCode })
                    .select('rule_id', 'name')
                    .first();
                if (fallbackRule) {
                    resolvedRuleId = fallbackRule.rule_id;
                    resolvedLeaveTypeName = fallbackRule.name;
                }
            }
        }
    }

    if (!resolvedLeaveTypeName) {
        resolvedLeaveTypeName = 'Leave';
    }

    const sqlStart = toMySQLDate(start);
    const sqlEnd = toMySQLDate(end);

    const overlap = await attendanceDB('leave_request')
        .where({ user_id })
        .whereIn('status', ['pending', 'approved'])
        .where(builder => {
            builder.whereBetween('start_date', [sqlStart, sqlEnd])
                .orWhereBetween('end_date', [sqlStart, sqlEnd])
                .orWhere(inner => {
                    inner.where('start_date', '<', sqlStart)
                        .andWhere('end_date', '>', sqlEnd);
                });
        })
        .first();

    if (overlap) {
        throw { status: 400, message: "Use has an overlapping leave request." };
    }

    // Calculate total days
    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const [insertId] = await attendanceDB('leave_request').insert({
        user_id,
        rule_id: resolvedRuleId,
        leave_type: resolvedLeaveTypeName,
        start_date: sqlStart,
        end_date: sqlEnd,
        total_days: totalDays,
        reason,
        status: 'pending',
        applied_at: attendanceDB.fn.now(),
        audit_trail: JSON.stringify([
            { action: 'submitted', by: user_id, at: new Date().toISOString() }
        ])
    });

    let responseAttachments = [];

    if (files && files.length > 0) {
        const attachmentPromises = files.map(async (file) => {
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            const key = cleanName;
            const directory = `leaves/${insertId}`;

            await S3Service.uploadFile({
                fileBuffer: file.buffer,
                key: key,
                directory: directory,
                contentType: file.mimetype
            });

            const { url: signedUrl } = await S3Service.getFileUrl({ key: key, directory: `leaves/${insertId}` });

            return {
                leave_id: insertId,
                file_key: `leaves/${insertId}/${key}`,
                file_type: file.mimetype,
                _signedUrl: signedUrl
            };
        });

        const attachmentsData = await Promise.all(attachmentPromises);

        const dbInserts = attachmentsData.map(({ _signedUrl, ...rest }) => rest);
        await attendanceDB('leave_attachments').insert(dbInserts);

        responseAttachments = attachmentsData.map(a => ({
            file_key: a.file_key,
            file_url: a._signedUrl,
            file_type: a.file_type
        }));
    }

    return { insertId, responseAttachments };
}

export async function withdrawLeaveRequest({ id, user_id, org_id }) {
    const request = await attendanceDB('leave_request').where({ lr_id: id, user_id }).first();

    if (!request) {
        throw { status: 404, message: "Request not found" };
    }

    if (!['pending', 'approved'].includes(request.status)) {
        throw { status: 400, message: "Cannot withdraw a rejected or cancelled request" };
    }

    const wasApproved = request.status === 'approved';

    // If the request was already approved, restore the used balance
    if (wasApproved && request.rule_id) {
        const leaveDays = Number(request.total_days) || 0;
        const leaveYear = new Date(request.start_date).getFullYear();

        const balance = await attendanceDB('leave_balances')
            .where({ user_id: request.user_id, rule_id: request.rule_id, year: leaveYear })
            .first();

        if (balance && leaveDays > 0) {
            const newUsed = Math.max(0, Number(balance.used) - leaveDays);
            await attendanceDB('leave_balances')
                .where({ lb_id: balance.lb_id })
                .update({ used: newUsed, updated_at: attendanceDB.fn.now() });
        }
    }

    await attendanceDB('leave_request').where({ lr_id: id }).del();

    // Trigger payroll recalculation if the withdrawn leave was approved (affects salary)
    if (wasApproved) {
        PayrollCalculationService.triggerLeaveRecalculation({ ...request, org_id }).catch(err => {
            console.error("Failed to trigger payroll recalculation after leave withdrawal:", err);
        });
    }

    try {
        const employee = await attendanceDB('core_users').where({ user_id }).select('user_name').first();
        const employeeName = employee?.user_name || 'An employee';
        const statusLabel = wasApproved ? 'approved' : 'pending';

        const startFormatted = toMySQLDate(request.start_date);
        const endFormatted = toMySQLDate(request.end_date);

        const admins = await attendanceDB('core_users')
            .where({ org_id, is_deleted: 0, is_active: 1 })
            .whereIn('user_type', ['admin', 'hr'])
            .select('user_id');

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(user_id)) continue;
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: 'Leave Request Withdrawn',
                message: `${employeeName} has withdrawn their ${statusLabel} leave request for ${startFormatted} to ${endFormatted}.`,
                type: 'WARNING',
                related_entity_type: 'LEAVE',
                related_entity_id: id,
                send_push: false
            });
        }
    } catch (err) {
        console.error('Error sending leave withdrawal notification:', err);
    }
}

export async function getPendingRequests({ org_id }) {
    let query = baseLeaveQuery()
        .where('u.org_id', org_id)
        .where('lr.status', 'pending');
    query = applyActiveUserFilter(query, 'u');
    const requests = await query.orderBy('lr.applied_at', 'asc');
    return populateLeaveMetadata(requests);
}

export async function getAdminHistory({ org_id, user_id, status, start_date, end_date, include_inactive }) {
    let query = baseLeaveQuery().where('u.org_id', org_id);

    if (!include_inactive || include_inactive === 'false') {
        query = applyActiveUserFilter(query, 'u');
    }

    if (user_id) query = query.where('lr.user_id', user_id);
    if (status) query = query.where('lr.status', status);
    if (start_date) query = query.where('lr.start_date', '>=', start_date);
    if (end_date) query = query.where('lr.end_date', '<=', end_date);

    const history = await query.orderBy('lr.applied_at', 'desc');
    return populateLeaveMetadata(history);
}

export async function updateLeaveStatus({ id, org_id, status, pay_type, pay_percentage, admin_comment, reviewed_by }) {
    if (!status) {
        throw { status: 400, message: "Status is required" };
    }
    const lowerStatus = status.toLowerCase();
    if (!['approved', 'rejected'].includes(lowerStatus)) {
        throw { status: 400, message: "Invalid status" };
    }

    // The request must belong to a user of the reviewer's org
    const scoped = await attendanceDB('leave_request as lr')
        .join('core_users as u', 'u.user_id', 'lr.user_id')
        .where({ 'lr.lr_id': id, 'u.org_id': org_id })
        .first('lr.lr_id', 'lr.user_id');
    if (!scoped) {
        throw { status: 404, message: "Request not found" };
    }
    if (Number(scoped.user_id) === Number(reviewed_by)) {
        throw { status: 403, message: "You cannot review your own leave request" };
    }

    // Status change and balance adjustment are applied atomically, with the
    // request row locked so concurrent reviews cannot double-count the balance.
    let statusChanged = false;
    await attendanceDB.transaction(async (trx) => {
        const request = await trx('leave_request').where({ lr_id: id }).forUpdate().first();
        if (!request) {
            throw { status: 404, message: "Request not found" };
        }
        const previousStatus = (request.status || '').toLowerCase();

        // Idempotency: if request is already in target status (e.g. concurrent approval),
        // preserve the existing state and avoid double balance deduction.
        if (previousStatus === lowerStatus) {
            return;
        }
        statusChanged = true;

        const auditTrail = formatLeaveAuditTrail(request);
        const reviewer = await trx('core_users').where({ user_id: reviewed_by }).select('user_name').first();

        auditTrail.push({
            action: lowerStatus,
            by: reviewed_by,
            by_name: reviewer?.user_name || 'Admin',
            at: new Date().toISOString(),
            comments: admin_comment || null
        });

        const updateData = {
            status: lowerStatus,
            reviewed_by,
            reviewed_at: trx.fn.now(),
            audit_trail: JSON.stringify(auditTrail)
        };

        if (admin_comment !== undefined) {
            updateData.admin_comment = admin_comment;
        }

        if (lowerStatus === 'approved') {
            if (pay_type !== undefined) {
                updateData.pay_type = pay_type;
                updateData.pay_percentage = pay_type === 'Partial' ? (pay_percentage || 50) : (pay_type === 'Paid' ? 100 : 0);
            }
        }

        await trx('leave_request')
            .where({ lr_id: id })
            .update(updateData);

        // ── Auto-update leave balance ──────────────────────────────────────
        const leaveDays = Number(request.total_days) || 0;
        const leaveYear = new Date(request.start_date).getFullYear();

        if (leaveDays > 0) {
            let resolvedRuleId = request.rule_id;

            // If rule_id is 0/null, try to infer from the user's single balance row for that year
            if (!resolvedRuleId) {
                const userBalances = await trx('leave_balances')
                    .where({ user_id: request.user_id, year: leaveYear });
                if (userBalances.length === 1) {
                    // Only one rule assigned - safe to assume this is the right one
                    resolvedRuleId = userBalances[0].rule_id;
                    // Backfill rule_id on the leave_request for future ops
                    await trx('leave_request')
                        .where({ lr_id: id })
                        .update({ rule_id: resolvedRuleId });
                }
            }

            if (resolvedRuleId) {
                const balance = await trx('leave_balances')
                    .where({ user_id: request.user_id, rule_id: resolvedRuleId, year: leaveYear })
                    .forUpdate()
                    .first();

                if (lowerStatus === 'approved' && previousStatus !== 'approved') {
                    if (balance) {
                        await trx('leave_balances')
                            .where({ lb_id: balance.lb_id })
                            .update({ used: Number(balance.used) + leaveDays, updated_at: trx.fn.now() });
                    } else {
                        const ruleRecord = await trx('leave_policies_rules').where({ rule_id: resolvedRuleId }).first();
                        const defaultAlloc = ruleRecord ? Number(ruleRecord.max_balance) : 0;
                        await trx('leave_balances').insert({
                            user_id: request.user_id,
                            rule_id: resolvedRuleId,
                            year: leaveYear,
                            allocated: defaultAlloc,
                            used: leaveDays,
                            carried_forward: 0,
                            updated_at: trx.fn.now()
                        });
                    }
                } else if (lowerStatus === 'rejected' && previousStatus === 'approved') {
                    if (balance) {
                        const newUsed = Math.max(0, Number(balance.used) - leaveDays);
                        await trx('leave_balances')
                            .where({ lb_id: balance.lb_id })
                            .update({ used: newUsed, updated_at: trx.fn.now() });
                    }
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────
    });

    const updatedRequest = await attendanceDB('leave_request as lr')
        .join('core_users as u', 'lr.user_id', 'u.user_id')
        .leftJoin('core_users as reviewer', 'lr.reviewed_by', 'reviewer.user_id')
        .select('lr.*', 'u.user_name', 'reviewer.user_name as reviewer_name')
        .where({ 'lr.lr_id': id })
        .first();

    if (updatedRequest) {
        updatedRequest.audit_trail = formatLeaveAuditTrail(updatedRequest);

        if (statusChanged) {
            PayrollCalculationService.triggerLeaveRecalculation(updatedRequest).catch(err => {
                console.error("Failed to trigger background payroll recalculation for leave review:", err);
            });
        }
    }

    return updatedRequest;
}

/* ==========================================================================
   Leave Balance Services
   ========================================================================== */

export async function getMyLeaveBalance({ user_id, org_id, year }) {
    const targetYear = year || new Date().getFullYear();

    const balances = await baseBalanceQuery()
        .select(
            'lb.*',
            'lpr.name as leave_type',
            'lpr.code',
            'lpr.is_paid',
            'lpr.carry_forward',
            'lpr.carry_forward_max',
            'lpr.accural_type',
            'lpr.accural_amount',
            'lpr.max_balance',
            'lpr.requires_doc',
            'lpr.encashable',
            'lp.name as policy_name'
        )
        .where({ 'lb.user_id': user_id, 'lb.year': targetYear })
        .orderBy('lpr.name', 'asc');

    return balances.map(calculateBalance);
}

export async function getEmployeeLeaveBalance({ org_id, user_id, year }) {
    const targetYear = year || new Date().getFullYear();

    const balances = await baseBalanceQuery()
        .join('core_users as u', 'lb.user_id', 'u.user_id')
        .select(
            'lb.*',
            'lpr.name as leave_type',
            'lpr.code',
            'lpr.is_paid',
            'lpr.carry_forward',
            'lpr.carry_forward_max',
            'lpr.accural_type',
            'lpr.accural_amount',
            'lpr.max_balance',
            'lpr.requires_doc',
            'lpr.encashable',
            'lp.name as policy_name',
            'u.user_name',
            'u.profile_image_url'
        )
        .where({ 'u.org_id': org_id, 'lb.user_id': user_id, 'lb.year': targetYear })
        .orderBy('lpr.name', 'asc');

    return balances.map(calculateBalance);
}

export async function getAllEmployeesLeaveBalances({ org_id, year, rule_id, include_inactive }) {
    const targetYear = year || new Date().getFullYear();

    let query = baseBalanceQuery()
        .join('core_users as u', 'lb.user_id', 'u.user_id')
        .select(
            'lb.*',
            'lpr.name as leave_type',
            'lpr.code',
            'lpr.is_paid',
            'lp.name as policy_name',
            'u.user_name',
            'u.profile_image_url',
            'u.user_type',
            'u.is_active',
            'u.is_deleted'
        )
        .where({ 'u.org_id': org_id, 'lb.year': targetYear });

    if (!include_inactive || include_inactive === 'false') {
        query = applyActiveUserFilter(query, 'u');
    }

    if (rule_id) {
        query = query.where('lb.rule_id', rule_id);
    }

    const balances = await query.orderBy(['u.user_name', 'lpr.name']);
    return balances.map(calculateBalance);
}

export async function setLeaveBalance({ org_id, user_id, rule_id, year, allocated, carried_forward }) {
    const targetYear = year || new Date().getFullYear();

    // Validate rule belongs to this org's policy
    const rule = await attendanceDB('leave_policies_rules as lpr')
        .join('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
        .where({ 'lpr.rule_id': rule_id, 'lp.org_id': org_id })
        .first();

    if (!rule) {
        throw { status: 404, message: "Leave rule not found in your organization's policies" };
    }

    // Validate user belongs to org
    const user = await attendanceDB('core_users').where({ user_id, org_id }).first();
    if (!user) {
        throw { status: 404, message: "User not found in this organization" };
    }

    const existing = await attendanceDB('leave_balances')
        .where({ user_id, rule_id, year: targetYear })
        .first();

    if (existing) {
        // Update existing record
        await attendanceDB('leave_balances')
            .where({ lb_id: existing.lb_id })
            .update({
                allocated: allocated !== undefined ? allocated : existing.allocated,
                carried_forward: carried_forward !== undefined ? carried_forward : existing.carried_forward,
                updated_at: attendanceDB.fn.now()
            });
        return { ...existing, allocated: allocated ?? existing.allocated, carried_forward: carried_forward ?? existing.carried_forward };
    } else {
        // Create new balance record
        const [lb_id] = await attendanceDB('leave_balances').insert({
            user_id,
            rule_id,
            year: targetYear,
            allocated: allocated || 0,
            used: 0,
            carried_forward: carried_forward || 0,
            updated_at: attendanceDB.fn.now()
        });
        return { lb_id, user_id, org_id, rule_id, year: targetYear, allocated: allocated || 0, used: 0, carried_forward: carried_forward || 0 };
    }
}

// leave_balances has no org_id; a balance belongs to the org of its employee
async function getOrgLeaveBalance({ org_id, lb_id }) {
    return attendanceDB('leave_balances as lb')
        .join('core_users as u', 'u.user_id', 'lb.user_id')
        .where({ 'lb.lb_id': lb_id, 'u.org_id': org_id })
        .first('lb.*');
}

export async function updateLeaveBalance({ org_id, lb_id, allocated, carried_forward, used }) {
    const balance = await getOrgLeaveBalance({ org_id, lb_id });

    if (!balance) {
        throw { status: 404, message: "Leave balance record not found" };
    }

    if (used !== undefined && Number(used) < 0) {
        throw { status: 400, message: "Used days cannot be negative" };
    }

    const updateData = {};
    if (allocated !== undefined) updateData.allocated = allocated;
    if (carried_forward !== undefined) updateData.carried_forward = carried_forward;
    if (used !== undefined) updateData.used = used;
    updateData.updated_at = attendanceDB.fn.now();

    await attendanceDB('leave_balances').where({ lb_id }).update(updateData);

    // Return the saved row: updateData holds a knex fn.now() object, which
    // cannot be serialized to JSON (the response used to fail with a 500
    // even though the update succeeded).
    return getOrgLeaveBalance({ org_id, lb_id });
}

export async function deleteLeaveBalance({ org_id, lb_id }) {
    const balance = await getOrgLeaveBalance({ org_id, lb_id });

    if (!balance) {
        throw { status: 404, message: "Leave balance record not found" };
    }

    await attendanceDB('leave_balances').where({ lb_id }).del();
    return { ok: true, message: "Leave balance record deleted successfully" };
}

/* ==========================================================================
   Leave Policy CRUD Services
   ========================================================================== */

export async function createLeavePolicy({ org_id, name, description }) {
    if (!name) {
        throw { status: 400, message: "Policy name is required" };
    }

    const existing = await attendanceDB('leave_policies')
        .where({ org_id, name })
        .first();

    if (existing) {
        throw { status: 400, message: "A policy with this name already exists in this organization" };
    }

    const [lp_id] = await attendanceDB('leave_policies').insert({
        org_id,
        name,
        description,
        is_active: 1,
        created_at: attendanceDB.fn.now()
    });

    return { lp_id, org_id, name, description, is_active: 1 };
}

export async function getLeavePolicies({ org_id }) {
    const policies = await attendanceDB('leave_policies')
        .where({ org_id })
        .orderBy('created_at', 'desc');

    return attachRulesToPolicies(policies);
}

export async function getMyLeavePolicies({ user_id, org_id }) {
    // Find all unique lp_ids assigned to this user through leave_balances
    const assignedPolicies = await attendanceDB('leave_balances as lb')
        .join('leave_policies_rules as lpr', 'lb.rule_id', 'lpr.rule_id')
        .join('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
        .where({ 'lb.user_id': user_id })
        .select('lp.lp_id')
        .distinct();

    let lpIds = assignedPolicies.map(p => p.lp_id);

    // Fallback: if user has no leave balances yet, return all active org policies
    if (lpIds.length === 0) {
        const fallbackPolicies = await attendanceDB('leave_policies')
            .where({ org_id, is_active: 1 })
            .select('lp_id');
        lpIds = fallbackPolicies.map(p => p.lp_id);
        if (lpIds.length === 0) return [];
    }

    // Now fetch the details for these policies
    const policies = await attendanceDB('leave_policies')
        .whereIn('lp_id', lpIds)
        .andWhere({ is_active: 1 });

    return attachRulesToPolicies(policies, true);
}


export async function getLeavePolicyById({ org_id, lp_id }) {
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found" };
    }

    const rules = await attendanceDB('leave_policies_rules')
        .where({ lp_id })
        .orderBy('name', 'asc');

    return {
        ...policy,
        rules
    };
}

export async function updateLeavePolicy({ org_id, lp_id, name, description, is_active }) {
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found" };
    }

    if (name && name !== policy.name) {
        const existingName = await attendanceDB('leave_policies')
            .where({ org_id, name })
            .whereNot({ lp_id })
            .first();
        if (existingName) {
            throw { status: 400, message: "Another policy with this name already exists" };
        }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active ? 1 : 0;

    if (Object.keys(updateData).length > 0) {
        await attendanceDB('leave_policies')
            .where({ lp_id })
            .update(updateData);
    }

    return {
        ...policy,
        ...updateData
    };
}

export async function deleteLeavePolicy({ org_id, lp_id }) {
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found" };
    }

    // Get rules of this policy
    const rules = await attendanceDB('leave_policies_rules')
        .where({ lp_id })
        .select('rule_id');

    const ruleIds = rules.map(r => r.rule_id);

    if (ruleIds.length > 0) {
        if (await areRulesReferenced(ruleIds)) {
            throw {
                status: 400,
                message: "Cannot delete policy. One or more rules under this policy are referenced by existing leave requests or user balances. Consider setting is_active to 0 instead."
            };
        }

        // Delete policy rules first
        await attendanceDB('leave_policies_rules')
            .whereIn('rule_id', ruleIds)
            .del();
    }

    // Delete the policy
    await attendanceDB('leave_policies')
        .where({ lp_id })
        .del();

    return { ok: true, message: "Policy deleted successfully" };
}

/* ==========================================================================
   Leave Policy Rule CRUD Services
   ========================================================================== */

export async function createLeavePolicyRule({ org_id, lp_id, ruleData }) {
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found" };
    }

    const {
        name,
        code,
        accural_type,
        accural_amount,
        max_balance,
        carry_forward,
        carry_forward_max,
        encashable,
        is_paid,
        requires_doc
    } = ruleData;

    if (!name || !code || !accural_type) {
        throw { status: 400, message: "Name, code, and accural_type are required" };
    }

    // Uniqueness checks within policy
    const existing = await attendanceDB('leave_policies_rules')
        .where({ lp_id })
        .where(builder => builder.where({ name }).orWhere({ code }))
        .first();

    if (existing) {
        throw { status: 400, message: "A rule with the same name or code already exists in this policy" };
    }

    const [rule_id] = await attendanceDB('leave_policies_rules').insert({
        lp_id,
        name,
        code: code.toUpperCase(),
        accural_type,
        accural_amount: accural_amount || 0,
        max_balance: max_balance || 0,
        carry_forward: carry_forward ? 1 : 0,
        carry_forward_max: carry_forward_max || 0,
        encashable: encashable ? 1 : 0,
        is_paid: is_paid !== undefined ? (is_paid ? 1 : 0) : 1,
        requires_doc: requires_doc ? 1 : 0,
        is_active: 1,
        created_at: attendanceDB.fn.now()
    });

    return { rule_id, lp_id, name, code: code.toUpperCase(), ...ruleData, is_active: 1 };
}

export async function updateLeavePolicyRule({ org_id, lp_id, rule_id, ruleData }) {
    // Verify policy ownership
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found or does not belong to your organization" };
    }

    const rule = await attendanceDB('leave_policies_rules')
        .where({ rule_id, lp_id })
        .first();

    if (!rule) {
        throw { status: 404, message: "Policy rule not found" };
    }

    const {
        name,
        code,
        accural_type,
        accural_amount,
        max_balance,
        carry_forward,
        carry_forward_max,
        encashable,
        is_paid,
        requires_doc,
        is_active
    } = ruleData;

    // Check name/code uniqueness if they are changing
    if (name && name !== rule.name) {
        const existingName = await attendanceDB('leave_policies_rules')
            .where({ lp_id, name })
            .whereNot({ rule_id })
            .first();
        if (existingName) {
            throw { status: 400, message: "Another rule with this name already exists in this policy" };
        }
    }

    if (code && code.toUpperCase() !== rule.code) {
        const existingCode = await attendanceDB('leave_policies_rules')
            .where({ lp_id, code: code.toUpperCase() })
            .whereNot({ rule_id })
            .first();
        if (existingCode) {
            throw { status: 400, message: "Another rule with this code already exists in this policy" };
        }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (accural_type !== undefined) updateData.accural_type = accural_type;
    if (accural_amount !== undefined) updateData.accural_amount = accural_amount;
    if (max_balance !== undefined) updateData.max_balance = max_balance;
    if (carry_forward !== undefined) updateData.carry_forward = carry_forward ? 1 : 0;
    if (carry_forward_max !== undefined) updateData.carry_forward_max = carry_forward_max;
    if (encashable !== undefined) updateData.encashable = encashable ? 1 : 0;
    if (is_paid !== undefined) updateData.is_paid = is_paid ? 1 : 0;
    if (requires_doc !== undefined) updateData.requires_doc = requires_doc ? 1 : 0;
    if (is_active !== undefined) updateData.is_active = is_active ? 1 : 0;

    if (Object.keys(updateData).length > 0) {
        await attendanceDB('leave_policies_rules')
            .where({ rule_id })
            .update(updateData);
    }

    return {
        ...rule,
        ...updateData
    };
}

export async function deleteLeavePolicyRule({ org_id, lp_id, rule_id }) {
    // Verify policy ownership
    const policy = await attendanceDB('leave_policies')
        .where({ org_id, lp_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found or does not belong to your organization" };
    }

    const rule = await attendanceDB('leave_policies_rules')
        .where({ rule_id, lp_id })
        .first();

    if (!rule) {
        throw { status: 404, message: "Policy rule not found" };
    }

    if (await areRulesReferenced([rule_id])) {
        throw {
            status: 400,
            message: "Cannot delete rule. It is currently referenced by existing leave requests or user balances. Consider setting is_active to 0 instead."
        };
    }

    await attendanceDB('leave_policies_rules')
        .where({ rule_id })
        .del();

    return { ok: true, message: "Rule deleted successfully" };
}

export async function assignPolicyToEmployees({ org_id, lp_id, user_ids, year }) {
    const targetYear = year || new Date().getFullYear();

    // Verify policy exists and belongs to organization
    const policy = await attendanceDB('leave_policies')
        .where({ lp_id, org_id })
        .first();

    if (!policy) {
        throw { status: 404, message: "Leave policy not found" };
    }

    // Get all active rules for this policy
    const rules = await attendanceDB('leave_policies_rules')
        .where({ lp_id, is_active: 1 });

    if (rules.length === 0) {
        throw { status: 400, message: "This policy has no active rules to assign" };
    }

    // Verify users belong to org
    const users = await attendanceDB('core_users')
        .where({ org_id, is_deleted: 0 })
        .whereIn('user_id', user_ids);

    const validUserIds = users.map(u => u.user_id);
    if (validUserIds.length === 0) {
        throw { status: 400, message: "No valid employees selected" };
    }

    const results = [];

    // Assign rules to each user
    for (const userId of validUserIds) {
        const userResults = [];
        for (const rule of rules) {
            const existing = await attendanceDB('leave_balances')
                .where({ user_id: userId, org_id, rule_id: rule.rule_id, year: targetYear })
                .first();

            if (existing) {
                // Update allocation to policy default max_balance
                await attendanceDB('leave_balances')
                    .where({ lb_id: existing.lb_id })
                    .update({
                        allocated: rule.max_balance,
                        updated_at: attendanceDB.fn.now()
                    });
                userResults.push({
                    lb_id: existing.lb_id,
                    user_id: userId,
                    rule_id: rule.rule_id,
                    allocated: rule.max_balance,
                    status: 'updated'
                });
            } else {
                // Create new balance
                const [lb_id] = await attendanceDB('leave_balances').insert({
                    user_id: userId,
                    org_id,
                    rule_id: rule.rule_id,
                    year: targetYear,
                    allocated: rule.max_balance,
                    used: 0,
                    carried_forward: 0,
                    updated_at: attendanceDB.fn.now()
                });
                userResults.push({
                    lb_id,
                    user_id: userId,
                    rule_id: rule.rule_id,
                    allocated: rule.max_balance,
                    status: 'created'
                });
            }
        }
        results.push({ user_id: userId, rules: userResults });
    }

    return { ok: true, results };
}

/**
 * Fetch approved leave requests within a date range for an organization or target user
 */
export async function getApprovedLeaves({ org_id, startDate, endDate, targetUserId }) {
    const query = attendanceDB("leave_request as lr")
        .join("core_users as u", "lr.user_id", "u.user_id")
        .leftJoin("leave_policies_rules as lpr", "lr.rule_id", "lpr.rule_id")
        .select(
            "lr.lr_id",
            "lr.user_id",
            "lr.start_date",
            "lr.end_date",
            "lr.total_days",
            "lr.status",
            "lr.pay_percentage",
            "lr.pay_type",
            "lr.reason",
            attendanceDB.raw('COALESCE(lpr.name, lr.leave_type, "Leave") as leave_type')
        )
        .where("u.org_id", org_id)
        .whereRaw("LOWER(lr.status) = 'approved'")
        .whereRaw("DATE(lr.start_date) <= ?", [endDate])
        .whereRaw("DATE(lr.end_date) >= ?", [startDate]);

    if (targetUserId) {
        query.where("lr.user_id", targetUserId);
    }
    return query;
}

/**
 * Check if a date falls within a user's approved leave range
 */
export const isDateInApprovedLeave = (userLeaves, dateStr) => {
    if (!userLeaves || userLeaves.length === 0) return null;
    return userLeaves.find(l => {
        const s = typeof l.start_date === 'string' ? l.start_date.slice(0, 10) : new Date(l.start_date).toISOString().slice(0, 10);
        const e = typeof l.end_date === 'string' ? l.end_date.slice(0, 10) : new Date(l.end_date).toISOString().slice(0, 10);
        return dateStr >= s && dateStr <= e;
    });
};

/**
 * Check if a specific user is on approved leave on a given date (YYYY-MM-DD)
 */
export async function getUserApprovedLeaveOnDate({ user_id, date }) {
    const sanitizedDate = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
    return attendanceDB("leave_request as lr")
        .leftJoin("leave_policies_rules as lpr", "lr.rule_id", "lpr.rule_id")
        .select("lr.*", attendanceDB.raw('COALESCE(lpr.name, lr.leave_type, "Leave") as leave_type'))
        .where("lr.user_id", user_id)
        .whereRaw("LOWER(lr.status) = 'approved'")
        .where("lr.start_date", "<=", sanitizedDate)
        .where("lr.end_date", ">=", sanitizedDate)
        .first()
        .catch(() => null);
}
