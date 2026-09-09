import ExcelJS from 'exceljs';
import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { formatDateSafe, getMonthBounds, buildWageRateResolver } from './labourController.js';

/**
 * Controller to export the Complete 3-Row Daily Spreadsheet & Monthly Wage Ledger to styled Excel (.xlsx)
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

    // Track daily totals
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
                ot_hours: ot > 0 ? ot : '',
                advance: advAmount > 0 ? advAmount : ''
            });
        });

        const grossEarned = Math.round(workerBaseCredit + workerOtCredit);
        // User directive: Balance Payable = Gross Amount - Total Advance
        const balancePayable = grossEarned - workerAdvances;

        grandTotalPresentDays += workerPresentDaysCount;
        grandTotalOtHours += workerOtHours;
        grandTotalAdvances += workerAdvances;
        grandTotalGrossAmount += grossEarned;
        grandTotalBalancePayable += balancePayable;

        // Build human-readable effective rate string describing any mid-month changes
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

        let rateDescStr = '';
        if (rateSegments.length <= 1) {
            const seg = rateSegments[0] || { daily: Number(lab.monthly_salary || 0), ot: Number(lab.overtime_pay_per_hour || 0) };
            rateDescStr = `₹${seg.daily.toLocaleString('en-IN')}/day (OT: ₹${seg.ot}/hr)`;
        } else {
            const dailyParts = rateSegments.map(s => `₹${s.daily} (${s.startDay}-${s.endDay} ${monthNameShort})`).join(' → ');
            const otParts = rateSegments.map(s => `₹${s.ot}/hr`).join(' → ');
            rateDescStr = `${dailyParts}\nOT: ${otParts}`;
        }

        return {
            sr_no: index + 1,
            labour_id: lab.labour_id,
            name: lab.name,
            role: lab.role || 'Worker',
            rate_desc: rateDescStr,
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

    // Determine column mapping
    const colSr = 1;
    const colWorker = 2;
    const colMetric = 3;
    const dayColStart = 4;
    const dayColEnd = 3 + totalDays;
    const colSubtotal = dayColEnd + 1;
    const colTotalAttd = dayColEnd + 2;
    const colTotalOt = dayColEnd + 3;
    const colRate = dayColEnd + 4;
    const colGross = dayColEnd + 5;
    const colAdv = dayColEnd + 6;
    const colBal = dayColEnd + 7;
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
    worksheet.getColumn(colRate).width = 32;
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
        { col: colRate, text: 'Wage & OT Rate' },
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

        // Days 1..totalDays
        worker.days.forEach((dayObj, i) => {
            const col = dayColStart + i;
            const isWeekend = daysArray[i].isWeekend;

            // Row 1: Attendance
            const cell1 = row1.getCell(col);
            cell1.value = dayObj.status;
            const isP = dayObj.status === 'P';
            const isHD = typeof dayObj.status === 'string' && dayObj.status.startsWith('HD');
            const isA = dayObj.status === 'A';
            cell1.font = {
                name: 'Calibri',
                size: (typeof dayObj.status === 'string' && dayObj.status.length > 2) ? 8 : 9.5,
                bold: true,
                color: { argb: isP ? 'FF047857' : isHD ? 'FFB45309' : isA ? 'FFE11D48' : 'FF64748B' }
            };
            cell1.alignment = { vertical: 'middle', horizontal: 'center' };
            cell1.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isP ? 'FFDCFCE7' : isHD ? 'FFFEF3C7' : isWeekend ? 'FFF8FAFC' : 'FFFFFFFF' }
            };

            // Row 2: OT Hours
            const cell2 = row2.getCell(col);
            cell2.value = dayObj.ot_hours !== '' ? dayObj.ot_hours : null;
            cell2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
            cell2.alignment = { vertical: 'middle', horizontal: 'center' };
            cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayObj.ot_hours ? 'FFEEF2FF' : isWeekend ? 'FFF8FAFC' : 'FFFFFFFF' } };
            if (typeof dayObj.ot_hours === 'number') cell2.numFmt = '0.0';

            // Row 3: Advance Amount
            const cell3 = row3.getCell(col);
            cell3.value = dayObj.advance !== '' ? dayObj.advance : null;
            cell3.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF92400E' } };
            cell3.alignment = { vertical: 'middle', horizontal: 'center' };
            cell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayObj.advance ? 'FFFEF3C7' : isWeekend ? 'FFF8FAFC' : 'FFFFFFFF' } };
            if (typeof dayObj.advance === 'number') cell3.numFmt = '₹#,##0';
        });

        // Month Subtotals column
        row1.getCell(colSubtotal).value = `${worker.totals.present_days.toFixed(1)} Days`;
        row1.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
        row1.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

        row2.getCell(colSubtotal).value = `${worker.totals.ot_hours.toFixed(1)} hrs`;
        row2.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
        row2.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row2.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

        row3.getCell(colSubtotal).value = worker.totals.advances;
        row3.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
        row3.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
        row3.getCell(colSubtotal).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        row3.getCell(colSubtotal).numFmt = '₹#,##0';

        // Summary Columns (Values on Row 1, merged across r1..r3)
        // Total Attd
        row1.getCell(colTotalAttd).value = worker.totals.present_days;
        row1.getCell(colTotalAttd).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        row1.getCell(colTotalAttd).alignment = { vertical: 'middle', horizontal: 'center' };
        row1.getCell(colTotalAttd).numFmt = '0.0';

        // Total OT
        row1.getCell(colTotalOt).value = worker.totals.ot_hours;
        row1.getCell(colTotalOt).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4F46E5' } };
        row1.getCell(colTotalOt).alignment = { vertical: 'middle', horizontal: 'center' };
        row1.getCell(colTotalOt).numFmt = '0.0';

        // Rate
        row1.getCell(colRate).value = worker.rate_desc;
        row1.getCell(colRate).font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF334155' } };
        row1.getCell(colRate).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        // Gross Amount
        row1.getCell(colGross).value = worker.totals.gross_earned;
        row1.getCell(colGross).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
        row1.getCell(colGross).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colGross).numFmt = '₹#,##0';

        // Advance
        row1.getCell(colAdv).value = worker.totals.advances;
        row1.getCell(colAdv).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } };
        row1.getCell(colAdv).alignment = { vertical: 'middle', horizontal: 'right' };
        row1.getCell(colAdv).numFmt = '₹#,##0';

        // Balance Payable (Gross - Advance)
        row1.getCell(colBal).value = worker.totals.balance_payable;
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

        // Merge vertically
        worksheet.mergeCells(r1, colSr, r3, colSr);
        worksheet.mergeCells(r1, colWorker, r3, colWorker);
        worksheet.mergeCells(r1, colTotalAttd, r3, colTotalAttd);
        worksheet.mergeCells(r1, colTotalOt, r3, colTotalOt);
        worksheet.mergeCells(r1, colRate, r3, colRate);
        worksheet.mergeCells(r1, colGross, r3, colGross);
        worksheet.mergeCells(r1, colAdv, r3, colAdv);
        worksheet.mergeCells(r1, colBal, r3, colBal);

        currentRowIdx += 3;
    });

    // ==========================================
    // BOTTOM SUMMARY ROWS (3 AGGREGATE ROWS)
    // ==========================================

    // Summary Row 1: Daily Present Headcount
    const sumRow1 = worksheet.getRow(currentRowIdx);
    sumRow1.height = 22;
    sumRow1.getCell(colSr).value = 'DAILY PRESENT HEADCOUNT';
    sumRow1.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(currentRowIdx, colSr, currentRowIdx, colWorker);

    sumRow1.getCell(colMetric).value = 'Headcount';
    sumRow1.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    dailyPresentHeadcount.forEach((cnt, i) => {
        const cell = sumRow1.getCell(dayColStart + i);
        cell.value = cnt > 0 ? cnt : '-';
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (typeof cnt === 'number' && cnt > 0) cell.numFmt = '0.0';
    });

    sumRow1.getCell(colSubtotal).value = `${grandTotalPresentDays.toFixed(1)} Total Days`;
    sumRow1.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };

    sumRow1.getCell(colTotalAttd).value = grandTotalPresentDays;
    sumRow1.getCell(colTotalAttd).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
    sumRow1.getCell(colTotalAttd).alignment = { vertical: 'middle', horizontal: 'center' };
    sumRow1.getCell(colTotalAttd).numFmt = '0.0';

    // Summary Row 2: Daily Overtime Hours
    currentRowIdx += 1;
    const sumRow2 = worksheet.getRow(currentRowIdx);
    sumRow2.height = 22;
    sumRow2.getCell(colSr).value = 'DAILY OVERTIME HOURS';
    sumRow2.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(currentRowIdx, colSr, currentRowIdx, colWorker);

    sumRow2.getCell(colMetric).value = 'Total OT';
    sumRow2.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    dailyOtHours.forEach((ot, i) => {
        const cell = sumRow2.getCell(dayColStart + i);
        cell.value = ot > 0 ? ot : '-';
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (typeof ot === 'number' && ot > 0) cell.numFmt = '0.0';
    });

    sumRow2.getCell(colSubtotal).value = `${grandTotalOtHours.toFixed(1)} Total hrs`;
    sumRow2.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };

    sumRow2.getCell(colTotalOt).value = grandTotalOtHours;
    sumRow2.getCell(colTotalOt).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
    sumRow2.getCell(colTotalOt).alignment = { vertical: 'middle', horizontal: 'center' };
    sumRow2.getCell(colTotalOt).numFmt = '0.0';

    // Summary Row 3: Daily Advances Disbursed & Grand Financial Totals
    currentRowIdx += 1;
    const sumRow3 = worksheet.getRow(currentRowIdx);
    sumRow3.height = 24;
    sumRow3.getCell(colSr).value = 'DAILY ADVANCES DISBURSED';
    sumRow3.getCell(colSr).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colSr).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(currentRowIdx, colSr, currentRowIdx, colWorker);

    sumRow3.getCell(colMetric).value = 'Total Adv';
    sumRow3.getCell(colMetric).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colMetric).alignment = { vertical: 'middle', horizontal: 'center' };

    dailyAdvances.forEach((adv, i) => {
        const cell = sumRow3.getCell(dayColStart + i);
        cell.value = adv > 0 ? adv : '-';
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (typeof adv === 'number' && adv > 0) cell.numFmt = '₹#,##0';
    });

    sumRow3.getCell(colSubtotal).value = grandTotalAdvances;
    sumRow3.getCell(colSubtotal).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
    sumRow3.getCell(colSubtotal).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colSubtotal).numFmt = '₹#,##0';

    sumRow3.getCell(colGross).value = grandTotalGrossAmount;
    sumRow3.getCell(colGross).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
    sumRow3.getCell(colGross).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colGross).numFmt = '₹#,##0';

    sumRow3.getCell(colAdv).value = grandTotalAdvances;
    sumRow3.getCell(colAdv).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD97706' } };
    sumRow3.getCell(colAdv).alignment = { vertical: 'middle', horizontal: 'right' };
    sumRow3.getCell(colAdv).numFmt = '₹#,##0';

    sumRow3.getCell(colBal).value = grandTotalBalancePayable;
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
