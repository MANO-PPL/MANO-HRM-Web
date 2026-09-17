import catchAsync from '../../utils/catchAsync.js';
import * as labourExportService from './labourExportService.js';

/**
 * Controller to export the Complete 3-Row Daily Spreadsheet & Monthly Wage Ledger to styled Excel (.xlsx)
 * Balance Payable = Gross Amount (Base + OT) - Total Advances (independent of recorded payouts)
 */
export const exportDetailedMonthlyLedgerExcel = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { site_id, month } = req.query;

    const { workbook, filename } = await labourExportService.generateDetailedMonthlyLedgerWorkbook({
        org_id,
        site_id,
        month
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
});
