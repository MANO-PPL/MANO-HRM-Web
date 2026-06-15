import catchAsync from '../../utils/catchAsync.js';
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import * as reportsService from '../../services/reports/reportsServices.js';
import { attendanceDB } from '../../config/database.js';

// Helper: Generate PDF using PDFKit with a professional grid/table design
export const generatePdf = (title, columns, rows) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: columns.length > 7 ? 'landscape' : 'portrait',
        margin: 40,
        bufferPages: true,
        autoPageBreak: false
    });

    const margin = 40;
    const pageWidth = doc.page.width - (margin * 2);
    const cellPadding = 6;
    const headerHeight = 28;
    const rowHeight = 22;

    // Beautiful Title Header Banner
    doc.rect(margin, 30, pageWidth, 45).fill('#1F4E78');
    doc.fillColor('#FFFFFF')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(title.toUpperCase(), margin + 15, 45, { align: 'left' });
       
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#A3BFFA')
       .text(`Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 15, 62, { align: 'left' });

    doc.moveDown(3.5);
    let currentY = doc.y;

    const drawLine = (y) => {
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke('#E2E8F0');
    };

    const drawVerticalLines = (y, height) => {
        for (let i = 0; i <= columns.length; i++) {
            doc.moveTo(margin + (i * colWidth), y)
                .lineTo(margin + (i * colWidth), y + height)
                .stroke('#E2E8F0');
        }
    };

    const colWidth = pageWidth / columns.length;

    // Draw Table Header
    doc.rect(margin, currentY, pageWidth, headerHeight).fill('#2A4D69');
    doc.fillColor('#FFFFFF');
    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((col, i) => {
        doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 2) - 4, {
            width: colWidth - (cellPadding * 2),
            align: 'center'
        });
    });

    drawLine(currentY);
    drawLine(currentY + headerHeight);
    drawVerticalLines(currentY, headerHeight);
    currentY += headerHeight;

    // Draw Table Body
    doc.fontSize(8).font('Helvetica');
    rows.forEach((row, rowIndex) => {
        if (currentY + rowHeight > doc.page.height - 60) {
            doc.addPage({
                size: 'A4',
                layout: columns.length > 7 ? 'landscape' : 'portrait',
                margin: 40
            });
            currentY = margin + 20;

            // Draw header again on new page
            doc.rect(margin, currentY, pageWidth, headerHeight).fill('#2A4D69');
            doc.fillColor('#FFFFFF');
            doc.fontSize(9).font('Helvetica-Bold');
            columns.forEach((col, i) => {
                doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 2) - 4, {
                    width: colWidth - (cellPadding * 2),
                    align: 'center'
                });
            });
            drawLine(currentY);
            drawLine(currentY + headerHeight);
            drawVerticalLines(currentY, headerHeight);
            currentY += headerHeight;
            doc.fontSize(8).font('Helvetica');
        }

        // Zebra striping
        if (rowIndex % 2 === 0) {
            doc.rect(margin, currentY, pageWidth, rowHeight).fill('#F8FAFC');
        }

        row.forEach((cell, i) => {
            const cellText = cell?.toString() || "-";
            
            // Default text color
            let textColor = '#2D3748';
            let fontStyle = 'Helvetica';

            // Conditional text coloring for statuses in PDF
            if (cellText === 'Present' || cellText === '1.0') {
                textColor = '#137333';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText === 'Absent' || cellText === '0.0') {
                textColor = '#C5221F';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText?.toLowerCase().includes('late') || cellText?.toLowerCase().includes('overtime')) {
                textColor = '#B06000';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText === 'Sun' || cellText === 'Sat') {
                textColor = '#718096';
                fontStyle = 'Helvetica-Bold';
            }

            doc.fillColor(textColor).font(fontStyle);
            doc.text(cellText, margin + (i * colWidth) + cellPadding, currentY + (rowHeight / 2) - 4, {
                width: colWidth - (cellPadding * 2),
                align: 'center',
                lineBreak: false,
                ellipsis: true
            });
        });

        drawLine(currentY + rowHeight);
        drawVerticalLines(currentY, rowHeight);
        currentY += rowHeight;
    });

    // Page number footer pass
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Draw thin page footer line
        doc.moveTo(margin, doc.page.height - 35)
           .lineTo(doc.page.width - margin, doc.page.height - 35)
           .stroke('#E2E8F0');

        doc.fontSize(7)
           .fillColor('#718096')
           .font('Helvetica')
           .text(
               `Page ${i + 1} of ${range.count}`,
               margin,
               doc.page.height - 25,
               { align: 'right' }
           );
           
        doc.text(
            `MANO Attendance & Operations Report  |  Confidential`,
            margin,
            doc.page.height - 25,
            { align: 'left' }
        );
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

// Helper: Style Excel Worksheet beautifully
export const styleExcelWorksheet = (worksheet, type) => {
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
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
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
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
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

            // 4. Conditional Formatting based on cell values
            const val = cell.value?.toString().trim();
            
            // Present or 1.0 status (Green)
            if (val === 'Present' || val === '1.0') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6F4EA' } // Soft Green
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF137333' } // Dark Green
                };
            }
            // Absent or 0.0 status (Red)
            else if (val === 'Absent' || val === '0.0') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFCE8E6' } // Soft Red
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FFC5221F' } // Dark Red
                };
            }
            // Late or Late Minutes/Count > 0 (Orange)
            else if (val?.toLowerCase().includes('late') || (colHeader.includes('late') && Number(val) > 0)) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF7E0' } // Soft Orange/Yellow
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FFB06000' } // Dark Orange/Brown
                };
            }
            // Weekend Sat/Sun (Lavender)
            else if (val === 'Sun' || val === 'Sat') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F3F4' } // Soft Grey/Lavender
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF5F6368' }
                };
            }
            // Leaves status
            else if (val?.toLowerCase() === 'on leave' || val?.toLowerCase() === 'leave' || val?.toLowerCase() === 'half day') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8F0FE' } // Soft Blue
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF1A73E8' }
                };
            }
        });
    });

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



export const previewReport = catchAsync(async (req, res) => {
    const isUserReport = req.originalUrl.includes("/attendance/");
    const targetUserId = isUserReport ? (req.user.user_id || req.user.id) : req.query.user_id;

    if (!isUserReport && req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { month, date, type, startDate, endDate, columns } = req.query;
    const org_id = req.user.org_id;

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report type is required" });
    }

    if (!startDate || !endDate) {
        if (["matrix_monthly", "attendance_matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) && !month) {
            return res.status(400).json({ ok: false, message: "Month is required" });
        }

        if (["matrix_weekly", "matrix_daily", "attendance_matrix_weekly", "attendance_matrix_daily"].includes(type) && !date) {
            return res.status(400).json({ ok: false, message: "Date is required" });
        }
    }

    const { startDate: resolvedStart, endDate: resolvedEnd } = reportsService.resolveDateRange({ type, month, date, startDate, endDate });
    const data = await reportsService.getPreviewData({ type, org_id, month, startDate: resolvedStart, endDate: resolvedEnd, targetUserId, columns });

    res.json({ ok: true, data });
});

export const compileReportBuffer = async ({ org_id, targetUserId, month, date, type, format, startDate: queryStart, endDate: queryEnd, columns }) => {
    const colsObj = typeof columns === 'string' ? JSON.parse(columns) : (columns || {});
    const { startDate, endDate } = reportsService.resolveDateRange({ type, month, date, startDate: queryStart, endDate: queryEnd });

    const users = await reportsService.getUsers({ org_id, targetUserId });
    let records = [];
    if (type !== "employee_master") {
        records = await reportsService.getAttendanceRecords({ org_id, startDate, endDate, targetUserId });
    }

    if (format === "pdf") {
        let pdfTitle = type === "employee_master" ? "Employee Master Data" : `Attendance Report - ${startDate} to ${endDate}`;
        let pdfCols, pdfRows;

        if (type === "attendance_detailed") {
            const detailedRecords = await reportsService.getDetailedRecords({ org_id, startDate, endDate, targetUserId });
            pdfCols = ["Date", "Name", "Dept", "Shift"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            pushPdfCol("In Time", "timeIn", 4);
            pushPdfCol("Out Time", "timeOut", 5);
            pushPdfCol("Work Hrs", "workedHours", 6);
            pdfCols.push("Status");
            pushPdfCol("In Location", "location", 8);
            pushPdfCol("Out Location", "location", 9);

            pdfRows = detailedRecords.map(r => {
                const fullRow = [
                    reportsService.formatLocalDateStr(r.time_in),
                    r.user_name,
                    r.dept_name || "-",
                    r.shift_name || "-",
                    reportsService.formatLocalTimeStr(r.time_in, true),
                    reportsService.formatLocalTimeStr(r.time_out, true),
                    reportsService.calculateWorkHours(r.time_in, r.time_out),
                    reportsService.deriveStatus(r),
                    r.time_in_address || "-",
                    r.time_out_address || "-"
                ];

                const row = [fullRow[0], fullRow[1], fullRow[2], fullRow[3]];
                pdfColIndices.forEach(idx => {
                    if (idx < 7) row.push(fullRow[idx]);
                });
                row.push(fullRow[7]); // Status
                pdfColIndices.forEach(idx => {
                    if (idx >= 8) row.push(fullRow[idx]);
                });
                return row;
            });
        } else if (type === "matrix_daily") {
            pdfCols = ["Name", "Dept"];
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
            pdfCols.push("Status");
            pushPdfCol("In Location", "location", 6);
            pushPdfCol("Out Location", "location", 7);

            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = reportsService.aggregateDayRecords(userRecs, u.policy_rules);
                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    reportsService.formatLocalTimeStr(aggregated.time_in),
                    reportsService.formatLocalTimeStr(aggregated.time_out),
                    aggregated.worked_hours.toFixed(2),
                    aggregated.status,
                    aggregated.time_in_address,
                    aggregated.time_out_address
                ];

                const row = [fullRow[0], fullRow[1]];
                pdfColIndices.forEach(idx => {
                    if (idx < 5) row.push(fullRow[idx]);
                });
                row.push(fullRow[5]); // Status
                pdfColIndices.forEach(idx => {
                    if (idx >= 6) row.push(fullRow[idx]);
                });
                return row;
            });

        } else if (type === "attendance_matrix_daily") {
            pdfCols = ["Name", "Dept", "Attendance"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            pushPdfCol("Req Hrs", "requiredHours", 3);
            pushPdfCol("Worked Hrs", "workedHours", 4);
            pushPdfCol("Late Hrs", "late", 5);
            pushPdfCol("Late Count", "late", 6);
            pushPdfCol("Present Days", "attendanceDays", 7);
            pushPdfCol("Absent Days", "attendanceDays", 8);

            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const aggregated = reportsService.aggregateDayRecords(userRecs, u.policy_rules);
                const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave' ? 1 : 0;
                const reqHrs = reportsService.getShiftHoursForUser(u);
                const workedHrs = aggregated.worked_hours;
                const lateMins = aggregated.late_minutes;
                const lateHrs = lateMins / 60;
                const lateCount = lateMins > 0 ? 1 : 0;
                const fullRow = [
                    u.user_name,
                    u.dept_name || "-",
                    isPresent.toString() + ".0",
                    reqHrs.toFixed(2),
                    workedHrs.toFixed(2),
                    lateHrs.toFixed(2),
                    lateCount,
                    isPresent,
                    isPresent ? 0 : 1
                ];

                const row = [fullRow[0], fullRow[1], fullRow[2]];
                pdfColIndices.forEach(idx => {
                    row.push(fullRow[idx]);
                });
                return row;
            });

        } else if (type === "attendance_matrix_weekly" || type === "attendance_matrix_monthly") {
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

            const start = new Date(startDate);
            const end = new Date(endDate);
            const dateHeaders = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dateHeaders.push(new Date(d));
            }
            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                let totalWorkedHrs = 0;
                let totalLateMins = 0;
                let presentDays = 0;
                dateHeaders.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                    if (aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave') {
                        presentDays++;
                        totalWorkedHrs += aggregated.worked_hours;
                        if (aggregated.late_minutes > 0) {
                            totalLateMins += aggregated.late_minutes;
                        }
                    }
                });
                const reqHrs = reportsService.getRequiredHoursForPeriod(u, dateHeaders);
                
                let calculatedAbsentDays = 0;
                dateHeaders.forEach(d => {
                    const day = d.getDay();
                    const dateStr = d.toISOString().split('T')[0];
                    const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                    const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                    const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave';
                    if (!isPresent && day !== 0 && day !== 6) {
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
            pdfCols = ["Name", "Email", "Phone", "Dept", "Designation", "Role"];
            pdfRows = users.map(u => [u.user_name, u.email || "-", u.phone_no || "-", u.dept_name || "-", u.desg_name || "-", u.user_type || "-"]);
        } else {
            pdfCols = ["Name", "Dept", "Total Days"];
            const pdfColIndices = [];

            const pushPdfCol = (name, check, index) => {
                if (colsObj[check] !== false) {
                    pdfCols.push(name);
                    pdfColIndices.push(index);
                }
            };

            if (colsObj.attendanceDays !== false) {
                pdfCols.push("Present", "Absent", "Half Day", "Leave");
                pdfColIndices.push(3, 4, 5, 6);
            }
            if (colsObj.late !== false) {
                pdfCols.push("Late Days", "Late Mins");
                pdfColIndices.push(7, 8);
            }
            if (colsObj.workedHours !== false) {
                pdfCols.push("OT Hrs", "Total Hrs");
                pdfColIndices.push(9, 10);
            }
            if (colsObj.attendanceDays !== false) {
                pdfCols.push("Payable Days");
                pdfColIndices.push(11);
            }

            const [year, monthNum] = month.split("-").map(Number);
            const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

            // Generate calendar day dates for this month timezone-independently
            const dateStrings = [];
            const startD = new Date(startDate + 'T00:00:00Z');
            const endD = new Date(endDate + 'T00:00:00Z');
            for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
                dateStrings.push(d.toISOString().split('T')[0]);
            }

            const baseRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                
                let presentDays = 0;
                let halfDayCount = 0;
                let leaveCount = 0;
                let absentDays = 0;
                let lateCount = 0;
                let totalLateMins = 0;
                let totalOvertimeHrs = 0;
                let totalHrs = 0;

                dateStrings.forEach(dateStr => {
                    const dayRecs = userRecs.filter(r => {
                        const rDate = new Date(r.time_in).toISOString().split('T')[0];
                        return rDate === dateStr;
                    });

                    if (dayRecs.length > 0) {
                        const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                        
                        if (aggregated.status === "On Leave") {
                            leaveCount++;
                        } else if (aggregated.status === "Half Day") {
                            halfDayCount++;
                            presentDays++;
                        } else if (aggregated.status === "Absent") {
                            absentDays++;
                        } else {
                            presentDays++;
                        }

                        if (aggregated.late_minutes > 0) {
                            lateCount++;
                            totalLateMins += aggregated.late_minutes;
                        }

                        totalHrs += aggregated.worked_hours;

                        let overtime_hours = 0;
                        if (u.policy_rules) {
                            const rules = reportsService.safeParseRules(u.policy_rules);
                            overtime_hours = reportsService.calculateOvertime(aggregated.worked_hours, rules);
                        } else {
                            overtime_hours = dayRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                        }
                        totalOvertimeHrs += overtime_hours;
                    } else {
                        absentDays++;
                    }
                });

                const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
                
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
                    Math.round(payableDays).toFixed(0)
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
                if ([3, 4, 5, 6, 7, 8, 11].includes(idx)) {
                    let sum = 0;
                    baseRows.forEach(r => {
                        const colName = idx === 3 ? "Present" :
                                        idx === 4 ? "Absent" :
                                        idx === 5 ? "Half Day" :
                                        idx === 6 ? "Leave" :
                                        idx === 7 ? "Late Days" :
                                        idx === 8 ? "Late Mins" : "Payable Days";
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
                }
            });
            pdfRows = [...baseRows, totalsRow];
        }

        const pdfDoc = generatePdf(pdfTitle, pdfCols, pdfRows);
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
        cols.push({ header: "Department", key: "dept", width: 20 });

        const pushCol = (header, key, check, width) => {
            if (colsObj[check] !== false) {
                cols.push({ header, key, width });
            }
        };

        pushCol("Time In", "time_in", "timeIn", 15);
        pushCol("Time Out", "time_out", "timeOut", 15);
        pushCol("Work Hours", "work_hrs", "workedHours", 12);
        cols.push({ header: "Status", key: "status", width: 15 });
        pushCol("In Location", "time_in_address", "location", 40);
        pushCol("Out Location", "time_out_address", "location", 40);

        worksheet.columns = cols;
        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const aggregated = reportsService.aggregateDayRecords(userRecs, u.policy_rules);
            
            const rowData = {
                name: u.user_name,
                dept: u.dept_name || "General"
            };

            if (colsObj.timeIn !== false) rowData.time_in = reportsService.formatLocalTimeStr(aggregated.time_in);
            if (colsObj.timeOut !== false) rowData.time_out = reportsService.formatLocalTimeStr(aggregated.time_out);
            if (colsObj.workedHours !== false) rowData.work_hrs = parseFloat(aggregated.worked_hours.toFixed(2));
            rowData.status = aggregated.status;
            if (colsObj.location !== false) {
                rowData.time_in_address = aggregated.time_in_address;
                rowData.time_out_address = aggregated.time_out_address;
            }

            worksheet.addRow(rowData);
        });

        const lastRow = worksheet.rowCount;
        const workHrsColIdx = worksheet.columns.findIndex(c => c.key === "work_hrs") + 1; // 1-based index
        const totalsRowData = { name: "TOTALS" };
        if (workHrsColIdx > 0) {
            const workHrsColLetter = getColLetter(workHrsColIdx);
            totalsRowData.work_hrs = { formula: `SUM(${workHrsColLetter}2:${workHrsColLetter}${lastRow})` };
        }
        worksheet.addRow(totalsRowData);
    } else if (type === "attendance_matrix_daily") {
        const cols = [];
        cols.push({ header: "Name", key: "name", width: 25 });
        cols.push({ header: "Department", key: "dept", width: 20 });
        cols.push({ header: "Attendance", key: "attendance", width: 15 });

        const pushCol = (header, key, check, width) => {
            if (colsObj[check] !== false) {
                cols.push({ header, key, width });
            }
        };

        pushCol("Required Hours", "req_hrs", "requiredHours", 18);
        pushCol("Worked Hours", "worked_hrs", "workedHours", 15);
        pushCol("Late Hours", "late_hrs", "late", 15);
        pushCol("Late Count", "late_count", "late", 15);
        pushCol("Present Days", "present_days", "attendanceDays", 15);
        pushCol("Absent Days", "absent_days", "attendanceDays", 15);

        worksheet.columns = cols;
        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const aggregated = reportsService.aggregateDayRecords(userRecs, u.policy_rules);
            const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave' ? 1 : 0;
            const reqHrs = reportsService.getShiftHoursForUser(u);
            const workedHrs = aggregated.worked_hours;
            const lateMins = aggregated.late_minutes;
            const lateHrs = lateMins / 60;
            const lateCount = lateMins > 0 ? 1 : 0;

            const rowData = {
                name: u.user_name,
                dept: u.dept_name || "General",
                attendance: isPresent.toString() + ".0"
            };

            if (colsObj.requiredHours !== false) rowData.req_hrs = parseFloat(reqHrs.toFixed(2));
            if (colsObj.workedHours !== false) rowData.worked_hrs = parseFloat(workedHrs.toFixed(2));
            if (colsObj.late !== false) {
                rowData.late_hrs = parseFloat(lateHrs.toFixed(2));
                rowData.late_count = lateCount;
            }
            if (colsObj.attendanceDays !== false) {
                rowData.present_days = isPresent;
                rowData.absent_days = isPresent ? 0 : 1;
            }

            worksheet.addRow(rowData);
        });

        const lastRow = worksheet.rowCount;
        const totalsRowData = { name: "TOTALS" };
        worksheet.columns.forEach((col, idx) => {
            const key = col.key;
            if (["req_hrs", "worked_hrs", "late_hrs", "late_count", "present_days", "absent_days"].includes(key)) {
                const letter = getColLetter(idx + 1);
                totalsRowData[key] = { formula: `SUM(${letter}2:${letter}${lastRow})` };
            }
        });
        worksheet.addRow(totalsRowData);
    } else if (type === "attendance_matrix_weekly" || type === "attendance_matrix_monthly") {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateHeaders = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateHeaders.push(new Date(d));
        }

        const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
        const gridHeaders = dateHeaders.map(d => `${d.getDate()}\n${d.toLocaleDateString('en-US', { weekday: 'short' })}`);
        
        const summaryCols = [];
        const summaryChecks = [];
        const pushSummary = (name, check) => {
            if (colsObj[check] !== false) {
                summaryCols.push(name);
                summaryChecks.push(check);
            }
        };
        pushSummary("Required Hrs", "requiredHours");
        pushSummary("Worked Hrs", "workedHours");
        pushSummary("Late Hours", "late");
        pushSummary("Late Count", "late");
        pushSummary("Present Days", "attendanceDays");
        pushSummary("Absent Days", "attendanceDays");

        worksheet.addRow([...baseHeaders, ...gridHeaders, ...summaryCols]);
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        users.forEach((u, index) => {
            const userRecs = records.filter(r => r.user_id === u.user_id);

            const userRow = [
                index + 1,
                u.user_name,
                u.desg_name || "-",
                u.dept_name || "-"
            ];

            let totalWorkedHrs = 0;
            let totalLateMins = 0;
            let presentDays = 0;

            const dateCells = [];
            dateHeaders.forEach(d => {
                const dateStr = d.toISOString().split('T')[0];
                const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                if (aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave') {
                    dateCells.push("1.0");
                    presentDays++;
                    totalWorkedHrs += aggregated.worked_hours;
                    if (aggregated.late_minutes > 0) {
                        totalLateMins += aggregated.late_minutes;
                    }
                } else {
                    dateCells.push("0.0");
                }
            });

            const reqHrs = reportsService.getRequiredHoursForPeriod(u, dateHeaders);
            const workedHrs = totalWorkedHrs;
            const lateHrs = totalLateMins / 60;
            const lateCount = userRecs.filter(r => r.late_minutes > 0).length;

            let calculatedAbsentDays = 0;
            dateHeaders.forEach(d => {
                const day = d.getDay();
                const dateStr = d.toISOString().split('T')[0];
                const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                const isPresent = aggregated.time_in && aggregated.status !== 'Absent' && aggregated.status !== 'On Leave';
                if (!isPresent && day !== 0 && day !== 6) {
                    calculatedAbsentDays++;
                }
            });

            userRow.push(...dateCells);

            if (colsObj.requiredHours !== false) userRow.push(parseFloat(reqHrs.toFixed(2)));
            if (colsObj.workedHours !== false) userRow.push(parseFloat(workedHrs.toFixed(2)));
            if (colsObj.late !== false) {
                userRow.push(parseFloat(lateHrs.toFixed(2)));
                userRow.push(lateCount);
            }
            if (colsObj.attendanceDays !== false) {
                userRow.push(presentDays);
                userRow.push(calculatedAbsentDays);
            }

            worksheet.addRow(userRow);
        });

        // Add TOTALS row
        const totalsRow = ["TOTALS", "", "", ""];
        dateHeaders.forEach(() => {
            totalsRow.push("");
        });

        const startColIndex = baseHeaders.length + dateHeaders.length + 1; // 1-based index in Excel
        const lastRow = worksheet.rowCount;

        let currCol = startColIndex;
        if (colsObj.requiredHours !== false) {
            const letter = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter}2:${letter}${lastRow})` });
            currCol++;
        }
        if (colsObj.workedHours !== false) {
            const letter = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter}2:${letter}${lastRow})` });
            currCol++;
        }
        if (colsObj.late !== false) {
            const letter1 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter1}2:${letter1}${lastRow})` });
            currCol++;
            const letter2 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter2}2:${letter2}${lastRow})` });
            currCol++;
        }
        if (colsObj.attendanceDays !== false) {
            const letter1 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter1}2:${letter1}${lastRow})` });
            currCol++;
            const letter2 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter2}2:${letter2}${lastRow})` });
            currCol++;
        }

        worksheet.addRow(totalsRow);
    } else if (type === "attendance_detailed") {
        const cols = [
            { header: "Date", key: "date", width: 15 },
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Shift", key: "shift", width: 15 }
        ];

        const pushCol = (header, key, check, width) => {
            if (colsObj[check] !== false) {
                cols.push({ header, key, width });
            }
        };

        pushCol("Time In", "time_in", "timeIn", 15);
        pushCol("Time Out", "time_out", "timeOut", 15);
        pushCol("Work Hrs", "work_hrs", "workedHours", 12);
        cols.push({ header: "Status", key: "status", width: 15 });
        pushCol("In Location", "time_in_address", "location", 40);
        pushCol("Out Location", "time_out_address", "location", 40);

        worksheet.columns = cols;
        const detailedRecords = await reportsService.getDetailedRecords({ org_id, startDate, endDate });
        detailedRecords.forEach(r => {
            const rowData = {
                date: reportsService.formatLocalDateStr(r.time_in),
                name: r.user_name,
                dept: r.dept_name || "-",
                shift: r.shift_name || "-"
            };

            if (colsObj.timeIn !== false) rowData.time_in = reportsService.formatLocalTimeStr(r.time_in, true);
            if (colsObj.timeOut !== false) rowData.time_out = reportsService.formatLocalTimeStr(r.time_out, true);
            if (colsObj.workedHours !== false) rowData.work_hrs = reportsService.calculateWorkHours(r.time_in, r.time_out);
            rowData.status = reportsService.deriveStatus(r);
            if (colsObj.location !== false) {
                rowData.time_in_address = r.time_in_address || "-";
                rowData.time_out_address = r.time_out_address || "-";
            }

            worksheet.addRow(rowData);
        });
    } else if (type === "attendance_summary") {
        const cols = [
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Total Days", key: "total_days", width: 12 }
        ];

        const pushCol = (header, key, width) => {
            cols.push({ header, key, width });
        };

        if (colsObj.attendanceDays !== false) {
            pushCol("Present", "present", 10);
            pushCol("Absent", "absent", 10);
            pushCol("Half Day", "half_day", 10);
            pushCol("On Leave", "leaves", 10);
        }
        if (colsObj.late !== false) {
            pushCol("Late Days", "late_days", 12);
            pushCol("Late Mins", "late_mins", 12);
        }
        if (colsObj.workedHours !== false) {
            pushCol("Overtime Hrs", "overtime_hrs", 15);
            pushCol("Total Hrs", "total_hrs", 12);
        }
        if (colsObj.attendanceDays !== false) {
            pushCol("Payable Days", "payable_days", 15);
        }

        worksheet.columns = cols;
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
        // Generate calendar day dates for this month timezone-independently
        const dateStrings = [];
        const startD = new Date(startDate + 'T00:00:00Z');
        const endD = new Date(endDate + 'T00:00:00Z');
        for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
            dateStrings.push(d.toISOString().split('T')[0]);
        }

        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            
            let presentDays = 0;
            let halfDayCount = 0;
            let leaveCount = 0;
            let absentDays = 0;
            let lateCount = 0;
            let totalLateMins = 0;
            let totalOvertimeHrs = 0;
            let totalHrs = 0;

            dateStrings.forEach(dateStr => {
                const dayRecs = userRecs.filter(r => {
                    const rDate = new Date(r.time_in).toISOString().split('T')[0];
                    return rDate === dateStr;
                });

                if (dayRecs.length > 0) {
                    const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                    
                    if (aggregated.status === "On Leave") {
                        leaveCount++;
                    } else if (aggregated.status === "Half Day") {
                        halfDayCount++;
                        presentDays++;
                    } else if (aggregated.status === "Absent") {
                        absentDays++;
                    } else {
                        presentDays++;
                    }

                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        totalLateMins += aggregated.late_minutes;
                    }

                    totalHrs += aggregated.worked_hours;

                    let overtime_hours = 0;
                    if (u.policy_rules) {
                        const rules = reportsService.safeParseRules(u.policy_rules);
                        overtime_hours = reportsService.calculateOvertime(aggregated.worked_hours, rules);
                    } else {
                        overtime_hours = dayRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                    }
                    totalOvertimeHrs += overtime_hours;
                } else {
                    absentDays++;
                }
            });

            const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
            
            const rowData = {
                name: u.user_name,
                dept: u.dept_name || "-",
                total_days: totalDaysInMonth
            };

            if (colsObj.attendanceDays !== false) {
                rowData.present = presentDays;
                rowData.absent = absentDays;
                rowData.half_day = halfDayCount;
                rowData.leaves = leaveCount;
            }
            if (colsObj.late !== false) {
                rowData.late_days = lateCount;
                rowData.late_mins = totalLateMins;
            }
            if (colsObj.workedHours !== false) {
                rowData.overtime_hrs = parseFloat(totalOvertimeHrs.toFixed(2));
                rowData.total_hrs = parseFloat(totalHrs.toFixed(2));
            }
            if (colsObj.attendanceDays !== false) {
                rowData.payable_days = Math.round(payableDays);
            }

            worksheet.addRow(rowData);
        });

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
                totalsRow[key] = { formula: `SUM(${letter}2:${letter}${lastRow})` };
            }
        });
        worksheet.addRow(totalsRow);

    } else if (type === "employee_master") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Email", key: "email", width: 30 },
            { header: "Phone", key: "phone", width: 15 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Designation", key: "desg", width: 20 },
            { header: "Role", key: "user_type", width: 15 }
        ];
        users.forEach(u => {
            worksheet.addRow({
                name: u.user_name,
                email: u.email || "-",
                phone: u.phone_no || "-",
                dept: u.dept_name || "-",
                desg: u.desg_name || "-",
                user_type: u.user_type
            });
        });
    } else {
        // Multi-day Matrix
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateHeaders = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateHeaders.push(new Date(d));
        }

        const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
        
        let dailyColspan = 0;
        const subCols = [];
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

        // Add Row 1 (Top Header)
        const r1Values = ["SR No.", "Name", "Position", "Dept"];
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
        worksheet.addRow(r1Values);

        // Add Row 2 (Sub Header)
        const r2Values = ["", "", "", ""];
        if (dailyColspan > 0) {
            dateHeaders.forEach(() => {
                subCols.forEach(sc => {
                    r2Values.push(sc.label);
                });
            });
        }
        summaryCols.forEach(() => r2Values.push(""));
        worksheet.addRow(r2Values);

        // Merge cells
        // Merge base headers vertically (Columns 1 to 4)
        for (let col = 1; col <= 4; col++) {
            worksheet.mergeCells(1, col, 2, col);
        }

        // Merge date headers horizontally
        let currentCol = 5;
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

        // Add data rows
        users.forEach((u, index) => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const userRow = [index + 1, u.user_name, u.desg_name || "-", u.dept_name || "-"];

            let totalHrs = 0;
            let lateCount = 0;
            let lateMins = 0;

            dateHeaders.forEach(d => {
                const dateStr = d.toISOString().split('T')[0];
                const dayRecs = userRecs.filter(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                const aggregated = reportsService.aggregateDayRecords(dayRecs, u.policy_rules);
                if (aggregated.time_in) {
                    subCols.forEach(sc => {
                        if (sc.label === "In Time") userRow.push(reportsService.formatLocalTimeStr(aggregated.time_in));
                        else if (sc.label === "Out Time") userRow.push(reportsService.formatLocalTimeStr(aggregated.time_out));
                        else if (sc.label === "Work Hrs") userRow.push(parseFloat(aggregated.worked_hours.toFixed(2)));
                        else if (sc.label === "Req Hrs") {
                            const dayOfWeek = d.getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const req = isWeekend ? 0 : reportsService.getShiftHoursForUser(u);
                            userRow.push(parseFloat(req.toFixed(2)));
                        }
                        else if (sc.label === "Late Mins") userRow.push(aggregated.late_minutes);
                        else if (sc.label === "In Location") userRow.push(aggregated.time_in_address || "-");
                        else if (sc.label === "Out Location") userRow.push(aggregated.time_out_address || "-");
                    });

                    totalHrs += aggregated.worked_hours;
                    if (aggregated.late_minutes > 0) {
                        lateCount++;
                        lateMins += aggregated.late_minutes;
                    }
                } else {
                    const day = d.getDay();
                    const statusStr = day === 0 ? "Sun" : day === 6 ? "Sat" : "Absent";
                    subCols.forEach((sc, scIdx) => {
                        if (scIdx === 0) userRow.push(statusStr);
                        else userRow.push("-");
                    });
                }
            });

            if (colsObj.attendanceDays !== false) userRow.push(userRecs.length);
            if (colsObj.workedHours !== false) userRow.push(parseFloat(totalHrs.toFixed(2)));
            if (colsObj.late !== false) {
                userRow.push(lateCount);
                userRow.push(lateMins);
            }
            const row = worksheet.addRow(userRow);
            row.eachCell((cell) => {
                if (cell.value === "Absent" || cell.value === "0.0") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
                    cell.font = { color: { argb: 'FFC5221F' }, bold: true };
                }
                if (cell.value === "Sun" || cell.value === "Sat") {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F4' } };
                    cell.font = { color: { argb: 'FF5F6368' }, bold: true };
                }
            });
        });

        // Add TOTALS row
        const totalsRow = ["TOTALS", "", "", ""];
        // Add empty cells for all grid columns
        dateHeaders.forEach(() => {
            if (dailyColspan > 0) {
                for (let i = 0; i < dailyColspan; i++) {
                    totalsRow.push("");
                }
            }
        });

        const startColIndex = baseHeaders.length + (dateHeaders.length * dailyColspan) + 1; // 1-based index in Excel
        const lastRow = worksheet.rowCount;

        let currCol = startColIndex;
        if (colsObj.requiredHours !== false) {
            const letter = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter}3:${letter}${lastRow})` });
            currCol++;
        }
        if (colsObj.workedHours !== false) {
            const letter = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter}3:${letter}${lastRow})` });
            currCol++;
        }
        if (colsObj.late !== false) {
            const letter1 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter1}3:${letter1}${lastRow})` });
            currCol++;
            const letter2 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter2}3:${letter2}${lastRow})` });
            currCol++;
        }
        if (colsObj.attendanceDays !== false) {
            const letter1 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter1}3:${letter1}${lastRow})` });
            currCol++;
            const letter2 = getColLetter(currCol);
            totalsRow.push({ formula: `SUM(${letter2}3:${letter2}${lastRow})` });
            currCol++;
        }

        worksheet.addRow(totalsRow);
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

