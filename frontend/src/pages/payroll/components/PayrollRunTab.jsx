import React from 'react';
import { Users, Lock, Unlock, Printer, SlidersHorizontal } from 'lucide-react';

const PayrollRunTab = ({
    loading,
    filteredEmployees,
    lockingId,
    handleLockToggle,
    setSelectedPayslipEmp,
    openConfig
}) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 border-3 border-indigo-150 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Loading real-time payroll data...</p>
            </div>
        );
    }

    if (filteredEmployees.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Users className="text-slate-200 dark:text-slate-700" size={48} />
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">No payroll entries found for this month.</p>
            </div>
        );
    }

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Employee</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-right">Basic Salary</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-right">LOP Deductions</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-right">Net Payout</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-center">Status</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-center">Lock</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-github-dark-border">
                {filteredEmployees.map((emp) => {
                    const netPay = emp.net_salary;
                    const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2);

                    return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-github-dark-subtle/5 transition-colors">
                            <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-medium text-xs shadow-inner shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <span className="block font-semibold text-slate-800 dark:text-github-dark-text text-sm leading-none">{emp.name}</span>
                                        <span className="block text-[11px] font-normal text-slate-400 mt-1">{emp.designation} · {emp.department}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-normal text-slate-700 dark:text-github-dark-text text-xs">₹{emp.basic.toLocaleString()}</td>
                            <td className="px-5 py-3.5 text-right font-normal text-rose-600 dark:text-rose-400 text-xs">
                                {emp.lop_deduction > 0 ? `-₹${emp.lop_deduction.toLocaleString()}` : '₹0'}
                                {emp.lates > 0 && <span className="block text-[9px] font-normal text-slate-400 mt-0.5">{emp.lates} LOP days</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                                ₹{netPay.toLocaleString()}
                                {emp.overtime_amount > 0 && <span className="block text-[9px] font-normal text-emerald-600 dark:text-emerald-400 mt-0.5">+₹{emp.overtime_amount.toLocaleString()} (OT)</span>}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                                {(() => {
                                    const s = emp.status;
                                    const isPaid = s === 'Paid';
                                    const isFinalized = s === 'Finalized';
                                    return (
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider ${
                                            isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                            : isFinalized ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                        }`}>
                                            {s || 'Draft'}
                                        </span>
                                    );
                                })()}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                                <button
                                    onClick={() => handleLockToggle(emp)}
                                    disabled={lockingId === emp.id || emp.status === 'Paid'}
                                    title={emp.status === 'Finalized' || emp.status === 'Paid' ? 'Unlock payroll' : 'Lock & finalize payroll'}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                        emp.status === 'Finalized' || emp.status === 'Paid'
                                            ? 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                                    }`}
                                >
                                    {lockingId === emp.id
                                        ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                        : emp.status === 'Finalized' || emp.status === 'Paid'
                                            ? <Lock size={12} />
                                            : <Unlock size={12} />}
                                </button>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                    <button
                                        onClick={() => setSelectedPayslipEmp(emp)}
                                        className="px-2.5 py-1 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-medium rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1"
                                    >
                                        <Printer size={10} />
                                        <span>Slip</span>
                                    </button>
                                    <button
                                        onClick={() => openConfig(emp)}
                                        title="Configure adjustments"
                                        className="w-6 h-6 flex items-center justify-center border border-slate-200 dark:border-github-dark-border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer"
                                    >
                                        <SlidersHorizontal size={11} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default PayrollRunTab;
