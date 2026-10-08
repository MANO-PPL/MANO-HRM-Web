import { attendanceDB } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import PayrollSettingsService from './PayrollSettingsService.js';

/**
 * Normalize and validate packages_rules JSON
 */
export const normalizePackageRules = (rules = {}) => {
  const lop = rules.lop || {};
  const ot = rules.ot || {};

  return {
    lop: {
      enabled: lop.enabled !== undefined ? (lop.enabled !== false && lop.enabled !== 'false' && lop.enabled !== 0) : true,
      basis: ['gross', 'basic'].includes(lop.basis) ? lop.basis : 'gross',
      day_divisor: ['calendar_days', 'fixed_26', 'fixed_30', 'working_days'].includes(lop.day_divisor || lop.day_basis)
        ? (lop.day_divisor || lop.day_basis)
        : 'calendar_days',
      deduct_absents: lop.deduct_absents !== undefined ? (lop.deduct_absents !== false && lop.deduct_absents !== 'false' && lop.deduct_absents !== 0) : true,
      deduct_half_days: lop.deduct_half_days !== undefined ? (lop.deduct_half_days !== false && lop.deduct_half_days !== 'false' && lop.deduct_half_days !== 0) : true
    },
    ot: {
      enabled: ot.enabled !== undefined ? (ot.enabled !== false && ot.enabled !== 'false' && ot.enabled !== 0) : true,
      hourly_rate: Number(ot.hourly_rate || 0),
      multiplier: Number(ot.multiplier || 1.5)
    }
  };
};

/**
 * Validates an in-memory list of components to prevent:
 * 1. Duplicate component names
 * 2. Direct self-references (e.g. comp.name === comp.base_component_name)
 * 3. Circular dependency cycles (e.g. A -> B -> A)
 */
export const validateComponentGraph = (components = []) => {
  if (!Array.isArray(components) || components.length === 0) return;

  const seenNames = new Set();
  const allNames = new Set();
  const idOrTempMap = new Map(); // identifier -> name

  for (const comp of components) {
    const name = (comp.name || '').trim();
    if (!name) throw new AppError('Component name is required.', 400);
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) {
      throw new AppError(`Duplicate component name "${name}" in package components.`, 400);
    }
    seenNames.add(lower);
    allNames.add(lower);
    if (comp.tempId) idOrTempMap.set(String(comp.tempId), lower);
    if (comp.id) idOrTempMap.set(String(comp.id), lower);
  }

  // Build dependency adjacency map: dependentName -> baseName
  const adjacency = new Map();

  for (const comp of components) {
    const compName = comp.name.trim().toLowerCase();
    const calcType = comp.calc_type === 'percent_of_component' ? 'percent_of_component' : 'fixed';

    if (calcType === 'percent_of_component') {
      let baseName = (comp.base_component_name || '').trim().toLowerCase();

      if (!baseName && comp.base_temp_id && idOrTempMap.has(String(comp.base_temp_id))) {
        baseName = idOrTempMap.get(String(comp.base_temp_id));
      } else if (!baseName && comp.base_component_id && idOrTempMap.has(String(comp.base_component_id))) {
        baseName = idOrTempMap.get(String(comp.base_component_id));
      }

      // 1. Direct self-reference check
      if (baseName && baseName === compName) {
        throw new AppError(`Component "${comp.name.trim()}" cannot reference itself as its base component.`, 400);
      }
      if (comp.tempId && comp.base_temp_id && String(comp.tempId) === String(comp.base_temp_id)) {
        throw new AppError(`Component "${comp.name.trim()}" cannot reference itself as its base component.`, 400);
      }

      if (baseName) {
        if (!allNames.has(baseName)) {
          throw new AppError(
            `Base component "${comp.base_component_name || baseName}" for "${comp.name.trim()}" does not exist in this package.`,
            400
          );
        }
        adjacency.set(compName, baseName);
      }
    }
  }

  // 2. Transitive cycle detection using DFS
  for (const [startNode] of adjacency) {
    const visited = new Set([startNode]);
    let current = startNode;
    const path = [startNode];

    while (adjacency.has(current)) {
      const next = adjacency.get(current);
      path.push(next);

      if (visited.has(next)) {
        throw new AppError(
          `Circular dependency detected in package components: ${path.join(' -> ')}. Components cannot reference each other circularly.`,
          400
        );
      }
      visited.add(next);
      current = next;
    }
  }
};

