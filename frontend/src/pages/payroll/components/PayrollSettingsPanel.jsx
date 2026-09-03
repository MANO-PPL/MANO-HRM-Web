import React from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

const PayrollSettingsPanel = ({
    settingsForm,
    setSettingsForm,
    onSubmit,
    onClose,
    isSavingSettings = false
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                <div className="flex items-center gap-2">
                    <Settings className="text-indigo-500" size={18} />
                    <h3 className="font-semibold text-slate-900 dark:text-github-dark-text text-base">Global Payroll LOP Settings</h3>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 rounded-xl space-y-1">
                    <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        Organization Payment Multipliers
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted leading-relaxed font-normal">
                        Adjust the daily salary multiplier for each attendance status. LOP deductions will be calculated dynamically based on these multipliers.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Present / Late status multiplier
                            </label>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                {((settingsForm.lopFactorPresent || 0) * 100).toFixed(0)}% Pay
                            </span>
                        </div>
                        <input
                            type="number"
                            required
                            min="0"
                            max="2"
                            step="0.01"
                            value={settingsForm.lopFactorPresent}
                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorPresent: parseFloat(e.target.value) || 0.0 })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                            placeholder="e.g. 1.0"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Multiplier applied for present days (typically 1.0 for 100% pay).</p>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Half Day status multiplier
                            </label>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                {((settingsForm.lopFactorHalfDay || 0) * 100).toFixed(0)}% Pay
                            </span>
                        </div>
                        <input
                            type="number"
                            required
                            min="0"
                            max="2"
                            step="0.01"
                            value={settingsForm.lopFactorHalfDay}
                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorHalfDay: parseFloat(e.target.value) || 0.0 })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                            placeholder="e.g. 0.5"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Multiplier applied for half-day shifts (typically 0.5 for 50% pay).</p>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Absent / Missed Punch status multiplier
                            </label>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                {((settingsForm.lopFactorAbsent || 0) * 100).toFixed(0)}% Pay
                            </span>
                        </div>
                        <input
                            type="number"
                            required
                            min="0"
                            max="2"
                            step="0.01"
                            value={settingsForm.lopFactorAbsent}
                            onChange={e => setSettingsForm({ ...settingsForm, lopFactorAbsent: parseFloat(e.target.value) || 0.0 })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                            placeholder="e.g. 0.0"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Multiplier applied for absent days (typically 0.0 for 0% pay).</p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all cursor-pointer"
                        disabled={isSavingSettings}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                        disabled={isSavingSettings}
                    >
                        {isSavingSettings ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>Save Settings</span>
                        )}
                    </button>
                </div>
            </form>
        </>
    );
};

export default PayrollSettingsPanel;
