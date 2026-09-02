import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';

const EmployeeLeaveDetailDrawer = ({
    isOpen,
    onClose,
    selectedLeave,
    calculateDays,
    onWithdraw
}) => {
    if (!isOpen || !selectedLeave) return null;

    const sl = selectedLeave;
    const statusStyles = sl.status === 'approved'
        ? { pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500', accent: '#10b981' }
        : sl.status === 'rejected'
        ? { pill: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500', accent: '#ef4444' }
        : { pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500', accent: '#f59e0b' };
    const days = calculateDays(sl.start_date, sl.end_date);

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
                className="fixed right-0 top-0 h-full w-full max-w-[420px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Leave Details</h3>
                            <p className="text-[10px] text-slate-400 font-normal">Request #{sl.lr_id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {/* Status hero card */}
                    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${statusStyles.accent}15 0%, ${statusStyles.accent}08 100%)`, border: `1px solid ${statusStyles.accent}30` }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${statusStyles.accent}20` }}>
                            {sl.status === 'approved' ? <CheckCircle size={24} style={{ color: statusStyles.accent }} /> :
                             sl.status === 'rejected' ? <XCircle size={24} style={{ color: statusStyles.accent }} /> :
                             <Clock size={24} style={{ color: statusStyles.accent }} />}
                        </div>
                        <div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium capitalize mb-1 ${statusStyles.pill}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyles.dot}`}></span>
                                {sl.status}
                            </span>
                            <p className="text-base font-semibold text-slate-800 dark:text-github-dark-text">{days} Day{days !== 1 ? 's' : ''} Leave</p>
                            <p className="text-xs text-slate-500 font-normal">{sl.policy_name || sl.leave_type || 'Leave'}</p>
                            {sl.policy_name && sl.leave_type && <p className="text-[10px] text-slate-400 mt-0.5 font-normal">{sl.leave_type}</p>}
                        </div>
                    </div>

                    {/* Info rows */}
                    <div className="bg-slate-50 dark:bg-github-dark-subtle/20 rounded-xl border border-slate-200 dark:border-github-dark-border divide-y divide-slate-100 dark:divide-slate-700/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Leave Type</span>
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">{sl.policy_name || sl.leave_type || 'N/A'}</span>
                                    {sl.leave_code && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{sl.leave_code}</span>}
                                </div>
                                {sl.policy_name && sl.leave_type && (
                                    <span className="text-[10px] text-slate-400 font-normal">{sl.leave_type}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Start Date</span>
                            <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text">
                                {new Date(sl.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">End Date</span>
                            <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text">
                                {new Date(sl.end_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Duration</span>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{days} Day{days !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Applied On</span>
                            <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text">
                                {new Date(sl.applied_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        {sl.status === 'approved' && sl.pay_type && (
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pay Type</span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sl.pay_type === 'Paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {sl.pay_type}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reason</p>
                        <div className="bg-slate-50 dark:bg-github-dark-subtle/20 rounded-xl border border-slate-200 dark:border-github-dark-border px-4 py-3">
                            <p className="text-sm text-slate-700 dark:text-github-dark-text leading-relaxed font-normal">{sl.reason || 'No reason provided.'}</p>
                        </div>
                    </div>

                    {/* Admin Note */}
                    {sl.admin_comment && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Admin Note</p>
                            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30 px-4 py-3">
                                <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed font-normal">{sl.admin_comment}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer action */}
                {sl.status === 'pending' && (
                    <div className="p-4 border-t border-slate-100 dark:border-github-dark-border">
                        <button
                            onClick={() => onWithdraw(sl.lr_id)}
                            className="w-full py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-red-200 dark:border-red-800/30 cursor-pointer"
                        >
                            <Trash2 size={16} />
                            Withdraw Request
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default EmployeeLeaveDetailDrawer;