/**
 * Validates that setting base_component_id does not introduce direct self-references
 * or transitive circular dependencies in the salary package.
 *
 * @param {number} packageId
 * @param {number|null} targetComponentId - ID of the component being added or updated
 * @param {number} proposedBaseId - Proposed base component ID
 * @param {object} [trx] - Database/transaction instance
 */
export const validateNoCircularReference = async (packageId, targetComponentId, proposedBaseId, trx = attendanceDB) => {
  if (!proposedBaseId) return;

  // 1. Direct self-reference check
  if (targetComponentId && Number(targetComponentId) === Number(proposedBaseId)) {
    throw new AppError('A salary component cannot reference itself as its base component.', 400);
  }

  // 2. Fetch all components in this package to verify existence & inspect dependency graph
  const components = await trx('payroll_salary_package_components')
    .where({ package_id: packageId })
    .select('id', 'name', 'calc_type', 'base_component_id');

  const compMap = new Map();
  for (const c of components) {
    compMap.set(Number(c.id), c);
  }

  const proposedBase = compMap.get(Number(proposedBaseId));
  if (!proposedBase) {
    throw new AppError('Base component not found in this salary package.', 400);
  }

  // If adding a brand new component (targetComponentId is null), no other component can reference it yet
  if (!targetComponentId) return;

  const targetComp = compMap.get(Number(targetComponentId));
  const targetName = targetComp ? targetComp.name : `Component #${targetComponentId}`;

  // 3. Trace proposedBase's dependency chain upwards.
  // If we reach targetComponentId, then proposedBase already depends on targetComponent -> Cycle!
  const visited = new Set([Number(targetComponentId)]);
  let current = proposedBase;
  const path = [targetName, proposedBase.name];

  while (current && current.calc_type === 'percent_of_component' && current.base_component_id) {
    const nextId = Number(current.base_component_id);

    if (visited.has(nextId)) {
      const cycleTarget = compMap.get(nextId)?.name || `Component #${nextId}`;
      path.push(cycleTarget);
      throw new AppError(
        `Circular dependency detected: ${path.join(' -> ')}. A salary component cannot depend on itself directly or indirectly.`,
        400
      );
    }

    visited.add(nextId);
    current = compMap.get(nextId);
    if (current) {
      path.push(current.name);
    }
  }
};

/**
 * Create a new salary package along with optional initial components
 */
