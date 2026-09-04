import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, User, MapPin, Search, XCircle } from 'lucide-react';
import { getStatusColor } from './reportsUtils';

const AttendanceDetailDrawer = ({
    isOpen,
    selectedRecord,
    onClose,
    onPreviewImage
}) => {
    return createPortal(
        <AnimatePresence>
            {isOpen && selectedRecord && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-[2px] cursor-pointer"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] z-[201] bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 dark:text-github-dark-text">Attendance Details</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                aria-label="Close details"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                            {/* Profile Card - Avatar + Name + Date + Status */}
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-10 rounded-full" />
                                    <div className="relative w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-3xl overflow-hidden border-4 border-white dark:border-github-dark-border shadow-lg">
                                        {(selectedRecord.user_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || <User size={30} />}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 dark:text-github-dark-text tracking-tight">{selectedRecord.user_name || 'Employee'}</h4>
                                    <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted mt-1">{selectedRecord.date}</p>
                                    {selectedRecord.designation && (
                                        <p className="text-xs font-semibold text-slate-400 dark:text-github-dark-muted mt-1">{selectedRecord.designation} · {selectedRecord.department}</p>
                                    )}
                                    <div className={`mt-3 inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${getStatusColor(selectedRecord.status)}`}>
                                        {selectedRecord.status}
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Details */}
                            {selectedRecord.status === 'Absent' ? (
                                <div className="p-5 bg-rose-50/50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-800/20 rounded-2xl space-y-1.5">
                                    <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Absent Status</p>
                                    <p className="text-xs font-semibold text-rose-500/80">No attendance recorded for this day. Employee was marked absent.</p>
                                </div>
                            ) : selectedRecord.status === 'On Leave' ? (
                                <div className="p-5 bg-sky-50/50 dark:bg-sky-950/15 border border-sky-200/50 dark:border-sky-800/20 rounded-2xl space-y-1.5">
                                    <p className="text-xs font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">Leave Status</p>
                                    <p className="text-xs font-semibold text-sky-500/80">On approved leave. Leave was approved for this day.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Punch In', value: selectedRecord.time_in || 'N/A' },
                                            { label: 'Punch Out', value: selectedRecord.time_out || (selectedRecord.is_active ? 'In Progress' : 'N/A') },
                                        ].map((item, i) => (
                                            <div key={i} className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">{item.label}</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Work Hours vs Required + Late Mins */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 group hover:border-indigo-500/30 transition-colors">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Work Hrs / Req Hrs</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-github-dark-text">
                                                {selectedRecord.worked_hours != null ? selectedRecord.worked_hours.toFixed(2) : '0.00'}
                                                <span className="text-slate-400 font-medium mx-1">/</span>
                                                {selectedRecord.required_hours != null ? selectedRecord.required_hours.toFixed(2) : '0.00'} hrs
                                            </span>
                                            {selectedRecord.worked_hours != null && selectedRecord.required_hours != null && selectedRecord.required_hours > 0 && (
                                                <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${selectedRecord.worked_hours >= selectedRecord.required_hours ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                        style={{ width: `${Math.min((selectedRecord.worked_hours / selectedRecord.required_hours) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`p-4 rounded-2xl border transition-colors ${selectedRecord.late_minutes > 0 ? 'bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/50 dark:border-amber-800/20 hover:border-amber-400/40' : 'bg-slate-50/50 dark:bg-github-dark-subtle/40 border-slate-100 dark:border-github-dark-border/50 hover:border-indigo-500/30'}`}>
                                            <span className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60 text-slate-400">Late Mins</span>
                                            <span className={`text-sm font-bold ${selectedRecord.late_minutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-github-dark-text'}`}>
                                                {selectedRecord.late_minutes != null ? `${selectedRecord.late_minutes} min` : '0 min'}
                                            </span>
                                            {selectedRecord.late_minutes > 0 && (
                                                <>
                                                    <span className="block text-[9px] text-amber-500 font-semibold mt-1">Arrived late</span>
                                                    {selectedRecord.late_reason && selectedRecord.late_reason !== '-' && (
                                                        <span className="block text-[9px] text-slate-500 dark:text-github-dark-muted font-medium mt-1 leading-snug">
                                                            Message: <span className="italic">"{selectedRecord.late_reason}"</span>
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Punch Locations */}
                                    {selectedRecord.time_in_address && selectedRecord.time_in_address !== '-' && (
                                        <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400/50" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-80">Punch In Location</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRecord.time_in_address}</p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedRecord.time_out && selectedRecord.time_out !== '-' ? (
                                        selectedRecord.time_out_address && selectedRecord.time_out_address !== '-' && (
                                            <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-400/50" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 opacity-80">Punch Out Location</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRecord.time_out_address}</p>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Punch Out Info</span>
                                            <p className="text-xs font-semibold text-slate-400 mt-2 italic">Punch out not yet recorded.</p>
                                        </div>
                                    )}

                                    {/* Selfie Previews */}
                                    {(selectedRecord.time_in_image || selectedRecord.time_out_image) && (
                                        <div className="bg-slate-50/50 dark:bg-github-dark-subtle/40 p-5 rounded-2xl border border-slate-100 dark:border-github-dark-border/50">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 opacity-60">Punch Selfies</span>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[
                                                    { label: 'In', img: selectedRecord.time_in_image, color: 'text-emerald-600 dark:text-emerald-400' },
                                                    { label: 'Out', img: selectedRecord.time_out_image, color: 'text-rose-600 dark:text-rose-400' }
                                                ].map((item, i) => (
                                                    <div key={i} className="flex flex-col">
                                                        {item.img ? (
                                                            <div className="flex justify-center w-full mt-2">
                                                                <div
                                                                    className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border group/img cursor-pointer shadow-sm bg-transparent"
                                                                    onClick={() => onPreviewImage(item.img)}
                                                                >
                                                                    <img src={item.img} alt={`${item.label} Selfie`} className="max-h-48 max-w-full w-auto block object-contain transition-transform duration-500 group-hover/img:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Search size={16} className="text-white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-28 rounded-xl bg-slate-50 dark:bg-github-dark-subtle/20 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center gap-1">
                                                                <XCircle size={14} className="text-slate-350" />
                                                                <span className="text-[9px] text-slate-400 font-medium">No Selfie {item.label}</span>
                                                            </div>
                                                        )}
                                                        <span className={`text-[9px] font-black uppercase tracking-wider text-center mt-2.5 ${item.color}`}>
                                                            Punch {item.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AttendanceDetailDrawer;
