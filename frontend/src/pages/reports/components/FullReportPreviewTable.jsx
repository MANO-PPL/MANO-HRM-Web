import React, { useState, useEffect, useMemo } from 'react';
import { Table, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { getAlignmentClass, getCellStyle, compareSortValues } from './reportsUtils';
import MusterRollPreviewTable from './MusterRollPreviewTable';
import EmployeeMasterPreviewTable from './EmployeeMasterPreviewTable';

const rowIsTotals = (row) => {
    const firstCell = row[0]?.toString().toUpperCase();
    return firstCell === 'TOTALS' || firstCell === 'TOTAL';
};

const FullReportPreviewTable = ({
    activeFilters,
    previewData,
    loadingPreview,
    cacheHit
}) => {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Reset sort and search when preview data or report type changes
    useEffect(() => {
        setSortColumn(null);
        setSortDirection('asc');
        setSearchQuery('');
        setStatusFilter('All');
    }, [activeFilters.reportType, previewData]);

    const handleSort = (colName) => {
        if (sortColumn === colName) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(colName);
            setSortDirection('asc');
        }
    };

    const sortedRows = useMemo(() => {
        const rows = previewData.rows || [];
        if (!sortColumn || previewData.headers) return rows;
        const colIdx = previewData.columns?.indexOf(sortColumn);
        if (colIdx === undefined || colIdx === -1) return rows;

        const dataRows = [];
        const totalsRows = [];
        rows.forEach(row => (rowIsTotals(row) ? totalsRows.push(row) : dataRows.push(row)));

        dataRows.sort((a, b) => compareSortValues(a[colIdx], b[colIdx], sortColumn, sortDirection));
        return [...dataRows, ...totalsRows];
    }, [previewData, sortColumn, sortDirection]);

    const displayRows = useMemo(() => {
        if (!searchQuery.trim()) return sortedRows;
        const q = searchQuery.toLowerCase().trim();
        return sortedRows.filter(row => {
            if (rowIsTotals(row)) return true;
            return row.some(cell => (cell || '').toString().toLowerCase().includes(q));
        });
    }, [sortedRows, searchQuery]);

    const empCounts = useMemo(() => {
        const users = previewData.users || [];
        if (users.length > 0) {
            let active = 0, inactive = 0, deleted = 0;
            users.forEach(u => {
                const s = (u.status || '').toLowerCase();
                if (s === 'active') active++;
                else if (s === 'deleted') deleted++;
                else inactive++;
            });
            return { total: users.length, active, inactive, deleted };
        }
        const rows = previewData.rows || [];
        const cols = previewData.columns || [];
        const statusIdx = cols.findIndex(c => (c || '').toString().toLowerCase() === 'status');
        let active = 0, inactive = 0, deleted = 0;
        rows.forEach(r => {
            const s = (statusIdx !== -1 ? r[statusIdx] : r[9] || '').toString().toLowerCase();
            if (s === 'active') active++;
            else if (s === 'deleted') deleted++;
            else inactive++;
        });
        return { total: rows.length, active, inactive, deleted };
    }, [previewData]);

    const totalRecordCount = useMemo(() => {
        if (activeFilters.reportType === 'employee_master') {
            return empCounts.total;
        }
        if (previewData.musterRoll) {
            return previewData.musterRoll.employees?.length || 0;
        }
        return previewData.rows
            ? previewData.rows.filter(row => {
                  const firstCell = row[0]?.toString().toUpperCase();
                  return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
              }).length
            : 0;
    }, [activeFilters.reportType, empCounts.total, previewData]);

    const printStats = useMemo(() => {
        if (activeFilters.reportType === 'employee_master') {
            return empCounts;
        }
        if (previewData.musterRoll) {
            return {
                total: previewData.musterRoll.employees?.length || 0,
                monthTitle: previewData.musterRoll.monthTitle
            };
        }
        return { total: totalRecordCount };
    }, [activeFilters.reportType, empCounts, totalRecordCount, previewData.musterRoll]);

    return (
        <div className="w-full flex flex-col bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden print:border-none print:shadow-none print:rounded-none">
            {/* Unified Card Header: Single Line for Title, Inline Legend/Filter, Search, and Count */}
            <div className="p-3 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/60 dark:bg-github-dark-subtle/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 no-print">
                {/* Left: Title + Active Report */}
                <div className="flex items-center gap-2 shrink-0">
                    <Table className="text-slate-400" size={16} />
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm whitespace-nowrap">
                        Report Preview Data
                    </h3>
                    <span className="text-[11px] text-slate-400 dark:text-github-dark-muted font-normal ml-0.5 hidden sm:inline">
                        ({activeFilters.reportType?.replace(/_/g, ' ')})
                    </span>
                </div>

                {/* Middle: Inline Legend (Muster Roll) OR Filter Chips (Employee Master) */}
                {previewData.musterRoll ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                            Legend:
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-rose-800 font-semibold bg-[#FEE2E2] border border-rose-200 text-[10.5px]">
                            Absent (0.0)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-amber-900 font-semibold bg-[#FEF9C3] border border-amber-200 text-[10.5px]">
                            Holiday / Sunday (1.0)
                        </span>
                    </div>
                ) : activeFilters.reportType === 'employee_master' ? (
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mr-0.5">
                            Filter:
                        </span>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('All')}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                statusFilter === 'All'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            All ({empCounts.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter(statusFilter === 'Active' ? 'All' : 'Active')}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                statusFilter === 'Active'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            }`}
                        >
                            Active ({empCounts.active})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter(statusFilter === 'Inactive' ? 'All' : 'Inactive')}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                statusFilter === 'Inactive'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                            }`}
                        >
                            Inactive ({empCounts.inactive})
                        </button>
                        {empCounts.deleted > 0 && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter(statusFilter === 'Deleted' ? 'All' : 'Deleted')}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    statusFilter === 'Deleted'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                                }`}
                            >
                                Deleted ({empCounts.deleted})
                            </button>
                        )}
                    </div>
                ) : null}

                {/* Right: Search Input + Record Count (Print button removed) */}
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative min-w-[190px] sm:min-w-[230px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            placeholder={
                                activeFilters.reportType === 'employee_master'
                                    ? "Search employee, code, dept..."
                                    : "Search employee or code..."
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-3 py-1 text-xs bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-normal shadow-2xs"
                        />
                    </div>

                    {totalRecordCount > 0 && (
                        <span className="px-2.5 py-1 text-[10px] font-semibold text-[#57606a] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#161b22] rounded-full border border-[#d0d7de] dark:border-[#30363d] shrink-0">
                            {totalRecordCount} Records
                        </span>
                    )}
                    {cacheHit && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-full border border-indigo-200/50 dark:border-indigo-800/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Refreshing
                        </span>
                    )}
                </div>
            </div>

            {/* Print-Only Uniform Company Banner (Matches Backend PDF & Frontend Design) */}
            <div className="hidden print:block w-full mb-3 print-banner" style={{ pageBreakInside: 'avoid' }}>
                <div 
                    style={{
                        backgroundColor: '#1F4E78',
                        color: '#FFFFFF',
                        padding: '12px 18px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid #163B5C',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                    }}
                >
                    <div>
                        <h1 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, color: '#FFFFFF' }}>
                            {previewData.musterRoll?.companyName || "MANO PROJECT CONSULTANT PVT LTD"}
                        </h1>
                        <p style={{ fontSize: '10px', color: '#CBD5E1', margin: '4px 0 0 0', fontWeight: '500', textTransform: 'uppercase' }}>
                            {activeFilters.reportType === 'employee_master'
                                ? 'Employee Master Data Report'
                                : previewData.musterRoll?.monthTitle
                                ? previewData.musterRoll.monthTitle
                                : `${activeFilters.reportType?.replace(/_/g, ' ')} Report`}
                            <span style={{ margin: '0 8px', color: '#94A3B8' }}>|</span>
                            Printed on: {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                            Total: {printStats.total} Records
                        </span>
                        {printStats.active !== undefined && (
                            <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#E6F4EA', color: '#137333', border: '1px solid #A7F3D0' }}>
                                Active: {printStats.active}
                            </span>
                        )}
                        {printStats.inactive !== undefined && (
                            <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                                Inactive: {printStats.inactive}
                            </span>
                        )}
                        {printStats.deleted > 0 && (
                            <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
                                Deleted: {printStats.deleted}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Body */}
            <div className="w-full bg-slate-100 dark:bg-github-dark-bg border-t border-slate-200 dark:border-github-dark-border p-2 sm:p-3 print:bg-white print:p-0 print:border-none">
                {loadingPreview ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-500 text-sm font-medium">Crunching and parsing preview records...</p>
                    </div>
                ) : activeFilters.reportType === 'employee_master' ? (
                    <EmployeeMasterPreviewTable
                        activeFilters={activeFilters}
                        previewData={previewData}
                        loadingPreview={loadingPreview}
                        cacheHit={cacheHit}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                    />
                ) : previewData.musterRoll ? (
                    <MusterRollPreviewTable
                        musterRoll={previewData.musterRoll}
                        searchQuery={searchQuery}
                    />
                ) : (displayRows && displayRows.length > 0) ? (
                    /* Spreadsheet View: Premium Excel-replica table directly rendered */
                    <div
                        className="rounded-xl overflow-auto table-scrollbar border border-slate-200 dark:border-[#30363d] shadow-sm"
                        style={{ maxHeight: 'calc(100vh - 290px)', minHeight: '320px' }}
                    >
                        <table
                            className="w-full text-left bg-white"
                            style={{ borderCollapse: 'separate', borderSpacing: 0, fontFamily: '"Segoe UI", Calibri, Arial, sans-serif', fontSize: '11.5px', minWidth: 'max-content' }}
                        >
                            <thead className="sticky top-0 z-20 shadow-xs">
                                    {previewData.headers ? (
                                        <>
                                            {/* Row 1 - group headers */}
                                            <tr>
                                                <th 
                                                    rowSpan={2}
                                                    style={{ backgroundColor: '#1F4E78', color: '#FFFFFF', border: '1px solid #2563EB', width: '36px', minWidth: '36px' }}
                                                    className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wider">#</th>
                                                {previewData.headers[0].map((cell, idx) => (
                                                    <th
                                                        key={idx}
                                                        rowSpan={cell.rowspan}
                                                        colSpan={cell.colspan}
                                                        className="px-4 py-2.5 whitespace-nowrap tracking-wide text-center text-[10px] font-semibold uppercase"
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
                                                        className="px-3 py-2 whitespace-nowrap tracking-wide text-center text-[10px] font-medium uppercase"
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
                                                className="px-2 py-3 text-center text-[9px] font-semibold uppercase">#</th>
                                            {previewData.columns.map((col, idx) => {
                                                const alignment = getAlignmentClass(col);
                                                const isSorted = sortColumn === col;
                                                return (
                                                    <th
                                                        key={idx}
                                                        onClick={() => handleSort(col)}
                                                        className="px-4 py-3 whitespace-nowrap tracking-wide text-[10px] font-semibold uppercase cursor-pointer select-none group"
                                                        style={{
                                                            backgroundColor: '#1F4E78',
                                                            color: '#FFFFFF',
                                                            border: '1px solid #2563EB',
                                                            textAlign: alignment,
                                                            letterSpacing: '0.04em'
                                                        }}
                                                        title="Click to sort"
                                                    >
                                                        <div className={`flex items-center gap-1 ${alignment === 'left' ? 'justify-start' : 'justify-center'}`}>
                                                            <span>
                                                                {col?.toString().split('\n').map((line, lIdx) => (
                                                                    <div key={lIdx} className="leading-snug">{line}</div>
                                                                ))}
                                                            </span>
                                                            {isSorted ? (
                                                                sortDirection === 'asc' ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />
                                                            ) : (
                                                                <ChevronsUpDown size={12} className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                                                            )}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {displayRows.map((row, rIdx) => {
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
                                                        borderRight: '1.5px solid #CBD5E1',
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

            {/* Print-Only Uniform Confidential Footer */}
            <div className="hidden print:flex justify-between items-center w-full px-2 pt-2 border-t border-slate-300 text-[9px] text-slate-500 font-medium print-footer">
                <span>MANO PROJECT CONSULTANT PVT LTD — Uniform Attendance & Operations Report — Confidential</span>
                <span>Generated from Live Operations Platform</span>
            </div>
        </div>
    );
};

export default FullReportPreviewTable;
