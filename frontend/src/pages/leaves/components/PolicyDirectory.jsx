import React from 'react';
import { Plus, Search, Loader2, Clock } from 'lucide-react';

const PolicyDirectory = ({
    policies = [],
    selectedPolicyId,
    setSelectedPolicyId,
    loading = false,
    policySearch = '',
    setPolicySearch,
    openAddPolicy,
    activeMobileTab,
    setActiveMobileTab
}) => {
    const filteredPolicies = policies.filter(p =>
        p.name.toLowerCase().includes(policySearch.toLowerCase())
    );

    return (
        <div className={`w-full lg:w-1/4 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden shrink-0 ${activeMobileTab !== 'list' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Leave Policies</h3>
                    <button
                        onClick={openAddPolicy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                        <Plus size={14} />
                        Create
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search policies..."
                        value={policySearch}
                        onChange={(e) => setPolicySearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 text-slate-755 dark:text-github-dark-text font-normal"
                    />
                </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1.5 no-scrollbar max-h-[400px] lg:max-h-none">
                {loading && policies.length === 0 ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="animate-spin text-indigo-650" size={24} />
                    </div>
                ) : filteredPolicies.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-6 text-center font-normal">No policies found.</p>
                ) : (
                    filteredPolicies.map((policy) => {
                        const isSelected = policy.lp_id === selectedPolicyId;
                        return (
                            <div
                                key={policy.lp_id}
                                onClick={() => {
                                    setSelectedPolicyId(policy.lp_id);
                                    if (setActiveMobileTab) setActiveMobileTab('details');
                                }}
                                className={`p-3 rounded-lg border transition-all cursor-pointer group ${isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                    : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${policy.is_active ? 'bg-indigo-500' : 'bg-slate-350 dark:bg-slate-600'}`} />
                                        <h4 className={`font-semibold text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-850 dark:text-github-dark-text'}`}>{policy.name}</h4>
                                    </div>
                                    {!policy.is_active && (
                                        <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted truncate font-normal">{policy.description || 'No description'}</p>
                                <div className="flex items-center gap-3 text-[10px] text-slate-450 mt-2 font-medium">
                                    <span className="flex items-center gap-1"><Clock size={10} /> Rules: {policy.rules?.length || 0}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PolicyDirectory;
