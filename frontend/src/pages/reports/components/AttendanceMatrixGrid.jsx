import React from 'react';
import { User, Table } from 'lucide-react';
import { getStatusColor, getStatusLabel } from './reportsUtils';

const AttendanceMatrixGrid = ({
    loadingPreview,
    matrixData,
    onCellHover,
    onCellLeave,
    onRecordClick
}) => {
    if (loadingPreview) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm font-medium">Crunching and parsing preview records...</p>
            </div>
        );
    }

    if (!matrixData.employees || matrixData.employees.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-dark-card border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm">
                <Table className="text-slate-200 dark:text-slate-700" size={48} />
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No preview records loaded for this filter.</p>
            </div>
        );
    }

    return (
        <div
            className="w-full overflow-auto table-scrollbar rounded-xl border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card shadow-sm animate-none"
            style={{ isolation: 'isolate', maxHeight: 'calc(100vh - 120px)' }}
        >
            <table className="w-full text-left border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 min-w-[230px] border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.10)' }}>
                            Employee
                        </th>
                        {matrixData.dates.map(rawDate => {
                            const d = new Date(rawDate + 'T00:00:00Z');
                            return (
                                <th key={rawDate} className="py-2 px-1 text-center min-w-[52px]">
                                    <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                    <div className="text-sm font-black text-slate-700 dark:text-white leading-tight">{d.getUTCDate()}</div>
                                    <div className="text-[8px] uppercase text-slate-400 leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                </th>
                            );
                        })}
                        <th className="py-2 px-2 text-center min-w-[50px] border-l border-slate-200 dark:border-github-dark-border bg-emerald-50/50 dark:bg-emerald-950/20">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 leading-tight">P</div>
                        </th>
                        <th className="py-2 px-2 text-center min-w-[50px] bg-rose-50/50 dark:bg-rose-950/20">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-rose-700 dark:text-rose-400 leading-tight">A</div>
                        </th>
                        <th className="py-2 px-2 text-center min-w-[50px] bg-sky-50/50 dark:bg-sky-950/20">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-sky-700 dark:text-sky-400 leading-tight">L</div>
                        </th>
                        <th className="py-2 px-2 text-center min-w-[50px] bg-indigo-50/50 dark:bg-indigo-950/20">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-indigo-700 dark:text-indigo-400 leading-tight">HD</div>
                        </th>
                        <th className="py-2 px-2 text-center min-w-[50px] bg-slate-100/50 dark:bg-slate-800/40">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-slate-600 dark:text-slate-400 leading-tight">WO</div>
                        </th>
                        <th className="py-2 px-2 text-center min-w-[60px] bg-purple-50/50 dark:bg-purple-950/20">
                            <div className="text-[8px] uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider">Total</div>
                            <div className="text-sm font-black text-purple-700 dark:text-purple-400 leading-tight">OT (h)</div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border">
                    {matrixData.employees.map((emp) => {
                        const initials = emp.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                            <tr key={emp.user_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors group">
                                <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors z-10 border-r border-slate-200 dark:border-github-dark-border" style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.08)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                                            {initials || <User size={14} />}
                                        </div>
                                        <div>
                                            <span className="block font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{emp.user_name}</span>
                                            <span className="block text-[10px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5">{emp.designation} · {emp.department}</span>
                                        </div>
                                    </div>
                                </td>
                                {matrixData.dates.map(rawDate => {
                                    const record = emp.records[rawDate];
                                    const status = record?.status || '-';
                                    const isNonClickableStatus = ['Sun', 'Sat', 'WEEK_OFF', 'Not Recorded', '-'].includes(status);
                                    const isClickable = !!record && !isNonClickableStatus;
                                    return (
                                        <td key={rawDate} className="px-1 py-3 text-center">
                                            <button
                                                type="button"
                                                onMouseEnter={(e) => onCellHover && onCellHover(e, record)}
                                                onMouseLeave={onCellLeave}
                                                onClick={() => {
                                                    if (isClickable && onRecordClick) {
                                                        onRecordClick(record);
                                                    }
                                                }}
                                                title={!record ? 'No data' : undefined}
                                                className={`w-9 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${getStatusColor(status)} ${isClickable ? 'cursor-pointer hover:brightness-95 hover:shadow-md active:scale-95' : 'cursor-default'}`}
                                            >
                                                {getStatusLabel(status)}
                                            </button>
                                        </td>
                                    );
                                })}
                                <td className="px-2 py-3 text-center border-l border-slate-200 dark:border-github-dark-border bg-emerald-50/20 dark:bg-emerald-950/10 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                    {emp.stats?.present || 0}
                                </td>
                                <td className="px-2 py-3 text-center bg-rose-50/20 dark:bg-rose-950/10 font-bold text-xs text-rose-700 dark:text-rose-400">
                                    {emp.stats?.absent || 0}
                                </td>
                                <td className="px-2 py-3 text-center bg-sky-50/20 dark:bg-sky-950/10 font-bold text-xs text-sky-700 dark:text-sky-400">
                                    {emp.stats?.leave || 0}
                                </td>
                                <td className="px-2 py-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-bold text-xs text-indigo-700 dark:text-indigo-400">
                                    {emp.stats?.halfDay || 0}
                                </td>
                                <td className="px-2 py-3 text-center bg-slate-50 dark:bg-slate-800/20 font-bold text-xs text-slate-500 dark:text-slate-400">
                                    {emp.stats?.weeklyOff || 0}
                                </td>
                                <td className="px-2 py-3 text-center bg-purple-50/20 dark:bg-purple-950/10 font-bold text-xs text-purple-700 dark:text-purple-400">
                                    {emp.stats?.overtimeHrs ? emp.stats.overtimeHrs.toFixed(1) : '0.0'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default AttendanceMatrixGrid;
