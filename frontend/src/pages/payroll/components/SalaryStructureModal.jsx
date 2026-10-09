import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Eye, Building2, RefreshCw, CheckCircle2, ShieldCheck, Layers } from 'lucide-react';
import payrollService from '../../../services/payrollService';
import { formatPlatformDate } from '../../../utils/dateUtils';

const formatINR = (val) => Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const formatDateDMY = (dateStr) => {
    if (!dateStr) return '—';
    return formatPlatformDate(dateStr);
};

const SalaryStructureModal = ({
    isOpen,
    onClose,
    employee = null,
    packageData = null,
    effectiveFrom = null
}) => {
    const [loading, setLoading] = useState(false);
    const [fullPackage, setFullPackage] = useState(packageData);
    const [viewMode, setViewMode] = useState('ui'); // 'ui' (default) or 'print'

    useEffect(() => {
        if (isOpen) {
            setViewMode('ui');
            const pkgId = packageData?.id || packageData?.package_id || employee?.package_id;

            if (packageData && Array.isArray(packageData.components) && packageData.components.length > 0) {
                setFullPackage(packageData);
            } else if (pkgId) {
                setLoading(true);
                payrollService.getPackageById(pkgId)
                    .then(res => {
                        if (res.data) setFullPackage(res.data);
                    })
                    .catch(err => {
                        console.error('Failed to load package by id:', err);
                        const empId = employee?.employee_id || employee?.user_id || employee?.id;
                        if (empId) {
                            return payrollService.getEmployeePackage(empId).then(r => {
                                if (r.data) setFullPackage(r.data);
                            });
                        }
                    })
                    .finally(() => setLoading(false));
            } else if (employee?.employee_id || employee?.user_id || employee?.id) {
                const empId = employee.employee_id || employee.user_id || employee.id;
                setLoading(true);
                payrollService.getEmployeePackage(empId)
                    .then(res => {
                        if (res.data) setFullPackage(res.data);
                    })
                    .catch(err => console.error('Failed to load employee package structure:', err))
                    .finally(() => setLoading(false));
            }
        }
    }, [isOpen, employee, packageData]);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    const pkg = fullPackage || {};
    const components = Array.isArray(pkg.components) ? pkg.components : [];
    const rules = typeof pkg.packages_rules === 'string'
        ? (() => { try { return JSON.parse(pkg.packages_rules); } catch { return {}; } })()
        : (pkg.packages_rules || {});

    // Categorize into the 4 clear compensation groups:
    // 1. EARNINGS
    // 2. DEDUCTIONS
    // 3. COMPANY CONTRIBUTIONS
    // 4. BENEFITS
    const earnings = components.filter(c => c.category === 'earning');
    const deductions = components.filter(c => c.category === 'deduction');
    const companyContributions = components.filter(c => c.category === 'employer_contribution');
    const benefits = components.filter(c => c.category === 'benefit');

    // Helper to calculate monthly amount for any component
    const getCompMonthly = (c) => {
        if (!c) return 0;
        if (c.calc_type === 'percent_of_component') {
            const baseComp = components.find(b => b.id === c.base_component_id);
            const baseVal = baseComp ? Number(baseComp.value || 0) : 0;
            return (baseVal * Number(c.value || 0)) / 100;
        }
        return Number(c.value || 0);
    };

    // 1. Earnings Subtotals
    const totalEarningsMonthly = earnings.reduce((sum, c) => sum + getCompMonthly(c), 0);
    const totalEarningsAnnual = totalEarningsMonthly * 12;

    // 2. Deductions Subtotals
    const totalDeductionsMonthly = deductions.reduce((sum, c) => sum + getCompMonthly(c), 0);
    const totalDeductionsAnnual = totalDeductionsMonthly * 12;

    // Net Take-Home Pay (Earnings - Deductions)
    const netInHandMonthly = Math.max(0, totalEarningsMonthly - totalDeductionsMonthly);
    const netInHandAnnual = netInHandMonthly * 12;

    // 3. Company Contributions Subtotals
    const totalCompanyContribMonthly = companyContributions.reduce((sum, c) => sum + getCompMonthly(c), 0);
    const totalCompanyContribAnnual = totalCompanyContribMonthly * 12;

    // 4. Benefits Subtotals
    const totalBenefitsMonthly = benefits.reduce((sum, c) => sum + getCompMonthly(c), 0);
    const totalBenefitsAnnual = totalBenefitsMonthly * 12;

    // Total Cost to Company (CTC = Earnings + Company Contributions + Benefits)
    const totalCTCAnnual = rules.annual_ctc
        ? Number(rules.annual_ctc)
        : (totalEarningsAnnual + totalCompanyContribAnnual + totalBenefitsAnnual);
    const totalCTCMonthly = totalCTCAnnual / 12;

    const ctcFormula = benefits.length > 0
        ? 'CTC = A + C + D'
        : companyContributions.length > 0
            ? 'CTC = A + C'
            : 'CTC = A';

    const empName = employee?.employee_name || employee?.name || employee?.user_name || 'Staff Member';
    const empCode = employee?.employee_code || employee?.user_code || 'EMP-001';
    const dept = employee?.department || employee?.dept_name || rules.department || 'General';
    const desg = employee?.designation || employee?.desg_name || rules.designation || pkg.name || 'Officer';
    const effDate = effectiveFrom || pkg.effective_from || new Date().toISOString().split('T')[0];

    return createPortal(
        <AnimatePresence>
            <div id="salary-structure-modal-portal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                    id="salary-structure-modal-dialog"
                    initial={{ opacity: 0, scale: 0.97, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 14 }}
                    className="w-full max-w-4xl bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
                >
                    {/* Top Modal Controls (Hidden in Print) */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 shrink-0 print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Layers size={16} className="text-purple-600 dark:text-purple-400" />
                                <span>Salary Structure: {empName}</span>
                            </div>

                            {/* View Switcher: Interactive UI vs Printout Preview */}
                            <div className="flex items-center bg-slate-200/80 dark:bg-white/10 p-0.5 rounded-lg text-xs font-semibold">
                                <button
                                    onClick={() => setViewMode('ui')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'ui'
                                            ? 'bg-white dark:bg-purple-600 text-slate-900 dark:text-white shadow-xs font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Eye size={13} />
                                    <span>Interactive View</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('print')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                        viewMode === 'print'
                                            ? 'bg-white dark:bg-purple-600 text-slate-900 dark:text-white shadow-xs font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Printer size={13} />
                                    <span>Printout Preview</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                                <Printer size={14} />
                                Printout Annexure
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
                    <div id="salary-structure-scroll-area" className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 font-sans bg-slate-100/50 dark:bg-dark-bg/60 print:p-0 print:bg-white">
                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
                                <RefreshCw size={26} className="animate-spin text-purple-500" />
                                <span className="text-xs font-bold">Loading compensation structure...</span>
                            </div>
                        ) : viewMode === 'ui' ? (
                            /* ============================================================
                                MODE 1: MODERN SALARY STRUCTURE UI (Interactive View)
                               ============================================================ */
                            <div className="space-y-6 max-w-3xl mx-auto print:hidden">
                                
                                {/* Employee Header Card */}
                                <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-purple-500/20">
                                            {empName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                                                    {empName}
                                                </h2>
                                                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-mono text-[11px] font-bold border border-purple-200/60 dark:border-purple-900/40">
                                                    {empCode}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                                                <span>{desg}</span>
                                                <span>•</span>
                                                <span>{dept}</span>
                                                <span>•</span>
                                                <span>Package: {pkg.name || 'Assigned Package'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
                                            <CheckCircle2 size={13} />
                                            <span>Assignment Active</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                                            Effective: {formatDateDMY(effDate)}
                                        </div>
                                    </div>
                                </div>

                                {/* Key CTC Metric Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                    <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-purple-200/60 dark:border-purple-900/40 shadow-2xs">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Earnings</span>
                                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1 block">
                                            ₹{formatINR(totalEarningsMonthly)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">₹{formatINR(totalEarningsAnnual)} / year</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-rose-200/60 dark:border-rose-900/40 shadow-2xs bg-rose-50/20">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 block">Deductions</span>
                                        <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                                            -₹{formatINR(totalDeductionsMonthly)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">-₹{formatINR(totalDeductionsAnnual)} / year</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/60 shadow-xs">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">Net Take-Home Pay</span>
                                        <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1 block">
                                            ₹{formatINR(netInHandMonthly)}
                                        </span>
                                        <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">₹{formatINR(netInHandAnnual)} / year</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white shadow-md shadow-purple-500/10 ring-2 ring-purple-500/30">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200 block">Total CTC (Cost to Co)</span>
                                        <span className="text-lg font-black font-mono text-white mt-1 block">
                                            ₹{formatINR(totalCTCAnnual)}
                                        </span>
                                        <span className="text-[10px] text-purple-200 mt-0.5 block">₹{formatINR(totalCTCMonthly)} / month</span>
                                    </div>
                                </div>

                                {/* Full Salary Structure Table */}
                                <div className="rounded-xl bg-white dark:bg-dark-card border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
                                    <div className="grid grid-cols-12 text-xs font-bold uppercase tracking-wider bg-slate-50 dark:bg-white/5 border-b border-slate-200/80 dark:border-white/10 p-3 text-slate-700 dark:text-slate-300">
                                        <div className="col-span-6">Component / Details</div>
                                        <div className="col-span-3 text-right">Monthly (₹)</div>
                                        <div className="col-span-3 text-right">Annually (₹)</div>
                                    </div>

                                    {/* ========================================= */}
                                    {/* 1. EARNINGS HEADER                        */}
                                    {/* ========================================= */}
                                    <div className="p-2.5 px-3 bg-purple-100/70 dark:bg-purple-950/40 font-black text-xs uppercase tracking-wider text-purple-900 dark:text-purple-200 border-b border-purple-200/70 dark:border-purple-900/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                                            <span>EARNINGS</span>
                                        </div>
                                        <span className="text-[10px] font-bold normal-case text-purple-700 dark:text-purple-300">Contractual Allowances</span>
                                    </div>

                                    {/* Earnings Component Rows */}
                                    <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                        {earnings.map((comp, idx) => {
                                            const monthlyVal = getCompMonthly(comp);
                                            const annualVal = monthlyVal * 12;
                                            return (
                                                <div key={idx} className="grid grid-cols-12 p-2.5 px-3 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                                                    <div className="col-span-6 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                        <span>{comp.name}</span>
                                                        {comp.name?.toLowerCase().includes('incentive') && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                                Variable
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                        {formatINR(monthlyVal)}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                        {formatINR(annualVal)}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Total Earnings Subtotal */}
                                        <div className="grid grid-cols-12 p-2.5 px-3 bg-purple-50/70 dark:bg-purple-950/30 font-bold text-xs border-y border-purple-200/60 dark:border-purple-900/40">
                                            <div className="col-span-6 text-purple-900 dark:text-purple-200 uppercase tracking-wide">Total Earnings (A)</div>
                                            <div className="col-span-3 text-right font-mono text-purple-900 dark:text-purple-200">{formatINR(totalEarningsMonthly)}</div>
                                            <div className="col-span-3 text-right font-mono text-purple-900 dark:text-purple-200">{formatINR(totalEarningsAnnual)}</div>
                                        </div>

                                        {/* ========================================= */}
                                        {/* 2. DEDUCTIONS HEADER                      */}
                                        {/* ========================================= */}
                                        <div className="p-2.5 px-3 bg-rose-100/70 dark:bg-rose-950/40 font-black text-xs uppercase tracking-wider text-rose-900 dark:text-rose-200 border-y border-rose-200/70 dark:border-rose-900/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                                                <span>DEDUCTIONS</span>
                                            </div>
                                            <span className="text-[10px] font-bold normal-case text-rose-700 dark:text-rose-300">Cut from Employee Salary</span>
                                        </div>

                                        {/* Deduction Component Rows */}
                                        {deductions.map((comp, idx) => {
                                            const monthlyVal = getCompMonthly(comp);
                                            const annualVal = monthlyVal * 12;
                                            return (
                                                <div key={idx} className="grid grid-cols-12 p-2.5 px-3 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                                                    <div className="col-span-6 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                        <span>{comp.name}</span>
                                                        {comp.calc_type === 'percent_of_component' && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                                                {Number(comp.value)}% of Basic
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                                        -₹{formatINR(monthlyVal)}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                                        -₹{formatINR(annualVal)}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Total Deductions Subtotal */}
                                        <div className="grid grid-cols-12 p-2.5 px-3 bg-rose-50/70 dark:bg-rose-950/30 font-bold text-xs border-y border-rose-200/60 dark:border-rose-900/40">
                                            <div className="col-span-6 text-rose-900 dark:text-rose-200 uppercase tracking-wide">Total Deductions (B)</div>
                                            <div className="col-span-3 text-right font-mono text-rose-700 dark:text-rose-300">-₹{formatINR(totalDeductionsMonthly)}</div>
                                            <div className="col-span-3 text-right font-mono text-rose-700 dark:text-rose-300">-₹{formatINR(totalDeductionsAnnual)}</div>
                                        </div>

                                        {/* Net Take-Home Pay (A - B) */}
                                        <div className="grid grid-cols-12 p-3 px-3 bg-emerald-50 dark:bg-emerald-950/40 font-black text-xs border-y-2 border-emerald-400/60 dark:border-emerald-600/60">
                                            <div className="col-span-6 text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                                                <CheckCircle2 size={14} className="text-emerald-600" />
                                                <span>Net Take-Home Pay (Earnings - Deductions: A - B)</span>
                                            </div>
                                            <div className="col-span-3 text-right font-mono text-sm text-emerald-700 dark:text-emerald-300">₹{formatINR(netInHandMonthly)}</div>
                                            <div className="col-span-3 text-right font-mono text-sm text-emerald-700 dark:text-emerald-300">₹{formatINR(netInHandAnnual)}</div>
                                        </div>

                                        {/* ========================================= */}
                                        {/* 3. COMPANY CONTRIBUTIONS HEADER          */}
                                        {/* ========================================= */}
                                        <div className="p-2.5 px-3 bg-indigo-100/70 dark:bg-indigo-950/40 font-black text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-200 border-y border-indigo-200/70 dark:border-indigo-900/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                                <span>COMPANY CONTRIBUTIONS</span>
                                            </div>
                                            <span className="text-[10px] font-bold normal-case text-indigo-700 dark:text-indigo-300">Retirals paid by Employer</span>
                                        </div>

                                        {/* Company Contribution Rows */}
                                        {companyContributions.map((comp, idx) => {
                                            const monthlyVal = getCompMonthly(comp);
                                            const annualVal = monthlyVal * 12;
                                            return (
                                                <div key={idx} className="grid grid-cols-12 p-2.5 px-3 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                                                    <div className="col-span-6 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                        <span>{comp.name}</span>
                                                        {comp.calc_type === 'percent_of_component' && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                                                {Number(comp.value)}% of Basic
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                        {monthlyVal > 0 ? `₹${formatINR(monthlyVal)}` : '—'}
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                        {annualVal > 0 ? `₹${formatINR(annualVal)}` : '0.00'}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Total Company Contributions Subtotal */}
                                        <div className="grid grid-cols-12 p-2.5 px-3 bg-indigo-50/70 dark:bg-indigo-950/30 font-bold text-xs border-y border-indigo-200/60 dark:border-indigo-900/40">
                                            <div className="col-span-6 text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">Total Company Contributions (C)</div>
                                            <div className="col-span-3 text-right font-mono text-indigo-700 dark:text-indigo-300">₹{formatINR(totalCompanyContribMonthly)}</div>
                                            <div className="col-span-3 text-right font-mono text-indigo-700 dark:text-indigo-300">₹{formatINR(totalCompanyContribAnnual)}</div>
                                        </div>

                                        {/* ========================================= */}
                                        {/* 4. BENEFITS (ONLY SHOWN IF CONFIGURED)    */}
                                        {/* ========================================= */}
                                        {benefits.length > 0 && (
                                            <>
                                                <div className="p-2.5 px-3 bg-amber-100/70 dark:bg-amber-950/40 font-black text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200 border-y border-amber-200/70 dark:border-amber-900/50 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                                                        <span>BENEFITS (D)</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold normal-case text-amber-700 dark:text-amber-300">Insurance & Non-Cash Cover</span>
                                                </div>

                                                {benefits.map((comp, idx) => {
                                                    const monthlyVal = getCompMonthly(comp);
                                                    const annualVal = monthlyVal * 12;
                                                    return (
                                                        <div key={idx} className="grid grid-cols-12 p-2.5 px-3 hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                                                            <div className="col-span-6 font-medium text-slate-700 dark:text-slate-300">
                                                                {comp.name}
                                                            </div>
                                                            <div className="col-span-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                                {monthlyVal > 0 ? `₹${formatINR(monthlyVal)}` : '—'}
                                                            </div>
                                                            <div className="col-span-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                                {annualVal > 0 ? `₹${formatINR(annualVal)}` : '0.00'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Total Benefits Subtotal */}
                                                <div className="grid grid-cols-12 p-2.5 px-3 bg-amber-50/70 dark:bg-amber-950/30 font-bold text-xs border-y border-amber-200/60 dark:border-amber-900/40">
                                                    <div className="col-span-6 text-amber-900 dark:text-amber-200 uppercase tracking-wide">Total Benefits (D)</div>
                                                    <div className="col-span-3 text-right font-mono text-amber-700 dark:text-amber-300">₹{formatINR(totalBenefitsMonthly)}</div>
                                                    <div className="col-span-3 text-right font-mono text-amber-700 dark:text-amber-300">₹{formatINR(totalBenefitsAnnual)}</div>
                                                </div>
                                            </>
                                        )}

                                        {/* Total Cost to Company Row */}
                                        <div className="grid grid-cols-12 p-3.5 bg-slate-900 text-white dark:bg-white/10 font-black text-sm">
                                            <div className="col-span-6 uppercase tracking-wider flex items-center gap-2">
                                                <span>Total Cost to Company ({ctcFormula})</span>
                                            </div>
                                            <div className="col-span-3 text-right font-mono">₹{formatINR(totalCTCMonthly)}</div>
                                            <div className="col-span-3 text-right font-mono text-emerald-400">₹{formatINR(totalCTCAnnual)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Payout Takeaway Banner */}
                                <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-purple-700 dark:text-purple-400 shrink-0" />
                                        <span className="font-semibold">
                                            Estimated In-Hand take-home pay after contractual deductions:
                                        </span>
                                    </div>
                                    <span className="font-mono font-bold text-sm text-purple-800 dark:text-purple-300 shrink-0">
                                        ₹{formatINR(netInHandMonthly)} / month
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {/* ============================================================
                            MODE 2: FORMAL PRINTOUT PREVIEW (Annexure A Paper Document)
                            Shown when viewMode === 'print' OR during window.print()
                           ============================================================ */}
                        <div
                            id="salary-structure-print-sheet"
                            className={`${viewMode === 'print' ? 'block' : 'hidden print:block'} bg-white text-black border-2 border-black max-w-3xl mx-auto font-sans shadow-none`}
                        >
                            {/* Print-Only CSS Styles: isolates annexure structure to 1 A4 page */}
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
                                    body > *:not(#salary-structure-modal-portal) {
                                        display: none !important;
                                    }
                                    .print\\:hidden,
                                    .print\\:hidden * {
                                        display: none !important;
                                    }
                                    /* 2. Reset modal wrappers so only the salary structure sheet takes space */
                                    #salary-structure-modal-portal {
                                        position: static !important;
                                        display: block !important;
                                        padding: 0 !important;
                                        margin: 0 !important;
                                        background: transparent !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        overflow: visible !important;
                                    }
                                    #salary-structure-modal-dialog {
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
                                    #salary-structure-scroll-area {
                                        padding: 0 !important;
                                        margin: 0 !important;
                                        overflow: visible !important;
                                        background: transparent !important;
                                        height: auto !important;
                                        max-height: none !important;
                                    }
                                    /* 3. The salary structure sheet is rendered cleanly and avoids page breaks */
                                    #salary-structure-print-sheet {
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
                            <div className="flex items-stretch justify-between border-b-2 border-black">
                                <div className="p-5 flex-1">
                                    <h1 className="text-2xl font-black tracking-tight uppercase text-black">
                                        MANO PCPL
                                    </h1>
                                    <p className="text-xs text-black uppercase tracking-wider mt-1 font-medium">
                                        Corporate Headquarters, Tech Boulevard, Chennai - 600001
                                    </p>
                                </div>
                                <div className="w-44 border-l-2 border-black flex flex-col items-center justify-center p-3 text-center">
                                    <Building2 size={24} className="text-black mb-1" />
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-black">
                                        [COMPANY LOGO]
                                    </span>
                                </div>
                            </div>

                            {/* 2. Subheader Banner */}
                            <div className="border-b-2 border-black py-2 px-4 text-center font-bold text-sm text-black tracking-wider uppercase bg-slate-100">
                                ANNEXURE - A : COMPENSATION & BENEFITS STRUCTURE
                            </div>

                            {/* 3. Employee Pay Summary Table (Matching your reference image) */}
                            <div className="border-b-2 border-black text-xs">
                                <div className="grid grid-cols-2">
                                    <div className="border-r-2 border-black divide-y divide-black">
                                        <div className="flex">
                                            <div className="w-36 p-1.5 px-3 font-semibold border-r border-black">Designation</div>
                                            <div className="p-1.5 px-3 font-bold flex-1">{desg}</div>
                                        </div>
                                        <div className="flex">
                                            <div className="w-36 p-1.5 px-3 font-semibold border-r border-black">Department</div>
                                            <div className="p-1.5 px-3 font-bold flex-1">{dept}</div>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-black">
                                        <div className="flex">
                                            <div className="w-36 p-1.5 px-3 font-semibold border-r border-black">Employee Name</div>
                                            <div className="p-1.5 px-3 font-bold flex-1">{empName}</div>
                                        </div>
                                        <div className="flex">
                                            <div className="w-36 p-1.5 px-3 font-semibold border-r border-black">Employee ID</div>
                                            <div className="p-1.5 px-3 font-mono font-bold flex-1">{empCode}</div>
                                        </div>
                                        <div className="flex">
                                            <div className="w-36 p-1.5 px-3 font-semibold border-r border-black">Effective Date</div>
                                            <div className="p-1.5 px-3 font-mono font-bold flex-1">{formatDateDMY(effDate)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Structured Compensation Table */}
                            <div className="border-b-2 border-black text-xs">
                                {/* Table Headers */}
                                <div className="grid grid-cols-12 border-b-2 border-black font-bold uppercase tracking-wider bg-slate-100 text-center">
                                    <div className="col-span-6 p-2 text-left px-3 border-r-2 border-black">Details</div>
                                    <div className="col-span-3 p-2 text-right px-3 border-r-2 border-black">Monthly (Rs.)</div>
                                    <div className="col-span-3 p-2 text-right px-3">Annually (Rs.)</div>
                                </div>

                                {/* Body Rows */}
                                <div className="divide-y divide-black">

                                    {/* ------------------------------------------- */}
                                    {/* SECTION 1: EARNINGS                         */}
                                    {/* ------------------------------------------- */}
                                    <div className="p-1 px-3 font-bold uppercase tracking-wider bg-slate-100 border-b border-black text-[11px]">
                                        EARNINGS
                                    </div>

                                    {earnings.length > 0 ? (
                                        earnings.map((comp, idx) => {
                                            const mVal = getCompMonthly(comp);
                                            const aVal = mVal * 12;
                                            return (
                                                <div key={idx} className="grid grid-cols-12 min-h-[26px]">
                                                    <div className="col-span-6 p-1.5 px-3 border-r-2 border-black flex items-center justify-between">
                                                        <span>{comp.name}</span>
                                                        {comp.calc_type === 'percent_of_component' && (
                                                            <span className="text-[10px] text-slate-600 font-mono">({Number(comp.value)}% of Basic)</span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(mVal)}</div>
                                                    <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(aVal)}</div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="grid grid-cols-12 min-h-[26px]">
                                            <div className="col-span-6 p-1.5 px-3 border-r-2 border-black text-slate-500 italic">No contractual earnings configured</div>
                                            <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">0.00</div>
                                            <div className="col-span-3 p-1.5 px-3 text-right font-mono">0.00</div>
                                        </div>
                                    )}

                                    {/* Total Earnings Subtotal */}
                                    <div className="grid grid-cols-12 min-h-[26px] font-bold bg-slate-100 border-t border-b-2 border-black">
                                        <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">Total Earnings (A)</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(totalEarningsMonthly)}</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(totalEarningsAnnual)}</div>
                                    </div>

                                    {/* ------------------------------------------- */}
                                    {/* SECTION 2: DEDUCTIONS                       */}
                                    {/* ------------------------------------------- */}
                                    <div className="p-1 px-3 font-bold uppercase tracking-wider bg-slate-100 border-b border-black text-[11px]">
                                        DEDUCTIONS
                                    </div>

                                    {deductions.length > 0 ? (
                                        deductions.map((comp, idx) => {
                                            const mVal = getCompMonthly(comp);
                                            const aVal = mVal * 12;
                                            return (
                                                <div key={idx} className="grid grid-cols-12 min-h-[26px]">
                                                    <div className="col-span-6 p-1.5 px-3 border-r-2 border-black flex items-center justify-between">
                                                        <span>{comp.name}</span>
                                                        {comp.calc_type === 'percent_of_component' && (
                                                            <span className="text-[10px] text-slate-600 font-mono">({Number(comp.value)}% of Basic)</span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">-{formatINR(mVal)}</div>
                                                    <div className="col-span-3 p-1.5 px-3 text-right font-mono">-{formatINR(aVal)}</div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="grid grid-cols-12 min-h-[26px]">
                                            <div className="col-span-6 p-1.5 px-3 border-r-2 border-black text-slate-500 italic">No contractual deductions configured</div>
                                            <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">0.00</div>
                                            <div className="col-span-3 p-1.5 px-3 text-right font-mono">0.00</div>
                                        </div>
                                    )}

                                    {/* Total Deductions (B) */}
                                    <div className="grid grid-cols-12 min-h-[26px] font-bold bg-slate-50 border-t border-b border-black">
                                        <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">Total Deductions (B)</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">-{formatINR(totalDeductionsMonthly)}</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono">-{formatINR(totalDeductionsAnnual)}</div>
                                    </div>

                                    {/* Net Take-Home Salary (A - B) */}
                                    <div className="grid grid-cols-12 min-h-[28px] font-black bg-slate-100 border-b-2 border-black">
                                        <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">Net Take-Home Pay (A - B)</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(netInHandMonthly)}</div>
                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(netInHandAnnual)}</div>
                                    </div>

                                    {/* ------------------------------------------- */}
                                    {/* SECTION 3: COMPANY CONTRIBUTIONS            */}
                                    {/* ------------------------------------------- */}
                                    {companyContributions.length > 0 && (
                                        <>
                                            <div className="p-1 px-3 font-bold uppercase tracking-wider bg-slate-100 border-b border-black text-[11px]">
                                                COMPANY CONTRIBUTIONS
                                            </div>

                                            {companyContributions.map((comp, idx) => {
                                                const mVal = getCompMonthly(comp);
                                                const aVal = mVal * 12;
                                                return (
                                                    <div key={idx} className="grid grid-cols-12 min-h-[26px]">
                                                        <div className="col-span-6 p-1.5 px-3 border-r-2 border-black flex items-center justify-between">
                                                            <span>{comp.name}</span>
                                                            {comp.calc_type === 'percent_of_component' && (
                                                                <span className="text-[10px] text-slate-600 font-mono">({Number(comp.value)}% of Basic)</span>
                                                            )}
                                                        </div>
                                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(mVal)}</div>
                                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(aVal)}</div>
                                                    </div>
                                                );
                                            })}

                                            {/* Total Company Contributions Subtotal */}
                                            <div className="grid grid-cols-12 min-h-[26px] font-bold bg-slate-50 border-t border-b border-black">
                                                <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">Total Company Contributions (C)</div>
                                                <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(totalCompanyContribMonthly)}</div>
                                                <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(totalCompanyContribAnnual)}</div>
                                            </div>
                                        </>
                                    )}

                                    {/* ------------------------------------------- */}
                                    {/* SECTION 4: BENEFITS (ONLY IF CONFIGURED)    */}
                                    {/* ------------------------------------------- */}
                                    {benefits.length > 0 && (
                                        <>
                                            <div className="p-1 px-3 font-bold uppercase tracking-wider bg-slate-100 border-b border-black text-[11px]">
                                                BENEFITS
                                            </div>

                                            {benefits.map((comp, idx) => {
                                                const mVal = getCompMonthly(comp);
                                                const aVal = mVal * 12;
                                                return (
                                                    <div key={idx} className="grid grid-cols-12 min-h-[26px]">
                                                        <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">{comp.name}</div>
                                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(mVal)}</div>
                                                        <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(aVal)}</div>
                                                    </div>
                                                );
                                            })}

                                            {/* Total Benefits Subtotal */}
                                            <div className="grid grid-cols-12 min-h-[26px] font-bold bg-slate-50 border-t border-b border-black">
                                                <div className="col-span-6 p-1.5 px-3 border-r-2 border-black">Total Benefits (D)</div>
                                                <div className="col-span-3 p-1.5 px-3 text-right font-mono border-r-2 border-black">{formatINR(totalBenefitsMonthly)}</div>
                                                <div className="col-span-3 p-1.5 px-3 text-right font-mono">{formatINR(totalBenefitsAnnual)}</div>
                                            </div>
                                        </>
                                    )}

                                    {/* Total CTC */}
                                    <div className="grid grid-cols-12 min-h-[30px] font-black text-sm bg-slate-200 border-t-2 border-black">
                                        <div className="col-span-6 p-2 px-3 border-r-2 border-black uppercase tracking-wider">Total Cost to Company ({ctcFormula})</div>
                                        <div className="col-span-3 p-2 px-3 text-right font-mono border-r-2 border-black">{formatINR(totalCTCMonthly)}</div>
                                        <div className="col-span-3 p-2 px-3 text-right font-mono">{formatINR(totalCTCAnnual)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Formal Notes & Signatures */}
                            <div className="p-4 space-y-6 text-xs border-b-2 border-black">
                                <div className="text-[10px] text-slate-700 space-y-0.5">
                                    <p>1. This compensation schedule forms Annexure-A of the employment agreement and is effective from the date indicated above.</p>
                                    <p>2. Deductions are subject to statutory compliance and applicable Income Tax, Provident Fund, and Professional Tax regulations.</p>
                                    <p>3. Take-home pay is subject to loss of pay (LOP) and actual monthly attendance.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
                                    <div>
                                        <div className="border-b border-black w-48 mb-1"></div>
                                        <span className="font-bold">Employer Signatory</span>
                                        <p className="text-[10px] text-slate-600">Authorized Signatory (HR / Payroll)</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="border-b border-black w-48 mb-1"></div>
                                        <span className="font-bold">Employee Acceptance</span>
                                        <p className="text-[10px] text-slate-600">Signature & Date</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default SalaryStructureModal;
