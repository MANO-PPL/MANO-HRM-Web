import React from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Filter, Plus, Upload, Sliders, Users, CheckCircle2,
    Clock, Trash2, UserCheck, UserX
} from 'lucide-react';
import ColumnCustomizerDrawer from './ColumnCustomizerDrawer';

const EmployeeFiltersBar = ({
    employees = [],
    statusFilter = 'Active',
    setStatusFilter,
    onboardingFilter = 'All',
    setOnboardingFilter,
    activeCount = 0,
    inactiveCount = 0,
    trashCount = 0,
    searchTerm = '',
    setSearchTerm,
    deptFilter = 'All',
    setDeptFilter,
    departments = [],
    showColumnCustomizer,
    setShowColumnCustomizer,
    visibleColumns,
    toggleColumn,
    resetColumnsToDefault,
    setShowTemplatesModal
}) => {
    return (
        <div className="space-y-3 shrink-0">
            {/* 4 Top Metric & Status Filtering Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                {/* Card 1: Total Employees (Resets Onboarding Quick filters) */}
                <div
                    onClick={() => setOnboardingFilter('All')}
                    className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                        onboardingFilter === 'All'
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                    }`}
                >
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Users size={20} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Total registered</span>
                        <p className="text-xl font-bold mt-0.5">{employees.filter(e => e.status === statusFilter).length}</p>
                    </div>
                </div>

                {/* Card 2: Onboarding Completed Filter Card */}
                <div
                    onClick={() => setOnboardingFilter(onboardingFilter === 'Completed' ? 'All' : 'Completed')}
                    className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                        onboardingFilter === 'Completed'
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                    }`}
                >
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Onboarding Completed</span>
                        <p className="text-xl font-bold mt-0.5">
                            {employees.filter(e => {
                                if (e.status !== statusFilter) return false;
                                return (e.onboarding_progress || 0) === 100;
                            }).length}
                        </p>
                    </div>
                </div>

                {/* Card 3: Onboarding In-Progress Filter Card */}
                <div
                    onClick={() => setOnboardingFilter(onboardingFilter === 'InProgress' ? 'All' : 'InProgress')}
                    className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                        onboardingFilter === 'InProgress'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                            : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                    }`}
                >
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Onboarding In-Progress</span>
                        <p className="text-xl font-bold mt-0.5">
                            {employees.filter(e => {
                                if (e.status !== statusFilter) return false;
                                const progress = e.onboarding_progress || 0;
                                return progress > 0 && progress < 100;
                            }).length}
                        </p>
                    </div>
                </div>

                {/* Card 4: Integrated Status Tab Filter Control */}
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3 rounded-xl flex flex-col justify-between shadow-sm select-none">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-2 block">
                        Employee Status Filter
                    </span>

                    {/* Segmented controls mirroring recruitment tab bar */}
                    <div className="flex gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl">
                        {[
                            { id: 'Active', label: 'Active', icon: UserCheck, count: activeCount },
                            { id: 'Inactive', label: 'Inactive', icon: UserX, count: inactiveCount },
                            { id: 'Deleted', label: 'Trash', icon: Trash2, count: trashCount }
                        ].map((tab) => {
                            const isSelected = statusFilter === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setStatusFilter(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                        isSelected
                                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <tab.icon size={14} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-455'} -mt-[1px]`} />
                                    <span>{tab.label}</span>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-slate-100 dark:bg-slate-800 text-[#0969da] dark:text-[#f0f6fc]' : 'bg-slate-200 dark:bg-github-dark-border text-slate-500 dark:text-[#8b949e]'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Operations & Customizer Row */}
            <div data-tour-id="emp-unified-filters" className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name, email, or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    {/* Department Dropdown */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={14} className="text-slate-400" />
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none cursor-pointer"
                        >
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    {/* Customize Columns Trigger */}
                    <ColumnCustomizerDrawer
                        showColumnCustomizer={showColumnCustomizer}
                        setShowColumnCustomizer={setShowColumnCustomizer}
                        visibleColumns={visibleColumns}
                        toggleColumn={toggleColumn}
                        resetColumnsToDefault={resetColumnsToDefault}
                    />
                </div>

                {/* Operational Buttons */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setShowTemplatesModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        <Sliders size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Manage Templates</span>
                    </button>
                    <Link
                        to="/employees/bulk"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        <Upload size={14} />
                        <span>Bulk Upload</span>
                    </Link>
                    <Link
                        to="/employees/add"
                        data-tour-id="emp-unified-add-btn"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        <span>Add Employee</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default EmployeeFiltersBar;
