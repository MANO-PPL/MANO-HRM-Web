import React from 'react';
import { MapPin, Plus, ExternalLink } from 'lucide-react';

const SessionCheckpointsTimeline = ({
    session,
    formatTime,
    onOpenCheckpointModal,
    isCurrentDate = true
}) => {
    const hasCheckpoints = Array.isArray(session?.checkpoints) && session.checkpoints.length > 0;
    const isSessionOpen = !session?.time_out;

    if (!hasCheckpoints && !isSessionOpen) return null;

    if (hasCheckpoints) {
        return (
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Session Checkpoints ({session.checkpoints.length})
                        </h4>
                    </div>
                    {isSessionOpen && isCurrentDate && (
                        <button
                            onClick={onOpenCheckpointModal}
                            className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <Plus size={12} strokeWidth={3} /> Add Checkpoint
                        </button>
                    )}
                </div>

                <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-amber-400 before:to-amber-500/20">
                    {session.checkpoints.map((chk, cIdx) => (
                        <div key={chk.id || cIdx} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs">
                            <div className="absolute -left-[1.45rem] top-3.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-amber-700 dark:text-amber-400">
                                        Checkpoint #{cIdx + 1}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                        {formatTime ? formatTime(chk.punch_time, session, false) : new Date(chk.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {chk.accuracy && (
                                        <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                            ±{Math.round(chk.accuracy)}m
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed flex items-center gap-1.5">
                                    <MapPin size={12} className="text-amber-500 shrink-0" />
                                    <span>{chk.address || `${chk.lat}, ${chk.lng}`}</span>
                                </p>
                                {chk.note && (
                                    <p className="text-[10px] italic text-slate-500 dark:text-slate-400 pl-4">
                                        "{chk.note}"
                                    </p>
                                )}
                            </div>
                            {chk.lat && chk.lng && (
                                <a
                                    href={`https://www.google.com/maps?q=${chk.lat},${chk.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
                                >
                                    <ExternalLink size={10} /> View Map
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Active session with 0 checkpoints yet
    return (
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between p-3 bg-amber-50/30 dark:bg-amber-500/5 rounded-xl border border-dashed border-amber-200/50 dark:border-amber-500/20">
            <div className="flex items-center gap-2">
                <MapPin size={14} className="text-amber-500" />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    No checkpoints marked for this active session yet.
                </span>
            </div>
            {isCurrentDate && (
                <button
                    onClick={onOpenCheckpointModal}
                    className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                    <Plus size={12} strokeWidth={3} /> Mark Checkpoint
                </button>
            )}
        </div>
    );
};

export default SessionCheckpointsTimeline;
