import React from 'react';
import { Camera, MapPin } from 'lucide-react';

const getCurrentTimeInTimezone = () => {
    return new Date();
};

const LiveTimelineTab = ({
    loading = false,
    attendanceData = [],
    filteredData = [],
    setSelectedLiveUser,
    setPreviewImage,
    orgTimezone = 'Asia/Kolkata',
}) => {
    const timeToPct = (rawDate) => {
        if (!rawDate) return null;
        const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
        if (isNaN(date.getTime())) return null;
        const targetTz = orgTimezone || 'Asia/Kolkata';
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: targetTz,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            }).formatToParts(date);
            let h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
            if (h === 24) h = 0;
            const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
            const totalMinutes = h * 60 + m;
            return Math.max(0, Math.min(100, (totalMinutes / (24 * 60)) * 100));
        } catch (e) {
            const totalMinutes = date.getHours() * 60 + date.getMinutes();
            return Math.max(0, Math.min(100, (totalMinutes / (24 * 60)) * 100));
        }
    };

    return (
        <div data-tour-id="attendance-live-monitor" className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 min-h-[450px]">
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[2000px]">
                    {/* Timeline Header */}
                    <div className="flex bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                        <div className="w-[300px] shrink-0 px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-slate-50 dark:bg-github-dark-subtle z-30">
                            Employee Details
                        </div>
                        <div className="flex-1 flex">
                            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                <div key={hour} className="flex-1 py-4 text-center text-[10px] font-normal text-slate-400 border-r border-slate-200 dark:border-github-dark-border/30 last:border-r-0">
                                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                        {loading && attendanceData.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">Loading timeline...</div>
                        ) : filteredData.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">No employees found.</div>
                        ) : (
                            filteredData.map((item, rowIdx) => {
                                return (
                                    <div key={item.id} className="relative z-10 flex hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer hover:z-20" onClick={() => setSelectedLiveUser(item)}>
                                        {/* Employee Info (Sticky) */}
                                        <div className="w-[300px] shrink-0 px-6 py-4 flex items-center gap-3 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-github-dark-subtle z-20">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm overflow-hidden ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500/10 to-purple-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'}`}>
                                                    {item.avatar && typeof item.avatar === 'string' && item.avatar.startsWith('http') ? (
                                                        <img src={item.avatar} alt={item.name || 'Staff'} className="w-full h-full object-cover" />
                                                    ) : (
                                                        item.avatar || (item.name ? item.name.charAt(0) : '?')
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-slate-800 dark:text-github-dark-text truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        {item.allStatuses && item.allStatuses.length > 0 ? (
                                                            item.allStatuses.map(s => (
                                                                <span key={s} className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                                                                    s === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle border-slate-200 dark:border-slate-700' :
                                                                    s === 'Active' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800/30' :
                                                                    s === 'Late' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800/30' :
                                                                    s === 'Overtime' ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800/30' :
                                                                    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
                                                                }`}>
                                                                    {s}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30'}`}>
                                                                {item.status ? item.status.split(' ')[0] : 'Unknown'}
                                                            </span>
                                                        )}

                                                        <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-mono font-normal">
                                                            {item.totalHours ? (String(item.totalHours).toLowerCase().includes('hr') || String(item.totalHours).toLowerCase().includes('min') || String(item.totalHours) === '-' ? String(item.totalHours) : `${item.totalHours} Hrs`) : '-'}
                                                            {item.expectedHours && item.expectedHours !== '-' && ` / ${item.expectedHours}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Timeline Grid */}
                                        <div className="flex-1 relative flex h-20 items-center">
                                            {/* Hour Grid Lines */}
                                            <div className="absolute inset-0 flex">
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <div key={i} className="flex-1 border-r border-slate-100 dark:border-github-dark-border/30 last:border-r-0"></div>
                                                ))}
                                            </div>

                                            {/* Session Blocks */}
                                            <div className="absolute inset-x-0 h-10 z-10 px-2">
                                                {item.sessions && item.sessions.map((session, sIdx) => {
                                                    const startPos = timeToPct(session.rawIn);
                                                    const rawEndPos = session.isActive ? timeToPct(getCurrentTimeInTimezone(orgTimezone)) : timeToPct(session.rawOut);
                                                    const safeEndPos = (rawEndPos !== null && !isNaN(rawEndPos)) ? rawEndPos : Math.min(100, (startPos || 0) + 2);
                                                    const width = Math.max(safeEndPos - (startPos || 0), 1);

                                                    if (startPos === null) return null;

                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            className={`absolute top-0 h-full rounded-md border-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all cursor-pointer group/session ${session.isActive ? 'bg-gradient-to-r from-indigo-500 to-blue-500 border-indigo-400/50 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/50'}`}
                                                            style={{ left: `${startPos}%`, width: `${Math.max(width, 1)}%` }}
                                                        >
                                                            {/* Floating Labels on active */}
                                                            {session.isActive && (
                                                                <div className="absolute -top-6 left-0 right-0 text-center">
                                                                    <span className="text-[9px] font-medium bg-indigo-500 text-white px-2 py-0.5 rounded-md shadow-md">Active Now</span>
                                                                </div>
                                                            )}

                                                            {/* Tooltip on Hover */}
                                                            <div className={`absolute ${rowIdx < 2 ? 'top-full mt-3' : 'bottom-full mb-3'} left-1/2 -translate-x-1/2 px-4 py-3.5 bg-slate-955 dark:bg-[#0d1117] text-white text-[10px] rounded-xl opacity-0 group-hover/session:opacity-100 transition-all duration-300 transform ${rowIdx < 2 ? '-translate-y-2' : 'translate-y-2'} group-hover/session:translate-y-0 whitespace-normal z-50 pointer-events-none shadow-2xl border border-slate-700 dark:border-github-dark-border w-[320px]`}>
                                                                {/* Timing Info */}
                                                                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                                                                    <span className="text-[10px] font-medium text-slate-300">Session Timing</span>
                                                                    <span className="font-mono font-semibold text-indigo-300">{session.in} - {session.out}</span>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                    {/* In details */}
                                                                    <div className="space-y-2 flex flex-col items-center">
                                                                        <span className="text-[9px] font-medium text-emerald-400 block self-start">Punch In</span>
                                                                        {session.inImage ? (
                                                                            <div className="flex justify-center w-full my-1 cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setPreviewImage(session.inImage); }}>
                                                                                <img src={session.inImage} alt="In Selfie" className="max-h-32 max-w-full w-auto block rounded-xl shadow-sm object-contain hover:scale-105 transition-transform" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-24 h-20 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[8px] gap-1 bg-black/10 my-1">
                                                                                <Camera size={12} />
                                                                                <span>No Selfie In</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-start gap-1 w-full text-[9px] leading-tight text-slate-300">
                                                                            <MapPin size={8} className="text-emerald-500 shrink-0 mt-0.5" />
                                                                            <span className="break-words">{session.inLocation}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Out details */}
                                                                    <div className="space-y-2 flex flex-col items-center">
                                                                        <span className="text-[9px] font-medium text-rose-400 block self-start">Punch Out</span>
                                                                        {session.outImage ? (
                                                                            <div className="flex justify-center w-full my-1 cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setPreviewImage(session.outImage); }}>
                                                                                <img src={session.outImage} alt="Out Selfie" className="max-h-32 max-w-full w-auto block rounded-xl shadow-sm object-contain hover:scale-105 transition-transform" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-24 h-20 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[8px] gap-1 bg-black/10 my-1">
                                                                                <Camera size={12} />
                                                                                <span>{session.isActive ? 'Ongoing...' : 'No Selfie Out'}</span>
                                                                            </div>
                                                                        )}
                                                                        {session.outLocation ? (
                                                                            <div className="flex items-start gap-1 w-full text-[9px] leading-tight text-slate-300">
                                                                                <MapPin size={8} className="text-rose-500 shrink-0 mt-0.5" />
                                                                                <span className="break-words">{session.outLocation}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[8px] text-slate-500 italic block self-start">{session.isActive ? 'Session Active' : 'N/A'}</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Arrow */}
                                                                <div className={`absolute ${rowIdx < 2 ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-r border-b'} left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-955 dark:bg-[#0d1117] rotate-45 border-slate-700 dark:border-github-dark-border`}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Background Indicator for late arrival */}
                                            {item.allStatuses && item.allStatuses.includes('Late') && item.sessions && item.sessions[0] && (
                                                <div
                                                    className="absolute left-0 h-1 bg-amber-400/20 rounded-full"
                                                    style={{ width: `${timeToPct(item.sessions[0].rawIn)}%` }}
                                                    title="Late Arrival Period"
                                                ></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveTimelineTab;
