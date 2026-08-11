import { attendanceDB } from '../../config/database.js';
// S3 helper lives in the top-level services/s3 folder
import * as S3Service from '../s3/s3Service.js';

export async function getMyHistory({ user_id, org_id }) {
    const leaves = await attendanceDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name', 'u.profile_image_url')
        .where({ 'lr.user_id': user_id, 'lr.org_id': org_id })
        .orderBy('lr.applied_at', 'desc');

    const parsedLeaves = await Promise.all(leaves.map(async (leave) => {
        const atts = typeof leave.attachments === 'string' ? JSON.parse(leave.attachments) : (leave.attachments || []);
        const signedAttachments = await Promise.all((atts || []).map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            return { ...a, file_url: url };
        }));
        return {
            ...leave,
            attachments: signedAttachments
        };
    }));

    return parsedLeaves;
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

    // Resolve leave_type to rule_id
    let resolvedRuleId = 0;
    const numericRuleId = Number(leave_type);
    if (!isNaN(numericRuleId) && numericRuleId > 0) {
        resolvedRuleId = numericRuleId;
    } else if (typeof leave_type === 'string' && leave_type.trim().length > 0) {
        // Find matching rule in organization's policy rules
        const rule = await attendanceDB('leave_policies_rules as lpr')
            .join('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
            .where({ 'lp.org_id': org_id })
            .where(builder => {
                builder.where('lpr.name', 'like', leave_type.trim())
                       .orWhere('lpr.code', 'like', leave_type.trim());
            })
            .select('lpr.rule_id')
            .first();

        if (rule) {
            resolvedRuleId = rule.rule_id;
        } else {
            // Fallback heuristics (e.g. "Casual Leave" -> CL, "Sick Leave" -> SL)
            let searchCode = '';
            const typeLower = leave_type.toLowerCase();
            if (typeLower.includes('casual')) searchCode = 'CL';
            else if (typeLower.includes('sick')) searchCode = 'SL';

            if (searchCode) {
                const fallbackRule = await attendanceDB('leave_policies_rules as lpr')
                    .join('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
                    .where({ 'lp.org_id': org_id, 'lpr.code': searchCode })
                    .select('lpr.rule_id')
                    .first();
                if (fallbackRule) {
                    resolvedRuleId = fallbackRule.rule_id;
                }
            }
        }
    }

    const formatSQLDate = (d) => d.toISOString().split('T')[0];
    const sqlStart = formatSQLDate(start);
    const sqlEnd = formatSQLDate(end);

    const overlap = await attendanceDB('leave_requests')
        .where({ user_id, org_id })
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
        throw { status: 400, message: "User has an overlapping leave request." };
    }

    const [insertId] = await attendanceDB('leave_requests').insert({
        user_id,
        org_id,
        leave_type,
        start_date: sqlStart,
        end_date: sqlEnd,
        reason,
        status: 'Pending',
        applied_at: new Date()
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
                file_key: `leaves/${insertId}/${key}`,
                file_type: file.mimetype,
                _signedUrl: signedUrl
            };
        });

        const attachmentsData = await Promise.all(attachmentPromises);

        const dbAttachments = attachmentsData.map(({ _signedUrl, ...rest }) => rest);
        
        await attendanceDB('leave_request')
            .where({ lr_id: insertId })
            .update({ attachments: JSON.stringify(dbAttachments) });

        responseAttachments = attachmentsData.map(a => ({
            file_key: a.file_key,
            file_url: a._signedUrl,
            file_type: a.file_type
        }));
    }

    return { insertId, responseAttachments };
}

export async function withdrawLeaveRequest({ id, user_id, org_id }) {
    const request = await attendanceDB('leave_request').where({ lr_id: id, user_id, org_id }).first();

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
            .where({ user_id: request.user_id, org_id, rule_id: request.rule_id, year: leaveYear })
            .first();

        if (balance && leaveDays > 0) {
            const newUsed = Math.max(0, Number(balance.used) - leaveDays);
            await attendanceDB('leave_balances')
                .where({ lb_id: balance.lb_id })
                .update({ used: newUsed, updated_at: new Date() });
        }
    }

    await attendanceDB('leave_requests').where({ lr_id: id }).del();
}

export async function getPendingRequests({ org_id }) {
    const requests = await attendanceDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name', 'u.email', 'u.phone_no', 'u.profile_image_url')
        .where('lr.org_id', org_id)
        .where('lr.status', 'pending')
        .orderBy('lr.applied_at', 'asc');

    const parsedRequests = await Promise.all(requests.map(async (req) => {
        const atts = typeof req.attachments === 'string' ? JSON.parse(req.attachments) : (req.attachments || []);
        const signedAttachments = await Promise.all((atts || []).map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            return { ...a, file_url: url };
        }));
        return {
            ...req,
            attachments: signedAttachments
        };
    }));

    return parsedRequests;
}

