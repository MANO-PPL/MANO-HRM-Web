import React from 'react';
import { FileText, Download, Eye, Check, X, Trash2, Upload } from 'lucide-react';

const DocumentsTab = ({
    selectedEmployee,
    onboardingData = {},
    documentTemplates = [],
    currentUser,
    bulkSelectMode,
    setBulkSelectMode,
    selectedDocIdsForZip = [],
    setSelectedDocIdsForZip,
    handleDocumentTemplateChange,
    handleDownloadZip,
    handleRestoreDocExclusions,
    handleViewDocument,
    handleVerifyDocument,
    handleDeleteDocument,
    handleDirectDocumentUpload,
    handleExcludeDocItem
}) => {
    if (!selectedEmployee) return null;

    const profile = selectedEmployee.profile || {};
    const activeDocTemplateId = onboardingData.document_template_id || (documentTemplates[0]?.id || '');
    const exclusions = profile.document_exclusions || [];

    // Construct categories map from flat required documents list
    const categoriesMap = {};
    (onboardingData.required_documents || []).forEach(reqDoc => {
        if (!categoriesMap[reqDoc.category]) {
            categoriesMap[reqDoc.category] = { id: reqDoc.category, name: reqDoc.category, items: [] };
        }
        categoriesMap[reqDoc.category].items.push({
            key: reqDoc.doc_key,
            name: reqDoc.doc_label,
            required: !!reqDoc.is_mandatory
        });
    });
    const categories = Object.values(categoriesMap);
    const isAdminOrHr = currentUser?.user_type === 'admin' || currentUser?.user_type === 'hr';

    return (
        <div className="space-y-6">
            {/* Template assignment & header */}
            <div className="bg-slate-50 dark:bg-github-dark-subtle/25 border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex justify-between items-center gap-3">
                <div>
                    <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-1">Document Template</span>
                    <select
                        value={activeDocTemplateId}
                        onChange={(e) => handleDocumentTemplateChange(e.target.value)}
                        className="bg-transparent border-none p-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer hover:underline"
                    >
                        {documentTemplates.map(t => (
                            <option key={t.id} value={t.id} className="bg-white dark:bg-dark-card text-slate-800 dark:text-github-dark-text">{t.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2.5">
                    {onboardingData.uploaded_documents?.length > 0 && (
                        <button
                            onClick={() => {
                                setBulkSelectMode(!bulkSelectMode);
                                setSelectedDocIdsForZip([]);
                            }}
                            className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                bulkSelectMode
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900"
                                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50 dark:bg-github-dark-subtle dark:border-github-dark-border dark:text-slate-350"
                            }`}
                        >
                            <span>{bulkSelectMode ? "Exit Select" : "Select & Download"}</span>
                        </button>
                    )}
                    {exclusions.length > 0 && (
                        <div className="text-right flex items-center gap-2 border-l border-slate-200 dark:border-github-dark-border pl-2.5">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{exclusions.length} excluded</span>
                            <button
                                onClick={handleRestoreDocExclusions}
                                className="text-[9px] font-bold underline uppercase text-amber-600 dark:text-amber-400 hover:text-amber-700"
                            >
                                Restore All
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {bulkSelectMode && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950/30 p-3.5 rounded-xl flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selectedDocIdsForZip.length === (onboardingData.uploaded_documents?.length || 0) && (onboardingData.uploaded_documents?.length || 0) > 0}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setSelectedDocIdsForZip((onboardingData.uploaded_documents || []).map(d => d.id));
                                } else {
                                    setSelectedDocIdsForZip([]);
                                }
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 dark:border-github-dark-border focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">
                            {selectedDocIdsForZip.length} of {onboardingData.uploaded_documents?.length || 0} selected
                        </span>
                    </div>
                    <button
                        onClick={handleDownloadZip}
                        disabled={selectedDocIdsForZip.length === 0}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                    >
                        <Download size={12} />
                        <span>Download ZIP</span>
                    </button>
                </div>
            )}

            <div className="space-y-6">
                {categories.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 italic">
                        No document categories configured for this template.
                    </div>
                ) : (
                    categories.map((cat) => {
                        const activeItems = cat.items?.filter(item => !exclusions.includes(item.key)) || [];
                        if (activeItems.length === 0 && (cat.items || []).length > 0) return null;
                        return (
                            <div key={cat.id} className="space-y-2 bg-slate-50/50 dark:bg-[#161b22]/10 border border-slate-155/40 dark:border-github-dark-border p-4 rounded-xl">
                                <h5 className="font-bold text-[10px] uppercase text-indigo-500 tracking-wider mb-2">{cat.name}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {activeItems.length === 0 ? (
                                        <div className="text-slate-405 italic text-xs py-2 col-span-2">No files configured in this category.</div>
                                    ) : (
                                        activeItems.map((item) => {
                                            const doc = (onboardingData.uploaded_documents || []).find(d => d.doc_key === item.key);
                                            const isUploaded = !!doc;

                                            return (
                                                <div key={item.key} className="flex justify-between items-center p-3 bg-white dark:bg-[#161b22]/30 border border-slate-200/60 dark:border-github-dark-border rounded-lg shadow-sm group/docrow">
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        {bulkSelectMode && isUploaded ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDocIdsForZip.includes(doc.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedDocIdsForZip(prev => [...prev, doc.id]);
                                                                    } else {
                                                                        setSelectedDocIdsForZip(prev => prev.filter(id => id !== doc.id));
                                                                    }
                                                                }}
                                                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 dark:border-github-dark-border focus:ring-indigo-500 mr-1 shrink-0"
                                                            />
                                                        ) : (
                                                            <FileText size={16} className={isUploaded ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                                                        )}
                                                        <div className="truncate">
                                                            <p className="font-bold text-slate-800 dark:text-github-dark-text truncate">
                                                                {item.name} {item.required && <span className="text-red-500">*</span>}
                                                            </p>
                                                            {isUploaded ? (
                                                                <>
                                                                    <p className="text-[9px] text-slate-400 font-medium font-mono truncate">{doc.file_name}</p>
                                                                    {doc.verification_comments && (
                                                                        <p className="text-[9px] text-red-500 italic mt-0.5">Reason: {doc.verification_comments}</p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <p className="text-[9px] text-slate-400 italic">Not submitted</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {isUploaded ? (
                                                            <>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                                                    doc.verified_status === 'Verified' ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/20' :
                                                                    doc.verified_status === 'Rejected' ? 'bg-red-50 text-red-650 dark:bg-red-950/20' :
                                                                    'bg-amber-50 text-amber-650 dark:bg-amber-950/20'
                                                                }`}>
                                                                    {doc.verified_status}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleViewDocument(doc.id)}
                                                                    className="p-1 hover:bg-slate-105 text-slate-400 hover:text-indigo-500 rounded"
                                                                    title="Download/View file"
                                                                >
                                                                    <Eye size={13} />
                                                                </button>
                                                                {isAdminOrHr && doc.verified_status !== 'Verified' && (
                                                                    <button
                                                                        onClick={() => handleVerifyDocument(doc.id, 'Verified')}
                                                                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded transition-colors"
                                                                        title="Verify/Approve Document"
                                                                    >
                                                                        <Check size={13} />
                                                                    </button>
                                                                )}
                                                                {isAdminOrHr && doc.verified_status !== 'Rejected' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const reason = prompt("Enter rejection reason:");
                                                                            if (reason !== null) {
                                                                                handleVerifyDocument(doc.id, 'Rejected', reason);
                                                                            }
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                                                        title="Reject Document"
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteDocument(doc.id, item.name)}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded"
                                                                    title="Delete uploaded file"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleDirectDocumentUpload(item.key, item.name)}
                                                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded border border-slate-200 dark:border-github-dark-border"
                                                            >
                                                                <Upload size={10} />
                                                                <span>Upload</span>
                                                            </button>
                                                        )}

                                                        {/* Exclude file field button */}
                                                        <button
                                                            onClick={() => handleExcludeDocItem(item.key)}
                                                            className="opacity-0 group-hover/docrow:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-555 rounded"
                                                            title="Exclude document field for this employee"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DocumentsTab;
