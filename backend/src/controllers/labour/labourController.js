import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';
import { cacheService } from '../../services/cache/cacheService.js';

// Timezone-safe date string formatter (YYYY-MM-DD)
export const formatDateSafe = (d) => {
    if (!d) return '';
    if (typeof d === 'string') {
        const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Timezone-safe month bounds calculator (start: YYYY-MM-01, end: YYYY-MM-lastDay)
export const getMonthBounds = (monthStr) => {
    const match = (monthStr || '').match(/^(\d{4})-(\d{2})/);
    let year, monthNum;
    if (match) {
        year = Number(match[1]);
        monthNum = Number(match[2]); // 1-12
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthNum = now.getMonth() + 1;
    }
    const totalDays = new Date(year, monthNum, 0).getDate();
    const yStr = String(year);
    const mStr = String(monthNum).padStart(2, '0');
    const start = `${yStr}-${mStr}-01`;
    const end = `${yStr}-${mStr}-${String(totalDays).padStart(2, '0')}`;
    return { year, monthNum, totalDays, start, end };
};

// Helper to get start and end dates of a month, and number of days
const getMonthDetails = (dateStr) => {
    const { year, monthNum, totalDays, start, end } = getMonthBounds(dateStr);
    const today = new Date();
    let elapsedDays = totalDays;
    if (today.getFullYear() === year && (today.getMonth() + 1) === monthNum) {
        elapsedDays = today.getDate();
    }

    return {
        start,
        end,
        totalDays,
        elapsedDays,
        year,
        month: monthNum
    };
};

// ==========================================
// WAGE RATE HISTORY SCHEMA & RESOLVER
// ==========================================

let isWageHistoryTableEnsured = false;
export const ensureWageHistoryTable = async () => {
    if (isWageHistoryTableEnsured) return;
    try {
        const hasTable = await attendanceDB.schema.hasTable('labour_wage_history');
        if (!hasTable) {
            await attendanceDB.schema.createTable('labour_wage_history', (table) => {
                table.increments('id').primary();
                table.integer('org_id').notNullable().index();
                table.integer('labour_id').notNullable().index();
                table.date('effective_date').notNullable();
                table.string('wage_type', 30).defaultTo('Daily Wage');
                table.decimal('daily_wage', 10, 2).notNullable();
                table.decimal('overtime_pay_per_hour', 10, 2).defaultTo(0.00);
                table.string('notes', 255).nullable();
                table.integer('created_by').nullable();
                table.timestamp('created_at').defaultTo(attendanceDB.fn.now());
                table.unique(['labour_id', 'effective_date']);
            });

            // Auto-migrate existing active workers from `labours`
            const existingLabours = await attendanceDB('labours')
                .select('labour_id', 'org_id', 'wage_type', 'monthly_salary', 'overtime_pay_per_hour', 'created_at');

            if (existingLabours.length > 0) {
                const seedRows = existingLabours
                    .filter(l => Number(l.monthly_salary) > 0 || Number(l.overtime_pay_per_hour) > 0)
                    .map(lab => {
                        const effDate = formatDateSafe(lab.created_at) || '2020-01-01';
                        return {
                            org_id: lab.org_id,
                            labour_id: lab.labour_id,
                            effective_date: effDate,
                            wage_type: lab.wage_type || 'Daily Wage',
                            daily_wage: Number(lab.monthly_salary || 0),
                            overtime_pay_per_hour: Number(lab.overtime_pay_per_hour || 0),
                            notes: 'Initial Base Rate'
                        };
                    });
                if (seedRows.length > 0) {
                    await attendanceDB('labour_wage_history').insert(seedRows);
                }
            }
        }
        isWageHistoryTableEnsured = true;
    } catch (err) {
        console.error('Error ensuring labour_wage_history table:', err);
    }
};

/**
 * Builds an in-memory wage rate lookup function for a set of workers over a date range.
 * For any given dateStr ('YYYY-MM-DD'), returns the exact rate in effect on that date.
 */
export const buildWageRateResolver = async (labourIds, orgId, maxDate = null) => {
    await ensureWageHistoryTable();
    if (!labourIds || labourIds.length === 0) {
        return () => ({ daily_rate: 0, overtime_pay_per_hour: 0, wage_type: 'Daily Wage' });
    }

    // 1. Fetch baseline labours for fallback
    const labours = await attendanceDB('labours')
        .whereIn('labour_id', labourIds)
        .andWhere('org_id', orgId)
        .select('labour_id', 'wage_type', 'monthly_salary', 'overtime_pay_per_hour', 'created_at');

    const fallbackMap = {};
    labours.forEach(l => {
        fallbackMap[l.labour_id] = {
            daily_rate: Number(l.monthly_salary || 0),
            overtime_pay_per_hour: Number(l.overtime_pay_per_hour || 0),
            wage_type: l.wage_type || 'Daily Wage',
            created_at: formatDateSafe(l.created_at) || '2020-01-01'
        };
    });

    // 2. Fetch all wage history revisions up to maxDate
    let query = attendanceDB('labour_wage_history')
        .whereIn('labour_id', labourIds)
        .andWhere('org_id', orgId);

    if (maxDate) {
        query = query.andWhere('effective_date', '<=', maxDate);
    }

    const revisions = await query
        .select('labour_id', 'effective_date', 'wage_type', 'daily_wage', 'overtime_pay_per_hour', 'notes')
        .orderBy('effective_date', 'asc');

    // Group revisions by labour_id sorted asc by effective_date
    const revisionsMap = {};
    labourIds.forEach(id => {
        revisionsMap[id] = [];
    });
    revisions.forEach(rev => {
        if (!revisionsMap[rev.labour_id]) revisionsMap[rev.labour_id] = [];
        revisionsMap[rev.labour_id].push({
            effective_date: formatDateSafe(rev.effective_date),
            daily_rate: Number(rev.daily_wage || 0),
            overtime_pay_per_hour: Number(rev.overtime_pay_per_hour || 0),
            wage_type: rev.wage_type || 'Daily Wage',
            notes: rev.notes
        });
    });

    // Resolver function for any dateStr ('YYYY-MM-DD')
    return (labourId, dateStr) => {
        const revList = revisionsMap[labourId];
        if (revList && revList.length > 0) {
            let activeRev = null;
            for (let i = 0; i < revList.length; i++) {
                if (revList[i].effective_date <= dateStr) {
                    activeRev = revList[i];
                } else {
                    break;
                }
            }
            if (activeRev) {
                return {
                    daily_rate: activeRev.daily_rate,
                    overtime_pay_per_hour: activeRev.overtime_pay_per_hour,
                    wage_type: activeRev.wage_type
                };
            }
            // If date is before earliest revision, use the earliest revision
            return {
                daily_rate: revList[0].daily_rate,
                overtime_pay_per_hour: revList[0].overtime_pay_per_hour,
                wage_type: revList[0].wage_type
            };
        }

        // Fallback to labours table baseline
        const fb = fallbackMap[labourId] || { daily_rate: 0, overtime_pay_per_hour: 0, wage_type: 'Daily Wage' };
        return {
            daily_rate: fb.daily_rate,
            overtime_pay_per_hour: fb.overtime_pay_per_hour,
            wage_type: fb.wage_type
        };
    };
};

// ==========================================
// 1. SITE CONTROLLERS
// ==========================================

export const getAllSites = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const sites = await attendanceDB('labour_sites')
        .where('org_id', org_id)
        .select('*')
        .orderBy('created_at', 'desc');

    res.json({
        success: true,
        sites
    });
});

export const createSite = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_name, location_details, status, end_date } = req.body;
    if (!site_name) {
        throw new AppError('Site name is required', 400);
    }

    const [site_id] = await attendanceDB('labour_sites').insert({
        org_id,
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
    const { org_id } = req.user;
    const { id } = req.params;
    const { site_name, location_details, status, end_date } = req.body;

    const finalEndDate = status === 'Completed' ? (end_date || new Date()) : null;
    const dateStr = finalEndDate ? formatDateSafe(finalEndDate) : null;

    const affected = await attendanceDB('labour_sites')
        .where({ site_id: id, org_id })
        .update({
            site_name,
            location_details,
            status,
            end_date: dateStr,
            updated_at: attendanceDB.fn.now()
        });

    if (affected === 0) {
        throw new AppError('Site not found', 404);
    }

    if (status === 'Completed' && dateStr) {
        // Delete all attendance records logged on or after the completion date for this org and site
        await attendanceDB('labour_attendance')
            .where({ site_id: id, org_id })
            .andWhere('date', '>=', dateStr)
            .del();
    }

    res.json({
        success: true,
        message: 'Site updated successfully'
    });
});

export const deleteSite = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    // Delete site strictly within organization
    const affected = await attendanceDB('labour_sites')
        .where({ site_id: id, org_id })
        .del();

    if (affected === 0) {
        throw new AppError('Site not found', 404);
    }

    // Clean up related relations, attendance, advances, schedules, payouts for this site in this org
    await attendanceDB('labour_site_relations').where({ site_id: id, org_id }).del();
    await attendanceDB('labour_daily_schedule').where({ site_id: id, org_id }).del();

    res.json({
        success: true,
        message: 'Site deleted successfully'
    });
});

// ==========================================
// 2. LABOUR CRUD CONTROLLERS
// ==========================================

