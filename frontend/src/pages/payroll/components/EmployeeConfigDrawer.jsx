import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, AlertCircle, Plus, Minus, Lock, Unlock } from 'lucide-react';

const EmployeeConfigDrawer = ({
    configEmp,
    setConfigEmp,
    selectedMonth,
    configAdjustments,
    addAdjustment,
    updateAdjustment,
    removeAdjustment,
    handleLockToggle,
    handleSaveConfig,
    savingConfig
}) => {
    return (
        <AnimatePresence>
            {configEmp && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setConfigEmp(null)}
                        className="fixed inset-0 bg-black z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-github-dark-border/80 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base flex items-center gap-2">
                                    <SlidersHorizontal className="text-indigo-500" size={17} />
                                    Employee Config
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1">{configEmp.name} · {selectedMonth}</p>
                            </div>
                            <button
                                onClick={() => setConfigEmp(null)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {/* Salary snapshot */}
                            <div className="bg-slate-50/60 dark:bg-[#161b22]/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/60 space-y-3">
                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Salary Snapshot</h4>
                                {[
                                    { label: 'Basic Pay', value: configEmp.basic },
                                    { label: 'Allowances', value: configEmp.allowance },
                                    { label: 'LOP Deduction', value: -configEmp.lop_deduction },
                                    { label: 'Overtime', value: configEmp.overtime_amount },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 dark:text-github-dark-muted font-medium">{label}</span>
                                        <span className={`font-extrabold ${ value < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                            {value < 0 ? `-₹${Math.abs(value).toLocaleString('en-IN')}` : `₹${value.toLocaleString('en-IN')}`}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t border-dashed border-slate-200 dark:border-github-dark-border/40 pt-3 flex justify-between items-center">
                                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">Net Payout</span>
                                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-400">₹{(configEmp.basic + configEmp.allowance + configEmp.overtime_amount - configEmp.lop_deduction).toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Locked warning banner */}
                            {(() => {
                                const isLocked = configEmp.status === 'Finalized' || configEmp.status === 'Paid';
                                return isLocked && (
                                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start gap-2.5">
                                        <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={15} />
                                        <span className="text-[10.5px] text-amber-700 dark:text-amber-450 font-bold leading-normal">
                                            This payroll is locked ({configEmp.status}). Click the "Unlock" button below to return it to Draft status before editing manual adjustments.
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* Manual Adjustments */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Manual Adjustments</h4>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => addAdjustment('addition')}
                                            disabled={configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                            className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 disabled:hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg flex items-center gap-1 transition-all"
                                        >
                                            <Plus size={10} /> Addition
                                        </button>
                                        <button
                                            onClick={() => addAdjustment('deduction')}
                                            disabled={configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                            className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg flex items-center gap-1 transition-all"
                                        >
                                            <Minus size={10} /> Deduction
                                        </button>
                                    </div>
                                </div>

                                {configAdjustments.length === 0 && (
                                    <div className="py-6 text-center text-[11px] text-slate-400 dark:text-github-dark-muted font-semibold bg-slate-50 dark:bg-[#161b22]/30 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border/40">
                                        No adjustments added. Use the buttons above to add bonus or deduction entries.
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {configAdjustments.map((adj, idx) => {
                                        const isLocked = configEmp.status === 'Finalized' || configEmp.status === 'Paid';
                                        return (
                                            <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-2 ${adj.type === 'addition' ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-6 rounded-full shrink-0 ${adj.type === 'addition' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                    <input
                                                        type="text"
                                                        placeholder="Label (e.g. Bonus)"
                                                        value={adj.label}
                                                        disabled={isLocked}
                                                        onChange={e => updateAdjustment(idx, 'label', e.target.value)}
                                                        className="flex-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-github-dark-text outline-none placeholder:text-slate-355 dark:placeholder:text-slate-600 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                    />
                                                    <span className="text-xs text-slate-400">₹</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        value={adj.amount}
                                                        disabled={isLocked}
                                                        onChange={e => updateAdjustment(idx, 'amount', e.target.value)}
                                                        className="w-20 bg-transparent text-xs font-extrabold text-slate-800 dark:text-github-dark-text outline-none text-right placeholder:text-slate-350 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                    />
                                                    <button
                                                        onClick={() => removeAdjustment(idx)}
                                                        disabled={isLocked}
                                                        className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 ml-1 transition-all"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                                <div className="pl-3.5">
                                                    <input
                                                        type="text"
                                                        placeholder="Reason/Justification (required)"
                                                        value={adj.reason || ''}
                                                        disabled={isLocked}
                                                        onChange={e => updateAdjustment(idx, 'reason', e.target.value)}
                                                        className="w-full bg-transparent text-[11px] font-semibold text-slate-500 dark:text-github-dark-muted outline-none placeholder:text-slate-350 dark:placeholder:text-slate-650 border-b border-dashed border-slate-200 dark:border-github-dark-border/40 focus:border-indigo-500 pb-0.5 disabled:text-slate-400 dark:disabled:text-slate-500"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Current Status</h4>
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const s = configEmp.status || 'Draft';
                                        const isLocked = s === 'Finalized' || s === 'Paid';
                                        return (
                                            <>
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    s === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                    : s === 'Finalized' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                                }`}>
                                                    {isLocked ? <Lock size={9} /> : <Unlock size={9} />}
                                                    {s}
                                                </span>
                                                <button
                                                    onClick={() => { handleLockToggle(configEmp); setConfigEmp(null); }}
                                                    disabled={s === 'Paid'}
                                                    className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isLocked ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
                                                >
                                                    {isLocked ? 'Unlock' : 'Lock & Finalize'}
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-github-dark-border/80 flex gap-3 shrink-0">
                            <button
                                onClick={() => setConfigEmp(null)}
                                className="flex-1 py-2.5 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={savingConfig || configEmp.status === 'Finalized' || configEmp.status === 'Paid'}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                            >
                                {configEmp.status === 'Finalized' || configEmp.status === 'Paid' ? 'Locked (Read-Only)' : savingConfig ? 'Saving...' : 'Save Config'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default EmployeeConfigDrawer;
