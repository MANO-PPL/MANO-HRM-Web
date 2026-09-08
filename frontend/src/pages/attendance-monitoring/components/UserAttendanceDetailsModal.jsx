import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    AlertTriangle,
    LogOut,
    MapPin,
    Search,
    XCircle
} from 'lucide-react';

const UserAttendanceDetailsModal = ({ user, onClose }) => {
    const [previewImage, setPreviewImage] = useState(null);

    // If we're closing and no user, we rely on AnimatePresence in the parent
    if (!user) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* Sidebar Drawer */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[450px] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl z-[9999] flex flex-col dar-context"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-slate-50/50 dark:bg-github-dark-subtle/20 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                            {user.avatar && user.avatar.startsWith('http') ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.avatar
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text leading-tight">{user.name}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-github-dark-muted mt-0.5 font-normal">{user.role} • {user.department}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-github-dark-muted"
                    >
                        <XCircle size={18} />
                    </button>
                </div>

                {/* Body - Session Timeline */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                            <h4 className="text-xs font-medium text-slate-500 dark:text-github-dark-muted">Today's Timeline</h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shadow-xs ${user.status.includes('Active') ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}>
                                {user.status}
                            </span>
                            <span className="text-[10px] font-mono font-normal text-slate-500 dark:text-github-dark-muted bg-slate-100 dark:bg-github-dark-subtle/50 px-2 py-0.5 rounded border border-slate-200 dark:border-github-dark-border">
                                {user.totalHours && (user.totalHours.toLowerCase().includes('hr') || user.totalHours.toLowerCase().includes('min') || user.totalHours === '-') ? user.totalHours : `${user.totalHours} Hrs`}
                                {user.expectedHours && user.expectedHours !== '-' && ` / ${user.expectedHours}`}
                            </span>
                        </div>
                    </div>

                    {user.allStatuses && user.allStatuses.includes('Late') && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                            <h5 className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 mb-1 flex items-center gap-1.5">
                                <AlertTriangle size={10} /> Late Reason
                            </h5>
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed italic">
                                {user.lateReason ? `"${user.lateReason}"` : "No reason provided."}
                            </p>
                        </div>
                    )}

                    <div className="relative pl-3 space-y-5 border-l-2 border-slate-100 dark:border-github-dark-border ml-2">
                        {!user.sessions || user.sessions.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic text-xs">No activity recorded for today.</div>
                        ) : (
                            user.sessions.map((session, idx) => (
                                <div key={idx} className="relative pl-6">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 border-white dark:border-dark-card shadow-md flex items-center justify-center z-10 ${session.isActive ? 'bg-indigo-500 animate-pulse ring-4 ring-indigo-500/10' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        {session.isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>

                                    {/* Session Card */}
                                    <div className={`bg-white dark:bg-dark-card border ${session.isActive ? 'border-indigo-200 dark:border-indigo-500/40 shadow-indigo-100/50' : 'border-slate-200 dark:border-github-dark-border'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group`}>
                                        <div className="flex items-center mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 leading-none mb-1.5">Start</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-emerald-500" />
                                                        <span className="text-sm font-mono font-semibold text-slate-800 dark:text-github-dark-text">{session.in}</span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-px bg-slate-100 dark:bg-github-dark-subtle mt-4"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 leading-none mb-1.5">End</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <LogOut size={12} className={session.isActive ? 'text-indigo-400' : 'text-rose-500'} />
                                                        <span className={`text-sm font-mono font-semibold ${session.isActive ? 'text-indigo-500 animate-pulse' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                            {session.out}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50 dark:border-github-dark-border/30">
                                            {/* Punch In Details */}
                                            <div className="space-y-2">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Punch In</span>
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin size={10} className="shrink-0 mt-0.5 text-emerald-500 opacity-70" />
                                                    <span className="text-[10px] text-slate-500 dark:text-github-dark-muted leading-tight break-words whitespace-normal font-normal" title={session.inLocation}>
                                                        {session.inLocation}
                                                    </span>
                                                </div>
                                                {session.inImage && (
                                                    <div className="flex justify-center w-full mt-2">
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent" onClick={() => setPreviewImage(session.inImage)}>
                                                            <img src={session.inImage} alt="In Selfie" className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search size={16} className="text-white" />
                                                            </div>
                                                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-medium text-white">Selfie In</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Punch Out Details */}
                                            <div className="space-y-2">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Punch Out</span>
                                                {session.outLocation ? (
                                                    <div className="flex items-start gap-1.5">
                                                        <MapPin size={10} className="shrink-0 mt-0.5 text-rose-500 opacity-70" />
                                                        <span className="text-[10px] text-slate-500 dark:text-github-dark-muted leading-tight break-words whitespace-normal font-normal" title={session.outLocation}>
                                                            {session.outLocation}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="h-4 flex items-center">
                                                        <span className="text-[10px] text-slate-300 dark:text-slate-600 italic font-normal">{session.isActive ? 'Ongoing...' : 'N/A'}</span>
                                                    </div>
                                                )}
                                                {session.outImage ? (
                                                    <div className="flex justify-center w-full mt-2">
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent" onClick={() => setPreviewImage(session.outImage)}>
                                                            <img src={session.outImage} alt="Out Selfie" className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search size={16} className="text-white" />
                                                            </div>
                                                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-medium text-white">Selfie Out</div>
                                                        </div>
                                                    </div>
                                                ) : !session.isActive && (
                                                    <div className="w-full h-28 rounded-xl bg-slate-50 dark:bg-github-dark-subtle/20 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center gap-1">
                                                        <XCircle size={14} className="text-slate-300" />
                                                        <span className="text-[9px] text-slate-400 font-normal">No Selfie Out</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-medium shadow-sm hover:opacity-90 transition-all"
                    >
                        Close Details
                    </button>
                </div>
            </motion.div>

            {/* Image Preview Lightbox */}
            {previewImage && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            onClick={() => setPreviewImage(null)}
                        >
                            <XCircle size={32} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={previewImage}
                            alt="Selfie Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </>,
        document.body
    );
};

export default UserAttendanceDetailsModal;
