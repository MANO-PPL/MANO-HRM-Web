import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialogModal = ({
    confirmDialog,
    setConfirmDialog
}) => {
    return createPortal(
        <AnimatePresence>
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-md bg-white dark:bg-[#0d1117] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-[#30363d] overflow-hidden z-10"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-3 text-red-500">
                                <AlertTriangle size={20} />
                                <h4 className="font-bold text-slate-900 dark:text-[#f0f6fc] text-sm">
                                    {confirmDialog.title}
                                </h4>
                            </div>
                            <p className="text-slate-600 dark:text-github-dark-muted text-[11px] leading-relaxed">
                                {confirmDialog.message}
                            </p>
                        </div>
                        <div className="flex gap-2.5 p-4 bg-slate-50 dark:bg-[#010409]/40 border-t border-slate-100 dark:border-[#30363d]">
                            <button
                                type="button"
                                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-505 dark:text-[#c9d1d9] rounded-xl font-bold transition-all text-xs border border-slate-200 dark:border-github-dark-border"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                }}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
                            >
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ConfirmDialogModal;
