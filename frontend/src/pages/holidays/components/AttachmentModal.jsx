import React from 'react';
import { FileText, Download, X, Image as ImageIcon } from 'lucide-react';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
                <div className="relative z-10 bg-white dark:bg-github-dark-subtle rounded-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-sm">
                                    {(file.file_key || file.name)?.split('/').pop() || 'Attachment'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                    {file.file_type || 'Unknown Type'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a href={file.file_url} download target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Download">
                                <Download size={20} />
                            </a>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 p-4 flex items-center justify-center overflow-hidden relative">
                        {isImage ? (
                            <img src={file.file_url} alt="Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                        ) : isPdf ? (
                            <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-github-dark-border bg-white" title="PDF Viewer"></iframe>
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-500 dark:text-github-dark-muted mb-4">This file type cannot be previewed.</p>
                                <a href={file.file_url} download className="text-indigo-600 hover:underline">Download to view</a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttachmentModal;
