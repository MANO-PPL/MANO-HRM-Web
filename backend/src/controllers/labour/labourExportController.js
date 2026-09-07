import ExcelJS from 'exceljs';
import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { formatDateSafe, getMonthBounds, buildWageRateResolver } from './labourController.js';

/**
 * Helper to convert 1-based column number into Excel column letter(s) (e.g. 1 -> 'A', 27 -> 'AA', 42 -> 'AP')
 */
function getExcelCol(colNumber) {
    let dividend = colNumber;
    let columnName = '';
    let modulo;
    while (dividend > 0) {
        modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
}

/**
 * Constructs an Excel formula snippet to calculate total effective present days across an attendance range.
 * Supports:
 * - 'P' -> 1.0
 * - 'HD' -> 0.5 (Default 4 hours)
 * - Wildcard hours matching: 'HD*1*' -> 1/8 (0.125), 'HD*2*' -> 2/8 (0.25), 'HD*3*' -> 3/8 (0.375), 'HD*4*' -> 4/8 (0.5), 'HD*5*' -> 5/8 (0.625), 'HD*6*' -> 6/8 (0.75), 'HD*7*' -> 7/8 (0.875)
 * Handles any user-entered text variations in Excel like 'HD (3h)', 'HD(3h)', 'HD 3 hrs', 'HD (3.0)', etc.
 */
function buildAttdFormulaSnippet(range) {
    return `COUNTIF(${range},"P")+COUNTIF(${range},"HD")*0.5+COUNTIF(${range},"HD*4*")*0.5+COUNTIF(${range},"HD*1*")*0.125+COUNTIF(${range},"HD*2*")*0.25+COUNTIF(${range},"HD*3*")*0.375+COUNTIF(${range},"HD*5*")*0.625+COUNTIF(${range},"HD*6*")*0.75+COUNTIF(${range},"HD*7*")*0.875`;
}

/**
 * Controller to export the Complete 3-Row Daily Spreadsheet & Monthly Wage Ledger to styled Excel (.xlsx)
 * 100% Formula-Driven & Color-Reactive via native Excel COUNTIF/SUMIF/SUM and Conditional Formatting.
 * Balance Payable = Gross Amount (Base + OT) - Total Advances (independent of recorded payouts)
 */
export const exportDetailedMonthlyLedgerExcel = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month } = req.query;

    if (!site_id) {
        throw new AppError('site_id parameter is required (use a valid ID or "All")', 400);
    }

    const isAllSites = site_id === 'All';
    let siteName = 'All Sites';
    if (!isAllSites) {
        const site = await attendanceDB('labour_sites')
            .where({ site_id: Number(site_id), org_id })
            .first();
        if (!site) {
            throw new AppError('Site not found in your organization', 404);
        }
        siteName = site.site_name;
    }

    // Fetch organization name if available
    let orgName = 'MANO CONSTRUCTIONS';
    try {
        const org = await attendanceDB('core_organizations')
            .where({ org_id })
            .first();
        if (org && org.company_name) {
            orgName = org.company_name.toUpperCase();
        }
    } catch (e) {
        // Fallback to default
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const { year, monthNum, totalDays, start, end } = getMonthBounds(targetMonth);

    // Month human-readable title (e.g., "August 2026")
    const monthDateObj = new Date(year, monthNum - 1, 1);
    const monthNameLong = monthDateObj.toLocaleString('en-US', { month: 'long' });
    const monthNameShort = monthDateObj.toLocaleString('en-US', { month: 'short' });
    const monthNameYear = `${monthNameLong} ${year}`;

    // 1. Fetch active labours in this site/org or having attendance in this month
    let laboursQuery = attendanceDB('labours as l')
        .leftJoin('labour_site_relations as r', function () {
            this.on('l.labour_id', '=', 'r.labour_id')
                .andOn('r.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .leftJoin('labour_sites as s', function () {
            this.on('r.site_id', '=', 's.site_id')
                .andOn('s.org_id', '=', attendanceDB.raw('?', [org_id]));
        })
        .select(
            'l.labour_id', 'l.name', 'l.role', 'l.wage_type', 'l.monthly_salary', 'l.site_id as primary_site_id', 'l.overtime_pay_per_hour'
        )
        .where('l.org_id', org_id)
        .andWhere('l.status', 'Active');

    if (!isAllSites) {
        laboursQuery.andWhere(function () {
            this.where('l.site_id', Number(site_id))
                .orWhere('r.site_id', Number(site_id))
                .orWhereIn('l.labour_id', function () {
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
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        });
    }

    const labourIds = labours.map(l => l.labour_id);

    // 2. Attendance records for these labours in THIS MONTH
    let attendanceRecords = [];
    if (labourIds.length > 0) {
        const attQuery = attendanceDB('labour_attendance')
            .where('org_id', org_id)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .whereIn('labour_id', labourIds)
            .select('labour_id', 'status', 'date', 'site_id', 'overtime_hours', 'working_hours');

        if (!isAllSites) {
            attQuery.where('site_id', Number(site_id));
        }
        attendanceRecords = await attQuery;
    }

    // 3. Daily Schedules for split divisor
    const scheduleCountMap = {};
    if (labourIds.length > 0) {
        const scheduleRecords = await attendanceDB('labour_daily_schedule')
            .where('org_id', org_id)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .whereIn('labour_id', labourIds)
            .select('labour_id', 'site_id', 'date');

        scheduleRecords.forEach(sch => {
            const dStr = formatDateSafe(sch.date);
            if (!scheduleCountMap[sch.labour_id]) scheduleCountMap[sch.labour_id] = {};
            if (!scheduleCountMap[sch.labour_id][dStr]) scheduleCountMap[sch.labour_id][dStr] = 0;
            scheduleCountMap[sch.labour_id][dStr] += 1;
        });
    }

    // 4. Advances logged in THIS MONTH
    let advancesRecords = [];
    if (labourIds.length > 0) {
        const advQuery = attendanceDB('labour_advances')
            .where('org_id', org_id)
            .whereIn('labour_id', labourIds)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .select('advance_id', 'labour_id', 'amount', 'date', 'site_id', 'notes');

        if (!isAllSites) {
            advQuery.where('site_id', Number(site_id));
        }
        advancesRecords = await advQuery;
    }

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

    // Rate resolver
    const rateResolver = await buildWageRateResolver(labourIds, org_id, end);

    // Track daily totals for initial cached results
    const dailyPresentHeadcount = Array(totalDays).fill(0);
    const dailyOtHours = Array(totalDays).fill(0);
    const dailyAdvances = Array(totalDays).fill(0);

    let grandTotalPresentDays = 0;
    let grandTotalOtHours = 0;
    let grandTotalAdvances = 0;
    let grandTotalGrossAmount = 0;
    let grandTotalBalancePayable = 0;

    // Process workers calculations
    const processedWorkers = labours.map((lab, index) => {
        let workerPresentDaysCount = 0;
        let workerBaseCredit = 0;
        let workerOtHours = 0;
        let workerOtCredit = 0;
        let workerAdvances = 0;

        const daysData = [];
        const dailyRatesList = [];

        daysArray.forEach((dayInfo, idx) => {
            const dStr = dayInfo.dateStr;
            const attRec = (labourAttMap[lab.labour_id] && labourAttMap[lab.labour_id][dStr]) || null;
            const advAmount = (labourAdvMap[lab.labour_id] && labourAdvMap[lab.labour_id][dStr]) || 0;

            const status = attRec ? attRec.status : '';
            const ot = attRec ? Number(attRec.overtime_hours || 0) : 0;
            const workingHours = attRec ? Number(attRec.working_hours || (status === 'Half Day' ? 4 : 8)) : 8;

            // Resolve effective rate for this day
            const dayRates = rateResolver(lab.labour_id, dStr);
            dailyRatesList.push({
                day: dayInfo.day,
                dateStr: dStr,
                daily_rate: dayRates.daily_rate,
                ot_rate: dayRates.overtime_pay_per_hour
            });

            // Split divisor
            const S = (scheduleCountMap[lab.labour_id] && scheduleCountMap[lab.labour_id][dStr]) || 1;
            let weight = 0;
            let dayPresentVal = 0;
            let statusDisplay = '';

            if (status === 'Present') {
                weight = 1.0 / S;
                dayPresentVal = 1.0;
                statusDisplay = 'P';
            } else if (status === 'Half Day') {
                weight = (workingHours / 8.0) / S;
                dayPresentVal = workingHours / 8.0;
                statusDisplay = workingHours === 4 ? 'HD' : `HD (${workingHours}h)`;
            } else if (status === 'Absent') {
                statusDisplay = 'A';
            }

            workerPresentDaysCount += dayPresentVal;
            dailyPresentHeadcount[idx] += dayPresentVal;

            dailyOtHours[idx] += ot;
            dailyAdvances[idx] += advAmount;

            workerBaseCredit += weight * dayRates.daily_rate;
            workerOtHours += ot;
            workerOtCredit += ot * dayRates.overtime_pay_per_hour;
            workerAdvances += advAmount;

            daysData.push({
                day: dayInfo.day,
                status: statusDisplay,
                ot_hours: ot > 0 ? ot : null,
                advance: advAmount > 0 ? advAmount : null
            });
        });

        const grossEarned = Math.round(workerBaseCredit + workerOtCredit);
        const balancePayable = grossEarned - workerAdvances;

        grandTotalPresentDays += workerPresentDaysCount;
        grandTotalOtHours += workerOtHours;
        grandTotalAdvances += workerAdvances;
        grandTotalGrossAmount += grossEarned;
        grandTotalBalancePayable += balancePayable;

        // Group effective rate segments
        const rateSegments = [];
        let curDaily = null;
        let curOt = null;
        let curStartDay = 1;

        dailyRatesList.forEach((dr, i) => {
            if (curDaily === null) {
                curDaily = dr.daily_rate;
                curOt = dr.ot_rate;
                curStartDay = dr.day;
            } else if (curDaily !== dr.daily_rate || curOt !== dr.ot_rate) {
                rateSegments.push({
                    startDay: curStartDay,
                    endDay: dr.day - 1,
                    daily: curDaily,
                    ot: curOt
                });
                curDaily = dr.daily_rate;
                curOt = dr.ot_rate;
                curStartDay = dr.day;
            }

            if (i === dailyRatesList.length - 1) {
                rateSegments.push({
                    startDay: curStartDay,
                    endDay: dr.day,
                    daily: curDaily,
                    ot: curOt
                });
            }
        });

        return {
            sr_no: index + 1,
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role || 'Worker',
            rate_segments: rateSegments,
            days: daysData,
            totals: {
                present_days: workerPresentDaysCount,
                ot_hours: workerOtHours,
                advances: workerAdvances,
                gross_earned: grossEarned,
                balance_payable: balancePayable
            }
        };
    });

    // ==========================================
    // EXCEL WORKBOOK GENERATION VIA EXCELJS
    // ==========================================

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MANO Constructions HR & Attendance';
    workbook.lastModifiedBy = 'MANO System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = `Wage Ledger - ${monthNameShort} ${year}`;
    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }]
    });

    // Determine column mapping dynamically based on totalDays
    const colSr = 1;
    const colWorker = 2;
    const colMetric = 3;
    const dayColStart = 4;
    const dayColEnd = 3 + totalDays;
    const colSubtotal = dayColEnd + 1;
    const colTotalAttd = dayColEnd + 2;
    const colTotalOt = dayColEnd + 3;
    const colDailyWage = dayColEnd + 4;
    const colOtRate = dayColEnd + 5;
    const colGross = dayColEnd + 6;
    const colAdv = dayColEnd + 7;
    const colBal = dayColEnd + 8;
    const totalColumnsCount = colBal;

    // Set column widths
    worksheet.getColumn(colSr).width = 6;
    worksheet.getColumn(colWorker).width = 24;
    worksheet.getColumn(colMetric).width = 11;
    for (let d = 1; d <= totalDays; d++) {
        worksheet.getColumn(dayColStart + d - 1).width = 4.8;
    }
    worksheet.getColumn(colSubtotal).width = 15;
    worksheet.getColumn(colTotalAttd).width = 13;
    worksheet.getColumn(colTotalOt).width = 13;
    worksheet.getColumn(colDailyWage).width = 15;
    worksheet.getColumn(colOtRate).width = 15;
    worksheet.getColumn(colGross).width = 17;
    worksheet.getColumn(colAdv).width = 15;
    worksheet.getColumn(colBal).width = 19;

    // ==========================================
    // ROW 1: DOCUMENT HEADER
    // ==========================================
    const titleRow = worksheet.getRow(1);
    titleRow.height = 30;
    titleRow.getCell(1).value = `${orgName} - MONTHLY LABOUR WAGE & ATTENDANCE LEDGER`;
    titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, totalColumnsCount);

    // ==========================================
    // ROW 2: SUBTITLE / METADATA
    // ==========================================
    const subtitleRow = worksheet.getRow(2);
    subtitleRow.height = 20;
    const generatedTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    subtitleRow.getCell(1).value = `Site: ${siteName.toUpperCase()}   |   Month: ${monthNameYear.toUpperCase()}   |   Generated: ${generatedTimestamp}`;
    subtitleRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE2E8F0' } };
    subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Medium Slate
    subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(2, 1, 2, totalColumnsCount);

    // ==========================================
    // ROW 3: BLANK DIVIDER
    // ==========================================
    const dividerRow = worksheet.getRow(3);
    dividerRow.height = 6;
    dividerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    // ==========================================
    // ROW 4: TABLE COLUMN HEADERS
    // ==========================================
    const headerRow = worksheet.getRow(4);
    headerRow.height = 28;

    const headers = [
        { col: colSr, text: 'Sr.' },
        { col: colWorker, text: 'Labour Name & Role' },
        { col: colMetric, text: 'Metric' }
    ];

    daysArray.forEach((dInfo, i) => {
        headers.push({
            col: dayColStart + i,
            text: String(dInfo.day),
            isWeekend: dInfo.isWeekend
        });
    });

    headers.push(
        { col: colSubtotal, text: 'Month Subtotals' },
        { col: colTotalAttd, text: 'Total Attd' },
        { col: colTotalOt, text: 'Total OT (hrs)' },
        { col: colDailyWage, text: 'Daily Wage (₹)' },
        { col: colOtRate, text: 'OT Rate (₹/hr)' },
        { col: colGross, text: 'Gross Amount (₹)' },
        { col: colAdv, text: 'Advance (₹)' },
        { col: colBal, text: 'Balance Payable (₹)' }
    );

    headers.forEach(h => {
        const cell = headerRow.getCell(h.col);
        cell.value = h.text;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        const bgColor = h.isWeekend ? 'FF3730A3' : 'FF4F46E5'; // Indigo headers with weekend accent
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF312E81' } },
            left: { style: 'thin', color: { argb: 'FF4338CA' } },
            bottom: { style: 'medium', color: { argb: 'FF312E81' } },
            right: { style: 'thin', color: { argb: 'FF4338CA' } }
        };
    });

    // ==========================================
    // DATA ROWS: 3 ROWS PER EMPLOYEE
    // ==========================================
    let currentRowIdx = 5;

    const thinBorder = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const thickBottomBorder = { style: 'medium', color: { argb: 'FF94A3B8' } };

    processedWorkers.forEach(worker => {
        const r1 = currentRowIdx;
        const r2 = currentRowIdx + 1;
        const r3 = currentRowIdx + 2;

        const row1 = worksheet.getRow(r1);
        const row2 = worksheet.getRow(r2);
        const row3 = worksheet.getRow(r3);

        row1.height = 20;
        row2.height = 18;
        row3.height = 18;

        // Column A: Sr Number (Merged r1..r3)
        row1.getCell(colSr).value = worker.sr_no;
        row1.getCell(colSr).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        row1.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'center' };

        // Column B: Name & Role (Merged r1..r3)
        row1.getCell(colWorker).value = `${worker.name}\n(${worker.role})`;
        row1.getCell(colWorker).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        row1.getCell(colWorker).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        // Column C: Metric labels
        row1.getCell(colMetric).value = 'Attd';
        row1.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF059669' } }; // Emerald
        row1.getCell(colMetric).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        row1.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

        row2.getCell(colMetric).value = 'OT (hrs)';
        row2.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4F46E5' } }; // Indigo
        row2.getCell(colMetric).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
        row2.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

        row3.getCell(colMetric).value = 'Adv (₹)';
        row3.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFD97706' } }; // Amber
        row3.getCell(colMetric).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        row3.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

        // Days 1..totalDays (Populate raw values; conditional formatting handles colors dynamically)
        worker.days.forEach((dayObj, i) => {
            const col = dayColStart + i;
            const isWeekend = daysArray[i].isWeekend;

            // Row 1: Attendance
            const cell1 = row1.getCell(col);
            cell1.value = dayObj.status || null;
            cell1.font = { name: 'Calibri', size: 9.5, bold: true };
            cell1.alignment = { vertical: 'middle', horizontal: 'center' };
            if (isWeekend) {
                cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }

            // Row 2: OT Hours
            const cell2 = row2.getCell(col);
            cell2.value = dayObj.ot_hours;
            cell2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
            cell2.alignment = { vertical: 'middle', horizontal: 'center' };
            if (isWeekend) {
                cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            if (typeof dayObj.ot_hours === 'number') cell2.numFmt = '0.0';

            // Row 3: Advance Amount
            const cell3 = row3.getCell(col);
            cell3.value = dayObj.advance;
            cell3.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF92400E' } };
            cell3.alignment = { vertical: 'middle', horizontal: 'center' };
            if (isWeekend) {
                cell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            if (typeof dayObj.advance === 'number') cell3.numFmt = '₹#,##0';
        });

        // -----------------------------------------------------------------
        // FORMULAS: Month Subtotals Column
        // -----------------------------------------------------------------
        const attdRange = `${getExcelCol(dayColStart)}${r1}:${getExcelCol(dayColEnd)}${r1}`;
        const otRange = `${getExcelCol(dayColStart)}${r2}:${getExcelCol(dayColEnd)}${r2}`;
        const advRange = `${getExcelCol(dayColStart)}${r3}:${getExcelCol(dayColEnd)}${r3}`;

        // Row 1: Attd Days Subtotal Formula (Pro-rata weighted count with wildcard support)
        const attdFormula = buildAttdFormulaSnippet(attdRange);
        row1.getCell(colSubtotal).value = { formula: attdFormula, result: Number(worker.totals.present_days.toFixed(2)) };
        row1.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
        row1.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        row1.getCell(colSubtotal).numFmt = '0.0" Days"';

        // Row 2: OT Hours Subtotal Formula
        const otFormula = `SUM(${otRange})`;
        row2.getCell(colSubtotal).value = { formula: otFormula, result: Number(worker.totals.ot_hours.toFixed(1)) };
        row2.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
        row2.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row2.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
        row2.getCell(colSubtotal).numFmt = '0.0" hrs"';

        // Row 3: Advance Amount Subtotal Formula
        const advFormula = `SUM(${advRange})`;
        row3.getCell(colSubtotal).value = { formula: advFormula, result: worker.totals.advances };
        row3.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
        row3.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row3.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        row3.getCell(colSubtotal).numFmt = '₹#,##0';

        // -----------------------------------------------------------------
        // FORMULAS: Summary Columns (Total Attd, Total OT, Rates, Gross, Adv, Bal)
        // -----------------------------------------------------------------
        const subtotalColLet = getExcelCol(colSubtotal);
        const totalAttdColLet = getExcelCol(colTotalAttd);
        const totalOtColLet = getExcelCol(colTotalOt);
        const dailyWageColLet = getExcelCol(colDailyWage);
        const otRateColLet = getExcelCol(colOtRate);
        const grossColLet = getExcelCol(colGross);
        const advColLet = getExcelCol(colAdv);
        const balColLet = getExcelCol(colBal);

        // Total Attd (Row 1, merged r1..r3)
        row1.getCell(colTotalAttd).value = { formula: `${subtotalColLet}${r1}`, result: Number(worker.totals.present_days.toFixed(2)) };
        row1.getCell(colTotalAttd).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        row1.getCell(colTotalAttd).alignment = { vertical: 'middle', horizontal: 'center' };
        row1.getCell(colTotalAttd).numFmt = '0.0';

        // Total OT (Row 1, merged r1..r3)
        row1.getCell(colTotalOt).value = { formula: `${subtotalColLet}${r2}`, result: Number(worker.totals.ot_hours.toFixed(1)) };
        row1.getCell(colTotalOt).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4F46E5' } };
        row1.getCell(colTotalOt).alignment = { vertical: 'middle', horizontal: 'center' };
        row1.getCell(colTotalOt).numFmt = '0.0';

        // Rate setup (Single vs Multi-Tier Wage Revision)
        const segments = worker.rate_segments || [];
        let grossFormula = '';

        if (segments.length <= 1) {
            const seg = segments[0] || { daily: 0, ot: 0 };
            
            // Row 1 Rate Cells (Numeric and editable)
            row1.getCell(colDailyWage).value = seg.daily;
            row1.getCell(colDailyWage).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
            row1.getCell(colDailyWage).alignment = { vertical: 'middle', horizontal: 'right' };
            row1.getCell(colDailyWage).numFmt = '₹#,##0';

            row1.getCell(colOtRate).value = seg.ot;
            row1.getCell(colOtRate).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
            row1.getCell(colOtRate).alignment = { vertical: 'middle', horizontal: 'right' };
            row1.getCell(colOtRate).numFmt = '₹#,##0';

            // Direct formula multiplying Total Attd * Daily Wage + Total OT * OT Rate
            grossFormula = `(${totalAttdColLet}${r1}*${dailyWageColLet}${r1})+(${totalOtColLet}${r1}*${otRateColLet}${r1})`;
        } else {
            // Multi-Tier Wage Revision: Assign rate tiers to Row 1 & Row 2
            const segActive = segments[segments.length - 1]; // Active / Latest rate
            const segPrev = segments[0]; // Previous rate

            // Row 1: Active Rate Tier
            row1.getCell(colDailyWage).value = segActive.daily;
            row1.getCell(colDailyWage).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
            row1.getCell(colDailyWage).alignment = { vertical: 'middle', horizontal: 'right' };
            row1.getCell(colDailyWage).numFmt = '₹#,##0';

            row1.getCell(colOtRate).value = segActive.ot;
            row1.getCell(colOtRate).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
            row1.getCell(colOtRate).alignment = { vertical: 'middle', horizontal: 'right' };
            row1.getCell(colOtRate).numFmt = '₹#,##0';

            // Row 2: Previous Rate Tier
            row2.getCell(colDailyWage).value = segPrev.daily;
            row2.getCell(colDailyWage).font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF64748B' } };
            row2.getCell(colDailyWage).alignment = { vertical: 'middle', horizontal: 'right' };
            row2.getCell(colDailyWage).numFmt = '₹#,##0';

            row2.getCell(colOtRate).value = segPrev.ot;
            row2.getCell(colOtRate).font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF64748B' } };
            row2.getCell(colOtRate).alignment = { vertical: 'middle', horizontal: 'right' };
            row2.getCell(colOtRate).numFmt = '₹#,##0';

            // Row 3: Period note
            row3.getCell(colDailyWage).value = `${segPrev.startDay}-${segPrev.endDay} ${monthNameShort}: ₹${segPrev.daily} → ${segActive.startDay}-${segActive.endDay} ${monthNameShort}: ₹${segActive.daily}`;
            row3.getCell(colDailyWage).font = { name: 'Calibri', size: 7.5, italic: true, color: { argb: 'FF94A3B8' } };
            row3.getCell(colDailyWage).alignment = { vertical: 'middle', horizontal: 'center' };

            row3.getCell(colOtRate).value = `OT: ₹${segPrev.ot} → ₹${segActive.ot}`;
            row3.getCell(colOtRate).font = { name: 'Calibri', size: 7.5, italic: true, color: { argb: 'FF94A3B8' } };
            row3.getCell(colOtRate).alignment = { vertical: 'middle', horizontal: 'center' };

            // Segmented date range formula for Gross Amount
            const p1StartCol = getExcelCol(dayColStart + segPrev.startDay - 1);
            const p1EndCol = getExcelCol(dayColStart + segPrev.endDay - 1);
            const p2StartCol = getExcelCol(dayColStart + segActive.startDay - 1);
            const p2EndCol = getExcelCol(dayColStart + segActive.endDay - 1);

            const p1AttdRange = `${p1StartCol}${r1}:${p1EndCol}${r1}`;
            const p2AttdRange = `${p2StartCol}${r1}:${p2EndCol}${r1}`;
            const p1OtRange = `${p1StartCol}${r2}:${p1EndCol}${r2}`;
            const p2OtRange = `${p2StartCol}${r2}:${p2EndCol}${r2}`;

            grossFormula = `((` + buildAttdFormulaSnippet(p1AttdRange) + `)*${dailyWageColLet}${r2}+(` + buildAttdFormulaSnippet(p2AttdRange) + `)*${dailyWageColLet}${r1})+(SUM(${p1OtRange})*${otRateColLet}${r2}+SUM(${p2OtRange})*${otRateColLet}${r1})`;
        }

        // Gross Amount (Merged r1..r3)
        row1.getCell(colGross).value = { formula: grossFormula, result: worker.totals.gross_earned };
        row1.getCell(colGross).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
        row1.getCell(colGross).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colGross).numFmt = '₹#,##0';

        // Advance (Merged r1..r3) -> References Row 3 Advance Subtotal
        row1.getCell(colAdv).value = { formula: `${subtotalColLet}${r3}`, result: worker.totals.advances };
        row1.getCell(colAdv).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } };
        row1.getCell(colAdv).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colAdv).numFmt = '₹#,##0';

        // Balance Payable (Merged r1..r3) -> Formula: Gross Amount - Advance
        const balFormula = `${grossColLet}${r1}-${advColLet}${r1}`;
        row1.getCell(colBal).value = { formula: balFormula, result: worker.totals.balance_payable };
        row1.getCell(colBal).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        row1.getCell(colBal).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colBal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        row1.getCell(colBal).numFmt = '₹#,##0';

        // Apply borders across all cells in r1..r3
        for (let r = r1; r <= r3; r++) {
            const row = worksheet.getRow(r);
            const isBottomRow = (r === r3);
            for (let c = 1; c <= totalColumnsCount; c++) {
                const cell = row.getCell(c);
                cell.border = {
                    top: thinBorder,
                    left: thinBorder,
                    bottom: isBottomRow ? thickBottomBorder : thinBorder,
                    right: thinBorder
                };
            }
        }

        // Merge summary columns vertically
        worksheet.mergeCells(r1, colSr, r3, colSr);
        worksheet.mergeCells(r1, colWorker, r3, colWorker);
        worksheet.mergeCells(r1, colTotalAttd, r3, colTotalAttd);
        worksheet.mergeCells(r1, colTotalOt, r3, colTotalOt);
        if (segments.length <= 1) {
            worksheet.mergeCells(r1, colDailyWage, r3, colDailyWage);
            worksheet.mergeCells(r1, colOtRate, r3, colOtRate);
        }
        worksheet.mergeCells(r1, colGross, r3, colGross);
        worksheet.mergeCells(r1, colAdv, r3, colAdv);
        worksheet.mergeCells(r1, colBal, r3, colBal);

        currentRowIdx += 3;
    });

    const lastWorkerRow = currentRowIdx - 1;

    // ==========================================
    // NATIVE EXCEL CONDITIONAL FORMATTING
    // Dynamic color pills on user edit across attendance cells
    // ==========================================
    if (processedWorkers.length > 0) {
        const attdGridRef = `${getExcelCol(dayColStart)}5:${getExcelCol(dayColEnd)}${lastWorkerRow}`;
        worksheet.addConditionalFormatting({
            ref: attdGridRef,
            rules: [
                {
                    priority: 1,
                    type: 'cellIs',
                    operator: 'equal',
                    formulae: ['"P"'],
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } },
                        font: { color: { argb: 'FF047857' }, bold: true }
                    }
                },
                {
                    priority: 2,
                    type: 'containsText',
                    operator: 'containsText',
                    text: 'HD',
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF3C7' } },
                        font: { color: { argb: 'FFB45309' }, bold: true }
                    }
                },
                {
                    priority: 3,
                    type: 'cellIs',
                    operator: 'equal',
                    formulae: ['"A"'],
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFE4E6' } },
                        font: { color: { argb: 'FFE11D48' }, bold: true }
                    }
                }
            ]
        });
    }

    // ==========================================
    // BOTTOM SUMMARY ROWS (3 AGGREGATE ROWS WITH LIVE SUMIF/COUNTIF FORMULAS)
    // ==========================================

    const subtotalColLet = getExcelCol(colSubtotal);
    const totalAttdColLet = getExcelCol(colTotalAttd);
    const totalOtColLet = getExcelCol(colTotalOt);
    const grossColLet = getExcelCol(colGross);
    const advColLet = getExcelCol(colAdv);
    const balColLet = getExcelCol(colBal);

    // Summary Row 1: Daily Present Headcount
    const sumRow1Idx = currentRowIdx;
    const sumRow1 = worksheet.getRow(sumRow1Idx);
    sumRow1.height = 22;
    sumRow1.getCell(colSr).value = 'DAILY PRESENT HEADCOUNT';
    sumRow1.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(sumRow1Idx, colSr, sumRow1Idx, colWorker);

    sumRow1.getCell(colMetric).value = 'Headcount';
    sumRow1.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    daysArray.forEach((dInfo, i) => {
        const col = dayColStart + i;
        const colLet = getExcelCol(col);
        const cell = sumRow1.getCell(col);

        if (processedWorkers.length > 0) {
            const colRange = `${colLet}5:${colLet}${lastWorkerRow}`;
            const hcFormula = buildAttdFormulaSnippet(colRange);
            cell.value = { formula: hcFormula, result: Number(dailyPresentHeadcount[i].toFixed(2)) };
        } else {
            cell.value = 0;
        }

        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '0.0';
    });

    if (processedWorkers.length > 0) {
        const totAttdSumFormula = `SUMIF($C$5:$C$${lastWorkerRow},"Attd",$${subtotalColLet}$5:$${subtotalColLet}$${lastWorkerRow})`;
        sumRow1.getCell(colSubtotal).value = { formula: totAttdSumFormula, result: Number(grandTotalPresentDays.toFixed(2)) };
        sumRow1.getCell(colTotalAttd).value = { formula: `${subtotalColLet}${sumRow1Idx}`, result: Number(grandTotalPresentDays.toFixed(2)) };
    } else {
        sumRow1.getCell(colSubtotal).value = 0;
        sumRow1.getCell(colTotalAttd).value = 0;
    }

    sumRow1.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow1.getCell(colSubtotal).numFmt = '0.0" Total Days"';

    sumRow1.getCell(colTotalAttd).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colTotalAttd).alignment = { vertical: 'middle', horizontal: 'center' };
    sumRow1.getCell(colTotalAttd).numFmt = '0.0';

    // Summary Row 2: Daily Overtime Hours
    currentRowIdx += 1;
    const sumRow2Idx = currentRowIdx;
    const sumRow2 = worksheet.getRow(sumRow2Idx);
    sumRow2.height = 22;
    sumRow2.getCell(colSr).value = 'DAILY OVERTIME HOURS';
    sumRow2.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(sumRow2Idx, colSr, sumRow2Idx, colWorker);

    sumRow2.getCell(colMetric).value = 'Total OT';
    sumRow2.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    daysArray.forEach((dInfo, i) => {
        const col = dayColStart + i;
        const colLet = getExcelCol(col);
        const cell = sumRow2.getCell(col);

        if (processedWorkers.length > 0) {
            const otSumFormula = `SUMIF($C$5:$C$${lastWorkerRow},"OT (hrs)",${colLet}$5:${colLet}$${lastWorkerRow})`;
            cell.value = { formula: otSumFormula, result: Number(dailyOtHours[i].toFixed(1)) };
        } else {
            cell.value = 0;
        }

        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '0.0';
    });

    if (processedWorkers.length > 0) {
        const totOtSumFormula = `SUMIF($C$5:$C$${lastWorkerRow},"OT (hrs)",$${subtotalColLet}$5:$${subtotalColLet}$${lastWorkerRow})`;
        sumRow2.getCell(colSubtotal).value = { formula: totOtSumFormula, result: Number(grandTotalOtHours.toFixed(1)) };
        sumRow2.getCell(colTotalOt).value = { formula: `${subtotalColLet}${sumRow2Idx}`, result: Number(grandTotalOtHours.toFixed(1)) };
    } else {
        sumRow2.getCell(colSubtotal).value = 0;
        sumRow2.getCell(colTotalOt).value = 0;
    }

    sumRow2.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow2.getCell(colSubtotal).numFmt = '0.0" Total hrs"';

    sumRow2.getCell(colTotalOt).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colTotalOt).alignment = { vertical: 'middle', horizontal: 'center' };
    sumRow2.getCell(colTotalOt).numFmt = '0.0';

    // Summary Row 3: Daily Advances Disbursed & Grand Financial Totals
    currentRowIdx += 1;
    const sumRow3Idx = currentRowIdx;
    const sumRow3 = worksheet.getRow(sumRow3Idx);
    sumRow3.height = 24;
    sumRow3.getCell(colSr).value = 'DAILY ADVANCES DISBURSED';
    sumRow3.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(sumRow3Idx, colSr, sumRow3Idx, colWorker);

    sumRow3.getCell(colMetric).value = 'Total Adv';
    sumRow3.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    daysArray.forEach((dInfo, i) => {
        const col = dayColStart + i;
        const colLet = getExcelCol(col);
        const cell = sumRow3.getCell(col);

        if (processedWorkers.length > 0) {
            const advSumFormula = `SUMIF($C$5:$C$${lastWorkerRow},"Adv (₹)",${colLet}$5:${colLet}$${lastWorkerRow})`;
            cell.value = { formula: advSumFormula, result: dailyAdvances[i] };
        } else {
            cell.value = 0;
        }

        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '₹#,##0';
    });

    if (processedWorkers.length > 0) {
        const totAdvSumFormula = `SUMIF($C$5:$C$${lastWorkerRow},"Adv (₹)",$${subtotalColLet}$5:$${subtotalColLet}$${lastWorkerRow})`;
        const grandGrossFormula = `SUMIF($C$5:$C$${lastWorkerRow},"Attd",$${grossColLet}$5:$${grossColLet}$${lastWorkerRow})`;
        const grandAdvFormula = `SUMIF($C$5:$C$${lastWorkerRow},"Attd",$${advColLet}$5:$${advColLet}$${lastWorkerRow})`;
        const grandBalFormula = `${grossColLet}${sumRow3Idx}-${advColLet}${sumRow3Idx}`;

        sumRow3.getCell(colSubtotal).value = { formula: totAdvSumFormula, result: grandTotalAdvances };
        sumRow3.getCell(colGross).value = { formula: grandGrossFormula, result: grandTotalGrossAmount };
        sumRow3.getCell(colAdv).value = { formula: grandAdvFormula, result: grandTotalAdvances };
        sumRow3.getCell(colBal).value = { formula: grandBalFormula, result: grandTotalBalancePayable };
    } else {
        sumRow3.getCell(colSubtotal).value = 0;
        sumRow3.getCell(colGross).value = 0;
        sumRow3.getCell(colAdv).value = 0;
        sumRow3.getCell(colBal).value = 0;
    }

    sumRow3.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colSubtotal).numFmt = '₹#,##0';

    sumRow3.getCell(colGross).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
    sumRow3.getCell(colGross).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colGross).numFmt = '₹#,##0';

    sumRow3.getCell(colAdv).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD97706' } };
    sumRow3.getCell(colAdv).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colAdv).numFmt = '₹#,##0';

    sumRow3.getCell(colBal).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
    sumRow3.getCell(colBal).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colBal).numFmt = '₹#,##0';

    // Apply summary row fills and borders
    const summaryFills = ['FFF0FDF4', 'FFEEF2FF', 'FFFEF3C7'];
    [sumRow1, sumRow2, sumRow3].forEach((sRow, idx) => {
        const fillBg = summaryFills[idx];
        for (let c = 1; c <= totalColumnsCount; c++) {
            const cell = sRow.getCell(c);
            if (!cell.fill || cell.fill.type !== 'pattern') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillBg } };
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: thinBorder,
                bottom: idx === 2 ? { style: 'double', color: { argb: 'FF0F172A' } } : thinBorder,
                right: thinBorder
            };
        }
    });

    // Clean filename
    const cleanSiteName = siteName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Labour_Wage_Ledger_${cleanSiteName}_${targetMonth}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
});
