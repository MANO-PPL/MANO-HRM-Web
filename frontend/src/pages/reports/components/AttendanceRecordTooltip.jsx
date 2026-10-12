import React, { useRef, useLayoutEffect, useState } from 'react';
import { MapPin, Camera, Clock, LogIn, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { classifyAttendanceStatus, getStatusFullForm, getStatusLabel } from './reportsUtils';

const STATUS_THEMES = {
    present: {
        borderAccent: 'border-t-emerald-500',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
        avatarBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
        barColor: 'bg-emerald-500',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
    },
    absent: {
        borderAccent: 'border-t-rose-500',
        badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
        avatarBg: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
        barColor: 'bg-rose-500',
        dotColor: 'bg-rose-500 dark:bg-rose-400',
    },
    missedPunch: {
        borderAccent: 'border-t-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
        avatarBg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        barColor: 'bg-amber-500',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
    },
    leave: {
        borderAccent: 'border-t-sky-500',
        badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40',
        avatarBg: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400',
        barColor: 'bg-sky-500',
        dotColor: 'bg-sky-500 dark:bg-sky-400',
    },
    halfDay: {
        borderAccent: 'border-t-indigo-500',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40',
        avatarBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
        barColor: 'bg-indigo-500',
        dotColor: 'bg-indigo-500 dark:bg-indigo-400',
    },
    weeklyOff: {
        borderAccent: 'border-t-slate-400',
        badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40',
        avatarBg: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
        barColor: 'bg-slate-400',
        dotColor: 'bg-slate-400',
    },
    overtime: {
        borderAccent: 'border-t-purple-500',
        badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
        avatarBg: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
        barColor: 'bg-purple-500',
        dotColor: 'bg-purple-500 dark:bg-purple-400',
    },
};

const DEFAULT_THEME = {
    borderAccent: 'border-t-indigo-500',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600',
    avatarBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
    barColor: 'bg-indigo-500',
    dotColor: 'bg-indigo-500 dark:bg-indigo-400',
};

const AttendanceRecordTooltip = ({ hoveredRecord, hoveredPosition }) => {
    const tooltipRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, opacity: 0 });

    const rawStatus = hoveredRecord?.status || '';
    const displayStatus = (rawStatus.toLowerCase().includes('late') && rawStatus.toLowerCase().includes('overtime'))
        ? 'Overtime'
        : rawStatus;

    const category = classifyAttendanceStatus(displayStatus);
    const theme = STATUS_THEMES[category] || DEFAULT_THEME;
    const fullForm = getStatusFullForm(displayStatus);
    const shortLabel = getStatusLabel(displayStatus);

    const initials = (hoveredRecord?.user_name || '')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    useLayoutEffect(() => {
        if (!hoveredRecord || !hoveredPosition) {
            setCoords(prev => ({ ...prev, opacity: 0 }));
            return;
        }

        const el = tooltipRef.current;
        const tooltipH = el?.offsetHeight || 310;
        const tooltipW = el?.offsetWidth || 288;
        const vh = window.innerHeight;
        const vw = window.innerWidth;

        const TOP_NAV_OFFSET = 72; // Header navbar is 64px, keep 8px buffer
        const BOTTOM_MARGIN = 16;

        const cellTop = hoveredPosition.top;
        const cellBottom = hoveredPosition.bottom != null ? hoveredPosition.bottom : (hoveredPosition.top + (hoveredPosition.height || 36));
        const cellCenterX = hoveredPosition.left;

        const spaceAbove = cellTop - TOP_NAV_OFFSET;
        const spaceBelow = vh - cellBottom - BOTTOM_MARGIN;

        let calculatedTop;
        // If there's enough space above (without overlapping the top navbar), place above the cell
        if (spaceAbove >= tooltipH + 12) {
            calculatedTop = cellTop - tooltipH - 8;
        } else if (spaceBelow >= tooltipH + 12) {
            // Otherwise place below the cell
            calculatedTop = cellBottom + 8;
        } else {
            // Tight space on both: place on whichever side has more visible room
            if (spaceAbove >= spaceBelow) {
                calculatedTop = cellTop - tooltipH - 8;
            } else {
                calculatedTop = cellBottom + 8;
            }
        }

        // Clamp vertically strictly between top navbar (72px) and bottom of screen
        const minTop = TOP_NAV_OFFSET;
        const maxTop = Math.max(minTop, vh - tooltipH - BOTTOM_MARGIN);
        calculatedTop = Math.max(minTop, Math.min(maxTop, calculatedTop));

        // Horizontal center with 16px boundary clamping
        let calculatedLeft = cellCenterX - tooltipW / 2;
        const minLeft = 16;
        const maxLeft = Math.max(minLeft, vw - tooltipW - 16);
        calculatedLeft = Math.max(minLeft, Math.min(maxLeft, calculatedLeft));

        setCoords({
            top: Math.round(calculatedTop),
            left: Math.round(calculatedLeft),
            opacity: 1
        });
    }, [hoveredRecord, hoveredPosition]);

    if (!hoveredRecord) return null;

    return (
        <div
            ref={tooltipRef}
            className={`fixed z-[9999] pointer-events-none transition-opacity duration-150 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md text-slate-800 dark:text-slate-100 text-[11px] rounded-2xl p-4 shadow-xl dark:shadow-2xl border border-slate-200/90 dark:border-[#30363d] border-t-2 ${theme.borderAccent} w-72 space-y-3 text-left max-h-[calc(100vh-96px)] overflow-y-auto no-scrollbar`}
            style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                opacity: coords.opacity
            }}
        >
            {/* Header: Employee & Status Badge */}
            <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-[#30363d]">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl ${theme.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-inner`}>
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-[#f0f6fc] leading-tight truncate">
                            {hoveredRecord.user_name}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-[#8b949e] mt-0.5 font-normal truncate">
                            {hoveredRecord.date}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border leading-tight ${theme.badge}`}>
                        {fullForm} ({shortLabel})
                    </span>
                    {hoveredRecord.overtime_hours > 0 && category !== 'overtime' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800/80">
                            OT: {hoveredRecord.overtime_hours}h
                        </span>
                    )}
                    {hoveredRecord.late_minutes > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/80">
                            Late: {hoveredRecord.late_minutes}m
                        </span>
                    )}
                </div>
            </div>

            {/* Status-specific contextual message or detailed breakdown */}
            {category === 'absent' ? (
                <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>No attendance recorded for this shift. Marked absent.</span>
                </div>
            ) : category === 'leave' ? (
                <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 text-[10px] flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-sky-500 dark:text-sky-400 shrink-0" />
                    <span>Approved leave recorded for this date.</span>
                </div>
            ) : category === 'weeklyOff' ? (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-300 text-[10px] flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span>Scheduled weekly off / rest day.</span>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {/* Punch In / Out Micro Cards */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 rounded-xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-500 dark:text-[#8b949e]">
                                <LogIn size={11} className="text-emerald-500 dark:text-emerald-400" />
                                <span className="text-[9px] font-medium uppercase tracking-wider">Punch In</span>
                            </div>
                            <span className="font-semibold text-xs text-slate-800 dark:text-[#c9d1d9] block">
                                {hoveredRecord.time_in || 'N/A'}
                            </span>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-500 dark:text-[#8b949e]">
                                <LogOut size={11} className="text-rose-500 dark:text-rose-400" />
                                <span className="text-[9px] font-medium uppercase tracking-wider">Punch Out</span>
                            </div>
                            <span className="font-semibold text-xs text-slate-800 dark:text-[#c9d1d9] block">
                                {hoveredRecord.time_out || (hoveredRecord.is_active ? 'In Progress' : 'N/A')}
                            </span>
                        </div>
                    </div>

                    {/* Work Hours & Progress */}
                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 dark:text-[#8b949e]">Work Hours</span>
                            <span className="font-semibold text-slate-800 dark:text-[#c9d1d9]">
                                {hoveredRecord.worked_hours != null ? hoveredRecord.worked_hours.toFixed(2) : '0.00'}
                                <span className="text-slate-400 mx-0.5 font-normal">/</span>
                                {hoveredRecord.required_hours != null ? hoveredRecord.required_hours.toFixed(2) : '0.00'}h
                            </span>
                        </div>
                        {hoveredRecord.worked_hours != null && hoveredRecord.required_hours > 0 && (
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        hoveredRecord.worked_hours >= hoveredRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'
                                    }`}
                                    style={{ width: `${Math.min((hoveredRecord.worked_hours / hoveredRecord.required_hours) * 100, 100)}%` }}
                                />
                            </div>
                        )}
                        {hoveredRecord.late_minutes > 0 && hoveredRecord.late_reason && hoveredRecord.late_reason !== '-' && (
                            <p className="text-[9px] text-amber-600 dark:text-amber-300/90 italic truncate pt-0.5" title={hoveredRecord.late_reason}>
                                Reason: "{hoveredRecord.late_reason}"
                            </p>
                        )}
                    </div>

                    {/* Locations */}
                    {((hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-') ||
                        (hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-')) && (
                        <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-[#30363d]/60">
                            {hoveredRecord.time_in_address && hoveredRecord.time_in_address !== '-' && (
                                <div className="flex items-start gap-1.5 text-[9px] text-slate-600 dark:text-[#c9d1d9]">
                                    <MapPin size={11} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2 leading-tight">In: {hoveredRecord.time_in_address}</span>
                                </div>
                            )}
                            {hoveredRecord.time_out_address && hoveredRecord.time_out_address !== '-' && (
                                <div className="flex items-start gap-1.5 text-[9px] text-slate-600 dark:text-[#c9d1d9]">
                                    <MapPin size={11} className="text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2 leading-tight">Out: {hoveredRecord.time_out_address}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selfie Thumbnails */}
                    {(hoveredRecord.time_in_image || hoveredRecord.time_out_image) && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-[#30363d]/60">
                            {[
                                { label: 'In', img: hoveredRecord.time_in_image },
                                { label: 'Out', img: hoveredRecord.time_out_image }
                            ].map((item, i) => (
                                <div key={i} className="relative h-14 rounded-lg border border-slate-200 dark:border-[#30363d] overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
                                    {item.img ? (
                                        <img src={item.img} alt={`Selfie ${item.label}`} className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full pb-2 gap-0.5 opacity-40">
                                            <Camera size={14} className="text-slate-400" />
                                            <span className="text-[6px] font-medium uppercase tracking-wider text-slate-400">No Photo</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 dark:bg-black/80 text-[7px] text-center uppercase py-0.5 font-medium tracking-wider text-white leading-none border-t border-slate-200/20">
                                        Punch {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceRecordTooltip;
