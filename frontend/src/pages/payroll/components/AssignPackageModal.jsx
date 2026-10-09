import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, X, Calendar, Check, RefreshCw, Briefcase, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const AssignPackageModal = ({
    isOpen,
    onClose,
    onAssigned,
    employees = [],
    packages = [],
    assignments = [],
    preselectedEmployee = null
}) => {
    const [employeeId, setEmployeeId] = useState('');
    const [packageId, setPackageId] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [effectiveTo, setEffectiveTo] = useState('');
    const [empSearch, setEmpSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const today = new Date().toISOString().split('T')[0];
            setEffectiveFrom(today);
            setEffectiveTo('');
            setEmpSearch('');

            if (preselectedEmployee) {
                const id = preselectedEmployee.employee_id || preselectedEmployee.user_id || preselectedEmployee.id;
                setEmployeeId(id ? String(id) : '');
            } else if (employees.length > 0) {
                const firstId = employees[0].employee_id || employees[0].user_id || employees[0].id;
                setEmployeeId(firstId ? String(firstId) : '');
            }

            if (packages.length > 0) {
                setPackageId(String(packages[0].id));
            }
        }
    }, [isOpen, employees, packages, preselectedEmployee]);

    // Find currently selected employee object
    const selectedEmployeeObj = useMemo(() => {
        if (!employeeId) return null;
        return employees.find(e => {
            const id = e.employee_id || e.user_id || e.id;
            return String(id) === String(employeeId);
        }) || (preselectedEmployee && String(preselectedEmployee.employee_id || preselectedEmployee.user_id || preselectedEmployee.id) === String(employeeId) ? preselectedEmployee : null);
    }, [employeeId, employees, preselectedEmployee]);

    // Check if this employee currently has an active package assignment
    const currentAssignment = useMemo(() => {
        if (!employeeId || !Array.isArray(assignments)) return null;
        return assignments.find(a => String(a.employee_id) === String(employeeId) && a.package_id);
    }, [employeeId, assignments]);

    // Find currently selected package object
    const selectedPackageObj = useMemo(() => {
        if (!packageId) return null;
        return packages.find(p => String(p.id) === String(packageId));
    }, [packageId, packages]);

    const filteredEmployees = useMemo(() => {
        if (!empSearch.trim()) return employees;
        const q = empSearch.toLowerCase().trim();
        return employees.filter(emp => {
            const name = (emp.name || emp.user_name || emp.employee_name || '').toLowerCase();
            const code = (emp.code || emp.user_code || emp.employee_code || '').toLowerCase();
            const dept = (emp.dept_name || emp.department || '').toLowerCase();
            const desg = (emp.desg_name || emp.designation || '').toLowerCase();
            return name.includes(q) || code.includes(q) || dept.includes(q) || desg.includes(q);
        });
    }, [employees, empSearch]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!employeeId) {
            toast.error('Please select an employee.');
            return;
        }
        if (!packageId) {
            toast.error('Please select a salary package.');
            return;
        }
        if (!effectiveFrom) {
            toast.error('Effective from date is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await payrollService.assignPackageToEmployee(employeeId, {
                package_id: Number(packageId),
                effective_from: effectiveFrom,
                effective_to: effectiveTo || null
            });
            toast.success(res.message || 'Salary package assigned successfully!');
            if (onAssigned) onAssigned(res.data, selectedEmployeeObj, selectedPackageObj, effectiveFrom);
            onClose();
        } catch (err) {
            console.error('Failed to assign package:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to assign package.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (str) => {
        if (!str) return 'EM';
        const parts = str.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return str.substring(0, 2).toUpperCase();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                <UserCheck size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    {currentAssignment ? 'Update Salary Package Assignment' : 'Assign Salary Package'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Link team member to their contractual salary package
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                        {/* 1. Employee Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Select Employee *
                            </label>
                            
                            {!preselectedEmployee && (
                                <input
                                    type="text"
                                    placeholder="Search by name, staff code, or department..."
                                    value={empSearch}
                                    onChange={(e) => setEmpSearch(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 mb-1"
                                />
                            )}

                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                required
                                disabled={Boolean(preselectedEmployee)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                <option value="" disabled>-- Choose Team Member --</option>
                                {filteredEmployees.map(emp => {
                                    const id = emp.employee_id || emp.user_id || emp.id;
                                    const name = emp.name || emp.user_name || emp.employee_name;
                                    const code = emp.code || emp.user_code || emp.employee_code;
                                    const dept = emp.dept_name || emp.department || '';
                                    return (
                                        <option key={id} value={id}>
                                            {name} {code ? `(${code})` : ''} {dept ? `— ${dept}` : ''}
                                        </option>
                                    );
                                })}
                            </select>

                            {/* Active Employee Card Preview */}
                            {selectedEmployeeObj && (
                                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                            {getInitials(selectedEmployeeObj.name || selectedEmployeeObj.user_name || selectedEmployeeObj.employee_name)}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                                {selectedEmployeeObj.name || selectedEmployeeObj.user_name || selectedEmployeeObj.employee_name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {selectedEmployeeObj.code || selectedEmployeeObj.user_code ? (
                                                    <span className="font-mono">{selectedEmployeeObj.code || selectedEmployeeObj.user_code}</span>
                                                ) : null}
                                                <span>·</span>
                                                <span>{selectedEmployeeObj.dept_name || selectedEmployeeObj.department || 'General'}</span>
                                                {selectedEmployeeObj.desg_name || selectedEmployeeObj.designation ? (
                                                    <>
                                                        <span>·</span>
                                                        <span>{selectedEmployeeObj.desg_name || selectedEmployeeObj.designation}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    {currentAssignment ? (
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Package</span>
                                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                                {currentAssignment.package_name}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] uppercase font-bold text-amber-500 block">Status</span>
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                Unassigned
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Informative notice if reassigning */}
                            {currentAssignment && (
                                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 text-[11px]">
                                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                    <span>
                                        This employee is currently linked to <strong>{currentAssignment.package_name}</strong>. Assigning a new package will set an effective transition date.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 2. Salary Package Picker */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Assign Salary Package *
                            </label>
                            <select
                                value={packageId}
                                onChange={(e) => setPackageId(e.target.value)}
                                required
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            >
                                <option value="" disabled>-- Select Salary Package --</option>
                                {packages.map(pkg => (
                                    <option key={pkg.id} value={pkg.id}>
                                        {pkg.name} ({pkg.components?.length || 0} Components)
                                    </option>
                                ))}
                            </select>

                            {selectedPackageObj && (
                                <div className="space-y-3">
                                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={14} className="text-purple-600 dark:text-purple-400" />
                                            <span className="font-bold text-purple-900 dark:text-purple-200">
                                                {selectedPackageObj.name}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                            {selectedPackageObj.components?.length || 0} Base Lines
                                        </span>
                                    </div>

                                    {/* 1. Contractual Base Lines */}
                                    {selectedPackageObj.components && selectedPackageObj.components.length > 0 ? (
                                        <div className="border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-white/[0.02]">
                                            <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-white/5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                <span>Contractual Salary Lines ({selectedPackageObj.components.length})</span>
                                                <span>Rule / Value</span>
                                            </div>
                                            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-44 overflow-y-auto">
                                                {selectedPackageObj.components.map((comp, idx) => (
                                                    <div key={comp.id || idx} className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${comp.category === 'earning' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{comp.name}</span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                                                                comp.category === 'earning'
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                            }`}>
                                                                {comp.category}
                                                            </span>
                                                        </div>
                                                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                                                            {comp.calc_type === 'fixed'
                                                                ? `₹${Number(comp.value || 0).toLocaleString('en-IN')}`
                                                                : `${comp.value}% of ${comp.base_component_name || 'Base'}`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                                            No salary component lines configured in this package yet.
                                        </div>
                                    )}

                                    {/* 2. Monthly Attendance Adjustments Policy */}
                                    <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                Attendance Adjustments Policy
                                            </span>
                                            <span className="text-[10px] text-slate-400 italic">
                                                Applied dynamically per pay run
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-slate-200/60 dark:border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Loss of Pay (LOP)</span>
                                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                        selectedPackageObj.packages_rules?.lop?.enabled !== false
                                                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-white/5'
                                                    }`}>
                                                        {selectedPackageObj.packages_rules?.lop?.enabled !== false ? 'Active (-)' : 'Disabled'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {selectedPackageObj.packages_rules?.lop?.enabled !== false
                                                        ? `Deducted on ${selectedPackageObj.packages_rules?.lop?.basis || 'gross'} / ${selectedPackageObj.packages_rules?.lop?.day_divisor || 'calendar days'}`
                                                        : 'No absent deductions'}
                                                </p>
                                            </div>

                                            <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-slate-200/60 dark:border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Overtime (OT)</span>
                                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                        selectedPackageObj.packages_rules?.ot?.enabled !== false
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-white/5'
                                                    }`}>
                                                        {selectedPackageObj.packages_rules?.ot?.enabled !== false
                                                            ? `${selectedPackageObj.packages_rules?.ot?.multiplier || 1.5}x (+)`
                                                            : 'Disabled'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {selectedPackageObj.packages_rules?.ot?.enabled !== false
                                                        ? 'Calculated if shift overtime authorized'
                                                        : 'No overtime compensation'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Effective Dates */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-emerald-500" />
                                    Effective From *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={effectiveFrom}
                                    onChange={(e) => setEffectiveFrom(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Effective To (Optional)
                                </label>
                                <input
                                    type="date"
                                    placeholder="Ongoing"
                                    value={effectiveTo}
                                    onChange={(e) => setEffectiveTo(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        {currentAssignment ? 'Update Assignment' : 'Assign Package'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AssignPackageModal;
