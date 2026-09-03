import React from 'react';
import { Settings, X, Loader2, Check } from 'lucide-react';

const PolicyFormDrawer = ({
    editingPolicy,
    policyForm,
    setPolicyForm,
    onSavePolicy,
    onClose,
    isSaving = false
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                        <Settings size={20} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">
                        {editingPolicy ? 'Edit Leave Policy' : 'Create Leave Policy'}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={onSavePolicy} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Policy Name</label>
                    <input
                        type="text"
                        required
                        value={policyForm.name}
                        onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-normal text-xs"
                        placeholder="e.g. Standard Entitlements"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Description</label>
                    <textarea
                        value={policyForm.description}
                        onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 text-xs font-normal h-28 resize-none"
                        placeholder="Outline scope or details about eligibility for this policy..."
                    />
                </div>

                {editingPolicy && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-github-dark-subtle/55 border border-slate-200 dark:border-github-dark-border rounded-xl">
                        <div>
                            <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">Policy Status</span>
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-normal">Inactive policies cannot be assigned to employees.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={policyForm.is_active} 
                                onChange={e => setPolicyForm({ ...policyForm, is_active: e.target.checked })} 
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-medium transition-all active:scale-[0.98] cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        <span>{editingPolicy ? 'Update Policy' : 'Create Policy'}</span>
                    </button>
                </div>
            </form>
        </>
    );
};

export default PolicyFormDrawer;
