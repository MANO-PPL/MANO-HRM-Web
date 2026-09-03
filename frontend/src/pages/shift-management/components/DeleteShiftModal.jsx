import React from 'react';
import { AlertTriangle } from 'lucide-react';

const DeleteShiftModal = ({
    isOpen,
    shiftToDelete,
    onClose,
    onConfirm
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all duration-200 animate-in fade-in">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 mx-auto">
                    <div className="p-10 text-center">
                        <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-github-dark-text mb-3">Delete Shift?</h3>
                        <p className="text-slate-500 dark:text-github-dark-muted mb-10 leading-relaxed text-xs font-normal">
                            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-github-dark-text">"{shiftToDelete?.name}"</span>?<br />This action will unassign all staff currently on this shift.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 px-6 py-3 rounded-xl bg-slate-100 dark:bg-github-dark-subtle/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-github-dark-text font-medium text-xs transition-all cursor-pointer"
                            >
                                Keep it
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteShiftModal;
