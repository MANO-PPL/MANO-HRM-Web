import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, Clock, Paperclip, FileText, Trash2, CheckCircle, Check, Sparkles } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';

const ApplyLeaveDrawer = ({
    isOpen,
    onClose,
    formData,
    setFormData,
    isCustomType,
    setIsCustomType,
    myBalances = [],
    policies = [],
    selectedBalance,
    calculateDays,
    handleTextareaInput,
    handleFileChange,
    removeFile,
    handleApply
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Build unified leave options
    const leaveOptions = useMemo(() => {
        const list = [];
        const seenRuleIds = new Set();

        // 1. Add balances for rules employee already has tracked balances for
        if (myBalances && myBalances.length > 0) {
            myBalances.forEach(bal => {
                if (bal.rule_id) seenRuleIds.add(String(bal.rule_id));
                list.push({
                    value: String(bal.rule_id || bal.leave_type),
                    ruleId: bal.rule_id,
                    name: (bal.leave_type || '').trim(),
                    policyName: bal.policy_name || 'Personal Balance',
                    available: bal.available !== undefined ? Number(bal.available) : null,
                    requiresDoc: bal.requires_doc === 1,
                    badge: bal.available !== undefined ? `${Number(bal.available)} days left` : null
                });
            });
        }

        // 2. Also include any policy rules assigned to the company/employee that aren't in myBalances yet
        if (policies && policies.length > 0) {
            policies.forEach(p => {
                (p.rules || []).forEach(r => {
                    const ruleKey = String(r.rule_id || r.name);
                    if (!seenRuleIds.has(String(r.rule_id)) && !seenRuleIds.has(ruleKey)) {
                        seenRuleIds.add(String(r.rule_id || ruleKey));
                        list.push({
                            value: String(r.rule_id || r.name),
                            ruleId: r.rule_id,
                            name: (r.name || '').trim(),
                            policyName: p.name || 'Company Policy',
                            available: r.max_balance !== undefined ? Number(r.max_balance) : null,
                            requiresDoc: r.requires_doc === 1,
                            badge: r.max_balance !== undefined ? `${Number(r.max_balance)} days/yr` : null
                        });
                    }
                });
            });
        }

        // 3. Fallback standard types if no balances or policies found
        if (list.length === 0) {
            ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'].forEach(name => {
                list.push({
                    value: name,
                    ruleId: null,
                    name: name,
                    policyName: 'Standard Leave',
                    available: null,
                    requiresDoc: false,
                    badge: null
                });
            });
        }

        // 4. Custom "Other" option
        list.push({
            value: '__other__',
            ruleId: null,
            name: 'Other (Custom Leave)',
            policyName: 'Custom Reason',
            available: null,
            requiresDoc: false,
            badge: 'Custom'
        });

        return list;
    }, [myBalances, policies]);

    // Ensure a default selection exists when opening drawer, but never clobber custom selection
    useEffect(() => {
        if (isOpen && !isCustomType && !formData.leave_type && leaveOptions.length > 0) {
            const firstRegular = leaveOptions.find(o => o.value !== '__other__');
            if (firstRegular) {
                setFormData(prev => ({ ...prev, leave_type: firstRegular.value }));
            }
        }
    }, [isOpen, isCustomType, formData.leave_type, leaveOptions, setFormData]);

    // Determine the currently active option
    const currentOption = useMemo(() => {
        if (isCustomType) {
            return leaveOptions.find(o => o.value === '__other__') || {
                value: '__other__',
                name: 'Other (Custom Leave)',
                policyName: 'Custom',
                badge: 'Custom'
            };
        }
        return leaveOptions.find(o =>
            String(o.value) === String(formData.leave_type) ||
            (o.ruleId && String(o.ruleId) === String(formData.leave_type)) ||
            (o.name && o.name.trim().toLowerCase() === String(formData.leave_type).trim().toLowerCase())
        ) || leaveOptions[0];
    }, [leaveOptions, formData.leave_type, isCustomType]);

    // Handle selecting an option from custom dropdown
    const handleSelectOption = (opt) => {
        if (opt.value === '__other__') {
            setIsCustomType(true);
            setFormData(prev => ({
                ...prev,
                leave_type: prev.leave_type && isNaN(Number(prev.leave_type)) ? prev.leave_type : 'Other'
            }));
        } else {
            setIsCustomType(false);
            setFormData(prev => ({ ...prev, leave_type: opt.value }));
        }
        setIsDropdownOpen(false);
    };

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    return (
        <AnimatePresence>
            {/* Backdrop */}
            {isOpen && (
                <motion.div
                    key="apply-leave-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                />
            )}

            {/* Slide-in Drawer */}
            {isOpen && (
                <motion.div
                    key="apply-leave-drawer-panel"
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed right-0 top-0 h-full w-full max-w-[480px] z-50 bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/70 dark:bg-[#161b22]/70">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Apply for Leave</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Submit a leave request for review</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* CUSTOM LEAVE TYPE DROPDOWN (No default browser select) */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                            Leave Type <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            {/* Trigger */}
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(prev => !prev)}
                                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#161b22] border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${isDropdownOpen
                                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                                        : 'border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-800 dark:text-[#f0f6fc] truncate">
                                            {currentOption?.name || 'Select leave type...'}
                                        </span>
                                        {currentOption?.policyName && currentOption.value !== '__other__' && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 shrink-0">
                                                {currentOption.policyName}
                                            </span>
                                        )}
                                    </div>
                                    {currentOption?.badge && (
                                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                            {currentOption.badge}
                                        </div>
                                    )}
                                </div>
                                <ChevronDown
                                    size={17}
                                    className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`}
                                />
                            </button>

                            {/* Custom Options Menu */}
                            <AnimatePresence>
                                {isDropdownOpen && (
                                    <motion.div
                                        key="apply-leave-options-dropdown"
                                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1"
                                    >
                                        {leaveOptions.map((opt) => {
                                            const isSelected = isCustomType
                                                ? opt.value === '__other__'
                                                : (!isCustomType && (currentOption?.value === opt.value || (opt.ruleId && String(opt.ruleId) === String(formData.leave_type))));
                                            return (
                                                <div
                                                    key={opt.value}
                                                    onClick={() => handleSelectOption(opt)}
                                                    className={`px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${isSelected
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/50 dark:border-indigo-800/40'
                                                            : 'hover:bg-slate-100 dark:hover:bg-[#21262d] text-slate-700 dark:text-[#f0f6fc]'
                                                        }`}
                                                >
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm truncate leading-tight">
                                                                {opt.name}
                                                            </span>
                                                            {opt.policyName && opt.value !== '__other__' && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#21262d] text-slate-500 dark:text-slate-400">
                                                                    {opt.policyName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {opt.badge && (
                                                            <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                {opt.badge}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Custom Leave Type Text Input (if Other selected) */}
                        <AnimatePresence>
                            {isCustomType && (
                                <motion.div
                                    key="apply-leave-custom-type-input"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3"
                                >
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                        Custom Leave Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Enter custom leave type (e.g. Other, Paternity)..."
                                        value={formData.leave_type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, leave_type: e.target.value }))}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-[#f0f6fc] placeholder-slate-400"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* DATES */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <DatePicker
                                label="Start Date"
                                value={formData.start_date}
                                onChange={(date) => setFormData({ ...formData, start_date: date })}
                                placeholder="Select date"
                            />
                        </div>
                        <div>
                            <DatePicker
                                label="End Date"
                                value={formData.end_date}
                                onChange={(date) => setFormData({ ...formData, end_date: date })}
                                placeholder="Select date"
                                align="right"
                            />
                        </div>
                    </div>

                    {/* DURATION PILL */}
                    {formData.start_date && formData.end_date && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 font-medium flex items-center justify-center gap-2">
                            <Clock size={14} />
                            Total Duration: <span className="font-bold">{calculateDays(formData.start_date, formData.end_date)} Days</span>
                        </div>
                    )}

                    {/* REASON */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                            Reason <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            required
                            rows="2"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            onInput={handleTextareaInput}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-[#f0f6fc] resize-none placeholder-slate-400 overflow-hidden min-h-[48px]"
                            placeholder="Why do you need leave?"
                        ></textarea>
                    </div>

                    {/* MULTIPLE DOCUMENTS UPLOAD SECTION (ALWAYS ACCESSIBLE) */}
                    <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Supporting Documents
                            </label>
                            {selectedBalance?.requires_doc === 1 ? (
                                <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/40">
                                    Required by Policy
                                </span>
                            ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                                    Optional • Multiple files supported
                                </span>
                            )}
                        </div>

                        {/* File Upload Zone */}
                        <div className="relative group">
                            <input
                                type="file"
                                id="leave-attachment-drawer"
                                className="hidden"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                onChange={handleFileChange}
                            />
                            <label
                                htmlFor="leave-attachment-drawer"
                                className="w-full flex flex-col items-center gap-2 px-4 py-5 bg-slate-50 dark:bg-[#161b22] border-2 border-dashed border-slate-300 dark:border-github-dark-border rounded-xl cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all text-center"
                            >
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                                    <Paperclip size={18} />
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-[#f0f6fc] block">
                                        {formData.attachments?.length > 0 ? "Click to add more documents" : "Click to upload documents"}
                                    </span>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                        JPG, PNG, WEBP, or PDF (Up to 5 files, 5MB each)
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Selected Files List */}
                        {formData.attachments && formData.attachments.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
                                    <span>{formData.attachments.length} document{formData.attachments.length > 1 ? 's' : ''} attached</span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, attachments: [] }))}
                                        className="text-rose-500 hover:text-rose-600 text-[11px] cursor-pointer"
                                    >
                                        Clear all
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {formData.attachments.map((file, index) => {
                                        const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
                                        return (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-2.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-150"
                                            >
                                                <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0 pr-2">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                        <FileText size={15} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-[#f0f6fc] truncate">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {(file.size / 1024).toFixed(1)} KB • {isPdf ? 'PDF Document' : 'Image'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        removeFile(index);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer shrink-0"
                                                    title="Remove document"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                        type="submit"
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                        <CheckCircle size={18} />
                        Submit Request
                    </button>
                </form>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ApplyLeaveDrawer;
