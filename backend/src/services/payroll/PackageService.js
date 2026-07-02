import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { PayrollCalculationService } from './PayrollCalculationService.js';

export class PackageService {
    /**
     * Create a new package group and its initial rate revision
     */
    static async createPackageGroup({
        orgId,
        packageName,
        grossSalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom
    }) {
        if (!packageName) {
            throw new AppError('Package name is required.', 400);
        }
        if (grossSalary === undefined || Number(grossSalary) < 0) {
            throw new AppError('Gross salary must be a non-negative number.', 400);
        }
        if (!effectiveFrom) {
            throw new AppError('Effective From date is required.', 400);
        }

        return await attendanceDB.transaction(async (trx) => {
            // Check if active package with same name already exists in this org
            const existing = await trx('payroll_package_groups')
                .where({ org_id: orgId, package_name: packageName, is_deleted: 0 })
                .first();

            if (existing) {
                throw new AppError('A package with this name already exists.', 400);
            }

            // Insert group
            const [packageGroupId] = await trx('payroll_package_groups').insert({
                org_id: orgId,
                package_name: packageName,
                is_active: 1,
                is_deleted: 0
            });

            // Insert initial revision
            await trx('payroll_packages').insert({
                package_group_id: packageGroupId,
                gross_salary: Number(grossSalary),
                overtime_enabled: overtimeEnabled ? 1 : 0,
                overtime_rate: Number(overtimeRate || 0.00),
                effective_from: effectiveFrom,
                effective_to: null
            });

            const createdGroup = await trx('payroll_package_groups')
                .where('package_group_id', packageGroupId)
                .first();

            return createdGroup;
        });
    }

    /**
     * Get all active and non-deleted package groups for an organization
     * and resolve their active rates for today.
     */
    static async getPackageGroups(orgId) {
        const todayStr = new Date().toISOString().split('T')[0];

        const groups = await attendanceDB('payroll_package_groups')
            .where({ org_id: orgId, is_deleted: 0 })
            .orderBy('package_name', 'asc');

        const resolvedGroups = [];
        for (const group of groups) {
            // Find active rate revision
            const activeRate = await attendanceDB('payroll_packages')
                .where('package_group_id', group.package_group_id)
                .where('effective_from', '<=', todayStr)
                .andWhere(function() {
                    this.whereNull('effective_to')
                        .orWhere('effective_to', '>=', todayStr);
                })
                .orderBy('effective_from', 'desc')
                .first();

            // If no active rate for today, default to latest rate revision overall
            const fallbackRate = activeRate || await attendanceDB('payroll_packages')
                .where('package_group_id', group.package_group_id)
                .orderBy('effective_from', 'desc')
                .first();

            resolvedGroups.push({
                ...group,
                active_rate: fallbackRate || null
            });
        }

        return resolvedGroups;
    }

    /**
     * Get revision history for a package group
     */
    static async getPackageRevisions(packageGroupId) {
        return await attendanceDB('payroll_packages')
            .where('package_group_id', packageGroupId)
            .orderBy('effective_from', 'desc');
    }

