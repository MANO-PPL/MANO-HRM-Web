import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import DatePicker from '../../../../components/DatePicker';

const DailyScheduleModal = ({
    showScheduleModal,
    setShowScheduleModal,
    selectedScheduleLabour,
    scheduleDate,
    handleScheduleDateChange,
    scheduleSites,
    scheduleLoading,
    sites,
    handleToggleScheduleSite,
    handleSaveSchedule
}) => {
    return createPortal(
        <AnimatePresence>
            {showScheduleModal && selectedScheduleLabour && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowScheduleModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="relative w-full max-w-md bg-white dark:bg-[#0d1117] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#30363d] overflow-hidden flex flex-col z-10"
                    >
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#010409]/40">
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                    Daily Site Schedule
                                </h4>
                                <p className="text-[9px] font-bold text-indigo-550 dark:text-indigo-400 mt-0.5 tracking-wider uppercase">
                                    Plan Shift for {selectedScheduleLabour.name}
                                </p>
                            </div>
                            <button onClick={() => setShowScheduleModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs flex-1">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-1.5 uppercase tracking-wide text-[10px]">Select Target Date</label>
                                <DatePicker
                                    value={scheduleDate}
                                    onChange={handleScheduleDateChange}
                                    className="w-full text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 dark:text-slate-300 font-semibold mb-2 uppercase tracking-wide text-[10px]">
                                    Assign Sites for this Day ({scheduleSites.length} selected)
                                </label>
                                {scheduleLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Clock className="animate-spin text-indigo-500" size={20} />
                                    </div>
                                ) : (
                                    <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 border border-slate-100 dark:border-[#30363d] rounded-xl p-3 bg-slate-50/30 dark:bg-[#161b22]/30 custom-scrollbar">
                                        {sites.map(site => {
                                            const isChecked = scheduleSites.includes(site.site_id);
                                            const isPrimary = selectedScheduleLabour.site_id === site.site_id;
                                            return (
                                                <div
                                                    key={site.site_id}
                                                    onClick={() => handleToggleScheduleSite(site.site_id)}
                                                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                                                        isChecked
                                                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400 font-medium'
                                                            : 'border-slate-100 dark:border-[#30363d] text-slate-650 dark:text-[#c9d1d9] hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`theme-checkbox pointer-events-none ${isChecked ? 'checked' : ''}`}>
                                                            {isChecked && (
                                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                                    <path d="M1.5 4L4 6.5L8.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className="text-xs">{site.site_name}</span>
                                                    </div>
                                                    {isPrimary && (
                                                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-extrabold text-[8px] uppercase tracking-wider">
                                                            Primary
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted italic leading-relaxed">
                                Note: If no daily schedule is configured for a date, the worker will automatically default to their primary site checklist.
                            </p>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#010409]/40 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(false)}
                                className="px-4 py-2 border border-slate-200 dark:border-[#30363d] rounded-lg font-bold text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSchedule}
                                disabled={scheduleLoading}
                                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md hover:shadow-indigo-550/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                                Save Schedule
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default DailyScheduleModal;