export const createPackage = async (orgId, { name, description, packages_rules, components = [] }) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);
  if (!name || !name.trim()) throw new AppError('Package name is required.', 400);

  // Enforce that organization payroll settings (currency, frequency, rounding) must be configured first
  const isConfigured = await PayrollSettingsService.isConfigured(orgId);
  if (!isConfigured) {
    throw new AppError(
      'Please configure your organization payroll settings (currency, pay frequency, and rounding) before creating salary packages.',
      400,
      'PAYROLL_SETTINGS_REQUIRED'
    );
  }

  const normalizedRules = normalizePackageRules(packages_rules);

  // Validate incoming component graph for self-references and cycles
  if (Array.isArray(components) && components.length > 0) {
    validateComponentGraph(components);
  }

  return await attendanceDB.transaction(async (trx) => {
    // Check for unique name within org
    const existing = await trx('payroll_salary_packages')
      .where({ org_id: orgId, name: name.trim() })
      .first();

    if (existing) {
      throw new AppError(`A package named "${name.trim()}" already exists in this organization.`, 400);
    }

    const [packageId] = await trx('payroll_salary_packages').insert({
      org_id: orgId,
      name: name.trim(),
      description: description ? description.trim() : null,
      packages_rules: JSON.stringify(normalizedRules),
      is_active: 1
    });

    // Insert components if provided
    if (Array.isArray(components) && components.length > 0) {
      const nameToIdMap = new Map();

      // 1st pass: insert fixed components first
      const fixedComponents = components.filter(c => c.calc_type !== 'percent_of_component');
      for (const comp of fixedComponents) {
        const [compId] = await trx('payroll_salary_package_components').insert({
          package_id: packageId,
          name: comp.name.trim(),
          category: comp.category || 'earning',
          calc_type: 'fixed',
          value: Number(comp.value || 0),
          base_component_id: null,
          sort_order: comp.sort_order || 0,
          is_taxable: comp.is_taxable !== undefined ? (comp.is_taxable ? 1 : 0) : 1,
          is_active: comp.is_active !== undefined ? (comp.is_active ? 1 : 0) : 1
        });
        nameToIdMap.set(comp.name.trim().toLowerCase(), compId);
        if (comp.tempId) nameToIdMap.set(comp.tempId, compId);
      }

      // 2nd pass: iteratively insert percentage components in topological order
      const remainingPercent = [...components.filter(c => c.calc_type === 'percent_of_component')];
      let maxPasses = remainingPercent.length + 1;

      while (remainingPercent.length > 0 && maxPasses > 0) {
        maxPasses--;
        let insertedInPass = false;

        for (let i = remainingPercent.length - 1; i >= 0; i--) {
          const comp = remainingPercent[i];
          let baseId = comp.base_component_id;
          if (!baseId && comp.base_component_name) {
            baseId = nameToIdMap.get(comp.base_component_name.trim().toLowerCase());
          } else if (!baseId && comp.base_temp_id) {
            baseId = nameToIdMap.get(comp.base_temp_id);
          }

          if (baseId) {
            const [compId] = await trx('payroll_salary_package_components').insert({
              package_id: packageId,
              name: comp.name.trim(),
              category: comp.category || 'earning',
              calc_type: 'percent_of_component',
              value: Number(comp.value || 0),
              base_component_id: baseId,
              sort_order: comp.sort_order || 1,
              is_taxable: comp.is_taxable !== undefined ? (comp.is_taxable ? 1 : 0) : 1,
              is_active: comp.is_active !== undefined ? (comp.is_active ? 1 : 0) : 1
            });

            nameToIdMap.set(comp.name.trim().toLowerCase(), compId);
            if (comp.tempId) nameToIdMap.set(comp.tempId, compId);

            remainingPercent.splice(i, 1);
            insertedInPass = true;
          }
        }

        if (!insertedInPass && remainingPercent.length > 0) {
          throw new AppError(
            `Percentage component(s) "${remainingPercent.map(c => c.name).join(', ')}" require a valid base component.`,
            400
          );
        }
      }
    }

    return await getPackageById(orgId, packageId, trx);
  });
};

/**
 * Get package by ID with components
 */
export const getPackageById = async (orgId, packageId, trx = attendanceDB) => {
  const pkg = await trx('payroll_salary_packages')
    .where({ id: packageId, org_id: orgId })
    .first();

  if (!pkg) throw new AppError('Salary package not found.', 404);

  if (typeof pkg.packages_rules === 'string') {
    try {
      pkg.packages_rules = JSON.parse(pkg.packages_rules);
    } catch {
      pkg.packages_rules = normalizePackageRules({});
    }
  }

  const components = await trx('payroll_salary_package_components')
    .where({ package_id: packageId })
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc');

  // Get count of assigned employees
  const [{ count: assignedCount }] = await trx('payroll_employee_salary_assignments')
    .where({ package_id: packageId })
    .whereNull('effective_to')
    .count('id as count');

  return {
    ...pkg,
    assigned_employees_count: Number(assignedCount || 0),
    components
  };
};

/**
 * List all packages for organization
 */