export const getAllLabours = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_site_relations as r', function() {
            this.on('l.labour_id', '=', 'r.labour_id')
                .andOn('r.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .leftJoin('labour_sites as s', function() {
            this.on('r.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where('l.org_id', org_id)
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
    const { org_id } = req.user;
    const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id, overtime_pay_per_hour, effective_date, notes } = req.body;

    if (!name || !role) {
        throw new AppError('Name and role are required', 400);
    }

    if (phone) {
        const existing = await attendanceDB('labours')
            .where({ org_id, phone: phone.trim() })
            .first();
        if (existing) {
            throw new AppError('A worker with this phone number already exists in your organization', 400);
        }
    }

    if (site_id) {
        const validSite = await attendanceDB('labour_sites')
            .where({ site_id: Number(site_id), org_id })
            .first();
        if (!validSite) {
            throw new AppError('Specified construction site does not exist in your organization', 400);
        }
    }

    const wageVal = monthly_salary !== undefined && monthly_salary !== '' ? Number(monthly_salary) : 0;
    const otVal = overtime_pay_per_hour !== undefined && overtime_pay_per_hour !== '' ? Number(overtime_pay_per_hour) : 0;

    const [labour_id] = await attendanceDB('labours').insert({
        org_id,
        name,
        phone: phone || null,
        sex,
        role,
        wage_type: 'Daily Wage',
        monthly_salary: wageVal,
        allowed_leaves: Number(allowed_leaves) || 0,
        site_id: site_id ? Number(site_id) : null,
        overtime_pay_per_hour: otVal,
        status: 'Active'
    });

    if (site_id) {
        await attendanceDB('labour_site_relations').insert({
            org_id,
            labour_id,
            site_id: Number(site_id)
        });
    }

    // Seed initial wage revision if a wage was provided
    if (wageVal > 0 || otVal > 0) {
        await ensureWageHistoryTable();
        const effDate = effective_date ? formatDateSafe(effective_date) : formatDateSafe(new Date());
        await attendanceDB('labour_wage_history')
            .insert({
                org_id,
                labour_id,
                effective_date: effDate || formatDateSafe(new Date()),
                wage_type: 'Daily Wage',
                daily_wage: wageVal,
                overtime_pay_per_hour: otVal,
                notes: notes || 'Initial Base Rate',
                created_by: req.user?.id || null
            })
            .onConflict(['labour_id', 'effective_date'])
            .merge();
    }

    // Invalidate caches
    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.status(201).json({
        success: true,
        message: 'Labour profile created successfully',
        labour_id
    });
});

export const updateLabour = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;
    const {
        name,
        phone,
        sex,
        role,
        wage_type,
        monthly_salary,
        allowed_leaves,
        site_id,
        status,
        overtime_pay_per_hour,
        new_daily_wage,
        new_overtime_pay_per_hour,
        effective_date,
        notes
    } = req.body;

    if (phone) {
        const existing = await attendanceDB('labours')
            .where({ org_id, phone: phone.trim() })
            .andWhereNot('labour_id', id)
            .first();
        if (existing) {
            throw new AppError('A worker with this phone number already exists in your organization', 400);
        }
    }

    if (site_id) {
        const validSite = await attendanceDB('labour_sites')
            .where({ site_id: Number(site_id), org_id })
            .first();
        if (!validSite) {
            throw new AppError('Specified construction site does not exist in your organization', 400);
        }
    }

    await ensureWageHistoryTable();

    // 1. Check if a wage revision was submitted (New Rate + Effective Date)
    if (new_daily_wage !== undefined && new_daily_wage !== '' && effective_date) {
        const effDate = formatDateSafe(effective_date);
        const wageNum = Number(new_daily_wage);
        const otNum = Number(new_overtime_pay_per_hour || 0);

        if (isNaN(wageNum) || wageNum < 0) {
            throw new AppError('Valid new daily wage is required', 400);
        }
        if (!effDate) {
            throw new AppError('Valid effective date is required', 400);
        }

        await attendanceDB('labour_wage_history')
            .insert({
                org_id,
                labour_id: id,
                effective_date: effDate,
                wage_type: 'Daily Wage',
                daily_wage: wageNum,
                overtime_pay_per_hour: otNum,
                notes: notes || 'Wage Revision',
                created_by: req.user?.id || null
            })
            .onConflict(['labour_id', 'effective_date'])
            .merge({
                daily_wage: wageNum,
                overtime_pay_per_hour: otNum,
                notes: notes || 'Wage Revision'
            });

        // Sync latest revision to labours table
        const latestRev = await attendanceDB('labour_wage_history')
            .where({ labour_id: id, org_id })
            .orderBy('effective_date', 'desc')
            .first();

        if (latestRev) {
            await attendanceDB('labours')
                .where({ labour_id: id, org_id })
                .update({
                    monthly_salary: Number(latestRev.daily_wage),
                    overtime_pay_per_hour: Number(latestRev.overtime_pay_per_hour),
                    updated_at: attendanceDB.fn.now()
                });
        }
    } else if (monthly_salary !== undefined && monthly_salary !== '') {
        // 2. First-time initial wage setting (e.g. bulk-added worker receiving wage for the first time)
        const wageNum = Number(monthly_salary);
        const otNum = overtime_pay_per_hour !== undefined && overtime_pay_per_hour !== '' ? Number(overtime_pay_per_hour) : 0;

        await attendanceDB('labours')
            .where({ labour_id: id, org_id })
            .update({
                monthly_salary: wageNum,
                overtime_pay_per_hour: otNum,
                updated_at: attendanceDB.fn.now()
            });

        // Check if revision exists, otherwise create initial revision
        const existingRevs = await attendanceDB('labour_wage_history')
            .where({ labour_id: id, org_id })
            .first();

        if (!existingRevs) {
            const worker = await attendanceDB('labours').where({ labour_id: id, org_id }).first();
            const effDate = worker ? (formatDateSafe(worker.created_at) || '2020-01-01') : '2020-01-01';
            await attendanceDB('labour_wage_history').insert({
                org_id,
                labour_id: id,
                effective_date: effDate,
                wage_type: 'Daily Wage',
                daily_wage: wageNum,
                overtime_pay_per_hour: otNum,
                notes: 'Initial Base Rate',
                created_by: req.user?.id || null
            });
        }
    }

    // Standard profile fields update
    const updatePayload = {
        name,
        phone: phone || null,
        sex,
        role,
        wage_type: 'Daily Wage',
        allowed_leaves: allowed_leaves !== undefined ? Number(allowed_leaves) : undefined,
        site_id: site_id ? Number(site_id) : null,
        status,
        updated_at: attendanceDB.fn.now()
    };

    const affected = await attendanceDB('labours')
        .where({ labour_id: id, org_id })
        .update(updatePayload);

    if (affected === 0) {
        throw new AppError('Labour not found', 404);
    }

    if (site_id) {
        const existingRelation = await attendanceDB('labour_site_relations')
            .where({ labour_id: id, site_id: Number(site_id), org_id })
            .first();
        if (!existingRelation) {
            await attendanceDB('labour_site_relations').insert({
                org_id,
                labour_id: id,
                site_id: Number(site_id)
            });
        }
    }

    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.json({
        success: true,
        message: 'Labour updated successfully'
    });
});

// ==========================================
// WAGE HISTORY CRUD CONTROLLERS
// ==========================================

export const getLabourWageHistory = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    await ensureWageHistoryTable();

    const worker = await attendanceDB('labours')
        .where({ labour_id: id, org_id })
        .select('labour_id', 'name', 'role', 'monthly_salary', 'overtime_pay_per_hour', 'created_at')
        .first();

    if (!worker) {
        throw new AppError('Worker not found', 404);
    }

    const history = await attendanceDB('labour_wage_history')
        .where({ labour_id: id, org_id })
        .orderBy('effective_date', 'desc');

    const formattedHistory = history.map(h => ({
        id: h.id,
        labour_id: h.labour_id,
        effective_date: formatDateSafe(h.effective_date),
        wage_type: h.wage_type,
        daily_wage: Number(h.daily_wage),
        overtime_pay_per_hour: Number(h.overtime_pay_per_hour || 0),
        notes: h.notes,
        created_at: h.created_at
    }));

    res.json({
        success: true,
        worker: {
            labour_id: worker.labour_id,
            name: worker.name,
            role: worker.role,
            current_daily_wage: Number(worker.monthly_salary || 0),
            current_overtime_pay_per_hour: Number(worker.overtime_pay_per_hour || 0)
        },
        history: formattedHistory
    });
});

export const addLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;
    const { effective_date, daily_wage, overtime_pay_per_hour, notes } = req.body;

    if (!effective_date || daily_wage === undefined || isNaN(Number(daily_wage))) {
        throw new AppError('Effective date and valid daily wage are required', 400);
    }

    await ensureWageHistoryTable();

    const effDate = formatDateSafe(effective_date);
    const wageNum = Number(daily_wage);
    const otNum = Number(overtime_pay_per_hour || 0);

    const worker = await attendanceDB('labours')
        .where({ labour_id: id, org_id })
        .first();

    if (!worker) {
        throw new AppError('Worker not found', 404);
    }

    await attendanceDB('labour_wage_history')
        .insert({
            org_id,
            labour_id: id,
            effective_date: effDate,
            wage_type: 'Daily Wage',
            daily_wage: wageNum,
            overtime_pay_per_hour: otNum,
            notes: notes || null,
            created_by: req.user?.id || null
        })
        .onConflict(['labour_id', 'effective_date'])
        .merge({
            daily_wage: wageNum,
            overtime_pay_per_hour: otNum,
            notes: notes || null
        });

    // Update labours table with the latest revision
    const latestRev = await attendanceDB('labour_wage_history')
        .where({ labour_id: id, org_id })
        .orderBy('effective_date', 'desc')
        .first();

    if (latestRev) {
        await attendanceDB('labours')
            .where({ labour_id: id, org_id })
            .update({
                monthly_salary: Number(latestRev.daily_wage),
                overtime_pay_per_hour: Number(latestRev.overtime_pay_per_hour),
                updated_at: attendanceDB.fn.now()
            });
    }

    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.status(201).json({
        success: true,
        message: 'Wage revision added successfully'
    });
});

