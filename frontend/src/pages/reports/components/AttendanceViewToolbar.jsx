import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, User, Filter } from 'lucide-react';
import MonthPicker from '../../../components/MonthPicker';
import DatePicker from '../../../components/DatePicker';

const AttendanceViewToolbar = ({
    isEmployee = false,
    currentUser = null,
    attendanceReportType,
    attendanceMonth,
    setAttendanceMonth,
    attendanceWeek,
    setAttendanceWeek,
    attendanceDate,
    setAttendanceDate,
    attendanceWeeks = [],
    attendanceIsWeekDropdownOpen,
    setAttendanceIsWeekDropdownOpen,
    attendanceWeekDropdownRef,

    // Department
    departments = [],
    attendanceDeptId,
    setAttendanceDeptId,
    attendanceDeptSearchQuery = '',
    setAttendanceDeptSearchQuery = () => {},

    // Designation
    designations = [],
    attendanceDesgId,
    setAttendanceDesgId,
    attendanceDesgSearchQuery = '',
    setAttendanceDesgSearchQuery = () => {},

    // Shift
    shifts = [],
    attendanceShiftId,
    setAttendanceShiftId,
    attendanceShiftSearchQuery = '',
    setAttendanceShiftSearchQuery = () => {},

    // Employee
    attendanceFilteredEmployees = [],
    attendanceEmployeeId,
    setAttendanceEmployeeId,
    attendanceSelectedEmployeeName,
    attendanceEmpSearchQuery = '',
    setAttendanceEmpSearchQuery = () => {}
}) => {
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const filterPopoverRef = useRef(null);

    // Calculate active filter count
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (attendanceDeptId) count++;
        if (attendanceDesgId) count++;
        if (attendanceShiftId) count++;
        if (attendanceEmployeeId) count++;
        return count;
    }, [attendanceDeptId, attendanceDesgId, attendanceShiftId, attendanceEmployeeId]);

    const handleClearAllFilters = () => {
        setAttendanceDeptId('');
        setAttendanceDesgId('');
        setAttendanceShiftId('');
        setAttendanceEmployeeId('');
        setAttendanceEmpSearchQuery('');
        setAttendanceDeptSearchQuery('');
        setAttendanceDesgSearchQuery('');
        setAttendanceShiftSearchQuery('');
    };

    // Close popover on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target)) {
                setIsFilterPopoverOpen(false);
            }
        };
        if (isFilterPopoverOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isFilterPopoverOpen]);

    return (
        <div data-tour-id="reports-filters" className="flex flex-wrap items-center gap-2 animate-none">
            {/* Month / Week / Date Pickers */}
            {attendanceReportType !== 'employee_master' && (
                <div className="flex items-center gap-2">
                    {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(attendanceReportType) ? (
                        <MonthPicker
                            value={attendanceMonth}
                            onChange={(val) => setAttendanceMonth(val)}
                            compact={true}
                        />
                    ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(attendanceReportType) ? (
                        <div className="flex items-center gap-2">
                            <MonthPicker
                                value={attendanceMonth}
                                onChange={(val) => setAttendanceMonth(val)}
                                compact={true}
                            />
                            <div className="relative" ref={attendanceWeekDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setAttendanceIsWeekDropdownOpen(!attendanceIsWeekDropdownOpen)}
                                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-medium text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-xs select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[150px]"
                                >
                                    <span className="truncate">{attendanceWeeks.find(w => w.value === attendanceWeek)?.label || 'Select Week'}</span>
                                    <ChevronDown size={13} className="text-slate-400 shrink-0 ml-2" />
                                </button>

                                {attendanceIsWeekDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5 animate-in fade-in duration-150">
                                        {attendanceWeeks.map((w, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setAttendanceWeek(w.value);
                                                    setAttendanceIsWeekDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${attendanceWeek === w.value
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
                            value={attendanceDate}
                            onChange={(val) => setAttendanceDate(val)}
                            compact={true}
                        />
                    )}
                </div>
            )}

            {isEmployee ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    <User size={13} className="text-indigo-500" />
                    <span>{currentUser?.user_name || 'My Attendance Matrix'}</span>
                </div>
            ) : (
                /* Unified Filter Popover Button */
                <div className="relative" ref={filterPopoverRef}>
                    <button
                        type="button"
                        onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-xs ${
                            activeFilterCount > 0
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-[#21262d]'
                        }`}
                        title="Filter by Department, Designation, Shift, or Employee"
                    >
                        <Filter size={13} className={activeFilterCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                        <span>Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterPopoverOpen && (
                        <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in duration-150 text-left">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#30363d]">
                                <div className="flex items-center gap-2">
                                    <Filter size={13} className="text-indigo-600 dark:text-indigo-400" />
                                    <span className="font-semibold text-xs text-slate-800 dark:text-github-dark-text">Filter Options</span>
                                    {activeFilterCount > 0 && (
                                        <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium rounded-full">
                                            {activeFilterCount} active
                                        </span>
                                    )}
                                </div>
                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearAllFilters}
                                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                    >
                                        Reset All
                                    </button>
                                )}
                            </div>

                            {/* Department */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Department</label>
                                <div className="relative">
                                    <select
                                        value={attendanceDeptId}
                                        onChange={(e) => setAttendanceDeptId(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-normal appearance-none"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.dept_id} value={d.dept_id} className="bg-white dark:bg-[#0d1117]">
                                                {d.dept_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Designation */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Designation</label>
                                <div className="relative">
                                    <select
                                        value={attendanceDesgId}
                                        onChange={(e) => setAttendanceDesgId(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-normal appearance-none"
                                    >
                                        <option value="">All Designations</option>
                                        {designations.map((d) => (
                                            <option key={d.desg_id} value={d.desg_id} className="bg-white dark:bg-[#0d1117]">
                                                {d.desg_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Shift */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Shift</label>
                                <div className="relative">
                                    <select
                                        value={attendanceShiftId}
                                        onChange={(e) => setAttendanceShiftId(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-normal appearance-none"
                                    >
                                        <option value="">All Shifts</option>
                                        <option value="open_shift">Open Shift</option>
                                        {shifts.map((s) => (
                                            <option key={s.shift_id} value={s.shift_id} className="bg-white dark:bg-[#0d1117]">
                                                {s.shift_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Employee */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">Employee</label>
                                {attendanceFilteredEmployees.length > 8 && (
                                    <div className="relative mb-1">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search employee..."
                                            value={attendanceEmpSearchQuery}
                                            onChange={(e) => setAttendanceEmpSearchQuery(e.target.value)}
                                            className="w-full pl-7 pr-2.5 py-1 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-md text-[11px] outline-none text-slate-700 dark:text-github-dark-text focus:ring-1 focus:ring-indigo-500 font-normal"
                                        />
                                    </div>
                                )}
                                <div className="relative">
                                    <select
                                        value={attendanceEmployeeId}
                                        onChange={(e) => setAttendanceEmployeeId(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-normal appearance-none"
                                    >
                                        <option value="">All Employees ({attendanceFilteredEmployees.length})</option>
                                        {attendanceFilteredEmployees.map((emp) => (
                                            <option key={emp.user_id} value={emp.user_id} className="bg-white dark:bg-[#0d1117]">
                                                {emp.user_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="pt-2 border-t border-slate-100 dark:border-[#30363d] flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsFilterPopoverOpen(false)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                >
                                    Apply & Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceViewToolbar;