    /**
     * Create a new rate revision for a package group
     */
    static async createPackageRevision({
        orgId,
        packageGroupId,
        grossSalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom
    }) {
        if (grossSalary === undefined || Number(grossSalary) < 0) {
            throw new AppError('Gross salary must be a non-negative number.', 400);
        }
        if (!effectiveFrom) {
            throw new AppError('Effective From date is required.', 400);
        }

        return await attendanceDB.transaction(async (trx) => {
            // Verify package group exists and belongs to org
            const group = await trx('payroll_package_groups')
                .where({ package_group_id: packageGroupId, org_id: orgId, is_deleted: 0 })
                .first();

            if (!group) {
                throw new AppError('Package group not found.', 404);
            }

            // Find overlapping revisions
            const prevRevisions = await trx('payroll_packages')
                .where('package_group_id', packageGroupId)
                .whereNull('effective_to')
                .orderBy('effective_from', 'desc');

            const newEffectiveFromDate = new Date(effectiveFrom);

            for (const prev of prevRevisions) {
                const prevEffectiveFrom = new Date(prev.effective_from);
                if (prevEffectiveFrom >= newEffectiveFromDate) {
                    throw new AppError('A rate revision already exists with an effective date equal to or after the new date.', 400);
                }

                // Close previous revision 1 day before new effective date
                const effectiveToDate = new Date(newEffectiveFromDate);
                effectiveToDate.setDate(effectiveToDate.getDate() - 1);
                const effectiveToStr = effectiveToDate.toISOString().split('T')[0];

                await trx('payroll_packages')
                    .where('package_id', prev.package_id)
                    .update({
                        effective_to: effectiveToStr,
                        updated_at: trx.fn.now()
                    });
            }

            // Insert new revision
            const [newId] = await trx('payroll_packages').insert({
                package_group_id: packageGroupId,
                gross_salary: Number(grossSalary),
                overtime_enabled: overtimeEnabled ? 1 : 0,
                overtime_rate: Number(overtimeRate || 0.00),
                effective_from: effectiveFrom,
                effective_to: null
            });

            // Trigger background recalculations for all employees currently assigned to this package
            // in the affected months.
            try {
                const parts = effectiveFrom.split('-');
                const year = Number(parts[0]);
                const monthNum = Number(parts[1]);

                // Find employees assigned to this package group
                const activeSalaryDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
                const assignedEmployees = await trx('payroll_salary_history')
                    .where({ package_group_id: packageGroupId, org_id: orgId })
                    .where('effective_from', '<=', activeSalaryDate)
                    .andWhere(function() {
                        this.whereNull('effective_to')
                            .orWhere('effective_to', '>=', activeSalaryDate);
                    })
                    .select('employee_id');

                for (const emp of assignedEmployees) {
                    PayrollCalculationService.updateDraftEntry(orgId, year, monthNum, emp.employee_id).catch(err => {
                        console.error(`Failed to update draft payroll for employee ${emp.employee_id} after package revision:`, err);
                    });
                }
            } catch (e) {
                console.error('Failed to trigger draft recalculations for package revision:', e);
            }

            return await trx('payroll_packages').where('package_id', newId).first();
        });
    }

    /**
     * Update package group name or status
     */
    static async updatePackageGroup(packageGroupId, orgId, { packageName, isActive, grossSalary, overtimeEnabled, overtimeRate, effectiveFrom }) {
        return await attendanceDB.transaction(async (trx) => {
            const updates = {};
            if (packageName !== undefined) updates.package_name = packageName;
            if (isActive !== undefined) updates.is_active = isActive ? 1 : 0;

            if (Object.keys(updates).length > 0) {
                const affected = await trx('payroll_package_groups')
                    .where({ package_group_id: packageGroupId, org_id: orgId, is_deleted: 0 })
                    .update(updates);

                if (affected === 0) {
                    throw new AppError('Package group not found or unauthorized.', 404);
                }
            }

            // Update the latest rate revision if rate fields are provided
            if (grossSalary !== undefined || overtimeEnabled !== undefined || overtimeRate !== undefined || effectiveFrom !== undefined) {
                const latestRevision = await trx('payroll_packages')
                    .where('package_group_id', packageGroupId)
                    .orderBy('effective_from', 'desc')
                    .first();

                if (latestRevision) {
                    const packageUpdates = {};
                    if (grossSalary !== undefined) packageUpdates.gross_salary = Number(grossSalary);
                    if (overtimeEnabled !== undefined) packageUpdates.overtime_enabled = overtimeEnabled ? 1 : 0;
                    if (overtimeRate !== undefined) packageUpdates.overtime_rate = Number(overtimeRate || 0.00);
                    if (effectiveFrom !== undefined) packageUpdates.effective_from = effectiveFrom;

                    if (Object.keys(packageUpdates).length > 0) {
                        await trx('payroll_packages')
                            .where('package_id', latestRevision.package_id)
                            .update(packageUpdates);
                    }
                }
            }

            return await trx('payroll_package_groups')
                .where('package_group_id', packageGroupId)
                .first();
        });
    }

