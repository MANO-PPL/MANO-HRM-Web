import React, { useMemo, useRef, useState } from 'react';
import { User, Table } from 'lucide-react';
import { getStatusColor, getStatusLabel, getStatusFullForm } from './reportsUtils';
import { SummaryToggleIcon } from './SummaryToggleIcon';
import { formatPlatformDate } from '../../../utils/dateUtils';
import HoverCard from '../../../components/HoverCard';

const TOTAL_SUMMARY_COLUMNS = [
    {
        key: 'present',
        label: 'P',
        fullLabel: 'Present',
        description: 'Total days employee attended work',
        width: 48,
        textCol: 'text-emerald-700 dark:text-emerald-400',
        bgCol: 'bg-emerald-50 dark:bg-[#064e3b]',
        hoverBgCol: 'hover:bg-emerald-100 dark:hover:bg-[#065f46]',
        borderAccent: 'border-t-emerald-500',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        getValue: (emp) => emp.stats?.present || 0,
    },
    {
        key: 'absent',
        label: 'A',
        fullLabel: 'Absent',
        description: 'Total days marked absent',
        width: 45,
        textCol: 'text-rose-700 dark:text-rose-400',
        bgCol: 'bg-rose-50 dark:bg-[#4c0519]',
        hoverBgCol: 'hover:bg-rose-100 dark:hover:bg-[#5c0b20]',
        borderAccent: 'border-t-rose-500',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        getValue: (emp) => emp.stats?.absent || 0,
    },
    {
        key: 'late',
        label: 'LT',
        fullLabel: 'Late',
        description: 'Days with late arrival / punch-in',
        width: 45,
        textCol: 'text-orange-700 dark:text-orange-400',
        bgCol: 'bg-orange-50 dark:bg-[#431407]',
        hoverBgCol: 'hover:bg-orange-100 dark:hover:bg-[#5c1c0a]',
        borderAccent: 'border-t-orange-500',
        badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        getValue: (emp) => emp.stats?.late || 0,
    },
    {
        key: 'missedPunch',
        label: 'MP',
        fullLabel: 'Missed Punch',
        description: 'Single punch recorded without checkout',
        width: 45,
        textCol: 'text-amber-700 dark:text-amber-400',
        bgCol: 'bg-amber-50 dark:bg-[#451a03]',
        hoverBgCol: 'hover:bg-amber-100 dark:hover:bg-[#5a2404]',
        borderAccent: 'border-t-amber-500',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        getValue: (emp) => emp.stats?.missedPunch || 0,
    },
    {
        key: 'leave',
        label: 'L',
        fullLabel: 'Leave',
        description: 'Approved paid and unpaid leaves',
        width: 45,
        textCol: 'text-sky-700 dark:text-sky-400',
        bgCol: 'bg-sky-50 dark:bg-[#082f49]',
        hoverBgCol: 'hover:bg-sky-100 dark:hover:bg-[#0c4a6e]',
        borderAccent: 'border-t-sky-500',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        getValue: (emp) => emp.stats?.leave || 0,
    },
    {
        key: 'halfDay',
        label: 'HD',
        fullLabel: 'Half Day',
        description: 'Recorded half-day attendance shift',
        width: 45,
        textCol: 'text-indigo-700 dark:text-indigo-400',
        bgCol: 'bg-indigo-50 dark:bg-[#1e1b4b]',
        hoverBgCol: 'hover:bg-indigo-100 dark:hover:bg-[#2e266d]',
        borderAccent: 'border-t-indigo-500',
        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        getValue: (emp) => emp.stats?.halfDay || 0,
    },
    {
        key: 'weeklyOff',
        label: 'WO',
        fullLabel: 'Weekly Off',
        description: 'Scheduled weekly off / rest days',
        width: 45,
        textCol: 'text-slate-600 dark:text-slate-400',
        bgCol: 'bg-slate-100 dark:bg-[#1e293b]',
        hoverBgCol: 'hover:bg-slate-200 dark:hover:bg-[#334155]',
        borderAccent: 'border-t-slate-400',
        badge: 'bg-slate-700/50 text-slate-300 border-slate-600',
        getValue: (emp) => emp.stats?.weeklyOff || 0,
    },
    {
        key: 'overtime',
        label: 'OT (h)',
        fullLabel: 'Overtime (Hours)',
        description: 'Total cumulative overtime duration in hours',
        width: 55,
        textCol: 'text-purple-700 dark:text-purple-400',
        bgCol: 'bg-purple-50 dark:bg-[#3b0764]',
        hoverBgCol: 'hover:bg-purple-100 dark:hover:bg-[#4a0a7e]',
        borderAccent: 'border-t-purple-500',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        getValue: (emp) => emp.stats?.overtimeHrs ? (typeof emp.stats.overtimeHrs === 'number' ? emp.stats.overtimeHrs.toFixed(1) : emp.stats.overtimeHrs) : '0.0',
    },
];

