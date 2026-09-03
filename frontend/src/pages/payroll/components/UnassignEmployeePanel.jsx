import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const UnassignEmployeePanel = ({
    selectedEmployeeForUnassign,
    unassignForm,
    setUnassignForm,
    onSubmit,
    onClose
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                <h3 className="font-semibold text-slate-900 dark:text-github-dark-text text-base">Unassign Package / Custom Salary</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-655 p-1 rounded-lg cursor-pointer">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                    <h4 className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Switching to Custom Salary Configuration
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                        Unassigning {selectedEmployeeForUnassign?.user_name} will switch them back to an individual salary config starting from the effective date.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Custom Gross Salary</label>
                        <input
                            type="number" required min="0" value={unassignForm.grossSalary}
                            onChange={e => setUnassignForm({ ...unassignForm, grossSalary: e.target.value })}
                            placeholder="e.g. 50000"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                        <input
                            type="date" required value={unassignForm.effectiveFrom}
                            onChange={e => setUnassignForm({ ...unassignForm, effectiveFrom: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        />
                    </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Enable Overtime</p>
                            <p className="text-[10px] text-slate-400 font-normal">Calculate extra pay for additional working hours</p>
                        </div>
                        <input
                            type="checkbox" checked={unassignForm.overtimeEnabled}
                            onChange={e => setUnassignForm({ ...unassignForm, overtimeEnabled: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    {unassignForm.overtimeEnabled && (
                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-750">
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Overtime Rate (per hour)</label>
                            <input
                                type="number" required min="0" value={unassignForm.overtimeRate}
                                onChange={e => setUnassignForm({ ...unassignForm, overtimeRate: e.target.value })}
                                placeholder="e.g. 200"
                                className="w-full px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                            />
                        </div>
                    )}
                </div>
                <div className="flex gap-3 pt-2">
                    <button
                        type="button" onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                    >
                        Switch to Custom
                    </button>
                </div>
            </form>
        </>
    );
};

export default UnassignEmployeePanel;
