import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, Clock, Paperclip, FileText, Trash2, CheckCircle } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';

const ApplyLeaveDrawer = ({
    isOpen,
    onClose,
    formData,
    setFormData,
    isCustomType,
    setIsCustomType,
    myBalances = [],
    selectedBalance,
    calculateDays,
    handleTextareaInput,
    handleFileChange,
    removeFile,
    handleApply
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
            />

            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-[460px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Plus size={20} />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Apply for Leave</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Leave Type</label>
                        <div className="relative">
                            <select
                                value={formData.leave_type}
                                onChange={(e) => {
                                    if (e.target.value === 'Other') {
                                        setIsCustomType(true);
                                        setFormData({ ...formData, leave_type: '' });
                                    } else {
                                        setIsCustomType(false);
                                        setFormData({ ...formData, leave_type: e.target.value });
                                    }
                                }}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text font-normal cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-900"
                            >
                                {myBalances.map(bal => (
                                    <option key={bal.rule_id} value={bal.rule_id}>
                                        {bal.policy_name || bal.leave_type} - {bal.leave_type} ({Number(bal.available)} days left)
                                    </option>
                                ))}
                                {myBalances.length === 0 && (
                                    <>
                                        <option value="Casual Leave">Casual Leave</option>
                                        <option value="Sick Leave">Sick Leave</option>
                                    </>
                                )}
                                <option value="Other">Other</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        {isCustomType && (
                            <input
                                type="text"
                                placeholder="Enter custom leave type"
                                value={formData.leave_type}
                                onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                className="w-full px-3 py-2.5 mt-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text font-normal"
                            />
                        )}
                    </div>

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

                    {formData.start_date && formData.end_date && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 font-medium flex items-center justify-center gap-2">
                            <Clock size={14} />
                            Total Duration: {calculateDays(formData.start_date, formData.end_date)} Days
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Reason</label>
                        <textarea
                            required
                            rows="1"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            onInput={handleTextareaInput}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-github-dark-text resize-none placeholder-slate-400 overflow-hidden min-h-[42px] font-normal"
                            placeholder="Why do you need leave?"
                        ></textarea>
                    </div>

                    {selectedBalance?.requires_doc === 1 && (
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Attachments (Required)</label>
                            <div className="space-y-3">
                                 {/* Upload Area */}
                                 <div className="relative group">
                                     <input
                                         type="file"
                                         id="leave-attachment"
                                         className="hidden"
                                         multiple
                                         accept=".jpg,.jpeg,.png,.pdf"
                                         onChange={handleFileChange}
                                     />
                                     <label
                                         htmlFor="leave-attachment"
                                         className="w-full flex flex-col items-center gap-2 px-4 py-6 bg-slate-50 dark:bg-github-dark-subtle border-2 border-dashed border-slate-300 dark:border-github-dark-border rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group-hover:scale-[1.01]"
                                     >
                                         <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                             <Paperclip size={18} />
                                         </div>
                                         <div className="text-center">
                                             <span className="text-sm font-medium text-slate-700 dark:text-github-dark-text">
                                                 Click to upload documents
                                             </span>
                                             <p className="text-xs text-slate-400 mt-1 font-normal">
                                                 JPG, PNG, PDF (Max 5MB)
                                             </p>
                                         </div>
                                     </label>
                                 </div>

                                 {/* Selected Files List */}
                                 {formData.attachments && formData.attachments.length > 0 && (
                                     <div className="grid grid-cols-1 gap-2">
                                         {formData.attachments.map((file, index) => (
                                             <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                 <div className="flex items-center gap-3 overflow-hidden">
                                                     <div className="w-8 h-8 rounded bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                                         <FileText size={16} />
                                                     </div>
                                                     <div className="min-w-0">
                                                         <p className="text-sm font-medium text-slate-700 dark:text-github-dark-text truncate">
                                                             {file.name}
                                                         </p>
                                                         <p className="text-[10px] text-slate-400 font-normal">
                                                             {(file.size / 1024).toFixed(1)} KB
                                                         </p>
                                                     </div>
                                                 </div>
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         removeFile(index);
                                                     }}
                                                     className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors cursor-pointer"
                                                     title="Remove file"
                                                 >
                                                     <Trash2 size={16} />
                                                 </button>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                        <CheckCircle size={18} />
                        Submit Request
                    </button>
                </form>
            </motion.div>
        </AnimatePresence>
    );
};

export default ApplyLeaveDrawer;
