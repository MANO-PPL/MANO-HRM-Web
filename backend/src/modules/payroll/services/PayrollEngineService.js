/**
 * Apply rounding method and precision
 */
export const applyRounding = (value, method = 'nearest', precision = 2) => {
  const factor = Math.pow(10, precision);
  const num = Number(value || 0);

  if (method === 'up') {
    return Math.ceil(num * factor) / factor;
  }
  if (method === 'down') {
    return Math.floor(num * factor) / factor;
  }
  // Default: 'nearest'
  return Math.round(num * factor) / factor;
};

/**
 * Calculate complete payroll ledger lines and summaries for one employee
 */
export const calculateEmployeePayroll = ({
  employee,
  packageDetails,
  attendanceMetrics = {},
  shift = {},
  settings = {},
  manualAdjustments = []
}) => {
  const roundingMethod = settings.rounding_method || 'nearest';
  const precision = settings.rounding_precision !== undefined ? settings.rounding_precision : 2;

  const round = (val) => applyRounding(val, roundingMethod, precision);

  const components = (packageDetails?.components || []).filter(c => c.is_active !== 0);
  const rules = packageDetails?.packages_rules || { lop: {}, ot: {} };

  const lines = [];
  const compAmountMap = new Map();

  // ----------------------------------------------------
  // 1. Contractual Fixed Components
  // ----------------------------------------------------
  const fixedComps = components.filter(c => c.calc_type !== 'percent_of_component');
  for (const comp of fixedComps) {
    const amount = round(Number(comp.value || 0));
    compAmountMap.set(comp.id, amount);
    compAmountMap.set(comp.name.trim().toLowerCase(), amount);

    const txType = comp.category === 'benefit' ? 'employer_contribution' : (comp.category || 'earning');

    lines.push({
      salary_package_component_id: comp.id,
      transaction_type: txType,
      name: comp.name.trim(),
      amount: amount,
      description: `Contractual ${comp.category}`
    });
  }

  // ----------------------------------------------------
  // 2. Contractual Percentage Components (Topological Resolution & Cycle Guard)
  // ----------------------------------------------------
  const pendingPercentComps = components.filter(c => c.calc_type === 'percent_of_component');
  const remaining = [...pendingPercentComps];
  let maxPasses = remaining.length + 1;

  while (remaining.length > 0 && maxPasses > 0) {
    maxPasses--;
    let progressMade = false;

    for (let i = remaining.length - 1; i >= 0; i--) {
      const comp = remaining[i];
      const baseId = comp.base_component_id;

      // Base is resolved if baseId or base_component_name is present in compAmountMap
      const isBaseResolved = compAmountMap.has(baseId) ||
        (comp.base_component_name && compAmountMap.has(comp.base_component_name.trim().toLowerCase()));

      if (isBaseResolved) {
        const baseAmount = compAmountMap.get(baseId) ??
          (comp.base_component_name ? compAmountMap.get(comp.base_component_name.trim().toLowerCase()) : 0) ?? 0;
        const rate = Number(comp.value || 0);
        const amount = round((Number(baseAmount) * rate) / 100);

        compAmountMap.set(comp.id, amount);
        compAmountMap.set(comp.name.trim().toLowerCase(), amount);

        const txType = comp.category === 'benefit' ? 'employer_contribution' : (comp.category || 'earning');

        lines.push({
          salary_package_component_id: comp.id,
          transaction_type: txType,
          name: comp.name.trim(),
          amount: amount,
          description: `${rate}% of base component`
        });

        remaining.splice(i, 1);
        progressMade = true;
      }
    }

    // Safeguard: if any items cannot be resolved due to circular reference or missing base
    if (!progressMade && remaining.length > 0) {
      for (const comp of remaining) {
        compAmountMap.set(comp.id, 0);
        compAmountMap.set(comp.name.trim().toLowerCase(), 0);

        const txType = comp.category === 'benefit' ? 'employer_contribution' : (comp.category || 'earning');

        lines.push({
          salary_package_component_id: comp.id,
          transaction_type: txType,
          name: comp.name.trim(),
          amount: 0,
          description: `${Number(comp.value || 0)}% of unresolvable/circular base component`
        });
      }
      break;
    }
  }

  // Contractual gross earnings sum
  const contractualGross = lines
    .filter(l => l.transaction_type === 'earning')
    .reduce((sum, l) => sum + l.amount, 0);

  // ----------------------------------------------------
  // 3. Loss of Pay (LOP) Calculation
  // ----------------------------------------------------
  const lopRules = rules.lop || {};
  const lopEnabled = lopRules.enabled !== false;
  let lopDays = 0;
  let lopAmount = 0;

  if (lopEnabled) {
    const absents = Number(attendanceMetrics.absent_days || 0);
    const halfDays = Number(attendanceMetrics.half_days || 0);

    lopDays = (lopRules.deduct_absents !== false ? absents : 0) +
      (lopRules.deduct_half_days !== false ? halfDays * 0.5 : 0);

    if (lopDays > 0) {
      // Basis: 'gross' vs 'basic'
      let basisAmount = contractualGross;
      if (lopRules.basis === 'basic') {
        // Look for 'basic' or 'basic salary' in computed components
        const basicCompAmount = compAmountMap.get('basic') || compAmountMap.get('basic salary');
        basisAmount = basicCompAmount !== undefined ? basicCompAmount : contractualGross;
      }

      // Divisor
      const calendarDays = Number(attendanceMetrics.calendar_days || 30);
      let divisor = calendarDays;
      if (lopRules.day_divisor === 'fixed_26') divisor = 26;
      else if (lopRules.day_divisor === 'fixed_30') divisor = 30;
      else if (lopRules.day_divisor === 'working_days') {
        divisor = Number(attendanceMetrics.working_days || (calendarDays - (attendanceMetrics.weekly_off_days || 4)));
      }
      if (divisor <= 0) divisor = 30;

      const dailyRate = basisAmount / divisor;
      lopAmount = round(dailyRate * lopDays);

      if (lopAmount > 0) {
        lines.push({
          salary_package_component_id: null,
          transaction_type: 'deduction',
          name: 'Loss of Pay (LOP)',
          amount: lopAmount,
          description: `Deduction for ${lopDays} absent day(s) at ₹${dailyRate.toFixed(2)}/day (Divisor: ${divisor})`
        });
      }
    }
  }

  // ----------------------------------------------------
  // 4. Overtime (OT) Calculation
  // ----------------------------------------------------
  // Check shift authorization (org_shifts.is_overtime_enabled)
  const shiftOtEnabled = shift?.is_overtime_enabled === 1 || shift?.is_overtime_enabled === true;
  const otRules = rules.ot || {};
  const otEnabled = otRules.enabled !== false && otRules.enabled !== 'false' && otRules.enabled !== 0;
  const otHours = Number(attendanceMetrics.overtime_hours || 0);
  let otAmount = 0;

  if (otEnabled && shiftOtEnabled && otHours > 0) {
    const hourlyRate = Number(otRules.hourly_rate || 0);
    const multiplier = Number(otRules.multiplier || 1.5);

    if (hourlyRate > 0) {
      otAmount = round(otHours * hourlyRate * multiplier);
    } else {
      // Fallback: hourly rate derived from gross / (30 * 8)
      const hourlyDerived = contractualGross / (30 * 8);
      otAmount = round(otHours * hourlyDerived * multiplier);
    }

    if (otAmount > 0) {
      lines.push({
        salary_package_component_id: null,
        transaction_type: 'earning',
        name: 'Overtime Pay',
        amount: otAmount,
        description: `Overtime for ${otHours} hr(s) at ₹${hourlyRate || (contractualGross / 240).toFixed(2)}/hr x ${multiplier}`
      });
    }
  }

  // ----------------------------------------------------
  // 5. Manual Adjustments (Bonuses, Reimbursements, Fines)
  // ----------------------------------------------------
  if (Array.isArray(manualAdjustments) && manualAdjustments.length > 0) {
    for (const adj of manualAdjustments) {
      const amt = round(Number(adj.amount || 0));
      if (amt !== 0) {
        lines.push({
          salary_package_component_id: null,
          transaction_type: adj.transaction_type || (amt >= 0 ? 'earning' : 'deduction'),
          name: adj.name ? adj.name.trim() : 'Manual Adjustment',
          amount: Math.abs(amt),
          description: adj.description ? adj.description.trim() : null
        });
      }
    }
  }

  // ----------------------------------------------------
  // 6. Totals Computation & Net Pay
  // ----------------------------------------------------
  const grossEarnings = lines
    .filter(l => l.transaction_type === 'earning')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalDeductions = lines
    .filter(l => l.transaction_type === 'deduction')
    .reduce((sum, l) => sum + l.amount, 0);

  const employerContributions = lines
    .filter(l => l.transaction_type === 'employer_contribution')
    .reduce((sum, l) => sum + l.amount, 0);

  const netSalary = round(Math.max(0, grossEarnings - totalDeductions));

  return {
    gross_salary: round(grossEarnings),
    total_deductions: round(totalDeductions),
    employer_contributions: round(employerContributions),
    net_salary: netSalary,
    contractual_gross: round(contractualGross),
    lop_days: lopDays,
    lop_deduction: lopAmount,
    overtime_hours: otHours,
    overtime_amount: otAmount,
    lines
  };
};

export default {
  applyRounding,
  calculateEmployeePayroll
};
