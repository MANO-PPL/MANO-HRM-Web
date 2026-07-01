import catchAsync from '../../utils/catchAsync.js';
import * as LeaveService from '../../services/leaves/leaveService.js';

// Leave Policies Controller
export const createLeavePolicy = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { name, description } = req.body;

    try {
        const policy = await LeaveService.createLeavePolicy({ org_id, name, description });
        res.status(201).json({ ok: true, message: "Leave policy created successfully", policy });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const getLeavePolicies = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const policies = await LeaveService.getLeavePolicies({ org_id });
    res.json({ ok: true, policies });
});

export const getLeavePolicyById = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id } = req.params;

    try {
        const policy = await LeaveService.getLeavePolicyById({ org_id, lp_id: Number(lp_id) });
        res.json({ ok: true, policy });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const updateLeavePolicy = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id } = req.params;
    const { name, description, is_active } = req.body;

    try {
        const policy = await LeaveService.updateLeavePolicy({
            org_id,
            lp_id: Number(lp_id),
            name,
            description,
            is_active
        });
        res.json({ ok: true, message: "Leave policy updated successfully", policy });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const deleteLeavePolicy = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id } = req.params;

    try {
        const result = await LeaveService.deleteLeavePolicy({ org_id, lp_id: Number(lp_id) });
        res.json({ ok: true, message: result.message });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

// Leave Policy Rules Controller
export const createLeavePolicyRule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id } = req.params;
    const ruleData = req.body;

    try {
        const rule = await LeaveService.createLeavePolicyRule({
            org_id,
            lp_id: Number(lp_id),
            ruleData
        });
        res.status(201).json({ ok: true, message: "Policy rule created successfully", rule });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const updateLeavePolicyRule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id, rule_id } = req.params;
    const ruleData = req.body;

    try {
        const rule = await LeaveService.updateLeavePolicyRule({
            org_id,
            lp_id: Number(lp_id),
            rule_id: Number(rule_id),
            ruleData
        });
        res.json({ ok: true, message: "Policy rule updated successfully", rule });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const deleteLeavePolicyRule = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id, rule_id } = req.params;

    try {
        const result = await LeaveService.deleteLeavePolicyRule({
            org_id,
            lp_id: Number(lp_id),
            rule_id: Number(rule_id)
        });
        res.json({ ok: true, message: result.message });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const assignPolicyToEmployees = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lp_id } = req.params;
    const { user_ids, year } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ ok: false, message: "user_ids must be a non-empty array" });
    }

    try {
        const result = await LeaveService.assignPolicyToEmployees({
            org_id,
            lp_id: Number(lp_id),
            user_ids: user_ids.map(Number),
            year: year ? Number(year) : undefined
        });
        res.json({ ok: true, message: "Policy assigned successfully", result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});
