import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Download,
    ExternalLink,
    Eye,
    ImageIcon,
    FileText,
    Presentation,
    FileSpreadsheet,
    File
} from 'lucide-react';
import { getDocumentMeta, formatFileSize } from './CorrectionDocumentCard';

export default function CorrectionDocumentModal({
    previewUrl,
    fileName,
    fileSize,
    fileType,
    onClose
}) {
    const meta = useMemo(() => {
        if (!previewUrl) return null;
        return getDocumentMeta({
            url: previewUrl,
            fileName: fileName || '',
            fileSize: fileSize || null,
            fileType: fileType || ''
        });
    }, [previewUrl, fileName, fileSize, fileType]);

    if (!previewUrl || !meta) return null;

    const formattedSize = meta.fileSize ? formatFileSize(meta.fileSize) : null;

    const renderModalIcon = (size = 32) => {
        switch (meta.category) {
            case 'image':
                return <ImageIcon size={size} />;
            case 'pdf':
                return <FileText size={size} />;
            case 'word':
                return <FileText size={size} />;
            case 'powerpoint':
                return <Presentation size={size} />;
            case 'excel':
                return <FileSpreadsheet size={size} />;
            default:
                return <File size={size} />;
        }
    };

    // Office Online viewer URL for doc, docx, ppt, pptx, xls, xlsx
    const officeViewerUrl = ['word', 'powerpoint', 'excel'].includes(meta.category)
        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(previewUrl)}`
        : null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="relative max-w-5xl w-full bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header bar */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${meta.iconColor}`}>
                                {renderModalIcon(16)}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                                        {meta.typeLabel}
                                    </h4>
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${meta.badgeColor}`}>
                                        {meta.badge}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                                    {meta.fileName} {formattedSize ? `• ${formattedSize}` : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {officeViewerUrl && (
                                <a
                                    href={officeViewerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                                    title="Open document in Microsoft Office Online viewer"
                                >
                                    <ExternalLink size={13} />
                                    <span>Office Viewer</span>
                                </a>
                            )}
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                                title="Open in new window"
                            >
                                <ExternalLink size={15} />
                            </a>
                            <a
                                href={previewUrl}
                                download={meta.fileName}
                                className="p-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                                title="Download file"
                            >
                                <Download size={15} />
                            </a>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-md bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer ml-1"
                                title="Close preview"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
                        {meta.isImage ? (
                            /* Image viewer */
                            <div className="rounded-xl overflow-hidden bg-black/60 w-full max-h-[78vh] flex items-center justify-center p-2">
                                <img
                                    src={previewUrl}
                                    alt={meta.fileName}
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                                />
                            </div>
                        ) : meta.category === 'pdf' ? (
                            /* PDF Viewer iframe */
                            <div className="w-full h-[78vh] rounded-xl overflow-hidden bg-white">
                                <iframe
                                    src={previewUrl}
                                    title="PDF Document Viewer"
                                    className="w-full h-full border-0"
                                />
                            </div>
                        ) : (
                            /* Word, PowerPoint, Excel, and Other Documents */
                            <div className="py-12 px-6 flex flex-col items-center text-center max-w-xl mx-auto">
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 ${meta.iconColor} shadow-xl shadow-black/30`}>
                                    {renderModalIcon(40)}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {meta.fileName}
                                </h3>
                                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                                    This is a <strong className="text-slate-200">{meta.typeLabel}</strong>. You can preview it using Microsoft Office Online, open the original file in a new window, or download it to open in your desktop application.
                                </p>

                                <div className="flex flex-wrap items-center justify-center gap-3">
                                    {officeViewerUrl && (
                                        <a
                                            href={officeViewerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                                        >
                                            <ExternalLink size={14} /> Open in Office Online
                                        </a>
                                    )}
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
                                    >
                                        <Eye size={14} /> Open Direct URL
                                    </a>
                                    <a
                                        href={previewUrl}
                                        download={meta.fileName}
                                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
                                    >
                                        <Download size={14} /> Download File
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
