import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import MinimalSelect from '../../../../components/MinimalSelect';
import DatePicker from '../../../../components/DatePicker';
import { formatAdvanceDate, getMonthNameAndYear } from '../../utils/labourUtils';

const AdvanceModal = ({
    showAdvanceModal,
    setShowAdvanceModal,
    advanceForm,
    setAdvanceForm,
    handleSaveAdvance,
    handleDeleteAdvance,
    sites,
    financeMonth,
    advanceHistory,
    advancePayouts,
    advanceHistoryLoading,
    advanceHistoryView,
    setAdvanceHistoryView,
    loadAdvanceHistory
}) => {
    return createPortal(
        <AnimatePresence>
            {showAdvanceModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAdvanceModal(false)}
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
                                <DollarSign size={16} className="text-amber-500" />
                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Log Salary Advance</h4>
                            </div>
                            <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveAdvance} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg text-slate-600 dark:text-slate-350">
                                Logging salary advance for <strong>{advanceForm.name}</strong>. This amount will be automatically deducted from their next payroll payroll payout credit.
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Target Site</label>
                                <MinimalSelect
                                    value={advanceForm.site_id}
                                    onChange={(val) => setAdvanceForm({ ...advanceForm, site_id: val })}
                                    options={[
                                        { value: 'All', label: 'All Sites (Global / Unallocated)' },
                                        ...sites.map(s => ({ value: s.site_id.toString(), label: s.site_name }))
                                    ]}
                                    triggerClassName="w-full justify-between"
                                    variant="input"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Logging Date</label>
                                {(() => {
                                    const targetM = financeMonth || new Date().toISOString().slice(0, 7);
                                    const [y, m] = targetM.split('-').map(Number);
                                    const lastDay = new Date(y, m, 0).getDate();
                                    const minD = `${targetM}-01`;
                                    const maxD = `${targetM}-${String(lastDay).padStart(2, '0')}`;
                                    return (
                                        <DatePicker
                                            value={advanceForm.date}
                                            onChange={(val) => setAdvanceForm({ ...advanceForm, date: val })}
                                            minDate={minD}
                                            maxDate={maxD}
                                            compact={true}
                                        />
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Advance Amount (INR)</label>
                                {advanceForm.amount && Number(advanceForm.amount) > Number(advanceForm.net_payable || 0) && (
                                    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 p-3 rounded-lg text-rose-700 dark:text-rose-400 font-bold text-[11px] animate-in fade-in duration-200 flex items-start gap-1.5 shadow-sm mb-2">
                                        <AlertTriangle size={14} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                                        <span>
                                            Warning: Advance amount (₹{Number(advanceForm.amount).toLocaleString()}) exceeds the worker's net payable balance (₹{Number(advanceForm.net_payable || 0).toLocaleString()}).
                                        </span>
                                    </div>
                                )}
                                <input
                                    type="number"
                                    value={advanceForm.amount}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    required
                                    min="1"
                                    placeholder="e.g., 2000"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1">Notes / Description</label>
                                <input
                                    type="text"
                                    value={advanceForm.notes}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:border-indigo-500"
                                    placeholder="e.g., Festival Advance, Medical emergency"
                                />
                            </div>

                            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-[#30363d]">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanceModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg font-bold transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm transition-all cursor-pointer"
                                >
                                    Record Payment
                                </button>
                            </div>

                            {/* ADVANCE HISTORY & SETTLEMENT CYCLE TIMELINE */}
                            {(() => {
                                const latestPayout = advancePayouts.length > 0 ? advancePayouts[0] : null;
                                const latestPayoutDate = latestPayout?.payment_date
                                    ? (typeof latestPayout.payment_date === 'string' ? latestPayout.payment_date.split('T')[0] : new Date(latestPayout.payment_date).toISOString().split('T')[0])
                                    : null;

                                const isUnsettled = (adv) => {
                                    if (!latestPayoutDate) return true;
                                    const advDate = typeof adv.date === 'string' ? adv.date.split('T')[0] : new Date(adv.date).toISOString().split('T')[0];
                                    if (advDate > latestPayoutDate) return true;
                                    if (advDate === latestPayoutDate) {
                                        if (adv.created_at && latestPayout.created_at) {
                                            return new Date(adv.created_at) > new Date(latestPayout.created_at);
                                        }
                                        return false;
                                    }
                                    return false;
                                };

                                const activeAdvances = advanceHistory.filter(adv => isUnsettled(adv));
                                const activeTotalAmount = activeAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
                                const allAdvancesTotalAmount = advanceHistory.reduce((sum, a) => sum + Number(a.amount || 0), 0);

                                const allTimelineEvents = [
                                    ...advanceHistory.map(adv => ({
                                        type: 'advance',
                                        id: `adv-${adv.advance_id}`,
                                        advance_id: adv.advance_id,
                                        date: typeof adv.date === 'string' ? adv.date.split('T')[0] : new Date(adv.date).toISOString().split('T')[0],
                                        amount: Number(adv.amount),
                                        notes: adv.notes,
                                        site_name: adv.site_name,
                                        created_at: adv.created_at,
                                        is_unsettled: isUnsettled(adv)
                                    })),
                                    ...advancePayouts.map(p => ({
                                        type: 'payout',
                                        id: `payout-${p.payout_id}`,
                                        payout_id: p.payout_id,
                                        date: typeof p.payment_date === 'string' ? p.payment_date.split('T')[0] : new Date(p.payment_date).toISOString().split('T')[0],
                                        amount: Number(p.paid_amount),
                                        month: p.month,
                                        notes: p.notes,
                                        site_name: p.site_name,
                                        created_at: p.created_at
                                    }))
                                ].sort((a, b) => {
                                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                                    return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
                                });

                                return (
                                    <div className="pt-6 border-t border-slate-200 dark:border-[#30363d] space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-amber-500" />
                                                <span className="font-bold text-xs text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                                    Advance History & Timeline
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-slate-200 dark:border-[#30363d]">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAdvanceHistoryView('month');
                                                        loadAdvanceHistory(advanceForm.labour_id, financeMonth);
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                                        advanceHistoryView === 'month'
                                                            ? 'bg-amber-500 text-white shadow-xs'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    This Month ({advanceHistory.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAdvanceHistoryView('all');
                                                        loadAdvanceHistory(advanceForm.labour_id, null);
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                                        advanceHistoryView === 'all'
                                                            ? 'bg-amber-500 text-white shadow-xs'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    All Time
                                                </button>
                                            </div>
                                        </div>

                                        {/* Summary Badge */}
                                        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-2.5 rounded-xl text-[11px] flex justify-between items-center">
                                            <div>
                                                <span className="text-amber-900 dark:text-amber-300 font-bold block">
                                                    {advanceHistoryView === 'month' ? `Advances in ${getMonthNameAndYear(financeMonth + '-01')}` : 'All-Time Historical Advance Log'}
                                                </span>
                                                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/70 block mt-0.5">
                                                    {advanceHistoryView === 'month'
                                                        ? `Logged advances and payouts for ${getMonthNameAndYear(financeMonth + '-01')}`
                                                        : `${advancePayouts.length} past settlement${advancePayouts.length !== 1 ? 's' : ''} recorded across all months`}
                                                </span>
                                            </div>
                                            <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs shrink-0 ml-2">
                                                {`${advanceHistory.length} advance${advanceHistory.length !== 1 ? 's' : ''} • ₹${allAdvancesTotalAmount.toLocaleString()}`}
                                            </span>
                                        </div>

                                        {advanceHistoryLoading ? (
                                            <div className="flex justify-center py-6">
                                                <Clock className="animate-spin text-amber-500" size={20} />
                                            </div>
                                        ) : allTimelineEvents.length === 0 ? (
                                            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-[#30363d] rounded-xl bg-slate-50/50 dark:bg-[#161b22]/30 p-4">
                                                <DollarSign size={22} className="mx-auto text-slate-400 dark:text-slate-600 mb-1 opacity-50" />
                                                <p className="text-slate-500 dark:text-github-dark-muted text-[11px] font-semibold">
                                                    {advanceHistoryView === 'month'
                                                        ? `No advances or settlements recorded for this worker in ${getMonthNameAndYear(financeMonth + '-01')}`
                                                        : 'No advances or payments recorded for this worker'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-300 dark:before:bg-amber-900/60">
                                                {allTimelineEvents.map((evt, idx) => (
                                                    <div key={evt.id || idx} className="relative group">
                                                        {evt.type === 'payout' ? (
                                                            <>
                                                                {/* Payout Settlement Milestone */}
                                                                <div className="absolute -left-5 top-2.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#0d1117] flex items-center justify-center" />
                                                                <div className="bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-2.5 shadow-xs">
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="font-extrabold text-xs text-emerald-700 dark:text-emerald-400">
                                                                                    Salary Settled: ₹{evt.amount.toLocaleString()} Paid
                                                                                </span>
                                                                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold uppercase">
                                                                                    Settled
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 dark:text-github-dark-muted font-medium mt-0.5">
                                                                                Paid on {formatAdvanceDate(evt.date)}
                                                                            </div>
                                                                            {evt.site_name && (
                                                                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-[#161b22] text-slate-600 dark:text-slate-300 text-[9px] font-bold border border-emerald-200/50 dark:border-emerald-900/40">
                                                                                    {evt.site_name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {evt.notes && (
                                                                        <p className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0d1117] p-1.5 px-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                                                            {evt.notes}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* Advance Event */}
                                                                <div className={`absolute -left-5 top-2 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-[#0d1117] ${
                                                                    evt.is_unsettled ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600'
                                                                }`} />
                                                                <div className={`border rounded-xl p-2.5 transition-all shadow-xs ${
                                                                    evt.is_unsettled
                                                                        ? 'bg-slate-50 dark:bg-[#161b22] border-slate-200/80 dark:border-github-dark-border/80 hover:border-amber-500/40'
                                                                        : 'bg-slate-50/40 dark:bg-[#161b22]/40 border-slate-200/40 dark:border-github-dark-border/40 opacity-80'
                                                                }`}>
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`font-extrabold text-xs ${
                                                                                    evt.is_unsettled ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
                                                                                }`}>
                                                                                    ₹{evt.amount.toLocaleString()}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-semibold">
                                                                                    on {formatAdvanceDate(evt.date)}
                                                                                </span>
                                                                                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${
                                                                                    evt.is_unsettled
                                                                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                                                }`}>
                                                                                    {evt.is_unsettled ? 'Unsettled' : 'Settled in Payout'}
                                                                                </span>
                                                                            </div>
                                                                            {evt.site_name && (
                                                                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                                                                                    {evt.site_name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {evt.is_unsettled && (
                                                                            <button
                                                                                type="button"
                                                                                title="Delete this advance"
                                                                                onClick={() => handleDeleteAdvance(evt.advance_id)}
                                                                                className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {evt.notes && (
                                                                        <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0d1117] p-1.5 px-2 rounded-lg border border-slate-100 dark:border-[#30363d]/50 font-normal">
                                                                            {evt.notes}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AdvanceModal;
