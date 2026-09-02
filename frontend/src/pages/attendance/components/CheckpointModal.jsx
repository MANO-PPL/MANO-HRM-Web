import React from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Navigation, RefreshCw, AlertCircle, ExternalLink, X } from 'lucide-react';

const CheckpointModal = ({
    isOpen,
    onClose,
    isMarkingCheckpoint,
    checkpointLocation,
    checkpointNote,
    setCheckpointNote,
    onConfirm,
    onRetryLocation
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9000] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
                <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
                    onClick={() => !isMarkingCheckpoint && onClose()}
                />
                <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden text-left mx-auto animate-in fade-in zoom-in-95 duration-200">
                    {/* Accent Top Bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600" />

                    {/* Modal Header */}
                    <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm">
                                <MapPin size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    Mark Checkpoint
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Record your current location & presence during shift
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => !isMarkingCheckpoint && onClose()}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-5">
                        {/* GPS Location Status Card */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted flex items-center gap-1.5">
                                    <Navigation size={12} className="text-indigo-500" /> Live Geolocation
                                </span>
                                {checkpointLocation.loading ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                                        <RefreshCw size={10} className="animate-spin" /> Locating...
                                    </span>
                                ) : checkpointLocation.error ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md">
                                        <AlertCircle size={10} /> Error
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Location Locked
                                    </span>
                                )}
                            </div>

                            {checkpointLocation.loading ? (
                                <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                            <MapPin size={24} className="animate-bounce" />
                                        </div>
                                        <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
                                        Acquiring high-precision GPS coordinates...
                                    </p>
                                    <p className="text-[11px] text-slate-400">Please ensure location permissions are granted</p>
                                </div>
                            ) : checkpointLocation.error ? (
                                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 space-y-2">
                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                        {checkpointLocation.error}
                                    </p>
                                    <button
                                        onClick={onRetryLocation}
                                        className="text-[11px] font-bold text-rose-700 dark:text-rose-300 underline cursor-pointer"
                                    >
                                        Retry Location Acquisition
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="flex items-start gap-2.5">
                                        <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                                            {checkpointLocation.address}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                                            {checkpointLocation.lat?.toFixed(5)}, {checkpointLocation.lng?.toFixed(5)}
                                        </span>
                                        {checkpointLocation.accuracy && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 font-semibold text-slate-600 dark:text-slate-300 text-[10px]">
                                                ±{Math.round(checkpointLocation.accuracy)}m precision
                                            </span>
                                        )}
                                        <a
                                            href={`https://www.google.com/maps?q=${checkpointLocation.lat},${checkpointLocation.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                        >
                                            <ExternalLink size={11} /> Google Maps
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Optional Note Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Checkpoint Note <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={checkpointNote}
                                onChange={(e) => setCheckpointNote(e.target.value)}
                                placeholder="e.g. Site B inspection, floor 3 rounds, client meeting..."
                                maxLength={120}
                                disabled={isMarkingCheckpoint}
                                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="p-6 pt-3 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isMarkingCheckpoint}
                            className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isMarkingCheckpoint || checkpointLocation.loading || Boolean(checkpointLocation.error)}
                            className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            {isMarkingCheckpoint ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" /> Recording...
                                </>
                            ) : (
                                <>
                                    <MapPin size={14} strokeWidth={2.5} /> Confirm & Mark Checkpoint
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CheckpointModal;
