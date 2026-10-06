import React, { useMemo, useRef, useState } from 'react';
import { User, Table } from 'lucide-react';
import { getStatusColor, getStatusLabel, getStatusFullForm } from './reportsUtils';
import { SummaryToggleIcon } from './SummaryToggleIcon';

const TOTAL_SUMMARY_COLUMNS = [
    { key: 'present', label: 'P', fullLabel: 'Present', width: 48, textCol: 'text-emerald-700 dark:text-emerald-400', bgCol: 'bg-emerald-50 dark:bg-[#064e3b]', getValue: (emp) => emp.stats?.present || 0 },
    { key: 'absent', label: 'A', fullLabel: 'Absent', width: 45, textCol: 'text-rose-700 dark:text-rose-400', bgCol: 'bg-rose-50 dark:bg-[#4c0519]', getValue: (emp) => emp.stats?.absent || 0 },
    { key: 'missedPunch', label: 'MP', fullLabel: 'Missed Punch', width: 45, textCol: 'text-amber-700 dark:text-amber-400', bgCol: 'bg-amber-50 dark:bg-[#451a03]', getValue: (emp) => emp.stats?.missedPunch || 0 },
    { key: 'leave', label: 'L', fullLabel: 'Leave', width: 45, textCol: 'text-sky-700 dark:text-sky-400', bgCol: 'bg-sky-50 dark:bg-[#082f49]', getValue: (emp) => emp.stats?.leave || 0 },
    { key: 'halfDay', label: 'HD', fullLabel: 'Half Day', width: 45, textCol: 'text-indigo-700 dark:text-indigo-400', bgCol: 'bg-indigo-50 dark:bg-[#1e1b4b]', getValue: (emp) => emp.stats?.halfDay || 0 },
    { key: 'weeklyOff', label: 'WO', fullLabel: 'Weekly Off', width: 45, textCol: 'text-slate-600 dark:text-slate-400', bgCol: 'bg-slate-100 dark:bg-[#1e293b]', getValue: (emp) => emp.stats?.weeklyOff || 0 },
    { key: 'overtime', label: 'OT (h)', fullLabel: 'Overtime (Hours)', width: 55, textCol: 'text-purple-700 dark:text-purple-400', bgCol: 'bg-purple-50 dark:bg-[#3b0764]', getValue: (emp) => emp.stats?.overtimeHrs ? (typeof emp.stats.overtimeHrs === 'number' ? emp.stats.overtimeHrs.toFixed(1) : emp.stats.overtimeHrs) : '0.0' },
];

