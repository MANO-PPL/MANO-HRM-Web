import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    DollarSign,
    Clock,
    User,
    Search,
    Filter,
    ArrowUpDown,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    Info,
    ChevronRight,
    Download,
    Loader2
} from 'lucide-react';
import { labourService } from '../../../services/labourService';
import MinimalSelect from '../../../components/MinimalSelect';
import { toast } from 'react-toastify';

const MonthlyDetailedMatrix = ({
    siteId,
    month,
    siteName,
    onOpenAdvance,
    onOpenPayout
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
            <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-800 dark:text-github-dark-text uppercase tracking-wider">
                                Detailed Daily Matrix & Salary Sheet
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                {getMonthName(activeMonth)}
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-github-dark-muted text-[11px] mt-0.5">
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
                                className="pl-8 pr-3 py-1 w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-700 dark:text-github-dark-text focus:outline-none"
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
                                triggerClassName="h-7 text-xs font-semibold"
                                variant="input"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => loadMatrixData()}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#30363d] transition-all cursor-pointer"
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100 dark:border-github-dark-border/50 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-[#161b22]/50 border border-slate-100 dark:border-[#30363d]">
                            <span className="text-[10px] text-slate-500 dark:text-github-dark-muted font-bold block uppercase">Workers</span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{filteredWorkers.length} assigned</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">Work Days</span>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">{data.grandTotals.totalPresentDays} days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                            <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold block uppercase">Total OT</span>
                            <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-xs">{data.grandTotals.totalOtHours} hrs</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block uppercase">Advances</span>
                            <span className="font-extrabold text-amber-700 dark:text-amber-300 text-xs">₹{data.grandTotals.totalAdvances.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-[#161b22]/50 border border-slate-100 dark:border-[#30363d]">
                            <span className="text-[10px] text-slate-500 dark:text-github-dark-muted font-bold block uppercase">Gross Earned</span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">₹{data.grandTotals.totalGrossEarned.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40">
                            <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-extrabold block uppercase">Net Payable</span>
                            <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">₹{data.grandTotals.totalNetPayable.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Matrix Spreadsheet Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl">
                    <Clock className="animate-spin text-indigo-500 mb-2" size={28} />
                    <p className="text-xs text-slate-500 font-semibold">Generating monthly ledger matrix...</p>
                </div>
            ) : !data || filteredWorkers.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl p-6">
                    <Calendar className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={36} />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matrix ledger records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">No active workers or attendance data recorded for this site in {getMonthName(activeMonth)}.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto relative custom-scrollbar" style={{ maxHeight: '72vh' }}>
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            {/* Sticky Header */}
                            <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-[#161b22] border-b border-slate-200 dark:border-github-dark-border shadow-xs">
                                <tr>
                                    {/* Freeze Col 1: Sr No */}
                                    <th className="p-2 text-center font-bold text-slate-500 dark:text-github-dark-muted sticky left-0 z-40 bg-slate-100 dark:bg-[#161b22] w-10 min-w-[40px] max-w-[40px] border-r border-slate-200 dark:border-github-dark-border">
                                        #
                                    </th>
                                    {/* Freeze Col 2: Worker Info */}
                                    <th className="p-2.5 text-left font-bold text-slate-700 dark:text-github-dark-text sticky left-[40px] z-40 bg-slate-100 dark:bg-[#161b22] w-[210px] min-w-[210px] max-w-[210px] border-r border-slate-200 dark:border-github-dark-border shadow-md">
                                        Worker / Designation
                                    </th>

                                    {/* Days 1..31 Columns */}
                                    {data.days.map(day => (
                                        <th
                                            key={day.dateStr}
                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/60 dark:border-github-dark-border/50 ${
                                                day.isFuture
                                                    ? 'opacity-40 bg-slate-50 dark:bg-[#0d1117]/50'
                                                    : day.isWeekend
                                                        ? 'bg-slate-200/40 dark:bg-[#1f242c]'
                                                        : ''
                                            }`}
                                        >
                                                <div className="text-[8px] uppercase text-slate-400 dark:text-slate-500 font-bold leading-none">
                                                    {day.dayName}
                                                </div>
                                                <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 leading-tight mt-0.5">
                                                    {day.day}
                                                </div>
                                            </th>
                                    ))}

                                    {/* Summary Right Columns */}
                                    <th className="p-2.5 text-right font-bold text-slate-700 dark:text-github-dark-text min-w-[65px] border-l border-slate-200 dark:border-github-dark-border bg-slate-100 dark:bg-[#161b22]">
                                        Days
                                    </th>
                                    <th className="p-2.5 text-right font-bold text-slate-700 dark:text-github-dark-text min-w-[65px] bg-slate-100 dark:bg-[#161b22]">
                                        OT (Hrs)
                                    </th>
                                    <th className="p-2.5 text-right font-bold text-slate-700 dark:text-github-dark-text min-w-[75px] bg-slate-100 dark:bg-[#161b22]">
                                        Advances
                                    </th>
                                    <th className="p-2.5 text-right font-bold text-slate-700 dark:text-github-dark-text min-w-[85px] bg-slate-100 dark:bg-[#161b22]">
                                        Gross Earned
                                    </th>
                                    <th className="p-2.5 text-right font-bold text-slate-700 dark:text-github-dark-text min-w-[75px] bg-slate-100 dark:bg-[#161b22]">
                                        Paid
                                    </th>
                                    <th className="p-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400 min-w-[95px] bg-slate-100 dark:bg-[#161b22]">
                                        Net Payable
                                    </th>
                                    <th className="p-2.5 text-center font-bold text-slate-600 dark:text-slate-400 min-w-[130px] bg-slate-100 dark:bg-[#161b22]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            {/* Body: 3 Rows per Worker */}
                            <tbody className="divide-y-2 divide-slate-200 dark:divide-github-dark-border">
                                {filteredWorkers.map((worker) => {
                                    const totals = worker.totals;
                                    const advanceAlert = totals.advances > totals.gross_earned;

                                    return (
                                        <React.Fragment key={worker.labour_id}>
                                            {/* SUB-ROW 1: ATTENDANCE (P / HD / A / -) */}
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/40 transition-colors border-t border-slate-200 dark:border-github-dark-border">
                                                {/* Freeze 1: Sr No */}
                                                <td
                                                    rowSpan={3}
                                                    className="p-2 text-center font-bold text-slate-400 dark:text-slate-500 sticky left-0 z-20 bg-white dark:bg-github-dark-subtle w-10 min-w-[40px] max-w-[40px] border-r border-b border-slate-200 dark:border-github-dark-border align-middle"
                                                >
                                                    {worker.sr_no}
                                                </td>

                                                {/* Freeze 2: Worker Info */}
                                                <td
                                                    rowSpan={3}
                                                    className="p-2.5 sticky left-[40px] z-20 bg-white dark:bg-github-dark-subtle w-[210px] min-w-[210px] max-w-[210px] border-r border-b border-slate-200 dark:border-github-dark-border shadow-md align-middle"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-xs text-slate-800 dark:text-github-dark-text leading-tight truncate">
                                                            {worker.name}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-slate-300">
                                                                {worker.role}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
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
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-github-dark-border/40 ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#12161c]' : ''
                                                            }`}
                                                        >
                                                            {status === 'Present' ? (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                                                                    P
                                                                </span>
                                                            ) : status === 'Half Day' ? (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[8px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                                    HD
                                                                </span>
                                                            ) : status === 'Absent' ? (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-bold bg-rose-500/10 text-rose-500 dark:text-rose-400">
                                                                    A
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">
                                                                    {day.isWeekend ? day.dayName.slice(0, 2) : '-'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 1: Total Present Days */}
                                                <td className="p-2 text-right font-extrabold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-github-dark-border bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    {totals.present_days} d
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-700 dark:text-slate-300">
                                                    ₹{totals.base_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                                <td
                                                    rowSpan={3}
                                                    className="p-2.5 text-right font-black text-xs align-middle border-l border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#161b22]/50"
                                                >
                                                    <span className={totals.net_payable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}>
                                                        ₹{totals.net_payable.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td
                                                    rowSpan={3}
                                                    className="p-2 text-center align-middle border-l border-slate-200 dark:border-github-dark-border"
                                                >
                                                    <div className="flex flex-col gap-1 items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenAdvance(worker)}
                                                            className="w-full px-2 py-0.5 text-[9px] font-extrabold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded cursor-pointer transition-all"
                                                        >
                                                            + Advance
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenPayout(worker)}
                                                            disabled={totals.net_payable <= 0}
                                                            className={`w-full px-2 py-0.5 text-[9px] font-extrabold rounded border transition-all cursor-pointer ${
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
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/40 transition-colors">
                                                {/* Daily OT Cells */}
                                                {data.days.map(day => {
                                                    const dayData = worker.days[day.dateStr];
                                                    const ot = dayData ? dayData.ot_hours : 0;
                                                    const isFuture = day.isFuture;

                                                    return (
                                                        <td
                                                            key={`ot-${day.dateStr}`}
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-github-dark-border/40 ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#12161c]' : ''
                                                            }`}
                                                        >
                                                            {ot > 0 ? (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                                    {ot}h
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 2: OT Stats */}
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-github-dark-border bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    ---
                                                </td>
                                                <td className="p-2 text-right font-extrabold text-indigo-600 dark:text-indigo-400">
                                                    {totals.ot_hours} h
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                                <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                                    +₹{totals.ot_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                            </tr>

                                            {/* SUB-ROW 3: CASH ADVANCES */}
                                            <tr className="hover:bg-slate-50/40 dark:hover:bg-[#161b22]/40 transition-colors border-b border-slate-200 dark:border-github-dark-border">
                                                {/* Daily Advance Cells */}
                                                {data.days.map(day => {
                                                    const dayData = worker.days[day.dateStr];
                                                    const adv = dayData ? dayData.advance_amount : 0;
                                                    const isFuture = day.isFuture;

                                                    return (
                                                        <td
                                                            key={`adv-${day.dateStr}`}
                                                            className={`p-1 text-center w-[54px] min-w-[54px] max-w-[54px] align-middle border-r border-slate-100 dark:border-github-dark-border/40 ${
                                                                isFuture ? 'opacity-30' : day.isWeekend ? 'bg-slate-50/60 dark:bg-[#12161c]' : ''
                                                            }`}
                                                        >
                                                            {adv > 0 ? (
                                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                                                                    ₹{adv >= 1000 ? `${adv / 1000}k` : adv}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Right Summary Row 3: Advance & Net Calculation */}
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-github-dark-border bg-slate-50/30 dark:bg-[#161b22]/30">
                                                    ---
                                                </td>
                                                <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                                    ---
                                                </td>
                                                <td className={`p-2 text-right font-extrabold ${advanceAlert ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    -₹{totals.advances.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-black text-slate-800 dark:text-slate-200">
                                                    ₹{totals.gross_earned.toLocaleString()}
                                                </td>
                                                <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                                    ₹{totals.total_paid.toLocaleString()}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>

                            {/* Sticky Footer: Daily Column Totals */}
                            <tfoot className="sticky bottom-0 z-30 bg-slate-100 dark:bg-[#161b22] border-t-2 border-slate-300 dark:border-github-dark-border font-bold shadow-lg">
                                {/* FOOTER 1: DAILY PRESENT HEADCOUNT */}
                                <tr className="border-b border-slate-200 dark:border-github-dark-border/50 text-[10px]">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-black text-emerald-700 dark:text-emerald-400 sticky left-0 z-40 bg-emerald-50 dark:bg-emerald-950/90 border-r border-slate-200 dark:border-github-dark-border uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Present Headcount
                                    </td>
                                    {data.days.map((day, idx) => (
                                        <td
                                            key={`tot-p-${day.dateStr}`}
                                            className={`p-1 text-center font-bold text-emerald-700 dark:text-emerald-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-github-dark-border/50 ${
                                                day.isFuture ? 'opacity-30' : ''
                                            }`}
                                        >
                                            {data.dailyTotals.presentCount[idx] || 0}
                                        </td>
                                    ))}
                                    <td className="p-2 text-right font-black text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-github-dark-border">
                                        {data.grandTotals.totalPresentDays} d
                                    </td>
                                    <td colSpan={6} className="p-2 text-slate-400 dark:text-slate-600 italic text-right">
                                        Total Active Work Days Recorded
                                    </td>
                                </tr>

                                {/* FOOTER 2: DAILY OT HOURS */}
                                <tr className="border-b border-slate-200 dark:border-github-dark-border/50 text-[10px] bg-indigo-50/30 dark:bg-indigo-950/20">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-black text-indigo-700 dark:text-indigo-400 sticky left-0 z-40 bg-indigo-50 dark:bg-indigo-950/90 border-r border-slate-200 dark:border-github-dark-border uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Overtime Hours
                                    </td>
                                    {data.days.map((day, idx) => (
                                        <td
                                            key={`tot-ot-${day.dateStr}`}
                                            className={`p-1 text-center font-bold text-indigo-600 dark:text-indigo-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-github-dark-border/50 ${
                                                day.isFuture ? 'opacity-30' : ''
                                            }`}
                                        >
                                            {data.dailyTotals.otHours[idx] ? `${data.dailyTotals.otHours[idx]}h` : '-'}
                                        </td>
                                    ))}
                                    <td className="p-2 text-right font-semibold text-slate-400">---</td>
                                    <td className="p-2 text-right font-black text-indigo-600 dark:text-indigo-400">
                                        {data.grandTotals.totalOtHours} hrs
                                    </td>
                                    <td colSpan={5} className="p-2 text-slate-400 dark:text-slate-600 italic text-right">
                                        Total Overtime Hours Logged
                                    </td>
                                </tr>

                                {/* FOOTER 3: DAILY CASH ADVANCES */}
                                <tr className="text-[10px] bg-amber-50/40 dark:bg-amber-950/20">
                                    <td
                                        colSpan={2}
                                        className="p-2.5 text-left font-black text-amber-800 dark:text-amber-300 sticky left-0 z-40 bg-amber-50 dark:bg-amber-950/90 border-r border-slate-200 dark:border-github-dark-border uppercase shadow-md w-[250px] min-w-[250px] max-w-[250px] whitespace-nowrap"
                                    >
                                        Daily Advances Disbursed
                                    </td>
                                    {data.days.map((day, idx) => {
                                        const adv = data.dailyTotals.advances[idx] || 0;
                                        return (
                                            <td
                                                key={`tot-adv-${day.dateStr}`}
                                                className={`p-1 text-center font-extrabold text-amber-700 dark:text-amber-400 w-[54px] min-w-[54px] max-w-[54px] border-r border-slate-200/50 dark:border-github-dark-border/50 ${
                                                    day.isFuture ? 'opacity-30' : ''
                                                }`}
                                            >
                                                {adv > 0 ? `₹${adv >= 1000 ? `${adv / 1000}k` : adv}` : '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="p-2 text-right font-semibold text-slate-400">---</td>
                                    <td className="p-2 text-right font-semibold text-slate-400">---</td>
                                    <td className="p-2 text-right font-black text-amber-700 dark:text-amber-400">
                                        ₹{data.grandTotals.totalAdvances.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-black text-slate-800 dark:text-slate-200">
                                        ₹{data.grandTotals.totalGrossEarned.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                                        ₹{data.grandTotals.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-black text-indigo-600 dark:text-indigo-400">
                                        ₹{data.grandTotals.totalNetPayable.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-center text-slate-400 dark:text-slate-500 text-[9px] font-bold">
                                        Grand Totals
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyDetailedMatrix;