export async function getAdminHistory({ org_id, user_id, status, start_date, end_date }) {
    let query = attendanceDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name', 'u.profile_image_url')
        .where('lr.org_id', org_id);

    if (user_id) query = query.where('lr.user_id', user_id);
    if (status) query = query.where('lr.status', status);
    if (start_date) query = query.where('lr.start_date', '>=', start_date);
    if (end_date) query = query.where('lr.end_date', '<=', end_date);

    const history = await query.orderBy('lr.applied_at', 'desc');

    const parsedHistory = await Promise.all(history.map(async (h) => {
        const atts = typeof h.attachments === 'string' ? JSON.parse(h.attachments) : (h.attachments || []);
        const signedAttachments = await Promise.all((atts || []).map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            return { ...a, file_url: url };
        }));
        return {
            ...h,
            attachments: signedAttachments
        };
    }));

    return parsedHistory;
}

export async function updateLeaveStatus({ id, org_id, status, pay_type, pay_percentage, admin_comment, reviewed_by }) {
    if (!status) {
        throw { status: 400, message: "Status is required" };
    }
    const lowerStatus = status.toLowerCase();
    if (!['approved', 'rejected'].includes(lowerStatus)) {
        throw { status: 400, message: "Invalid status" };
    }

    // Fetch the request first so we know its current state and leave details
    const request = await attendanceDB('leave_request').where({ lr_id: id, org_id }).first();
    if (!request) {
        throw { status: 404, message: "Request not found" };
    }

    const previousStatus = request.status;

    const updateData = {
        status: lowerStatus,
        admin_comment,
        reviewed_by,
        reviewed_at: new Date()
    };

    if (status === 'Approved') {
        updateData.pay_type = pay_type;
        updateData.pay_percentage = pay_type === 'Partial' ? (pay_percentage || 50) : (pay_type === 'Paid' ? 100 : 0);
    }

    const affected = await attendanceDB('leave_requests')
        .where({ lr_id: id, org_id })
        .update(updateData);

    // ── Auto-update leave balance ──────────────────────────────────────
    const leaveDays = Number(request.total_days) || 0;
    const leaveYear = new Date(request.start_date).getFullYear();

    if (leaveDays > 0) {
        let resolvedRuleId = request.rule_id;

        // If rule_id is 0/null, try to infer from the user's single balance row for that year
        if (!resolvedRuleId) {
            const userBalances = await attendanceDB('leave_balances')
                .where({ user_id: request.user_id, org_id, year: leaveYear });
            if (userBalances.length === 1) {
                // Only one rule assigned — safe to assume this is the right one
                resolvedRuleId = userBalances[0].rule_id;
                // Backfill rule_id on the leave_request for future ops
                await attendanceDB('leave_request')
                    .where({ lr_id: id })
                    .update({ rule_id: resolvedRuleId });
            }
        }

        if (resolvedRuleId) {
            const balance = await attendanceDB('leave_balances')
                .where({ user_id: request.user_id, org_id, rule_id: resolvedRuleId, year: leaveYear })
                .first();

            if (lowerStatus === 'approved' && previousStatus !== 'approved') {
                if (balance) {
                    await attendanceDB('leave_balances')
                        .where({ lb_id: balance.lb_id })
                        .update({ used: Number(balance.used) + leaveDays, updated_at: new Date() });
                } else {
                    await attendanceDB('leave_balances').insert({
                        user_id: request.user_id,
                        org_id,
                        rule_id: resolvedRuleId,
                        year: leaveYear,
                        allocated: 0,
                        used: leaveDays,
                        carried_forward: 0,
                        updated_at: new Date()
                    });
                }
            } else if (lowerStatus === 'rejected' && previousStatus === 'approved') {
                if (balance) {
                    const newUsed = Math.max(0, Number(balance.used) - leaveDays);
                    await attendanceDB('leave_balances')
                        .where({ lb_id: balance.lb_id })
                        .update({ used: newUsed, updated_at: new Date() });
                }
            }
        }
    }
    // ────────────────────────────────────────────────────────────────────

    const updatedRequest = await attendanceDB('leave_request').where({ lr_id: id }).first();

    if (updatedRequest) {
        PayrollCalculationService.triggerLeaveRecalculation(updatedRequest).catch(err => {
            console.error("Failed to trigger background payroll recalculation for leave review:", err);
        });
    }

    return updatedRequest;
}

