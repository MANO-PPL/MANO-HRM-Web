import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

const DiscrepancyOverrideModal = ({
    isOpen,
    discrepancy,
    overrideReasonText,
    setOverrideReasonText,
    onClose,
    onConfirm
}) => {
    if (!isOpen || !discrepancy) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="text-amber-500" size={18} />
                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Override Discrepancy</h4>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 space-y-4 text-xs">
                    <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg">
                        <p className="font-bold text-rose-700 dark:text-rose-400 mb-1">{discrepancy.field} Mismatch</p>
                        <p className="text-slate-600 dark:text-slate-400">
                            <strong>{discrepancy.sourceA}:</strong> {discrepancy.valueA}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                            <strong>{discrepancy.sourceB}:</strong> {discrepancy.valueB}
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1.5">
                            Provide Justification / Reason for Mismatch
                        </label>
                        <textarea
                            value={overrideReasonText}
                            onChange={(e) => setOverrideReasonText(e.target.value)}
                            placeholder="e.g., Degree certificate verified with university registrar; mismatch is due to name containing middle initial. Checked and approved."
                            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(discrepancy.id, overrideReasonText)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all"
                        >
                            Approve Override
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscrepancyOverrideModal;
