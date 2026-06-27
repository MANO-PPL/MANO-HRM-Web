import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';

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
    const { site_name, location_details, status, end_date } = req.body;
    if (!site_name) {
        throw new AppError('Site name is required', 400);
    }

    const [site_id] = await attendanceDB('labour_sites').insert({
        site_name,
        location_details,
        status: status || 'Active',
        end_date: status === 'Completed' ? (end_date || attendanceDB.fn.now()) : null
    });

    res.status(201).json({
        success: true,
        message: 'Site created successfully',
        site_id
    });
});

export const updateSite = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { site_name, location_details, status, end_date } = req.body;

    const affected = await attendanceDB('labour_sites')
        .where('site_id', id)
        .update({
            site_name,
            location_details,
            status,
            end_date: status === 'Completed' ? (end_date || attendanceDB.fn.now()) : null,
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
        .leftJoin('labour_site_relations as r', 'l.labour_id', 'r.labour_id')
        .leftJoin('labour_sites as s', 'r.site_id', 's.site_id')
        .select(
            'l.*',
            attendanceDB.raw('GROUP_CONCAT(s.site_name SEPARATOR ", ") as site_names'),
            attendanceDB.raw('GROUP_CONCAT(s.site_id SEPARATOR ",") as site_ids')
        )
        .groupBy('l.labour_id')
        .orderBy('l.name', 'asc');

    const formattedLabours = labours.map(lab => ({
        ...lab,
        site_ids: lab.site_ids ? lab.site_ids.split(',').map(Number) : [],
        site_name: lab.site_names || 'Unassigned'
    }));

    res.json({
        success: true,
        labours: formattedLabours
    });
});

export const createLabour = catchAsync(async (req, res) => {
    const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id } = req.body;

    if (!name || !role || monthly_salary === undefined) {
        throw new AppError('Name, role and monthly salary are required', 400);
    }

    if (phone) {
        const existing = await attendanceDB('labours')
            .where('phone', phone.trim())
            .first();
        if (existing) {
            throw new AppError('A worker with this phone number already exists', 400);
        }
    }

    const [labour_id] = await attendanceDB('labours').insert({
        name,
        phone: phone || null,
        sex,
        role,
        wage_type: wage_type || 'Daily Wage',
        monthly_salary: Number(monthly_salary),
        allowed_leaves: Number(allowed_leaves) || 0,
        site_id: site_id || null,
        status: 'Active'
    });

    if (site_id) {
        await attendanceDB('labour_site_relations').insert({
            labour_id,
            site_id: Number(site_id)
        });
    }

    res.status(201).json({
        success: true,
        message: 'Labour profile created successfully',
        labour_id
    });
});

