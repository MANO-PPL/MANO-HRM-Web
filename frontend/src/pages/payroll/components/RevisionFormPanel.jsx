import React from 'react';
import { X } from 'lucide-react';

const RevisionFormPanel = ({
    selectedPackage,
    revisionForm,
    setRevisionForm,
    onSubmit,
    onClose
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border">
                <h3 className="font-semibold text-slate-900 dark:text-github-dark-text text-base">
                    Revise OT Rate: {selectedPackage?.package_name}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Effective From</label>
                    <input
                        type="date" required value={revisionForm.effectiveFrom}
                        onChange={e => setRevisionForm({ ...revisionForm, effectiveFrom: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                    />
                </div>
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">Enable Overtime</p>
                            <p className="text-[10px] text-slate-400 font-normal">Calculate extra pay for additional working hours</p>
                        </div>
                        <input
                            type="checkbox" checked={revisionForm.overtimeEnabled}
                            onChange={e => setRevisionForm({ ...revisionForm, overtimeEnabled: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    {revisionForm.overtimeEnabled && (
                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-750">
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Overtime Rate (per hour)</label>
                            <input
                                type="number" required min="0" value={revisionForm.overtimeRate}
                                onChange={e => setRevisionForm({ ...revisionForm, overtimeRate: e.target.value })}
                                placeholder="e.g. 300"
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
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                    >
                        Save OT Revision
                    </button>
                </div>
            </form>
        </>
    );
};

export default RevisionFormPanel;
