import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    ChevronDown,
    AlertCircle
} from 'lucide-react';

const AttendanceHistoryTab = ({
    handlePrevMonth,
    handleNextMonth,
    handleCurrentMonth,
    reportYear,
    reportMonthIdx,
    monthlySessions = [],
    groupedHistoryWeeks = [],
    expandedDays,
    toggleDayExpansion,
    getStatusStyle,
    formatTime,
    calculateDuration,
    setPreviewImage,
    myShift
}) => {
    const isCurrentMonthSelected = reportYear === new Date().getFullYear() && reportMonthIdx === new Date().getMonth();
    const monthDateObj = new Date(reportYear, reportMonthIdx, 1);
    const monthYearLabel = monthDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Status Filter State
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT'

    // Flatten all unique recorded days
    const allDays = useMemo(() => {
        const list = [];
        groupedHistoryWeeks.forEach(([_, days]) => {
            list.push(...days);
        });
        return list;
    }, [groupedHistoryWeeks]);

    // Statistics
    const totalRecordedDays = allDays.length;
    const presentDays = useMemo(() => {
        return allDays.filter(d => ['PRESENT', 'ON_TIME'].includes((d.dayStatus || '').toUpperCase())).length;
    }, [allDays]);

    const lateDays = useMemo(() => {
        return allDays.filter(d => (d.dayStatus || '').toUpperCase() === 'LATE').length;
    }, [allDays]);

    const halfDays = useMemo(() => {
        return allDays.filter(d => (d.dayStatus || '').toUpperCase() === 'HALF_DAY').length;
    }, [allDays]);

    const absentDays = useMemo(() => {
        return allDays.filter(d => (d.dayStatus || '').toUpperCase() === 'ABSENT').length;
    }, [allDays]);

    // Filtered weeks
    const filteredWeeks = useMemo(() => {
        if (statusFilter === 'ALL') return groupedHistoryWeeks;

        return groupedHistoryWeeks
            .map(([week, days]) => {
                const matchingDays = days.filter(d => {
                    const st = (d.dayStatus || '').toUpperCase();
                    if (statusFilter === 'PRESENT') return ['PRESENT', 'ON_TIME'].includes(st);
                    if (statusFilter === 'LATE') return st === 'LATE';
                    if (statusFilter === 'HALF_DAY') return st === 'HALF_DAY';
                    if (statusFilter === 'ABSENT') return st === 'ABSENT';
                    return true;
                });
                return [week, matchingDays];
            })
            .filter(([_, days]) => days.length > 0);
    }, [groupedHistoryWeeks, statusFilter]);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Month Navigator & Quick Status Filter Bar (Full Width) */}
            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Month Switcher */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/10 p-1">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                title="Previous Month"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <span className="px-3 text-sm font-bold text-slate-800 dark:text-white min-w-[140px] text-center select-none">
                                {monthYearLabel}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                title="Next Month"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        {!isCurrentMonthSelected && (
                            <button
                                type="button"
                                onClick={handleCurrentMonth}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-3 py-2 rounded-xl transition-all border border-indigo-100 dark:border-indigo-800/40 cursor-pointer"
                            >
                                Current Month
                            </button>
                        )}
                    </div>

                    {/* Recorded Sessions Count */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                            <CalendarIcon size={13} className="text-indigo-500" />
                            <span>{monthlySessions.length} {monthlySessions.length === 1 ? 'session' : 'sessions'} recorded</span>
                        </span>
                    </div>
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Filter:
                    </span>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${statusFilter === 'ALL'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                    >
                        All ({totalRecordedDays})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('PRESENT')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${statusFilter === 'PRESENT'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                    >
                        Present ({presentDays})
                    </button>
                    {lateDays > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('LATE')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${statusFilter === 'LATE'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}
                        >
                            Late ({lateDays})
                        </button>
                    )}
                    {halfDays > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('HALF_DAY')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${statusFilter === 'HALF_DAY'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}
                        >
                            Half Day ({halfDays})
                        </button>
                    )}
                    {absentDays > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('ABSENT')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${statusFilter === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}
                        >
                            Absent ({absentDays})
                        </button>
                    )}
                </div>
            </div>

            {/* Weekly Attendance Displayed on Both Sides (2-Column Grid) */}
            {filteredWeeks.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-dark-card rounded-2xl border border-dashed border-slate-200 dark:border-github-dark-border p-8">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">
                        No records found
                    </h4>
                    <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                        {statusFilter !== 'ALL'
                            ? `No days match the "${statusFilter}" filter for ${monthYearLabel}.`
                            : `There are no attendance sessions logged for ${monthYearLabel}.`}
                    </p>
                    {statusFilter !== 'ALL' && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('ALL')}
                            className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all hover:bg-indigo-100 cursor-pointer"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            ) : (
                filteredWeeks.map(([week, days]) => (
                    <div key={week} className="space-y-3">
                        <div className="flex items-center justify-between pt-2 pb-1">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                {week}
                            </h3>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                {days.length} {days.length === 1 ? 'day recorded' : 'days recorded'}
                            </span>
                        </div>

                        {/* 2-Column Grid: Days displayed on both sides */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {days.map((day) => {
                                const isExpanded = expandedDays.has(day.dateKey);
                                const style = getStatusStyle(day.dayStatus);
                                const totalHoursDisplay = day.totalDayHours > 0
                                    ? `${day.totalDayHours} hrs`
                                    : (day.hasOpenSession ? 'In Progress' : '0 hrs');

                                return (
                                    <div
                                        key={day.dateKey}
                                        className={`bg-white dark:bg-dark-card rounded-2xl shadow-xs border transition-all duration-200 overflow-hidden flex flex-col justify-between ${isExpanded
                                            ? 'border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-500/20'
                                            : 'border-slate-100 dark:border-github-dark-border hover:border-indigo-200 dark:hover:border-indigo-800'
                                            }`}
                                    >
                                        {/* Day Summary Header */}
                                        <div
                                            onClick={() => toggleDayExpansion(day.dateKey)}
                                            className="p-4 sm:p-4.5 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors space-y-3"
                                        >
                                            {/* Top Row: Date, Status, and Total Hours */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 shadow-xs ${style.bg} ${style.text}`}>
                                                        <span className="text-[9px] uppercase font-black opacity-80 leading-none mb-0.5">
                                                            {day.date.toLocaleDateString('en-US', { month: 'short' })}
                                                        </span>
                                                        <span className="text-base leading-none font-mono font-black">
                                                            {day.date.getDate()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-github-dark-text text-sm">
                                                            {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </p>
                                                        <span className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
                                                    <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm sm:text-base font-mono">
                                                        {totalHoursDisplay}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Timing Badges */}
                                            <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                                                <div className="bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-white/5 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">First In</span>
                                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                                        {formatTime(day.firstIn, day.firstSession, false)}
                                                    </span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-white/5 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Last Out</span>
                                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                                        {day.lastOut ? formatTime(day.lastOut, day.lastSession, true) : '--:--'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Sessions info & Chevron */}
                                            <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-slate-500">
                                                <div className="flex items-center gap-1.5 truncate max-w-[240px]" title={day.sessions[0]?.time_in_address || 'Office / Remote'}>
                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full text-[10px] shrink-0">
                                                        {day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'}
                                                    </span>
                                                    <span className="truncate text-[11px]">{day.sessions[0]?.time_in_address || 'Office / Remote'}</span>
                                                </div>

                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 shrink-0 ${isExpanded
                                                    ? 'bg-indigo-600 text-white rotate-180'
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white'
                                                    }`}>
                                                    <ChevronDown size={14} strokeWidth={2.5} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Punch Details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-slate-100 dark:border-github-dark-border/60 bg-slate-50/60 dark:bg-white/[0.015] p-3.5 space-y-2.5"
                                                >
                                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <span>Punch Breakdown</span>
                                                        <span>{day.sessions.length} {day.sessions.length === 1 ? 'pair' : 'pairs'}</span>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        {day.sessions.map((session, sIdx) => {
                                                            const isSessionOpen = !session.time_out;
                                                            const isSessionMissed = session.status === 'MISSED_PUNCH' || (day.isPastDay && isSessionOpen);
                                                            const sessionStatus = isSessionMissed ? 'MISSED_PUNCH' : (isSessionOpen ? 'ACTIVE' : 'CLOSED');
                                                            const sStyle = getStatusStyle(sessionStatus);
                                                            const sDuration = isSessionOpen
                                                                ? (isSessionMissed ? 'Missed Out' : 'In Progress')
                                                                : (session.total_hours ? `${session.total_hours} hrs` : (calculateDuration(session.time_in, session.time_out) || 'N/A'));

                                                            return (
                                                                <div
                                                                    key={session.attendance_id || sIdx}
                                                                    className="bg-white dark:bg-dark-card p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-xs space-y-2"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">
                                                                                #{sIdx + 1}
                                                                            </span>
                                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                                                Session {sIdx + 1}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${sStyle.bg} ${sStyle.text}`}>
                                                                                <span className={`w-1 h-1 rounded-full ${sStyle.dot}`}></span>
                                                                                {sStyle.label}
                                                                            </span>
                                                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                                                {sDuration}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[9px] tracking-wider">
                                                                                    In
                                                                                </span>
                                                                                {session.time_in_image && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setPreviewImage(session.time_in_image);
                                                                                        }}
                                                                                        className="text-[9px] font-bold text-indigo-500 hover:underline"
                                                                                    >
                                                                                        View Selfie
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                                                                {formatTime(session.time_in, session, false)}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-500 truncate mt-0.5" title={session.time_in_address || 'Office / Remote'}>
                                                                                {session.time_in_address || 'Office / Remote'}
                                                                            </p>
                                                                        </div>

                                                                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-rose-500 dark:text-rose-400 font-black uppercase text-[9px] tracking-wider">
                                                                                    Out
                                                                                </span>
                                                                                {session.time_out_image && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setPreviewImage(session.time_out_image);
                                                                                        }}
                                                                                        className="text-[9px] font-bold text-indigo-500 hover:underline"
                                                                                    >
                                                                                        View Selfie
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                                                                {session.time_out ? formatTime(session.time_out, session, true) : (session.status === 'MISSED_PUNCH' ? 'Missed' : '--:--')}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-500 truncate mt-0.5" title={session.time_out_address || (session.time_out ? 'Office / Remote' : 'No punch out')}>
                                                                                {session.time_out_address || (session.time_out ? 'Office / Remote' : 'No punch out')}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {(() => {
                                                                        const lateMins = typeof session.late_minutes === 'object' && session.late_minutes !== null
                                                                            ? (session.late_minutes.minutes || 0)
                                                                            : (Number(session.late_minutes) || 0);
                                                                        if (lateMins <= 0) return null;
                                                                        return (
                                                                            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-lg flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                                                                                <AlertCircle size={12} className="shrink-0" />
                                                                                <span>Late: {lateMins}m {session.late_reason ? `(${session.late_reason})` : ''}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default AttendanceHistoryTab;