/* ==========================================================================
   Leave Balance Services
   ========================================================================== */

export async function getMyLeaveBalance({ user_id, org_id, year }) {
    const targetYear = year || new Date().getFullYear();

    const balances = await attendanceDB('leave_balances as lb')
        .join('leave_policies_rules as lpr', 'lb.rule_id', 'lpr.rule_id')
        .leftJoin('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
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
        .where({ 'lb.user_id': user_id, 'lb.org_id': org_id, 'lb.year': targetYear })
        .orderBy('lpr.name', 'asc');

    return balances.map(b => ({
        ...b,
        available: Math.max(0, (Number(b.allocated) + Number(b.carried_forward)) - Number(b.used))
    }));
}

export async function getEmployeeLeaveBalance({ org_id, user_id, year }) {
    const targetYear = year || new Date().getFullYear();

    const balances = await attendanceDB('leave_balances as lb')
        .join('leave_policies_rules as lpr', 'lb.rule_id', 'lpr.rule_id')
        .leftJoin('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
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
        .where({ 'lb.org_id': org_id, 'lb.user_id': user_id, 'lb.year': targetYear })
        .orderBy('lpr.name', 'asc');

    return balances.map(b => ({
        ...b,
        available: Math.max(0, (Number(b.allocated) + Number(b.carried_forward)) - Number(b.used))
    }));
}

export async function getAllEmployeesLeaveBalances({ org_id, year, rule_id }) {
    const targetYear = year || new Date().getFullYear();

    let query = attendanceDB('leave_balances as lb')
        .join('leave_policies_rules as lpr', 'lb.rule_id', 'lpr.rule_id')
        .leftJoin('leave_policies as lp', 'lpr.lp_id', 'lp.lp_id')
        .join('core_users as u', 'lb.user_id', 'u.user_id')
        .select(
            'lb.*',
            'lpr.name as leave_type',
            'lpr.code',
            'lpr.is_paid',
            'lp.name as policy_name',
            'u.user_name',
            'u.profile_image_url',
            'u.user_type'
        )
        .where({ 'lb.org_id': org_id, 'lb.year': targetYear });

    if (rule_id) {
        query = query.where('lb.rule_id', rule_id);
    }

    const balances = await query.orderBy(['u.user_name', 'lpr.name']);

    return balances.map(b => ({
        ...b,
        available: Math.max(0, (Number(b.allocated) + Number(b.carried_forward)) - Number(b.used))
    }));
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
        .where({ user_id, org_id, rule_id, year: targetYear })
        .first();

    if (existing) {
        // Update existing record
        await attendanceDB('leave_balances')
            .where({ lb_id: existing.lb_id })
            .update({
                allocated: allocated !== undefined ? allocated : existing.allocated,
                carried_forward: carried_forward !== undefined ? carried_forward : existing.carried_forward,
                updated_at: new Date()
            });
        return { ...existing, allocated: allocated ?? existing.allocated, carried_forward: carried_forward ?? existing.carried_forward };
    } else {
        // Create new balance record
        const [lb_id] = await attendanceDB('leave_balances').insert({
            user_id,
            org_id,
            rule_id,
            year: targetYear,
            allocated: allocated || 0,
            used: 0,
            carried_forward: carried_forward || 0,
            updated_at: new Date()
        });
        return { lb_id, user_id, org_id, rule_id, year: targetYear, allocated: allocated || 0, used: 0, carried_forward: carried_forward || 0 };
    }
}

export async function updateLeaveBalance({ org_id, lb_id, allocated, carried_forward, used }) {
    const balance = await attendanceDB('leave_balances')
        .where({ lb_id, org_id })
        .first();

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
    updateData.updated_at = new Date();

    await attendanceDB('leave_balances').where({ lb_id }).update(updateData);

    return { ...balance, ...updateData };
}

export async function deleteLeaveBalance({ org_id, lb_id }) {
    const balance = await attendanceDB('leave_balances')
        .where({ lb_id, org_id })
        .first();

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
        created_at: new Date()
    });

    return { lp_id, org_id, name, description, is_active: 1 };
}

export async function createLeavePolicyRule({ org_id, lp_id, ruleData }) {
    // Verify policy ownership
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
        created_at: new Date()
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

    // Check if referenced in requests or balances
    const hasRequests = await attendanceDB('leave_requests')
        .where({ rule_id })
        .first();

    const hasBalances = await attendanceDB('leave_balances')
        .where({ rule_id })
        .first();

    if (hasRequests || hasBalances) {
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
                        updated_at: new Date()
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
                    updated_at: new Date()
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