export const updateLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { revisionId } = req.params;
    const { effective_date, daily_wage, overtime_pay_per_hour, notes } = req.body;

    await ensureWageHistoryTable();

    const existing = await attendanceDB('labour_wage_history')
        .where({ id: revisionId, org_id })
        .first();

    if (!existing) {
        throw new AppError('Wage revision record not found', 404);
    }

    const effDate = effective_date ? formatDateSafe(effective_date) : existing.effective_date;
    const wageNum = daily_wage !== undefined ? Number(daily_wage) : existing.daily_wage;
    const otNum = overtime_pay_per_hour !== undefined ? Number(overtime_pay_per_hour) : existing.overtime_pay_per_hour;

    await attendanceDB('labour_wage_history')
        .where({ id: revisionId, org_id })
        .update({
            effective_date: effDate,
            daily_wage: wageNum,
            overtime_pay_per_hour: otNum,
            notes: notes !== undefined ? notes : existing.notes
        });

    // Sync latest revision with labours
    const latestRev = await attendanceDB('labour_wage_history')
        .where({ labour_id: existing.labour_id, org_id })
        .orderBy('effective_date', 'desc')
        .first();

    if (latestRev) {
        await attendanceDB('labours')
            .where({ labour_id: existing.labour_id, org_id })
            .update({
                monthly_salary: Number(latestRev.daily_wage),
                overtime_pay_per_hour: Number(latestRev.overtime_pay_per_hour),
                updated_at: attendanceDB.fn.now()
            });
    }

    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.json({
        success: true,
        message: 'Wage revision updated successfully'
    });
});

export const deleteLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { revisionId } = req.params;

    await ensureWageHistoryTable();

    const existing = await attendanceDB('labour_wage_history')
        .where({ id: revisionId, org_id })
        .first();

    if (!existing) {
        throw new AppError('Wage revision record not found', 404);
    }

    const totalCount = await attendanceDB('labour_wage_history')
        .where({ labour_id: existing.labour_id, org_id })
        .count('id as count')
        .first();

    if (Number(totalCount?.count) <= 1) {
        throw new AppError('Cannot delete the only wage revision for this worker. Edit it instead.', 400);
    }

    await attendanceDB('labour_wage_history')
        .where({ id: revisionId, org_id })
        .del();

    // Sync latest remaining revision with labours
    const latestRev = await attendanceDB('labour_wage_history')
        .where({ labour_id: existing.labour_id, org_id })
        .orderBy('effective_date', 'desc')
        .first();

    if (latestRev) {
        await attendanceDB('labours')
            .where({ labour_id: existing.labour_id, org_id })
            .update({
                monthly_salary: Number(latestRev.daily_wage),
                overtime_pay_per_hour: Number(latestRev.overtime_pay_per_hour),
                updated_at: attendanceDB.fn.now()
            });
    }

    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.json({
        success: true,
        message: 'Wage revision deleted successfully'
    });
});

export const deleteLabour = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    const affected = await attendanceDB('labours')
        .where({ labour_id: id, org_id })
        .del();

    if (affected === 0) {
        throw new AppError('Labour not found', 404);
    }

    // Clean up all related child tables strictly for this org
    await attendanceDB('labour_site_relations').where({ labour_id: id, org_id }).del();
    await attendanceDB('labour_attendance').where({ labour_id: id, org_id }).del();
    await attendanceDB('labour_advances').where({ labour_id: id, org_id }).del();
    await attendanceDB('labour_daily_schedule').where({ labour_id: id, org_id }).del();
    await attendanceDB('labour_monthly_payouts').where({ labour_id: id, org_id }).del();

    res.json({
        success: true,
        message: 'Labour deleted successfully'
    });
});

// ==========================================
// 3. ATTENDANCE CONTROLLERS
// ==========================================

