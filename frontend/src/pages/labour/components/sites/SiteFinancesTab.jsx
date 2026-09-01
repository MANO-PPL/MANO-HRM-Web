import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import MonthlyDetailedMatrix from '../MonthlyDetailedMatrix';

const SiteFinancesTab = ({
    ledgerViewMode,
    selectedSite,
    financeMonth,
    handleOpenAdvance,
    handleOpenPayout,
    financeRoleFilter,
    financeSummary
}) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-150">
            {ledgerViewMode === 'matrix' ? (
                <MonthlyDetailedMatrix
                    siteId={selectedSite ? selectedSite.site_id : 'All'}
                    month={financeMonth}
                    siteName={selectedSite?.site_name}
                    onOpenAdvance={handleOpenAdvance}
                    onOpenPayout={handleOpenPayout}
                />
            ) : (
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                    <motion.div
                        key={`finances-${financeRoleFilter}-${financeMonth}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-x-auto"
                    >
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-github-dark-border/20 text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border text-[11px]">
                                    <th className="p-3 text-left">Worker Name</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-left">Wage & OT Rates</th>
                                    <th className="p-3 text-right">Total Earned</th>
                                    <th className="p-3 text-right">Advances Taken</th>
                                    <th className="p-3 text-right">Total Paid</th>
                                    <th className="p-3 text-right">Final Net Payable</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {financeSummary.filter(row => {
                                    const matchesSite = (row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id;
                                    const matchesRole = !financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase();
                                    return matchesSite && matchesRole;
                                }).length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="p-10 text-center text-slate-400 italic">No salary ledger details for workers assigned to this site.</td>
                                    </tr>
                                ) : (
                                    financeSummary
                                        .filter(row => {
                                            const matchesSite = (row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id;
                                            const matchesRole = !financeRoleFilter || row.role.toLowerCase() === financeRoleFilter.toLowerCase();
                                            return matchesSite && matchesRole;
                                        })
                                        .map(row => {
                                            const advanceAlert = row.advances_taken > row.accrued_credit;
                                            return (
                                                <tr key={row.labour_id} className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 align-middle">
                                                    <td className="p-3 font-bold text-slate-800 dark:text-github-dark-text whitespace-nowrap">{row.name}</td>
                                                    <td className="p-3">
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.role}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className="text-slate-800 dark:text-[#f0f6fc] font-bold text-[11px] whitespace-nowrap">
                                                                ₹{row.monthly_salary.toLocaleString()}/day
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-github-dark-muted font-semibold whitespace-nowrap">
                                                                ₹{Number(row.overtime_pay_per_hour || 0).toLocaleString()}/hr OT
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">₹{row.accrued_credit.toLocaleString()}</td>
                                                    <td className={`p-3 font-semibold text-right whitespace-nowrap ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span>₹{row.advances_taken.toLocaleString()}</span>
                                                            {advanceAlert && <AlertTriangle size={12} className="text-rose-500 animate-pulse" title="Advances exceed earned credit" />}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">₹{row.total_paid.toLocaleString()}</td>
                                                    <td className={`p-3 font-extrabold text-xs text-right whitespace-nowrap ${row.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        ₹{row.net_payable.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end items-center gap-2 flex-nowrap">
                                                            {row.net_payable <= 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                                    <CheckCircle size={10} /> Settled
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                                                    <Clock size={10} /> Pending
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => handleOpenAdvance(row)}
                                                                className="px-2.5 py-1 text-[10px] font-black bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded transition-all cursor-pointer whitespace-nowrap"
                                                            >
                                                                Advance
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenPayout(row)}
                                                                disabled={row.net_payable <= 0}
                                                                className={`px-2.5 py-1 text-[10px] font-black rounded border transition-all cursor-pointer whitespace-nowrap ${row.net_payable <= 0
                                                                    ? 'bg-slate-105 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                                                                    }`}
                                                            >
                                                                Release Salary
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SiteFinancesTab;
