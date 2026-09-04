import React from 'react';
import { ChevronDown, Search } from 'lucide-react';
import MonthPicker from '../../../components/MonthPicker';
import DatePicker from '../../../components/DatePicker';

const AttendanceViewToolbar = ({
    attendanceReportType,
    attendanceMonth,
    setAttendanceMonth,
    attendanceWeek,
    setAttendanceWeek,
    attendanceDate,
    setAttendanceDate,
    attendanceWeeks,
    attendanceIsWeekDropdownOpen,
    setAttendanceIsWeekDropdownOpen,
    attendanceWeekDropdownRef,

    // Department
    departments,
    attendanceDeptId,
    setAttendanceDeptId,
    attendanceDeptSearchQuery,
    setAttendanceDeptSearchQuery,
    attendanceIsDeptDropdownOpen,
    setAttendanceIsDeptDropdownOpen,
    attendanceDeptDropdownRef,

    // Designation
    designations,
    attendanceDesgId,
    setAttendanceDesgId,
    attendanceDesgSearchQuery,
    setAttendanceDesgSearchQuery,
    attendanceIsDesgDropdownOpen,
    setAttendanceIsDesgDropdownOpen,
    attendanceDesgDropdownRef,

    // Shift
    shifts,
    attendanceShiftId,
    setAttendanceShiftId,
    attendanceShiftSearchQuery,
    setAttendanceShiftSearchQuery,
    attendanceIsShiftDropdownOpen,
    setAttendanceIsShiftDropdownOpen,
    attendanceShiftDropdownRef,

    // Employee
    attendanceFilteredEmployees,
    attendanceEmployeeId,
    setAttendanceEmployeeId,
    attendanceSelectedEmployeeName,
    attendanceEmpSearchQuery,
    setAttendanceEmpSearchQuery,
    attendanceIsEmpDropdownOpen,
    setAttendanceIsEmpDropdownOpen,
    attendanceEmpDropdownRef
}) => {
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
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[150px]"
                                >
                                    <span className="truncate">{attendanceWeeks.find(w => w.value === attendanceWeek)?.label || 'Select Week'}</span>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                                </button>

                                {attendanceIsWeekDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5 animate-in fade-in duration-200">
                                        {attendanceWeeks.map((w, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setAttendanceWeek(w.value);
                                                    setAttendanceIsWeekDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceWeek === w.value
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

            {/* Searchable Department Selector */}
            <div className="relative" ref={attendanceDeptDropdownRef}>
                <button
                    type="button"
                    onClick={() => {
                        setAttendanceIsDeptDropdownOpen(!attendanceIsDeptDropdownOpen);
                        setAttendanceDeptSearchQuery('');
                    }}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                >
                    <span className="truncate">
                        {departments.find(d => d.dept_id === attendanceDeptId)?.dept_name || 'All Departments'}
                    </span>
                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                </button>

                {attendanceIsDeptDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                        <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search departments..."
                                value={attendanceDeptSearchQuery}
                                onChange={(e) => setAttendanceDeptSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceDeptId('');
                                    setAttendanceIsDeptDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceDeptId === ''
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                All Departments
                            </button>
                            {departments.filter(d => d.dept_name.toLowerCase().includes(attendanceDeptSearchQuery.toLowerCase())).length > 0 ? (
                                departments.filter(d => d.dept_name.toLowerCase().includes(attendanceDeptSearchQuery.toLowerCase())).map(d => (
                                    <button
                                        key={d.dept_id}
                                        type="button"
                                        onClick={() => {
                                            setAttendanceDeptId(d.dept_id);
                                            setAttendanceIsDeptDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceDeptId === d.dept_id
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

            {/* Searchable Designation Selector */}
            <div className="relative" ref={attendanceDesgDropdownRef}>
                <button
                    type="button"
                    onClick={() => {
                        setAttendanceIsDesgDropdownOpen(!attendanceIsDesgDropdownOpen);
                        setAttendanceDesgSearchQuery('');
                    }}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                >
                    <span className="truncate">
                        {designations.find(d => String(d.desg_id) === String(attendanceDesgId))?.desg_name || 'All Designations'}
                    </span>
                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                </button>

                {attendanceIsDesgDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                        <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search designations..."
                                value={attendanceDesgSearchQuery}
                                onChange={(e) => setAttendanceDesgSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceDesgId('');
                                    setAttendanceIsDesgDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceDesgId === ''
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                All Designations
                            </button>
                            {designations.filter(d => d.desg_name.toLowerCase().includes(attendanceDesgSearchQuery.toLowerCase())).length > 0 ? (
                                designations.filter(d => d.desg_name.toLowerCase().includes(attendanceDesgSearchQuery.toLowerCase())).map(d => (
                                    <button
                                        key={d.desg_id}
                                        type="button"
                                        onClick={() => {
                                            setAttendanceDesgId(d.desg_id);
                                            setAttendanceIsDesgDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${String(attendanceDesgId) === String(d.desg_id)
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

            {/* Searchable Shift Selector */}
            <div className="relative" ref={attendanceShiftDropdownRef}>
                <button
                    type="button"
                    onClick={() => {
                        setAttendanceIsShiftDropdownOpen(!attendanceIsShiftDropdownOpen);
                        setAttendanceShiftSearchQuery('');
                    }}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                >
                    <span className="truncate">
                        {attendanceShiftId === 'open_shift' ? 'Open Shift' : (shifts.find(s => String(s.shift_id) === String(attendanceShiftId))?.shift_name || 'All Shifts')}
                    </span>
                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                </button>

                {attendanceIsShiftDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                        <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search shifts..."
                                value={attendanceShiftSearchQuery}
                                onChange={(e) => setAttendanceShiftSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceShiftId('');
                                    setAttendanceIsShiftDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceShiftId === ''
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                All Shifts
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceShiftId('open_shift');
                                    setAttendanceIsShiftDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceShiftId === 'open_shift'
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                Open Shift
                            </button>
                            {shifts.filter(s => s.shift_name.toLowerCase().includes(attendanceShiftSearchQuery.toLowerCase())).length > 0 ? (
                                shifts.filter(s => s.shift_name.toLowerCase().includes(attendanceShiftSearchQuery.toLowerCase())).map(s => (
                                    <button
                                        key={s.shift_id}
                                        type="button"
                                        onClick={() => {
                                            setAttendanceShiftId(s.shift_id);
                                            setAttendanceIsShiftDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${String(attendanceShiftId) === String(s.shift_id)
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

            {/* Searchable Employee Selector */}
            <div className="relative" ref={attendanceEmpDropdownRef}>
                <button
                    type="button"
                    onClick={() => {
                        setAttendanceIsEmpDropdownOpen(!attendanceIsEmpDropdownOpen);
                        setAttendanceEmpSearchQuery('');
                    }}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d] min-w-[180px]"
                >
                    <span className="truncate">{attendanceSelectedEmployeeName}</span>
                    <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
                </button>

                {attendanceIsEmpDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col animate-in fade-in duration-200">
                        <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={attendanceEmpSearchQuery}
                                onChange={(e) => setAttendanceEmpSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceEmployeeId('');
                                    setAttendanceIsEmpDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceEmployeeId === ''
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                All Employees
                            </button>
                            {attendanceFilteredEmployees.length > 0 ? (
                                attendanceFilteredEmployees.map(emp => (
                                    <button
                                        key={emp.user_id}
                                        type="button"
                                        onClick={() => {
                                            setAttendanceEmployeeId(emp.user_id);
                                            setAttendanceIsEmpDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${attendanceEmployeeId === emp.user_id
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
        </div>
    );
};

export default AttendanceViewToolbar;
