import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DownloadCloud,
    X,
    FileText,
    FileType,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

const ExportHistoryDrawer = ({
    isOpen,
    exportHistory = [],
    onClose
}) => {
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-xs cursor-pointer"
                    />

                    {/* Drawer container */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white dark:bg-[#161b22] border-l border-slate-200 dark:border-[#30363d] shadow-2xl z-[101] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-[#30363d] bg-slate-50/50 dark:bg-github-dark-subtle/10 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-xs uppercase tracking-wider">
                                <DownloadCloud className="text-slate-400" size={16} />
                                Export History
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors cursor-pointer"
                                aria-label="Close export history"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-3 bg-[#f6f8fa] dark:bg-[#0d1117] min-h-[300px]">
                            {exportHistory.length > 0 ? (
                                exportHistory.map((file) => (
                                    <div
                                        key={file.id}
                                        className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl p-3.5 space-y-2.5 transition-all hover:bg-slate-50 dark:hover:bg-[#21262d] shadow-sm"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 ${file.name.endsWith('.pdf') ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' :
                                                file.name.endsWith('.csv') ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' :
                                                    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                                }`}>
                                                {file.name.endsWith('.pdf') ? <FileText size={16} /> : file.name.endsWith('.csv') ? <FileType size={16} /> : <FileSpreadsheet size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold text-slate-800 dark:text-github-dark-text truncate leading-tight uppercase">{file.type}</p>
                                                <p className="text-[9px] text-slate-400 dark:text-github-dark-muted mt-0.5">{file.size}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#30363d]">
                                            <span className="text-[9px] font-medium text-slate-400 dark:text-github-dark-muted">{file.date?.split(',')[0]}</span>
                                            <div>
                                                {file.status === 'Ready' ? (
                                                    <a
                                                        href={file.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download={file.name}
                                                        className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded cursor-pointer uppercase hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <CheckCircle size={10} /> Download
                                                    </a>
                                                ) : file.status === 'Generating' ? (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-1 rounded uppercase animate-pulse">
                                                        <div className="w-2.5 h-2.5 border border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div> Compiling
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded uppercase">
                                                        <AlertCircle size={10} /> Failed
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                                    <DownloadCloud className="text-slate-200 dark:text-slate-700" size={32} />
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">No past exports</p>
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

export default ExportHistoryDrawer;