import { reportQueue } from '../../config/queues.js';
import crypto from 'crypto';

export const downloadReport = catchAsync(async (req, res) => {
    const { month, date, type, format = "xlsx", startDate, endDate, columns } = req.query;
    
    // TEMPORARY DEBUG LOGGING
    try {
        const fs = await import('fs');
        fs.appendFileSync('request-debug.log', `[${new Date().toISOString()}] downloadReport req.query: ${JSON.stringify(req.query)}\n`);
    } catch (e) {}
    const org_id = req.user.org_id;
    const isUserReport = req.originalUrl.includes("/attendance/");
    const targetUserId = isUserReport ? (req.user.user_id || req.user.id) : req.query.user_id;

    if (!isUserReport && req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report Type is required" });
    }

    if (!startDate || !endDate) {
        if (["matrix_monthly", "attendance_matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) && !month) {
            return res.status(400).json({ ok: false, message: "Month is required" });
        }

        if (["matrix_weekly", "matrix_daily", "attendance_matrix_weekly", "attendance_matrix_daily"].includes(type) && !date) {
            return res.status(400).json({ ok: false, message: "Date is required" });
        }
    }

    const reportId = crypto.randomUUID();

    // 1. Write status entry to generated_reports table
    await attendanceDB('generated_reports').insert({
        report_id: reportId,
        user_id: req.user.user_id || req.user.id,
        org_id,
        report_type: type,
        format,
        status: 'pending'
    });

    const filename = `Report_${type}_${month || date || `${startDate}_to_${endDate}`}.${format}`;

    // 2. Add job to BullMQ
    await reportQueue.add('generate-report', {
        reportId,
        org_id,
        user_id: req.user.user_id || req.user.id,
        targetUserId,
        month,
        date,
        type,
        format,
        filename,
        startDate,
        endDate,
        columns: typeof columns === 'string' ? columns : JSON.stringify(columns)
    }, {
        attempts: 3,
        backoff: 5000
    });

    res.status(202).json({
        ok: true,
        message: "Report queued successfully",
        reportId
    });
});

export const getReportStatus = catchAsync(async (req, res) => {
    const { reportId } = req.params;
    const org_id = req.user.org_id;

    const report = await attendanceDB('generated_reports')
        .where({ report_id: reportId, org_id })
        .first();

    if (!report) {
        return res.status(404).json({ ok: false, message: "Report not found" });
    }

    if (req.user.user_type !== "admin" && req.user.user_type !== "hr" && report.user_id !== (req.user.user_id || req.user.id)) {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    res.json({ ok: true, data: report });
});