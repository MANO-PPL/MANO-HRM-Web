import React from 'react';
import { Layers, Calendar, Clock, Edit2, Trash2 } from 'lucide-react';

const PackageDetailsPanel = ({
    selectedPackage,
    revisions = [],
    isLoadingRevisions = false,
    formatDate,
    formatVerboseDate,
    onEditPackage,
    onToggleActive,
    onDeletePackage,
    onOpenRevisionForm
}) => {
    if (!selectedPackage) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Package Details Header */}
            <div className="p-6 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text flex items-center gap-2">
                        {selectedPackage.package_name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-normal">
                        Created on {new Date(selectedPackage.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onEditPackage(selectedPackage)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text bg-white dark:bg-github-dark-subtle hover:bg-slate-50 dark:hover:bg-github-dark-subtle/80 rounded-xl text-xs font-medium transition-all shadow-sm cursor-pointer"
                        title="Edit package details"
                    >
                        <Edit2 size={13} />
                        <span>Edit</span>
                    </button>
                    <div className="flex items-center gap-2 border border-slate-200 dark:border-[#30363d] px-3 py-1 rounded-xl bg-slate-50/50 dark:bg-[#161b22]/30 select-none">
                        <span className={`text-xs font-medium transition-colors duration-150 ${selectedPackage.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {selectedPackage.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                            onClick={onToggleActive}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${selectedPackage.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                            title={selectedPackage.is_active ? 'Deactivate package' : 'Activate package'}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${selectedPackage.is_active ? 'translate-x-4' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <button
                        onClick={() => onDeletePackage(selectedPackage)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete package"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Package Info Cards & History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {/* Active Rate Configuration Card */}
                <div className="p-6 bg-slate-50/50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Layers size={16} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                                Active Rate Configuration
                            </span>
                        </div>
                        {selectedPackage.active_rate && (
                            <span className="text-xs font-normal text-slate-500 dark:text-github-dark-muted flex items-center gap-1 font-mono">
                                <Calendar size={12} />
                                Effective: {formatVerboseDate(selectedPackage.active_rate.effective_from)}
                            </span>
                        )}
                    </div>
                    {selectedPackage.active_rate ? (
                        <div className="grid grid-cols-2 gap-6 divide-x divide-slate-100 dark:divide-github-dark-border/50">
                            <div className="pr-6">
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">Gross Monthly Salary</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-github-dark-text mt-2 font-mono">
                                    ₹{Number(selectedPackage.active_rate.gross_salary).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="pl-6 space-y-2">
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">Overtime Allowance</p>
                                {selectedPackage.active_rate.overtime_enabled === 1 ? (
                                    <div className="space-y-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/20">
                                            Enabled
                                        </span>
                                        <p className="text-base font-medium text-slate-800 dark:text-slate-200 font-mono">
                                            Rate: ₹{Number(selectedPackage.active_rate.overtime_rate).toLocaleString('en-IN')}/hr
                                        </p>
                                    </div>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                        Disabled
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs text-slate-400 font-normal">
                            No rates defined for this package.
                        </div>
                    )}
                </div>

                {/* Revisions Revision Timeline */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-xs">
                            <Clock size={16} className="text-slate-400" />
                            <span>OT Rate Revision History</span>
                        </h3>
                        <button
                            onClick={onOpenRevisionForm}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            + Revise OT Rate
                        </button>
                    </div>

                    {isLoadingRevisions ? (
                        <p className="text-xs text-slate-400 text-center py-6 font-normal">Loading revisions...</p>
                    ) : revisions.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6 font-normal">No revisions found.</p>
                    ) : (
                        <div className="border border-slate-100 dark:border-[#30363d] rounded-xl overflow-hidden shadow-inner bg-slate-50/20 dark:bg-[#0d1117]/60">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-[#161b22] text-slate-500 border-b border-slate-100 dark:border-[#30363d] font-medium">
                                        <th className="p-3">Overtime</th>
                                        <th className="p-3">Effective From</th>
                                        <th className="p-3">Effective Till</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                                    {revisions.map((rev) => (
                                        <tr key={rev.package_id} className="hover:bg-slate-50 dark:hover:bg-[#161b22]/40">
                                            <td className="p-3">
                                                {rev.overtime_enabled ? (
                                                    <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/10 px-1.5 py-0.5 rounded font-mono">
                                                        ₹{Number(rev.overtime_rate).toLocaleString('en-IN')}/hr
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">Disabled</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                                {formatDate(rev.effective_from)}
                                            </td>
                                            <td className="p-3 font-mono text-slate-500">
                                                {rev.effective_to ? (
                                                    formatDate(rev.effective_to)
                                                ) : (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">Active</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PackageDetailsPanel;
