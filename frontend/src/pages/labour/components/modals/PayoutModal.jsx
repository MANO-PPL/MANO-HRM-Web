import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';

const PayoutModal = ({
    showPayoutModal,
    setShowPayoutModal,
    payoutForm,
    setPayoutForm,
    handleSavePayout,
    sites
}) => {
    return createPortal(
        <AnimatePresence>
            {showPayoutModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowPayoutModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                    >
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                            <div className="flex items-center gap-1.5">
                                <DollarSign size={16} className="text-indigo-500" />
                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">{payoutForm.payout_id ? 'Update Monthly Payout' : 'Process Monthly Payout'}</h4>
                            </div>
                            <button onClick={() => setShowPayoutModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSavePayout} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-500 dark:text-github-dark-muted space-y-1">
                                <div>Processing salary payout for <strong>{payoutForm.name}</strong></div>
                                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Wage Type: {payoutForm.wage_type} | Month: {payoutForm.month}</div>
                            </div>
                                
                            {/* Target Site Dropdown */}
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Target Site</label>
                                <MinimalSelect
                                    value={payoutForm.site_id}
                                    onChange={(val) => setPayoutForm({ ...payoutForm, site_id: val })}
                                    options={[
                                        { value: 'All', label: 'All Sites (Auto-Distribute)' },
                                        ...sites.map(s => ({ value: s.site_id.toString(), label: s.site_name }))
                                    ]}
                                    triggerClassName="w-full justify-between"
                                    variant="input"
                                />
                            </div>

                            {/* Earnings Summary Grid */}
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-200 dark:border-github-dark-border text-[11px]">
                                <div className="space-y-1 col-span-2">
                                    <div className="text-slate-400 mb-1">Attendance Summary:</div>
                                    <div className="flex flex-wrap gap-1">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                            {payoutForm.present_days} Present
                                        </span>
                                        {payoutForm.half_days > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                {payoutForm.half_days} Half Day
                                            </span>
                                        )}
                                        {payoutForm.paid_leaves > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                                                {payoutForm.paid_leaves} Paid Leave
                                            </span>
                                        )}
                                        {payoutForm.absent_days > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                                                {payoutForm.absent_days} Absent
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500">Amount Earned:</div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.accrued_credit.toLocaleString()}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500">Advances Taken:</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-505">-₹{payoutForm.advances_taken.toLocaleString()}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500 dark:text-slate-400 font-bold">Net Payable:</div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">₹{payoutForm.net_payable.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Amount to Release - Editable Input */}
                            <div className="rounded-xl border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Amount to Release</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Remaining Balance: ₹{Math.max(0, payoutForm.net_payable - Number(payoutForm.paid_amount || 0)).toLocaleString()}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPayoutForm({ ...payoutForm, paid_amount: payoutForm.net_payable })}
                                        className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none"
                                    >
                                        Use Full Payout
                                    </button>
                                </div>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3.5 text-slate-400 dark:text-slate-500 font-bold text-sm">₹</span>
                                    <input
                                        type="number"
                                        value={payoutForm.paid_amount}
                                        onChange={(e) => setPayoutForm({ ...payoutForm, paid_amount: e.target.value })}
                                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-850 dark:text-[#f0f6fc] text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                                        required
                                        min="1"
                                        placeholder="Enter release amount"
                                    />
                                </div>
                            </div>

                            {/* Negative balance warning */}
                            {payoutForm.net_payable < 0 && (
                                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
                                    <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                                        Advance taken (₹{payoutForm.advances_taken.toLocaleString()}) exceeds earned credit (₹{payoutForm.accrued_credit.toLocaleString()}). Salary cannot be released until the balance is cleared.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Payout Status</label>
                                    <MinimalSelect
                                        value={payoutForm.status}
                                        onChange={(val) => setPayoutForm({ ...payoutForm, status: val })}
                                        options={[
                                            { value: 'Paid', label: 'Paid' },
                                            { value: 'Pending', label: 'Pending' }
                                        ]}
                                        triggerClassName="w-full justify-between"
                                        variant="input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Payment Date</label>
                                <input
                                    type="date"
                                    value={payoutForm.payment_date}
                                    onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] rounded-lg focus:outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Notes / Payment Details</label>
                                <input
                                    type="text"
                                    value={payoutForm.notes}
                                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    placeholder="e.g. Paid via Bank Transfer, Ref# 9812739"
                                />
                            </div>

                            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                <button
                                    type="button"
                                    onClick={() => setShowPayoutModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={payoutForm.net_payable < 0}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-all"
                                >
                                    {payoutForm.payout_id ? 'Update Payout' : 'Release Payment'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default PayoutModal;