const AttendanceMatrixGrid = ({
    loadingPreview,
    matrixData,
    onCellHover,
    onCellLeave,
    onRecordClick,
    isAllTotalsSticky = false,
    onToggleAllTotalsSticky
}) => {
    const tableContainerRef = useRef(null);
    const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);

    // Track horizontal scroll position:
    // When distance from right edge is <= 236px, the user has dragged into the summary block.
    // P & A seamlessly drag at the end after the calendar before the other summary columns!
    const handleScroll = (e) => {
        const { scrollLeft, scrollWidth, clientWidth } = e.target;
        const distFromRight = scrollWidth - (scrollLeft + clientWidth);
        const nearEnd = distFromRight <= 236;
        if (nearEnd !== isScrolledToEnd) {
            setIsScrolledToEnd(nearEnd);
        }
    };

    const summaryColumns = useMemo(() => {
        const isAllSticky = isAllTotalsSticky;
        const isPaSticky = !isAllTotalsSticky && !isScrolledToEnd;

        return TOTAL_SUMMARY_COLUMNS.map((col, index) => {
            const isFirst = index === 0;
            const isLast = index === TOTAL_SUMMARY_COLUMNS.length - 1;

            let isSticky = false;
            let right = 0;
            let isStickyFirst = false;

            if (isAllSticky) {
                isSticky = true;
                right = TOTAL_SUMMARY_COLUMNS.slice(index + 1).reduce((acc, c) => acc + c.width, 0);
                isStickyFirst = index === 0; // P
            } else if (isPaSticky) {
                if (col.key === 'present') {
                    isSticky = true;
                    right = 45; // A's width is 45
                    isStickyFirst = true; // P is first sticky
                } else if (col.key === 'absent') {
                    isSticky = true;
                    right = 0;
                    isStickyFirst = false;
                }
            }

            return {
                ...col,
                isFirst,
                isLast,
                isSticky,
                right,
                isStickyFirst
            };
        });
    }, [isAllTotalsSticky, isScrolledToEnd]);

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
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="w-full overflow-auto table-scrollbar rounded-xl border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card shadow-sm animate-none"
            style={{ isolation: 'isolate', maxHeight: 'calc(100vh - 120px)' }}
        >
            <table className="w-full text-left border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border">
                        {/* 1. Stationary Left: Employee Header */}
                        <th
                            className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-github-dark-muted sticky left-0 bg-slate-50 dark:bg-[#161b22] z-40 w-[210px] min-w-[210px] max-w-[210px] border-r-2 border-slate-300 dark:border-github-dark-border"
                            style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.12)' }}
                        >
                            <div className="flex items-center justify-between">
                                <span>Employee</span>
                                {onToggleAllTotalsSticky && (
                                    <button
                                        type="button"
                                        onClick={onToggleAllTotalsSticky}
                                        className="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                        title={
                                            isAllTotalsSticky
                                                ? "All totals stationary: Click to make other summary columns draggable at end"
                                                : "P & A sticky: Click to make all totals stationary on right"
                                        }
                                    >
                                        <SummaryToggleIcon size={14} className={isAllTotalsSticky ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                                    </button>
                                )}
                            </div>
                        </th>

                        {/* 2. Scrollable Middle: Calendar Date Columns */}
                        {matrixData.dates.map(rawDate => {
                            const d = new Date(rawDate + 'T00:00:00Z');
                            const fullDateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                            return (
                                <th key={rawDate} className="py-2 px-1 text-center min-w-[52px]" title={fullDateStr}>
                                    <div className="text-[9px] uppercase text-slate-400 font-normal leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight my-0.5">{d.getUTCDate()}</div>
                                    <div className="text-[9px] uppercase text-slate-400 font-normal leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                </th>
                            );
                        })}

                        {/* 3. Summary Header Columns: Present -> Absent -> Missed Punch -> Leave -> Half Day -> Weekly Off -> Overtime */}
                        {/* Always after calendar, with P & A right before the other summary columns */}
                        {summaryColumns.map((col) => {
                            const isSticky = col.isSticky;
                            return (
                                <th
                                    key={col.key}
                                    className={`py-2 px-1 text-center relative ${
                                        isSticky ? 'sticky z-40' : ''
                                    } ${
                                        col.isFirst
                                            ? 'border-l-2 border-slate-300 dark:border-github-dark-border border-r border-slate-200 dark:border-github-dark-border'
                                            : 'border-r border-slate-200 dark:border-github-dark-border'
                                    } ${col.bgCol} select-none cursor-help`}
                                    style={{
                                        width: col.width,
                                        minWidth: col.width,
                                        maxWidth: col.width,
                                        ...(isSticky ? { right: col.right } : {}),
                                        ...(isSticky && col.isStickyFirst ? { boxShadow: '-4px 0 8px rgba(0,0,0,0.12)' } : {})
                                    }}
                                    title={`${col.fullLabel} (${col.label}) - Total Summary`}
                                >
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-[8px] font-normal uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider text-center">
                                            Total
                                        </span>
                                        <div
                                            className={`text-xs font-semibold ${col.textCol} leading-tight mt-0.5 text-center`}
                                            title={`${col.fullLabel} (${col.label})`}
                                        >
                                            {col.label}
                                        </div>
                                    </div>
                                    {col.isFirst && onToggleAllTotalsSticky && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleAllTotalsSticky();
                                            }}
                                            className="absolute top-1 right-0.5 p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                            title={
                                                isAllTotalsSticky
                                                    ? "All totals stationary: Click to make other summary columns draggable at end"
                                                    : "P & A sticky: Click to make all totals stationary on right"
                                            }
                                        >
                                            <SummaryToggleIcon size={11} className={isAllTotalsSticky ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                                        </button>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-github-dark-border">
                    {matrixData.employees.map((emp) => {
                        const initials = emp.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                            <tr key={emp.user_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors group">
                                {/* 1. Stationary Left: Employee Info */}
                                <td
                                    className="px-5 py-3.5 sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors z-20 w-[210px] min-w-[210px] max-w-[210px] border-r-2 border-slate-300 dark:border-github-dark-border"
                                    style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.10)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-medium text-xs shadow-inner shrink-0">
                                            {initials || <User size={14} />}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block font-semibold text-slate-800 dark:text-github-dark-text text-sm leading-tight truncate">{emp.user_name || emp.name || 'Unknown'}</span>
                                            <span className="block text-[10px] font-normal text-slate-500 dark:text-github-dark-muted mt-0.5 truncate">{emp.designation} · {emp.department}</span>
                                        </div>
                                    </div>
                                </td>

                                {/* 2. Scrollable Middle: Calendar Date Cells */}
                                {matrixData.dates.map(rawDate => {
                                    const record = emp?.records?.[rawDate] || emp?.attendance?.[rawDate];
                                    const status = record?.status || '-';
                                    const isNonClickableStatus = ['Sun', 'Sat', 'WEEK_OFF', 'Week Off', 'Holiday', 'HOLIDAY', 'Not Recorded', '-'].includes(status);
                                    const isClickable = !!record && !isNonClickableStatus;
                                    const fullForm = getStatusFullForm(status);
                                    const shortLabel = getStatusLabel(status);

                                    return (
                                        <td key={rawDate} className="px-1 py-3 text-center">
                                            {status === '-' || status === 'Not Recorded' ? (
                                                <span className="w-9 h-9 inline-flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs font-semibold select-none cursor-default">
                                                    -
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onMouseEnter={(e) => onCellHover && onCellHover(e, record)}
                                                    onMouseLeave={onCellLeave}
                                                    onClick={() => {
                                                        if (isClickable && onRecordClick) {
                                                            onRecordClick(record);
                                                        }
                                                    }}
                                                    title={`${fullForm} (${shortLabel})`}
                                                    className={`w-9 h-9 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-xs ${getStatusColor(status)} ${isClickable ? 'cursor-pointer hover:brightness-95 hover:shadow-md active:scale-95' : 'cursor-default'}`}
                                                >
                                                    {shortLabel}
                                                </button>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* 3. Summary Body Cells: Present -> Absent -> Missed Punch -> Leave -> Half Day -> Weekly Off -> Overtime */}
                                {summaryColumns.map((col) => {
                                    const isSticky = col.isSticky;
                                    return (
                                        <td
                                            key={col.key}
                                            className={`px-1 py-3 text-center ${
                                                isSticky ? 'sticky z-20' : ''
                                            } ${
                                                col.isFirst
                                                    ? 'border-l-2 border-slate-300 dark:border-github-dark-border border-r border-slate-100 dark:border-github-dark-border'
                                                    : 'border-r border-slate-100 dark:border-github-dark-border'
                                            } bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-[#1c2128] transition-colors font-medium text-xs ${col.textCol}`}
                                            style={{
                                                width: col.width,
                                                minWidth: col.width,
                                                maxWidth: col.width,
                                                ...(isSticky ? { right: col.right } : {}),
                                                ...(isSticky && col.isStickyFirst ? { boxShadow: '-4px 0 8px rgba(0,0,0,0.10)' } : {})
                                            }}
                                            title={`${emp.user_name}: ${col.getValue(emp)} ${col.fullLabel}`}
                                        >
                                            {col.getValue(emp)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default AttendanceMatrixGrid;