    /**
     * Soft delete package group
     */
    static async deletePackageGroup(packageGroupId, orgId) {
        // Optional check: Can we delete if assigned to employees?
        // We soft delete it so historical records are NOT deleted from payroll_salary_history.
        // But we shouldn't allow deleting a package group that is currently active for any employee.
        // Let's check if there are any active assignments currently or in future.
        const todayStr = new Date().toISOString().split('T')[0];
        const activeAssignment = await attendanceDB('payroll_salary_history')
            .where('package_group_id', packageGroupId)
            .andWhere(function() {
                this.whereNull('effective_to')
                    .orWhere('effective_to', '>=', todayStr);
            })
            .first();

        if (activeAssignment) {
            throw new AppError('Cannot delete this package. It is currently assigned to one or more employees.', 400);
        }

        const affected = await attendanceDB('payroll_package_groups')
            .where({ package_group_id: packageGroupId, org_id: orgId, is_deleted: 0 })
            .update({ is_deleted: 1, updated_at: attendanceDB.fn.now() });

        if (affected === 0) {
            throw new AppError('Package group not found or unauthorized.', 404);
        }

        return { success: true };
    }

    /**
     * Get all users in the organization with their current package assignment details
     */
    static async getEmployeesWithPackages(orgId) {
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch all employees in the org
        const employees = await attendanceDB('users as u')
            .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
            .where('u.org_id', orgId)
            .where('u.is_deleted', 0)
            .select(
                'u.user_id',
                'u.user_name',
                'u.profile_image_url',
                'd.desg_name'
            )
            .orderBy('u.user_name', 'asc');

        const results = [];
        for (const emp of employees) {
            // Find current active salary history record
            const activeSalary = await attendanceDB('payroll_salary_history')
                .where('employee_id', emp.user_id)
                .where('effective_from', '<=', todayStr)
                .andWhere(function() {
                    this.whereNull('effective_to')
                        .orWhere('effective_to', '>=', todayStr);
                })
                .orderBy('effective_from', 'desc')
                .first();

            results.push({
                user_id: emp.user_id,
                user_name: emp.user_name,
                profile_image_url: emp.profile_image_url,
                desg_name: emp.desg_name,
                package_group_id: activeSalary ? activeSalary.package_group_id : null,
                salary_history_id: activeSalary ? activeSalary.salary_history_id : null
            });
        }

        return results;
    }

