import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle, 
    Trash2, 
    CheckCircle, 
    Info, 
    X, 
    UserCheck, 
    UserX, 
    RotateCcw,
    AlertCircle
} from 'lucide-react';

const ConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    type = 'info', // 'danger', 'warning', 'success', 'info'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isSubmitting = false 
}) => {
    // Prevent scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const config = {
        danger: {
            icon: <Trash2 size={24} strokeWidth={2.5} />,
            color: 'text-black dark:text-white',
            bg: 'bg-slate-100 dark:bg-white/10',
            btn: 'bg-black hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-black border border-black dark:border-transparent shadow-sm',
            accent: 'slate'
        },
        warning: {
            icon: <AlertTriangle size={24} strokeWidth={2.5} />,
            color: 'text-black dark:text-white',
            bg: 'bg-slate-100 dark:bg-white/10',
            btn: 'bg-black hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-black border border-black dark:border-transparent shadow-sm',
            accent: 'slate'
        },
        success: {
            icon: <CheckCircle size={24} strokeWidth={2.5} />,
            color: 'text-black dark:text-white',
            bg: 'bg-slate-100 dark:bg-white/10',
            btn: 'bg-black hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-black border border-black dark:border-transparent shadow-sm',
            accent: 'slate'
        },
        info: {
            icon: <Info size={24} strokeWidth={2.5} />,
            color: 'text-black dark:text-white',
            bg: 'bg-slate-100 dark:bg-white/10',
            btn: 'bg-black hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-black border border-black dark:border-transparent shadow-sm',
            accent: 'slate'
        }
    };

    const theme = config[type] || config.info;

    const modalVariants = {
        hidden: { 
            opacity: 0, 
            y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 40,
            scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.9
        },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: 'spring', damping: 25, stiffness: 400 }
        },
        exit: { 
            opacity: 0, 
            y: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 40,
            scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.9,
            transition: { duration: 0.2, ease: "easeIn" }
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center sm:items-center justify-center sm:p-4 overflow-hidden">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-[90%] max-w-[380px] sm:w-full mx-auto bottom-0 sm:bottom-auto fixed sm:relative bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-200 dark:border-white/15 overflow-hidden"
            >
                {/* Drag handle for mobile */}
                <div className="sm:hidden w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mt-4 mb-2" />

                <div className="p-8 sm:p-10 text-center">
                    {/* Animated Icon Container */}
                    <div className="relative mb-6 flex justify-center">
                        <motion.div 
                            className={`w-16 h-16 ${theme.bg} rounded-2xl flex items-center justify-center ${theme.color} relative z-10`}
                            initial={{ rotate: -20, scale: 0, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            transition={{ 
                                type: 'spring', 
                                damping: 12, 
                                stiffness: 200,
                                delay: 0.15
                            }}
                        >
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.04, 1],
                                    rotate: [0, 1, -1, 0],
                                }}
                                transition={{ 
                                    duration: 3, 
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            >
                                {theme.icon}
                            </motion.div>
                        </motion.div>
                        
                        {/* Outer pulsing ring */}
                        <motion.div 
                            className={`absolute inset-0 m-auto w-16 h-16 rounded-2xl border-2 border-current opacity-10`}
                            initial={{ scale: 1, opacity: 0 }}
                            animate={{ scale: [1, 1.4], opacity: [0.2, 0] }}
                            transition={{ 
                                duration: 2.5, 
                                repeat: Infinity,
                                ease: "easeOut",
                                delay: 0.5
                            }}
                        />
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-3 uppercase leading-none">
                        {title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex p-5 sm:p-6 gap-3 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3.5 px-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`flex-1 py-3.5 px-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 ${theme.btn}`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin"></div>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};

export default ConfirmationModal;
