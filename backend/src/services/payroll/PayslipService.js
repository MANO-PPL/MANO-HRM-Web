import PDFDocument from 'pdfkit';
import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export class PayslipService {
    /**
     * Generate PDF payslip for a finalized payroll entry.
     * 
     * @param {number} entryId 
     * @returns {Promise<Buffer>} The PDF file buffer
     */
    static async generatePayslipPDF(entryId) {
        const entry = await attendanceDB('payroll_entries as pe')
            .join('users as u', 'pe.employee_id', 'u.user_id')
            .join('payroll_runs as pr', 'pe.run_id', 'pr.run_id')
            .join('organizations as o', 'pr.org_id', 'o.org_id')
            .leftJoin('designations as dg', 'u.desg_id', 'dg.desg_id')
            .leftJoin('departments as d', 'u.dept_id', 'd.dept_id')
            .select(
                'pe.*',
                'u.user_name',
                'u.user_code',
                'u.email',
                'pr.month',
                'pr.year',
                'pr.status as run_status',
                'o.org_name',
                'dg.desg_name',
                'd.dept_name'
            )
            .where('pe.entry_id', entryId)
            .first();

        if (!entry) {
            throw new AppError('Payroll entry not found.', 404);
        }

        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = months[entry.month - 1];

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', (err) => reject(err));

                // Primary Color Theme: GitHub Dark Theme Accent / Professional Blue
                const primaryColor = '#0969da';
                const textColor = '#24292f';
                const lightBgColor = '#f6f8fa';
                const borderLight = '#d0d7de';

                // --- Header Section ---
                doc.fillColor(primaryColor)
                   .fontSize(22)
                   .font('Helvetica-Bold')
                   .text(entry.org_name.toUpperCase(), 50, 50);

                doc.fillColor('#57606a')
                   .fontSize(10)
                   .font('Helvetica')
                   .text('Monthly Payroll Statement', 50, 75);

                doc.fillColor(textColor)
                   .fontSize(14)
                   .font('Helvetica-Bold')
                   .text(`Payslip for ${monthName} ${entry.year}`, 330, 50, { align: 'right', width: 215 });

                doc.fillColor('#2da44e')
                   .fontSize(10)
                   .font('Helvetica-Bold')
                   .text(`Status: ${entry.status || entry.run_status}`, 330, 70, { align: 'right', width: 215 });

                // Divider Line
                doc.moveTo(50, 95)
                   .lineTo(545, 95)
                   .strokeColor(borderLight)
                   .lineWidth(1)
                   .stroke();

                // --- Employee details section ---
                doc.fillColor(primaryColor)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text('Employee Information', 50, 115);

                // Information Grid Box
                doc.rect(50, 130, 495, 80)
                   .fill(lightBgColor);

                doc.fillColor(textColor).fontSize(10);
                
                // Left Column
                doc.font('Helvetica-Bold').text('Employee Code:', 65, 145);
                doc.font('Helvetica').text(entry.user_code || '-', 160, 145);

                doc.font('Helvetica-Bold').text('Employee Name:', 65, 165);
                doc.font('Helvetica').text(entry.user_name, 160, 165);

                doc.font('Helvetica-Bold').text('Email Address:', 65, 185);
                doc.font('Helvetica').text(entry.email || '-', 160, 185);

                // Right Column
                doc.font('Helvetica-Bold').text('Department:', 310, 145);
                doc.font('Helvetica').text(entry.dept_name || '-', 390, 145);

                doc.font('Helvetica-Bold').text('Designation:', 310, 165);
                doc.font('Helvetica').text(entry.desg_name || '-', 390, 165);

                doc.font('Helvetica-Bold').text('Payroll ID:', 310, 185);
                doc.font('Helvetica').text(`PE-${entry.entry_id.toString().padStart(6, '0')}`, 390, 185);

                // --- Attendance Summary Section ---
                doc.fillColor(primaryColor)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text('Attendance & Leave Summary', 50, 230);

                const tableTop = 245;
                
                // Draw grid headers
                doc.rect(50, tableTop, 495, 20).fill('#eaeef2');
                doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
                doc.text('Present', 60, tableTop + 6);
                doc.text('Half Days', 125, tableTop + 6);
                doc.text('Absent', 190, tableTop + 6);
                doc.text('On Leave', 255, tableTop + 6);
                doc.text('Holidays', 320, tableTop + 6);
                doc.text('Week Offs', 385, tableTop + 6);
                doc.text('Overtime', 450, tableTop + 6);

                // Draw values
                doc.fillColor(textColor).fontSize(9).font('Helvetica');
                doc.text(String(entry.present_days), 60, tableTop + 28);
                doc.text(String(entry.half_days), 125, tableTop + 28);
                doc.text(String(entry.absent_days), 190, tableTop + 28);
                doc.text(String(entry.paid_leave_days), 255, tableTop + 28);
                doc.text(String(entry.holiday_days), 320, tableTop + 28);
                doc.text(String(entry.weekly_off_days), 385, tableTop + 28);
                doc.text(`${entry.overtime_hours} hrs`, 450, tableTop + 28);

                doc.moveTo(50, tableTop + 45)
                   .lineTo(545, tableTop + 45)
                   .strokeColor(borderLight)
                   .stroke();

                // --- Financial Details Breakdown ---
                doc.fillColor(primaryColor)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text('Salary & Deductions Details', 50, 310);

                const billTop = 330;

                // Table headers
                doc.rect(50, billTop, 240, 20).fill('#eaeef2');
                doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
                doc.text('EARNINGS', 60, billTop + 6);
                doc.text('AMOUNT', 210, billTop + 6, { align: 'right', width: 70 });

                doc.rect(305, billTop, 240, 20).fill('#eaeef2');
                doc.text('DEDUCTIONS', 315, billTop + 6);
                doc.text('AMOUNT', 465, billTop + 6, { align: 'right', width: 70 });

                doc.fontSize(9).font('Helvetica');

                // Parse adjustments
                const adjustments = entry.adjustments_json 
                    ? (typeof entry.adjustments_json === 'string' ? JSON.parse(entry.adjustments_json) : entry.adjustments_json) 
                    : [];

                const additions = adjustments.filter(a => a.type === 'addition');
                const deductions = adjustments.filter(a => a.type === 'deduction');

                // Left side items (Earnings / Additions)
                let leftY = billTop + 28;
                doc.fillColor(textColor).text('Gross Monthly Salary', 60, leftY);
                doc.text(`₹${Number(entry.gross_salary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 210, leftY, { align: 'right', width: 70 });

                if (Number(entry.overtime_amount) > 0) {
                    leftY += 20;
                    doc.text(`Overtime Allowance (${entry.overtime_hours} hrs)`, 60, leftY);
                    doc.text(`₹${Number(entry.overtime_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 210, leftY, { align: 'right', width: 70 });
                }

                for (const adj of additions) {
                    leftY += 20;
                    doc.text(adj.label, 60, leftY);
                    doc.text(`₹${Number(adj.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 210, leftY, { align: 'right', width: 70 });
                }

                // Right side items (Deductions)
                let rightY = billTop + 28;
                doc.text('Loss of Pay (LOP) Deduction', 315, rightY);
                doc.text(`₹${Number(entry.lop_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 465, rightY, { align: 'right', width: 70 });

                for (const adj of deductions) {
                    rightY += 20;
                    doc.text(adj.label, 315, rightY);
                    doc.text(`₹${Number(adj.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 465, rightY, { align: 'right', width: 70 });
                }

                // Grid Divider line (positioned below the longest list)
                const maxY = Math.max(leftY, rightY);
                const dividerY = Math.max(billTop + 80, maxY + 20);

                doc.moveTo(50, dividerY)
                   .lineTo(545, dividerY)
                   .strokeColor(borderLight)
                   .stroke();

                // Net Salary Box (Highlight block)
                const netTop = dividerY + 15;
                doc.rect(50, netTop, 495, 40).fill(primaryColor);

                doc.fillColor('#ffffff')
                   .fontSize(12)
                   .font('Helvetica-Bold')
                   .text('NET PAYABLE SALARY', 65, netTop + 14);

                const formattedNet = `₹${Number(entry.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                doc.text(formattedNet, 330, netTop + 14, { align: 'right', width: 200 });

                // LOP detail text
                doc.fillColor('#57606a')
                   .fontSize(8)
                   .font('Helvetica-Oblique')
                   .text(`* Deductions calculated based on ${entry.lop_days} LOP (Loss of Pay) days in ${monthName}.`, 50, netTop + 50);

                // --- Footer ---
                doc.moveTo(50, 750)
                   .lineTo(545, 750)
                   .strokeColor(borderLight)
                   .stroke();

                doc.fillColor('#8c959f')
                   .fontSize(8)
                   .font('Helvetica')
                   .text('This is a computer-generated payslip and does not require a physical signature.', 50, 760, { align: 'center', width: 495 });

                doc.text('Powered by MANO Attendance HRMS Platform v1.0', 50, 772, { align: 'center', width: 495 });

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }
}
