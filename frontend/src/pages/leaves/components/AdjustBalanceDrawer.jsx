import React from 'react';
import { Edit2, X, Loader2, Check } from 'lucide-react';

const AdjustBalanceDrawer = ({
    editingBalance,
    balanceForm,
    setBalanceForm,
    onSaveBalance,
    onClose,
    isSavingBalance = false
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                        <Edit2 size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Adjust Balance</h3>
                        <p className="text-[10px] text-slate-400 font-normal">{editingBalance?.user_name} - {editingBalance?.leave_type}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={onSaveBalance} className="flex-1 p-6 space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Allocated Quota</label>
                    <input
                        type="number"
                        min="0"
                        value={balanceForm.allocated}
                        onChange={(e) => setBalanceForm({ ...balanceForm, allocated: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Carried Forward</label>
                    <input
                        type="number"
                        min="0"
                        value={balanceForm.carried_forward}
                        onChange={(e) => setBalanceForm({ ...balanceForm, carried_forward: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Used Days</label>
                    <input
                        type="number"
                        min="0"
                        value={balanceForm.used}
                        onChange={(e) => setBalanceForm({ ...balanceForm, used: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                    />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-github-dark-border">
                    <button
                        type="submit"
                        disabled={isSavingBalance}
                        className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-xs"
                    >
                        {isSavingBalance ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                        <span>Save Adjustments</span>
                    </button>
                </div>
            </form>
        </>
    );
};

export default AdjustBalanceDrawer;
