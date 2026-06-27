import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

/**
 * Service to manage employee salary revisions and compensation configurations.
 */
export class SalaryHistoryService {
    /**
     * Get active salary for an employee at a specific date.
     * Salary revisions are effective from the next billing cycle,
     * so we query the active record on the 1st day of the target month.
     * 
     * @param {number} employeeId 
     * @param {string|Date} date - The date to check (typically the 1st of the month)
     * @returns {Promise<Object>} Salary history record
     */
    static async getActiveSalary(employeeId, date) {
        const queryDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        
        const salaryRecord = await attendanceDB('payroll_salary_history as s')
            .leftJoin('payroll_package_groups as pg', 's.package_group_id', 'pg.package_group_id')
            .where('s.employee_id', employeeId)
            .where('s.effective_from', '<=', queryDate)
            .andWhere(function() {
                this.whereNull('s.effective_to')
                    .orWhere('s.effective_to', '>=', queryDate);
            })
            .select('s.*', 'pg.package_name')
            .orderBy('s.effective_from', 'desc')
            .first();
            
        return salaryRecord || null;
    }

    /**
     * Create a new salary revision for an employee.
     * Updates the previous active salary's effective_to to (effective_from - 1 day).
     * 
     * @param {Object} data 
     * @param {number} data.orgId 
     * @param {number} data.employeeId 
     * @param {number} data.grossMonthlySalary 
     * @param {boolean} data.overtimeEnabled 
     * @param {number} data.overtimeRate 
     * @param {string} data.effectiveFrom - YYYY-MM-DD
     * @param {number} data.createdBy 
     * @returns {Promise<Object>} The newly created salary history record
     */
    static async createSalaryRevision({
        orgId,
        employeeId,
        grossMonthlySalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom,
        createdBy
    }) {
        return await attendanceDB.transaction(async (trx) => {
            // Find any overlapping or current active salary history records
            const prevRecords = await trx('payroll_salary_history')
                .where('employee_id', employeeId)
                .whereNull('effective_to')
                .orderBy('effective_from', 'desc');

            const newEffectiveFromDate = new Date(effectiveFrom);
            
            for (const prev of prevRecords) {
                const prevEffectiveFrom = new Date(prev.effective_from);
                if (prevEffectiveFrom >= newEffectiveFromDate) {
                    throw new AppError('A salary revision already exists with an effective date equal to or after the new date.', 400);
                }
                
                // Calculate effective_to for the previous record (1 day before new effectiveFrom)
                const effectiveToDate = new Date(newEffectiveFromDate);
                effectiveToDate.setDate(effectiveToDate.getDate() - 1);
                const effectiveToStr = effectiveToDate.toISOString().split('T')[0];

                await trx('payroll_salary_history')
                    .where('salary_history_id', prev.salary_history_id)
                    .update({
                        effective_to: effectiveToStr,
                        updated_at: trx.fn.now()
                    });
            }

            // Insert new salary record
            const [newId] = await trx('payroll_salary_history').insert({
                org_id: orgId,
                employee_id: employeeId,
                gross_monthly_salary: grossMonthlySalary,
                overtime_enabled: overtimeEnabled ? 1 : 0,
                overtime_rate: overtimeRate || 0.00,
                effective_from: effectiveFrom,
                effective_to: null,
                created_by: createdBy
            });

            const newRecord = await trx('payroll_salary_history')
                .where('salary_history_id', newId)
                .first();

            return newRecord;
        });
    }

    /**
     * Get complete salary history for an employee, sorted chronologically.
     * 
     * @param {number} employeeId 
     * @returns {Promise<Array>} List of salary history records
     */
    static async getSalaryHistory(employeeId) {
        return await attendanceDB('payroll_salary_history as s')
            .leftJoin('payroll_package_groups as pg', 's.package_group_id', 'pg.package_group_id')
            .select('s.*', 'pg.package_name')
            .where('s.employee_id', employeeId)
            .orderBy('s.effective_from', 'desc');
    }
}
