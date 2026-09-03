import React from 'react';
import { FileText, X, ChevronDown, Loader2, Check } from 'lucide-react';

const PolicyRuleFormDrawer = ({
    selectedPolicy,
    editingRule,
    ruleForm,
    setRuleForm,
    onSaveRule,
    onClose,
    isSaving = false
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/25">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">
                            {editingRule ? 'Edit Entitlement Rule' : 'Add Entitlement Rule'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-normal">{selectedPolicy?.name}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-muted rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={onSaveRule} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Rule Name</label>
                    <input
                        type="text"
                        required
                        value={ruleForm.name}
                        onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-normal text-xs"
                        placeholder="e.g. Annual Leave"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Leave Code / Abbreviation</label>
                    <input
                        type="text"
                        required
                        maxLength="4"
                        value={ruleForm.code}
                        onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-medium text-xs"
                        placeholder="e.g. AL"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Days Per Year</label>
                        <input
                            type="number"
                            min="0"
                            required
                            value={ruleForm.max_balance}
                            onChange={(e) => setRuleForm({ ...ruleForm, max_balance: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-normal text-xs"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">When is Leave Added?</label>
                        <div className="relative">
                            <select
                                value={ruleForm.accural_type}
                                onChange={(e) => setRuleForm({ ...ruleForm, accural_type: e.target.value })}
                                className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 pr-10 cursor-pointer text-slate-700 dark:text-slate-350"
                            >
                                <option value="No Accrual">All at Once (Start of Year)</option>
                                <option value="Monthly">Add Monthly</option>
                                <option value="Quarterly">Add Every 3 Months</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-github-dark-muted">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Clean, Non-Bold, Card-free Entitlement Checkboxes */}
                <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 pt-2">
                    {/* Option 1: Paid Leave */}
                    <label className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Paid Leave</span>
                            <span className="text-[11px] text-slate-400 dark:text-github-dark-muted font-normal">Eligible for salary payment while away</span>
                        </div>
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={ruleForm.is_paid}
                                onChange={(e) => setRuleForm({ ...ruleForm, is_paid: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:border-indigo-400">
                                <svg
                                    className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.is_paid ? 'opacity-100' : 'opacity-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </label>

                    {/* Option 2: Require Document */}
                    <label className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Require Document</span>
                            <span className="text-[11px] text-slate-400 dark:text-github-dark-muted font-normal">Must attach doctor note or document</span>
                        </div>
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={ruleForm.requires_doc}
                                onChange={(e) => setRuleForm({ ...ruleForm, requires_doc: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:border-indigo-400">
                                <svg
                                    className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.requires_doc ? 'opacity-100' : 'opacity-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </label>

                    {/* Option 3: Encashable */}
                    <label className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Encashable</span>
                            <span className="text-[11px] text-slate-400 dark:text-github-dark-muted font-normal">Unused days can be cashed out</span>
                        </div>
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={ruleForm.encashable}
                                onChange={(e) => setRuleForm({ ...ruleForm, encashable: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:border-indigo-400">
                                <svg
                                    className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.encashable ? 'opacity-100' : 'opacity-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </label>

                    {/* Option 4: Carry Forward */}
                    <label className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-700 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Carry Forward</span>
                            <span className="text-[11px] text-slate-400 dark:text-github-dark-muted font-normal">Unused days roll over to next year</span>
                        </div>
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={ruleForm.carry_forward}
                                onChange={(e) => setRuleForm({ ...ruleForm, carry_forward: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:border-indigo-400">
                                <svg
                                    className={`w-3.5 h-3.5 text-white transition-opacity ${ruleForm.carry_forward ? 'opacity-100' : 'opacity-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </label>

                    {ruleForm.carry_forward && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 px-2 pt-1 pb-1 space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Max Carry Forward (Days)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={ruleForm.carry_forward_max}
                                onChange={(e) => setRuleForm({ ...ruleForm, carry_forward_max: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="e.g. 5"
                                required
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-medium transition-all active:scale-[0.98] cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        <span>{editingRule ? 'Update Rule' : 'Add Rule'}</span>
                    </button>
                </div>
            </form>
        </>
    );
};

export default PolicyRuleFormDrawer;
