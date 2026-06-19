import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

// Helper to get start and end dates of a month, and number of days
const getMonthDetails = (dateStr) => {
    const date = dateStr ? new Date(dateStr) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const totalDays = endOfMonth.getDate();

    // Calculate elapsed days in the current month (up to today)
    const today = new Date();
    let elapsedDays = totalDays;
    if (today.getFullYear() === year && today.getMonth() === month) {
        elapsedDays = today.getDate();
    }

    // Format helpers
    const formatDate = (d) => d.toISOString().split('T')[0];

    return {
        start: formatDate(startOfMonth),
        end: formatDate(endOfMonth),
        totalDays,
        elapsedDays,
        year,
        month: month + 1
    };
};

// ==========================================
// 1. SITE CONTROLLERS
// ==========================================

export const getAllSites = catchAsync(async (req, res) => {
    const sites = await attendanceDB('labour_sites')
        .select('*')
        .orderBy('created_at', 'desc');

    res.json({
        success: true,
        sites
    });
});

export const createSite = catchAsync(async (req, res) => {
    const { site_name, location_details } = req.body;
    if (!site_name) {
        throw new AppError('Site name is required', 400);
    }

    const [site_id] = await attendanceDB('labour_sites').insert({
        site_name,
        location_details,
        status: 'Active'
    });

    res.status(201).json({
        success: true,
        message: 'Site created successfully',
        site_id
    });
});

export const updateSite = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { site_name, location_details, status } = req.body;

    const affected = await attendanceDB('labour_sites')
        .where('site_id', id)
        .update({
            site_name,
            location_details,
            status,
            updated_at: attendanceDB.fn.now()
        });

    if (affected === 0) {
        throw new AppError('Site not found', 404);
    }

    res.json({
        success: true,
        message: 'Site updated successfully'
    });
});

export const deleteSite = catchAsync(async (req, res) => {
    const { id } = req.params;

    // Hard delete or status archive
    const affected = await attendanceDB('labour_sites')
        .where('site_id', id)
        .del();

    if (affected === 0) {
        throw new AppError('Site not found', 404);
    }

    res.json({
        success: true,
        message: 'Site deleted successfully'
    });
});

// ==========================================
// 2. LABOUR CRUD CONTROLLERS
// ==========================================

export const getAllLabours = catchAsync(async (req, res) => {
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_sites as s', 'l.site_id', 's.site_id')
        .select('l.*', 's.site_name')
        .orderBy('l.name', 'asc');

    res.json({
        success: true,
        labours
    });
});

export const createLabour = catchAsync(async (req, res) => {
    const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id } = req.body;

    if (!name || !role || monthly_salary === undefined) {
        throw new AppError('Name, role and monthly salary are required', 400);
    }

    const [labour_id] = await attendanceDB('labours').insert({
        name,
        phone,
        sex,
        role,
        wage_type: wage_type || 'Daily Wage',
        monthly_salary: Number(monthly_salary),
        allowed_leaves: Number(allowed_leaves) || 0,
        site_id: site_id || null,
        status: 'Active'
    });

    res.status(201).json({
        success: true,
        message: 'Labour profile created successfully',
        labour_id
    });
});

export const updateLabour = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id, status } = req.body;

    const affected = await attendanceDB('labours')
        .where('labour_id', id)
        .update({
            name,
            phone,
            sex,
            role,
            wage_type,
            monthly_salary: monthly_salary !== undefined ? Number(monthly_salary) : undefined,
            allowed_leaves: allowed_leaves !== undefined ? Number(allowed_leaves) : undefined,
            site_id: site_id || null,
            status,
            updated_at: attendanceDB.fn.now()
        });

    if (affected === 0) {
        throw new AppError('Labour not found', 404);
    }

    res.json({
        success: true,
        message: 'Labour updated successfully'
    });
});

export const deleteLabour = catchAsync(async (req, res) => {
    const { id } = req.params;

    const affected = await attendanceDB('labours')
        .where('labour_id', id)
        .del();

    if (affected === 0) {
        throw new AppError('Labour not found', 404);
    }

    res.json({
        success: true,
        message: 'Labour deleted successfully'
    });
});

// ==========================================
// 3. ATTENDANCE CONTROLLERS
// ==========================================

