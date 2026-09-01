import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Plus, FileSpreadsheet, CheckCircle, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { DEFAULT_PREVIEW_WORKERS } from '../../utils/labourUtils';

const BulkLabourUploadModal = ({
    showBulkLabourModal,
    setShowBulkLabourModal,
    bulkFileInputRef,
    handleInstantFileParse,
    downloadCSVTemplate,
    isUploadingBulk,
    parsedLabours,
    setParsedLabours,
    selectedSite,
    handleSaveBulkLabours
}) => {
    return createPortal(
        <AnimatePresence>
            {showBulkLabourModal && (
                <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowBulkLabourModal(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="relative w-full max-w-2xl h-full bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#30363d] z-10"
                    >
                        {/* ── Header ── */}
                        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-100 dark:border-[#21262d] bg-slate-50/50 dark:bg-[#161b22]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <Upload size={16} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-[#f0f6fc]">Bulk Add Labours</h4>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Live preview & import worker profiles</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBulkLabourModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#30363d] transition-all cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* ── Action Toolbar ── */}
                        <div className="flex-shrink-0 p-3 bg-slate-50 dark:bg-[#161b22]/50 border-b border-slate-100 dark:border-[#21262d] flex flex-wrap items-center justify-between gap-2">
                            <input
                                type="file"
                                ref={bulkFileInputRef}
                                accept=".csv,.xlsx,.xls"
                                onChange={handleInstantFileParse}
                                className="hidden"
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => bulkFileInputRef.current?.click()}
                                    disabled={isUploadingBulk}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                                >
                                    <Upload size={13} />
                                    <span>{isUploadingBulk ? 'Parsing File...' : 'Upload File (Excel/CSV)'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={downloadCSVTemplate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#30363d] rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                >
                                    <FileSpreadsheet size={13} className="text-emerald-500" />
                                    <span>Template</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newRow = {
                                            id: `manual-${Date.now()}`,
                                            name: 'New Worker',
                                            role: 'Helper',
                                            monthly_salary: 500,
                                            wage_type: 'Daily Wage',
                                            phone: '',
                                            sex: 'Male',
                                            site_name: selectedSite ? selectedSite.site_name : '',
                                            site_id: selectedSite ? selectedSite.site_id : null,
                                            isValid: true,
                                            selected: true
                                        };
                                        setParsedLabours(prev => [newRow, ...prev]);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#30363d] rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                >
                                    <Plus size={13} className="text-indigo-500" />
                                    <span>Add Row</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setParsedLabours(DEFAULT_PREVIEW_WORKERS)}
                                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                                >
                                    Reset to Sample
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                    type="button"
                                    onClick={() => setParsedLabours([])}
                                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* ── Live Preview Table Container ── */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 dark:text-[#f0f6fc]">Instant Preview</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
                                        {parsedLabours.length} rows
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    {parsedLabours.filter(l => l.isValid && l.selected !== false).length} valid selected
                                </span>
                            </div>

                            {parsedLabours.length === 0 ? (
                                <div className="border border-dashed border-slate-200 dark:border-[#30363d] rounded-xl p-10 text-center">
                                    <Upload className="mx-auto text-slate-400 mb-2" size={28} />
                                    <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300">No workers in preview</h5>
                                    <p className="text-[11px] text-slate-400 mt-1">Upload a file or click "Reset to Sample" to preview rows.</p>
                                    <button
                                        type="button"
                                        onClick={() => setParsedLabours(DEFAULT_PREVIEW_WORKERS)}
                                        className="mt-3 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-100 cursor-pointer"
                                    >
                                        Load Sample Preview
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-[#30363d] rounded-xl overflow-hidden shadow-2xs">
                                    <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-[#161b22] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                    <th className="p-2.5 w-10 text-center">
                                                        <div
                                                            onClick={() => {
                                                                const allSelected = parsedLabours.every(l => l.selected !== false);
                                                                setParsedLabours(prev => prev.map(l => ({ ...l, selected: !allSelected })));
                                                            }}
                                                            className={`theme-checkbox ${parsedLabours.every(l => l.selected !== false) ? 'checked' : parsedLabours.some(l => l.selected !== false) ? 'indeterminate' : ''}`}
                                                        >
                                                            {parsedLabours.every(l => l.selected !== false) && (
                                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                                    <path d="M1.5 4L4 6.5L8.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                            {!parsedLabours.every(l => l.selected !== false) && parsedLabours.some(l => l.selected !== false) && (
                                                                <div className="w-2 h-0.5 bg-white rounded-full" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th className="p-2.5">Status</th>
                                                    <th className="p-2.5">Name</th>
                                                    <th className="p-2.5">Role</th>
                                                    <th className="p-2.5">Daily Wage</th>
                                                    <th className="p-2.5">Phone</th>
                                                    <th className="p-2.5">Site</th>
                                                    <th className="p-2.5 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#21262d] bg-white dark:bg-[#0d1117]">
                                                {parsedLabours.map((row, idx) => {
                                                    const isSelected = row.selected !== false;
                                                    return (
                                                        <tr
                                                            key={row.id || idx}
                                                            className={`hover:bg-slate-50/60 dark:hover:bg-[#161b22]/50 transition-colors ${!isSelected ? 'opacity-50' : ''}`}
                                                        >
                                                            <td className="p-2.5 text-center">
                                                                <div
                                                                    onClick={() => {
                                                                        setParsedLabours(prev => prev.map((item, i) => i === idx ? { ...item, selected: !isSelected } : item));
                                                                    }}
                                                                    className={`theme-checkbox ${isSelected ? 'checked' : ''}`}
                                                                >
                                                                    {isSelected && (
                                                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                                            <path d="M1.5 4L4 6.5L8.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-2.5">
                                                                {row.isValid ? (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                                                        <CheckCircle size={12} /> Ready
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-rose-500 font-semibold text-[10px]" title={row.error}>
                                                                        <AlertTriangle size={12} /> Error
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-2.5 font-bold text-slate-800 dark:text-[#f0f6fc]">
                                                                {row.name}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-900/40">
                                                                    {row.role || 'Unspecified'}
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 font-mono text-slate-700 dark:text-[#c9d1d9]">
                                                                ₹{row.monthly_salary}
                                                            </td>
                                                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">
                                                                {row.phone || '-'}
                                                            </td>
                                                            <td className="p-2.5 text-slate-500 text-[10px] truncate max-w-[100px]">
                                                                {row.site_name || <span className="italic text-slate-400">Unassigned</span>}
                                                            </td>
                                                            <td className="p-2.5 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setParsedLabours(prev => prev.filter((_, i) => i !== idx))}
                                                                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                                                    title="Remove Row"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Sticky Action Bar ── */}
                        <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-[#21262d] bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-sm flex items-center justify-between gap-3">
                            <div className="text-xs">
                                <span className="text-slate-400">Total Selected: </span>
                                <strong className="text-indigo-600 dark:text-indigo-400">
                                    {parsedLabours.filter(l => l.isValid && l.selected !== false).length}
                                </strong>
                                <span className="text-slate-400"> / {parsedLabours.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkLabourModal(false)}
                                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#21262d] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#30363d] transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveBulkLabours}
                                    disabled={isUploadingBulk || parsedLabours.filter(l => l.isValid && l.selected !== false).length === 0}
                                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    {isUploadingBulk ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                    <span>Import {parsedLabours.filter(l => l.isValid && l.selected !== false).length} Workers</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default BulkLabourUploadModal;
