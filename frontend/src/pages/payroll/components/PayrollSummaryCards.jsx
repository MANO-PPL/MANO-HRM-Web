import React from 'react';
import { DollarSign, CreditCard } from 'lucide-react';

const PayrollSummaryCards = ({ selectedMonth, totals }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">
                        Gross Payroll ({selectedMonth})
                    </span>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-github-dark-text mt-0.5">
                        ₹{totals.gross.toLocaleString()}
                    </h3>
                    <p className="text-[10px] font-normal text-slate-400 dark:text-github-dark-muted mt-0.5">
                        Basic + Allowances
                    </p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 rounded-xl">
                    <DollarSign size={20} />
                </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">
                        Net Disbursed
                    </span>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-github-dark-text mt-0.5">
                        ₹{totals.net.toLocaleString()}
                    </h3>
                    <p className="text-[10px] font-normal text-slate-400 dark:text-github-dark-muted mt-0.5">
                        After LOP Deductions
                    </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CreditCard size={20} />
                </div>
            </div>
        </div>
    );
};

export default PayrollSummaryCards;
