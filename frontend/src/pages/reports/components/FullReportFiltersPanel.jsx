import React from 'react';
import { ChevronDown, Search, Download, History } from 'lucide-react';
import MonthPicker from '../../../components/MonthPicker';
import DatePicker from '../../../components/DatePicker';

const FullReportFiltersPanel = ({
    reportTypeOptions,
    tableReportType,
    setTableReportType,
    tableIsTypeDropdownOpen,
    setTableIsTypeDropdownOpen,
    tableTypeDropdownRef,

    // Department
    departments,
    tableDeptId,
    setTableDeptId,
    tableDeptSearchQuery,
    setTableDeptSearchQuery,
    tableIsDeptDropdownOpen,
    setTableIsDeptDropdownOpen,
    tableDeptDropdownRef,

    // Designation
    designations,
    tableDesgId,
    setTableDesgId,
    tableDesgSearchQuery,
    setTableDesgSearchQuery,
    tableIsDesgDropdownOpen,
    setTableIsDesgDropdownOpen,
    tableDesgDropdownRef,

    // Shift
    shifts,
    tableShiftId,
    setTableShiftId,
    tableShiftSearchQuery,
    setTableShiftSearchQuery,
    tableIsShiftDropdownOpen,
    setTableIsShiftDropdownOpen,
    tableShiftDropdownRef,

    // Employee
    tableFilteredEmployees,
    tableEmployeeId,
    setTableEmployeeId,
    tableSelectedEmployeeName,
    tableEmpSearchQuery,
    setTableEmpSearchQuery,
    tableIsEmpDropdownOpen,
    setTableIsEmpDropdownOpen,
    tableEmpDropdownRef,

    // Date & Ranges
    tableUseCustomRange,
    setTableUseCustomRange,
    tableCustomStartDate,
    setTableCustomStartDate,
    tableCustomEndDate,
    setTableCustomEndDate,
    tableMonth,
    setTableMonth,
    tableDate,
    setTableDate,
    tableWeek,
    setTableWeek,
    tableWeeks,
    tableIsWeekDropdownOpen,
    setTableIsWeekDropdownOpen,
    tableWeekDropdownRef,

    // Columns
    tableExportColumns,
    setTableExportColumns,
    tableIsColsDropdownOpen,
    setTableIsColsDropdownOpen,
    tableColsDropdownRef,

    // Format & Actions
    tableFileFormat,
    setTableFileFormat,
    isGenerating,
    handleGenerate,
    onOpenHistory
}) => {
    return (
        <div data-tour-id="reports-filters" className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-3 space-y-3 shrink-0">
            {/* Row 1: Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
                {/* Custom Report Type Dropdown */}
                <div className="relative xl:col-span-2" ref={tableTypeDropdownRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Report Type</label>
                    <button
                        type="button"
                        onClick={() => setTableIsTypeDropdownOpen(!tableIsTypeDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                    >
                        <span className="truncate">{reportTypeOptions.find(opt => opt.value === tableReportType)?.label || tableReportType}</span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsTypeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {tableIsTypeDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                            {reportTypeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        setTableReportType(opt.value);
                                        setTableIsTypeDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableReportType === opt.value
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Custom Searchable Department Selector */}
                <div className="relative xl:col-span-2" ref={tableDeptDropdownRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Department</label>
                    <button
                        type="button"
                        onClick={() => {
                            setTableIsDeptDropdownOpen(!tableIsDeptDropdownOpen);
                            setTableDeptSearchQuery('');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                    >
                        <span className="truncate">
                            {departments.find(d => d.dept_id === tableDeptId)?.dept_name || 'All Departments'}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsDeptDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {tableIsDeptDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search departments..."
                                    value={tableDeptSearchQuery}
                                    onChange={(e) => setTableDeptSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableDeptId('');
                                        setTableIsDeptDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableDeptId === ''
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    All Departments
                                </button>
                                {departments.filter(d => d.dept_name.toLowerCase().includes(tableDeptSearchQuery.toLowerCase())).length > 0 ? (
                                    departments.filter(d => d.dept_name.toLowerCase().includes(tableDeptSearchQuery.toLowerCase())).map(d => (
                                        <button
                                            key={d.dept_id}
                                            type="button"
                                            onClick={() => {
                                                setTableDeptId(d.dept_id);
                                                setTableIsDeptDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableDeptId === d.dept_id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {d.dept_name}
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                        No departments found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Searchable Designation Selector */}
                <div className="relative xl:col-span-2" ref={tableDesgDropdownRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Designation</label>
                    <button
                        type="button"
                        onClick={() => {
                            setTableIsDesgDropdownOpen(!tableIsDesgDropdownOpen);
                            setTableDesgSearchQuery('');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                    >
                        <span className="truncate">
                            {designations.find(d => String(d.desg_id) === String(tableDesgId))?.desg_name || 'All Designations'}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsDesgDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {tableIsDesgDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search designations..."
                                    value={tableDesgSearchQuery}
                                    onChange={(e) => setTableDesgSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableDesgId('');
                                        setTableIsDesgDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableDesgId === ''
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    All Designations
                                </button>
                                {designations.filter(d => d.desg_name.toLowerCase().includes(tableDesgSearchQuery.toLowerCase())).length > 0 ? (
                                    designations.filter(d => d.desg_name.toLowerCase().includes(tableDesgSearchQuery.toLowerCase())).map(d => (
                                        <button
                                            key={d.desg_id}
                                            type="button"
                                            onClick={() => {
                                                setTableDesgId(d.desg_id);
                                                setTableIsDesgDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${String(tableDesgId) === String(d.desg_id)
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-600 dark:text-[#8b949e] hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {d.desg_name}
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                        No designations found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Searchable Shift Selector */}
                <div className="relative xl:col-span-2" ref={tableShiftDropdownRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Shift</label>
                    <button
                        type="button"
                        onClick={() => {
                            setTableIsShiftDropdownOpen(!tableIsShiftDropdownOpen);
                            setTableShiftSearchQuery('');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                    >
                        <span className="truncate">
                            {tableShiftId === 'open_shift' ? 'Open Shift' : (shifts.find(s => String(s.shift_id) === String(tableShiftId))?.shift_name || 'All Shifts')}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsShiftDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {tableIsShiftDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search shifts..."
                                    value={tableShiftSearchQuery}
                                    onChange={(e) => setTableShiftSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableShiftId('');
                                        setTableIsShiftDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableShiftId === ''
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    All Shifts
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableShiftId('open_shift');
                                        setTableIsShiftDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableShiftId === 'open_shift'
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    Open Shift
                                </button>
                                {shifts.filter(s => s.shift_name.toLowerCase().includes(tableShiftSearchQuery.toLowerCase())).length > 0 ? (
                                    shifts.filter(s => s.shift_name.toLowerCase().includes(tableShiftSearchQuery.toLowerCase())).map(s => (
                                        <button
                                            key={s.shift_id}
                                            type="button"
                                            onClick={() => {
                                                setTableShiftId(s.shift_id);
                                                setTableIsShiftDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${String(tableShiftId) === String(s.shift_id)
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {s.shift_name}
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                        No shifts found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Searchable Employee Select */}
                <div className="relative xl:col-span-2" ref={tableEmpDropdownRef}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Employee</label>
                    <button
                        type="button"
                        onClick={() => {
                            setTableIsEmpDropdownOpen(!tableIsEmpDropdownOpen);
                            setTableEmpSearchQuery('');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                    >
                        <span className="truncate">{tableSelectedEmployeeName}</span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsEmpDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {tableIsEmpDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    value={tableEmpSearchQuery}
                                    onChange={(e) => setTableEmpSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTableEmployeeId('');
                                        setTableIsEmpDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableEmployeeId === ''
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    All Employees
                                </button>
                                {tableFilteredEmployees.length > 0 ? (
                                    tableFilteredEmployees.map(emp => (
                                        <button
                                            key={emp.user_id}
                                            type="button"
                                            onClick={() => {
                                                setTableEmployeeId(emp.user_id);
                                                setTableIsEmpDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableEmployeeId === emp.user_id
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {emp.user_name}
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-3">
                                        No employees found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Date Picker Grid Item */}
                {tableReportType !== 'employee_master' && (
                    <div className="xl:col-span-2">
                        {tableUseCustomRange ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <DatePicker
                                    label="Start Date"
                                    value={tableCustomStartDate}
                                    onChange={(val) => setTableCustomStartDate(val)}
                                    compact={true}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={tableCustomEndDate}
                                    onChange={(val) => setTableCustomEndDate(val)}
                                    compact={true}
                                />
                            </div>
                        ) : (
                            <div>
                                {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(tableReportType) ? (
                                    <MonthPicker
                                        label="Select Month"
                                        value={tableMonth}
                                        onChange={(val) => setTableMonth(val)}
                                        compact={true}
                                    />
                                ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(tableReportType) ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <MonthPicker
                                            label="Select Month"
                                            value={tableMonth}
                                            onChange={(val) => setTableMonth(val)}
                                            compact={true}
                                        />
                                        <div className="relative" ref={tableWeekDropdownRef}>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Select Week</label>
                                            <button
                                                type="button"
                                                onClick={() => setTableIsWeekDropdownOpen(!tableIsWeekDropdownOpen)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                            >
                                                <span className="truncate">{tableWeeks.find(w => w.value === tableWeek)?.label || 'Select Week'}</span>
                                                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {tableIsWeekDropdownOpen && (
                                                <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                                    {tableWeeks.map((w, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setTableWeek(w.value);
                                                                setTableIsWeekDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${tableWeek === w.value
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            {w.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <DatePicker
                                        label="Select Date"
                                        value={tableDate}
                                        onChange={(val) => setTableDate(val)}
                                        compact={true}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Columns Selection Dropdown */}
                {tableReportType !== 'employee_master' && (
                    <div className="relative xl:col-span-2" ref={tableColsDropdownRef}>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Columns to Include</label>
                        <button
                            type="button"
                            onClick={() => setTableIsColsDropdownOpen(!tableIsColsDropdownOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                        >
                            <span className="truncate">
                                {Object.values(tableExportColumns).filter(Boolean).length} Columns Selected
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${tableIsColsDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {tableIsColsDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-full min-w-[220px] bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-3 space-y-2.5">
                                {[
                                    { id: 'timeIn', label: 'Time In' },
                                    { id: 'timeOut', label: 'Time Out' },
                                    { id: 'status', label: 'Status' },
                                    { id: 'workedHours', label: 'Worked Hours' },
                                    { id: 'requiredHours', label: 'Required Hours' },
                                    { id: 'late', label: 'Lateness Info' },
                                    { id: 'location', label: 'Locations' },
                                    { id: 'attendanceDays', label: 'Attendance Summary' }
                                ].map((col) => (
                                    <button
                                        key={col.id}
                                        type="button"
                                        onClick={() => {
                                            setTableExportColumns(prev => ({
                                                ...prev,
                                                [col.id]: !prev[col.id]
                                            }));
                                        }}
                                        className="w-full flex items-center gap-2.5 cursor-pointer focus:outline-none group text-left"
                                    >
                                        <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${tableExportColumns[col.id]
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                            : 'bg-white dark:bg-github-dark-subtle border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                            }`}>
                                            {tableExportColumns[col.id] && (
                                                <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 dark:text-github-dark-muted select-none">
                                            {col.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Row 2: Divider & Action Toolbar */}
            <div className="border-t border-slate-100 dark:border-github-dark-border pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Custom Date Range Toggle */}
                <div className="flex items-center">
                    <button
                        type="button"
                        id="useCustomRangeWeb"
                        onClick={() => setTableUseCustomRange(!tableUseCustomRange)}
                        className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${tableUseCustomRange
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                            : 'bg-white dark:bg-[#161b22] border-slate-300 dark:border-[#30363d] group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                            }`}>
                            {tableUseCustomRange && (
                                <svg className="w-2.5 h-2.5 stroke-[3] stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted select-none">
                            Use Custom Date Range
                        </span>
                    </button>
                </div>

                {/* Format Switcher & Download Button */}
                <div data-tour-id="reports-actions" className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                    {/* File Format Tabs Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Format:</span>
                        <div className="h-8 flex items-center p-1 bg-slate-100 dark:bg-[#161b22] rounded-md border border-slate-200 dark:border-[#30363d]">
                            {[
                                { id: 'xlsx', label: 'Excel' },
                                { id: 'csv', label: 'CSV' },
                                { id: 'pdf', label: 'PDF' }
                            ].map((format) => {
                                const isSelected = tableFileFormat === format.id;
                                return (
                                    <button
                                        key={format.id}
                                        type="button"
                                        onClick={() => setTableFileFormat(format.id)}
                                        className={`h-full px-3 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${isSelected
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-github-dark-text'
                                            }`}
                                    >
                                        {format.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Download Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider rounded-md shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-8 text-[10px] cursor-pointer"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <Download size={12} />
                                <span>Download Report</span>
                            </>
                        )}
                    </button>

                    {/* Export History Drawer Toggle Button */}
                    <button
                        onClick={onOpenHistory}
                        className="px-4 py-1.5 bg-[#f6f8fa] hover:bg-[#eaeef2] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-[#24292f] dark:text-[#c9d1d9] border border-[#d0d7de] dark:border-[#30363d] font-bold uppercase tracking-wider rounded-md shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 h-8 text-[10px] cursor-pointer"
                    >
                        <History size={12} />
                        <span>Export History</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FullReportFiltersPanel;