export const getSiteAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, date } = req.query;

    if (!site_id || !date) {
        throw new AppError('site_id and date parameters are required', 400);
    }

    // Check Redis cache for instant response
    const cacheKey = `labour:roster:${org_id}:${site_id}:${date}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
        return res.json({
            success: true,
            date,
            site_id: Number(site_id),
            roster: cached.roster,
            from_cache: true
        });
    }

    // Verify site belongs to the organization
    const siteObj = await attendanceDB('labour_sites')
        .where({ site_id: Number(site_id), org_id })
        .first();

    if (!siteObj) {
        throw new AppError('Site not found in your organization', 404);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Get all active labours scheduled for this site today, or falling back to their labour_site_relations if not scheduled anywhere
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_attendance as a', function() {
            this.on('l.labour_id', '=', 'a.labour_id')
                .andOn('a.org_id', '=', attendanceDB.raw('?', [org_id]))
                .andOn('a.site_id', '=', attendanceDB.raw('?', [Number(site_id)]))
                .andOn('a.date', '>=', attendanceDB.raw('?', [thirtyDaysAgoStr]))
                .andOnIn('a.status', ['Present', 'Half Day', 'Paid Leave']);
        })
        .where('l.org_id', org_id)
        .andWhere('l.status', 'Active')
        .andWhere(function() {
            this.whereIn('l.labour_id', function() {
                this.select('labour_id')
                    .from('labour_daily_schedule')
                    .where({ org_id, date, site_id: Number(site_id) });
            }).orWhere(function() {
                this.whereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_site_relations')
                        .where({ org_id, site_id: Number(site_id) });
                }).whereNotIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_daily_schedule')
                        .where({ org_id, date });
                });
            });
        })
        .select('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.site_id as primary_site_id', 'l.overtime_pay_per_hour')
        .count('a.attendance_id as frequent_count')
        .groupBy('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.site_id', 'l.overtime_pay_per_hour')
        .orderBy('frequent_count', 'desc')
        .orderBy('l.name', 'asc');

    const relations = await attendanceDB('labour_site_relations')
        .where({ site_id: Number(site_id), org_id })
        .select('labour_id');
    const associatedIds = new Set(relations.map(r => r.labour_id));

    // Get attendance marked for any labours on this date across ALL sites within this org
    const attendanceRecords = await attendanceDB('labour_attendance as a')
        .leftJoin('labour_sites as s', function() {
            this.on('a.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where({ 'a.org_id': org_id, 'a.date': date })
        .select('a.labour_id', 'a.status', 'a.attendance_id', 'a.site_id', 's.site_name', 'a.overtime_hours', 'a.working_hours');

    // Filter attendance records to find extra (borrowed/marked) labours on this date at this specific site
    const currentSiteAttendance = attendanceRecords.filter(rec => Number(rec.site_id) === Number(site_id));
    const attendanceMap = {};
    const attendanceOvertimeMap = {};
    const attendanceWorkingHoursMap = {};
    currentSiteAttendance.forEach(rec => {
        attendanceMap[rec.labour_id] = rec.status;
        attendanceOvertimeMap[rec.labour_id] = rec.overtime_hours;
        attendanceWorkingHoursMap[rec.labour_id] = rec.working_hours;
    });

    // Create maps of attendance at other sites for this organization
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
            .where('org_id', org_id)
            .whereIn('labour_id', extraLabourIds)
            .select('labour_id', 'name', 'role', 'wage_type', 'site_id as primary_site_id', 'overtime_pay_per_hour');
    }

    const allLabours = [...labours, ...extraLabours];

    const allLabourIds = allLabours.map(l => l.labour_id);
    const dailySchedules = allLabourIds.length > 0
        ? await attendanceDB('labour_daily_schedule')
            .where({ org_id, date })
            .whereIn('labour_id', allLabourIds)
            .select('labour_id')
        : [];

    const scheduleCountMap = {};
    dailySchedules.forEach(sch => {
        scheduleCountMap[sch.labour_id] = (scheduleCountMap[sch.labour_id] || 0) + 1;
    });

    const roster = allLabours.map(lab => ({
        labour_id: lab.labour_id,
        name: lab.name,
        role: lab.role,
        wage_type: lab.wage_type,
        status: attendanceMap[lab.labour_id] || '', // Default to empty string (unmarked) if not marked
        is_borrowed: !associatedIds.has(lab.labour_id),
        frequent_count: Number(lab.frequent_count || 0),
        already_marked_at: otherSitesAttendanceMap[lab.labour_id] || null,
        is_scheduled_multi_site: (scheduleCountMap[lab.labour_id] || 0) >= 2,
        overtime_pay_per_hour: Number(lab.overtime_pay_per_hour || 0),
        overtime_hours: Number(attendanceOvertimeMap[lab.labour_id] || 0),
        working_hours: attendanceWorkingHoursMap[lab.labour_id] !== undefined && attendanceWorkingHoursMap[lab.labour_id] !== null
            ? Number(attendanceWorkingHoursMap[lab.labour_id])
            : (attendanceMap[lab.labour_id] === 'Half Day' ? 4 : 8)
    }));

    // Cache roster in Redis for 5 minutes (300s)
    await cacheService.set(cacheKey, { roster }, 300);

    res.json({
        success: true,
        date,
        site_id: Number(site_id),
        roster
    });
});

export const saveSiteAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, date, roster } = req.body;
    const marked_by = req.user?.id || req.user?.user_id || null;

    if (!site_id || !date || !Array.isArray(roster)) {
        throw new AppError('site_id, date, and roster array are required', 400);
    }

    const siteObj = await attendanceDB('labour_sites')
        .where({ site_id: Number(site_id), org_id })
        .first();

    if (!siteObj) {
        throw new AppError('Site not found in your organization', 404);
    }

    if (siteObj.status === 'Completed' && siteObj.end_date) {
        const compDateStr = formatDateSafe(siteObj.end_date);
        const attDateStr = formatDateSafe(date);
        if (attDateStr >= compDateStr) {
            throw new AppError('Site is marked as Completed. Attendance is only allowed for dates before the completion date.', 400);
        }
    }

    await attendanceDB.transaction(async (trx) => {
        // Extract labour IDs to clean up old records for this date and org
        const labourIds = roster.map(r => r.labour_id);

        if (labourIds.length > 0) {
            // 1. Delete existing attendance records for these labours on this date at this specific site only
            await trx('labour_attendance')
                .where({ org_id, date, site_id: Number(site_id) })
                .whereIn('labour_id', labourIds)
                .del();

            // 2. Fetch daily schedules for these workers on this date to count scheduled sites
            const dailySchedules = await trx('labour_daily_schedule')
                .where({ org_id, date })
                .whereIn('labour_id', labourIds)
                .select('labour_id');

            const scheduledCountMap = {};
            dailySchedules.forEach(sch => {
                scheduledCountMap[sch.labour_id] = (scheduledCountMap[sch.labour_id] || 0) + 1;
            });

            // 3. Check if any of these labours are already marked with active status at other sites within this org
            const otherSiteRecords = await trx('labour_attendance')
                .where({ org_id, date })
                .whereNot({ site_id: Number(site_id) })
                .whereIn('labour_id', labourIds)
                .whereIn('status', ['Present', 'Half Day', 'Paid Leave'])
                .select('labour_id');
            const otherSiteLabourIds = new Set(otherSiteRecords.map(r => r.labour_id));

            // 4. Batch insert new attendance records
            const insertData = [];
            for (const r of roster) {
                if (!r.status || typeof r.status !== 'string' || r.status.trim() === '') {
                    continue;
                }

                const isScheduledMultiSite = (scheduledCountMap[r.labour_id] || 0) >= 2;
                const statusIsActive = ['Present', 'Half Day', 'Paid Leave'].includes(r.status);

                if (!isScheduledMultiSite && statusIsActive && otherSiteLabourIds.has(r.labour_id)) {
                    continue;
                }

                let workingHours = 8.0;
                if (r.status === 'Half Day') {
                    workingHours = (r.working_hours !== undefined && r.working_hours !== null && !isNaN(Number(r.working_hours)))
                        ? Number(r.working_hours)
                        : 4.0;
                } else if (r.status === 'Absent') {
                    workingHours = 0.0;
                } else if (r.status === 'Present' || r.status === 'Paid Leave') {
                    workingHours = 8.0;
                }

                insertData.push({
                    org_id,
                    labour_id: r.labour_id,
                    site_id: Number(site_id),
                    date,
                    status: r.status.trim(),
                    overtime_hours: Number(r.overtime_hours || 0),
                    working_hours: workingHours,
                    marked_by
                });
            }

            if (insertData.length > 0) {
                await trx('labour_attendance').insert(insertData);
            }

            // 5. ⚡ HIGH PERFORMANCE BULK BATCH: associate roster workers with site in 1 query
            const existingRelations = await trx('labour_site_relations')
                .where({ org_id, site_id: Number(site_id) })
                .whereIn('labour_id', labourIds)
                .select('labour_id');

            const existingSet = new Set(existingRelations.map(r => r.labour_id));
            const newRelations = labourIds
                .filter(id => !existingSet.has(id))
                .map(id => ({
                    org_id,
                    labour_id: id,
                    site_id: Number(site_id)
                }));

            if (newRelations.length > 0) {
                await trx('labour_site_relations').insert(newRelations);
            }
        }
    });

    // Invalidate Redis cache for this roster & monthly grid caches
    const rosterCacheKey = `labour:roster:${org_id}:${site_id}:${date}`;
    await cacheService.del(rosterCacheKey);
    await cacheService.delPattern(`labour:grid:${org_id}:${site_id}:*`);

    res.json({
        success: true,
        message: 'Attendance saved successfully'
    });
});

// ==========================================
// 4. FINANCIAL / SALARY CREDIT CONTROLLERS
// ==========================================

export const getFinancesSummary = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month } = req.query; // Filter by site_id and month (YYYY-MM)

    if (!site_id) {
        throw new AppError('site_id is required', 400);
    }

    // Verify site belongs to this org
    const site = await attendanceDB('labour_sites')
        .where({ site_id: Number(site_id), org_id })
        .first();

    if (!site) {
        throw new AppError('Site not found in your organization', 404);
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const { year, monthNum, totalDays, start, end } = getMonthBounds(targetMonth);

    // 1. Get all active labours associated with this site in this org OR having attendance this month
    const labours = await attendanceDB('labours as l')
        .leftJoin('labour_site_relations as r', function() {
            this.on('l.labour_id', '=', 'r.labour_id')
                .andOn('r.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .leftJoin('labour_sites as s', function() {
            this.on('r.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .select(
            'l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.allowed_leaves', 'l.site_id as primary_site_id', 'l.overtime_pay_per_hour',
            attendanceDB.raw('GROUP_CONCAT(DISTINCT s.site_id SEPARATOR ",") as site_ids'),
            attendanceDB.raw('GROUP_CONCAT(DISTINCT s.site_name SEPARATOR ", ") as site_names')
        )
        .where('l.org_id', org_id)
        .andWhere('l.status', 'Active')
        .andWhere(function() {
            this.where('l.site_id', Number(site_id))
                .orWhere('r.site_id', Number(site_id))
                .orWhereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_attendance')
                        .where({ org_id, site_id: Number(site_id) })
                        .where('date', '>=', start)
                        .where('date', '<=', end);
                });
        })
        .groupBy('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.allowed_leaves', 'l.site_id', 'l.overtime_pay_per_hour');

    if (labours.length === 0) {
        return res.json({
            success: true,
            monthDetails: {
                month: targetMonth,
                totalDays,
                year,
                monthNum
            },
            summary: []
        });
    }

    const labourIds = labours.map(l => l.labour_id);

    // 2. Fetch attendance records for these labours in THIS MONTH
    const attendanceRecords = await attendanceDB('labour_attendance')
        .where('org_id', org_id)
        .where('date', '>=', start)
        .where('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'status', 'date', 'site_id', 'overtime_hours', 'working_hours');

    // Fetch daily schedules for these labours in THIS MONTH to calculate divisors
    const dailySchedules = await attendanceDB('labour_daily_schedule')
        .where('org_id', org_id)
        .where('date', '>=', start)
        .where('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'site_id', 'date');

    const scheduleCountMap = {};
    dailySchedules.forEach(sch => {
        const dateStr = formatDateSafe(sch.date);
        if (!scheduleCountMap[sch.labour_id]) {
            scheduleCountMap[sch.labour_id] = {};
        }
        if (!scheduleCountMap[sch.labour_id][dateStr]) {
            scheduleCountMap[sch.labour_id][dateStr] = 0;
        }
        scheduleCountMap[sch.labour_id][dateStr] += 1;
    });

    const overtimePayMap = {};
    labours.forEach(l => {
        overtimePayMap[l.labour_id] = Number(l.overtime_pay_per_hour || 0);
    });

    // 2. Fetch daily rate resolvers for all workers
    const rateResolver = await buildWageRateResolver(labourIds, org_id, end);

    // Group attendance for THIS MONTH
    const attendanceMap = {};
    labourIds.forEach(id => {
        attendanceMap[id] = { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0, weightSum: 0, baseCreditSum: 0, overtimeCreditSum: 0 };
    });

    attendanceRecords.forEach(rec => {
        const counts = attendanceMap[rec.labour_id];
        if (counts) {
            const dateStr = formatDateSafe(rec.date);
            const isCurrentSite = Number(rec.site_id) === Number(site_id);
            if (isCurrentSite) {
                if (rec.status === 'Present') counts.Present += 1;
                else if (rec.status === 'Absent') counts.Absent += 1;
                else if (rec.status === 'Half Day') counts.HalfDay += 1;
                else if (rec.status === 'Paid Leave') counts.PaidLeave += 1;

                // Compute split weight based on scheduled sites count (S)
                const S = (scheduleCountMap[rec.labour_id] && scheduleCountMap[rec.labour_id][dateStr]) || 1;
                let w = 0;
                if (rec.status === 'Present' || rec.status === 'Paid Leave') {
                    w = 1 / S;
                } else if (rec.status === 'Half Day') {
                    const hrs = Number(rec.working_hours || 4);
                    w = (hrs / 8.0) / S;
                }
                counts.weightSum += w;

                // Resolve date-specific rates
                const rates = rateResolver(rec.labour_id, dateStr);
                counts.baseCreditSum += w * rates.daily_rate;
                counts.overtimeCreditSum += Number(rec.overtime_hours || 0) * rates.overtime_pay_per_hour;
            }
        }
    });

    // 3. Fetch advances logged for this site and labour in THIS MONTH
    const advances = await attendanceDB('labour_advances')
        .where('org_id', org_id)
        .whereIn('labour_id', labourIds)
        .andWhere('site_id', Number(site_id))
        .where('date', '>=', start)
        .where('date', '<=', end)
        .select('labour_id', 'amount');

    const advancesMap = {};
    labourIds.forEach(id => {
        advancesMap[id] = 0;
    });
    advances.forEach(adv => {
        advancesMap[adv.labour_id] += Number(adv.amount);
    });

    // 4. Fetch payouts logged for this site in THIS MONTH
    const payouts = await attendanceDB('labour_monthly_payouts')
        .where('org_id', org_id)
        .whereIn('labour_id', labourIds)
        .andWhere('site_id', Number(site_id))
        .andWhere('month', targetMonth)
        .select('payout_id', 'labour_id', 'status', 'paid_amount', 'payment_date', 'notes');

    const payoutMap = {};
    payouts.forEach(p => {
        payoutMap[p.labour_id] = p;
    });

    // 5. Compute dynamic monthly credits
    const summary = labours.map(lab => {
        const counts = attendanceMap[lab.labour_id] || { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0, weightSum: 0, baseCreditSum: 0, overtimeCreditSum: 0 };
        const totalAdvances = advancesMap[lab.labour_id] || 0;
        const payout = payoutMap[lab.labour_id] || null;
        const totalPaid = (payout && payout.status === 'Paid') ? Number(payout.paid_amount) : 0;
        const monthlySalary = Number(lab.monthly_salary);

        const dailyRate = lab.wage_type === 'Daily Wage'
            ? monthlySalary
            : (monthlySalary / totalDays);

        const accruedCredit = Math.round((counts.baseCreditSum || 0) + (counts.overtimeCreditSum || 0));
        const netEarned = Math.max(0, accruedCredit - totalPaid);
        const netPayable = accruedCredit - totalPaid - totalAdvances;

        return {
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role,
            site_id: Number(site_id),
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
            accrued_credit: accruedCredit, // Total Earned in this Month (Site-specific)
            total_paid: totalPaid,         // Total Paid in this Month (Site-specific)
            net_earned: netEarned,         // Accrued to Pay in this Month (Site-specific)
            advances_taken: totalAdvances, // Advances Taken in this Month (Site-specific)
            net_payable: netPayable,       // Final Net Payable in this Month (Site-specific)
            overtime_pay_per_hour: Number(lab.overtime_pay_per_hour || 0),
            payout: payout
        };
    });

    res.json({
        success: true,
        monthDetails: {
            month: targetMonth,
            totalDays,
            year,
            monthNum
        },
        summary
    });
});

export const getDetailedMonthlyLedger = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month, till_date } = req.query;

    if (!site_id) {
        throw new AppError('site_id is required', 400);
    }

    const isAllSites = site_id === 'All';
    let site = null;
    if (!isAllSites) {
        site = await attendanceDB('labour_sites')
            .where({ site_id: Number(site_id), org_id })
            .first();
        if (!site) {
            throw new AppError('Site not found in your organization', 404);
        }
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const { year, monthNum, totalDays, start, end } = getMonthBounds(targetMonth);

    // 1. Fetch active labours in this site/org
    let laboursQuery = attendanceDB('labours as l')
        .leftJoin('labour_site_relations as r', function() {
            this.on('l.labour_id', '=', 'r.labour_id')
                .andOn('r.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .leftJoin('labour_sites as s', function() {
            this.on('r.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .select(
            'l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.site_id as primary_site_id', 'l.overtime_pay_per_hour',
            attendanceDB.raw('GROUP_CONCAT(DISTINCT s.site_id SEPARATOR ",") as site_ids'),
            attendanceDB.raw('GROUP_CONCAT(DISTINCT s.site_name SEPARATOR ", ") as site_names')
        )
        .where('l.org_id', org_id)
        .andWhere('l.status', 'Active');

    if (!isAllSites) {
        laboursQuery.andWhere(function() {
            this.where('l.site_id', Number(site_id))
                .orWhere('r.site_id', Number(site_id))
                .orWhereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_attendance')
                        .where({ org_id, site_id: Number(site_id) })
                        .where('date', '>=', start)
                        .where('date', '<=', end);
                });
        });
    }

    const labours = await laboursQuery.groupBy('l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.site_id', 'l.overtime_pay_per_hour');

    const daysArray = [];
    for (let d = 1; d <= totalDays; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateStr = `${targetMonth}-${dStr}`;
        const dayDate = new Date(year, monthNum - 1, d);
        const dayOfWeek = dayDate.getDay();
        const dayName = dayDate.toLocaleString('en-US', { weekday: 'short' });
        daysArray.push({
            day: d,
            dateStr,
            dayOfWeek,
            dayName,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            isFuture: till_date ? dateStr > till_date : false
        });
    }

    if (labours.length === 0) {
        return res.json({
            success: true,
            monthDetails: {
                month: targetMonth,
                totalDays,
                year,
                monthNum,
                tillDate: till_date || null
            },
            days: daysArray,
            workers: [],
            dailyTotals: {
                presentCount: Array(totalDays).fill(0),
                otHours: Array(totalDays).fill(0),
                advances: Array(totalDays).fill(0)
            },
            grandTotals: {
                totalWorkers: 0,
                totalPresentDays: 0,
                totalOtHours: 0,
                totalAdvances: 0,
                totalGrossEarned: 0,
                totalPaid: 0,
                totalNetPayable: 0
            }
        });
    }

    const labourIds = labours.map(l => l.labour_id);

    // 2. Attendance records for these labours in THIS MONTH
    const attendanceQuery = attendanceDB('labour_attendance')
        .where('org_id', org_id)
        .where('date', '>=', start)
        .where('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'status', 'date', 'site_id', 'overtime_hours', 'working_hours');

    if (!isAllSites) {
        attendanceQuery.where('site_id', Number(site_id));
    }
    const attendanceRecords = await attendanceQuery;

    // 3. Daily Schedules for split divisor
    const scheduleRecords = await attendanceDB('labour_daily_schedule')
        .where('org_id', org_id)
        .where('date', '>=', start)
        .where('date', '<=', end)
        .whereIn('labour_id', labourIds)
        .select('labour_id', 'site_id', 'date');

    const scheduleCountMap = {};
    scheduleRecords.forEach(sch => {
        const dStr = formatDateSafe(sch.date);
        if (!scheduleCountMap[sch.labour_id]) scheduleCountMap[sch.labour_id] = {};
        if (!scheduleCountMap[sch.labour_id][dStr]) scheduleCountMap[sch.labour_id][dStr] = 0;
        scheduleCountMap[sch.labour_id][dStr] += 1;
    });

    // 4. Advances logged in THIS MONTH
    const advancesQuery = attendanceDB('labour_advances')
        .where('org_id', org_id)
        .whereIn('labour_id', labourIds)
        .where('date', '>=', start)
        .where('date', '<=', end)
        .select('advance_id', 'labour_id', 'amount', 'date', 'site_id', 'notes');

    if (!isAllSites) {
        advancesQuery.where('site_id', Number(site_id));
    }
    const advancesRecords = await advancesQuery;

    // 5. Monthly Payouts in THIS MONTH
    const payoutsQuery = attendanceDB('labour_monthly_payouts')
        .where('org_id', org_id)
        .whereIn('labour_id', labourIds)
        .where('month', targetMonth)
        .where('status', 'Paid')
        .select('payout_id', 'labour_id', 'paid_amount', 'payment_date', 'notes');

    if (!isAllSites) {
        payoutsQuery.where('site_id', Number(site_id));
    }
    const payoutsRecords = await payoutsQuery;

    const payoutMap = {};
    payoutsRecords.forEach(p => {
        if (!payoutMap[p.labour_id]) payoutMap[p.labour_id] = 0;
        payoutMap[p.labour_id] += Number(p.paid_amount || 0);
    });

    // Organize attendance by labour and date
    const labourAttMap = {};
    attendanceRecords.forEach(rec => {
        const dStr = formatDateSafe(rec.date);
        if (!labourAttMap[rec.labour_id]) labourAttMap[rec.labour_id] = {};
        labourAttMap[rec.labour_id][dStr] = rec;
    });

    // Organize advances by labour and date
    const labourAdvMap = {};
    advancesRecords.forEach(adv => {
        const dStr = formatDateSafe(adv.date);
        if (!labourAdvMap[adv.labour_id]) labourAdvMap[adv.labour_id] = {};
        if (!labourAdvMap[adv.labour_id][dStr]) labourAdvMap[adv.labour_id][dStr] = 0;
        labourAdvMap[adv.labour_id][dStr] += Number(adv.amount || 0);
    });

    // Daily totals arrays
    const dailyPresentCount = Array(totalDays).fill(0);
    const dailyOtHours = Array(totalDays).fill(0);
    const dailyAdvances = Array(totalDays).fill(0);

    // Build date-specific rate resolver for all workers in this month
    const rateResolver = await buildWageRateResolver(labourIds, org_id, end);

    let grandPresentDays = 0;
    let grandOtHours = 0;
    let grandAdvances = 0;
    let grandGrossEarned = 0;
    let grandTotalPaid = 0;
    let grandNetPayable = 0;

    const workers = labours.map((lab, index) => {
        const monthlySalary = Number(lab.monthly_salary || 0);
        const otRate = Number(lab.overtime_pay_per_hour || 0);
        const dailyRate = lab.wage_type === 'Daily Wage' ? monthlySalary : (monthlySalary / totalDays);

        const daysData = {};
        let workerPresentWeight = 0;
        let workerPresentDaysCount = 0;
        let workerBaseCredit = 0;
        let workerOtHours = 0;
        let workerOtCredit = 0;
        let workerAdvances = 0;

        daysArray.forEach((dayInfo, idx) => {
            const dStr = dayInfo.dateStr;
            const attRec = (labourAttMap[lab.labour_id] && labourAttMap[lab.labour_id][dStr]) || null;
            const advAmount = (labourAdvMap[lab.labour_id] && labourAdvMap[lab.labour_id][dStr]) || 0;

            const status = attRec ? attRec.status : '-';
            const ot = attRec ? Number(attRec.overtime_hours || 0) : 0;
            const workingHours = attRec ? Number(attRec.working_hours || (status === 'Half Day' ? 4 : 8)) : 8;

            // Resolve date-specific effective rates
            const dayRates = rateResolver(lab.labour_id, dStr);

            // Split divisor
            const S = (scheduleCountMap[lab.labour_id] && scheduleCountMap[lab.labour_id][dStr]) || 1;
            let weight = 0;
            let dayPresentVal = 0;
            let displayStatus = status;

            if (status === 'Present') {
                weight = 1.0 / S;
                dayPresentVal = 1.0;
                displayStatus = 'P';
            } else if (status === 'Half Day') {
                weight = (workingHours / 8.0) / S;
                dayPresentVal = workingHours / 8.0;
                displayStatus = workingHours === 4 ? 'HD' : `HD (${workingHours}h)`;
            } else if (status === 'Absent') {
                displayStatus = 'A';
            }

            daysData[dStr] = {
                day: dayInfo.day,
                date: dStr,
                status,
                display_status: displayStatus,
                working_hours: workingHours,
                ot_hours: ot,
                advance_amount: advAmount,
                effective_daily_rate: dayRates.daily_rate,
                effective_ot_rate: dayRates.overtime_pay_per_hour,
                is_weekend: dayInfo.isWeekend,
                is_future: dayInfo.isFuture
            };

            // Global daily column stats
            if (status === 'Present') {
                dailyPresentCount[idx] += 1;
            } else if (status === 'Half Day') {
                dailyPresentCount[idx] += dayPresentVal;
            }
            dailyOtHours[idx] += ot;
            dailyAdvances[idx] += advAmount;

            // Worker financial accumulations
            if (!dayInfo.isFuture) {
                workerPresentWeight += weight;
                workerPresentDaysCount += dayPresentVal;

                workerBaseCredit += weight * dayRates.daily_rate;
                workerOtHours += ot;
                workerOtCredit += ot * dayRates.overtime_pay_per_hour;
                workerAdvances += advAmount;
            }
        });

        const totalPaid = payoutMap[lab.labour_id] || 0;
        const baseEarned = Math.round(workerBaseCredit);
        const grossEarned = baseEarned + Math.round(workerOtCredit);
        const netPayable = grossEarned - workerAdvances - totalPaid;

        grandPresentDays += workerPresentDaysCount;
        grandOtHours += workerOtHours;
        grandAdvances += workerAdvances;
        grandGrossEarned += grossEarned;
        grandTotalPaid += totalPaid;
        grandNetPayable += netPayable;

        return {
            sr_no: index + 1,
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role,
            wage_type: lab.wage_type,
            monthly_salary: monthlySalary,
            daily_rate: Math.round(dailyRate),
            overtime_pay_per_hour: otRate,
            days: daysData,
            totals: {
                present_days: workerPresentDaysCount,
                present_weight: workerPresentWeight,
                ot_hours: workerOtHours,
                advances: workerAdvances,
                base_earned: baseEarned,
                ot_earned: Math.round(workerOtCredit),
                gross_earned: grossEarned,
                total_paid: totalPaid,
                net_payable: netPayable
            }
        };
    });

    res.json({
        success: true,
        monthDetails: {
            month: targetMonth,
            totalDays,
            year,
            monthNum,
            tillDate: till_date || null
        },
        days: daysArray,
        workers,
        dailyTotals: {
            presentCount: dailyPresentCount,
            otHours: dailyOtHours,
            advances: dailyAdvances
        },
        grandTotals: {
            totalWorkers: labours.length,
            totalPresentDays: grandPresentDays,
            totalOtHours: grandOtHours,
            totalAdvances: grandAdvances,
            totalGrossEarned: grandGrossEarned,
            totalPaid: grandTotalPaid,
            totalNetPayable: grandNetPayable
        }
    });
});

export const logLabourAdvance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, amount, date, notes, site_id } = req.body;

    if (!labour_id || !amount || !date) {
        throw new AppError('labour_id, amount, and date are required', 400);
    }

    // Verify labour belongs to org
    const worker = await attendanceDB('labours')
        .where({ labour_id: Number(labour_id), org_id })
        .first();
    if (!worker) {
        throw new AppError('Labour worker not found in your organization', 404);
    }

    const cleanSiteId = (site_id && site_id !== 'All') ? Number(site_id) : null;
    if (cleanSiteId) {
        const site = await attendanceDB('labour_sites')
            .where({ site_id: cleanSiteId, org_id })
            .first();
        if (!site) {
            throw new AppError('Site not found in your organization', 404);
        }
    }

    const [advance_id] = await attendanceDB('labour_advances').insert({
        org_id,
        labour_id: Number(labour_id),
        site_id: cleanSiteId,
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

export const getLabourAdvances = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, month, site_id } = req.query;

    if (!labour_id) {
        throw new AppError('labour_id is required', 400);
    }

    const query = attendanceDB('labour_advances as a')
        .leftJoin('labour_sites as s', function() {
            this.on('a.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where({ 'a.org_id': org_id, 'a.labour_id': Number(labour_id) });

    if (site_id && site_id !== 'All') {
        query.where('a.site_id', Number(site_id));
    }

    if (month) {
        // month is format YYYY-MM
        const { start, end } = getMonthBounds(month);
        query.where('a.date', '>=', start).where('a.date', '<=', end);
    }

    const advances = await query
        .select(
            'a.advance_id',
            'a.labour_id',
            'a.site_id',
            's.site_name',
            'a.amount',
            'a.date',
            'a.notes',
            'a.created_at'
        )
        .orderBy('a.date', 'desc')
        .orderBy('a.created_at', 'desc')
        .orderBy('a.advance_id', 'desc');

    const payoutsQuery = attendanceDB('labour_monthly_payouts as p')
        .leftJoin('labour_sites as s', function() {
            this.on('p.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where({ 'p.org_id': org_id, 'p.labour_id': Number(labour_id), 'p.status': 'Paid' });

    if (site_id && site_id !== 'All') {
        payoutsQuery.where('p.site_id', Number(site_id));
    }

    if (month) {
        payoutsQuery.where('p.month', month);
    }

    const payouts = await payoutsQuery
        .select(
            'p.payout_id',
            'p.site_id',
            's.site_name',
            'p.paid_amount',
            'p.payment_date',
            'p.month',
            'p.created_at',
            'p.notes'
        )
        .orderBy('p.payment_date', 'desc')
        .orderBy('p.created_at', 'desc')
        .orderBy('p.payout_id', 'desc');

    res.json({
        success: true,
        advances,
        payouts
    });
});

export const deleteLabourAdvance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    const existing = await attendanceDB('labour_advances')
        .where({ advance_id: Number(id), org_id })
        .first();

    if (!existing) {
        throw new AppError('Advance record not found in your organization', 404);
    }

    await attendanceDB('labour_advances')
        .where({ advance_id: Number(id), org_id })
        .del();

    res.json({
        success: true,
        message: 'Advance record deleted successfully'
    });
});

// Helper function to calculate worker outstanding balances per site within org
async function getLabourBalancesPerSite(labour_id, org_id) {
    const worker = await attendanceDB('labours')
        .where({ labour_id, org_id })
        .first();
    if (!worker) return [];

    // Fetch all attendance for this worker in this org
    const attendance = await attendanceDB('labour_attendance')
        .where({ labour_id, org_id })
        .select('status', 'date', 'site_id', 'overtime_hours');

    // Fetch daily schedules for this worker in this org
    const dailySchedules = await attendanceDB('labour_daily_schedule')
        .where({ labour_id, org_id })
        .select('site_id', 'date');

    const scheduleCountMap = {};
    dailySchedules.forEach(sch => {
        const dateStr = formatDateSafe(sch.date);
        if (!scheduleCountMap[dateStr]) {
            scheduleCountMap[dateStr] = 0;
        }
        scheduleCountMap[dateStr] += 1;
    });

    // Group attendance by site and month
    const siteAttendance = {};
    attendance.forEach(rec => {
        const sId = rec.site_id || 0;
        if (!sId) return;
        if (!siteAttendance[sId]) siteAttendance[sId] = {};
        const dateStr = formatDateSafe(rec.date);
        const monthKey = dateStr.slice(0, 7);
        if (!siteAttendance[sId][monthKey]) {
            siteAttendance[sId][monthKey] = { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0, weightSum: 0, overtimeCreditSum: 0 };
        }
        if (rec.status === 'Present') siteAttendance[sId][monthKey].Present += 1;
        else if (rec.status === 'Absent') siteAttendance[sId][monthKey].Absent += 1;
        else if (rec.status === 'Half Day') siteAttendance[sId][monthKey].HalfDay += 1;
        else if (rec.status === 'Paid Leave') siteAttendance[sId][monthKey].PaidLeave += 1;

        // Compute split weight based on scheduled sites count (S)
        const S = scheduleCountMap[dateStr] || 1;
        let w = 0;
        if (rec.status === 'Present' || rec.status === 'Paid Leave') {
            w = 1 / S;
        } else if (rec.status === 'Half Day') {
            w = 0.5 / S;
        }
        siteAttendance[sId][monthKey].weightSum += w;

        // Accumulate overtime pay
        const otRate = Number(worker.overtime_pay_per_hour || 0);
        siteAttendance[sId][monthKey].overtimeCreditSum += Number(rec.overtime_hours || 0) * otRate;
    });

    // Fetch all advances in this org
    const advances = await attendanceDB('labour_advances')
        .where({ labour_id, org_id })
        .select('site_id', 'amount');

    const siteAdvances = {};
    advances.forEach(adv => {
        const sId = adv.site_id || 0;
        if (!siteAdvances[sId]) siteAdvances[sId] = 0;
        siteAdvances[sId] += Number(adv.amount);
    });

    // Fetch all payouts in this org
    const payouts = await attendanceDB('labour_monthly_payouts')
        .where({ labour_id, org_id })
        .andWhere('status', 'Paid')
        .select('site_id', 'paid_amount');

    const sitePaid = {};
    payouts.forEach(p => {
        const sId = p.site_id || 0;
        if (!sitePaid[sId]) sitePaid[sId] = 0;
        sitePaid[sId] += Number(p.paid_amount);
    });

    const monthlySalary = Number(worker.monthly_salary);
    const balances = [];

    // Compute outstanding for each site
    for (const sIdStr of Object.keys(siteAttendance)) {
        const sId = Number(sIdStr);
        let accruedCredit = 0;
        const months = siteAttendance[sId];

        Object.entries(months).forEach(([monthKey, counts]) => {
            const [yearStr, monthStr] = monthKey.split('-');
            const year = Number(yearStr);
            const monthIdx = Number(monthStr) - 1;
            const endOfMonth = new Date(year, monthIdx + 1, 0);
            const totalDays = endOfMonth.getDate();

            const dailyRate = worker.wage_type === 'Daily Wage'
                ? monthlySalary
                : (monthlySalary / totalDays);

            // Dynamic credit calculation using weight sum + overtime pay
            accruedCredit += counts.weightSum * dailyRate + (counts.overtimeCreditSum || 0);
        });

        accruedCredit = Math.round(accruedCredit);
        const advancesTaken = siteAdvances[sId] || 0;
        const totalPaid = sitePaid[sId] || 0;
        const outstanding = accruedCredit - totalPaid - advancesTaken;

        balances.push({
            site_id: sId,
            accrued_credit: accruedCredit,
            advances_taken: advancesTaken,
            total_paid: totalPaid,
            outstanding: Math.max(0, outstanding)
        });
    }

    return balances;
}

export const getMonthlyGridAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month, show_all_sites } = req.query; // month is format YYYY-MM
    if (!site_id || !month) {
        throw new AppError('site_id and month are required', 400);
    }

    const { year, monthNum, totalDays, start, end } = getMonthBounds(month);

    let labours = [];
    if (site_id === 'All') {
        // Fetch all active labours in this org
        labours = await attendanceDB('labours')
            .where({ org_id, status: 'Active' })
            .select('labour_id', 'name', 'role');
    } else {
        // Fetch active labours in this org who are associated with the site in labour_site_relations
        // OR have attendance records logged on this site this month
        labours = await attendanceDB('labours as l')
            .where('l.org_id', org_id)
            .andWhere(function() {
                this.whereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_site_relations')
                        .where({ org_id, site_id: Number(site_id) });
                }).orWhereIn('l.labour_id', function() {
                    this.select('labour_id')
                        .from('labour_attendance')
                        .where({ org_id, site_id: Number(site_id) })
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
            .leftJoin('labour_sites as ls', function() {
                this.on('la.site_id', '=', 'ls.site_id')
                    .andOn('ls.org_id', '=', attendanceDB.raw('?', [org_id]));
            })
            .where('la.org_id', org_id)
            .where('la.date', '>=', start)
            .where('la.date', '<=', end)
            .whereIn('la.labour_id', labourIds);

        // If not showing all sites (and not in 'All' view), filter strictly by the selected site
        if (site_id !== 'All' && show_all_sites !== 'true') {
            query.where('la.site_id', Number(site_id));
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
        const dateStr = formatDateSafe(rec.date);
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
            monthNum
        },
        grid
    });
});

export const bulkTransferLabours = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { source_site_id, destination_site_id, labour_ids } = req.body;

    if (!Array.isArray(labour_ids) || labour_ids.length === 0) {
        throw new AppError('labour_ids array is required', 400);
    }

    const targetSiteId = destination_site_id ? Number(destination_site_id) : null;
    if (targetSiteId) {
        const validSite = await attendanceDB('labour_sites')
            .where({ site_id: targetSiteId, org_id })
            .first();
        if (!validSite) {
            throw new AppError('Destination site not found in your organization', 404);
        }
    }

    await attendanceDB('labours')
        .where('org_id', org_id)
        .whereIn('labour_id', labour_ids)
        .update({
            site_id: targetSiteId,
            updated_at: attendanceDB.fn.now()
        });

    if (targetSiteId) {
        for (const labId of labour_ids) {
            const existing = await attendanceDB('labour_site_relations')
                .where({ org_id, labour_id: labId, site_id: targetSiteId })
                .first();
            if (!existing) {
                await attendanceDB('labour_site_relations').insert({
                    org_id,
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
    const { org_id } = req.user;
    const { labours } = req.body;

    if (!Array.isArray(labours) || labours.length === 0) {
        throw new AppError('labours array is required', 400);
    }

    // Retrieve active sites for this org to resolve site_name to site_id
    const sites = await attendanceDB('labour_sites')
        .select('site_id', 'site_name')
        .where('org_id', org_id)
        .whereNot('status', 'Inactive');
    
    const siteMap = {};
    sites.forEach(s => {
        siteMap[s.site_name.trim().toLowerCase()] = s.site_id;
    });

    // Check unique phone numbers within this organization
    const existingLabours = await attendanceDB('labours')
        .where('org_id', org_id)
        .select('phone');
    const existingPhones = new Set(existingLabours.map(l => l.phone).filter(Boolean));
    const phonesInBatch = new Set();

    await ensureWageHistoryTable();

    const insertData = labours.map(lab => {
        const { name, phone, sex, role, wage_type, monthly_salary, allowed_leaves, site_id, site_name, overtime_pay_per_hour } = lab;

        if (!name || !role) {
            throw new AppError('Name and role are required for all workers', 400);
        }

        const cleanPhone = phone ? String(phone).trim() : null;
        if (cleanPhone) {
            if (existingPhones.has(cleanPhone) || phonesInBatch.has(cleanPhone)) {
                throw new AppError(`A worker with phone number ${cleanPhone} already exists in your organization`, 400);
            }
            phonesInBatch.add(cleanPhone);
        }

        // Resolve site_id from site_name if site_id is not directly provided
        let resolvedSiteId = site_id ? Number(site_id) : null;
        if (!resolvedSiteId && site_name) {
            const cleanSiteName = site_name.trim().toLowerCase();
            resolvedSiteId = siteMap[cleanSiteName] || null;
        }

        const wageNum = monthly_salary !== undefined && monthly_salary !== '' ? Number(monthly_salary) : 0;
        const otNum = overtime_pay_per_hour !== undefined && overtime_pay_per_hour !== '' ? Number(overtime_pay_per_hour) : 0;

        return {
            org_id,
            name,
            phone: cleanPhone,
            sex: sex || 'Male',
            role,
            wage_type: 'Daily Wage',
            monthly_salary: isNaN(wageNum) ? 0 : wageNum,
            allowed_leaves: Number(allowed_leaves) || 0,
            site_id: resolvedSiteId,
            overtime_pay_per_hour: isNaN(otNum) ? 0 : otNum,
            status: 'Active',
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
        };
    });

    await attendanceDB.transaction(async (trx) => {
        const todayStr = formatDateSafe(new Date());
        for (const data of insertData) {
            const [labour_id] = await trx('labours').insert(data);
            if (data.site_id) {
                await trx('labour_site_relations').insert({
                    org_id,
                    labour_id,
                    site_id: data.site_id
                });
            }
            if (data.monthly_salary > 0 || data.overtime_pay_per_hour > 0) {
                await trx('labour_wage_history').insert({
                    org_id,
                    labour_id,
                    effective_date: todayStr,
                    wage_type: 'Daily Wage',
                    daily_wage: data.monthly_salary,
                    overtime_pay_per_hour: data.overtime_pay_per_hour,
                    notes: 'Initial Bulk Upload Rate'
                });
            }
        }
    });

    await cacheService.delPattern(`labour:*:${org_id}:*`);

    res.status(201).json({
        success: true,
        message: `Successfully created ${insertData.length} labour profiles`
    });
});

export const getLabourWorkHistory = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    const labour = await attendanceDB('labours')
        .where({ labour_id: id, org_id })
        .first();

    if (!labour) {
        throw new AppError('Labour worker not found in your organization', 404);
    }

    const history = await attendanceDB('labour_attendance as a')
        .leftJoin('labour_sites as s', function() {
            this.on('a.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where({ 'a.labour_id': id, 'a.org_id': org_id })
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

    // Compute global all-time balance metrics within org
    const balances = await getLabourBalancesPerSite(id, org_id);
    let global_earned = 0;
    let global_advances = 0;
    let global_paid = 0;
    
    balances.forEach(b => {
        global_earned += b.accrued_credit;
        global_advances += b.advances_taken;
        global_paid += b.total_paid;
    });

    const global_net_payable = global_earned - global_advances - global_paid;

    const payouts = await attendanceDB('labour_monthly_payouts as p')
        .leftJoin('labour_sites as s', function() {
            this.on('p.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .where({ 'p.labour_id': id, 'p.org_id': org_id })
        .select('p.*', 's.site_name')
        .orderBy('p.payment_date', 'desc')
        .orderBy('p.created_at', 'desc');

    res.json({
        success: true,
        labour: {
            labour_id: labour.labour_id,
            name: labour.name,
            role: labour.role,
            status: labour.status,
            wage_type: labour.wage_type,
            monthly_salary: Number(labour.monthly_salary),
            global_earned,
            global_advances,
            global_paid,
            global_net_payable
        },
        history,
        payouts
    });
});

export const logLabourPayout = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const {
        payout_id, labour_id, site_id, month, wage_type, monthly_salary,
        present_days, half_days, absent_days, paid_leaves,
        accrued_credit, advances_taken, net_payable, paid_amount,
        status, payment_date, notes
    } = req.body;

    if (!labour_id || monthly_salary === undefined || accrued_credit === undefined || net_payable === undefined || !payment_date) {
        throw new AppError('labour_id, monthly_salary, accrued_credit, net_payable, and payment_date are required', 400);
    }

    const worker = await attendanceDB('labours')
        .where({ labour_id: Number(labour_id), org_id })
        .first();

    if (!worker) {
        throw new AppError('Labour worker not found in your organization', 404);
    }

    // Helper to perform individual site payout insert/update
    const saveSinglePayout = async (data) => {
        const recordData = {
            org_id,
            labour_id: data.labour_id,
            site_id: data.site_id,
            month: data.month || (payment_date ? formatDateSafe(payment_date).slice(0, 7) : new Date().toISOString().slice(0, 7)),
            wage_type: data.wage_type || 'Daily Wage',
            monthly_salary: Number(data.monthly_salary),
            present_days: Number(data.present_days || 0),
            half_days: Number(data.half_days || 0),
            absent_days: Number(data.absent_days || 0),
            paid_leaves: Number(data.paid_leaves || 0),
            accrued_credit: Number(data.accrued_credit),
            advances_taken: Number(data.advances_taken || 0),
            net_payable: Number(data.net_payable),
            paid_amount: Number(data.paid_amount),
            status: data.status || 'Paid',
            payment_date,
            notes: data.notes || null,
            updated_at: attendanceDB.fn.now()
        };

        if (data.payout_id) {
            await attendanceDB('labour_monthly_payouts')
                .where({ payout_id: data.payout_id, org_id })
                .update(recordData);
            return data.payout_id;
        } else {
            const [new_id] = await attendanceDB('labour_monthly_payouts').insert({
                ...recordData,
                created_at: attendanceDB.fn.now()
            });
            return new_id;
        }
    };

    // Edit case
    if (payout_id) {
        await saveSinglePayout({ ...req.body, payout_id });
        return res.json({
            success: true,
            message: 'Payout updated successfully',
            payout_id
        });
    }

    // New release case
    const cleanSiteId = (site_id && site_id !== 'All') ? Number(site_id) : null;
    const inputPaidAmount = Number(paid_amount);

    if (cleanSiteId) {
        // Direct payment to a single site
        const new_id = await saveSinglePayout({
            labour_id,
            site_id: cleanSiteId,
            month,
            wage_type,
            monthly_salary,
            present_days,
            half_days,
            absent_days,
            paid_leaves,
            accrued_credit,
            advances_taken,
            net_payable,
            paid_amount: inputPaidAmount,
            status,
            notes
        });

        return res.status(201).json({
            success: true,
            message: 'Payout logged successfully',
            payout_id: new_id
        });
    } else {
        // Global Payout / Auto-Distribution case
        const balances = await getLabourBalancesPerSite(labour_id, org_id);
        let remaining = inputPaidAmount;
        const createdIds = [];

        // Distribute to sites with outstanding balance
        for (const bal of balances) {
            if (remaining <= 0) break;
            if (bal.outstanding <= 0) continue;

            const alloc = Math.min(remaining, bal.outstanding);
            
            const new_id = await saveSinglePayout({
                labour_id,
                site_id: bal.site_id,
                month,
                wage_type,
                monthly_salary,
                present_days: 0,
                half_days: 0,
                absent_days: 0,
                paid_leaves: 0,
                accrued_credit: bal.accrued_credit,
                advances_taken: bal.advances_taken,
                net_payable: bal.outstanding,
                paid_amount: alloc,
                status,
                notes: notes ? `${notes} (Auto-allocated)` : 'Auto-allocated from global payment'
            });
            
            createdIds.push(new_id);
            remaining -= alloc;
        }

        // If there is still remainder (overpayment), allocate to worker's primary site
        if (remaining > 0) {
            const primarySiteId = worker ? worker.site_id : null;
            
            const new_id = await saveSinglePayout({
                labour_id,
                site_id: primarySiteId,
                month,
                wage_type,
                monthly_salary,
                present_days: 0,
                half_days: 0,
                absent_days: 0,
                paid_leaves: 0,
                accrued_credit: 0,
                advances_taken: 0,
                net_payable: 0,
                paid_amount: remaining,
                status,
                notes: notes ? `${notes} (Overpayment)` : 'Global overpayment allocation'
            });
            
            createdIds.push(new_id);
        }

        return res.status(201).json({
            success: true,
            message: `Global payout processed and split across ${createdIds.length} sites`,
            payout_ids: createdIds
        });
    }
});

export const downloadBulkTemplate = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Sex', key: 'sex', width: 10 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Daily Wage', key: 'monthly_salary', width: 18 },
        { header: 'Overtime Pay Per Hour', key: 'overtime_pay_per_hour', width: 22 },
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
        monthly_salary: 600,
        overtime_pay_per_hour: 100,
        site_name: ''
    });

    const sites = await attendanceDB('labour_sites')
        .where('org_id', org_id)
        .select('site_name')
        .whereNot('status', 'Inactive');
    
    for (let i = 2; i <= 100; i++) {
        worksheet.getCell(`C${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Male,Female,Other"']
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
    const { org_id } = req.user;
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
    const salaryCol = headerMap['daily wage'] || headerMap['daily_wage'] || headerMap['monthly salary'] || headerMap['salary'];
    const otPayCol = headerMap['overtime pay per hour'] || headerMap['overtime_pay_per_hour'] || headerMap['overtime pay'] || headerMap['overtime_pay'];

    if (!nameCol || !roleCol || !salaryCol) {
        throw new AppError('Missing required columns: Name, Role, and Daily Wage (or Monthly Salary) must be defined in the header row.', 400);
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
        .where('org_id', org_id)
        .select('site_id', 'site_name')
        .whereNot('status', 'Inactive');
    
    const siteMap = {};
    sites.forEach(s => {
        siteMap[s.site_name.trim().toLowerCase()] = s.site_id;
    });

    const existingLabours = await attendanceDB('labours')
        .where('org_id', org_id)
        .select('phone');
    const existingPhones = new Set(existingLabours.map(l => l.phone).filter(Boolean));
    const phonesInBatch = new Set();

    const sexCol = headerMap['sex'] || headerMap['gender'];
    const phoneCol = headerMap['phone'] || headerMap['mobile'];
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
        const otPayVal = otPayCol ? getVal(row, otPayCol) : '';
        const overtime_pay_per_hour = otPayVal ? Number(otPayVal) : 0;
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
            error += 'Valid Daily Wage is required. ';
        }

        const cleanPhone = phone ? phone.trim() : '';
        if (cleanPhone) {
            if (existingPhones.has(cleanPhone) || phonesInBatch.has(cleanPhone)) {
                isValid = false;
                error += `Phone number ${cleanPhone} already exists in your organization. `;
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
                error += `Construction site "${site_name}" does not exist in your organization. `;
            }
        }

        parsed.push({
            name,
            phone: cleanPhone,
            sex,
            role,
            wage_type: 'Daily Wage',
            monthly_salary: isNaN(monthly_salary) ? '' : monthly_salary,
            overtime_pay_per_hour: isNaN(overtime_pay_per_hour) ? 0 : overtime_pay_per_hour,
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
