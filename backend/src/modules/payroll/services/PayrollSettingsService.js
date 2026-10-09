import { attendanceDB } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export const DEFAULT_PAYROLL_SETTINGS = {
  currency: 'INR',
  payroll_frequency: 'monthly',
  rounding_method: 'nearest',
  rounding_precision: 2
};

/**
 * Check whether organization has configured its payroll settings
 * (Existence of row in payroll_settings_v1 means it is configured)
 */
export const isConfigured = async (orgId) => {
  if (!orgId) return false;
  const settings = await attendanceDB('payroll_settings_v1')
    .where({ org_id: orgId })
    .first();
  return Boolean(settings);
};

/**
 * Get organization payroll settings.
 * If not yet configured, returns default template with is_configured: false.
 */
export const getSettings = async (orgId) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);

  const settings = await attendanceDB('payroll_settings_v1')
    .where({ org_id: orgId })
    .first();

  if (!settings) {
    return {
      ...DEFAULT_PAYROLL_SETTINGS,
      org_id: orgId,
      is_configured: false
    };
  }

  return {
    ...settings,
    is_configured: true
  };
};

/**
 * Get organization setup status (settings, package count, employee assignments count)
 */
export const getSetupStatus = async (orgId) => {
  const settings = await getSettings(orgId);

  const [{ count: packagesCount }] = await attendanceDB('payroll_salary_packages')
    .where({ org_id: orgId })
    .count('id as count');

  const [{ count: assignedCount }] = await attendanceDB('payroll_employee_salary_assignments as a')
    .join('core_users as u', 'a.employee_id', 'u.user_id')
    .where('u.org_id', orgId)
    .where('u.is_deleted', 0)
    .whereNull('a.effective_to')
    .count('a.id as count');

  let nextStep = 'ready_for_run';
  if (!settings.is_configured) {
    nextStep = 'configure_settings';
  } else if (Number(packagesCount) === 0) {
    nextStep = 'create_package';
  } else if (Number(assignedCount) === 0) {
    nextStep = 'assign_employees';
  }

  return {
    is_configured: settings.is_configured,
    is_settings_configured: settings.is_configured,
    settings,
    packages_count: Number(packagesCount || 0),
    assigned_employees_count: Number(assignedCount || 0),
    next_step: nextStep
  };
};

/**
 * Save / Configure organization payroll settings.
 * Inserts row if not present, or updates existing row.
 */
export const saveSettings = async (orgId, { currency, payroll_frequency, rounding_method, rounding_precision }) => {
  if (!orgId) throw new AppError('Organization ID is required.', 400);

  const validFrequencies = ['monthly', 'bi-weekly', 'weekly'];
  if (payroll_frequency && !validFrequencies.includes(payroll_frequency)) {
    throw new AppError(`Invalid payroll_frequency. Allowed: ${validFrequencies.join(', ')}`, 400);
  }

  let normRounding = rounding_method;
  if (normRounding && normRounding.startsWith('round_')) {
    normRounding = normRounding.replace('round_', '');
  }

  const validRounding = ['nearest', 'up', 'down'];
  if (normRounding && !validRounding.includes(normRounding)) {
    throw new AppError(`Invalid rounding_method. Allowed: ${validRounding.join(', ')}`, 400);
  }

  const existing = await attendanceDB('payroll_settings_v1')
    .where({ org_id: orgId })
    .first();

  const payload = {
    currency: (currency || DEFAULT_PAYROLL_SETTINGS.currency).trim().toUpperCase(),
    payroll_frequency: payroll_frequency || DEFAULT_PAYROLL_SETTINGS.payroll_frequency,
    rounding_method: normRounding || DEFAULT_PAYROLL_SETTINGS.rounding_method,
    rounding_precision: rounding_precision !== undefined ? parseInt(rounding_precision, 10) : DEFAULT_PAYROLL_SETTINGS.rounding_precision,
    updated_at: attendanceDB.fn.now()
  };

  if (existing) {
    await attendanceDB('payroll_settings_v1')
      .where({ org_id: orgId })
      .update(payload);
  } else {
    payload.org_id = orgId;
    await attendanceDB('payroll_settings_v1').insert(payload);
  }

  return await getSettings(orgId);
};

export default {
  DEFAULT_PAYROLL_SETTINGS,
  isConfigured,
  getSettings,
  getSetupStatus,
  saveSettings
};