export const getSiteAttendance = catchAsync(async (req, res) => {
    const { site_id, date } = req.query;

    if (!site_id || !date) {
        throw new AppError('site_id and date parameters are required', 400);
    }

    // Get all active labours permanently assigned to this site
    const labours = await attendanceDB('labours')
        .where({ site_id, status: 'Active' })
        .select('labour_id', 'name', 'role', 'wage_type');

    // Get attendance marked for any labours on this date at this site
    const attendanceRecords = await attendanceDB('labour_attendance')
        .where({ site_id, date })
        .select('labour_id', 'status', 'attendance_id');

    const attendanceMap = {};
    attendanceRecords.forEach(rec => {
        attendanceMap[rec.labour_id] = rec.status;
    });

    const permanentIds = new Set(labours.map(l => l.labour_id));
    const borrowedLabourIds = attendanceRecords
        .map(rec => rec.labour_id)
        .filter(id => !permanentIds.has(id));

    let borrowedLabours = [];
    if (borrowedLabourIds.length > 0) {
        borrowedLabours = await attendanceDB('labours')
            .whereIn('labour_id', borrowedLabourIds)
            .select('labour_id', 'name', 'role', 'wage_type');
    }

    const allLabours = [...labours, ...borrowedLabours];

    const roster = allLabours.map(lab => ({
        labour_id: lab.labour_id,
        name: lab.name,
        role: lab.role,
        wage_type: lab.wage_type,
        status: attendanceMap[lab.labour_id] || '', // Default to empty string (unmarked) if not marked
        is_borrowed: !permanentIds.has(lab.labour_id)
    }));

    res.json({
        success: true,
        date,
        site_id: Number(site_id),
        roster
    });
});

export const saveSiteAttendance = catchAsync(async (req, res) => {
    const { site_id, date, roster } = req.body;
    const marked_by = req.user?.user_id || null;

    if (!site_id || !date || !Array.isArray(roster)) {
        throw new AppError('site_id, date, and roster array are required', 400);
    }

    await attendanceDB.transaction(async (trx) => {
        // Extract labour IDs to clean up old records for this date
        const labourIds = roster.map(r => r.labour_id);

        if (labourIds.length > 0) {
            // Delete existing attendance records for these labours on this date
            await trx('labour_attendance')
                .where({ date })
                .whereIn('labour_id', labourIds)
                .del();

            // Insert new records
            const insertData = roster.map(r => ({
                labour_id: r.labour_id,
                site_id: Number(site_id),
                date,
                status: r.status || '',
                marked_by
            }));

            await trx('labour_attendance').insert(insertData);
        }
    });

    res.json({
        success: true,
        message: 'Attendance saved successfully'
    });
});

// ==========================================
// 4. FINANCIAL / SALARY CREDIT CONTROLLERS
// ==========================================