export const listPackages = async (orgId) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);

  const packages = await attendanceDB('payroll_salary_packages')
    .where({ org_id: orgId })
    .orderBy('created_at', 'desc');

  const result = [];
  for (const pkg of packages) {
    if (typeof pkg.packages_rules === 'string') {
      try {
        pkg.packages_rules = JSON.parse(pkg.packages_rules);
      } catch {
        pkg.packages_rules = normalizePackageRules({});
      }
    }

    const components = await attendanceDB('payroll_salary_package_components')
      .where({ package_id: pkg.id })
      .orderBy('sort_order', 'asc');

    const [{ count: assignedCount }] = await attendanceDB('payroll_employee_salary_assignments')
      .where({ package_id: pkg.id })
      .whereNull('effective_to')
      .count('id as count');

    result.push({
      ...pkg,
      assigned_employees_count: Number(assignedCount || 0),
      components
    });
  }

  return result;
};

/**
 * Update package header and rules
 */
export const updatePackage = async (orgId, packageId, { name, description, packages_rules, is_active, isActive }) => {
  const pkg = await getPackageById(orgId, packageId);

  const updatePayload = {
    updated_at: attendanceDB.fn.now()
  };

  if (name && name.trim()) {
    // Check collision
    const existing = await attendanceDB('payroll_salary_packages')
      .where({ org_id: orgId, name: name.trim() })
      .whereNot({ id: packageId })
      .first();

    if (existing) {
      throw new AppError(`A package named "${name.trim()}" already exists.`, 400);
    }
    updatePayload.name = name.trim();
  }

  if (description !== undefined) updatePayload.description = description ? description.trim() : null;
  const activeVal = is_active !== undefined ? is_active : isActive;
  if (activeVal !== undefined) updatePayload.is_active = activeVal ? 1 : 0;
  if (packages_rules !== undefined) {
    updatePayload.packages_rules = JSON.stringify(normalizePackageRules(packages_rules));
  }

  await attendanceDB('payroll_salary_packages')
    .where({ id: packageId, org_id: orgId })
    .update(updatePayload);

  return await getPackageById(orgId, packageId);
};

/**
 * Delete package (safeguarded against active assignments)
 */
export const deletePackage = async (orgId, packageId) => {
  const pkg = await getPackageById(orgId, packageId);

  // Check for currently active assignments (open-ended or ending in future)
  const activeAssignments = await attendanceDB('payroll_employee_salary_assignments')
    .where({ package_id: packageId })
    .where(function () {
      this.whereNull('effective_to').orWhere('effective_to', '>=', attendanceDB.fn.now());
    })
    .first();

  if (activeAssignments) {
    throw new AppError('Cannot delete this salary package because employees are actively assigned to it. Deactivate it instead.', 400);
  }

  try {
    await attendanceDB('payroll_salary_packages')
      .where({ id: packageId, org_id: orgId })
      .delete();
  } catch (err) {
    // If foreign key constraint prevents hard deletion due to historical assignments/lines
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      throw new AppError('Cannot permanently delete this package because historical payroll records reference it. Deactivate it instead.', 400);
    }
    throw err;
  }

  return { message: 'Package deleted successfully.', packageId };
};

/**
 * Add a component to an existing package
 */
