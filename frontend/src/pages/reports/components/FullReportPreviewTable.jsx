import React from 'react';
import { Table } from 'lucide-react';
import { getAlignmentClass, getCellStyle } from './reportsUtils';

const FullReportPreviewTable = ({
    activeFilters,
    previewData,
    loadingPreview,
    cacheHit
}) => {
    return (
        <div className="w-full flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden">
            {/* Card Header */}
            <div className="p-3 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center shrink-0">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-sm">
                        <Table className="text-slate-400" size={16} />
                        Report Preview Data
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-1 leading-none">
                        Active report: <span className="font-bold text-slate-600 dark:text-slate-300">{activeFilters.reportType?.replace(/_/g, ' ')}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {previewData.rows?.length > 0 && (
                        <span className="px-2.5 py-1 text-[10px] font-bold text-[#57606a] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#161b22] rounded-full border border-[#d0d7de] dark:border-[#30363d]">
                            {previewData.rows.filter(row => {
                                const firstCell = row[0]?.toString().toUpperCase();
                                return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
                            }).length} Records
                        </span>
                    )}
                    {cacheHit && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-full border border-indigo-200/50 dark:border-indigo-800/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Refreshing
                        </span>
                    )}
                </div>
            </div>

            {/* Preview Body */}
            <div className="w-full bg-slate-100 dark:bg-github-dark-bg border-t border-slate-200 dark:border-github-dark-border p-2 sm:p-3">
                {loadingPreview ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-500 text-sm font-medium">Crunching and parsing preview records...</p>
                    </div>
                ) : (previewData.rows && previewData.rows.length > 0) ? (
                    /* Spreadsheet View: Premium Excel-replica table directly rendered */
                    <div
                        className="rounded-xl overflow-auto table-scrollbar border border-slate-300 dark:border-[#30363d] shadow-md"
                        style={{ maxHeight: 'calc(100vh - 290px)', minHeight: '320px' }}
                    >
                        <table
                            className="w-full text-left border-collapse bg-white"
                            style={{ fontFamily: '"Segoe UI", Calibri, Arial, sans-serif', fontSize: '11.5px', minWidth: 'max-content' }}
                        >
                            <thead className="sticky top-0 z-20 shadow-xs">
                                    {previewData.headers ? (
                                        <>
                                            {/* Row 1 - group headers */}
                                            <tr>
                                                {/* Row # column */}
                                                <th style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', width: '36px', minWidth: '36px' }}
                                                    className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wider">#</th>
                                                {previewData.headers[0].map((cell, idx) => (
                                                    <th
                                                        key={idx}
                                                        rowSpan={cell.rowspan}
                                                        colSpan={cell.colspan}
                                                        className="px-4 py-2.5 whitespace-nowrap tracking-wide text-center text-[10px] font-black uppercase"
                                                        style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', letterSpacing: '0.04em' }}
                                                    >
                                                        {cell.label}
                                                    </th>
                                                ))}
                                            </tr>
                                            {/* Row 2 - sub-headers */}
                                            <tr>
                                                {previewData.headers[1].map((cell, idx) => (
                                                    <th
                                                        key={idx}
                                                        className="px-3 py-2 whitespace-nowrap tracking-wide text-center text-[10px] font-bold uppercase"
                                                        style={{ backgroundColor: '#2E6DA4', color: '#E8F4FD', border: '1px solid #3B82F6', letterSpacing: '0.03em' }}
                                                    >
                                                        {cell.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </>
                                    ) : (
                                        <tr>
                                            {/* Row # column */}
                                            <th style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', width: '36px', minWidth: '36px' }}
                                                className="px-2 py-3 text-center text-[9px] font-bold uppercase">#</th>
                                            {previewData.columns.map((col, idx) => {
                                                const alignment = getAlignmentClass(col);
                                                return (
                                                    <th
                                                        key={idx}
                                                        className="px-4 py-3 whitespace-nowrap tracking-wide text-[10px] font-black uppercase"
                                                        style={{
                                                            backgroundColor: '#1F4E78',
                                                            color: '#FFFFFF',
                                                            border: '1px solid #2563EB',
                                                            textAlign: alignment,
                                                            letterSpacing: '0.04em'
                                                        }}
                                                    >
                                                        {col?.toString().split('\n').map((line, lIdx) => (
                                                            <div key={lIdx} className="leading-snug">{line}</div>
                                                        ))}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {previewData.rows.map((row, rIdx) => {
                                        const isTotalsRow = row[0]?.toString().toUpperCase() === 'TOTALS';
                                        const isEven = rIdx % 2 === 0;
                                        return (
                                            <tr
                                                key={rIdx}
                                                className={`transition-colors ${isTotalsRow ? '' : 'hover:brightness-95'}`}
                                                style={isTotalsRow ? { position: 'relative' } : {}}
                                            >
                                                {/* Row number cell */}
                                                <td
                                                    className="text-center text-[9px] font-semibold select-none"
                                                    style={{
                                                        backgroundColor: isTotalsRow ? '#dce8f5' : isEven ? '#EFF6FF' : '#F8FAFD',
                                                        color: '#64748B',
                                                        border: '1px solid #E2E8F0',
                                                        borderRight: '2px solid #CBD5E1',
                                                        width: '36px',
                                                        minWidth: '36px',
                                                        paddingTop: '6px',
                                                        paddingBottom: '6px',
                                                    }}
                                                >
                                                    {isTotalsRow ? '∑' : rIdx + 1}
                                                </td>
                                                {row.map((cell, cIdx) => {
                                                    const colHeader = previewData.columns[cIdx]?.toString() || '';
                                                    const cellStyle = getCellStyle(cell, colHeader, isTotalsRow, isEven, rIdx);
                                                    const alignment = getAlignmentClass(colHeader);
                                                    return (
                                                        <td
                                                            key={cIdx}
                                                            className="px-4 whitespace-nowrap transition-colors"
                                                            style={{ ...cellStyle, textAlign: alignment, paddingTop: '6px', paddingBottom: '6px' }}
                                                        >
                                                            {cell?.toString().split('\n').map((line, lIdx) => (
                                                                <div key={lIdx} className="leading-normal">{line}</div>
                                                            ))}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white dark:bg-dark-card border border-dashed border-slate-200 dark:border-github-dark-border rounded-xl">
                        <Table className="text-slate-200 dark:text-slate-700" size={48} />
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No preview records loaded for this filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FullReportPreviewTable;