export const getFinancesSummary = catchAsync(async (req, res) => {
    const { date } = req.query; // optional date to select month
    const { start, end, totalDays, elapsedDays } = getMonthDetails(date);

    // 1. Get all active labours
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_sites as s', 'l.site_id', 's.site_id')
        .select('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.allowed_leaves', 's.site_name')
        .where('l.status', 'Active');

    if (labours.length === 0) {
        return res.json({
            success: true,
            summary: []
        });
    }

    const labourIds = labours.map(l => l.labour_id);

    // 2. Fetch all attendance records for these labours in the current month
    const attendanceRecords = await attendanceDB('labour_attendance')
        .where('date', '>=', start)
        .andWhere('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'status', 'date');

    // Group attendance by labour
    const attendanceMap = {};
    labourIds.forEach(id => {
        attendanceMap[id] = { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0 };
    });

    attendanceRecords.forEach(rec => {
        const counts = attendanceMap[rec.labour_id];
        if (counts) {
            if (rec.status === 'Present') counts.Present += 1;
            else if (rec.status === 'Absent') counts.Absent += 1;
            else if (rec.status === 'Half Day') counts.HalfDay += 1;
            else if (rec.status === 'Paid Leave') counts.PaidLeave += 1;
        }
    });

    // 3. Fetch advances logged for this month
    const advances = await attendanceDB('labour_advances')
        .where('date', '>=', start)
        .andWhere('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'amount');

    const advancesMap = {};
    labourIds.forEach(id => {
        advancesMap[id] = 0;
    });
    advances.forEach(adv => {
        advancesMap[adv.labour_id] += Number(adv.amount);
    });

    // 3.5 Fetch closed payouts logged for this month
    const monthKey = start.slice(0, 7);
    const payouts = await attendanceDB('labour_monthly_payouts')
        .where('month', monthKey)
        .whereIn('labour_id', labourIds)
        .select('payout_id', 'labour_id', 'status', 'paid_amount', 'payment_date', 'notes');

    const payoutsMap = {};
    payouts.forEach(p => {
        payoutsMap[p.labour_id] = p;
    });

    // 4. Compute dynamic credits
    const summary = labours.map(lab => {
        const counts = attendanceMap[lab.labour_id] || { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0 };
        const totalAdvances = advancesMap[lab.labour_id] || 0;
        const monthlySalary = Number(lab.monthly_salary);
        const dailyRate = monthlySalary / totalDays;

        let accruedCredit = 0;

        if (lab.wage_type === 'Daily Wage') {
            // Paid strictly for present days (Half Day counts as 0.5)
            const creditDays = counts.Present + (0.5 * counts.HalfDay);
            accruedCredit = creditDays * dailyRate;
        } else {
            // Fixed Salary Mode:
            // Deductions made only for unpaid absent days (Absent + 0.5 * Half Day)
            // Paid Leave is supervisor approved and paid (no deduction)
            const absentDaysCount = counts.Absent + (0.5 * counts.HalfDay);
            const paidDays = Math.max(0, elapsedDays - absentDaysCount);
            accruedCredit = paidDays * dailyRate;
        }

        // Round to nearest integer for clean display
        accruedCredit = Math.round(accruedCredit);
        const netPayable = accruedCredit - totalAdvances;

        return {
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role,
            site_name: lab.site_name || 'Unassigned',
            wage_type: lab.wage_type,
            monthly_salary: monthlySalary,
            allowed_leaves: lab.allowed_leaves,
            attendance: {
                present: counts.Present,
                absent: counts.Absent,
                half_day: counts.HalfDay,
                paid_leave: counts.PaidLeave
            },
            accrued_credit: accruedCredit,
            advances_taken: totalAdvances,
            net_payable: netPayable,
            payout: payoutsMap[lab.labour_id] || null
        };
    });

    res.json({
        success: true,
        monthDetails: { start, end, totalDays, elapsedDays },
        summary
    });
});

export const logLabourAdvance = catchAsync(async (req, res) => {
    const { labour_id, amount, date, notes } = req.body;

    if (!labour_id || !amount || !date) {
        throw new AppError('labour_id, amount, and date are required', 400);
    }

    const [advance_id] = await attendanceDB('labour_advances').insert({
        labour_id,
        amount: Number(amount),
        date,
        notes: notes || null
    });

    res.status(201).json({
        success: true,
        message: 'Advance payment logged successfully',
        advance_id
    });
});

export const getMonthlyGridAttendance = catchAsync(async (req, res) => {
    const { site_id, month, show_all_sites } = req.query; // month is format YYYY-MM
    if (!site_id || !month) {
        throw new AppError('site_id and month are required', 400);
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIdx = Number(monthStr) - 1;

    const startOfMonth = new Date(year, monthIdx, 1);
    const endOfMonth = new Date(year, monthIdx + 1, 0);
    const totalDays = endOfMonth.getDate();

    const formatDate = (d) => d.toISOString().split('T')[0];
    const start = formatDate(startOfMonth);
    const end = formatDate(endOfMonth);

    let labours = [];
    if (site_id === 'All') {
        // Fetch all active labours
        labours = await attendanceDB('labours')
            .where('status', 'Active')
            .select('labour_id', 'name', 'role');
    } else {
        // Fetch active labours who either belong to the site OR have attendance records logged on this site this month
        labours = await attendanceDB('labours as l')
            .where(function() {
                this.where('l.site_id', site_id)
                    .orWhereIn('l.labour_id', function() {
                        this.select('labour_id')
                            .from('labour_attendance')
                            .where('site_id', site_id)
                            .where('date', '>=', start)
                            .where('date', '<=', end);
                    });
            })
            .andWhere('l.status', 'Active')
            .select('l.labour_id', 'l.name', 'l.role');
    }

    const labourIds = labours.map(l => l.labour_id);

    let attendanceRecords = [];
    if (labourIds.length > 0) {
        const query = attendanceDB('labour_attendance as la')
            .leftJoin('labour_sites as ls', 'la.site_id', 'ls.site_id')
            .where('la.date', '>=', start)
            .where('la.date', '<=', end)
            .whereIn('la.labour_id', labourIds);

        // If not showing all sites (and not in 'All' view), filter strictly by the selected site
        if (site_id !== 'All' && show_all_sites !== 'true') {
            query.where('la.site_id', site_id);
        }

        attendanceRecords = await query.select(
            'la.labour_id',
            'la.status',
            'la.date',
            'la.site_id',
            'ls.site_name'
        );
    }

    // Group records by labour_id and date
    const attendanceMap = {};
    labourIds.forEach(id => {
        attendanceMap[id] = {};
    });

    attendanceRecords.forEach(rec => {
        const dateStr = new Date(rec.date).toISOString().split('T')[0];
        if (attendanceMap[rec.labour_id]) {
            attendanceMap[rec.labour_id][dateStr] = {
                status: rec.status,
                site_id: rec.site_id,
                site_name: rec.site_name || 'Floating Pool / Unassigned'
            };
        }
    });

    const grid = labours.map(l => ({
        labour_id: l.labour_id,
        name: l.name,
        role: l.role,
        attendance: attendanceMap[l.labour_id]
    }));

    res.json({
        success: true,
        monthDetails: {
            month,
            totalDays,
            year,
            monthNum: monthIdx + 1
        },
        grid
    });
});

export const bulkTransferLabours = catchAsync(async (req, res) => {
    const { source_site_id, destination_site_id, labour_ids } = req.body;

    if (!Array.isArray(labour_ids) || labour_ids.length === 0) {
        throw new AppError('labour_ids array is required', 400);
    }

    const targetSiteId = destination_site_id ? Number(destination_site_id) : null;

    await attendanceDB('labours')
        .whereIn('labour_id', labour_ids)
        .update({
            site_id: targetSiteId,
            updated_at: attendanceDB.fn.now()
        });

    res.json({
        success: true,
        message: `Successfully transferred ${labour_ids.length} workers.`
    });
});

export const getLabourWorkHistory = catchAsync(async (req, res) => {
    const { id } = req.params;

    const labour = await attendanceDB('labours')
        .where('labour_id', id)
        .first();

    if (!labour) {
        throw new AppError('Labour worker not found', 404);
    }

    const history = await attendanceDB('labour_attendance as a')
        .leftJoin('labour_sites as s', 'a.site_id', 's.site_id')
        .where('a.labour_id', id)
        .select(
            'a.site_id',
            's.site_name',
            attendanceDB.raw('MIN(a.date) as first_date'),
            attendanceDB.raw('MAX(a.date) as last_date'),
            attendanceDB.raw('COUNT(CASE WHEN a.status = "Present" THEN 1 END) as present_days'),
            attendanceDB.raw('COUNT(CASE WHEN a.status = "Half Day" THEN 1 END) as half_day_days'),
            attendanceDB.raw('COUNT(CASE WHEN a.status = "Absent" THEN 1 END) as absent_days'),
            attendanceDB.raw('COUNT(CASE WHEN a.status = "Paid Leave" THEN 1 END) as paid_leave_days'),
            attendanceDB.raw('COUNT(*) as total_days')
        )
        .groupBy('a.site_id', 's.site_name')
        .orderBy('last_date', 'desc');

    const payouts = await attendanceDB('labour_monthly_payouts')
        .where('labour_id', id)
        .orderBy('month', 'desc');

    res.json({
        success: true,
        labour: {
            labour_id: labour.labour_id,
            name: labour.name,
            role: labour.role,
            status: labour.status
        },
        history,
        payouts
    });
});

export const logLabourPayout = catchAsync(async (req, res) => {
    const {
        labour_id, month, wage_type, monthly_salary,
        present_days, half_days, absent_days, paid_leaves,
        accrued_credit, advances_taken, net_payable, paid_amount,
        status, payment_date, notes
    } = req.body;

    if (!labour_id || !month || !wage_type || monthly_salary === undefined || accrued_credit === undefined || net_payable === undefined || !payment_date) {
        throw new AppError('labour_id, month, wage_type, monthly_salary, accrued_credit, net_payable, and payment_date are required', 400);
    }

    const existing = await attendanceDB('labour_monthly_payouts')
        .where('labour_id', labour_id)
        .andWhere('month', month)
        .first();

    const recordData = {
        labour_id,
        month,
        wage_type,
        monthly_salary: Number(monthly_salary),
        present_days: Number(present_days || 0),
        half_days: Number(half_days || 0),
        absent_days: Number(absent_days || 0),
        paid_leaves: Number(paid_leaves || 0),
        accrued_credit: Number(accrued_credit),
        advances_taken: Number(advances_taken || 0),
        net_payable: Number(net_payable),
        paid_amount: Number(paid_amount !== undefined ? paid_amount : net_payable),
        status: status || 'Paid',
        payment_date,
        notes: notes || null,
        updated_at: attendanceDB.fn.now()
    };

    if (existing) {
        await attendanceDB('labour_monthly_payouts')
            .where('payout_id', existing.payout_id)
            .update(recordData);
        
        res.json({
            success: true,
            message: 'Monthly payout updated successfully',
            payout_id: existing.payout_id
        });
    } else {
        const [payout_id] = await attendanceDB('labour_monthly_payouts').insert({
            ...recordData,
            created_at: attendanceDB.fn.now()
        });
        
        res.status(201).json({
            success: true,
            message: 'Monthly payout logged successfully',
            payout_id
        });
    }
});
