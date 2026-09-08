import React, { useMemo, useState } from 'react';
import {
    ImageIcon,
    FileText,
    Presentation,
    FileSpreadsheet,
    File,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    Paperclip,
    ChevronDown,
    ChevronUp
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
            badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
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
            badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
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
            badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
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
            badgeColor: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60',
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
            badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
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
    title = 'Uploaded Proof',
    className = '',
    defaultOpen = true
}) {
    const [showPreview, setShowPreview] = useState(defaultOpen);
    const [docViewerProvider, setDocViewerProvider] = useState('office'); // 'office' | 'google'

    const meta = useMemo(() => getDocumentMeta(attachment), [attachment]);
    const formattedSize = meta?.fileSize ? formatFileSize(meta.fileSize) : null;

    const renderIcon = (size = 18) => {
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

    // Construct preview URL for Office or Google Viewer
    const encodedUrl = meta?.url ? encodeURIComponent(meta.url) : '';
    const officeEmbedUrl = encodedUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}` : '';
    const googleDocsEmbedUrl = encodedUrl ? `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true` : '';

    return (
        <div className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border p-3.5 shadow-2xs select-none ${className}`}>
            {/* Single Header Row: Icon, File Info, and Action Buttons (No Nesting, No Repetition) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta ? meta.iconColor : 'text-slate-500 bg-slate-100 dark:bg-slate-800'}`}>
                        {renderIcon(16)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {title}
                            </h3>
                            {meta && (
                                <span className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border uppercase ${meta.badgeColor}`}>
                                    {meta.badge}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate max-w-sm mt-0.5">
                            {meta ? (
                                <>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{meta.fileName}</span>
                                    {formattedSize && <span className="text-slate-400"> • {formattedSize}</span>}
                                </>
                            ) : (
                                'No document attached'
                            )}
                        </p>
                    </div>
                </div>

                {meta?.url && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        {/* Toggle In-Page Preview Button */}
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                showPreview
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                                    : 'bg-white dark:bg-github-dark-bg text-slate-700 dark:text-slate-300 border-slate-200 dark:border-github-dark-border hover:bg-slate-50'
                            }`}
                            title={showPreview ? 'Hide in-page preview' : 'Open in-page preview'}
                        >
                            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{showPreview ? 'Hide Preview' : 'Preview'}</span>
                            {showPreview ? <ChevronUp size={12} className="opacity-60" /> : <ChevronDown size={12} className="opacity-60" />}
                        </button>

                        {/* Download Button */}
                        <a
                            href={meta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={meta.fileName}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-github-dark-border bg-white dark:bg-github-dark-bg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-github-dark-subtle transition-colors cursor-pointer"
                            title="Download file"
                        >
                            <Download size={13} />
                            <span>Download</span>
                        </a>

                        {/* Open in New Tab Button */}
                        <a
                            href={meta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-subtle transition-colors cursor-pointer"
                            title="Open in new window"
                        >
                            <ExternalLink size={14} />
                        </a>
                    </div>
                )}
            </div>

            {/* In-Page Preview Area (Opens directly in the same page with iframe) */}
            {meta?.url && showPreview && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-github-dark-border space-y-2">
                    {/* Image Preview */}
                    {meta.isImage ? (
                        <div className="rounded-lg overflow-hidden bg-slate-50/70 dark:bg-black/30 border border-slate-200/80 dark:border-github-dark-border flex items-center justify-center p-3 max-h-[480px]">
                            <img
                                src={meta.url}
                                alt={meta.fileName}
                                className="max-h-[450px] max-w-full object-contain rounded-md shadow-2xs"
                            />
                        </div>
                    ) : meta.category === 'pdf' ? (
                        /* Native PDF iframe in page */
                        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-github-dark-border bg-white shadow-2xs">
                            <iframe
                                src={`${meta.url}#toolbar=1`}
                                title={meta.fileName}
                                className="w-full h-[450px] border-0"
                            />
                        </div>
                    ) : ['excel', 'word', 'powerpoint'].includes(meta.category) ? (
                        /* Office / Google Docs iframe in page */
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-medium text-slate-500">Viewer:</span>
                                    <button
                                        type="button"
                                        onClick={() => setDocViewerProvider('office')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                            docViewerProvider === 'office'
                                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Office Viewer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDocViewerProvider('google')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                            docViewerProvider === 'google'
                                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Google Viewer
                                    </button>
                                </div>
                                <a
                                    href={meta.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                    <span>Direct file link</span>
                                    <ExternalLink size={10} />
                                </a>
                            </div>

                            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-github-dark-border bg-white shadow-2xs">
                                <iframe
                                    src={docViewerProvider === 'office' ? officeEmbedUrl : googleDocsEmbedUrl}
                                    title={meta.fileName}
                                    className="w-full h-[450px] border-0"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    ) : (
                        /* Generic iframe in page */
                        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-github-dark-border bg-white shadow-2xs">
                            <iframe
                                src={meta.url}
                                title={meta.fileName}
                                className="w-full h-[400px] border-0"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Empty state if no document was attached */}
            {!meta?.url && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-github-dark-bg/30 border border-dashed border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-400 font-normal">
                    <Paperclip size={13} className="text-slate-400 shrink-0" />
                    <span>No supporting proof or document was uploaded with this request.</span>
                </div>
            )}
        </div>
    );
}
