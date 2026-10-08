import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Users, User, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import payrollService from '../../../services/payrollService';

const TriggerRunModal = ({ isOpen, onClose, onRunCreated, employees = [] }) => {
    const [runType, setRunType] = useState('batch'); // 'batch' | 'individual'
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [batchName, setBatchName] = useState('');
    const [empSearch, setEmpSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const startDate = new Date(year, month, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
            const monthName = now.toLocaleString('default', { month: 'long' });

            setPeriodStart(startDate);
            setPeriodEnd(endDate);
            setBatchName(`${monthName} ${year} Payroll`);
            setRunType('batch');
            setSelectedEmployeeId(employees[0]?.id || employees[0]?.user_id || '');
            setEmpSearch('');
        }
    }, [isOpen, employees]);

    if (!isOpen) return null;

    const filteredEmployees = employees.filter(emp => {
        const name = emp.name || emp.user_name || '';
        const code = emp.code || emp.user_code || '';
        const search = empSearch.toLowerCase();
        return name.toLowerCase().includes(search) || code.toLowerCase().includes(search);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!periodStart || !periodEnd) {
            toast.error('Please specify both period start and end dates.');
            return;
        }

        if (runType === 'individual' && !selectedEmployeeId) {
            toast.error('Please select an employee for the individual off-cycle run.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                run_type: runType,
                period_start: periodStart,
                period_end: periodEnd,
                batch_name: batchName.trim() || undefined
            };

            if (runType === 'individual') {
                payload.employee_id = Number(selectedEmployeeId);
            }

            const res = await payrollService.triggerPayrollRun(payload);
            toast.success(res.message || 'Payroll run generated successfully!');
            if (onRunCreated) onRunCreated(res.data);
            onClose();
        } catch (err) {
            console.error('Failed to trigger payroll run:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to trigger payroll run.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                                <Play size={20} fill="currentColor" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    Generate Payroll Run
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Calculate salaries, LOP deductions & overtime
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
                    <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto max-h-[calc(85vh-120px)]">
                        {/* Run Type Switcher */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Run Type
                            </label>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setRunType('batch')}
                                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                        runType === 'batch'
                                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 bg-slate-50/40 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <Users size={16} />
                                    <div>
                                        <div className="text-xs font-bold">Company-Wide Batch</div>
                                        <div className="text-[10px] text-slate-400">All assigned employees</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRunType('individual')}
                                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                        runType === 'individual'
                                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 bg-slate-50/40 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <User size={16} />
                                    <div>
                                        <div className="text-xs font-bold">Individual Off-Cycle</div>
                                        <div className="text-[10px] text-slate-400">Single employee run</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Individual Employee Selector */}
                        {runType === 'individual' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Select Employee
                                </label>
                                <input
                                    type="text"
                                    placeholder="Search employee by name or ID..."
                                    value={empSearch}
                                    onChange={(e) => setEmpSearch(e.target.value)}
                                    className="w-full mb-2 px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-normal"
                                />
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="" disabled>-- Choose Employee --</option>
                                    {filteredEmployees.map(emp => {
                                        const id = emp.id || emp.user_id;
                                        const name = emp.name || emp.user_name;
                                        const code = emp.code || emp.user_code || `EMP-${id}`;
                                        return (
                                            <option key={id} value={id} className="dark:bg-slate-800">
                                                {name} ({code})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Batch / Run Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Batch / Run Title
                            </label>
                            <input
                                type="text"
                                value={batchName}
                                onChange={(e) => setBatchName(e.target.value)}
                                placeholder="e.g., October 2026 Regular Payroll"
                                required
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Period Range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-blue-500" />
                                    Period Start
                                </label>
                                <input
                                    type="date"
                                    value={periodStart}
                                    onChange={(e) => setPeriodStart(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-blue-500" />
                                    Period End
                                </label>
                                <input
                                    type="date"
                                    value={periodEnd}
                                    onChange={(e) => setPeriodEnd(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Note info box */}
                        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed">
                                The run will initially be created as a <strong>Draft</strong>. You can re-run and recalculate draft runs anytime if attendance or package assignments are updated before final approval.
                            </p>
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
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Calculating & Running...
                                    </>
                                ) : (
                                    <>
                                        <Play size={13} fill="currentColor" />
                                        Generate Run
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

export default TriggerRunModal;
