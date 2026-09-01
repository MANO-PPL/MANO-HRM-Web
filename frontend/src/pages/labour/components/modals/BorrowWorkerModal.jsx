import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search } from 'lucide-react';

const BorrowWorkerModal = ({
    showBorrowModal,
    setShowBorrowModal,
    borrowSearchQuery,
    setBorrowSearchQuery,
    labours,
    attendanceRoster,
    handleBorrowLabour
}) => {
    return createPortal(
        <AnimatePresence>
            {showBorrowModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowBorrowModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-github-dark-border/40 dark:border-[#30363d] z-10"
                    >
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#010409]/40">
                            <div className="flex items-center gap-1.5">
                                <Plus size={16} className="text-indigo-500" />
                                <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">Add Worker from Master Data</h4>
                            </div>
                            <button onClick={() => setShowBorrowModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-[#58a6ff] hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search worker by name or designation..."
                                    value={borrowSearchQuery}
                                    onChange={(e) => setBorrowSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-900 dark:text-[#f0f6fc] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="border border-slate-200 dark:border-github-dark-border rounded-lg max-h-[60vh] overflow-y-auto p-1 bg-slate-50 dark:bg-[#161b22]/40 divide-y divide-slate-100 dark:divide-github-dark-border/40 custom-scrollbar">
                                {labours
                                    .filter(lab => {
                                        const isAlreadyInRoster = attendanceRoster.some(r => r.labour_id === lab.labour_id);
                                        const matchesSearch = lab.name.toLowerCase().includes(borrowSearchQuery.toLowerCase()) ||
                                            lab.role.toLowerCase().includes(borrowSearchQuery.toLowerCase());
                                        return !isAlreadyInRoster && matchesSearch && lab.status === 'Active';
                                    })
                                    .map(lab => (
                                        <div
                                            key={lab.labour_id}
                                            onClick={() => handleBorrowLabour(lab)}
                                            className="flex justify-between items-center p-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-[#161b22] transition-colors"
                                        >
                                            <div>
                                                <span className="font-bold text-slate-800 dark:text-github-dark-text dark:text-[#f0f6fc] block">{lab.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{lab.role} | Default: {lab.site_name || 'Independent'}</span>
                                            </div>
                                            <button className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-black cursor-pointer">
                                                Select
                                            </button>
                                        </div>
                                    ))}
                                {labours.filter(lab => {
                                    const isAlreadyInRoster = attendanceRoster.some(r => r.labour_id === lab.labour_id);
                                    const matchesSearch = lab.name.toLowerCase().includes(borrowSearchQuery.toLowerCase()) ||
                                        lab.role.toLowerCase().includes(borrowSearchQuery.toLowerCase());
                                    return !isAlreadyInRoster && matchesSearch && lab.status === 'Active';
                                }).length === 0 && (
                                        <div className="p-8 text-center text-slate-400 italic">No workers found.</div>
                                    )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default BorrowWorkerModal;
