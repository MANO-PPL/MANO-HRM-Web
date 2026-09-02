import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, History, Search, X, Calendar, ChevronDown, Lock, Download } from 'lucide-react';

const PayrollToolbar = ({
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    selectedMonth,
    setSelectedMonth,
    isDropdownOpen,
    setIsDropdownOpen,
    allMonths,
    setPayrollStatus,
    processedMonths,
    employees,
    handleExport
}) => {
    return (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
            {/* Tab Switcher */}
            <div className="flex w-fit items-center gap-1.5 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                {[
                    { id: 'run', label: 'Run Monthly Payroll', icon: CreditCard },
                    { id: 'audit', label: 'Audit Trail', icon: History }
                ].map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                isSelected
                                    ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                        >
                            <tab.icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-56 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={activeTab === 'run' ? "Search employees..." : "Search audit logs..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs font-normal text-slate-700 dark:text-github-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Month Picker Dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="px-3.5 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs font-medium text-slate-700 dark:text-github-dark-text focus:outline-none shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#21262d] flex items-center gap-2 select-none transition-colors"
                    >
                        <Calendar size={14} className="text-slate-400" />
                        <span>{selectedMonth}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isDropdownOpen && (
                            <>
                                {/* Click away overlay */}
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setIsDropdownOpen(false)} 
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-xl z-20 py-1.5 overflow-hidden max-h-60 overflow-y-auto no-scrollbar"
                                >
                                    {allMonths.map((m) => {
                                        const isSelected = selectedMonth === m;
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedMonth(m);
                                                    setPayrollStatus(processedMonths.includes(m) ? 'Released' : 'Draft');
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${
                                                    isSelected
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 font-medium'
                                                        : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-[#21262d] font-normal'
                                                }`}
                                            >
                                                <span>{m}</span>
                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Locked Count Badge */}
                {activeTab === 'run' && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-medium uppercase tracking-wider ${
                        employees.filter(e => e.status === 'Finalized' || e.status === 'Paid').length === employees.length && employees.length > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                    }`}>
                        <Lock size={11} />
                        {employees.filter(e => e.status === 'Finalized' || e.status === 'Paid').length}/{employees.length} Locked
                    </span>
                )}

                {/* Export Button */}
                <button 
                    onClick={handleExport}
                    title={activeTab === 'run' ? 'Export Wage Register' : 'Export Audit Trail'}
                    className="px-3 py-1.5 bg-[#f6f8fa] hover:bg-[#eaeef2] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-[#24292f] dark:text-[#c9d1d9] border border-[#d0d7de] dark:border-[#30363d] font-medium rounded-xl shadow-sm text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                    <Download size={13} />
                    <span>Export</span>
                </button>
            </div>
        </div>
    );
};

export default PayrollToolbar;
