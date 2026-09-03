import React from 'react';
import { ArrowLeft, ChevronRight, Edit2, Trash2, Layers, Plus, BookOpen } from 'lucide-react';

const PolicyRulesBuilder = ({
    selectedPolicy,
    openEditPolicy,
    setConfirmDeletePolicy,
    openAddRule,
    openEditRule,
    setConfirmDeleteRule,
    activeMobileTab,
    setActiveMobileTab
}) => {
    if (!selectedPolicy) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                <BookOpen size={48} className="opacity-20 mb-3" />
                <h4 className="font-bold text-xs">No Policy Selected</h4>
                <p className="text-[11px] mt-1 font-normal">Select a leave policy from the directory to manage its settings and rules.</p>
            </div>
        );
    }

    return (
        <>
            {/* Header details block */}
            <div className="p-4 border-b border-[#e1e4e6] dark:border-github-dark-border flex flex-col justify-start gap-3 bg-slate-50/30 dark:bg-github-dark-subtle/10">
                {/* Mobile action bar */}
                <div className="flex justify-between items-center lg:hidden">
                    <button
                        onClick={() => setActiveMobileTab('list')}
                        className="flex items-center gap-1 text-xs font-medium text-indigo-650 cursor-pointer"
                    >
                        <ArrowLeft size={14} />
                        Policies
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('staff')}
                        className="flex items-center gap-1 text-xs font-medium text-indigo-650 cursor-pointer"
                    >
                        Manage Staff
                        <ChevronRight size={14} />
                    </button>
                </div>

                <div className="flex justify-between items-center w-full">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-github-dark-text flex items-center gap-2">
                            {selectedPolicy.name}
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${selectedPolicy.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                                {selectedPolicy.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </h2>
                        <p className="text-[11px] text-slate-450 dark:text-github-dark-muted mt-1 leading-normal max-w-xl font-normal">{selectedPolicy.description || 'No description provided.'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={(e) => openEditPolicy(selectedPolicy, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-655 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Edit Policy"
                        >
                            <Edit2 size={13} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeletePolicy({ isOpen: true, policy: selectedPolicy }); }}
                            className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Delete Policy"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Rules builder and metadata cards */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                <div className="space-y-4">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-150 dark:border-github-dark-border">
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Layers size={11} />
                            Entitlement Rules ({selectedPolicy.rules?.length || 0})
                        </h4>
                        <button
                            onClick={openAddRule}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border rounded-lg text-[10px] font-medium shadow-sm cursor-pointer"
                        >
                            <Plus size={11} />
                            Add Rule
                        </button>
                    </div>

                    {!selectedPolicy.rules || selectedPolicy.rules.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-250 dark:border-[#30363d] rounded-xl text-center">
                            <p className="text-xs text-slate-400 italic font-normal">No rules defined. Add rules to configure Sick Leaves, Casual Leaves etc.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3.5">
                            {selectedPolicy.rules.map((rule) => (
                                <div
                                    key={rule.rule_id}
                                    className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl p-4 flex flex-col justify-between shadow-sm"
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <h5 className="font-semibold text-xs text-slate-800 dark:text-github-dark-text">{rule.name}</h5>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 px-2 py-0.5 rounded font-medium mt-1.5 inline-block">{rule.code}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => openEditRule(rule)}
                                                className="p-1 text-slate-450 hover:text-indigo-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteRule({ isOpen: true, rule })}
                                                className="p-1 text-slate-455 hover:text-red-650 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-y-2 text-[10px] text-slate-500 dark:text-github-dark-muted font-normal">
                                        <div>Quota Limit: <span className="text-slate-850 dark:text-white font-medium">{rule.max_balance} Days</span></div>
                                        <div>Pay Type: <span className="text-slate-850 dark:text-white font-medium">{rule.is_paid ? 'Paid' : 'Unpaid'}</span></div>
                                        <div>Accrual Strategy: <span className="text-slate-850 dark:text-white font-medium">{rule.accural_type}</span></div>
                                        <div>Carry Forward: <span className="text-slate-850 dark:text-white font-medium">{rule.carry_forward ? `CF (Max ${rule.carry_forward_max})` : 'Disabled'}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PolicyRulesBuilder;
