import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { cacheService } from '../cache/cacheService.js';
import { PayrollCalculationService } from '../payroll/PayrollCalculationService.js';
import EventBus from '../../utils/EventBus.js';

// Helper to notify employees when new holidays are declared
async function notifyNewHolidays(org_id, holidays) {
    try {
        const users = await attendanceDB('core_users')
            .where({ org_id, is_deleted: 0, is_active: 1 })
            .select('user_id');

        for (const h of holidays) {
            for (const user of users) {
                EventBus.emitNotification({
                    org_id,
                    user_id: user.user_id,
                    title: 'New Holiday Declared',
                    message: `A new holiday has been declared: ${h.holiday_name} on ${h.holiday_date}.`,
                    type: 'INFO',
                    related_entity_type: 'HOLIDAY',
                    related_entity_id: null
                });
            }
        }
    } catch (err) {
        console.error('Error in notifyNewHolidays:', err);
    }
}

// Standardizes date strings (DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) to YYYY-MM-DD
function standardizeDate(dateVal) {
    if (!dateVal) return null;
    
    // 1. If it's a JS Date object
    if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return null;
        // ExcelJS dates are parsed as UTC midnight.
        // We use UTC methods to prevent local timezone shifts (e.g. UTC-5/UTC+5:30 shifting the day).
        const year = dateVal.getUTCFullYear();
        const month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 2. If it's a string, standardize it
    let dateStr = String(dateVal).trim();
    if (!dateStr) return null;

    // Remove any timestamp part if it exists (e.g. "2025-08-15T00:00:00.000Z" or "2025-08-15 00:00:00")
    dateStr = dateStr.split(/[T ]/)[0];

    // Check if it matches YYYY-MM-DD
    const matchYMD = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (matchYMD) {
        const year = matchYMD[1];
        const month = matchYMD[2].padStart(2, '0');
        const day = matchYMD[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Check if it matches DD-MM-YYYY or MM-DD-YYYY or DD/MM/YYYY or MM/DD/YYYY
    const matchDMY = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (matchDMY) {
        const p0 = parseInt(matchDMY[1], 10);
        const p1 = parseInt(matchDMY[2], 10);
        let yearStr = matchDMY[3];
        if (yearStr.length === 2) {
            yearStr = `20${yearStr}`;
        }

        let day, month;
        // If p0 > 12, then p0 must be day, p1 is month (e.g. 26-01-2025)
        if (p0 > 12) {
            day = p0;
            month = p1;
        } 
        // If p1 > 12, then p1 must be day, p0 is month (e.g. 01-26-2025)
        else if (p1 > 12) {
            day = p1;
            month = p0;
        } 
        // Ambiguous (both <= 12). Default to DD-MM-YYYY
        else {
            day = p0;
            month = p1;
        }

        return `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Try parsing other formats using native Date only as a last resort
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return null;
}

// Extract raw value or formula result from ExcelJS cell and format to YYYY-MM-DD
function getCleanDate(cell) {
    if (!cell) return null;
    let val = cell.value;
    if (val && typeof val === 'object' && 'result' in val) {
        val = val.result;
    }
    return standardizeDate(val);
}

//Get All Holidays
export const getHolidays = async (org_id) => {
    const cacheKey = `mano-cache:holidays:org:${org_id}`;

    // 1. Try cache read
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // 2. Fetch from DB on Cache Miss
    const holidays = await attendanceDB('org_holidays')
        .select(
            '*',
            attendanceDB.raw(
                "DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date"
            )
        )
        .where({ org_id });

    // 3. Write cache for future hits
    await cacheService.set(cacheKey, holidays);

    return holidays;
};

//Bulk or Single Insert
export const createHolidays = async (org_id, holidaysToInsert) => {

    const prepareData = holidaysToInsert.map(h => {
        const cleanDate = standardizeDate(h.holiday_date);
        if (!h.holiday_name || !cleanDate) {
            const error = new Error(
                'Missing or invalid required fields (holiday_name, holiday_date)'
            );
            error.statusCode = 400;
            throw error;
        }
        return {
            org_id,
            holiday_name: h.holiday_name,
            holiday_date: cleanDate,
            holiday_type: h.holiday_type || 'Public',
            applicable_json: JSON.stringify(
                h.applicable_json || []
            )
        };
    });

    await attendanceDB.transaction(async (trx) => {

        await trx('org_holidays').insert(prepareData);

    });

    // Invalidate Cache
    await cacheService.del(`mano-cache:holidays:org:${org_id}`);

    // Trigger organization-wide draft payroll updates in the background
    try {
        const uniquePeriods = new Set();
        for (const h of prepareData) {
            const date = new Date(h.holiday_date);
            if (!isNaN(date.getTime())) {
                uniquePeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
            }
        }
        for (const period of uniquePeriods) {
            const [year, month] = period.split('-').map(Number);
            PayrollCalculationService.updateDraftEntriesForOrg(org_id, year, month).catch(err => {
                console.error("Failed to update draft entries for org after holiday creation:", err);
            });
        }
    } catch (e) {
        console.error("Failed to trigger background payroll calculation for holiday creation:", e);
    }

    // Trigger push notifications
    notifyNewHolidays(org_id, prepareData).catch(console.error);

    return prepareData.length;

};

//Update Holiday
export const updateHoliday = async (id, org_id, data) => {

    const updates = {};

    if (data.holiday_name)
        updates.holiday_name = data.holiday_name;

    if (data.holiday_date) {
        const cleanDate = standardizeDate(data.holiday_date);
        if (cleanDate) updates.holiday_date = cleanDate;
    }

    if (data.holiday_type)
        updates.holiday_type = data.holiday_type;

    if (data.applicable_json)
        updates.applicable_json =
            JSON.stringify(data.applicable_json);


    const holiday = await attendanceDB('org_holidays').where({ holiday_id: id, org_id }).first();

    const count = await attendanceDB('org_holidays')
        .where({
            holiday_id: id,
            org_id
        })
        .update(updates);

    // Invalidate Cache
    await cacheService.del(`mano-cache:holidays:org:${org_id}`);

    if (count > 0 && holiday) {
        try {
            const datesToProcess = [holiday.holiday_date];
            if (updates.holiday_date) datesToProcess.push(updates.holiday_date);
            
            const uniquePeriods = new Set();
            for (const d of datesToProcess) {
                const date = new Date(d);
                if (!isNaN(date.getTime())) {
                    uniquePeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
                }
            }

            for (const period of uniquePeriods) {
                const [year, month] = period.split('-').map(Number);
                PayrollCalculationService.updateDraftEntriesForOrg(org_id, year, month).catch(err => {
                    console.error("Failed to update draft entries for org after holiday update:", err);
                });
            }
        } catch (e) {
            console.error("Failed to trigger background payroll calculation for holiday update:", e);
        }
    }

    return count;

};

//Delete Holidays
export const deleteHolidays = async (org_id, ids) => {

    const holidays = await attendanceDB('org_holidays').whereIn('holiday_id', ids).andWhere({ org_id }).select('holiday_date');

    const count = await attendanceDB('org_holidays')
        .whereIn('holiday_id', ids)
        .andWhere({ org_id })
        .del();

    // Invalidate Cache
    await cacheService.del(`mano-cache:holidays:org:${org_id}`);

    if (count > 0 && holidays.length > 0) {
        try {
            const uniquePeriods = new Set();
            for (const h of holidays) {
                const date = new Date(h.holiday_date);
                if (!isNaN(date.getTime())) {
                    uniquePeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
                }
            }

            for (const period of uniquePeriods) {
                const [year, month] = period.split('-').map(Number);
                PayrollCalculationService.updateDraftEntriesForOrg(org_id, year, month).catch(err => {
                    console.error("Failed to update draft entries for org after holiday deletion:", err);
                });
            }
        } catch (e) {
            console.error("Failed to trigger background payroll calculation for holiday deletion:", e);
        }
    }

    return count;

};

// Validate bulk holidays before import
export const validateBulkHolidays = async (org_id, holidays) => {
    const response = {
        duplicates: [],
        valid_count: 0,
        invalid_rows: []
    };

    const inputDates = new Set();
    const standardizedHolidays = holidays.map((h, index) => {
        const name = h['Holiday Name'] || h['holiday_name'] || h['name'];
        const rawDate = h['Date'] || h['holiday_date'] || h['date'];
        const cleanDate = standardizeDate(rawDate);

        if (!name || !cleanDate) {
            response.invalid_rows.push({
                row: index + 1,
                reason: 'Missing Holiday Name or Invalid/Missing Date'
            });
            return null;
        }

        inputDates.add(cleanDate);
        return { name, date: cleanDate, type: h['Type'] || h['holiday_type'] || h['type'] || 'Public' };
    });

    if (inputDates.size > 0) {
        const existingHolidays = await attendanceDB('org_holidays')
            .where({ org_id })
            .whereIn('holiday_date', Array.from(inputDates))
            .select(
                attendanceDB.raw("DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date"),
                'holiday_name'
            );

        const existingDateMap = new Map(existingHolidays.map(h => [h.holiday_date, h.holiday_name]));

        standardizedHolidays.forEach((h, index) => {
            if (!h) return;

            const isDuplicate = existingDateMap.has(h.date);

            if (isDuplicate) {
                response.duplicates.push({
                    row: index + 1,
                    date: h.date,
                    reason: `Holiday already exists on this date: ${existingDateMap.get(h.date)}`
                });
            } else if (!response.invalid_rows.some(r => r.row === index + 1)) {
                response.valid_count++;
            }
        });
    } else {
        response.valid_count = standardizedHolidays.filter(Boolean).length;
    }

    return response;
};

// Bulk create holidays from parsed JSON
export const bulkCreateFromJson = async (org_id, holidays) => {
    const results = {
        total_processed: 0,
        success_count: 0,
        failure_count: 0,
        errors: []
    };

    const prepareData = [];

    for (const row of holidays) {
        const name = row['Holiday Name'] || row['holiday_name'] || row['name'];
        const date = row['Date'] || row['holiday_date'] || row['date'];
        const type = row['Type'] || row['holiday_type'] || row['type'] || 'Public';
        const cleanDate = standardizeDate(date);

        if (!name || !cleanDate) {
            results.failure_count++;
            results.errors.push(`Row missing required fields or has invalid date: name="${name}", date="${date}"`);
            continue;
        }

        prepareData.push({
            org_id,
            holiday_name: name,
            holiday_date: cleanDate,
            holiday_type: type,
            applicable_json: JSON.stringify(['All Locations'])
        });
    }

    results.total_processed = holidays.length;

    if (prepareData.length > 0) {
        try {
            await attendanceDB.transaction(async (trx) => {
                await trx('org_holidays').insert(prepareData);
            });
            results.success_count = prepareData.length;
            // Invalidate Cache
            await cacheService.del(`mano-cache:holidays:org:${org_id}`);

            // Trigger push notifications
            notifyNewHolidays(org_id, prepareData).catch(console.error);
        } catch (error) {
            results.failure_count = prepareData.length;
            results.errors.push(error.message);
        }
    }

    return results;
};

// Bulk upload holidays from CSV/Excel file
export const bulkUploadFromFile = async (org_id, file) => {
    const results = {
        total_processed: 0,
        success_count: 0,
        failure_count: 0,
        errors: []
    };

    const workbook = new ExcelJS.Workbook();
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();

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

    const getVal = (row, ...keys) => {
        for (const key of keys) {
            const col = headerMap[key.toLowerCase()];
            if (!col) continue;
            const cell = row.getCell(col);
            return cell.value ? cell.value.toString().trim() : null;
        }
        return null;
    };

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        rowsData.push({ row, rowNumber });
    });

    results.total_processed = rowsData.length;

    const prepareData = [];
    const seenDates = new Set();

    const existingHolidays = await attendanceDB('org_holidays')
        .where({ org_id })
        .select(attendanceDB.raw("DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date"));
    const existingDates = new Set(existingHolidays.map(h => h.holiday_date));

    for (const { row, rowNumber } of rowsData) {
        const name = getVal(row, 'holiday name', 'holiday_name', 'name');
        const type = getVal(row, 'type', 'holiday_type') || 'Public';

        const dateCol = headerMap['date'] || headerMap['holiday_date'];
        const dateCell = dateCol ? row.getCell(dateCol) : null;
        const cleanDate = getCleanDate(dateCell);

        if (!name || !cleanDate) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Missing Holiday Name or Invalid Date`);
            continue;
        }

        if (seenDates.has(cleanDate) || existingDates.has(cleanDate)) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Holiday date ${cleanDate} already exists`);
            continue;
        }

        seenDates.add(cleanDate);
        prepareData.push({
            org_id,
            holiday_name: name,
            holiday_date: cleanDate,
            holiday_type: type,
            applicable_json: JSON.stringify(['All Locations'])
        });
    }

    if (prepareData.length > 0) {
        try {
            await attendanceDB.transaction(async (trx) => {
                await trx('org_holidays').insert(prepareData);
            });
            results.success_count = prepareData.length;
            // Invalidate Cache
            await cacheService.del(`mano-cache:holidays:org:${org_id}`);

            // Trigger push notifications
            notifyNewHolidays(org_id, prepareData).catch(console.error);
        } catch (error) {
            results.failure_count += prepareData.length;
            results.errors.push(`Batch insert failed: ${error.message}`);
        }
    }

    return results;
};


