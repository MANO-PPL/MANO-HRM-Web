import React from 'react';
import { History } from 'lucide-react';

const PayrollAuditTab = ({
    loadingAudit,
    filteredAuditLogs
}) => {
    if (loadingAudit) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 border-3 border-indigo-150 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Loading detailed audit trails...</p>
            </div>
        );
    }

    if (filteredAuditLogs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <History className="text-slate-200 dark:text-slate-700" size={48} />
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">No audit trail records found for this period.</p>
            </div>
        );
    }

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Timestamp</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted text-center">Action</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Performed By</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Employee</th>
                    <th className="px-5 py-3 text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Details</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-github-dark-border text-xs font-normal text-slate-700 dark:text-[#c9d1d9]">
                {filteredAuditLogs.map((log) => {
                    const actionColors = {
                        'PACKAGE_CREATE': 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
                        'PACKAGE_REVISION_CREATE': 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400',
                        'PACKAGE_UPDATE': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/20 dark:text-fuchsia-400',
                        'PACKAGE_DELETE': 'bg-rose-100 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400',
                        'PACKAGE_ASSIGN': 'bg-blue-100 text-blue-700 dark:bg-blue-955/20 dark:text-blue-400',
                        'PACKAGE_UNASSIGN': 'bg-orange-100 text-orange-700 dark:bg-orange-955/20 dark:text-orange-400',
                        'LOCK': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-955/20 dark:text-indigo-400',
                        'UNLOCK': 'bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400',
                        'ADJUSTMENT_UPDATE': 'bg-sky-100 text-sky-700 dark:bg-sky-955/20 dark:text-sky-400',
                        'PAY': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-955/20 dark:text-emerald-400'
                    };
                    const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
                    return (
                        <tr key={log.log_id} className="hover:bg-slate-50/50 dark:hover:bg-github-dark-subtle/5 transition-colors">
                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 dark:text-github-dark-muted font-normal text-[11px]">
                                {new Date(log.created_at).toLocaleString('en-IN', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true
                                })}
                            </td>
                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider ${colorClass}`}>
                                    {log.action}
                                </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-normal text-slate-700 dark:text-github-dark-text">{log.performed_by_name}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800 dark:text-github-dark-text">{log.employee_name || 'All Employees'}</td>
                            <td className="px-5 py-3.5 font-normal text-slate-500 dark:text-github-dark-muted">{log.details}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default PayrollAuditTab;
