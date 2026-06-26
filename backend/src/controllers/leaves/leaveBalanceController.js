import catchAsync from '../../utils/catchAsync.js';
import * as LeaveService from '../../services/leaves/leaveService.js';

// Employee: Get own leave balance
export const getMyLeaveBalance = catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;
    const { year } = req.query;

    const balances = await LeaveService.getMyLeaveBalance({ user_id, org_id, year: year ? Number(year) : null });
    res.json({ ok: true, balances });
});

// Admin: Get a specific employee's leave balance
export const getEmployeeLeaveBalance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { user_id } = req.params;
    const { year } = req.query;

    try {
        const balances = await LeaveService.getEmployeeLeaveBalance({
            org_id,
            user_id: Number(user_id),
            year: year ? Number(year) : null
        });
        res.json({ ok: true, balances });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

// Admin: Get all employees' leave balances for the org
export const getAllEmployeesLeaveBalances = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { year, rule_id } = req.query;

    const balances = await LeaveService.getAllEmployeesLeaveBalances({
        org_id,
        year: year ? Number(year) : null,
        rule_id: rule_id ? Number(rule_id) : null
    });
    res.json({ ok: true, balances });
});

// Admin: Create or update (upsert) a balance record for a user
export const setLeaveBalance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { user_id, rule_id, year, allocated, carried_forward } = req.body;

    if (!user_id || !rule_id) {
        return res.status(400).json({ ok: false, message: "user_id and rule_id are required" });
    }

    try {
        const balance = await LeaveService.setLeaveBalance({
            org_id,
            user_id: Number(user_id),
            rule_id: Number(rule_id),
            year: year ? Number(year) : null,
            allocated,
            carried_forward
        });
        res.status(201).json({ ok: true, message: "Leave balance set successfully", balance });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

// Admin: Update specific fields of an existing balance record by lb_id
export const updateLeaveBalance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lb_id } = req.params;
    const { allocated, carried_forward, used } = req.body;

    try {
        const balance = await LeaveService.updateLeaveBalance({
            org_id,
            lb_id: Number(lb_id),
            allocated,
            carried_forward,
            used
        });
        res.json({ ok: true, message: "Leave balance updated successfully", balance });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

// Admin: Delete a specific balance record by lb_id
export const deleteLeaveBalance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { lb_id } = req.params;

    try {
        const result = await LeaveService.deleteLeaveBalance({ org_id, lb_id: Number(lb_id) });
        res.json({ ok: true, message: result.message });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});
