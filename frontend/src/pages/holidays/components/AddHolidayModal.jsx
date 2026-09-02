import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, ChevronDown, Check } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';

const AddHolidayModal = ({
    isOpen,
    onClose,
    newHoliday,
    setNewHoliday,
    onAddHoliday
}) => {
    const [isTypeOpen, setIsTypeOpen] = useState(false);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
            />

            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-[460px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Calendar size={20} />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">Add Holiday</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={onAddHoliday} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Holiday Name</label>
                        <input
                            type="text"
                            required
                            value={newHoliday.name}
                            onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-normal text-sm"
                            placeholder="e.g. Independence Day"
                        />
                    </div>

                    <div className="space-y-6">
                        <div className="relative z-50">
                            <DatePicker
                                label="Date"
                                value={newHoliday.date}
                                onChange={(val) => setNewHoliday({ ...newHoliday, date: val })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Type</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsTypeOpen(!isTypeOpen)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-normal text-sm text-left flex items-center justify-between cursor-pointer"
                                >
                                    <span>{newHoliday.type}</span>
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {isTypeOpen && (
                                        <>
                                            <div className="fixed inset-0 z-[100]" onClick={() => setIsTypeOpen(false)} />
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-lg shadow-2xl overflow-hidden z-[110]"
                                            >
                                                <div className="py-1">
                                                    {['Public', 'Optional', 'Observance'].map((opt) => {
                                                        const isSelected = newHoliday.type === opt;
                                                        return (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewHoliday({ ...newHoliday, type: opt });
                                                                    setIsTypeOpen(false);
                                                                }}
                                                                className={`w-full px-4 py-2.5 text-sm text-left font-medium transition-colors flex items-center justify-between cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                            >
                                                                <span>{opt}</span>
                                                                {isSelected && <Check size={14} className="text-indigo-500" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-slate-100 dark:border-github-dark-border/50 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-github-dark-muted hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] px-6 py-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            Add Holiday
                        </button>
                    </div>
                </form>
            </motion.div>
        </AnimatePresence>
    );
};

export default AddHolidayModal;
