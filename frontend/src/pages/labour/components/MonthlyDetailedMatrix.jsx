import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    DollarSign,
    User,
    Search,
    Filter,
    ArrowUpDown,
    CheckCircle,
    AlertTriangle,
    Clock,
    RefreshCw,
    Info,
    ChevronRight,
    Download,
    Loader2
} from 'lucide-react';
import { labourService } from '../../../services/labourService';
import MinimalSelect from '../../../components/MinimalSelect';
import LoadingScreen from '../../../components/LoadingScreen';
import { toast } from 'react-toastify';

const MonthlyDetailedMatrix = ({
    siteId,
    month,
    siteName,
    onOpenAdvance,
    onOpenPayout,
    ledgerViewMode = 'matrix',
    setLedgerViewMode = () => {},
    financeSummary = [],
    selectedSite = null
}) => {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const activeMonth = month || new Date().toISOString().slice(0, 7);

    const handleExportExcel = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            await labourService.exportMonthlyWageExcel(siteId, activeMonth);
            toast.success('Excel ledger downloaded successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to export Excel ledger');
        } finally {
            setExporting(false);
        }
    };

    const loadMatrixData = async () => {
        if (!siteId) return;
        setLoading(true);
        try {
            const res = await labourService.getDetailedMonthlyLedger(siteId, activeMonth);
            if (res.success) {
                setData(res);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to load detailed matrix ledger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMatrixData();
    }, [siteId, activeMonth]);

    // Available unique roles for filtering
    const availableRoles = useMemo(() => {
        if (!data || !data.workers) return [];
        const roles = new Set();
        data.workers.forEach(w => {
            if (w.role) roles.add(w.role);
        });
        return Array.from(roles);
    }, [data]);

    // Filtered workers list
    const filteredWorkers = useMemo(() => {
        if (!data || !data.workers) return [];
        return data.workers.filter(w => {
            const matchesSearch = !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = !roleFilter || w.role.toLowerCase() === roleFilter.toLowerCase();
            return matchesSearch && matchesRole;
        });
    }, [data, searchQuery, roleFilter]);

    const getMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [y, m] = monthStr.split('-');
        const date = new Date(Number(y), Number(m) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* Control & Filter Header */}
            <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] p-4 rounded-xl shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-800 dark:text-[#f0f6fc] uppercase tracking-wider">
                                Detailed Daily Matrix & Salary Sheet
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                {getMonthName(activeMonth)}
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-[#8b949e] text-[11px] mt-1">
                            3-row daily breakdown per worker: <strong>Row 1: Attendance</strong> (P/HD), <strong>Row 2: Overtime Hours</strong>, <strong>Row 3: Cash Advances</strong>.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        {/* Search Worker */}
                        <div className="relative w-48">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input
                                type="text"
                                placeholder="Search worker..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1 w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs text-slate-700 dark:text-[#f0f6fc] focus:outline-none"
                            />
                        </div>

                        {/* Role Filter */}
                        <div className="w-36">
                            <MinimalSelect
                                value={roleFilter}
                                onChange={(val) => setRoleFilter(val)}
                                options={[
                                    { value: '', label: 'All Roles' },
                                    ...availableRoles.map(r => ({ value: r, label: r }))
                                ]}
                                triggerClassName="h-7 text-xs font-medium"
                                variant="input"
                            />
                        </div>

                        {/* View-mode tab switcher next to roles filter */}
                        <div className="flex bg-[#f6f8fa] dark:bg-[#161b22] p-0.5 rounded-lg border border-[#d0d7de] dark:border-[#30363d] select-none shrink-0">
                            <button
                                type="button"
                                onClick={() => setLedgerViewMode('matrix')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                    ledgerViewMode === 'matrix'
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-600 dark:text-[#58a6ff] shadow-sm border border-transparent dark:border-[#30363d]'
                                        : 'text-slate-500 dark:text-[#8b949e] hover:text-slate-800 dark:hover:text-[#f0f6fc]'
                                }`}
                            >
                                <Calendar size={11} />
                                <span>3-Row Spreadsheet</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLedgerViewMode('summary')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                    ledgerViewMode === 'summary'
                                        ? 'bg-white dark:bg-[#21262d] text-indigo-600 dark:text-[#58a6ff] shadow-sm border border-transparent dark:border-[#30363d]'
                                        : 'text-slate-500 dark:text-[#8b949e] hover:text-slate-800 dark:hover:text-[#f0f6fc]'
                                }`}
                            >
                                <DollarSign size={11} />
                                <span>Summary Table</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => loadMatrixData()}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] hover:bg-slate-200 dark:hover:bg-[#30363d] transition-all cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exporting || loading}
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                            title="Export Detailed Excel Ledger"
                        >
                            {exporting ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Exporting...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={13} />
                                    <span>Export Excel</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Metrics Bar */}
                {data && data.grandTotals && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100 dark:border-[#30363d] text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-[#161b22]/70 border border-slate-100 dark:border-[#30363d]">
                            <span className="text-[10px] text-slate-500 dark:text-[#8b949e] font-medium block uppercase">Workers</span>
                            <span className="font-semibold text-slate-800 dark:text-[#f0f6fc] text-xs">{filteredWorkers.length} assigned</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block uppercase">Work Days</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-xs">{data.grandTotals.totalPresentDays} days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                            <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium block uppercase">Total OT</span>
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300 text-xs">{data.grandTotals.totalOtHours} hrs</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium block uppercase">Advances</span>
                            <span className="font-semibold text-amber-700 dark:text-amber-300 text-xs">₹{data.grandTotals.totalAdvances.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-[#161b22]/70 border border-slate-100 dark:border-[#30363d]">
                            <span className="text-[10px] text-slate-500 dark:text-[#8b949e] font-medium block uppercase">Gross Earned</span>
                            <span className="font-semibold text-slate-800 dark:text-[#f0f6fc] text-xs">₹{data.grandTotals.totalGrossEarned.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40">
                            <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-semibold block uppercase">Net Payable</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-xs">₹{data.grandTotals.totalNetPayable.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content: conditionally show Summary Table or Matrix Spreadsheet */}
            {ledgerViewMode === 'summary' ? (
                /* Summary Table */
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-[#161b22] text-slate-500 dark:text-[#8b949e] font-medium border-b border-slate-200 dark:border-[#30363d] text-[11px]">
                                    <th className="p-3 text-left">Worker Name</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-left">Wage &amp; OT Rates</th>
                                    <th className="p-3 text-right">Total Earned</th>
                                    <th className="p-3 text-right">Advances Taken</th>
                                    <th className="p-3 text-right">Total Paid</th>
                                    <th className="p-3 text-right">Final Net Payable</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {financeSummary.filter(row => {
                                    const matchesSite = selectedSite
                                        ? ((row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id)
                                        : true;
                                    const matchesRole = !roleFilter || row.role?.toLowerCase() === roleFilter.toLowerCase();
                                    return matchesSite && matchesRole;
                                }).length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="p-10 text-center text-slate-400 dark:text-[#8b949e] italic">
                                            No salary ledger details for workers assigned to this site.
                                        </td>
                                    </tr>
                                ) : (
                                    financeSummary
                                        .filter(row => {
                                            const matchesSite = selectedSite
                                                ? ((row.site_ids && Array.isArray(row.site_ids) && row.site_ids.includes(selectedSite.site_id)) || row.site_id === selectedSite.site_id)
                                                : true;
                                            const matchesRole = !roleFilter || row.role?.toLowerCase() === roleFilter.toLowerCase();
                                            return matchesSite && matchesRole;
                                        })
                                        .map(row => {
                                            const advanceAlert = row.advances_taken > row.accrued_credit;
                                            return (
                                                <tr key={row.labour_id} className="border-b border-slate-100 dark:border-[#21262d] hover:bg-slate-50/50 dark:hover:bg-[#161b22]/50 align-middle">
                                                    <td className="p-3 font-semibold text-slate-800 dark:text-[#f0f6fc] whitespace-nowrap">{row.name}</td>
                                                    <td className="p-3">
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] whitespace-nowrap">{row.role}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className="text-slate-800 dark:text-[#f0f6fc] font-medium text-[11px] whitespace-nowrap">
                                                                ₹{row.monthly_salary?.toLocaleString()}/day
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-[#8b949e] font-normal whitespace-nowrap">
                                                                ₹{Number(row.overtime_pay_per_hour || 0).toLocaleString()}/hr OT
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-700 dark:text-[#c9d1d9] text-right whitespace-nowrap">₹{row.accrued_credit?.toLocaleString()}</td>
                                                    <td className={`p-3 font-medium text-right whitespace-nowrap ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-[#c9d1d9]'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span>₹{row.advances_taken?.toLocaleString()}</span>
                                                            {advanceAlert && <AlertTriangle size={12} className="text-rose-500 animate-pulse" title="Advances exceed earned credit" />}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-700 dark:text-[#c9d1d9] text-right whitespace-nowrap">₹{row.total_paid?.toLocaleString()}</td>
                                                    <td className={`p-3 font-semibold text-xs text-right whitespace-nowrap ${row.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        ₹{row.net_payable?.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end items-center gap-2 flex-nowrap">
                                                            {row.net_payable <= 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                                    <CheckCircle size={10} /> Settled
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                                                    <Clock size={10} /> Pending
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => onOpenAdvance(row)}
                                                                className="px-2.5 py-1 text-[10px] font-medium bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded transition-all cursor-pointer whitespace-nowrap"
                                                            >
                                                                Advance
                                                            </button>
                                                            <button
                                                                onClick={() => onOpenPayout(row)}
                                                                disabled={row.net_payable <= 0}
                                                                className={`px-2.5 py-1 text-[10px] font-medium rounded border transition-all cursor-pointer whitespace-nowrap ${row.net_payable <= 0
                                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                                                                }`}
                                                            >
                                                                Release Salary
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Matrix Spreadsheet */
                loading ? (
                    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl p-8 shadow-xs">
                        <LoadingScreen message="Generating monthly ledger matrix..." fullScreen={false} />
                    </div>
                ) : !data || filteredWorkers.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl p-6">
                        <Calendar className="mx-auto text-slate-300 dark:text-[#8b949e] mb-2" size={36} />
                        <p className="text-sm font-semibold text-slate-700 dark:text-[#f0f6fc]">No matrix ledger records found</p>
                        <p className="text-xs text-slate-400 dark:text-[#8b949e] mt-0.5">No active workers or attendance data recorded for this site in {getMonthName(activeMonth)}.</p>
                    </div>
                ) : (
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto relative custom-scrollbar" style={{ maxHeight: '72vh' }}>
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            {/* Sticky Header */}
                            <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-[#161b22] border-b border-slate-200 dark:border-[#30363d] shadow-xs">
                                <tr>
                                    {/* Freeze Col 1: Sr No */}
                                    <th className="p-2 text-center font-medium text-slate-500 dark:text-[#8b949e] sticky left-0 z-40 bg-slate-100 dark:bg-[#161b22] w-10 min-w-[40px] max-w-[40px] border-r border-slate-200 dark:border-[#30363d]">
                                        #
                                    </th>
                                    {/* Freeze Col 2: Worker Info */}
                                    <th className="p-2.5 text-left font-medium text-slate-700 dark:text-[#f0f6fc] sticky left-[40px] z-40 bg-slate-100 dark:bg-[#161b22] w-[210px] min-w-[210px] max-w-[210px] border-r border-slate-200 dark:border-[#30363d] shadow-md">
                                        Worker / Designation
                                    </th>

                                    {/* Days 1..31 Columns */}
                                    {data.days.map(day => (
                                        <th
                                            key={day.dateStr}
                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/60 dark:border-[#30363d]/60 ${
                                                day.isFuture
                                                    ? 'opacity-40 bg-slate-50 dark:bg-[#0d1117]/50'
                                                    : day.isWeekend
                                                        ? 'bg-slate-200/40 dark:bg-[#21262d]'
                                                        : ''
                                            }`}
                                        >
                                                <div className="text-[8px] uppercase text-slate-400 dark:text-[#8b949e] font-medium leading-none">
                                                    {day.dayName}
                                                </div>
                                                <div className="text-[11px] font-semibold text-slate-700 dark:text-[#f0f6fc] leading-tight mt-0.5">
                                                    {day.day}
                                                </div>
                                            </th>
                                    ))}

                                    {/* Summary Right Columns */}
                                    <th className="p-2.5 text-right font-medium text-slate-700 dark:text-[#f0f6fc] min-w-[65px] border-l border-slate-200 dark:border-[#30363d] bg-slate-100 dark:bg-[#161b22]">
                                        Days
                                    </th>
                                    <th className="p-2.5 text-right font-medium text-slate-700 dark:text-[#f0f6fc] min-w-[65px] bg-slate-100 dark:bg-[#161b22]">
                                        OT (Hrs)
                                    </th>
                                    <th className="p-2.5 text-right font-medium text-slate-700 dark:text-[#f0f6fc] min-w-[75px] bg-slate-100 dark:bg-[#161b22]">
                                        Advances
                                    </th>
                                    <th className="p-2.5 text-right font-medium text-slate-700 dark:text-[#f0f6fc] min-w-[85px] bg-slate-100 dark:bg-[#161b22]">
                                        Gross Earned
                                    </th>
                                    <th className="p-2.5 text-right font-medium text-slate-700 dark:text-[#f0f6fc] min-w-[75px] bg-slate-100 dark:bg-[#161b22]">
                                        Paid
                                    </th>
                                    <th className="p-2.5 text-right font-medium text-indigo-600 dark:text-indigo-400 min-w-[95px] bg-slate-100 dark:bg-[#161b22]">
                                        Net Payable
                                    </th>
                                    <th className="p-2.5 text-center font-medium text-slate-600 dark:text-[#8b949e] min-w-[130px] bg-slate-100 dark:bg-[#161b22]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            {/* Body: 3 Rows per Worker */}
                            <tbody className="divide-y-2 divide-slate-200 dark:divide-[#30363d]">
                                {filteredWorkers.map((worker) => {
                                    const totals = worker.totals;
                                    const advanceAlert = totals.advances > totals.gross_earned;

                                    return (
                                        <React.Fragment key={worker.labour_id}>
                                            {/* SUB-ROW 1: ATTENDANCE (P / HD / A / -) */}
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/50 transition-colors border-t border-slate-200 dark:border-[#30363d]">
                                                {/* Freeze 1: Sr No */}
                                                <td
                                                    rowSpan={3}
                                                    className="p-2 text-center font-medium text-slate-400 dark:text-[#8b949e] sticky left-0 z-20 bg-white dark:bg-[#0d1117] w-10 min-w-[40px] max-w-[40px] border-r border-b border-slate-200 dark:border-[#30363d] align-middle"
                                                >
                                                    {worker.sr_no}
                                                </td>

                                                {/* Freeze 2: Worker Info */}
                                                <td
                                                    rowSpan={3}
                                                    className="p-2.5 sticky left-[40px] z-20 bg-white dark:bg-[#0d1117] w-[210px] min-w-[210px] max-w-[210px] border-r border-b border-slate-200 dark:border-[#30363d] shadow-md align-middle"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-xs text-slate-800 dark:text-[#f0f6fc] leading-tight truncate">
                                                            {worker.name}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9]">
                                                                {worker.role}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 dark:text-[#8b949e] font-mono">
                                                                ₹{worker.daily_rate}/d • ₹{worker.overtime_pay_per_hour}/h
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Daily Attendance Cells */}
                                                {data.days.map(day => {
                                                    const dayData = worker.days[day.dateStr];
                                                    const status = dayData ? dayData.status : '-';
                                                    const isFuture = day.isFuture;

                                                    return (
                                                        <td
                                                            key={`att-${day.dateStr}`}
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-[#21262d] ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#161b22]/40' : ''
                                                            }`}
                                                        >
                                                            {status === 'Present' ? (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 shadow-2xs">
                                                                    P
                                                                </span>
                                                            ) : status === 'Half Day' ? (
                                                                <span 
                                                                    className="inline-flex items-center justify-center px-1 h-5 rounded-md text-[8px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap"
                                                                    title={dayData?.working_hours && Number(dayData.working_hours) !== 4 ? `Half Day (${dayData.working_hours} hrs)` : 'Half Day (4 hrs)'}
                                                                >
                                                                    {dayData?.working_hours && Number(dayData.working_hours) !== 4 ? `HD (${dayData.working_hours}h)` : 'HD'}
                                                                </span>
                                                            ) : status === 'Absent' ? (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-semibold bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/30">
                                                                    A
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 dark:text-[#8b949e] font-mono">
                                                                    {day.isWeekend ? day.dayName.slice(0, 2) : '·'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 1: Total Present Days */}
                                                <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    {typeof totals.present_days === 'number' ? Number(totals.present_days.toFixed(2)).toString() : totals.present_days} d
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-700 dark:text-[#f0f6fc]">
                                                    ₹{totals.base_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                                <td
                                                    rowSpan={3}
                                                    className="p-2.5 text-right font-semibold text-xs align-middle border-l border-slate-200 dark:border-[#30363d] bg-slate-50/50 dark:bg-[#161b22]/50"
                                                >
                                                    <span className={totals.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}>
                                                        ₹{totals.net_payable.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td
                                                    rowSpan={3}
                                                    className="p-2 text-center align-middle border-l border-slate-200 dark:border-[#30363d]"
                                                >
                                                    <div className="flex flex-col gap-1 items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenAdvance(worker)}
                                                            className="w-full px-2 py-0.5 text-[9px] font-medium bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded cursor-pointer transition-all"
                                                        >
                                                            + Advance
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenPayout(worker)}
                                                            disabled={totals.net_payable <= 0}
                                                            className={`w-full px-2 py-0.5 text-[9px] font-medium rounded border transition-all cursor-pointer ${
                                                                totals.net_payable <= 0
                                                                    ? 'bg-slate-100 dark:bg-[#21262d] text-slate-400 border-slate-200 dark:border-[#30363d] cursor-not-allowed opacity-50'
                                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-2xs'
                                                            }`}
                                                        >
                                                            Release Pay
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* SUB-ROW 2: OVERTIME HOURS */}
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/50 transition-colors">
                                                {/* Daily OT Cells */}
                                                {data.days.map(day => {
                                                    const dayData = worker.days[day.dateStr];
                                                    const ot = dayData ? dayData.ot_hours : 0;
                                                    const isFuture = day.isFuture;

                                                    return (
                                                        <td
                                                            key={`ot-${day.dateStr}`}
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-[#21262d] ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#161b22]/40' : ''
                                                            }`}
                                                        >
                                                            {ot > 0 ? (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                                    {ot}h
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 dark:text-[#8b949e] font-mono">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 2: OT Stats */}
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e] border-l border-slate-200 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    -
                                                </td>
                                                <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {totals.ot_hours} h
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                                <td className="p-2 text-right font-medium text-indigo-600 dark:text-indigo-400">
                                                    +₹{totals.ot_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                            </tr>

                                            {/* SUB-ROW 3: CASH ADVANCES */}
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/50 transition-colors border-b border-slate-200 dark:border-[#30363d]">
                                                {/* Daily Advance Cells */}
                                                {data.days.map(day => {
                                                    const dayData = worker.days[day.dateStr];
                                                    const adv = dayData ? dayData.advance_amount : 0;
                                                    const isFuture = day.isFuture;

                                                    return (
                                                        <td
                                                            key={`adv-${day.dateStr}`}
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-[#21262d] ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#161b22]/40' : ''
                                                            }`}
                                                        >
                                                            {adv > 0 ? (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                                                                    ₹{adv >= 1000 ? `${adv / 1000}k` : adv}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 dark:text-[#8b949e] font-mono">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 3: Advance & Net Calculation */}
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e] border-l border-slate-200 dark:border-[#30363d] bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    -
                                                </td>
                                                <td className="p-2 text-right font-medium text-slate-400 dark:text-[#8b949e]">
                                                    -
                                                </td>
                                                <td className={`p-2 text-right font-semibold ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    -₹{totals.advances.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-800 dark:text-[#f0f6fc]">
                                                    ₹{totals.gross_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                    ₹{totals.total_paid.toLocaleString()}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>

                            {/* Sticky Footer: Daily Column Totals */}
                            <tfoot className="sticky bottom-0 z-30 bg-slate-100 dark:bg-[#161b22] border-t-2 border-slate-300 dark:border-[#30363d] font-medium shadow-lg">
                                {/* FOOTER 1: DAILY PRESENT HEADCOUNT */}
                                <tr className="border-b border-slate-200 dark:border-[#30363d] text-[10px]">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-semibold text-emerald-700 dark:text-emerald-400 sticky left-0 z-40 bg-emerald-50 dark:bg-emerald-950/90 border-r border-slate-200 dark:border-[#30363d] uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Present Headcount
                                    </td>
                                    {data.days.map((day, idx) => (
                                        <td
                                            key={`tot-p-${day.dateStr}`}
                                            className={`p-1 text-center font-medium text-emerald-700 dark:text-emerald-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-[#30363d]/50 ${
                                                day.isFuture ? 'opacity-30' : ''
                                            }`}
                                        >
                                            {data.dailyTotals.presentCount[idx] || 0}
                                        </td>
                                    ))}
                                    <td className="p-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-[#30363d]">
                                        {data.grandTotals.totalPresentDays} d
                                    </td>
                                    <td colSpan={6} className="p-2 text-slate-400 dark:text-[#8b949e] italic text-right">
                                        Total Active Work Days Recorded
                                    </td>
                                </tr>

                                {/* FOOTER 2: DAILY OT HOURS */}
                                <tr className="border-b border-slate-200 dark:border-[#30363d] text-[10px] bg-indigo-50/30 dark:bg-indigo-950/20">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-semibold text-indigo-700 dark:text-indigo-400 sticky left-0 z-40 bg-indigo-50 dark:bg-indigo-950/90 border-r border-slate-200 dark:border-[#30363d] uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Overtime Hours
                                    </td>
                                    {data.days.map((day, idx) => (
                                        <td
                                            key={`tot-ot-${day.dateStr}`}
                                            className={`p-1 text-center font-medium text-indigo-600 dark:text-indigo-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-[#30363d]/50 ${
                                                day.isFuture ? 'opacity-30' : ''
                                            }`}
                                        >
                                            {data.dailyTotals.otHours[idx] ? `${data.dailyTotals.otHours[idx]}h` : '-'}
                                        </td>
                                    ))}
                                    <td className="p-2 text-right font-normal text-slate-400 dark:text-[#8b949e]">-</td>
                                    <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                        {data.grandTotals.totalOtHours} hrs
                                    </td>
                                    <td colSpan={5} className="p-2 text-slate-400 dark:text-[#8b949e] italic text-right">
                                        Total Overtime Hours Logged
                                    </td>
                                </tr>

                                {/* FOOTER 3: DAILY CASH ADVANCES */}
                                <tr className="text-[10px] bg-amber-50/40 dark:bg-amber-950/20">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-semibold text-amber-800 dark:text-amber-300 sticky left-0 z-40 bg-amber-50 dark:bg-amber-950/90 border-r border-slate-200 dark:border-[#30363d] uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Advances Disbursed
                                    </td>
                                    {data.days.map((day, idx) => {
                                        const adv = data.dailyTotals.advances[idx] || 0;
                                        return (
                                            <td
                                                key={`tot-adv-${day.dateStr}`}
                                                className={`p-1 text-center font-medium text-amber-700 dark:text-amber-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-[#30363d]/50 ${
                                                    day.isFuture ? 'opacity-30' : ''
                                                }`}
                                            >
                                                {adv > 0 ? `₹${adv >= 1000 ? `${adv / 1000}k` : adv}` : '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="p-2 text-right font-normal text-slate-400 dark:text-[#8b949e]">-</td>
                                    <td className="p-2 text-right font-normal text-slate-400 dark:text-[#8b949e]">-</td>
                                    <td className="p-2 text-right font-semibold text-amber-700 dark:text-amber-400">
                                        ₹{data.grandTotals.totalAdvances.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-slate-800 dark:text-[#f0f6fc]">
                                        ₹{data.grandTotals.totalGrossEarned.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        ₹{data.grandTotals.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                        ₹{data.grandTotals.totalNetPayable.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-slate-800 dark:text-[#f0f6fc]">
                                        Grand Totals
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )
            )}
        </div>
    );
};

export default MonthlyDetailedMatrix;