export const updateLabour = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id, status } = req.body;

    if (phone) {
        const existing = await attendanceDB('labours')
            .where('phone', phone.trim())
            .andWhereNot('labour_id', id)
            .first();
        if (existing) {
            throw new AppError('A worker with this phone number already exists', 400);
        }
    }

    const affected = await attendanceDB('labours')
        .where('labour_id', id)
        .update({
            name,
            phone: phone || null,
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

    if (site_id) {
        const existingRelation = await attendanceDB('labour_site_relations')
            .where({ labour_id: id, site_id: Number(site_id) })
            .first();
        if (!existingRelation) {
            await attendanceDB('labour_site_relations').insert({
                labour_id: id,
                site_id: Number(site_id)
            });
        }
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Get all active labours associated with this site, sorted by attendance frequency in the last 30 days
    const labours = await attendanceDB('labours as l')
        .join('labour_site_relations as r', 'l.labour_id', 'r.labour_id')
        .leftJoin('labour_attendance as a', function() {
            this.on('l.labour_id', '=', 'a.labour_id')
                .andOn('a.site_id', '=', attendanceDB.raw('?', [Number(site_id)]))
                .andOn('a.date', '>=', attendanceDB.raw('?', [thirtyDaysAgoStr]))
                .andOnIn('a.status', ['Present', 'Half Day', 'Paid Leave']);
        })
        .where({ 'r.site_id': Number(site_id), 'l.status': 'Active' })
        .select('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.site_id as primary_site_id')
        .count('a.attendance_id as frequent_count')
        .groupBy('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.site_id')
        .orderBy('frequent_count', 'desc')
        .orderBy('l.name', 'asc');

    const associatedIds = new Set(labours.map(l => l.labour_id));

    // Get attendance marked for any labours on this date across ALL sites
    // This allows us to detect if a labour has been marked at another site
    const attendanceRecords = await attendanceDB('labour_attendance as a')
        .leftJoin('labour_sites as s', 'a.site_id', 's.site_id')
        .where({ 'a.date': date })
        .select('a.labour_id', 'a.status', 'a.attendance_id', 'a.site_id', 's.site_name');

    // Filter attendance records to find extra (borrowed/marked) labours on this date at this specific site
    const currentSiteAttendance = attendanceRecords.filter(rec => Number(rec.site_id) === Number(site_id));
    const attendanceMap = {};
    currentSiteAttendance.forEach(rec => {
        attendanceMap[rec.labour_id] = rec.status;
    });

    // Create maps of attendance at other sites
    const otherSitesAttendanceMap = {};
    attendanceRecords.forEach(rec => {
        if (Number(rec.site_id) !== Number(site_id) && rec.status && rec.status !== '') {
            otherSitesAttendanceMap[rec.labour_id] = {
                site_id: rec.site_id,
                site_name: rec.site_name || 'Another Site',
                status: rec.status
            };
        }
    });

    const extraLabourIds = currentSiteAttendance
        .map(rec => rec.labour_id)
        .filter(id => !associatedIds.has(id));

    let extraLabours = [];
    if (extraLabourIds.length > 0) {
        extraLabours = await attendanceDB('labours')
            .whereIn('labour_id', extraLabourIds)
            .select('labour_id', 'name', 'role', 'wage_type', 'site_id as primary_site_id');
    }

    const allLabours = [...labours, ...extraLabours];

    const roster = allLabours.map(lab => ({
        labour_id: lab.labour_id,
        name: lab.name,
        role: lab.role,
        wage_type: lab.wage_type,
        status: attendanceMap[lab.labour_id] || '', // Default to empty string (unmarked) if not marked
        is_borrowed: !associatedIds.has(lab.labour_id),
        frequent_count: Number(lab.frequent_count || 0),
        already_marked_at: otherSitesAttendanceMap[lab.labour_id] || null
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
            // Delete existing attendance records for these labours on this date at this specific site only
            await trx('labour_attendance')
                .where({ date, site_id: Number(site_id) })
                .whereIn('labour_id', labourIds)
                .del();

            // Check if any of these labours are already marked at other sites to avoid duplicate marking
            const otherSiteRecords = await trx('labour_attendance')
                .where({ date })
                .whereNot({ site_id: Number(site_id) })
                .whereIn('labour_id', labourIds)
                .select('labour_id');
            const otherSiteLabourIds = new Set(otherSiteRecords.map(r => r.labour_id));

            // Insert new records (filtering out any that are already marked at another site)
            const insertData = [];
            for (const r of roster) {
                // If they have attendance marked at another site, do not insert a duplicate record
                if (otherSiteLabourIds.has(r.labour_id)) {
                    console.log(`⚠️ Skipping attendance save for labour_id ${r.labour_id} on ${date} at site ${site_id} (already marked at another site)`);
                    continue;
                }
                insertData.push({
                    labour_id: r.labour_id,
                    site_id: Number(site_id),
                    date,
                    status: r.status || '',
                    marked_by
                });
            }

            if (insertData.length > 0) {
                await trx('labour_attendance').insert(insertData);
            }

            // Auto-associate roster workers with this site permanently
            for (const labId of labourIds) {
                const existing = await trx('labour_site_relations')
                    .where({ labour_id: labId, site_id: Number(site_id) })
                    .first();
                if (!existing) {
                    await trx('labour_site_relations').insert({
                        labour_id: labId,
                        site_id: Number(site_id)
                    });
                }
            }
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

    // 1. Get all active labours and their associated sites
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_site_relations as r', 'l.labour_id', 'r.labour_id')
        .leftJoin('labour_sites as s', 'r.site_id', 's.site_id')
        .select(
            'l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.allowed_leaves', 'l.site_id as primary_site_id',
            attendanceDB.raw('GROUP_CONCAT(s.site_id SEPARATOR ",") as site_ids'),
            attendanceDB.raw('GROUP_CONCAT(s.site_name SEPARATOR ", ") as site_names')
        )
        .where('l.status', 'Active')
        .groupBy('l.labour_id');

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
        const dailyRate = lab.wage_type === 'Daily Wage'
            ? monthlySalary
            : (monthlySalary / totalDays);

        let accruedCredit = 0;

        if (lab.wage_type === 'Daily Wage') {
            // Paid strictly for present days (Half Day counts as 0.5)
            const creditDays = counts.Present + (0.5 * counts.HalfDay);
            accruedCredit = creditDays * dailyRate;
        } else {
            // Fixed Salary Mode:
            // Deductions made only for unpaid absent days (Absent + 0.5 * Half Day)
            // Paid Leave is supervisor approved and paid (no deduction)
            // If they have absolutely zero attendance records of any status (Present, Half Day, Paid Leave, Absent) for the entire month, they accrue ₹0 credit.
            const totalAttendanceRecords = counts.Present + counts.HalfDay + counts.PaidLeave + counts.Absent;
            if (totalAttendanceRecords === 0) {
                accruedCredit = 0;
            } else {
                const absentDaysCount = counts.Absent + (0.5 * counts.HalfDay);
                const paidDays = Math.max(0, elapsedDays - absentDaysCount);
                accruedCredit = paidDays * dailyRate;
            }
        }

        // Round to nearest integer for clean display
        accruedCredit = Math.round(accruedCredit);
        const netPayable = accruedCredit - totalAdvances;

        return {
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role,
            site_id: lab.primary_site_id,
            site_name: lab.site_names || 'Unassigned',
            site_ids: lab.site_ids ? lab.site_ids.split(',').map(Number) : [],
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
        // Fetch active labours who are associated with the site in labour_site_relations
        // OR have attendance records logged on this site this month
        labours = await attendanceDB('labours as l')
            .where(function() {
                this.whereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_site_relations')
                        .where('site_id', Number(site_id));
                }).orWhereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_attendance')
                        .where('site_id', Number(site_id))
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

    if (targetSiteId) {
        for (const labId of labour_ids) {
            const existing = await attendanceDB('labour_site_relations')
                .where({ labour_id: labId, site_id: targetSiteId })
                .first();
            if (!existing) {
                await attendanceDB('labour_site_relations').insert({
                    labour_id: labId,
                    site_id: targetSiteId
                });
            }
        }
    }

    res.json({
        success: true,
        message: `Successfully transferred ${labour_ids.length} workers.`
    });
});

export const bulkCreateLabours = catchAsync(async (req, res) => {
    const { labours } = req.body;

    if (!Array.isArray(labours) || labours.length === 0) {
        throw new AppError('labours array is required', 400);
    }

    // Retrieve active/completed sites to resolve site_name to site_id if needed
    const sites = await attendanceDB('labour_sites')
        .select('site_id', 'site_name')
        .whereNot('status', 'Inactive');
    
    const siteMap = {};
    sites.forEach(s => {
        siteMap[s.site_name.trim().toLowerCase()] = s.site_id;
    });

    // Check unique phone numbers
    const existingLabours = await attendanceDB('labours').select('phone');
    const existingPhones = new Set(existingLabours.map(l => l.phone).filter(Boolean));
    const phonesInBatch = new Set();

    const insertData = labours.map(lab => {
        const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id, site_name } = lab;

        if (!name || !role || monthly_salary === undefined) {
            throw new AppError('Name, role and monthly salary are required for all workers', 400);
        }

        const cleanPhone = phone ? String(phone).trim() : null;
        if (cleanPhone) {
            if (existingPhones.has(cleanPhone) || phonesInBatch.has(cleanPhone)) {
                throw new AppError(`A worker with phone number ${cleanPhone} already exists`, 400);
            }
            phonesInBatch.add(cleanPhone);
        }

        // Resolve site_id if not explicitly provided but site_name is
        let resolvedSiteId = null;
        if (site_id) {
            resolvedSiteId = Number(site_id);
        } else if (site_name) {
            resolvedSiteId = siteMap[site_name.trim().toLowerCase()] || null;
        }

        return {
            name,
            phone: cleanPhone,
            sex: sex || 'Male',
            role,
            wage_type: wage_type || 'Daily Wage',
            monthly_salary: Number(monthly_salary),
            allowed_leaves: Number(allowed_leaves) || 0,
            site_id: resolvedSiteId,
            status: 'Active'
        };
    });

    await attendanceDB.transaction(async (trx) => {
        for (const data of insertData) {
            const [labour_id] = await trx('labours').insert(data);
            if (data.site_id) {
                await trx('labour_site_relations').insert({
                    labour_id,
                    site_id: data.site_id
                });
            }
        }
    });

    res.status(201).json({
        success: true,
        message: `Successfully created ${insertData.length} labour profiles`
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

export const downloadBulkTemplate = catchAsync(async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Sex', key: 'sex', width: 10 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Wage Type', key: 'wage_type', width: 15 },
        { header: 'Monthly Salary', key: 'monthly_salary', width: 18 },
        { header: 'Site Name', key: 'site_name', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    worksheet.addRow({
        name: 'Ramesh Kumar',
        phone: '9876543210',
        sex: 'Male',
        role: 'Mason',
        wage_type: 'Daily Wage',
        monthly_salary: 15000,
        site_name: ''
    });

    const sites = await attendanceDB('labour_sites')
        .select('site_name')
        .whereNot('status', 'Inactive');
    
    for (let i = 2; i <= 100; i++) {
        worksheet.getCell(`C${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Male,Female,Other"']
        };
        worksheet.getCell(`E${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Daily Wage,Fixed Salary"']
        };
        
        if (sites.length > 0) {
            const siteListStr = sites.map(s => s.site_name.replace(/"/g, '""')).join(',');
            if (siteListStr.length < 250) {
                worksheet.getCell(`G${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${siteListStr}"`]
                };
            }
        }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=labour_bulk_upload_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

export const parseBulkLabours = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError('Please upload a CSV or Excel file', 400);
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname.toLowerCase();

    if (mimeType.includes('csv') || originalName.endsWith('.csv')) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
        throw new AppError('Invalid or empty file', 400);
    }

    const headerMap = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        headerMap[val] = colNumber;
    });

    const nameCol = headerMap['name'];
    const roleCol = headerMap['role'];
    const salaryCol = headerMap['monthly salary'] || headerMap['salary'];

    if (!nameCol || !roleCol || !salaryCol) {
        throw new AppError('Missing required columns: Name, Role, and Monthly Salary must be defined in the header row.', 400);
    }

    const getVal = (row, colIndex) => {
        if (!colIndex) return null;
        const cell = row.getCell(colIndex);
        if (!cell || cell.value === undefined || cell.value === null) return '';
        if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
            return cell.value.result.toString().trim();
        }
        return cell.value.toString().trim();
    };

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        rowsData.push({ row, rowNumber });
    });

    const sites = await attendanceDB('labour_sites')
        .select('site_id', 'site_name')
        .whereNot('status', 'Inactive');
    
    const siteMap = {};
    sites.forEach(s => {
        siteMap[s.site_name.trim().toLowerCase()] = s.site_id;
    });

    const existingLabours = await attendanceDB('labours').select('phone');
    const existingPhones = new Set(existingLabours.map(l => l.phone).filter(Boolean));
    const phonesInBatch = new Set();

    const sexCol = headerMap['sex'] || headerMap['gender'];
    const phoneCol = headerMap['phone'] || headerMap['mobile'];
    const wageTypeCol = headerMap['wage type'] || headerMap['wage_type'];
    const siteNameCol = headerMap['site name'] || headerMap['site_name'];

    const parsed = [];

    for (const { row, rowNumber } of rowsData) {
        const name = getVal(row, nameCol);
        const role = getVal(row, roleCol);
        const salaryVal = getVal(row, salaryCol);
        
        if (!name && !role && !salaryVal) continue;

        const monthly_salary = salaryVal ? Number(salaryVal) : NaN;
        const sex = sexCol ? (getVal(row, sexCol) || 'Male') : 'Male';
        const phone = phoneCol ? getVal(row, phoneCol) : '';
        const wage_type = wageTypeCol ? (getVal(row, wageTypeCol) || 'Daily Wage') : 'Daily Wage';
        const site_name = siteNameCol ? getVal(row, siteNameCol) : '';

        let isValid = true;
        let error = '';

        if (!name) {
            isValid = false;
            error += 'Name is required. ';
        }
        if (!role) {
            isValid = false;
            error += 'Role is required. ';
        }
        if (isNaN(monthly_salary)) {
            isValid = false;
            error += 'Valid Monthly Salary is required. ';
        }

        const cleanPhone = phone ? phone.trim() : '';
        if (cleanPhone) {
            if (existingPhones.has(cleanPhone) || phonesInBatch.has(cleanPhone)) {
                isValid = false;
                error += `Phone number ${cleanPhone} already exists. `;
            }
            phonesInBatch.add(cleanPhone);
        }

        let site_id = null;
        if (site_name) {
            const cleanSiteName = site_name.trim().toLowerCase();
            if (siteMap[cleanSiteName] !== undefined) {
                site_id = siteMap[cleanSiteName];
            } else {
                isValid = false;
                error += `Construction site "${site_name}" does not exist or is inactive. `;
            }
        }

        parsed.push({
            name,
            phone: cleanPhone,
            sex,
            role,
            wage_type,
            monthly_salary: isNaN(monthly_salary) ? '' : monthly_salary,
            site_id,
            site_name,
            isValid,
            error: error.trim()
        });
    }

    res.json({
        success: true,
        parsed
    });
});
