import React from 'react';
import { MapPin, Plus, ExternalLink, Eye, Camera } from 'lucide-react';
import { formatLocalTimeString } from '../../../utils/dateUtils';

const SessionCheckpointsTimeline = ({
    session,
    formatTime,
    onOpenCheckpointModal,
    isCheckpointAllowed = true,
    isCurrentDate = true,
    setViewerImage
}) => {
    const hasCheckpoints = Array.isArray(session?.checkpoints) && session.checkpoints.length > 0;
    const isSessionOpen = !session?.time_out;

    if (!hasCheckpoints && (!isSessionOpen || !isCheckpointAllowed)) return null;

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
                    {isSessionOpen && isCurrentDate && isCheckpointAllowed && (
                        <button
                            onClick={onOpenCheckpointModal}
                            className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <Plus size={12} strokeWidth={3} /> Add Checkpoint
                        </button>
                    )}
                </div>

                <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-amber-400 before:to-amber-500/20">
                    {session.checkpoints.map((chk, cIdx) => {
                        const selfieUrl = chk.image_url || chk.image;
                        return (
                            <div
                                key={chk.id || cIdx}
                                className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs hover:border-amber-500/30 transition-all"
                            >
                                <div className="absolute -left-[1.45rem] top-3.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm" />

                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    {/* Checkpoint Selfie Thumbnail (if uploaded) or Icon Indicator */}
                                    {selfieUrl ? (
                                        <div
                                            onClick={() => setViewerImage && setViewerImage(selfieUrl)}
                                            className="relative group/chkimg w-12 h-12 rounded-xl overflow-hidden border border-amber-500/30 bg-black/20 shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all"
                                            title="Click to preview checkpoint selfie"
                                        >
                                            <img
                                                src={selfieUrl}
                                                alt={`Checkpoint #${cIdx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/chkimg:opacity-100 flex items-center justify-center transition-opacity">
                                                <Eye size={14} className="text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="w-10 h-10 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm"
                                            title="Checkpoint logged without selfie"
                                        >
                                            <Camera size={16} className="opacity-60" />
                                        </div>
                                    )}

                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-black text-amber-700 dark:text-amber-400">
                                                Checkpoint #{cIdx + 1}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                {formatTime ? formatTime(chk.punch_time, session, false) : formatLocalTimeString(chk.punch_time)}
                                            </span>
                                            {chk.accuracy && (
                                                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                                    ±{Math.round(chk.accuracy)}m
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed flex items-center gap-1.5 break-words">
                                            <MapPin size={12} className="text-amber-500 shrink-0" />
                                            <span>{chk.address || (chk.lat && chk.lng ? `${chk.lat}, ${chk.lng}` : 'Location recorded')}</span>
                                        </p>

                                        {chk.note && (
                                            <p className="text-[10px] italic text-slate-500 dark:text-slate-400 pl-4 border-l border-amber-500/30">
                                                "{chk.note}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                    {chk.lat && chk.lng && (
                                        <a
                                            href={`https://www.google.com/maps?q=${chk.lat},${chk.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                        >
                                            <ExternalLink size={10} /> View Map
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Active session with 0 checkpoints yet
    if (!isCheckpointAllowed) return null;

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
