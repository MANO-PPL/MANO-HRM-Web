import React from 'react';
import {
    Clock,
    MapPin,
    Activity,
    MoreVertical,
    Search
} from 'lucide-react';

const defaultGetStatusStyle = (status) => {
    if (String(status).includes('Late')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    switch (status) {
        case 'Present': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse';
        case 'Absent': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted';
        case 'Half Day': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
        case 'Overtime': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
        case 'Missed Punch': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
        case 'Week Off': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted border border-dashed border-slate-200 dark:border-github-dark-border';
        case 'Holiday': return 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30';
        case 'Leave': return 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30';
        default: return 'bg-slate-100 text-slate-700 dark:bg-github-dark-subtle dark:text-slate-300';
    }
};

const LiveOverviewTab = ({
    loading,
    filteredData = [],
    setSelectedLiveUser,
    avatarTimestamp = '',
    getStatusStyle = defaultGetStatusStyle
}) => {
    const resolveStatusStyle = getStatusStyle || defaultGetStatusStyle;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border/60 p-5 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700/60"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-150 dark:bg-slate-800/80 rounded w-1/2"></div>
                                </div>
                            </div>
                            <div className="h-6 bg-slate-100 dark:bg-slate-800/80 rounded w-1/3"></div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                                <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredData.length > 0 ? (
                filteredData.map((item, index) => {
                    const showDivider = item.status === 'Absent' && index > 0 && filteredData[index - 1].status !== 'Absent';

                    return (
                        <React.Fragment key={item.id}>
                            {showDivider && (
                                <div className="col-span-full py-6 flex items-center gap-4">
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                    <span className="text-xs font-medium text-slate-400 tracking-wider">Not Checked In</span>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                </div>
                            )}
                            <div
                                onClick={() => setSelectedLiveUser(item)}
                                data-tour-id={index === 0 ? "attendance-employee-card" : undefined}
                                className={`bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border/60 hover:shadow-md transition-all duration-300 overflow-hidden group flex flex-col cursor-pointer ${item.status === 'Absent' ? 'opacity-70 grayscale-[0.3]' : ''}`}
                            >
                                {/* Card Header */}
                                <div className="p-5 flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-semibold text-base shadow-sm overflow-hidden ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                                            {item.avatar && typeof item.avatar === 'string' && item.avatar.startsWith('http') ? (
                                                <img src={`${item.avatar}?t=${avatarTimestamp || Date.now()}`} alt={item.name || 'Staff'} className="w-full h-full object-cover" />
                                            ) : (
                                                item.avatar || (item.name ? item.name.charAt(0) : '?')
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm line-clamp-1" title={item.name}>{item.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal mt-0.5">{item.role}</p>
                                        </div>
                                    </div>
                                    <button className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>

                                {/* Status Badge Line */}
                                <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                                    {item.allStatuses && item.allStatuses.map(statusBadge => (
                                        <span key={statusBadge} className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-medium border shadow-xs ${resolveStatusStyle(statusBadge).replace('bg-', 'bg-opacity-10 border-').replace('text-', 'text-')}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusBadge === 'Active' ? 'animate-pulse bg-current' : 'bg-current'}`}></div>
                                            {statusBadge}
                                        </span>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-100 dark:bg-github-dark-subtle mx-5"></div>

                                {/* Card Body - Latest Session Only */}
                                <div className="p-5 flex-1 overflow-hidden">
                                    {item.status === 'Absent' ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4 italic font-normal">
                                            <Clock size={20} className="mb-2 opacity-30" />
                                            <span className="text-xs">No activity yet</span>
                                        </div>
                                    ) : item.sessions.length > 0 ? (
                                        <div className="relative pl-4 border-l-2 border-indigo-500">
                                            {/* Session Indicator Dot */}
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-md border-2 border-white dark:border-dark-card shadow-sm ${item.sessions[0].isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>

                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-slate-500 dark:text-github-dark-muted">
                                                    Latest Session
                                                </span>
                                                {item.sessions[0].isActive && (
                                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-medium animate-pulse">
                                                        Active
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-normal">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <span>In <span className="font-semibold text-slate-800 dark:text-slate-100">{item.sessions[0].in}</span></span>
                                                    </div>
                                                    <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-subtle/50 p-1.5 rounded-lg border border-slate-100 dark:border-github-dark-border font-normal">
                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-indigo-400" />
                                                        <span className="break-words whitespace-normal" title={item.sessions[0].inLocation}>{item.sessions[0].inLocation}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-normal">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${item.sessions[0].isActive ? 'bg-slate-300 dark:bg-slate-600' : 'bg-red-500'}`}></div>
                                                        <span>Out <span className="font-semibold text-slate-800 dark:text-slate-100">{item.sessions[0].out}</span></span>
                                                    </div>
                                                    {item.sessions[0].outLocation ? (
                                                        <div className="flex items-start gap-1 text-[9px] text-slate-500 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-subtle/50 p-1.5 rounded-lg border border-slate-100 dark:border-github-dark-border font-normal">
                                                            <MapPin size={10} className="shrink-0 mt-0.5 text-rose-400" />
                                                            <span className="break-words whitespace-normal" title={item.sessions[0].outLocation}>{item.sessions[0].outLocation}</span>
                                                        </div>
                                                    ) : item.sessions[0].isActive ? (
                                                        <div className="h-full flex items-center p-1.5">
                                                            <span className="text-[10px] text-slate-300 dark:text-slate-600 italic font-normal">Ongoing...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex items-center p-1.5">
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-normal">System Checkout</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* More Sessions Indicator */}
                                            {item.sessions.length > 1 && (
                                                <div className="mt-3 text-center">
                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full cursor-pointer hover:bg-indigo-100 transition-colors">
                                                        +{item.sessions.length - 1} more sessions
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>

                                {/* Card Footer (Duration) */}
                                {item.status !== 'Absent' && (
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 px-5 py-3 border-t border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">Total Daily Time</span>
                                            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                {item.totalHours}
                                                {item.expectedHours && item.expectedHours !== '-' && (
                                                    <span className="text-xs text-slate-400 dark:text-github-dark-muted font-normal">
                                                        (Expected: {item.expectedHours})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {item.sessions.length > 1 && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-xs">
                                                <Activity size={12} className="text-indigo-500" />
                                                <span className="text-[10px] font-normal text-slate-600 dark:text-slate-300">{item.sessions.length} Sessions</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </React.Fragment>
                    );
                })
            ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="bg-slate-100 dark:bg-github-dark-subtle p-4 rounded-full mb-4">
                        <Search size={32} />
                    </div>
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">No employees found</p>
                    <p className="text-sm">Try adjusting your filters or search terms</p>
                </div>
            )}
        </div>
    );
};

export default LiveOverviewTab;
