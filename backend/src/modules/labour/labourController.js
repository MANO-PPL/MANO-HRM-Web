import catchAsync from '../../utils/catchAsync.js';
import * as labourService from './labourService.js';


// ==========================================
// 1. SITE CONTROLLERS
// ==========================================

export const getAllSites = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const sites = await labourService.getAllSites(org_id);
    res.json({
        success: true,
        sites
    });
});

export const createSite = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_name, location_details, status, end_date } = req.body;
    const { site_id } = await labourService.createSite({
        org_id,
        site_name,
        location_details,
        status,
        end_date
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

    await labourService.updateSite({
        org_id,
        site_id: id,
        site_name,
        location_details,
        status,
        end_date
    });

    res.json({
        success: true,
        message: 'Site updated successfully'
    });
});

export const deleteSite = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    await labourService.deleteSite({ org_id, site_id: id });

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
    const labours = await labourService.getAllLabours(org_id);
    res.json({
        success: true,
        labours
    });
});

export const createLabour = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const {
        name,
        phone,
        sex,
        role,
        wage_type,
        monthly_salary,
        allowed_leaves,
        site_id,
        overtime_pay_per_hour,
        effective_date,
        notes
    } = req.body;

    const { labour_id } = await labourService.createLabour({
        org_id,
        name,
        phone,
        sex,
        role,
        wage_type,
        monthly_salary,
        allowed_leaves,
        site_id,
        overtime_pay_per_hour,
        effective_date,
        notes,
        user_id: req.user?.id || req.user?.user_id || null
    });

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

    await labourService.updateLabour({
        org_id,
        labour_id: id,
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
        notes,
        user_id: req.user?.id || req.user?.user_id || null
    });

    res.json({
        success: true,
        message: 'Labour updated successfully'
    });
});

export const deleteLabour = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    await labourService.deleteLabour({ org_id, labour_id: id });

    res.json({
        success: true,
        message: 'Labour deleted successfully'
    });
});

// ==========================================
// 3. WAGE HISTORY CONTROLLERS
// ==========================================

export const getLabourWageHistory = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    const result = await labourService.getLabourWageHistory({ org_id, labour_id: id });
    res.json({
        success: true,
        ...result
    });
});

export const addLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;
    const { effective_date, daily_wage, overtime_pay_per_hour, notes } = req.body;

    await labourService.addLabourWageRevision({
        org_id,
        labour_id: id,
        effective_date,
        daily_wage,
        overtime_pay_per_hour,
        notes,
        user_id: req.user?.id || req.user?.user_id || null
    });

    res.status(201).json({
        success: true,
        message: 'Wage revision added successfully'
    });
});

export const updateLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { revisionId } = req.params;
    const { effective_date, daily_wage, overtime_pay_per_hour, notes } = req.body;

    await labourService.updateLabourWageRevision({
        org_id,
        revisionId,
        effective_date,
        daily_wage,
        overtime_pay_per_hour,
        notes
    });

    res.json({
        success: true,
        message: 'Wage revision updated successfully'
    });
});

export const deleteLabourWageRevision = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { revisionId } = req.params;

    await labourService.deleteLabourWageRevision({ org_id, revisionId });

    res.json({
        success: true,
        message: 'Wage revision deleted successfully'
    });
});

// ==========================================
// 4. ATTENDANCE CONTROLLERS
// ==========================================

export const getSiteAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, date } = req.query;

    const result = await labourService.getSiteAttendance({ org_id, site_id, date });

    res.json({
        success: true,
        date,
        site_id: Number(site_id),
        ...result
    });
});

export const saveSiteAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, date, roster } = req.body;
    const marked_by = req.user?.id || req.user?.user_id || null;

    await labourService.saveSiteAttendance({
        org_id,
        site_id,
        date,
        roster,
        marked_by
    });

    res.json({
        success: true,
        message: 'Attendance saved successfully'
    });
});

export const getMonthlyGridAttendance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month, show_all_sites } = req.query;

    const result = await labourService.getMonthlyGridAttendance({
        org_id,
        site_id,
        month,
        show_all_sites
    });

    res.json({
        success: true,
        ...result
    });
});

// ==========================================
// 5. FINANCIAL / SALARY CREDIT CONTROLLERS
// ==========================================

export const getFinancesSummary = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month } = req.query;

    const result = await labourService.getFinancesSummary({ org_id, site_id, month });

    res.json({
        success: true,
        ...result
    });
});

export const getDetailedMonthlyLedger = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month, till_date } = req.query;

    const result = await labourService.getDetailedMonthlyLedger({
        org_id,
        site_id,
        month,
        till_date
    });

    res.json({
        success: true,
        ...result
    });
});

export const logLabourAdvance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labour_id, amount, date, notes, site_id } = req.body;

    const { advance_id } = await labourService.logLabourAdvance({
        org_id,
        labour_id,
        amount,
        date,
        notes,
        site_id
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

    const result = await labourService.getLabourAdvances({
        org_id,
        labour_id,
        month,
        site_id
    });

    res.json({
        success: true,
        ...result
    });
});

export const deleteLabourAdvance = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    await labourService.deleteLabourAdvance({ org_id, id });

    res.json({
        success: true,
        message: 'Advance record deleted successfully'
    });
});

export const getLabourWorkHistory = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { id } = req.params;

    const result = await labourService.getLabourWorkHistory({ org_id, id });

    res.json({
        success: true,
        ...result
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

    const result = await labourService.logLabourPayout({
        org_id,
        payout_id,
        labour_id,
        site_id,
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
        paid_amount,
        status,
        payment_date,
        notes,
        raw_body: req.body
    });

    if (result.is_edit) {
        return res.json({
            success: true,
            message: 'Payout updated successfully',
            payout_id: result.payout_id
        });
    }

    if (result.is_global) {
        return res.status(201).json({
            success: true,
            message: `Global payout processed and split across ${result.payout_ids.length} sites`,
            payout_ids: result.payout_ids
        });
    }

    return res.status(201).json({
        success: true,
        message: 'Payout logged successfully',
        payout_id: result.payout_id
    });
});

// ==========================================
// 6. BULK OPERATIONS CONTROLLERS
// ==========================================

export const bulkTransferLabours = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { source_site_id, destination_site_id, labour_ids } = req.body;

    const { transferred_count } = await labourService.bulkTransferLabours({
        org_id,
        source_site_id,
        destination_site_id,
        labour_ids
    });

    res.json({
        success: true,
        message: `Successfully transferred ${transferred_count} workers.`
    });
});

export const bulkCreateLabours = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { labours } = req.body;

    const { created_count } = await labourService.bulkCreateLabours({
        org_id,
        labours
    });

    res.status(201).json({
        success: true,
        message: `Successfully created ${created_count} labour profiles`
    });
});

export const downloadBulkTemplate = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const workbook = await labourService.generateBulkTemplateWorkbook(org_id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=labour_bulk_upload_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

export const parseBulkLabours = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const parsed = await labourService.parseBulkLaboursFile({
        org_id,
        file: req.file
    });

    res.json({
        success: true,
        parsed
    });
});
