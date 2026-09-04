import React, { useState } from 'react';
import { User, ChevronDown, MapPin } from 'lucide-react';
import { isDateColumn } from './reportsUtils';

export const getEmployeeCardData = (row, columns) => {
    let name = 'Unknown Employee';
    let dept = '';
    let designation = '';
    let status = '';
    const metrics = [];
    const dates = [];

    columns.forEach((col, idx) => {
        const val = row[idx]?.toString() || '';
        const colStr = col?.toString() || '';
        const colLower = colStr.toLowerCase();

        if (colLower === 'sr no.' || colLower === 'sr. no.') {
            return;
        }

        if (colLower === 'name' || colLower === 'employee') {
            name = val;
        } else if (colLower === 'department' || colLower === 'dept') {
            dept = val;
        } else if (colLower === 'position' || colLower === 'designation' || colLower === 'role') {
            designation = val;
        } else if (colLower === 'status' || colLower === 'attendance') {
            status = val;
        } else if (isDateColumn(colStr)) {
            dates.push({ label: colStr, value: val });
        } else {
            metrics.push({ label: colStr, value: val });
        }
    });

    return { name, dept, designation, status, metrics, dates };
};

export const groupDatesByPrefix = (dates) => {
    const groups = {};
    dates.forEach(d => {
        const parts = d.label.split('\n');
        const prefix = parts[0];
        const label = parts[1] || 'Status';
        if (!groups[prefix]) {
            groups[prefix] = {};
        }
        groups[prefix][label] = d.value;
    });
    return groups;
};

const EmployeeReportCard = ({ row, columns }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { name, dept, designation, status, metrics, dates } = getEmployeeCardData(row, columns);
    const dateGroups = groupDatesByPrefix(dates);
    const keys = Object.keys(dateGroups);
    const isTimelineOnly = keys.every(k => Object.keys(dateGroups[k]).length === 1 && Object.keys(dateGroups[k])[0] === 'Status');

    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    let statusColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    if (status.includes('Present') || status === '1.0') {
        statusColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
    } else if (status.includes('Absent') || status === '0.0') {
        statusColor = 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400';
    } else if (status.toLowerCase().includes('late')) {
        statusColor = 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400';
    } else if (status.toLowerCase() === 'on leave' || status.toLowerCase() === 'leave' || status.toLowerCase() === 'half day') {
        statusColor = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400';
    }

    return (
        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm shadow-inner shrink-0">
                        {initials || <User size={16} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">{name}</h4>
                        <p className="text-[11px] font-medium text-slate-400 dark:text-github-dark-muted mt-0.5">
                            {designation ? `${designation} • ` : ''}{dept}
                        </p>
                    </div>
                </div>
                {status && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                        {status}
                    </span>
                )}
            </div>

            {metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-github-dark-bg/60 p-3 rounded-xl">
                    {metrics.map((m, idx) => (
                        <div key={idx} className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted block">
                                {m.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-github-dark-text block truncate" title={m.value}>
                                {m.value || 'N/A'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {keys.length > 0 && isTimelineOnly && (
                <div className="pt-1">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-github-dark-muted mb-2 px-1">
                        Attendance Timeline
                    </h5>
                    <div className="flex flex-wrap gap-1 bg-slate-50/50 dark:bg-black/10 p-2 rounded-xl">
                        {keys.map((dateKey) => {
                            const info = dateGroups[dateKey];
                            const statusVal = info.Status || '';
                            const dayMatch = dateKey.match(/^\d+/);
                            const dayDisplay = dayMatch ? dayMatch[0] : dateKey;

                            let colorClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700';
                            if (statusVal === '1.0' || statusVal === 'Present') {
                                colorClass = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                            } else if (statusVal === '0.0' || statusVal === 'Absent') {
                                colorClass = 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-500/20';
                            } else if (statusVal.toLowerCase().includes('late')) {
                                colorClass = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                            } else if (statusVal.toLowerCase() === 'on leave' || statusVal.toLowerCase() === 'leave' || statusVal.toLowerCase() === 'half day') {
                                colorClass = 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
                            } else if (statusVal === 'Sun' || statusVal === 'Sat' || statusVal === 'WEEK_OFF') {
                                colorClass = 'bg-slate-100 dark:bg-slate-800/45 text-slate-400 border border-slate-200 dark:border-slate-700/50';
                            } else if (statusVal === 'Not Recorded') {
                                colorClass = 'bg-slate-100/50 dark:bg-slate-800/20 text-slate-400/60 border border-slate-200/50 dark:border-slate-700/30 opacity-60';
                            }

                            return (
                                <div
                                    key={dateKey}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-help transition-all hover:scale-105 shadow-sm ${colorClass}`}
                                    title={`${dateKey}: ${statusVal}`}
                                >
                                    {dayDisplay}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {keys.length > 0 && !isTimelineOnly && (
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full py-2 px-3 border border-slate-200 dark:border-github-dark-border hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                    >
                        <span>{isExpanded ? 'Hide Daily Details' : 'View Daily Details'}</span>
                        <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                        <div className="mt-3.5 space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar border-t border-slate-100 dark:border-github-dark-border pt-3">
                            {keys.map((dateKey) => {
                                const info = dateGroups[dateKey];
                                const hasPunch = info['In Time'] && info['In Time'] !== '-';

                                return (
                                    <div key={dateKey} className="bg-slate-50 dark:bg-[#161b22] border border-slate-100 dark:border-[#30363d] p-3 rounded-xl space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{dateKey}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${hasPunch
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                {hasPunch ? 'Clocked In' : 'No Punch'}
                                            </span>
                                        </div>
                                        {hasPunch ? (
                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div>
                                                    <span className="text-slate-400 font-medium block">In / Out:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text block">
                                                        {info['In Time']} → {info['Out Time'] || 'In Progress'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 font-medium block">Worked / Req:</span>
                                                    <span className="font-semibold text-slate-700 dark:text-github-dark-text block">
                                                        {info['Work Hrs'] || '0'} / {info['Req Hrs'] || '0'} hrs
                                                    </span>
                                                </div>
                                                {info['Late Mins'] && info['Late Mins'] !== '0' && (
                                                    <div className="col-span-2">
                                                        <span className="text-amber-500 font-semibold">
                                                            Late: {info['Late Mins']} mins
                                                        </span>
                                                    </div>
                                                )}
                                                {(info['In Location'] || info['Out Location']) && (
                                                    <div className="col-span-2 text-slate-500 dark:text-github-dark-muted flex items-start gap-1">
                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-slate-400" />
                                                        <span className="truncate">
                                                            {info['In Location'] || 'N/A'} (In) / {info['Out Location'] || 'N/A'} (Out)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic">
                                                Non-working day or absent
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmployeeReportCard;