const AttendanceMatrixGrid = ({
    loadingPreview,
    matrixData,
    onCellHover,
    onCellLeave,
    onRecordClick,
    isAllTotalsSticky = false,
    pinnedSummaryKeys = ['present', 'absent'],
    onToggleAllTotalsSticky = () => {}
}) => {
    const tableContainerRef = useRef(null);
    const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);

    // Filtered summary columns: ONLY show columns selected in the filter!
    // Unselected columns are completely hidden (neither pinned nor draggable).
    const visibleCols = useMemo(() => {
        const filterSet = new Set(pinnedSummaryKeys);
        return TOTAL_SUMMARY_COLUMNS.filter(c => filterSet.has(c.key));
    }, [pinnedSummaryKeys]);

    // Draggable columns in DEFAULT mode are filtered columns other than Present & Absent
    const draggableCols = useMemo(() => {
        return visibleCols.filter(c => c.key !== 'present' && c.key !== 'absent');
    }, [visibleCols]);

    const draggableWidth = useMemo(() => {
        return draggableCols.reduce((sum, c) => sum + c.width, 0);
    }, [draggableCols]);

    // Horizontal scroll listener for DEFAULT mode when draggable filtered columns exist:
    // P & A seamlessly drag at the end before the draggable summary columns
    const handleScroll = (e) => {
        if (isAllTotalsSticky || draggableWidth === 0) {
            if (isScrolledToEnd) setIsScrolledToEnd(false);
            return;
        }
        const { scrollLeft, scrollWidth, clientWidth } = e.target;
        const distFromRight = scrollWidth - (scrollLeft + clientWidth);
        const nearEnd = distFromRight <= draggableWidth + 2;
        if (nearEnd !== isScrolledToEnd) {
            setIsScrolledToEnd(nearEnd);
        }
    };

    const summaryColumns = useMemo(() => {
        // In PINNED mode: all visible/filtered columns are pinned stationary on right.
        // In DEFAULT mode: only Present and Absent are pinned on right (unless scrolled to end when draggable columns exist).
        // Other filtered columns are draggable (not sticky).
        const isPaSticky = !isAllTotalsSticky && !isScrolledToEnd;

        const firstStickyIdx = visibleCols.findIndex(col => {
            if (isAllTotalsSticky) return true;
            if (isPaSticky && (col.key === 'present' || col.key === 'absent')) return true;
            return false;
        });

        return visibleCols.map((col, index) => {
            const isFirst = index === 0;
            const isLast = index === visibleCols.length - 1;

            let isSticky = false;
            let right = 0;

            if (isAllTotalsSticky) {
                isSticky = true;
                // Sum widths of visible columns after this one
                right = visibleCols
                    .slice(index + 1)
                    .reduce((sum, c) => sum + c.width, 0);
            } else if (isPaSticky) {
                if (col.key === 'present') {
                    isSticky = true;
                    // If absent is also visible, P is to the left of A (offset by A's width)
                    const absentCol = visibleCols.find(c => c.key === 'absent');
                    right = absentCol ? absentCol.width : 0;
                } else if (col.key === 'absent') {
                    isSticky = true;
                    right = 0;
                }
            }

            const isStickyFirst = isSticky && index === firstStickyIdx;

            return {
                ...col,
                isFirst,
                isLast,
                isSticky,
                right,
                isStickyFirst
            };
        });
    }, [visibleCols, isAllTotalsSticky, isScrolledToEnd]);

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
                                                ? "All totals pinned: Click to switch to default summary columns"
                                                : "Default summary columns: Click to pin all total summary columns"
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
                            const fullDateStr = formatPlatformDate(rawDate);
                            return (
                                <th key={rawDate} className="py-2 px-1 text-center min-w-[52px]" title={fullDateStr}>
                                    <div className="text-[9px] uppercase text-slate-400 font-normal leading-none tracking-wider">{d.toLocaleString('en-US', { month: 'short' })}</div>
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight my-0.5">{d.getUTCDate()}</div>
                                    <div className="text-[9px] uppercase text-slate-400 font-normal leading-none tracking-wider">{d.toLocaleString('en-US', { weekday: 'short' })}</div>
                                </th>
                            );
                        })}

                        {/* 3. Summary Header Columns: Present -> Absent -> Late -> Missed Punch -> Leave -> Half Day -> Weekly Off -> Overtime */}
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
                                    } ${col.bgCol} ${col.hoverBgCol} transition-colors select-none`}
                                    style={{
                                        width: col.width,
                                        minWidth: col.width,
                                        maxWidth: col.width,
                                        ...(isSticky ? { right: col.right } : {}),
                                        ...(isSticky && col.isStickyFirst ? { boxShadow: '-4px 0 8px rgba(0,0,0,0.12)' } : {})
                                    }}
                                >
                                    <HoverCard
                                        side="bottom"
                                        align="center"
                                        openDelay={100}
                                        closeDelay={150}
                                        containerClassName="w-full h-full flex flex-col items-center justify-center cursor-help"
                                        className={`w-52 p-3 rounded-xl shadow-2xl border-t-2 ${col.borderAccent} bg-slate-900/95 dark:bg-[#161b22]/95 backdrop-blur-md text-white border border-slate-800 dark:border-[#30363d]`}
                                        content={
                                            <div className="space-y-1.5 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-semibold text-xs text-slate-100">
                                                        {col.fullLabel}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${col.badge}`}>
                                                        {col.label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-snug">
                                                    {col.description}
                                                </p>
                                            </div>
                                        }
                                    >
                                        <div className="flex flex-col items-center justify-center py-0.5 pointer-events-none">
                                            <span className="text-[8px] font-normal uppercase text-slate-400 dark:text-github-dark-muted leading-none tracking-wider text-center">
                                                Total
                                            </span>
                                            <div
                                                className={`text-xs font-semibold ${col.textCol} leading-tight mt-0.5 text-center`}
                                            >
                                                {col.label}
                                            </div>
                                        </div>
                                    </HoverCard>
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
