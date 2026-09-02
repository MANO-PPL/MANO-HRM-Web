import React from 'react';
import { Clock, MapPin, ExternalLink, RefreshCw, Briefcase } from 'lucide-react';

const AttendanceTimeLocationHeader = ({
    user,
    currentTime,
    location,
    isLoadingLoc,
    onRefreshLocation,
    myShift,
    globalActiveSession,
    onOpenCheckpointModal
}) => {
    const hours = currentTime.getHours();
    const greeting = hours < 12 ? 'Morning' : hours < 17 ? 'Afternoon' : 'Evening';
    const userName = user?.user_name?.split(' ')[0] || 'User';

    const shiftStart = myShift?.start_time ? myShift.start_time.slice(0, 5) : '09:30';
    const shiftEnd = myShift?.end_time ? myShift.end_time.slice(0, 5) : '18:30';
    const shiftName = myShift?.name || 'General Shift';

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-[#0a0d14] dark:via-[#0e1320] dark:to-[#0a0d14] rounded-2xl p-5 sm:p-6 border border-indigo-500/20 shadow-2xl">
            {/* Subtle Ambient Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[90px] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-500/10 blur-[80px] pointer-events-none" />

            <div className="relative z-10 space-y-5">
                {/* Greeting & Date Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            Good {greeting}, {userName}!
                        </h1>
                        <p className="text-indigo-200/80 text-xs sm:text-sm font-medium mt-0.5">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-200 border border-white/15 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                            Live Attendance Portal
                        </span>
                    </div>
                </div>

                {/* 3-Column Command Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Real-Time Clock */}
                    <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4 shadow-sm hover:border-white/20 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
                            <Clock size={24} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold text-indigo-200 tracking-wider uppercase opacity-80">
                                Current Time
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </div>
                            <span className="text-[10px] text-indigo-200/70 font-medium">
                                Standard Time Sync
                            </span>
                        </div>
                    </div>

                    {/* 2. Today's Shift & Live Punch Status */}
                    <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center justify-between gap-3 shadow-sm hover:border-white/20 transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center shrink-0 shadow-inner">
                                <Briefcase size={22} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-white truncate max-w-[140px]">
                                        {shiftName}
                                    </span>
                                    {globalActiveSession ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Clocked In
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/20 text-slate-300 border border-white/10">
                                            Standby
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-indigo-200/80 font-mono mt-0.5">
                                    {shiftStart} – {shiftEnd}
                                </p>
                            </div>
                        </div>

                        {onOpenCheckpointModal && (
                            <button
                                type="button"
                                onClick={onOpenCheckpointModal}
                                title="Record your mid-shift GPS checkpoint"
                                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <MapPin size={13} />
                                <span>Checkpoint</span>
                            </button>
                        )}
                    </div>

                    {/* 3. High-Accuracy Location */}
                    <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center justify-between gap-3 shadow-sm hover:border-white/20 transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center shrink-0 shadow-inner">
                                <MapPin size={22} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="block text-[10px] font-bold text-indigo-200 tracking-wider uppercase opacity-80">
                                        Your Location
                                    </span>
                                    {location.lat && location.lng && !location.error && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            {location.accuracy ? `±${Math.round(location.accuracy)}m` : 'Live GPS'}
                                        </span>
                                    )}
                                </div>
                                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate mt-0.5" title={location.fullAddress || location.address}>
                                    {isLoadingLoc ? 'Acquiring GPS...' : location.address}
                                </h4>
                                {location.lat && location.lng && (
                                    <p className="text-[10px] text-indigo-200/70 font-mono">
                                        {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {location.lat && location.lng && (
                                <a
                                    href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View on Google Maps"
                                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                >
                                    <ExternalLink size={13} />
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => onRefreshLocation && onRefreshLocation(true)}
                                disabled={isLoadingLoc}
                                title="Refresh precise GPS location"
                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <RefreshCw size={13} className={isLoadingLoc ? 'animate-spin text-amber-300' : ''} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceTimeLocationHeader;