export const addComponent = async (orgId, packageId, componentData) => {
  await getPackageById(orgId, packageId);

  const { name, category, calc_type, value, base_component_id, sort_order, is_taxable } = componentData;
  if (!name || !name.trim()) throw new AppError('Component name is required.', 400);

  const existing = await attendanceDB('payroll_salary_package_components')
    .where({ package_id: packageId, name: name.trim() })
    .first();

  if (existing) {
    throw new AppError(`A component named "${name.trim()}" already exists in this package.`, 400);
  }

  const type = calc_type === 'percent_of_component' ? 'percent_of_component' : 'fixed';
  if (type === 'percent_of_component') {
    if (!base_component_id) {
      throw new AppError('base_component_id is required for percentage-based components.', 400);
    }
    // Validate that base component exists in the package and cannot create self/circular reference
    await validateNoCircularReference(packageId, null, base_component_id);
  }

  const [id] = await attendanceDB('payroll_salary_package_components').insert({
    package_id: packageId,
    name: name.trim(),
    category: category || 'earning',
    calc_type: type,
    value: Number(value || 0),
    base_component_id: type === 'percent_of_component' ? base_component_id : null,
    sort_order: sort_order || 0,
    is_taxable: is_taxable !== undefined ? (is_taxable ? 1 : 0) : 1,
    is_active: 1
  });

  return await attendanceDB('payroll_salary_package_components').where({ id }).first();
};

/**
 * Update a component
 */
export const updateComponent = async (orgId, packageId, componentId, updateData) => {
  await getPackageById(orgId, packageId);

  const component = await attendanceDB('payroll_salary_package_components')
    .where({ id: componentId, package_id: packageId })
    .first();

  if (!component) throw new AppError('Salary package component not found.', 404);

  const updatePayload = {};
  if (updateData.name && updateData.name.trim()) {
    const trimmedName = updateData.name.trim();
    const nameConflict = await attendanceDB('payroll_salary_package_components')
      .where({ package_id: packageId, name: trimmedName })
      .whereNot({ id: componentId })
      .first();
    if (nameConflict) {
      throw new AppError(`A component named "${trimmedName}" already exists in this package.`, 400);
    }
    updatePayload.name = trimmedName;
  }

  if (updateData.category) updatePayload.category = updateData.category;
  if (updateData.value !== undefined) updatePayload.value = Number(updateData.value);
  if (updateData.sort_order !== undefined) updatePayload.sort_order = Number(updateData.sort_order);
  if (updateData.is_taxable !== undefined) updatePayload.is_taxable = updateData.is_taxable ? 1 : 0;
  if (updateData.is_active !== undefined) updatePayload.is_active = updateData.is_active ? 1 : 0;

  const targetCalcType = updateData.calc_type !== undefined ? updateData.calc_type : component.calc_type;

  if (targetCalcType === 'percent_of_component') {
    const nextBaseId = updateData.base_component_id !== undefined ? updateData.base_component_id : component.base_component_id;
    if (!nextBaseId) {
      throw new AppError('base_component_id is required for percentage-based components.', 400);
    }
    // Validate that setting this base creates neither a self-reference nor an indirect cycle
    await validateNoCircularReference(packageId, componentId, nextBaseId);
    updatePayload.calc_type = 'percent_of_component';
    updatePayload.base_component_id = nextBaseId;
  } else if (updateData.calc_type !== undefined) {
    updatePayload.calc_type = 'fixed';
    updatePayload.base_component_id = null;
  }

  await attendanceDB('payroll_salary_package_components')
    .where({ id: componentId, package_id: packageId })
    .update(updatePayload);

  return await attendanceDB('payroll_salary_package_components').where({ id: componentId }).first();
};

/**
 * Delete a component
 */
export const deleteComponent = async (orgId, packageId, componentId) => {
  await getPackageById(orgId, packageId);

  // Check if other components reference this one as base_component_id
  const referencing = await attendanceDB('payroll_salary_package_components')
    .where({ package_id: packageId, base_component_id: componentId })
    .first();

  if (referencing) {
    throw new AppError(`Cannot delete component because "${referencing.name}" calculates its value based on it.`, 400);
  }

  await attendanceDB('payroll_salary_package_components')
    .where({ id: componentId, package_id: packageId })
    .delete();

  return { message: 'Component deleted successfully.', componentId };
};

export const SalaryPackageService = {
  normalizePackageRules,
  validateComponentGraph,
  validateNoCircularReference,
  createPackage,
  getPackageById,
  listPackages,
  updatePackage,
  deletePackage,
  addComponent,
  updateComponent,
  deleteComponent
};

export default SalaryPackageService;
