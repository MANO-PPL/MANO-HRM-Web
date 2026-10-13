/**
 * Report file generation (Excel / CSV / PDF), shared by the report download
 * endpoints and the background report worker. Kept out of the controller so
 * workers do not depend on HTTP handlers.
 */
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import * as reportsService from './reportsServices.js';
import * as AttendanceService from '../attendance/attendanceService.js';
import * as ShiftService from '../shifts/shiftService.js';
import * as UserService from '../users/userService.js';
import * as LeaveService from '../leaves/leaveService.js';
import { calculateOvertime } from '../../services/statusEvalution/statusEvaluationService.js';
import { attendanceDB } from '../../config/database.js';

// Helper: Generate PDF using PDFKit with a professional grid/table design
// Helper: Generate PDF using PDFKit with a professional grid/table design matching frontend
export const generatePdf = (title, columns, rows, options = {}) => {
    const isLandscape = columns.length > 5 || options.type === 'employee_master';
    const doc = new PDFDocument({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margin: 25,
        bufferPages: true,
        autoPageBreak: false
    });

    const margin = 25;
    const pageWidth = doc.page.width - (margin * 2);
    const cellPadding = 4;
    const headerHeight = 24;
    const rowHeight = 20;
    const companyName = options.companyName || "MANO PROJECT CONSULTANT PVT LTD";

    // Proportional column widths and text alignments
    let colWidths = [];
    let alignments = [];

    if (options.type === 'employee_master') {
        const weights = [
            { name: '#', w: 26, align: 'center' },
            { name: 'Code', w: 60, align: 'left' },
            { name: 'Name', w: 120, align: 'left' },
            { name: 'Department', w: 85, align: 'left' },
            { name: 'Designation', w: 85, align: 'left' },
            { name: 'Shift', w: 70, align: 'center' },
            { name: 'Phone', w: 72, align: 'center' },
            { name: 'Email', w: 125, align: 'left' },
            { name: 'Joining Date', w: 64, align: 'center' },
            { name: 'Role', w: 46, align: 'center' },
            { name: 'Status', w: 48, align: 'center' }
        ];
        const totalWeight = weights.reduce((sum, item) => sum + item.w, 0);
        colWidths = weights.map(item => (item.w / totalWeight) * pageWidth);
        alignments = weights.map(item => item.align);
    } else {
        const weights = columns.map(col => {
            const cLower = (col || '').toLowerCase();
            if (cLower === '#' || cLower === 'sr' || cLower.includes('sr no')) return 26;
            if (cLower.includes('name') || cLower.includes('employee')) return 110;
            if (cLower.includes('email')) return 110;
            if (cLower.includes('department') || cLower === 'dept') return 80;
            if (cLower.includes('designation') || cLower === 'position') return 80;
            if (cLower.includes('date')) return 65;
            if (cLower.includes('phone')) return 70;
            if (cLower.includes('shift')) return 65;
            if (cLower.includes('hrs') || cLower.includes('hours')) return 50;
            if (cLower.includes('mins') || cLower.includes('minutes')) return 50;
            if (cLower.includes('days') || cLower === 'present' || cLower === 'absent') return 45;
            if (cLower === 'status') return 50;
            return 60;
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        colWidths = weights.map(w => (w / totalWeight) * pageWidth);
        alignments = columns.map(col => {
            const cLower = (col || '').toLowerCase();
            if (['name', 'employee', 'department', 'dept', 'designation', 'position', 'email'].some(k => cLower.includes(k))) return 'left';
            if (['hrs', 'hours', 'mins', 'days', 'total', 'count'].some(k => cLower.includes(k))) return 'right';
            return 'center';
        });
    }

    const drawBanner = (isFirstPage = false) => {
        // Banner background: Navy Blue #1F4E78
        doc.rect(margin, 20, pageWidth, 36).fill('#1F4E78');
        doc.fillColor('#FFFFFF')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(companyName.toUpperCase(), margin + 12, 26, { align: 'left' });

        const subTitleText = `${title.toUpperCase()}  |  Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
        doc.fontSize(7.5)
            .font('Helvetica')
            .fillColor('#CBD5E1')
            .text(subTitleText, margin + 12, 40, { align: 'left' });

        if (options.usersCount !== undefined) {
            const countStr = `Total: ${options.usersCount}   Active: ${options.activeCount || 0}   Inactive: ${options.inactiveCount || 0}${options.deletedCount ? `   Deleted: ${options.deletedCount}` : ''}`;
            doc.fontSize(7.5)
                .font('Helvetica-Bold')
                .fillColor('#E2E8F0')
                .text(countStr, margin, 32, { width: pageWidth - 12, align: 'right' });
        } else if (rows.length > 0) {
            doc.fontSize(7.5)
                .font('Helvetica-Bold')
                .fillColor('#E2E8F0')
                .text(`${rows.length} Total Records`, margin, 32, { width: pageWidth - 12, align: 'right' });
        }
    };

    const drawTableHeader = (y) => {
        doc.rect(margin, y, pageWidth, headerHeight).fill('#1F4E78');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');

        let colX = margin;
        columns.forEach((col, i) => {
            const w = colWidths[i] || (pageWidth / columns.length);
            const align = alignments[i] || 'center';
            const textX = align === 'center' ? colX : colX + cellPadding;
            const textW = align === 'center' ? w : w - (cellPadding * 2);
            doc.text((col || '').toUpperCase(), textX, y + (headerHeight / 2) - 4, {
                width: textW,
                align: align,
                lineBreak: false,
                ellipsis: true
            });
            colX += w;
        });

        // Crisp border lines around header
        doc.rect(margin, y, pageWidth, headerHeight).strokeColor('#94A3B8').lineWidth(0.8).stroke();
        let borderX = margin;
        for (let i = 0; i < columns.length - 1; i++) {
            borderX += colWidths[i] || (pageWidth / columns.length);
            doc.moveTo(borderX, y).lineTo(borderX, y + headerHeight).strokeColor('#94A3B8').lineWidth(0.5).stroke();
        }
    };

    let currentY = 66; // Start right below banner
    drawTableHeader(currentY);
    currentY += headerHeight;

    // Draw Table Body
    rows.forEach((row, rowIndex) => {
        if (currentY + rowHeight > doc.page.height - 40) {
            doc.addPage({
                size: 'A4',
                layout: isLandscape ? 'landscape' : 'portrait',
                margin: 25
            });
            drawBanner(false);
            currentY = 66;
            drawTableHeader(currentY);
            currentY += headerHeight;
        }

        const isEven = rowIndex % 2 === 0;
        const rowBg = isEven ? '#F8FAFD' : '#FFFFFF';
        doc.rect(margin, currentY, pageWidth, rowHeight).fill(rowBg);

        let colX = margin;
        row.forEach((cell, i) => {
            const w = colWidths[i] || (pageWidth / columns.length);
            const align = alignments[i] || 'center';
            const cellText = cell?.toString() || "-";
            const colName = (columns[i] || '').toLowerCase();

            if (colName === 'status') {
                const sLower = cellText.toLowerCase();
                let badgeBg = '#F1F5F9';
                let badgeBorder = '#CBD5E1';
                let badgeText = '#475569';

                if (sLower === 'active' || sLower === 'present' || cellText === '1.0') {
                    badgeBg = '#E6F4EA';
                    badgeBorder = '#A7F3D0';
                    badgeText = '#137333';
                } else if (sLower === 'inactive' || sLower.includes('half')) {
                    badgeBg = '#FEF3C7';
                    badgeBorder = '#FDE68A';
                    badgeText = '#92400E';
                } else if (sLower === 'deleted' || sLower === 'absent' || cellText === '0.0') {
                    badgeBg = '#FEE2E2';
                    badgeBorder = '#FECACA';
                    badgeText = '#991B1B';
                }

                const badgeW = Math.min(w - 6, 44);
                const badgeH = 13;
                const badgeX = colX + (w - badgeW) / 2;
                const badgeY = currentY + (rowHeight - badgeH) / 2;

                doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5)
                   .fillAndStroke(badgeBg, badgeBorder);

                doc.fillColor(badgeText)
                   .fontSize(6.5)
                   .font('Helvetica-Bold')
                   .text(cellText, badgeX, badgeY + 2.5, {
                       width: badgeW,
                       align: 'center',
                       lineBreak: false
                   });
            } else {
                let textColor = '#334155';
                let fontStyle = 'Helvetica';

                if (colName === 'name' || colName === 'employee') {
                    textColor = '#0F172A';
                    fontStyle = 'Helvetica-Bold';
                } else if (colName === 'code' || colName === '#') {
                    textColor = '#1E293B';
                    fontStyle = 'Helvetica-Bold';
                } else if (colName === 'email') {
                    textColor = '#2563EB';
                }

                if (row[0] === 'TOTALS' || row[0] === 'TOTAL') {
                    textColor = '#0F172A';
                    fontStyle = 'Helvetica-Bold';
                }

                doc.fillColor(textColor)
                   .fontSize(7.5)
                   .font(fontStyle);

                const textX = align === 'center' ? colX : colX + cellPadding;
                const textW = align === 'center' ? w : w - (cellPadding * 2);

                doc.text(cellText, textX, currentY + (rowHeight / 2) - 4, {
                    width: textW,
                    align: align,
                    lineBreak: false,
                    ellipsis: true
                });
            }

            colX += w;
        });

        // Grid borders for this row (crisp #CBD5E1)
        doc.rect(margin, currentY, pageWidth, rowHeight).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
        let borderX = margin;
        for (let i = 0; i < columns.length - 1; i++) {
            borderX += colWidths[i] || (pageWidth / columns.length);
            doc.moveTo(borderX, currentY).lineTo(borderX, currentY + rowHeight).strokeColor('#CBD5E1').lineWidth(0.4).stroke();
        }

        currentY += rowHeight;
    });

    // Draw initial banner on page 1
    doc.switchToPage(0);
    drawBanner(true);

    // Footer pass on all pages
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(margin, doc.page.height - 25)
            .lineTo(doc.page.width - margin, doc.page.height - 25)
            .strokeColor('#CBD5E1')
            .lineWidth(0.5)
            .stroke();

        doc.fontSize(7)
            .fillColor('#64748B')
            .font('Helvetica')
            .text(`${companyName}  |  Uniform Attendance & Operations Report  |  Confidential`, margin, doc.page.height - 18, { align: 'left' });

        doc.text(`Page ${i + 1} of ${range.count}`, margin, doc.page.height - 18, { width: pageWidth, align: 'right' });
    }

    return doc;
};

// Helper: Convert column index (1-based) to Excel column letter (e.g. 1 -> A, 27 -> AA)
const getColLetter = (col) => {
    let letter = "";
    while (col > 0) {
        let temp = (col - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        col = Math.floor((col - temp) / 26);
    }
    return letter;
};

// Helper: write a value as a real Excel TIME-OF-DAY value (a plain fraction-of-a-day number,
// e.g. 0.75 for 6:00 PM — no date component at all), not the old display-string placeholder, so
// downstream formulas (Work Hrs, Late Mins) can do arithmetic on it directly. Deliberately
// time-only rather than a full date+time: editing this report by hand means pasting a bare time
// like "06:00 PM" over an existing value (or into a blank Time Out cell) — if the cell carried a
// full date, that paste would leave the date component wrong/missing and break the Work Hrs
// formula. A time-only value accepts a bare time paste directly, matching how someone would
// actually edit this file. Work Hrs formulas use MOD(out-in, 1) specifically so an overnight
// shift (out < in as time-of-day) still resolves to the correct positive elapsed hours instead of
// a negative one — the standard technique for elapsed time with time-only Excel cells. Falls back
// to a blank cell for a missing punch: blank is safe inside IFERROR(...); the old "-" string
// placeholder is not (text minus text errors out instead of evaluating to 0).
// CSV has no `numFmt` concept and can't paste-and-recalculate anyway — it keeps writing the same
// `formatLocalTimeStr` display string it always has; only `format === 'xlsx'` gets the live value.
const setTimeCellValue = (cell, dateVal, format, includeSeconds = false) => {
    if (format === 'xlsx') {
        if (dateVal) {
            const d = new Date(dateVal);
            cell.value = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
        } else {
            cell.value = null;
        }
        cell.numFmt = 'h:mm AM/PM';
    } else {
        cell.value = AttendanceService.formatLocalTimeStr(dateVal, includeSeconds);
    }
};

// Helper: wraps a formula with its precomputed value so the cell is genuinely live when opened
// in Excel, while CSV (which has no formula concept at all) still gets the identical plain value
// it always has. Every live/recalculating cell in this file should be built through this helper
// rather than hand-writing `{ formula, result }`, so CSV output can never accidentally leak raw
// formula syntax, and so the "what does this report show today" value is always what's cached in
// `result` even before a spreadsheet app has a chance to recalculate on open.
const liveCell = (format, formulaStr, precomputedValue) => {
    return format === 'xlsx' ? { formula: formulaStr, result: precomputedValue } : precomputedValue;
};

export const styleExcelWorksheet = (worksheet, type) => {
    if (['matrix_monthly', 'attendance_matrix_monthly', 'matrix_weekly', 'attendance_matrix_weekly'].includes(type)) {
        return; // Muster roll worksheet is styled directly
    }

    // 1. Enable Gridlines
    worksheet.views = [{ showGridLines: true }];

    const isMultiDayMatrix = ['matrix_monthly', 'matrix_weekly'].includes(type);
    const headerRowsCount = isMultiDayMatrix ? 2 : 1;

    // 2. Style Header Rows (Row 1 & Row 2 if multi-day)
    for (let rowNum = 1; rowNum <= headerRowsCount; rowNum++) {
        const headerRow = worksheet.getRow(rowNum);
        headerRow.height = isMultiDayMatrix ? 26 : 32;

        headerRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E78' } // Premium Navy Blue
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF122F4A' } },
                bottom: { style: 'thin', color: { argb: 'FF122F4A' } },
                left: { style: 'thin', color: { argb: 'FF3A6085' } },
                right: { style: 'thin', color: { argb: 'FF3A6085' } }
            };
        });
    }

    // 3. Style Data Rows (Row 3 onwards for multi-day, Row 2 onwards for others)
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowsCount) return; // Skip headers

        let hasMultiline = false;
        row.eachCell((cCell) => {
            if (cCell.value?.toString().includes('\n')) {
                hasMultiline = true;
            }
        });
        row.height = hasMultiline ? 52 : 24;
        const isEven = (rowNumber % 2 === 0);

        const firstCellVal = row.getCell(1).value?.toString() || '';
        const isTotalsRow = ['totals', 'total late mins'].some(k => firstCellVal.toLowerCase().includes(k));

        row.eachCell((cell, colNumber) => {
            if (isTotalsRow) {
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF1F4E78' } // Premium Navy Blue text
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F4F7' } // Light Grey background
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF1F4E78' } },
                    bottom: { style: 'double', color: { argb: 'FF1F4E78' } }, // Accounting double underline
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center'
                };
                const r1Header = worksheet.getRow(1).getCell(colNumber).value?.toString().toLowerCase() || '';
                const r2Header = isMultiDayMatrix ? (worksheet.getRow(2).getCell(colNumber).value?.toString().toLowerCase() || '') : '';
                const colHeader = `${r1Header} ${r2Header}`;
                if (['name', 'department', 'dept', 'employee', 'reason'].some(k => colHeader.includes(k))) {
                    cell.alignment.horizontal = 'left';
                }
                return; // Skip normal styling for Totals row
            }

            // Default font and borders
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                color: { argb: 'FF333333' }
            };

            // Zebra striping
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
            };

            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };

            // Alignment based on column headers and types
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center'
            };

            // Combine both header rows to check column content type
            const r1Header = worksheet.getRow(1).getCell(colNumber).value?.toString().toLowerCase() || '';
            const r2Header = isMultiDayMatrix ? (worksheet.getRow(2).getCell(colNumber).value?.toString().toLowerCase() || '') : '';
            const colHeader = `${r1Header} ${r2Header}`;
            if (['name', 'department', 'dept', 'employee', 'reason', 'location', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => colHeader.includes(k))) {
                cell.alignment.horizontal = 'left';
            }

        });
    });

    // 4. Conditional Formatting based on cell values — genuinely LIVE, unlike the static per-cell
    // coloring this replaced. A static `cell.fill`/`cell.font` is just a one-time snapshot taken
    // at export time — editing a cell's value later (e.g. retyping "1.0" to "0.0" in the Monthly
    // Attendance Matrix) never updated its color, since nothing re-evaluates a plain style.
    // Excel's own Conditional Formatting feature is the only way to make coloring reactive to
    // future edits — it travels with the workbook and Excel re-evaluates it on every change.
    // Applied once, broadly, over the whole data range (every row below the header(s), including
    // the totals row — harmless, since totals cells hold sums/blanks that never literally equal
    // these status strings) rather than computed per-cell in the loop above.
    // Known, deliberate gap versus the old static version: the "column header contains 'late' AND
    // the numeric value is > 0" highlight (used for Late Mins/Late Count number columns) isn't
    // reproduced here — Conditional Formatting rules don't have header context the way the old
    // per-cell loop did, and reproducing it would need per-report column-position plumbing for a
    // secondary highlight, not the status-code coloring this fix is actually about.
    const lastDataRow = worksheet.rowCount;
    const lastDataCol = worksheet.columnCount;
    if (lastDataRow > headerRowsCount && lastDataCol > 0) {
        const cfRef = `A${headerRowsCount + 1}:${getColLetter(lastDataCol)}${lastDataRow}`;
        const solidFill = (bg) => ({ type: 'pattern', pattern: 'solid', bgColor: { argb: bg } });
        let cfPriority = 1;
        const cfRules = [];
        const addEqualsRule = (value, bg, font) => {
            cfRules.push({
                type: 'cellIs',
                operator: 'equal',
                formulae: [`"${value}"`],
                priority: cfPriority++,
                style: { fill: solidFill(bg), font: { bold: true, color: { argb: font } } }
            });
        };
        addEqualsRule('Present', 'FFE6F4EA', 'FF137333');       // Green
        addEqualsRule('1.0', 'FFE6F4EA', 'FF137333');
        addEqualsRule('Absent', 'FFFCE8E6', 'FFC5221F');        // Red
        addEqualsRule('0.0', 'FFFCE8E6', 'FFC5221F');
        cfRules.push({
            type: 'containsText', operator: 'containsText', text: 'late', priority: cfPriority++,
            style: { fill: solidFill('FFFEF7E0'), font: { bold: true, color: { argb: 'FFB06000' } } }
        });
        addEqualsRule('Sun', 'FFF1F3F4', 'FF5F6368');           // Lavender/grey
        addEqualsRule('Sat', 'FFF1F3F4', 'FF5F6368');
        addEqualsRule('WEEK_OFF', 'FFF1F3F4', 'FF5F6368');
        addEqualsRule('Not Recorded', 'FFF1F3F4', 'FF8E8E93');  // Grey
        addEqualsRule('On Leave', 'FFE8F0FE', 'FF1A73E8');      // Blue
        addEqualsRule('Leave', 'FFE8F0FE', 'FF1A73E8');
        addEqualsRule('Half Day', 'FFE8F0FE', 'FF1A73E8');
        addEqualsRule('L', 'FFE8F0FE', 'FF1A73E8');
        addEqualsRule('Holiday', 'FFE1F0FF', 'FF1967D2');       // Soft blue, distinct from Leave
        addEqualsRule('HOLIDAY', 'FFE1F0FF', 'FF1967D2');
        worksheet.addConditionalFormatting({ ref: cfRef, rules: cfRules });
    }

    // 5. Dynamic Auto-fit Columns (with a padding)
    const colCount = worksheet.columnCount;
    for (let c = 1; c <= colCount; c++) {
        const col = worksheet.getColumn(c);
        let maxLen = 0;
        col.eachCell({ includeEmpty: true }, cell => {
            const cellVal = cell.value ? cell.value.toString() : '';
            const lines = cellVal.split('\n');
            lines.forEach(l => {
                maxLen = Math.max(maxLen, l.length);
            });
        });
        col.width = Math.max(maxLen + 4, 12);
    }
};



export const compileReportBuffer = async ({ org_id, targetUserId, month, date, type, format, startDate: queryStart, endDate: queryEnd, columns, dept_id, desg_id, shift_id }) => {
    const colsObj = typeof columns === 'string' ? JSON.parse(columns) : (columns || {});
    const { startDate, endDate } = reportsService.resolveDateRange({ type, month, date, startDate: queryStart, endDate: queryEnd });
    const todayStr = await AttendanceService.getTodayStr(org_id);

    const users = await UserService.getUsers({
        org_id,
        targetUserId,
        dept_id,
        desg_id,
        shift_id,
        startDate,
        endDate,
        include_inactive: type === "employee_master"
    });
    let records = [];
    let approvedLeaves = [];
    let holidayByDate = {};
    if (type !== "employee_master") {
        records = await AttendanceService.getAttendanceRecords({ org_id, startDate, endDate, targetUserId, dept_id, desg_id, shift_id });
        approvedLeaves = await LeaveService.getApprovedLeaves({ org_id, startDate, endDate, targetUserId });
        holidayByDate = await reportsService.getHolidaysByDate({ org_id, startDate, endDate });
    }

    let companyName = "Mano Project Consultant Pvt Ltd";
    try {
        const org = await attendanceDB("core_organizations").where({ org_id }).select("org_name").first();
        if (org?.org_name) companyName = org.org_name;
    } catch {
        // fallback
    }

    if (format === "pdf") {
        let pdfTitle = type === "employee_master" ? "Employee Master Data" : `Attendance Report - ${startDate} to ${endDate}`;
        let pdfCols, pdfRows;

        if (type === "attendance_detailed") {
            const dayRows = AttendanceService.groupRecordsByUserAndDay(records, users, todayStr);
            pdfCols = ["Date", "Name", "Dept"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            pushPdfCol("Shift", "shift", 3);
            pushPdfCol("In Time", "timeIn", 4);
            pushPdfCol("Out Time", "timeOut", 5);
            pushPdfCol("Work Hrs", "workedHours", 6);
            pushPdfCol("Status", "status", 7);
            pushPdfCol("In Location", "location", 8);
            pushPdfCol("Out Location", "location", 9);

            pdfRows = dayRows.map(r => {
                const fullRow = [
                    reportsService.formatLocalDateStr(r.time_in),
                    r.user_name,
                    r.dept_name || "-",
                    r.shift_name || "-",
                    AttendanceService.formatLocalTimeStr(r.time_in, true),
                    AttendanceService.formatLocalTimeStr(r.time_out, true),
                    r.worked_hours.toFixed(2),
                    r.status,
                    r.time_in_address || "-",
                    r.time_out_address || "-"
                ];

                const row = [fullRow[0], fullRow[1], fullRow[2]];
                pdfColIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

        } else if (type === "matrix_daily") {
            pdfCols = ["Name", "Position"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            pushPdfCol("In Time", "timeIn", 2);
            pushPdfCol("Out Time", "timeOut", 3);
            pushPdfCol("Work Hrs", "workedHours", 4);
            pushPdfCol("Status", "status", 5);
            pushPdfCol("Late (mins)", "late", 6);

            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = AttendanceService.aggregateDayRecords(userRecs, u.policy_rules);
                const holidayOverride = !aggregated.time_in ? reportsService.getHolidayOverride(startDate, holidayByDate) : null;
                const fullRow = [
                    u.user_name,
                    u.desg_name || "-",
                    AttendanceService.formatLocalTimeStr(aggregated.time_in),
                    AttendanceService.formatLocalTimeStr(aggregated.time_out),
                    aggregated.worked_hours.toFixed(2),
                    holidayOverride ? holidayOverride.status : aggregated.status,
                    aggregated.late_minutes || 0
                ];

                const row = [fullRow[0], fullRow[1]];
                pdfColIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

        } else if (['attendance_matrix_weekly', 'attendance_matrix_monthly', 'matrix_weekly', 'matrix_monthly'].includes(type)) {
            pdfCols = ["Name", "Dept"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            pushPdfCol("Req Hrs", "requiredHours", 0);
            pushPdfCol("Worked Hrs", "workedHours", 1);
            pushPdfCol("Late Hrs", "late", 2);
            pushPdfCol("Late Count", "late", 3);
            pushPdfCol("Present Days", "attendanceDays", 4);
            pushPdfCol("Absent Days", "attendanceDays", 5);

            const dateStrings = AttendanceService.getDateRangeArray(startDate, endDate);
            const dateHeaders = dateStrings.map(dateStr => {
                const [y, m, d] = dateStr.split('-').map(Number);
                return new Date(y, m - 1, d);
            });
            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);
                let totalWorkedHrs = 0;
                let totalLateMins = 0;
                let presentDays = 0;
                dateHeaders.forEach((d, dIdx) => {
                    const dateStr = dateStrings[dIdx];
                    const dayRecs = userRecs.filter(r => AttendanceService.getRecordDateStr(r) === dateStr);
                    const aggregated = AttendanceService.aggregateDayRecords(dayRecs, u.policy_rules);
                    if (aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave') {
                        presentDays++;
                        totalWorkedHrs += aggregated.worked_hours;
                        if (aggregated.late_minutes > 0) {
                            totalLateMins += aggregated.late_minutes;
                        }
                    }
                });
                const reqHrs = reportsService.getRequiredHoursForPeriod(u, dateStrings, holidayByDate);

                let calculatedAbsentDays = 0;
                dateHeaders.forEach((d, dIdx) => {
                    const dateStr = dateStrings[dIdx];
                    const userStartDate = AttendanceService.getUserStartDate(u);
                    if (userStartDate && dateStr < userStartDate) return;
                    const dayRecs = userRecs.filter(r => AttendanceService.getRecordDateStr(r) === dateStr);
                    const aggregated = AttendanceService.aggregateDayRecords(dayRecs, u.policy_rules);
                    const rules = ShiftService.getShiftRules(u);
                    const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);
                    const leaveOnDate = LeaveService.isDateInApprovedLeave(userLeaves, dateStr);
                    const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave';
                    const isHoliday = !aggregated.time_in && !!reportsService.getHolidayOverride(dateStr, holidayByDate);
                    if (!isPresent && !isHoliday && !leaveOnDate && dateStr <= todayStr && dayType !== 'week_off') {
                        calculatedAbsentDays++;
                    }
                });

                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    reqHrs.toFixed(2),
                    totalWorkedHrs.toFixed(2),
                    (totalLateMins / 60).toFixed(2),
                    userRecs.filter(r => r.late_minutes > 0).length,
                    presentDays,
                    calculatedAbsentDays
                ];

                const row = [fullRow[0], fullRow[1]];
                pdfColIndices.forEach(idx => {
                    row.push(fullRow[idx + 2]);
                });
                return row;
            });

        } else if (type === "employee_master") {
            pdfCols = ["#", "Code", "Name", "Department", "Designation", "Shift", "Phone", "Email", "Joining Date", "Role", "Status"];
            pdfRows = users.map((u, idx) => [
                idx + 1,
                u.user_code || `EMP-${u.user_id}`,
                u.user_name,
                u.dept_name || "-",
                u.desg_name || "-",
                u.shift_name || "Open Shift",
                u.phone_no || "-",
                u.email || "-",
                u.joining_date ? String(u.joining_date).slice(0, 10) : (u.created_at ? String(u.created_at).slice(0, 10) : "-"),
                u.user_type || "employee",
                u.is_deleted ? "Deleted" : (u.is_active ? "Active" : "Inactive")
            ]);
        } else {
            pdfCols = ["Name", "Dept", "Total Days"];
            const pdfColIndices = [];
            const holidayWorkedHeader = `Holidays Worked (of ${Object.keys(holidayByDate).length})`;

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            if (colsObj.attendanceDays !== false) {
                pdfCols.push("Present", "Absent", "Half Day", "Leave", holidayWorkedHeader);
                pdfColIndices.push(3, 4, 5, 6, 13);
            }
            if (colsObj.late !== false) {
                pdfCols.push("Late Days", "Late Mins");
                pdfColIndices.push(7, 8);
            }
            if (colsObj.workedHours !== false) {
                pdfCols.push("OT Hrs", "Total Hrs");
                pdfColIndices.push(9, 10);
            }
            if (colsObj.requiredHours !== false) {
                pdfCols.push("Req Hrs");
                pdfColIndices.push(12);
            }
            if (colsObj.attendanceDays !== false) {
                pdfCols.push("Payable Days");
                pdfColIndices.push(11);
            }

            const [year, monthNum] = month.split("-").map(Number);
            const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

            // Generate calendar day dates for this month timezone-independently
            const dateStrings = AttendanceService.getDateRangeArray(startDate, endDate);

            const baseRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

                let presentDays = 0;
                let halfDayCount = 0;
                let leaveCount = 0;
                let absentDays = 0;
                let holidayWorkedCount = 0;
                let lateCount = 0;
                let totalLateMins = 0;
                let totalOvertimeHrs = 0;
                let totalHrs = 0;

                dateStrings.forEach(dateStr => {
                    const dayRecs = userRecs.filter(r => AttendanceService.getRecordDateStr(r) === dateStr);
                    const leaveOnDate = LeaveService.isDateInApprovedLeave(userLeaves, dateStr);

                    if (dayRecs.length > 0) {
                        const aggregated = AttendanceService.aggregateDayRecords(dayRecs, u.policy_rules);

                        if (aggregated.status === "On Leave" || leaveOnDate) {
                            leaveCount++;
                        } else if (aggregated.status === "Half Day") {
                            halfDayCount++;
                            presentDays++;
                        } else if (aggregated.status === "Absent") {
                            if (leaveOnDate) {
                                leaveCount++;
                            } else {
                                absentDays++;
                            }
                        } else {
                            presentDays++;
                        }

                        // Worked-on-holiday is a supplementary tag, not a separate bucket — the
                        // day above is already counted under Present/Late/Half Day/etc.
                        if (reportsService.getHolidayOverride(dateStr, holidayByDate)) {
                            holidayWorkedCount++;
                        }

                        if (aggregated.late_minutes > 0) {
                            lateCount++;
                            totalLateMins += aggregated.late_minutes;
                        }

                        totalHrs += aggregated.worked_hours;

                        let overtime_hours = 0;
                        if (u.policy_rules) {
                            const rules = AttendanceService.safeParseRules(u.policy_rules);
                            overtime_hours = calculateOvertime(aggregated.worked_hours, rules);
                        } else {
                            overtime_hours = dayRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                        }
                        totalOvertimeHrs += overtime_hours;
                    } else {
                        if (reportsService.getHolidayOverride(dateStr, holidayByDate)) {
                            // No punch, declared holiday — excluded from Absent, but nothing was
                            // worked so it does not add to holidayWorkedCount.
                        } else if (leaveOnDate) {
                            leaveCount++;
                        } else {
                            const rules = ShiftService.getShiftRules(u);
                            const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);
                            const userStartDate = AttendanceService.getUserStartDate(u);
                            if (dateStr <= todayStr && dayType !== 'week_off' && (!userStartDate || dateStr >= userStartDate)) {
                                absentDays++;
                            }
                        }
                    }
                });

                const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
                const requiredHrs = reportsService.getRequiredHoursForPeriod(u, dateStrings, holidayByDate);

                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    totalDaysInMonth,
                    presentDays,
                    absentDays,
                    halfDayCount,
                    leaveCount,
                    lateCount,
                    totalLateMins,
                    totalOvertimeHrs.toFixed(2),
                    totalHrs.toFixed(2),
                    Math.round(payableDays).toFixed(0),
                    requiredHrs.toFixed(2),
                    holidayWorkedCount
                ];

                const row = [fullRow[0], fullRow[1], fullRow[2]];
                pdfColIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

            // Calculate totals dynamically for the PDF rows
            const totalsRow = ["TOTALS", "", ""];
            pdfColIndices.forEach(idx => {
                if ([3, 4, 5, 6, 7, 8, 11, 13].includes(idx)) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const colName = idx === 3 ? "Present" :
                            idx === 4 ? "Absent" :
                                idx === 5 ? "Half Day" :
                                    idx === 6 ? "Leave" :
                                        idx === 7 ? "Late Days" :
                                            idx === 8 ? "Late Mins" :
                                                idx === 11 ? "Payable Days" : holidayWorkedHeader;
                        const mappedIdx = pdfCols.indexOf(colName);
                        if (mappedIdx !== -1) sum += parseInt(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum.toString());
                } else if ([9, 10].includes(idx)) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const colName = idx === 9 ? "OT Hrs" : "Total Hrs";
                        const mappedIdx = pdfCols.indexOf(colName);
                        if (mappedIdx !== -1) sum += parseFloat(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum.toFixed(2));
                } else if (idx === 12) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const mappedIdx = pdfCols.indexOf("Req Hrs");
                        if (mappedIdx !== -1) sum += parseFloat(r[mappedIdx]) || 0;
                    });
                    totalsRow.push(sum.toFixed(2));
                }
            });
            pdfRows = [...baseRows, totalsRow];
        }

        const pdfOptions = {
            type,
            companyName,
            startDate,
            endDate,
            month,
            usersCount: users.length,
            activeCount: users.filter(u => u.is_active && !u.is_deleted).length,
            inactiveCount: users.filter(u => !u.is_active && !u.is_deleted).length,
            deletedCount: users.filter(u => u.is_deleted).length
        };

        const pdfDoc = generatePdf(pdfTitle, pdfCols, pdfRows, pdfOptions);
        return new Promise((resolve, reject) => {
            const chunks = [];
            pdfDoc.on('data', chunk => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', err => reject(err));
            pdfDoc.end();
        });
    }

    // Excel / CSV
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    if (type === "matrix_daily") {
        const cols = [];
        cols.push({ header: "Name", key: "name", width: 25 });
        cols.push({ header: "Position", key: "position", width: 20 });

        const pushCol = (header, key, check, width) => {
            if (colsObj[check] !== false) {
                cols.push({ header, key, width });
            }
        };

        pushCol("Time In", "time_in", "timeIn", 15);
        pushCol("Time Out", "time_out", "timeOut", 15);
        pushCol("Work Hours", "work_hrs", "workedHours", 12);
        pushCol("Status", "status", "status", 15);
        pushCol("Late (mins)", "late_mins", "late", 12);

        // Live-formula groundwork: Work Hours needs Time In/Out to exist as real cells on this
        // sheet; Late (mins) additionally needs each row's own shift start time + grace period as
        // real values (a formula can't reach into the database), carried via two hidden reference
        // columns. CSV has no formula concept at all, so this is skipped entirely for CSV — those
        // cells just keep writing the same plain computed value CSV has always had.
        const canLiveWorkHrs = format === 'xlsx' && colsObj.workedHours !== false && colsObj.timeIn !== false && colsObj.timeOut !== false;
        const canLiveLateMins = format === 'xlsx' && colsObj.late !== false && colsObj.timeIn !== false;
        if (canLiveLateMins) {
            cols.push({ header: "Shift Start (hrs)", key: "shift_start_hrs", width: 14, hidden: true });
            cols.push({ header: "Grace (mins)", key: "grace_mins", width: 12, hidden: true });
        }

        worksheet.columns = cols;

        const colLetter = (key) => {
            const idx = worksheet.columns.findIndex(c => c.key === key) + 1;
            return idx > 0 ? getColLetter(idx) : null;
        };
        const timeInLetter = colLetter('time_in');
        const timeOutLetter = colLetter('time_out');
        const shiftStartLetter = colLetter('shift_start_hrs');
        const graceMinsLetter = colLetter('grace_mins');

        let totalWorkHrs = 0;
        let totalLateMins = 0;

        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const aggregated = AttendanceService.aggregateDayRecords(userRecs, u.policy_rules);
            const holidayOverride = !aggregated.time_in ? reportsService.getHolidayOverride(startDate, holidayByDate) : null;

            const workedHours = parseFloat(aggregated.worked_hours.toFixed(2));
            const lateMins = aggregated.late_minutes || 0;
            totalWorkHrs += workedHours;
            totalLateMins += lateMins;

            const rowData = {
                name: u.user_name,
                position: u.desg_name || "-"
            };
            if (colsObj.status !== false) rowData.status = holidayOverride ? holidayOverride.status : aggregated.status;
            if (canLiveLateMins) {
                const rules = ShiftService.getShiftRules(u);
                const [startH, startM] = (rules.shift_timing?.start_time || "09:00:00").split(':').map(Number);
                rowData.shift_start_hrs = startH + (startM / 60);
                rowData.grace_mins = Number(rules.grace_period?.minutes || 0);
            }

            const row = worksheet.addRow(rowData);

            if (colsObj.timeIn !== false) setTimeCellValue(row.getCell('time_in'), aggregated.time_in, format);
            if (colsObj.timeOut !== false) setTimeCellValue(row.getCell('time_out'), aggregated.time_out, format);

            if (colsObj.workedHours !== false) {
                const workHrsCell = row.getCell('work_hrs');
                workHrsCell.value = canLiveWorkHrs
                    ? liveCell(format, `IFERROR(MOD(${timeOutLetter}${row.number}-${timeInLetter}${row.number},1)*24,0)`, workedHours)
                    : workedHours;
                workHrsCell.numFmt = '0.00';
            }
            if (colsObj.late !== false) {
                const lateMinsCell = row.getCell('late_mins');
                lateMinsCell.value = canLiveLateMins
                    ? liveCell(format, `IFERROR(MAX(0,(MOD(${timeInLetter}${row.number},1)*24-${shiftStartLetter}${row.number})*60-${graceMinsLetter}${row.number}),0)`, lateMins)
                    : lateMins;
            }
        });

        if (users.length > 0) {
            const lastRow = worksheet.rowCount;
            const totalsRowData = { name: "TOTALS" };
            const workHrsColLetter = colLetter('work_hrs');
            const lateMinsColLetter = colLetter('late_mins');
            if (workHrsColLetter) {
                totalsRowData.work_hrs = liveCell(format, `SUM(${workHrsColLetter}2:${workHrsColLetter}${lastRow})`, parseFloat(totalWorkHrs.toFixed(2)));
            }
            if (lateMinsColLetter) {
                totalsRowData.late_mins = liveCell(format, `SUM(${lateMinsColLetter}2:${lateMinsColLetter}${lastRow})`, totalLateMins);
            }
            worksheet.addRow(totalsRowData);
        }
    } else if (['matrix_monthly', 'attendance_matrix_monthly', 'matrix_weekly', 'attendance_matrix_weekly'].includes(type)) {
        const musterData = await reportsService.buildMusterRollData({
            org_id,
            users,
            records,
            approvedLeaves,
            holidayByDate,
            startDate,
            endDate,
            month,
            todayStr
        });

        const [y, m] = (month || startDate).split('-').map(Number);
        const baseDate = new Date(y, (m || 1) - 1, 1);
        const monthShort = baseDate.toLocaleDateString('en-US', { month: 'short' });
        const sheetName = `${monthShort} ${yearShort} Attn`;
        worksheet.name = sheetName;

        const showPosition = colsObj.position !== false && colsObj.positionName !== false;
        const showWorkHour = colsObj.workedHours !== false && colsObj.workHour !== false;
        const showIn = colsObj.timeIn !== false && colsObj.inPunch !== false && colsObj.in !== false;
        const showOut = colsObj.timeOut !== false && colsObj.outPunch !== false && colsObj.out !== false;
        const showEmpCode = colsObj.employeeCode !== false && colsObj.empCode !== false;
        const showDaysInMonth = colsObj.daysInMonth !== false;
        const showPresentDays = colsObj.presentDays !== false;

        const dynamicCols = [];
        if (showEmpCode) dynamicCols.push({ key: 'employeeCode', text: 'Employee Code', width: 6.5 });
        if (showDaysInMonth) dynamicCols.push({ key: 'daysInMonth', text: 'Days in Month', width: 5.5 });
        if (showPresentDays) dynamicCols.push({ key: 'presentDays', text: 'Present Days', width: 6.5 });

        const staticColCount = 3 + dynamicCols.length;
        worksheet.views = [{ showGridLines: true, state: 'frozen', xSplit: staticColCount, ySplit: 5 }];

        // Set column widths
        worksheet.getColumn(1).width = 6;   // SR No.
        worksheet.getColumn(2).width = 24;  // Name
        worksheet.getColumn(3).width = 18;  // Attributes (renamed from Position)
        dynamicCols.forEach((dc, i) => {
            worksheet.getColumn(4 + i).width = dc.width;
        });
        musterData.dateHeaders.forEach((_, idx) => {
            worksheet.getColumn(staticColCount + 1 + idx).width = 4.8; // Dates (Vertical)
        });

        // Row 1: Title
        worksheet.getRow(1).height = 28;
        const titleCell = worksheet.getCell('B1');
        titleCell.value = musterData.monthTitle;
        titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF000000' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Row 4: Legend & Day of Week
        worksheet.getRow(4).height = 28;
        // Legend Absent
        const absentLegendCell = worksheet.getCell('B4');
        absentLegendCell.value = 'Absent';
        absentLegendCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF991B1B' } };
        absentLegendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        absentLegendCell.alignment = { vertical: 'middle', horizontal: 'center' };
        absentLegendCell.border = {
            top: { style: 'thin', color: { argb: 'FFFECACA' } },
            bottom: { style: 'thin', color: { argb: 'FFFECACA' } },
            left: { style: 'thin', color: { argb: 'FFFECACA' } },
            right: { style: 'thin', color: { argb: 'FFFECACA' } }
        };

        // Legend Holiday
        const holidayLegendCell = worksheet.getCell('C4');
        holidayLegendCell.value = 'Holiday';
        holidayLegendCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF713F12' } };
        holidayLegendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        holidayLegendCell.alignment = { vertical: 'middle', horizontal: 'center' };
        holidayLegendCell.border = {
            top: { style: 'thin', color: { argb: 'FFFDE047' } },
            bottom: { style: 'thin', color: { argb: 'FFFDE047' } },
            left: { style: 'thin', color: { argb: 'FFFDE047' } },
            right: { style: 'thin', color: { argb: 'FFFDE047' } }
        };

        // Col 1: SR No. merged across Row 4 & 5
        worksheet.mergeCells(4, 1, 5, 1);
        const srCell = worksheet.getCell(4, 1);
        srCell.value = 'SR No.';
        srCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF000000' } };
        srCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        const leftHBorder = {
            top: { style: 'thin', color: { argb: 'FF64748B' } },
            bottom: { style: 'medium', color: { argb: 'FF64748B' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        srCell.border = leftHBorder;
        worksheet.getCell(5, 1).border = leftHBorder;

        // Row 5: Name and Attributes
        worksheet.getRow(5).height = 58;
        const nameHCell = worksheet.getCell(5, 2);
        nameHCell.value = 'Name';
        nameHCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF000000' } };
        nameHCell.alignment = { vertical: 'middle', horizontal: 'center' };
        nameHCell.border = leftHBorder;

        const posHCell = worksheet.getCell(5, 3);
        posHCell.value = 'Attributes';
        posHCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF000000' } };
        posHCell.alignment = { vertical: 'middle', horizontal: 'center' };
        posHCell.border = { ...leftHBorder, right: { style: staticColCount === 3 ? 'medium' : 'thin', color: { argb: 'FF64748B' } } };

        // Dynamic vertical headers (Employee Code, Days in Month, Present Days)
        dynamicCols.forEach((dc, i) => {
            const col = 4 + i;
            worksheet.mergeCells(4, col, 5, col);
            const cell = worksheet.getCell(4, col);
            cell.value = dc.text;
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            const vBorder = {
                top: { style: 'thin', color: { argb: 'FF64748B' } },
                bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: col === staticColCount ? { argb: 'FF64748B' } : { argb: 'FF94A3B8' } }
            };
            cell.border = vBorder;
            worksheet.getCell(5, col).border = vBorder;
        });

        // Day of week in row 4 - Vertical
        musterData.dateHeaders.forEach((dh, dIdx) => {
            const cell = worksheet.getCell(4, staticColCount + 1 + dIdx);
            cell.value = dh.dayOfWeek;
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: dh.isHighlight ? { argb: 'FF713F12' } : { argb: 'FF000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
            if (dh.isHighlight) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
            }
        });

        // Row 5: Date strings - Vertical
        musterData.dateHeaders.forEach((dh, dIdx) => {
            const cell = worksheet.getCell(5, staticColCount + 1 + dIdx);
            cell.value = dh.dateFormatted;
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: dh.isHighlight ? { argb: 'FF713F12' } : { argb: 'FF000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
            if (dh.isHighlight) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
            }
        });

        // Row 6 onwards: Employees (dynamic sub-rows per employee)
        let currentRow = 6;
        musterData.employees.forEach((emp) => {
            const startRow = currentRow;
            const subRowTypes = [
                { type: 'status', label: showPosition ? (emp.position || 'Status') : 'Status', rowData: emp.statusRow, isStatus: true },
                ...(showWorkHour ? [{ type: 'workHour', label: 'Work Hour', rowData: emp.workHourRow }] : []),
                ...(showIn ? [{ type: 'in', label: 'In', rowData: emp.inRow }] : []),
                ...(showOut ? [{ type: 'out', label: 'Out', rowData: emp.outRow }] : [])
            ];
            const rowSpanCount = subRowTypes.length;

            subRowTypes.forEach((sr, rIdx) => {
                const rowNum = startRow + rIdx;
                worksheet.getRow(rowNum).height = rIdx === 0 ? 20 : 18;

                if (rIdx === 0) {
                    worksheet.getCell(rowNum, 1).value = emp.srNo;
                    worksheet.getCell(rowNum, 2).value = emp.name;
                    worksheet.getCell(rowNum, 3).value = sr.label;

                    dynamicCols.forEach((dc, i) => {
                        const cell = worksheet.getCell(rowNum, 4 + i);
                        if (dc.key === 'employeeCode') cell.value = emp.employeeCode;
                        if (dc.key === 'daysInMonth') cell.value = emp.daysInMonth;
                        if (dc.key === 'presentDays') {
                            cell.value = parseFloat(emp.presentDays);
                            cell.numFmt = '0.00';
                        }
                    });

                    // Common formatting
                    const centerCols = [1];
                    dynamicCols.forEach((_, i) => centerCols.push(4 + i));
                    centerCols.forEach(c => {
                        const cell = worksheet.getCell(rowNum, c);
                        cell.font = { name: 'Segoe UI', size: 9, bold: c === staticColCount && showPresentDays, color: { argb: 'FF1E293B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                    worksheet.getCell(rowNum, 2).font = { name: 'Segoe UI', size: 9, bold: false, color: { argb: 'FF0F172A' } };
                    worksheet.getCell(rowNum, 2).alignment = { vertical: 'middle', horizontal: 'left' };
                    worksheet.getCell(rowNum, 3).font = { name: 'Segoe UI', size: 9, bold: false, color: { argb: 'FF475569' } };
                    worksheet.getCell(rowNum, 3).alignment = { vertical: 'middle', horizontal: 'left' };

                    if (rowSpanCount > 1) {
                        worksheet.mergeCells(startRow, 1, startRow + rowSpanCount - 1, 1);
                        worksheet.mergeCells(startRow, 2, startRow + rowSpanCount - 1, 2);
                        dynamicCols.forEach((_, i) => {
                            worksheet.mergeCells(startRow, 4 + i, startRow + rowSpanCount - 1, 4 + i);
                        });
                    }
                } else {
                    const labelCell = worksheet.getCell(rowNum, 3);
                    labelCell.value = sr.label;
                    labelCell.font = { name: 'Segoe UI', size: 8.5, bold: false, color: { argb: 'FF334155' } };
                    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
                    labelCell.border = {
                        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        bottom: { style: rIdx === rowSpanCount - 1 ? 'medium' : 'thin', color: { argb: rIdx === rowSpanCount - 1 ? 'FF64748B' : 'FF94A3B8' } },
                        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        right: { style: staticColCount === 3 ? 'medium' : 'thin', color: { argb: 'FF64748B' } }
                    };
                }

                // Date cells
                sr.rowData.forEach((val, dIdx) => {
                    const col = staticColCount + 1 + dIdx;
                    const cell = worksheet.getCell(rowNum, col);
                    const dh = musterData.dateHeaders[dIdx];
                    cell.value = val === "" ? "" : isNaN(Number(val)) ? val : parseFloat(val);
                    if (typeof cell.value === 'number') {
                        cell.numFmt = '0.0';
                    }
                    cell.font = { name: 'Segoe UI', size: sr.isStatus ? 9 : 8.5, bold: val === "0.0", color: { argb: 'FF1E293B' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        bottom: { style: rIdx === rowSpanCount - 1 ? 'medium' : 'thin', color: { argb: rIdx === rowSpanCount - 1 ? 'FF64748B' : 'FF94A3B8' } },
                        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
                    };

                    if (sr.isStatus && val === "0.0") {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF991B1B' } };
                    } else if (dh.isHighlight) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                        cell.font = { name: 'Segoe UI', size: sr.isStatus ? 9 : 8.5, bold: false, color: { argb: 'FF713F12' } };
                    }
                });
            });

            // Border for bottom of merged cells in row
            const endRow = startRow + rowSpanCount - 1;
            for (let c = 1; c <= staticColCount; c++) {
                const bCell = worksheet.getCell(endRow, c);
                bCell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: c === staticColCount ? { argb: 'FF64748B' } : { argb: 'FF94A3B8' } }
                };
            }

            currentRow += rowSpanCount;
        });
    } else if (type === "attendance_detailed") {
        const cols = [
            { header: "Date", key: "date", width: 15 },
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 }
        ];

        const pushCol = (header, key, check, width) => {
            if (colsObj[check] !== false) {
                cols.push({ header, key, width });
            }
        };

        pushCol("Shift", "shift", "shift", 15);
        pushCol("Time In", "time_in", "timeIn", 15);
        pushCol("Time Out", "time_out", "timeOut", 15);
        pushCol("Work Hrs", "work_hrs", "workedHours", 12);
        pushCol("Status", "status", "status", 15);
        pushCol("In Location", "time_in_address", "location", 40);
        pushCol("Out Location", "time_out_address", "location", 40);

        // Live-formula groundwork: Work Hrs needs Time In/Out to exist as real cells on this
        // sheet. This report has no Late Mins column, so no shift-config helper columns needed.
        const canLiveWorkHrs = format === 'xlsx' && colsObj.workedHours !== false && colsObj.timeIn !== false && colsObj.timeOut !== false;

        worksheet.columns = cols;

        const colLetter = (key) => {
            const idx = worksheet.columns.findIndex(c => c.key === key) + 1;
            return idx > 0 ? getColLetter(idx) : null;
        };
        const timeInLetter = colLetter('time_in');
        const timeOutLetter = colLetter('time_out');

        let totalWorkHrs = 0;

        const dayRows = AttendanceService.groupRecordsByUserAndDay(records, users, todayStr);
        dayRows.forEach(r => {
            const rowData = {
                date: reportsService.formatLocalDateStr(r.time_in),
                name: r.user_name,
                dept: r.dept_name || "-"
            };

            if (colsObj.shift !== false) rowData.shift = r.shift_name || "-";
            if (colsObj.status !== false) rowData.status = r.status;
            if (colsObj.location !== false) {
                rowData.time_in_address = r.time_in_address || "-";
                rowData.time_out_address = r.time_out_address || "-";
            }

            const workedHours = parseFloat(r.worked_hours.toFixed(2));
            totalWorkHrs += workedHours;

            const row = worksheet.addRow(rowData);

            if (colsObj.timeIn !== false) setTimeCellValue(row.getCell('time_in'), r.time_in, format, true);
            if (colsObj.timeOut !== false) setTimeCellValue(row.getCell('time_out'), r.time_out, format, true);

            if (colsObj.workedHours !== false) {
                const workHrsCell = row.getCell('work_hrs');
                workHrsCell.value = canLiveWorkHrs
                    ? liveCell(format, `IFERROR(MOD(${timeOutLetter}${row.number}-${timeInLetter}${row.number},1)*24,0)`, workedHours)
                    : workedHours;
                workHrsCell.numFmt = '0.00';
            }
        });

        if (dayRows.length > 0) {
            const lastRow = worksheet.rowCount;
            const workHrsColLetter = colLetter('work_hrs');
            if (workHrsColLetter) {
                const totalsRowData = { date: "TOTALS" };
                totalsRowData.work_hrs = liveCell(format, `SUM(${workHrsColLetter}2:${workHrsColLetter}${lastRow})`, parseFloat(totalWorkHrs.toFixed(2)));
                worksheet.addRow(totalsRowData);
            }
        }
    } else if (type === "attendance_summary") {
        const cols = [
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Total Days", key: "total_days", width: 12 }
        ];

        const pushCol = (header, key, width) => {
            cols.push({ header, key, width });
        };
        const holidayWorkedHeader = `Holidays Worked (of ${Object.keys(holidayByDate).length})`;

        if (colsObj.attendanceDays !== false) {
            pushCol("Present", "present", 10);
            pushCol("Absent", "absent", 10);
            pushCol("Half Day", "half_day", 10);
            pushCol("On Leave", "leaves", 10);
            pushCol(holidayWorkedHeader, "holiday", 14);
        }
        if (colsObj.late !== false) {
            pushCol("Late Days", "late_days", 12);
            pushCol("Late Mins", "late_mins", 12);
        }
        if (colsObj.workedHours !== false) {
            pushCol("Overtime Hrs", "overtime_hrs", 15);
            pushCol("Total Hrs", "total_hrs", 12);
        }
        if (colsObj.requiredHours !== false) {
            pushCol("Required Hrs", "required_hrs", 14);
        }
        if (colsObj.attendanceDays !== false) {
            pushCol("Payable Days", "payable_days", 15);
        }

        worksheet.columns = cols;
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
        // Generate calendar day dates for this month timezone-independently
        const dateStrings = AttendanceService.getDateRangeArray(startDate, endDate);

        // Live-formula groundwork. This report has no daily breakdown on the sheet at all (one
        // row per employee per month) — Present/Absent/Half Day/On Leave/etc. are rolled up
        // server-side from data that never appears as cells here, so there's nothing on-sheet for
        // most of these to be formula-driven from (documented limitation). The one exception:
        // Payable Days is itself derived from THIS row's own Present/Half Day/On Leave cells,
        // which do exist on the sheet — so it can genuinely be a live formula.
        const canLivePayableDays = format === 'xlsx' && colsObj.attendanceDays !== false;
        const colLetterFor = (key) => {
            const idx = worksheet.columns.findIndex(c => c.key === key) + 1;
            return idx > 0 ? getColLetter(idx) : null;
        };
        const presentColLetter = canLivePayableDays ? colLetterFor('present') : null;
        const halfDayColLetter = canLivePayableDays ? colLetterFor('half_day') : null;
        const leavesColLetter = canLivePayableDays ? colLetterFor('leaves') : null;

        // Running totals for the totals row's cached result / CSV fallback (so it never has to
        // fall back to a bare, resultless formula object — see the totals row below).
        const grandTotals = {};

        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);

            let presentDays = 0;
            let halfDayCount = 0;
            let leaveCount = 0;
            let absentDays = 0;
            let holidayWorkedCount = 0;
            let lateCount = 0;
            let totalLateMins = 0;
            let totalOvertimeHrs = 0;
            let totalHrs = 0;

            dateStrings.forEach(dateStr => {
                const dayRecs = userRecs.filter(r => AttendanceService.getRecordDateStr(r) === dateStr);
                const leaveOnDate = LeaveService.isDateInApprovedLeave(userLeaves, dateStr);

                if (dayRecs.length > 0) {
                    const aggregated = AttendanceService.aggregateDayRecords(dayRecs, u.policy_rules);

                    if (aggregated.status === "On Leave" || leaveOnDate) {
                        leaveCount++;
                    } else if (aggregated.status === "Half Day") {
                        halfDayCount++;
                        presentDays++;
                    } else if (aggregated.status === "Absent") {
                        if (leaveOnDate) {
                            leaveCount++;
                        } else {
                            absentDays++;
                        }
                    } else {
                        presentDays++;
                    }

                    // Worked-on-holiday is a supplementary tag, not a separate bucket — the day
                    // above is already counted under Present/Late/Half Day/etc.
                    if (reportsService.getHolidayOverride(dateStr, holidayByDate)) {
                        holidayWorkedCount++;
                    }

                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        totalLateMins += aggregated.late_minutes;
                    }

                    totalHrs += aggregated.worked_hours;

                    let overtime_hours = 0;
                    if (u.policy_rules) {
                        const rules = AttendanceService.safeParseRules(u.policy_rules);
                        overtime_hours = calculateOvertime(aggregated.worked_hours, rules);
                    } else {
                        overtime_hours = dayRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                    }
                    totalOvertimeHrs += overtime_hours;
                } else {
                    if (reportsService.getHolidayOverride(dateStr, holidayByDate)) {
                        // No punch, declared holiday — excluded from Absent, but nothing was
                        // worked so it does not add to holidayWorkedCount.
                    } else if (leaveOnDate) {
                        leaveCount++;
                    } else {
                        const rules = ShiftService.getShiftRules(u);
                        const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);
                        const userStartDate = AttendanceService.getUserStartDate(u);
                        if (dateStr <= todayStr && dayType !== 'week_off' && (!userStartDate || dateStr >= userStartDate)) {
                            absentDays++;
                        }
                    }
                }
            });

            const payableDays = Math.round(presentDays - (0.5 * halfDayCount) + leaveCount);

            const rowData = {
                name: u.user_name,
                dept: u.dept_name || "-",
                total_days: totalDaysInMonth
            };

            if (colsObj.requiredHours !== false) {
                const requiredHrs = parseFloat(reportsService.getRequiredHoursForPeriod(u, dateStrings, holidayByDate).toFixed(2));
                rowData.required_hrs = requiredHrs;
                grandTotals.required_hrs = (grandTotals.required_hrs || 0) + requiredHrs;
            }
            if (colsObj.attendanceDays !== false) {
                rowData.present = presentDays;
                rowData.absent = absentDays;
                rowData.half_day = halfDayCount;
                rowData.leaves = leaveCount;
                rowData.holiday = holidayWorkedCount;
                grandTotals.present = (grandTotals.present || 0) + presentDays;
                grandTotals.absent = (grandTotals.absent || 0) + absentDays;
                grandTotals.half_day = (grandTotals.half_day || 0) + halfDayCount;
                grandTotals.leaves = (grandTotals.leaves || 0) + leaveCount;
                grandTotals.holiday = (grandTotals.holiday || 0) + holidayWorkedCount;
            }
            if (colsObj.late !== false) {
                rowData.late_days = lateCount;
                rowData.late_mins = totalLateMins;
                grandTotals.late_days = (grandTotals.late_days || 0) + lateCount;
                grandTotals.late_mins = (grandTotals.late_mins || 0) + totalLateMins;
            }
            if (colsObj.workedHours !== false) {
                const overtimeHrsRounded = parseFloat(totalOvertimeHrs.toFixed(2));
                const totalHrsRounded = parseFloat(totalHrs.toFixed(2));
                rowData.overtime_hrs = overtimeHrsRounded;
                rowData.total_hrs = totalHrsRounded;
                grandTotals.overtime_hrs = (grandTotals.overtime_hrs || 0) + overtimeHrsRounded;
                grandTotals.total_hrs = (grandTotals.total_hrs || 0) + totalHrsRounded;
            }
            if (colsObj.attendanceDays !== false) {
                rowData.payable_days = canLivePayableDays ? null : payableDays;
                grandTotals.payable_days = (grandTotals.payable_days || 0) + payableDays;
            }

            const row = worksheet.addRow(rowData);

            if (canLivePayableDays) {
                const rowNum = row.number;
                const formula = `${presentColLetter}${rowNum}-0.5*${halfDayColLetter}${rowNum}+${leavesColLetter}${rowNum}`;
                row.getCell('payable_days').value = liveCell(format, formula, payableDays);
            }
        });

        if (users.length > 0) {
            const lastRow = worksheet.rowCount;
            const totalsRow = {
                name: "TOTALS",
                dept: "",
                total_days: ""
            };

            worksheet.columns.forEach((col, idx) => {
                const key = col.key;
                if (key !== "name" && key !== "dept" && key !== "total_days") {
                    const letter = getColLetter(idx + 1);
                    totalsRow[key] = liveCell(format, `SUM(${letter}2:${letter}${lastRow})`, grandTotals[key] || 0);
                }
            });
            worksheet.addRow(totalsRow);
        }

    } else if (type === "employee_master") {
        worksheet.columns = [
            { header: "Emp Code", key: "code", width: 14 },
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Designation", key: "desg", width: 20 },
            { header: "Shift", key: "shift", width: 18 },
            { header: "Phone", key: "phone", width: 16 },
            { header: "Email", key: "email", width: 28 },
            { header: "Joining Date", key: "joining_date", width: 16 },
            { header: "Role", key: "user_type", width: 14 },
            { header: "Status", key: "status", width: 14 }
        ];
        users.forEach(u => {
            worksheet.addRow({
                code: u.user_code || `EMP-${u.user_id}`,
                name: u.user_name,
                dept: u.dept_name || "-",
                desg: u.desg_name || "-",
                shift: u.shift_name || "Open Shift",
                phone: u.phone_no || "-",
                email: u.email || "-",
                joining_date: u.joining_date ? String(u.joining_date).slice(0, 10) : (u.created_at ? String(u.created_at).slice(0, 10) : "-"),
                user_type: u.user_type || "employee",
                status: u.is_deleted ? "Deleted" : (u.is_active ? "Active" : "Inactive")
            });
        });
    } else {
        // Multi-day Matrix
        const dateStrings = AttendanceService.getDateRangeArray(startDate, endDate);
        const dateHeaders = dateStrings.map(dateStr => {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        });

        let dailyColspan = 0;
        const subCols = [];

        dailyColspan++;
        subCols.push({ label: "Status", key: "status" });
        if (colsObj.timeIn !== false) {
            dailyColspan++;
            subCols.push({ label: "In Time", key: "timeIn" });
        }
        if (colsObj.timeOut !== false) {
            dailyColspan++;
            subCols.push({ label: "Out Time", key: "timeOut" });
        }
        if (colsObj.workedHours !== false) {
            dailyColspan++;
            subCols.push({ label: "Work Hrs", key: "workedHours" });
        }
        if (colsObj.requiredHours !== false) {
            dailyColspan++;
            subCols.push({ label: "Req Hrs", key: "requiredHours" });
        }
        if (colsObj.late !== false) {
            dailyColspan++;
            subCols.push({ label: "Late Mins", key: "late" });
        }
        if (colsObj.location !== false) {
            dailyColspan += 2;
            subCols.push({ label: "In Location", key: "location" });
            subCols.push({ label: "Out Location", key: "location" });
        }

        const summaryCols = [];
        if (colsObj.attendanceDays !== false) summaryCols.push("Present Days");
        if (colsObj.workedHours !== false) summaryCols.push("Total Hrs");
        if (colsObj.late !== false) {
            summaryCols.push("Late Count");
            summaryCols.push("Late Mins");
        }

        // Live-formula groundwork. Status always exists (dailyColspan's first entry,
        // unconditional above); In Time/Out Time/Work Hrs/Late Mins are each conditional on
        // colsObj. A day counts as "present" for the Present Days formula/count below if its
        // Status cell isn't one of these no-work labels — matches the convention already used
        // for this same concept in the other report types.
        const presentExclusions = ['Absent', 'On Leave', 'Holiday', 'Sun', 'Sat', 'WEEK_OFF', 'Not Recorded', '-', 'Missed Punch'];
        const subColOffset = (label) => {
            const idx = subCols.findIndex(sc => sc.label === label);
            return idx >= 0 ? idx : null;
        };
        const statusOffset = subColOffset("Status");
        const inTimeOffset = subColOffset("In Time");
        const outTimeOffset = subColOffset("Out Time");
        const workHrsOffset = subColOffset("Work Hrs");
        const lateMinsOffset = subColOffset("Late Mins");

        const canLiveWorkHrs = format === 'xlsx' && workHrsOffset !== null && inTimeOffset !== null && outTimeOffset !== null;
        const canLiveLateMins = format === 'xlsx' && lateMinsOffset !== null && inTimeOffset !== null;
        const canLivePresentDays = format === 'xlsx' && statusOffset !== null && dateHeaders.length > 0;
        const canLiveTotalHrs = format === 'xlsx' && workHrsOffset !== null && dateHeaders.length > 0;
        const canLiveLateSummary = format === 'xlsx' && lateMinsOffset !== null && dateHeaders.length > 0;

        // Add Row 1 (Top Header)
        const r1Values = ["SR No.", "Name", "Position", "Dept"];
        if (colsObj.shift !== false) {
            r1Values.push("Shift");
        }
        dateHeaders.forEach(d => {
            const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
            if (dailyColspan > 0) {
                r1Values.push(datePrefix);
                for (let i = 1; i < dailyColspan; i++) {
                    r1Values.push("");
                }
            }
        });
        r1Values.push(...summaryCols);
        // Hidden reference columns carrying each row's own shift start time + grace period, so
        // the per-day Late Mins formula below has real values to compare against (a formula can't
        // reach into the database). Appended after the visible summary columns, then hidden
        // post-construction.
        if (canLiveLateMins) {
            r1Values.push("Shift Start (hrs)", "Grace (mins)");
        }
        worksheet.addRow(r1Values);

        // Add Row 2 (Sub Header)
        const r2Values = colsObj.shift !== false ? ["", "", "", "", ""] : ["", "", "", ""];
        if (dailyColspan > 0) {
            dateHeaders.forEach(() => {
                subCols.forEach(sc => {
                    r2Values.push(sc.label);
                });
            });
        }
        summaryCols.forEach(() => r2Values.push(""));
        if (canLiveLateMins) {
            r2Values.push("", "");
        }
        worksheet.addRow(r2Values);

        // Merge cells
        // Merge base headers vertically (Columns 1 to 4 or 5)
        const baseColLimit = colsObj.shift !== false ? 5 : 4;
        for (let col = 1; col <= baseColLimit; col++) {
            worksheet.mergeCells(1, col, 2, col);
        }

        // Merge date headers horizontally
        let currentCol = colsObj.shift !== false ? 6 : 5;
        const dayGridStartCol = currentCol;
        if (dailyColspan > 0) {
            dateHeaders.forEach(() => {
                const startCol = currentCol;
                const endCol = currentCol + dailyColspan - 1;
                worksheet.mergeCells(1, startCol, 1, endCol);
                currentCol += dailyColspan;
            });
        }

        // Merge summary headers vertically
        const summaryStartCol = currentCol;
        summaryCols.forEach((_, idx) => {
            const col = summaryStartCol + idx;
            worksheet.mergeCells(1, col, 2, col);
        });
        // Hidden columns: merged too, for structural consistency, though never visible.
        let shiftStartCol = null;
        let graceMinsCol = null;
        if (canLiveLateMins) {
            shiftStartCol = summaryStartCol + summaryCols.length;
            graceMinsCol = shiftStartCol + 1;
            worksheet.mergeCells(1, shiftStartCol, 2, shiftStartCol);
            worksheet.mergeCells(1, graceMinsCol, 2, graceMinsCol);
        }

        const dayCellCol = (dIdx, offset) => dayGridStartCol + dIdx * dailyColspan + offset;
        const dayCellRef = (dIdx, offset, rowNum) => `${getColLetter(dayCellCol(dIdx, offset))}${rowNum}`;
        const shiftStartLetter = shiftStartCol ? getColLetter(shiftStartCol) : null;
        const graceMinsLetter = graceMinsCol ? getColLetter(graceMinsCol) : null;

        // Add data rows
        const summaryTotals = {}; // label -> running sum, for the totals row's cached result / CSV fallback
        summaryCols.forEach(label => { summaryTotals[label] = 0; });
        users.forEach((u, index) => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const userLeaves = approvedLeaves.filter(l => l.user_id === u.user_id);
            const rules = ShiftService.getShiftRules(u);
            const userRow = [index + 1, u.user_name, u.desg_name || "-", u.dept_name || "-"];
            if (colsObj.shift !== false) {
                userRow.push(u.shift_name || "-");
            }

            let totalHrs = 0;
            let lateCount = 0;
            let lateMins = 0;
            let presentDaysCount = 0;
            const punchedDays = []; // { dIdx, timeIn, timeOut } — for the post-addRow live-cell pass

            dateHeaders.forEach((d, dIdx) => {
                const dateStr = dateStrings[dIdx];
                const dayRecs = userRecs.filter(r => AttendanceService.getRecordDateStr(r) === dateStr);
                const aggregated = AttendanceService.aggregateDayRecords(dayRecs, u.policy_rules);
                const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);
                const dayOfWeek = d.getUTCDay();
                const leaveOnDate = LeaveService.isDateInApprovedLeave(userLeaves, dateStr);

                if (aggregated.time_in) {
                    const workedHoursForDay = parseFloat(aggregated.worked_hours.toFixed(2));
                    subCols.forEach(sc => {
                        if (sc.label === "Status") userRow.push(aggregated.status);
                        else if (sc.label === "In Time") userRow.push(null); // live value set after addRow
                        else if (sc.label === "Out Time") userRow.push(null); // live value set after addRow
                        else if (sc.label === "Work Hrs") userRow.push(canLiveWorkHrs ? null : workedHoursForDay);
                        else if (sc.label === "Req Hrs") {
                            const req = reportsService.getHolidayOverride(dateStr, holidayByDate) ? 0 : ShiftService.getExpectedHours(dateStr, rules.week_off_policy, rules);
                            userRow.push(parseFloat(req.toFixed(2)));
                        }
                        else if (sc.label === "Late Mins") userRow.push(canLiveLateMins ? null : aggregated.late_minutes);
                        else if (sc.label === "In Location") userRow.push(aggregated.time_in_address || "-");
                        else if (sc.label === "Out Location") userRow.push(aggregated.time_out_address || "-");
                    });

                    punchedDays.push({ dIdx, timeIn: aggregated.time_in, timeOut: aggregated.time_out, workedHoursForDay, lateMinutesForDay: aggregated.late_minutes });

                    if (!presentExclusions.includes(aggregated.status)) presentDaysCount++;
                    totalHrs += aggregated.worked_hours;
                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        lateMins += aggregated.late_minutes;
                    }
                } else {
                    let statusStr = "Absent";
                    if (reportsService.getHolidayOverride(dateStr, holidayByDate)) {
                        statusStr = "Holiday";
                    } else if (leaveOnDate) {
                        statusStr = "On Leave";
                    } else if (dateStr > todayStr) {
                        if (dayType === 'week_off') {
                            statusStr = dayOfWeek === 0 ? "Sun" : dayOfWeek === 6 ? "Sat" : "WEEK_OFF";
                        } else {
                            statusStr = "Not Recorded";
                        }
                    } else {
                        if (dayType === 'week_off') {
                            statusStr = dayOfWeek === 0 ? "Sun" : dayOfWeek === 6 ? "Sat" : "WEEK_OFF";
                        }
                    }

                    if (!presentExclusions.includes(statusStr)) presentDaysCount++;

                    subCols.forEach((sc) => {
                        if (sc.label === "Status") userRow.push(statusStr);
                        else if (sc.label === "Req Hrs") {
                            const req = reportsService.getHolidayOverride(dateStr, holidayByDate) ? 0 : ShiftService.getExpectedHours(dateStr, rules.week_off_policy, rules);
                            userRow.push(parseFloat(req.toFixed(2)));
                        }
                        else userRow.push("-");
                    });
                }
            });

            const totalHrsRounded = parseFloat(totalHrs.toFixed(2));
            if (colsObj.attendanceDays !== false) userRow.push(canLivePresentDays ? null : presentDaysCount);
            if (colsObj.workedHours !== false) userRow.push(canLiveTotalHrs ? null : totalHrsRounded);
            if (colsObj.late !== false) {
                userRow.push(canLiveLateSummary ? null : lateCount);
                userRow.push(canLiveLateSummary ? null : lateMins);
            }
            if (canLiveLateMins) {
                const [startH, startM] = (rules.shift_timing?.start_time || "09:00:00").split(':').map(Number);
                userRow.push(startH + (startM / 60), Number(rules.grace_period?.minutes || 0));
            }

            const row = worksheet.addRow(userRow);
            const rowNum = row.number;

            // Populate the live per-day cells this row's punched days need.
            punchedDays.forEach(({ dIdx, timeIn, timeOut, workedHoursForDay, lateMinutesForDay }) => {
                if (inTimeOffset !== null) setTimeCellValue(row.getCell(dayCellCol(dIdx, inTimeOffset)), timeIn, format);
                if (outTimeOffset !== null) setTimeCellValue(row.getCell(dayCellCol(dIdx, outTimeOffset)), timeOut, format);
                if (canLiveWorkHrs) {
                    const cell = row.getCell(dayCellCol(dIdx, workHrsOffset));
                    const inRef = dayCellRef(dIdx, inTimeOffset, rowNum);
                    const outRef = dayCellRef(dIdx, outTimeOffset, rowNum);
                    cell.value = liveCell(format, `IFERROR(MOD(${outRef}-${inRef},1)*24,0)`, workedHoursForDay);
                    cell.numFmt = '0.00';
                }
                if (canLiveLateMins) {
                    const cell = row.getCell(dayCellCol(dIdx, lateMinsOffset));
                    const inRef = dayCellRef(dIdx, inTimeOffset, rowNum);
                    cell.value = liveCell(format, `IFERROR(MAX(0,(MOD(${inRef},1)*24-${shiftStartLetter}${rowNum})*60-${graceMinsLetter}${rowNum}),0)`, lateMinutesForDay);
                }
            });

            // Present Days / Total Hrs / Late Count / Late Mins — live formulas over this row's
            // own day-grid cells. Status sub-columns aren't contiguous across dates (each date is
            // a multi-column block), so COUNTIF can't take them as one range; a `+`-joined sum of
            // per-cell boolean terms is used instead. SUM natively accepts a comma-separated list
            // of non-contiguous cells, so Total Hrs/Late Mins totals stay simple SUM(...) calls.
            let summaryColCursor = summaryStartCol;
            if (colsObj.attendanceDays !== false) {
                const cell = row.getCell(summaryColCursor);
                if (canLivePresentDays) {
                    const terms = dateHeaders.map((d, dIdx) => {
                        const ref = dayCellRef(dIdx, statusOffset, rowNum);
                        return presentExclusions.map(v => `(${ref}<>"${v}")`).join('*');
                    });
                    cell.value = liveCell(format, terms.join('+'), presentDaysCount);
                } else {
                    cell.value = presentDaysCount;
                }
                summaryTotals["Present Days"] += presentDaysCount;
                summaryColCursor++;
            }
            if (colsObj.workedHours !== false) {
                const cell = row.getCell(summaryColCursor);
                if (canLiveTotalHrs) {
                    const cells = dateHeaders.map((d, dIdx) => dayCellRef(dIdx, workHrsOffset, rowNum));
                    cell.value = liveCell(format, `SUM(${cells.join(',')})`, totalHrsRounded);
                } else {
                    cell.value = totalHrsRounded;
                }
                cell.numFmt = '0.00';
                summaryTotals["Total Hrs"] += totalHrsRounded;
                summaryColCursor++;
            }
            if (colsObj.late !== false) {
                const countCell = row.getCell(summaryColCursor);
                if (canLiveLateSummary) {
                    const terms = dateHeaders.map((d, dIdx) => {
                        const ref = dayCellRef(dIdx, lateMinsOffset, rowNum);
                        return `(ISNUMBER(${ref})*(${ref}>0))`;
                    });
                    countCell.value = liveCell(format, terms.join('+'), lateCount);
                } else {
                    countCell.value = lateCount;
                }
                summaryTotals["Late Count"] += lateCount;
                summaryColCursor++;

                const minsCell = row.getCell(summaryColCursor);
                if (canLiveLateSummary) {
                    const cells = dateHeaders.map((d, dIdx) => dayCellRef(dIdx, lateMinsOffset, rowNum));
                    minsCell.value = liveCell(format, `SUM(${cells.join(',')})`, lateMins);
                } else {
                    minsCell.value = lateMins;
                }
                summaryTotals["Late Mins"] += lateMins;
                summaryColCursor++;
            }

            row.eachCell((cell) => {
                if (cell.value === "Absent" || cell.value === "0.0") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
                    cell.font = { color: { argb: 'FFC5221F' }, bold: true };
                }
                if (cell.value === "Sun" || cell.value === "Sat" || cell.value === "WEEK_OFF") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F4' } };
                    cell.font = { color: { argb: 'FF5F6368' }, bold: true };
                }
                if (cell.value === "Not Recorded") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F4' } };
                    cell.font = { color: { argb: 'FF8E8E93' }, bold: true };
                }
                if (cell.value === "Holiday") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1F0FF' } };
                    cell.font = { color: { argb: 'FF1967D2' }, bold: true };
                }
            });
        });

        if (canLiveLateMins) {
            worksheet.getColumn(shiftStartCol).hidden = true;
            worksheet.getColumn(graceMinsCol).hidden = true;
        }

        // Add TOTALS row if users exist. Rebuilt to fix two pre-existing alignment bugs found
        // during the audit for this Part: (1) the old `startColIndex` used a hardcoded
        // `baseHeaders.length` (always 4) that never accounted for the optional Shift column,
        // shifting every totals formula one column left of where it belonged whenever Shift was
        // shown (the default); (2) it unconditionally pushed a `requiredHours` SUM formula even
        // though this report has no "Req Hrs" *summary* column at all (Req Hrs only exists as a
        // per-day sub-column) — landing that formula in what was actually the Present Days cell.
        // Rebuilt to walk `summaryCols` by name instead of assuming a fixed shape.
        if (users.length > 0) {
            const totalsRow = ["TOTALS"];
            for (let col = 2; col < summaryStartCol; col++) totalsRow.push("");

            const lastRow = worksheet.rowCount;
            summaryCols.forEach((label, idx) => {
                const col = summaryStartCol + idx;
                const letter = getColLetter(col);
                const precomputedTotal = label === "Total Hrs" ? parseFloat(summaryTotals[label].toFixed(2)) : summaryTotals[label];
                totalsRow[col - 1] = liveCell(format, `SUM(${letter}3:${letter}${lastRow})`, precomputedTotal);
            });

            worksheet.addRow(totalsRow);
        }
    }

    if (format === "xlsx") {
        styleExcelWorksheet(worksheet, type);
    }

    if (format === "csv") {
        return await workbook.csv.writeBuffer();
    } else {
        return await workbook.xlsx.writeBuffer();
    }
};
