import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle, Info, X } from 'lucide-react';

const MobileConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'info', // 'info', 'warning', 'delete', 'success'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isSubmitting = false
}) => {
    if (!isOpen) return null;

    const icons = {
        info: <Info className="text-black dark:text-white" size={24} />,
        warning: <AlertTriangle className="text-black dark:text-white" size={24} />,
        delete: <Trash2 className="text-black dark:text-white" size={24} />,
        success: <CheckCircle className="text-black dark:text-white" size={24} />
    };

    const confirmBtnStyles = 'bg-black hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black border border-black dark:border-transparent shadow-sm';

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative z-10 w-full max-w-[320px] bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-white/15 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center animate-bounce">
                            {icons[type]}
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                        {title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex p-4 gap-3 bg-slate-50 dark:bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 ${confirmBtnStyles}`}
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin"></div>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MobileConfirmModal;
