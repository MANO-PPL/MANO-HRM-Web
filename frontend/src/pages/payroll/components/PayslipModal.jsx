import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Printer, X, RefreshCw, Building2, Eye, Calendar, Clock } from 'lucide-react';
import payrollService from '../../../services/payrollService';

const formatINR = (val) => Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const formatDateDMY = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const formatMonthYear = (dateStr) => {
    if (!dateStr) return 'Current Month';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Current Month';
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${month}, ${year}`;
};

const numberToWordsINR = (num) => {
    if (!num || num === 0) return 'Zero Rupees Only';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if (n === 0) return '';
        if (n < 20) return a[n] + ' ';
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        return '';
    };

    let n = Math.floor(Math.abs(num));
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const remaining = n;

    let res = '';
    if (crore > 0) res += inWords(crore) + 'Crore ';
    if (lakh > 0) res += inWords(lakh) + 'Lakh ';
    if (thousand > 0) res += inWords(thousand) + 'Thousand ';
    if (remaining > 0) {
        if (res !== '' && remaining < 100) res += 'and ';
        res += inWords(remaining);
    }

    return `Rupees ${res.replace(/\s+/g, ' ').trim()} Only`;
};

const isAdjustmentItem = (line) => {
    if (!line) return false;
    if (line.salary_package_component_id === null || line.salary_package_component_id === undefined) return true;
    const n = (line.name || '').toLowerCase();
    return n.includes('overtime') ||
           n.includes('loss of pay') ||
           n.includes('lop') ||
           n.includes('adjustment') ||
           n.includes('advance') ||
           n.includes('arrear') ||
           n.includes('reimbursement');
};

const PayslipModal = ({ isOpen, onClose, runId, employeeId, initialData = null }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(initialData);
    const [viewMode, setViewMode] = useState('ui'); // 'ui' (default) or 'print'

    useEffect(() => {
        if (isOpen) {
            setViewMode('ui');
            if (initialData) {
                setData(initialData);
            } else if (runId && employeeId) {
                const fetchPayslip = async () => {
                    setLoading(true);
                    try {
                        const res = await payrollService.getEmployeePayslip(runId, employeeId);
                        setData(res.data);
                    } catch (err) {
                        console.error('Failed to load payslip:', err);
                    } finally {
                        setLoading(false);
                    }
                };
                fetchPayslip();
            }
        }
    }, [isOpen, runId, employeeId, initialData]);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    const emp = data?.employee || {};
    const attendance = data?.attendance || {};

    const absentDays = Number(attendance.absent_days || 0);
    const calendarDays = Number(attendance.calendar_days || 30);
    const payableDays = attendance.present_days !== undefined
        ? (Number(attendance.present_days) + Number(attendance.paid_leave_days || 0) + Number(attendance.holiday_days || 0) + Number(attendance.weekly_off_days || 0))
        : (calendarDays - absentDays);

    const monthTitle = formatMonthYear(data?.period_start || data?.period_end);

    // Normalize earnings, deductions, and adjustments cleanly
    let rawEarnings = data?.earnings || [];
    let rawDeductions = data?.deductions || [];
    let adjustments = data?.adjustments || [];

    if (!data?.adjustments) {
        adjustments = [
            ...rawEarnings.filter(isAdjustmentItem),
            ...rawDeductions.filter(isAdjustmentItem)
        ];
        rawEarnings = rawEarnings.filter(l => !isAdjustmentItem(l));
        rawDeductions = rawDeductions.filter(l => !isAdjustmentItem(l));
    }

    const contractualGross = rawEarnings.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const contractualDeductions = rawDeductions.reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const totalAdjustments = data?.summary?.total_adjustments !== undefined
        ? Number(data.summary.total_adjustments)
        : adjustments.reduce((sum, a) => {
            const amt = Number(a.amount || 0);
            return a.transaction_type === 'earning' ? sum + amt : sum - amt;
        }, 0);

    const grossPay = data?.summary?.gross_pay !== undefined ? Number(data.summary.gross_pay) : contractualGross;
    const totalDeductions = data?.summary?.total_deductions !== undefined ? Number(data.summary.total_deductions) : contractualDeductions;
    const netPay = data?.summary?.net_pay !== undefined
        ? Number(data.summary.net_pay)
        : Math.max(0, grossPay - totalDeductions + totalAdjustments);

    // Prepare table rows for print document (dynamic row count to fit on 1 page)
    const maxBaseRows = Math.max(rawEarnings.length, rawDeductions.length, 1);
    const tableRows = [];
    for (let i = 0; i < maxBaseRows; i++) {
        tableRows.push({
            earning: rawEarnings[i] || null,
            deduction: rawDeductions[i] || null
        });
    }

    const displayAdjustments = adjustments.length > 0 ? adjustments : [
        { name: 'No adjustments recorded for this period', amount: 0, transaction_type: 'neutral', isPlaceholder: true }
    ];

    return createPortal(
        <AnimatePresence>
            <div id="payslip-modal-portal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    id="payslip-modal-dialog"
                    initial={{ opacity: 0, scale: 0.97, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 12 }}
                    className="w-full max-w-4xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
                >
                    {/* Top Modal Controls (Hidden in Print) */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 shrink-0 print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                                <span>Payslip: {emp.user_name || 'Employee'}</span>
                            </div>

                            {/* View Switcher: Interactive Payslip UI vs Print Layout */}
                            <div className="flex items-center bg-slate-200/80 dark:bg-white/10 p-0.5 rounded-lg text-xs font-semibold">
                                <button
                                    onClick={() => setViewMode('ui')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'ui'
                                            ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Eye size={13} />
                                    <span>Payslip UI</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('print')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'print'
                                            ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Printer size={13} />
                                    <span>Print Layout</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                                <Printer size={14} />
                                Print Payslip
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Container */}
                    <div id="payslip-scroll-area" className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 font-sans bg-slate-100/50 dark:bg-dark-bg/60 print:p-0 print:bg-white">
                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
                                <RefreshCw size={26} className="animate-spin text-blue-500" />
                                <span className="text-xs font-bold">Loading payslip details...</span>
                            </div>
                        ) : viewMode === 'ui' ? (
                            /* ============================================================ */
                            /* MODE 1: MODERN INTERACTIVE PAYSLIP UI (UI First)             */
                            /* ============================================================ */
                            <div className="space-y-6 max-w-3xl mx-auto print:hidden">
                                
                                {/* Employee & Org Top Card */}
                                <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
                                            {emp.user_name ? emp.user_name.charAt(0).toUpperCase() : 'M'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                                                    {emp.user_name || 'Staff Member'}
                                                </h2>
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold border border-blue-200/60 dark:border-blue-900/40">
                                                    {emp.user_code || emp.employee_code || 'EMP'}
                                                </span>
                                                {data?.status && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                        data.status === 'paid'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                    }`}>
                                                        {data.status}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                                                <span>{emp.desg_name || 'Designation'}</span>
                                                <span>•</span>
                                                <span>{emp.dept_name || 'Department'}</span>
                                                <span>•</span>
                                                <span>{emp.work_location || 'Main Office'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                                            <Calendar size={13} className="text-blue-500" />
                                            <span>Payslip: {monthTitle}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-1">
                                            Pay Date: {formatDateDMY(data?.paid_at || data?.period_end)}
                                        </div>
                                    </div>
                                </div>

                                {/* Key Financial Metric Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                    <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Gross Earnings</span>
                                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1 block">
                                            ₹{formatINR(grossPay)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">Contractual Package</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Deductions</span>
                                        <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                                            -₹{formatINR(totalDeductions)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">PF, PT & Statutory</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Adjustments</span>
                                        <span className={`text-lg font-black font-mono mt-1 block ${
                                            totalAdjustments < 0 ? 'text-rose-600 dark:text-rose-400' :
                                            totalAdjustments > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                            'text-slate-900 dark:text-white'
                                        }`}>
                                            {totalAdjustments < 0 ? `-₹${formatINR(Math.abs(totalAdjustments))}` : (totalAdjustments > 0 ? `+₹${formatINR(totalAdjustments)}` : '₹0.00')}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">Overtime & LOP</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-500/40 relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">Net Take-Home</span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-white/20 text-white">Final</span>
                                        </div>
                                        <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1 block tracking-tight">
                                            ₹{formatINR(netPay)}
                                        </span>
                                        <span className="text-[10px] text-blue-100/80 mt-0.5 block font-medium">Total Net Payable</span>
                                    </div>
                                </div>

                                {/* Attendance Strip */}
                                <div className="p-3.5 rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 text-xs shadow-2xs">
                                    <div className="flex items-center gap-2">
                                        <Clock size={15} className="text-blue-500" />
                                        <span className="font-bold text-slate-800 dark:text-slate-200">Attendance Summary:</span>
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap text-xs">
                                        <div>
                                            <span className="text-slate-400">Calendar Days: </span>
                                            <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{calendarDays}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Payable Days: </span>
                                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{payableDays}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Absent (LOP): </span>
                                            <span className={`font-bold font-mono ${absentDays > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {absentDays} {absentDays === 1 ? 'day' : 'days'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Overtime: </span>
                                            <span className={`font-bold font-mono ${Number(attendance?.overtime_hours || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {attendance?.overtime_hours || 0} hrs
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Earnings & Deductions Breakdown Columns */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Earnings Panel */}
                                    <div className="rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs flex flex-col">
                                        <div className="px-4 py-3 bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">EARNINGS</span>
                                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Amount (₹)</span>
                                        </div>
                                        <div className="p-3 divide-y divide-slate-100 dark:divide-white/5 flex-1 text-xs">
                                            {rawEarnings.map((line, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-2">
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{line.name}</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">₹{formatINR(line.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-800 dark:text-white">Gross Earnings</span>
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{formatINR(grossPay)}</span>
                                        </div>
                                    </div>

                                    {/* Deductions Panel */}
                                    <div className="rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs flex flex-col">
                                        <div className="px-4 py-3 bg-rose-50/70 dark:bg-rose-950/20 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                                            <span className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">DEDUCTIONS</span>
                                            <span className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">Amount (₹)</span>
                                        </div>
                                        <div className="p-3 divide-y divide-slate-100 dark:divide-white/5 flex-1 text-xs">
                                            {rawDeductions.map((line, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-2">
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{line.name}</span>
                                                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-₹{formatINR(line.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-800 dark:text-white">Total Deductions</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">-₹{formatINR(totalDeductions)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ADJUSTMENTS Section Card */}
                                <div className="rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">ADJUSTMENTS</span>
                                            <span className="text-[10px] text-slate-400 font-medium">(Overtime & Attendance Deductions)</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount (₹)</span>
                                    </div>
                                    <div className="p-3 divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                        {adjustments.length === 0 ? (
                                            <div className="py-4 text-center text-slate-400">No adjustments recorded for this period</div>
                                        ) : (
                                            adjustments.map((adj, idx) => {
                                                const isDed = adj.transaction_type === 'deduction';
                                                const isEarn = adj.transaction_type === 'earning';
                                                return (
                                                    <div key={idx} className="flex items-center justify-between py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{adj.name}</span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                                                isDed ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                                                                isEarn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                                                'bg-slate-100 text-slate-700'
                                                            }`}>
                                                                {isDed ? 'LOP' : isEarn ? 'OT' : 'ADJ'}
                                                            </span>
                                                        </div>
                                                        <span className={`font-mono font-bold ${
                                                            isDed ? 'text-rose-600 dark:text-rose-400' :
                                                            isEarn ? 'text-emerald-600 dark:text-emerald-400' :
                                                            'text-slate-900 dark:text-white'
                                                        }`}>
                                                            {isDed ? `-₹${formatINR(adj.amount)}` : `+₹${formatINR(adj.amount)}`}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-800 dark:text-white">Total Adjustments</span>
                                        <span className={`font-mono ${
                                            totalAdjustments < 0 ? 'text-rose-600 dark:text-rose-400' :
                                            totalAdjustments > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                            'text-slate-900 dark:text-white'
                                        }`}>
                                            {totalAdjustments < 0 ? `-₹${formatINR(Math.abs(totalAdjustments))}` : (totalAdjustments > 0 ? `+₹${formatINR(totalAdjustments)}` : '₹0.00')}
                                        </span>
                                    </div>
                                </div>

                                {/* Hero Net Payout Banner */}
                                <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-xl shadow-blue-900/15 border border-blue-400/30 relative overflow-hidden space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-200">
                                                    Net Take-Home Salary
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-400 text-emerald-950">
                                                    Final Payable
                                                </span>
                                            </div>
                                            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white mt-1">
                                                ₹{formatINR(netPay)}
                                            </div>
                                        </div>
                                        <div className="sm:text-right text-xs text-blue-100 space-y-0.5 bg-white/10 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                                            <div className="font-semibold text-white">Disbursement Mode: Direct Bank Transfer</div>
                                            <div className="text-[11px] text-blue-200">Payment Date: {formatDateDMY(data?.paid_at || data?.period_end)}</div>
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-black/15 border border-white/10 flex items-center gap-2 text-xs text-blue-100 flex-wrap">
                                        <span className="font-bold text-white whitespace-nowrap">Amount in Words:</span>
                                        <span className="italic font-medium">{numberToWordsINR(netPay)}</span>
                                    </div>

                                    <div className="text-[11px] text-blue-200 font-medium text-center sm:text-left border-t border-white/15 pt-2">
                                        **Total Net Payable = Gross Earnings (₹{formatINR(grossPay)}) - Total Deductions (₹{formatINR(totalDeductions)}) {totalAdjustments < 0 ? `- Adjustments (₹${formatINR(Math.abs(totalAdjustments))})` : `+ Adjustments (₹${formatINR(totalAdjustments)})`}**
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {/* ============================================================
                            MODE 2: FORMAL PRINT DOCUMENT (Corporate Bordered Template)
                            Shown when viewMode === 'print' OR during window.print()
                            ============================================================ */}
                        <div
                            id="payslip-print-sheet"
                            className={`${viewMode === 'print' ? 'block' : 'hidden print:block'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2 border-slate-900 dark:border-white/30 shadow-md print:border-black print:shadow-none print:text-black print:bg-white max-w-3xl mx-auto`}
                        >
                            {/* Print-Only CSS Styles: isolates the payslip to exactly 1 A4 page */}
                            <style>{`
                                @media print {
                                    @page {
                                        size: A4 portrait;
                                        margin: 6mm 8mm;
                                    }
                                    html, body {
                                        background: #fff !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        overflow: visible !important;
                                    }
                                    /* 1. Completely remove #root and any other element outside this portal from print layout */
                                    #root,
                                    body > *:not(#payslip-modal-portal) {
                                        display: none !important;
                                    }
                                    .print\\:hidden,
                                    .print\\:hidden * {
                                        display: none !important;
                                    }
                                    /* 2. Reset modal wrappers so only the payslip sheet takes space */
                                    #payslip-modal-portal {
                                        position: static !important;
                                        display: block !important;
                                        padding: 0 !important;
                                        margin: 0 !important;
                                        background: transparent !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        overflow: visible !important;
                                    }
                                    #payslip-modal-dialog {
                                        position: static !important;
                                        display: block !important;
                                        width: 100% !important;
                                        max-width: 100% !important;
                                        max-height: none !important;
                                        height: auto !important;
                                        overflow: visible !important;
                                        border: none !important;
                                        box-shadow: none !important;
                                        background: transparent !important;
                                        padding: 0 !important;
                                        margin: 0 !important;
                                    }
                                    #payslip-scroll-area {
                                        padding: 0 !important;
                                        margin: 0 !important;
                                        overflow: visible !important;
                                        background: transparent !important;
                                        height: auto !important;
                                        max-height: none !important;
                                    }
                                    /* 3. The payslip sheet is rendered cleanly and avoids page breaks */
                                    #payslip-print-sheet {
                                        display: block !important;
                                        position: relative !important;
                                        width: 100% !important;
                                        max-width: 100% !important;
                                        margin: 0 auto !important;
                                        padding: 0 !important;
                                        border: 2px solid #000 !important;
                                        box-shadow: none !important;
                                        background: #fff !important;
                                        color: #000 !important;
                                        page-break-inside: avoid !important;
                                        break-inside: avoid !important;
                                    }
                                }
                            `}</style>
                            
                            {/* 1. Header: Company Info & Logo */}
                            <div className="flex items-stretch justify-between border-b-2 border-slate-900 dark:border-white/30 print:border-black">
                                <div className="p-3 sm:p-4 print:p-2.5 flex-1">
                                    <h1 className="text-lg sm:text-xl print:text-base font-black tracking-tight uppercase text-slate-900 dark:text-white print:text-black">
                                        {emp.org_name || 'MANO PCPL'}
                                    </h1>
                                    <p className="text-[11px] print:text-[10px] text-slate-600 dark:text-slate-300 print:text-black uppercase tracking-wider mt-0.5 font-medium">
                                        {emp.work_location || 'Corporate Headquarters, Tech Boulevard, Chennai - 600001'}
                                    </p>
                                </div>
                                <div className="w-32 sm:w-40 border-l-2 border-slate-900 dark:border-white/30 print:border-black flex flex-col items-center justify-center p-2 text-center bg-slate-50/50 dark:bg-white/5 print:bg-transparent">
                                    <Building2 size={20} className="text-slate-600 dark:text-slate-400 print:text-black mb-0.5" />
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-black">
                                        [COMPANY LOGO]
                                    </span>
                                </div>
                            </div>

                            {/* 2. Month Bar */}
                            <div className="border-b-2 border-slate-900 dark:border-white/30 print:border-black py-1 px-3 text-center font-bold text-xs sm:text-sm print:text-xs text-slate-900 dark:text-white print:text-black tracking-wide">
                                Payslip for the month of {monthTitle}
                            </div>

                            {/* 3. Employee Pay Summary Header Bar */}
                            <div className="border-b-2 border-slate-900 dark:border-white/30 print:border-black px-3 py-1 font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white print:text-black bg-slate-100/70 dark:bg-white/5 print:bg-slate-100">
                                Employee Pay Summary
                            </div>

                            {/* 4. Two-Column Employee Information Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-slate-900 dark:border-white/30 print:border-black text-xs print:text-[11px]">
                                {/* Left Column */}
                                <div className="border-b sm:border-b-0 sm:border-r-2 border-slate-900 dark:border-white/30 print:border-black">
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Employee Name</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-bold flex-1 text-slate-900 dark:text-white print:text-black">{emp.user_name || '—'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Designation</div>
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black">{emp.desg_name || 'Staff Member'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Employee ID</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono font-bold flex-1 text-slate-900 dark:text-white print:text-black">{emp.user_code || emp.employee_code || '—'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Date of Joining (dd-mm-yyyy)</div>
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black font-mono">{formatDateDMY(emp.joining_date)}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Department</div>
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black">{emp.dept_name || 'General'}</div>
                                    </div>
                                    <div className="flex">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Location</div>
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black">{emp.work_location || 'Main Office'}</div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">PAN</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono flex-1 text-slate-900 dark:text-white print:text-black">{emp.pan_number || 'ABCDE1234F'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Bank Name</div>
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black">{emp.bank_name || 'Direct Bank Transfer'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Bank A/C No.</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono flex-1 text-slate-900 dark:text-white print:text-black">{emp.bank_account_no || '•••• •••• 4092'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">P.F. A/C Number</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono flex-1 text-slate-900 dark:text-white print:text-black">{emp.pf_number || 'PF/2026/0912'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">UAN Number</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono flex-1 text-slate-900 dark:text-white print:text-black">{emp.uan_number || '101294829104'}</div>
                                    </div>
                                    <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Days Worked</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono font-bold flex-1 text-slate-900 dark:text-white print:text-black">{payableDays}</div>
                                    </div>
                                    <div className="flex">
                                        <div className="w-40 sm:w-44 p-1 px-2.5 print:py-0.5 font-semibold text-slate-700 dark:text-slate-300 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">Pay Date (dd-mm-yyyy)</div>
                                        <div className="p-1 px-2.5 print:py-0.5 font-mono flex-1 text-slate-900 dark:text-white print:text-black">{formatDateDMY(data?.paid_at || data?.period_end)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Earnings & Deductions Table (No Master Column) */}
                            <div className="border-b-2 border-slate-900 dark:border-white/30 print:border-black">
                                <div className="grid grid-cols-2 text-xs print:text-[11px] font-bold uppercase tracking-wider bg-slate-100/70 dark:bg-white/5 print:bg-slate-100 border-b-2 border-slate-900 dark:border-white/30 print:border-black">
                                    <div className="grid grid-cols-3 border-r-2 border-slate-900 dark:border-white/30 print:border-black">
                                        <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black">EARNINGS</div>
                                        <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right">Earnings</div>
                                    </div>
                                    <div className="grid grid-cols-3">
                                        <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black">Particulars</div>
                                        <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right">Deductions</div>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-200 dark:divide-white/10 print:divide-slate-200 text-xs print:text-[11px]">
                                    {tableRows.map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-2 min-h-[22px] print:min-h-0">
                                            <div className="grid grid-cols-3 border-r-2 border-slate-900 dark:border-white/30 print:border-black">
                                                <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-800 dark:text-slate-200 print:text-black flex items-center justify-between">
                                                    <span>{row.earning?.name || ''}</span>
                                                </div>
                                                <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black flex items-center justify-end">
                                                    {row.earning ? `₹${formatINR(row.earning.amount)}` : ''}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3">
                                                <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-800 dark:text-slate-200 print:text-black flex items-center justify-between">
                                                    <span>{row.deduction?.name || ''}</span>
                                                </div>
                                                <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black flex items-center justify-end">
                                                    {row.deduction ? `₹${formatINR(row.deduction.amount)}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 text-xs print:text-[11px] font-bold border-t-2 border-slate-900 dark:border-white/30 print:border-black bg-slate-50 dark:bg-white/5 print:bg-white">
                                    <div className="grid grid-cols-3 border-r-2 border-slate-900 dark:border-white/30 print:border-black">
                                        <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-900 dark:text-white print:text-black">
                                            Gross Earnings
                                        </div>
                                        <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black">
                                            ₹{formatINR(grossPay)}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3">
                                        <div className="col-span-2 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-900 dark:text-white print:text-black">
                                            Total Deductions
                                        </div>
                                        <div className="col-span-1 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black">
                                            ₹{formatINR(totalDeductions)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. ADJUSTMENTS Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-slate-900 dark:border-white/30 print:border-black text-xs print:text-[11px]">
                                <div className="border-b sm:border-b-0 sm:border-r-2 border-slate-900 dark:border-white/30 print:border-black">
                                    <div className="p-1 px-2.5 print:py-0.5 font-bold uppercase tracking-wider bg-slate-100/70 dark:bg-white/5 print:bg-slate-100 border-b border-slate-300 dark:border-white/10 print:border-black text-slate-900 dark:text-white print:text-black">
                                        ADJUSTMENTS
                                    </div>
                                    <div className="divide-y divide-slate-200 dark:divide-white/10 print:divide-slate-200">
                                        {displayAdjustments.map((adj, idx) => {
                                            const isDed = adj.transaction_type === 'deduction';
                                            const isEarn = adj.transaction_type === 'earning';
                                            return (
                                                <div key={idx} className="flex items-center justify-between min-h-[22px] print:min-h-0">
                                                    <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-800 dark:text-slate-200 print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">
                                                        {adj.name}
                                                    </div>
                                                    <div className={`w-28 sm:w-32 p-1 px-2.5 print:py-0.5 text-right font-mono font-medium ${
                                                        isDed ? 'text-rose-600 dark:text-rose-400 print:text-black' :
                                                        isEarn ? 'text-emerald-600 dark:text-emerald-400 print:text-black' :
                                                        'text-slate-900 dark:text-white print:text-black'
                                                    }`}>
                                                        {adj.isPlaceholder
                                                            ? '₹0.00'
                                                            : isDed
                                                                ? `-₹${formatINR(adj.amount)}`
                                                                : `+₹${formatINR(adj.amount)}`
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between font-bold border-t border-slate-300 dark:border-white/10 print:border-black bg-slate-50 dark:bg-white/5 print:bg-white">
                                        <div className="p-1 px-2.5 print:py-0.5 flex-1 text-slate-900 dark:text-white print:text-black border-r border-slate-300 dark:border-white/10 print:border-black">
                                            Total Adjustments
                                        </div>
                                        <div className={`w-28 sm:w-32 p-1 px-2.5 print:py-0.5 text-right font-mono ${
                                            totalAdjustments < 0
                                                ? 'text-rose-600 dark:text-rose-400 print:text-black'
                                                : totalAdjustments > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400 print:text-black'
                                                    : 'text-slate-900 dark:text-white print:text-black'
                                        }`}>
                                            {totalAdjustments < 0
                                                ? `-₹${formatINR(Math.abs(totalAdjustments))}`
                                                : totalAdjustments > 0
                                                    ? `+₹${formatINR(totalAdjustments)}`
                                                    : '₹0.00'
                                            }
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden sm:block bg-slate-50/20 dark:bg-white/2 print:bg-transparent">
                                </div>
                            </div>

                            {/* 7. NETPAY Table */}
                            <div className="border-b-2 border-slate-900 dark:border-white/30 print:border-black text-xs print:text-[11px]">
                                <div className="flex border-b border-slate-300 dark:border-white/10 print:border-black font-bold uppercase tracking-wider bg-slate-100/70 dark:bg-white/5 print:bg-slate-100">
                                    <div className="flex-1 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black">NETPAY</div>
                                    <div className="w-36 sm:w-44 p-1 px-2.5 print:py-0.5 text-right">AMOUNT</div>
                                </div>
                                <div className="flex border-b border-slate-200 dark:border-white/10 print:border-black">
                                    <div className="flex-1 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-800 dark:text-slate-200 print:text-black">Gross Earnings</div>
                                    <div className="w-36 sm:w-44 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black">₹{formatINR(grossPay)}</div>
                                </div>
                                <div className="flex border-b border-slate-200 dark:border-white/10 print:border-black">
                                    <div className="flex-1 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-800 dark:text-slate-200 print:text-black">Total Deductions</div>
                                    <div className="w-36 sm:w-44 p-1 px-2.5 print:py-0.5 text-right font-mono text-slate-900 dark:text-white print:text-black">₹{formatINR(totalDeductions)}</div>
                                </div>
                                <div className="flex border-b border-slate-200 dark:border-white/10 print:border-black">
                                    <div className="flex-1 p-1 px-2.5 print:py-0.5 border-r border-slate-300 dark:border-white/10 print:border-black text-slate-800 dark:text-slate-200 print:text-black">Total Adjustments</div>
                                    <div className={`w-36 sm:w-44 p-1 px-2.5 print:py-0.5 text-right font-mono font-bold ${
                                        totalAdjustments < 0
                                            ? 'text-rose-600 dark:text-rose-400 print:text-black'
                                            : totalAdjustments > 0
                                                ? 'text-emerald-600 dark:text-emerald-400 print:text-black'
                                                : 'text-slate-900 dark:text-white print:text-black'
                                    }`}>
                                        {totalAdjustments < 0
                                            ? `-₹${formatINR(Math.abs(totalAdjustments))}`
                                            : totalAdjustments > 0
                                                ? `+₹${formatINR(totalAdjustments)}`
                                                : '₹0.00'
                                            }
                                    </div>
                                </div>
                                <div className="flex font-black text-xs sm:text-sm print:text-xs bg-slate-100 dark:bg-white/10 print:bg-slate-100 border-t-2 border-slate-900 dark:border-white/30 print:border-black">
                                    <div className="flex-1 p-1.5 px-2.5 text-right border-r-2 border-slate-900 dark:border-white/30 print:border-black text-slate-900 dark:text-white print:text-black uppercase tracking-wider">
                                        TOTAL NET PAYABLE
                                    </div>
                                    <div className="w-36 sm:w-44 p-1.5 px-2.5 text-right font-mono font-black text-sm sm:text-base print:text-sm text-slate-900 dark:text-white print:text-black">
                                        ₹{formatINR(netPay)}
                                    </div>
                                </div>
                            </div>

                            {/* 8. Amount In Words & Formula Section */}
                            <div className="p-2 px-3 print:p-1.5 text-center border-b-2 border-slate-900 dark:border-white/30 print:border-black space-y-0.5 bg-slate-50/50 dark:bg-white/5 print:bg-transparent">
                                <div className="font-extrabold text-xs sm:text-sm print:text-xs text-slate-900 dark:text-white print:text-black">
                                    Total Net Payable: <span className="font-mono text-sm sm:text-base print:text-xs underline decoration-slate-900 dark:decoration-white print:decoration-black">₹{formatINR(netPay)}</span> ({numberToWordsINR(netPay)})
                                </div>
                                <div className="text-[10px] text-slate-600 dark:text-slate-400 print:text-black font-semibold">
                                    **Total Net Payable = Gross Earnings - Total Deductions + Total Adjustments**
                                </div>
                            </div>

                            {/* 9. L.O.P. Days Bottom Footer Bar */}
                            <div className="py-1 text-center font-bold text-xs print:text-[11px] text-slate-900 dark:text-white print:text-black bg-slate-50 dark:bg-white/5 print:bg-white">
                                L.O.P. Days: {absentDays}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default PayslipModal;
