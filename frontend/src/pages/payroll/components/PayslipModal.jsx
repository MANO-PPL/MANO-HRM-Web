import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, Printer } from 'lucide-react';

const PayslipModal = ({
    selectedPayslipEmp,
    setSelectedPayslipEmp,
    selectedMonth,
    handlePrintPayslip
}) => {
    return (
        <AnimatePresence>
            {selectedPayslipEmp && (
                <>
                    {/* Backdrop overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedPayslipEmp(null)}
                        className="fixed inset-0 bg-black z-40"
                    />

                    {/* Drawer Container */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[580px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-50 flex flex-col"
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-github-dark-border/80 flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base flex items-center gap-2">
                                    <FileText className="text-indigo-500" size={18} />
                                    Payslip Details
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1">Period: {selectedMonth}</p>
                            </div>
                            <button
                                onClick={() => setSelectedPayslipEmp(null)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Drawer Body */}
                        {(() => {
                            const snap = selectedPayslipEmp.rawEntry;
                            const adjustments = snap?.adjustments_json
                                ? (typeof snap.adjustments_json === 'string' ? JSON.parse(snap.adjustments_json) : snap.adjustments_json)
                                : [];
                            const additionsSum = adjustments.filter(a => a.type === 'addition').reduce((sum, a) => sum + Number(a.amount), 0);
                            const deductionsSum = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + Number(a.amount), 0);
                            const netPay = selectedPayslipEmp.net_salary;

                            // Helper for parsing snapshots
                            const salarySnap = snap?.salary_snapshot_json
                                ? (typeof snap.salary_snapshot_json === 'string' ? JSON.parse(snap.salary_snapshot_json) : snap.salary_snapshot_json)
                                : null;

                            // Helper to find days in month
                            const getDaysInMonth = (monthStr) => {
                                const parts = monthStr.split(' ');
                                if (parts.length === 2) {
                                    const months = {
                                        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
                                        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
                                    };
                                    const m = months[parts[0]];
                                    const y = parseInt(parts[1], 10);
                                    if (m !== undefined && !isNaN(y)) {
                                        return new Date(y, m + 1, 0).getDate();
                                    }
                                }
                                return 30; // fallback
                            };
                            const calendarDays = getDaysInMonth(selectedMonth);
                            const dailyRate = selectedPayslipEmp.gross / calendarDays;

                            return (
                                <>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                                        {/* employeeMetadata Section */}
                                        <div className="bg-slate-50/50 dark:bg-[#161b22]/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/60 grid grid-cols-2 gap-y-4 gap-x-6">
                                            <div>
                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Employee</span>
                                                <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">{selectedPayslipEmp.name}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Department</span>
                                                <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">{selectedPayslipEmp.department}</span>
                                            </div>
                                            <div className="col-span-2 border-t border-slate-100 dark:border-github-dark-border/40 pt-4 grid grid-cols-2 gap-x-6">
                                                <div>
                                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Designation</span>
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-350 mt-1.5 block leading-none">{selectedPayslipEmp.designation}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Payment Method</span>
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-350 mt-1.5 block leading-none">Bank Direct Deposit</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* attendanceSummary */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                Attendance Summary
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { label: 'Present Days', val: snap?.present_days },
                                                    { label: 'Half Days', val: snap?.half_days },
                                                    { label: 'Absent Days', val: snap?.absent_days },
                                                    { label: 'Paid Leave', val: snap?.paid_leave_days },
                                                    { label: 'Holidays', val: snap?.holiday_days },
                                                    { label: 'Week Offs', val: snap?.weekly_off_days }
                                                ].map((item, idx) => (
                                                    <div key={idx} className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-3 rounded-xl text-center shadow-sm">
                                                        <span className="block text-[9px] font-bold text-slate-400 dark:text-[#8b949e] uppercase tracking-wider">{item.label}</span>
                                                        <span className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mt-1.5 block leading-none">
                                                            {Number(item.val || 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* lopDeductionDetails */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                LOP Deduction Details
                                            </h4>
                                            <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Gross Monthly Salary</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        ₹{Number(selectedPayslipEmp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Calendar Days</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        {calendarDays} days
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Daily Rate</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        ₹{Number(dailyRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className="border-t border-slate-100 dark:border-github-dark-border/40 my-2" />
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-850 dark:text-github-dark-text font-bold">Total LOP Days</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        {Number(snap?.lop_days || 0).toFixed(2)} days
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-rose-500 font-bold">LOP Deduction Amount</span>
                                                    <span className="font-extrabold text-rose-500">
                                                        ₹{Number(selectedPayslipEmp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* overtimeCalculations */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                Overtime Calculations
                                            </h4>
                                            <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border/40 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Overtime Enabled</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        {salarySnap?.overtime_enabled ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Overtime Rate</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        ₹{Number(salarySnap?.overtime_rate || 0).toLocaleString('en-IN')}/ hr
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-slate-500 dark:text-github-dark-muted">Total Overtime Hours</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-github-dark-text">
                                                        {Number(snap?.overtime_hours || 0).toFixed(2)} hrs
                                                    </span>
                                                </div>
                                                <div className="border-t border-slate-100 dark:border-github-dark-border/40 my-2" />
                                                <div className="flex justify-between items-center py-0.5">
                                                    <span className="text-emerald-500 font-bold">Overtime Allowance Amount</span>
                                                    <span className="font-extrabold text-emerald-500">
                                                        ₹{Number(selectedPayslipEmp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* netPayableSalarySummary */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                Net Payable Salary Summary
                                            </h4>
                                            <div className="bg-slate-50/30 dark:bg-[#161b22]/30 border border-slate-200 dark:border-[#30363d]/80 p-5 rounded-2xl shadow-sm space-y-3 text-xs font-semibold">
                                                <div className="space-y-2.5 text-slate-700 dark:text-[#c9d1d9]">
                                                    <div className="flex justify-between items-center">
                                                        <span>Gross Salary</span>
                                                        <span className="font-extrabold text-slate-850 dark:text-github-dark-text">
                                                            ₹{Number(selectedPayslipEmp.gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center text-rose-500">
                                                        <span>Deduction (LOP)</span>
                                                        <span className="font-extrabold">
                                                            -₹{Number(selectedPayslipEmp.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {selectedPayslipEmp.pf > 0 && (
                                                        <div className="flex justify-between items-center text-rose-500">
                                                            <span>Deduction (PF)</span>
                                                            <span className="font-extrabold">
                                                                -₹{Number(selectedPayslipEmp.pf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {deductionsSum > 0 && (
                                                        <div className="flex justify-between items-center text-rose-500">
                                                            <span>Other Deductions</span>
                                                            <span className="font-extrabold">
                                                                -₹{Number(deductionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                        <span>Allowance (OT)</span>
                                                        <span className="font-extrabold">
                                                            +₹{Number(selectedPayslipEmp.overtime_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {additionsSum > 0 && (
                                                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                            <span>Bonus / Additions</span>
                                                            <span className="font-extrabold">
                                                                +₹{Number(additionsSum || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="border-t border-slate-200 dark:border-github-dark-border/80 pt-3 flex justify-between items-center">
                                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-github-dark-text">Net Payable Salary</span>
                                                    <span className="text-base font-black text-indigo-650 dark:text-indigo-400">
                                                        ₹{Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Definitions & Guide Section */}
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-[#8b949e] uppercase tracking-widest">
                                                <HelpCircle size={12} className="text-indigo-500" />
                                                <span>Glossary & Abbreviations</span>
                                            </div>
                                            <div className="space-y-3 text-[11px] leading-relaxed">
                                                <div>
                                                    <span className="font-extrabold text-slate-850 dark:text-github-dark-text block">LOP (Loss of Pay)</span>
                                                    <span className="text-slate-500 dark:text-[#8b949e] block">
                                                        Deduction applied for unauthorized absences, excessive lates, or unpaid leave. Calculated as: Gross Salary / Calendar Days.
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="font-extrabold text-slate-855 dark:text-github-dark-text block">OT (Overtime)</span>
                                                    <span className="text-slate-550 dark:text-[#8b949e] block">
                                                        Compensation paid for additional hours worked outside regular shifts. Computed as: OT Hours × OT Rate.
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Drawer Footer */}
                                    <div className="p-6 border-t border-slate-100 dark:border-github-dark-border/80 flex gap-3 shrink-0">
                                        <button
                                            onClick={() => handlePrintPayslip(selectedPayslipEmp)}
                                            className="flex-1 py-3 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase transition-all shadow-sm flex items-center justify-center gap-1.5"
                                        >
                                            <Printer size={14} />
                                            <span>Print</span>
                                        </button>
                                        <button
                                            onClick={() => setSelectedPayslipEmp(null)}
                                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default PayslipModal;
