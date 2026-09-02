import React, { useMemo } from 'react';
import {
    ImageIcon,
    FileText,
    Presentation,
    FileSpreadsheet,
    File,
    Download,
    Maximize2,
    ExternalLink,
    Eye,
    Paperclip
} from 'lucide-react';

/**
 * Universal document classifier that detects and formats any document type:
 * Image (jpg, png, webp, etc.), PDF, Word (doc, docx), PowerPoint (ppt, pptx),
 * Excel/Spreadsheet (xls, xlsx, csv), Text, and other formats.
 */
export const getDocumentMeta = (attachment) => {
    if (!attachment) return null;
    const url = attachment.url || (typeof attachment === 'string' ? attachment : null);
    const fileName = attachment.fileName || attachment.file_name || (url ? url.split('?')[0].split('/').pop() : 'Document');
    const fileSize = attachment.fileSize || attachment.file_size || null;
    const fileType = attachment.fileType || attachment.file_type || '';

    const cleanUrl = String(url || '').split('?')[0].toLowerCase();
    const cleanName = String(fileName || '').toLowerCase();
    const cleanMime = String(fileType || '').toLowerCase();

    const getExt = () => {
        const nameExt = cleanName.split('.').pop();
        if (nameExt && nameExt !== cleanName && nameExt.length <= 6) return nameExt;
        const urlExt = cleanUrl.split('.').pop();
        if (urlExt && urlExt !== cleanUrl && urlExt.length <= 6) return urlExt;
        return '';
    };

    const ext = getExt();

    // 1. Images
    if (
        ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff', 'heic', 'ico', 'avif'].includes(ext) ||
        cleanMime.startsWith('image/')
    ) {
        return {
            category: 'image',
            typeLabel: 'Image File',
            badge: ext ? ext.toUpperCase() : 'IMG',
            badgeColor: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
            iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
            buttonColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
            url,
            fileName,
            fileSize,
            ext: ext || 'jpg',
            isImage: true
        };
    }

    // 2. PDF
    if (ext === 'pdf' || cleanMime.includes('pdf')) {
        return {
            category: 'pdf',
            typeLabel: 'PDF Document',
            badge: 'PDF',
            badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
            iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50',
            buttonColor: 'bg-rose-600 hover:bg-rose-700 text-white',
            url,
            fileName,
            fileSize,
            ext: 'pdf',
            isImage: false
        };
    }

    // 3. Microsoft Word (doc, docx, rtf, odt)
    if (
        ['doc', 'docx', 'rtf', 'odt'].includes(ext) ||
        cleanMime.includes('word') ||
        cleanMime.includes('officedocument.wordprocessingml')
    ) {
        return {
            category: 'word',
            typeLabel: 'Microsoft Word Document',
            badge: ext ? ext.toUpperCase() : 'DOCX',
            badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
            iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
            buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
            url,
            fileName,
            fileSize,
            ext: ext || 'docx',
            isImage: false
        };
    }

    // 4. Microsoft PowerPoint (ppt, pptx, odp)
    if (
        ['ppt', 'pptx', 'odp'].includes(ext) ||
        cleanMime.includes('powerpoint') ||
        cleanMime.includes('officedocument.presentationml')
    ) {
        return {
            category: 'powerpoint',
            typeLabel: 'PowerPoint Presentation',
            badge: ext ? ext.toUpperCase() : 'PPTX',
            badgeColor: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60',
            iconColor: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50',
            buttonColor: 'bg-orange-600 hover:bg-orange-700 text-white',
            url,
            fileName,
            fileSize,
            ext: ext || 'pptx',
            isImage: false
        };
    }

    // 5. Microsoft Excel / Spreadsheet (xls, xlsx, csv, ods)
    if (
        ['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext) ||
        cleanMime.includes('excel') ||
        cleanMime.includes('spreadsheet') ||
        cleanMime.includes('csv')
    ) {
        return {
            category: 'excel',
            typeLabel: ext === 'csv' ? 'CSV Data File' : 'Microsoft Excel Spreadsheet',
            badge: ext ? ext.toUpperCase() : 'XLSX',
            badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
            iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            buttonColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
            url,
            fileName,
            fileSize,
            ext: ext || 'xlsx',
            isImage: false
        };
    }

    // 6. Generic / Text / Archive / Other
    return {
        category: 'other',
        typeLabel: ext ? `${ext.toUpperCase()} Attachment` : 'Attached File',
        badge: ext ? ext.toUpperCase() : 'FILE',
        badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        iconColor: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
        buttonColor: 'bg-slate-700 hover:bg-slate-800 text-white',
        url,
        fileName,
        fileSize,
        ext: ext || 'file',
        isImage: false
    };
};

export const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function CorrectionDocumentCard({
    attachment,
    onPreviewImage,
    title = 'Uploaded Document / Proof',
    className = ''
}) {
    const meta = useMemo(() => getDocumentMeta(attachment), [attachment]);
    const formattedSize = meta?.fileSize ? formatFileSize(meta.fileSize) : null;

    const renderIcon = (size = 20) => {
        if (!meta) return <Paperclip size={size} />;
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

    return (
        <div className={`bg-white dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border p-4 shadow-2xs space-y-3 select-none ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${meta ? meta.iconColor : 'text-slate-500 bg-slate-100 dark:bg-slate-800'}`}>
                        {renderIcon(16)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
                                {title}
                            </h3>
                            {meta && (
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${meta.badgeColor}`}>
                                    {meta.badge}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-mono truncate max-w-sm mt-0.5">
                            {meta
                                ? `${meta.fileName}${formattedSize ? ` • ${formattedSize}` : ''}`
                                : 'No document attached'}
                        </p>
                    </div>
                </div>

                {meta?.url && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <a
                            href={meta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={meta.fileName}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                            title="Download file"
                        >
                            <Download size={14} />
                        </a>
                        <a
                            href={meta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                            title="Open in new window"
                        >
                            <ExternalLink size={14} />
                        </a>
                        <button
                            type="button"
                            onClick={() => onPreviewImage && onPreviewImage(meta.url)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 px-2.5 py-1 rounded-md hover:shadow-xs transition-all cursor-pointer"
                        >
                            <Maximize2 size={12} />
                            <span>{meta.isImage ? 'View Fullscreen' : 'Open Preview'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            {meta?.url ? (
                meta.isImage ? (
                    /* Image preview thumbnail */
                    <div
                        onClick={() => onPreviewImage && onPreviewImage(meta.url)}
                        className="group relative rounded-xl overflow-hidden bg-slate-950/5 dark:bg-black/40 border border-slate-200/80 dark:border-github-dark-border p-2 flex items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all max-h-72"
                        title="Click to view image in full-screen modal"
                    >
                        <img
                            src={meta.url}
                            alt={meta.fileName}
                            className="max-h-64 max-w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
                        />
                        <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs">
                            <div className="bg-slate-900/85 px-3 py-1.5 rounded-md flex items-center gap-2 text-white text-xs font-bold shadow-lg border border-white/20">
                                <Maximize2 size={13} />
                                <span>Click to expand image</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Non-image document tile (Word, PowerPoint, Excel, PDF, etc.) */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/80 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-xl gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${meta.iconColor}`}>
                                {renderIcon(24)}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                                        {meta.fileName}
                                    </p>
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${meta.badgeColor}`}>
                                        {meta.badge}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {meta.typeLabel} {formattedSize ? `• ${formattedSize}` : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <a
                                href={meta.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={meta.fileName}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            >
                                <Download size={13} />
                                <span>Download</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => onPreviewImage && onPreviewImage(meta.url)}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${meta.buttonColor}`}
                            >
                                <Eye size={13} />
                                <span>Open Document</span>
                            </button>
                        </div>
                    </div>
                )
            ) : (
                /* Empty state when no document was attached */
                <div className="flex items-center gap-2.5 p-3 bg-slate-50/60 dark:bg-github-dark-bg/30 border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400">
                    <Paperclip size={14} className="text-slate-400 shrink-0" />
                    <span>No supporting proof or document was uploaded with this request.</span>
                </div>
            )}
        </div>
    );
}
