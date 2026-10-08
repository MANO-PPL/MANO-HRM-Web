import { attendanceDB } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import SalaryPackageService from './SalaryPackageService.js';

/**
 * Assign a package to an employee with effective dates
 */
export const assignPackage = async (orgId, { employee_id, package_id, effective_from }) => {
    if (!orgId) throw new AppError('Organization ID is required.', 400);
    if (!employee_id) throw new AppError('Employee ID is required.', 400);
    if (!package_id) throw new AppError('Package ID is required.', 400);
    if (!effective_from) throw new AppError('Effective From date is required (YYYY-MM-DD).', 400);

    // Validate employee exists in org
    const employee = await attendanceDB('core_users')
      .where({ user_id: employee_id, org_id: orgId, is_deleted: 0 })
      .first();

    if (!employee) {
      throw new AppError('Employee not found in this organization.', 404);
    }

    // Validate package exists in org and is active
    const pkg = await attendanceDB('payroll_salary_packages')
      .where({ id: package_id, org_id: orgId })
      .first();

    if (!pkg) {
      throw new AppError('Salary package not found in this organization.', 404);
    }

    return await attendanceDB.transaction(async (trx) => {
      // Find current open assignment
      const currentActive = await trx('payroll_employee_salary_assignments')
        .where({ employee_id: employee_id })
        .whereNull('effective_to')
        .first();

      if (currentActive) {
        // If effective_from is on or before current assignment's effective_from, replace it
        if (new Date(effective_from) <= new Date(currentActive.effective_from)) {
          await trx('payroll_employee_salary_assignments')
            .where({ id: currentActive.id })
            .delete();
        } else {
          // Close current assignment on day before new effective_from
          const prevDay = new Date(effective_from);
          prevDay.setDate(prevDay.getDate() - 1);
          const prevDayStr = prevDay.toISOString().split('T')[0];

          await trx('payroll_employee_salary_assignments')
            .where({ id: currentActive.id })
            .update({ effective_to: prevDayStr });
        }
      }

      // Insert new assignment (pass org_id only if needed by existing DB column constraint)
      const insertData = {
        employee_id: employee_id,
        package_id: package_id,
        effective_from: effective_from,
        effective_to: null
      };
      if (orgId || employee.org_id) {
        insertData.org_id = orgId || employee.org_id;
      }

      const [assignmentId] = await trx('payroll_employee_salary_assignments').insert(insertData);

      return await trx('payroll_employee_salary_assignments')
        .where({ id: assignmentId })
        .first();
    });
  }

  /**
   * Get active salary package and contractual components for an employee as of a date
   */
export const getEmployeeActivePackage = async (orgId, employeeId, asOfDate = new Date()) => {
    const dateStr = typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().split('T')[0];

    // Ensure employee belongs to this organization
    const employee = await attendanceDB('core_users')
      .where({ user_id: employeeId, org_id: orgId, is_deleted: 0 })
      .first();

    if (!employee) return null;

    const assignment = await attendanceDB('payroll_employee_salary_assignments')
      .where({ employee_id: employeeId })
      .where('effective_from', '<=', dateStr)
      .andWhere(function () {
        this.whereNull('effective_to').orWhere('effective_to', '>=', dateStr);
      })
      .orderBy('effective_from', 'desc')
      .first();

    if (!assignment) return null;

    const pkgDetails = await SalaryPackageService.getPackageById(orgId, assignment.package_id);
    return {
      assignment_id: assignment.id,
      effective_from: assignment.effective_from,
      effective_to: assignment.effective_to,
      ...pkgDetails
    };
  }

  /**
   * List all employees with their currently assigned salary package
   */
export const listEmployeeAssignments = async (orgId, { department_id, search } = {}) => {
    if (!orgId) throw new AppError('Organization ID is required.', 400);

    let query = attendanceDB('core_users as u')
      .leftJoin('org_departments as d', 'u.dept_id', 'd.dept_id')
      .leftJoin('org_designations as desg', 'u.desg_id', 'desg.desg_id')
      .leftJoin('payroll_employee_salary_assignments as a', function () {
        this.on('u.user_id', '=', 'a.employee_id')
          .andOnNull('a.effective_to');
      })
      .leftJoin('payroll_salary_packages as p', 'a.package_id', 'p.id')
      .where('u.org_id', orgId)
      .where('u.is_deleted', 0)
      .select(
        'u.user_id as employee_id',
        'u.user_name as name',
        'u.user_code',
        'u.email',
        'd.dept_name as department',
        'desg.desg_name as designation',
        'a.id as assignment_id',
        'a.effective_from as package_effective_from',
        'p.id as package_id',
        'p.name as package_name',
        'p.packages_rules',
        'p.is_active as package_is_active'
      )
      .orderBy('u.user_name', 'asc');

    if (department_id) query = query.where('u.dept_id', department_id);
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('u.user_name', 'like', s)
          .orWhere('u.user_code', 'like', s)
          .orWhere('u.email', 'like', s);
      });
    }

    const rows = await query;
    return rows.map(r => {
      let rules = null;
      if (r.packages_rules) {
        try {
          rules = typeof r.packages_rules === 'string' ? JSON.parse(r.packages_rules) : r.packages_rules;
        } catch {
          rules = null;
        }
      }
      return {
        ...r,
        employee_name: r.name,
        employee_code: r.user_code || null,
        effective_from: r.package_effective_from ? (r.package_effective_from instanceof Date ? r.package_effective_from.toISOString().split('T')[0] : String(r.package_effective_from).split('T')[0]) : null,
        packages_rules: rules
      };
    });
  }

  /**
   * Unassign package from employee (closes active assignment)
   */
export const unassignPackage = async (orgId, employeeId, effectiveTo = new Date()) => {
    const toDate = typeof effectiveTo === 'string' ? effectiveTo : effectiveTo.toISOString().split('T')[0];

    // Validate employee exists in org
    const employee = await attendanceDB('core_users')
      .where({ user_id: employeeId, org_id: orgId, is_deleted: 0 })
      .first();

    if (!employee) {
      throw new AppError('Employee not found in this organization.', 404);
    }

    const current = await attendanceDB('payroll_employee_salary_assignments')
      .where({ employee_id: employeeId })
      .whereNull('effective_to')
      .first();

    if (!current) {
      throw new AppError('No active package assignment found for this employee.', 404);
    }

    await attendanceDB('payroll_employee_salary_assignments')
      .where({ id: current.id })
      .update({ effective_to: toDate });

    return { message: 'Package unassigned successfully.', employee_id: employeeId };
};

export const SalaryAssignmentService = {
  assignPackage,
  getEmployeeActivePackage,
  listEmployeeAssignments,
  unassignPackage
};

export default SalaryAssignmentService;
