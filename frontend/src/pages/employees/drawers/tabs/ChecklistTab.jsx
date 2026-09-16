import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

const ChecklistTab = ({
    selectedEmployee,
    onboardingData = {},
    checklistTemplates = [],
    handleChecklistTemplateChange,
    handleRestoreChecklistExclusions,
    handleChecklistToggle,
    handleExcludeChecklistItem
}) => {
    if (!selectedEmployee) return null;

    const profile = selectedEmployee.profile || {};
    const activeTemplateId = onboardingData.checklist_template_id || (checklistTemplates[0]?.id || '');
    const rawItems = onboardingData.checklist_items || [];
    const exclusions = profile.checklist_exclusions || [];
    const items = rawItems.filter(item => !exclusions.includes(item.task_key));

    const totalTasks = items.length;
    const completedTasks = (onboardingData.checklist_progress || []).filter(
        p => p.is_completed && rawItems.some(item => item.task_key === p.task_key && !exclusions.includes(item.task_key))
    ).length;
    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Template assignment & header */}
            <div className="bg-slate-50 dark:bg-github-dark-subtle/25 border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-1">Checklist Template</span>
                    <select
                        value={activeTemplateId}
                        onChange={(e) => handleChecklistTemplateChange(e.target.value)}
                        className="bg-transparent border-none p-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer hover:underline"
                    >
                        {checklistTemplates.map(t => (
                            <option key={t.id} value={t.id} className="bg-white dark:bg-dark-card text-slate-800 dark:text-github-dark-text">{t.name}</option>
                        ))}
                    </select>
                </div>
                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted block">Completion Rate</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-github-dark-text mt-0.5">
                        {rate}%
                    </span>
                </div>
            </div>

            {exclusions.length > 0 && (
                <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl text-[10px] text-amber-600 dark:text-amber-400">
                    <span>{exclusions.length} task(s) excluded for this employee.</span>
                    <button
                        onClick={handleRestoreChecklistExclusions}
                        className="font-bold underline uppercase hover:text-amber-700"
                    >
                        Restore All
                    </button>
                </div>
            )}

            <div className="space-y-2.5">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic bg-slate-50/20 dark:bg-[#161b22]/10 border border-slate-100 dark:border-github-dark-border rounded-xl">
                        {rawItems.length === 0 ? "No checklist items configured for this template." : "All checklist tasks excluded for this employee."}
                    </div>
                ) : (
                    items.map((item) => {
                        const progressLog = (onboardingData.checklist_progress || []).find(p => p.task_key === item.task_key);
                        const isDone = !!progressLog?.is_completed;
                        return (
                            <div
                                key={item.task_key}
                                onClick={() => handleChecklistToggle(item.task_key)}
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-100 dark:border-github-dark-border rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all select-none group/row"
                            >
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 size={18} className={isDone ? "text-emerald-500" : "text-slate-300 dark:text-slate-750"} />
                                    <span className={`font-semibold text-xs ${isDone ? 'text-slate-400 line-through opacity-70' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                        {item.task_label}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleExcludeChecklistItem(item.task_key);
                                    }}
                                    className="opacity-0 group-hover/row:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded transition-all"
                                    title="Exclude task for this employee"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChecklistTab;