    /**
     * Assign package to employee
     */
    static async assignPackageToEmployee({
        orgId,
        employeeId,
        packageGroupId,
        effectiveFrom,
        createdBy
    }) {
        if (!effectiveFrom) {
            throw new AppError('Effective From date is required.', 400);
        }

        return await attendanceDB.transaction(async (trx) => {
            // 1. Verify package group exists and is active
            const pGroup = await trx('payroll_package_groups')
                .where({ package_group_id: packageGroupId, org_id: orgId, is_deleted: 0, is_active: 1 })
                .first();

            if (!pGroup) {
                throw new AppError('Package group not found or is inactive.', 404);
            }

            // 2. Fetch the active rates for the package revision at effectiveFrom date
            const rate = await trx('payroll_packages')
                .where('package_group_id', packageGroupId)
                .where('effective_from', '<=', effectiveFrom)
                .andWhere(function() {
                    this.whereNull('effective_to')
                        .orWhere('effective_to', '>=', effectiveFrom);
                })
                .orderBy('effective_from', 'desc')
                .first();

            // If no active rate revision on effectiveFrom date, get the latest one
            const resolvedRate = rate || await trx('payroll_packages')
                .where('package_group_id', packageGroupId)
                .orderBy('effective_from', 'desc')
                .first();

            if (!resolvedRate) {
                throw new AppError('This package has no rate configurations.', 400);
            }

            // 3. Find overlapping or current active salary history records for employee
            const prevRecords = await trx('payroll_salary_history')
                .where('employee_id', employeeId)
                .whereNull('effective_to')
                .orderBy('effective_from', 'desc');

            const newEffectiveFromDate = new Date(effectiveFrom);

            for (const prev of prevRecords) {
                const prevEffectiveFrom = new Date(prev.effective_from);
                if (prevEffectiveFrom >= newEffectiveFromDate) {
                    throw new AppError('A salary configuration already exists with an effective date equal to or after the new date.', 400);
                }

                // Calculate effective_to for previous record (1 day before)
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

            // 4. Insert new salary history record linking to package_group_id
            // Note: We copy the current rates as static values to act as default/backup,
            // but the dynamic salary resolution will fetch active package rates when package_group_id is set.
            const [newId] = await trx('payroll_salary_history').insert({
                org_id: orgId,
                employee_id: employeeId,
                package_group_id: packageGroupId,
                gross_monthly_salary: resolvedRate.gross_salary,
                overtime_enabled: resolvedRate.overtime_enabled,
                overtime_rate: resolvedRate.overtime_rate,
                effective_from: effectiveFrom,
                effective_to: null,
                created_by: createdBy
            });

            // 5. Trigger draft payroll recalculation in the background
            try {
                const parts = effectiveFrom.split('-');
                const year = Number(parts[0]);
                const monthNum = Number(parts[1]);
                PayrollCalculationService.updateDraftEntry(orgId, year, monthNum, employeeId).catch(err => {
                    console.error("Failed to update draft payroll after package assignment:", err);
                });
            } catch (e) {
                console.error("Failed to trigger background calculation for package assignment:", e);
            }

            return await trx('payroll_salary_history').where('salary_history_id', newId).first();
        });
    }

    /**
     * Unassign package (switch employee back to custom salary config)
     */
    static async unassignPackageFromEmployee({
        orgId,
        employeeId,
        grossMonthlySalary,
        overtimeEnabled,
        overtimeRate,
        effectiveFrom,
        createdBy
    }) {
        if (!effectiveFrom) {
            throw new AppError('Effective From date is required.', 400);
        }
        if (grossMonthlySalary === undefined || Number(grossMonthlySalary) < 0) {
            throw new AppError('Gross monthly salary must be a positive number.', 400);
        }

        return await attendanceDB.transaction(async (trx) => {
            // Find overlapping or current active salary history records for employee
            const prevRecords = await trx('payroll_salary_history')
                .where('employee_id', employeeId)
                .whereNull('effective_to')
                .orderBy('effective_from', 'desc');

            const newEffectiveFromDate = new Date(effectiveFrom);

            for (const prev of prevRecords) {
                const prevEffectiveFrom = new Date(prev.effective_from);
                if (prevEffectiveFrom >= newEffectiveFromDate) {
                    throw new AppError('A salary configuration already exists with an effective date equal to or after the new date.', 400);
                }

                // Close previous record (1 day before)
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

            // Insert new custom salary record (package_group_id is null)
            const [newId] = await trx('payroll_salary_history').insert({
                org_id: orgId,
                employee_id: employeeId,
                package_group_id: null,
                gross_monthly_salary: Number(grossMonthlySalary),
                overtime_enabled: overtimeEnabled ? 1 : 0,
                overtime_rate: Number(overtimeRate || 0.00),
                effective_from: effectiveFrom,
                effective_to: null,
                created_by: createdBy
            });

            // Trigger draft payroll recalculation in the background
            try {
                const parts = effectiveFrom.split('-');
                const year = Number(parts[0]);
                const monthNum = Number(parts[1]);
                PayrollCalculationService.updateDraftEntry(orgId, year, monthNum, employeeId).catch(err => {
                    console.error("Failed to update draft payroll after package unassignment:", err);
                });
            } catch (e) {
                console.error("Failed to trigger background calculation for package unassignment:", e);
            }

            return await trx('payroll_salary_history').where('salary_history_id', newId).first();
        });
    }
}
