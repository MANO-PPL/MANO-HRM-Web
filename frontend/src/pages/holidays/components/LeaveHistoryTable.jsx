import React from 'react';
import { FileText, Trash2, Calendar } from 'lucide-react';

const LeaveHistoryTable = ({
    filteredLeaves = [],
    selectedLeave,
    setSelectedLeave,
    selectedYear,
    selectedMonth,
    calculateDays,
    handleWithdraw
}) => {
    return (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-github-dark-border flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-github-dark-text">My Leave Requests</h4>
            </div>

            {filteredLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 px-6">
                    <FileText size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">No requests this month</p>
                    <p className="text-xs max-w-sm font-normal">No leave requests found for {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-github-dark-subtle/50 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Reason</th>
                                <th className="px-6 py-4">Applied On</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredLeaves.map((leave) => {
                                const isActive = selectedLeave?.lr_id === leave.lr_id;
                                const statusColor = leave.status === 'approved'
                                    ? { pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' }
                                    : leave.status === 'rejected'
                                    ? { pill: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' }
                                    : { pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' };
                                return (
                                <tr
                                    key={leave.lr_id}
                                    onClick={() => setSelectedLeave(isActive ? null : leave)}
                                    className={`transition-colors group cursor-pointer border-l-2 ${isActive ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-l-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border-l-transparent'}`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-sm text-slate-800 dark:text-github-dark-text">{leave.policy_name || leave.leave_type || 'Leave'}</span>
                                            {leave.leave_type && leave.policy_name && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{leave.leave_type}</span>
                                            )}
                                            {leave.leave_code && (
                                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 w-fit">{leave.leave_code}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${statusColor.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`}></span>
                                            {leave.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{calculateDays(leave.start_date, leave.end_date)} Days</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                                {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-[200px]">
                                        <p className="text-sm text-slate-600 dark:text-github-dark-muted truncate font-normal" title={leave.reason}>{leave.reason}</p>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 font-normal">
                                        {new Date(leave.applied_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className={`text-[9px] font-medium transition-opacity ${isActive ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-60 text-slate-400'}`}>View Details →</span>
                                            {leave.status === 'pending' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleWithdraw(leave.lr_id); }}
                                                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    title="Withdraw Request"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LeaveHistoryTable;
