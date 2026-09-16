import React from 'react';
import { X } from 'lucide-react';

const DocumentUploadModal = ({
    uploadModal,
    setUploadModal,
    uploadForm,
    setUploadForm,
    handleDocumentUploadSave
}) => {
    if (!uploadModal?.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center p-4 border-b border-slate-155 dark:border-github-dark-border">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Upload {uploadModal.docName}</h4>
                    <button
                        onClick={() => setUploadModal(prev => ({ ...prev, isOpen: false }))}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleDocumentUploadSave} className="p-4 space-y-4 text-xs">
                    <div>
                        <label className="block text-slate-450 font-semibold mb-1">File Name</label>
                        <input
                            type="text"
                            value={uploadForm.fileName}
                            onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-slate-450 font-semibold mb-1">Name Printed On Document</label>
                        <input
                            type="text"
                            value={uploadForm.nameOnDoc}
                            onChange={(e) => setUploadForm({ ...uploadForm, nameOnDoc: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-450 font-semibold mb-1">Expiry Date (Optional)</label>
                        <input
                            type="date"
                            value={uploadForm.expiryDate}
                            onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none"
                        />
                    </div>

                    {/* Simulation error toggles */}
                    <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border space-y-2 bg-indigo-50/20 dark:bg-indigo-950/10 p-3 rounded-lg">
                        <span className="block font-bold text-[9px] uppercase tracking-wider text-indigo-500">AI auditor simulations</span>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-github-dark-muted">
                            <input
                                type="checkbox"
                                checked={uploadForm.isExpiredSim}
                                onChange={(e) => setUploadForm({ ...uploadForm, isExpiredSim: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span>Simulate Expired Document Warning</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-github-dark-muted">
                            <input
                                type="checkbox"
                                checked={uploadForm.isMismatchSim}
                                onChange={(e) => setUploadForm({ ...uploadForm, isMismatchSim: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span>Simulate Spelling Name Mismatch warning</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setUploadModal(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-center"
                        >
                            Confirm Upload
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DocumentUploadModal;
