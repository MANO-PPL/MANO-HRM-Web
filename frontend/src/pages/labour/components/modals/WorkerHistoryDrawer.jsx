import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle } from 'lucide-react';
import { getMonthNameAndYear } from '../../utils/labourUtils';

const WorkerHistoryDrawer = ({
    selectedHistoryLabour,
    setSelectedHistoryLabour,
    historyLoading,
    labourHistoryData,
    selectedHistoryLabourDetails,
    handleOpenGlobalAdvance,
    handleOpenGlobalPayout,
    historyTab,
    setHistoryTab,
    labourPayoutHistory
}) => {
    return createPortal(
        <AnimatePresence>
            {selectedHistoryLabour && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedHistoryLabour(null)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-lg h-full bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col justify-between z-10"
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-center bg-slate-50/30 dark:bg-[#010409]/40">
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">{selectedHistoryLabour.name}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted dark:text-github-dark-muted font-mono uppercase mt-0.5">Work History & Insights | {selectedHistoryLabour.role}</p>
                            </div>
                            <button onClick={() => setSelectedHistoryLabour(null)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={20} /></button>
                        </div>

                        <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs custom-scrollbar">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-2">
                                    <Clock className="animate-spin text-indigo-500" size={24} />
                                    <span className="text-[10px] text-slate-400">Loading history...</span>
                                </div>
                            ) : labourHistoryData.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 italic">No historical attendance logged for this worker.</div>
                            ) : (
                                <>
                                    {/* Global Ledger Card */}
                                    {selectedHistoryLabourDetails && (
                                        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl shadow-lg border border-indigo-950/40 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="block text-[9px] uppercase font-bold text-indigo-300 tracking-wider">All-Time Global Balance</span>
                                                    <span className="text-xl font-black">₹{selectedHistoryLabourDetails.global_net_payable.toLocaleString()}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleOpenGlobalAdvance}
                                                        className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded transition-all"
                                                    >
                                                        Log Global Advance
                                                    </button>
                                                    <button
                                                        onClick={handleOpenGlobalPayout}
                                                        disabled={selectedHistoryLabourDetails.global_net_payable <= 0}
                                                        className="px-2.5 py-1 text-[10px] font-bold bg-white text-indigo-950 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all"
                                                    >
                                                        Release Global Payment
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-900/60 text-[10px] font-mono text-indigo-200">
                                                <div>
                                                    <span className="block text-[8px] uppercase text-indigo-400">Total Earned</span>
                                                    ₹{selectedHistoryLabourDetails.global_earned.toLocaleString()}
                                                </div>
                                                <div>
                                                    <span className="block text-[8px] uppercase text-indigo-400">Total Paid</span>
                                                    ₹{selectedHistoryLabourDetails.global_paid.toLocaleString()}
                                                </div>
                                                <div>
                                                    <span className="block text-[8px] uppercase text-indigo-400">Total Advances</span>
                                                    ₹{selectedHistoryLabourDetails.global_advances.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-1 rounded-lg border border-[#d0d7de] dark:border-[#30363d] select-none">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryTab('sites')}
                                            className={`flex-1 text-center py-1.5 font-bold rounded-md transition-all cursor-pointer ${historyTab === 'sites'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-github-dark-text shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            Site Timeline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryTab('payouts')}
                                            className={`flex-1 text-center py-1.5 font-bold rounded-md transition-all cursor-pointer ${historyTab === 'payouts'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-github-dark-text shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            Salary & Payout History
                                        </button>
                                    </div>

                                    {historyTab === 'sites' ? (
                                        <div className="space-y-4">
                                            <h5 className="font-bold text-slate-700 dark:text-github-dark-text uppercase tracking-wider text-[10px]">Site Wise Timeline</h5>
                                            <div className="space-y-3">
                                                {labourHistoryData.map((siteLog) => {
                                                    const attendanceRate = siteLog.total_days > 0
                                                        ? Math.round(((siteLog.present_days + siteLog.paid_leave_days + (0.5 * siteLog.half_day_days)) / siteLog.total_days) * 100)
                                                        : 0;

                                                    return (
                                                        <div key={siteLog.site_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm hover:border-slate-350 dark:hover:border-github-dark-border-strong transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <h6 className="font-bold text-xs text-slate-800 dark:text-github-dark-text">{siteLog.site_name || 'Unassigned'}</h6>
                                                                    <span className="text-[9px] text-slate-400 font-mono">
                                                                        {new Date(siteLog.first_date).toLocaleDateString()} to {new Date(siteLog.last_date).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">{attendanceRate}% Active</span>
                                                            </div>

                                                            <div className="grid grid-cols-4 gap-1.5 text-center mt-3 pt-3 border-t border-slate-100 dark:border-github-dark-border/40 text-[9px] font-bold">
                                                                <div className="bg-emerald-50 dark:bg-emerald-950/10 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                                    <span className="block text-[8px] uppercase text-slate-400 font-medium">Present</span>
                                                                    {siteLog.present_days}
                                                                </div>
                                                                <div className="bg-amber-50 dark:bg-amber-500/10 p-1.5 rounded-lg text-amber-600 dark:text-amber-550 font-bold">
                                                                    <span className="block text-[8px] uppercase text-slate-400 font-medium">Half Day</span>
                                                                    {siteLog.half_day_days}
                                                                </div>
                                                                <div className="bg-indigo-50 dark:bg-indigo-950/10 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                                    <span className="block text-[8px] uppercase text-slate-400 font-medium">Paid L.</span>
                                                                    {siteLog.paid_leave_days}
                                                                </div>
                                                                <div className="bg-rose-50 dark:bg-rose-950/10 p-1.5 rounded-lg text-rose-600 dark:text-rose-455">
                                                                    <span className="block text-[8px] uppercase text-slate-400 font-medium">Absent</span>
                                                                    {siteLog.absent_days}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <h5 className="font-bold text-slate-700 dark:text-github-dark-text uppercase tracking-wider text-[10px]">Logged Payroll Payouts</h5>
                                            <div className="space-y-3">
                                                {labourPayoutHistory.length === 0 ? (
                                                    <div className="text-center py-10 text-slate-400 italic text-[11px]">No logged salary payouts found.</div>
                                                ) : (
                                                    labourPayoutHistory.map((payout) => (
                                                        <div key={payout.payout_id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm hover:border-slate-350 dark:hover:border-github-dark-border-strong transition-all space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{getMonthNameAndYear(payout.month + "-01")}</span>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${payout.status === 'Paid'
                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/30'
                                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30'
                                                                    }`}>
                                                                    {payout.status === 'Paid' ? <CheckCircle size={10} /> : <Clock size={10} />} {payout.status}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-100 dark:border-github-dark-border/40 text-[10px] font-mono">
                                                                <div>
                                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Earned</span>
                                                                    ₹{payout.accrued_credit}
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Deductions</span>
                                                                    -₹{payout.advances_taken}
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase font-bold">Paid Sum</span>
                                                                    ₹{payout.paid_amount}
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                                                <span>Site: {payout.site_name || 'Global / Unallocated'}</span>
                                                                <span>Method: {payout.notes || 'Unspecified'}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono text-right mt-1">
                                                                <span>{new Date(payout.payment_date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#010409]/40 flex justify-end shrink-0">
                            <button onClick={() => setSelectedHistoryLabour(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold">Close Insights</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default WorkerHistoryDrawer;
