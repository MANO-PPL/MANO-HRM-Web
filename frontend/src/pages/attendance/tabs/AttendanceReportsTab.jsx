import React from 'react';
import {
    ChevronDown,
    Download,
    Eye,
    DownloadCloud,
    Table,
    CheckCircle,
    XCircle,
    Calendar as CalendarIcon,
    Clock,
    TrendingUp,
    FileText,
    FileType,
    FileSpreadsheet,
    AlertCircle
} from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import MonthPicker from '../../../components/MonthPicker';

const getAlignmentClass = (colHeader) => {
    if (!colHeader) return 'center';
    const header = colHeader.toLowerCase();
    if (['name', 'department', 'dept', 'employee', 'reason', 'location', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => header.includes(k))) {
        return 'left';
    }
    return 'center';
};

const getCellStyle = (cellValue, colHeader, isTotalsRow, isEven) => {
    const val = cellValue?.toString().trim() || '';
    const header = colHeader.toLowerCase();

    if (isTotalsRow) {
        return {
            fontWeight: 'bold',
            color: '#1F4E78',
            backgroundColor: '#F2F4F7',
            borderTop: '2px solid #1F4E78',
            borderBottom: '4px double #1F4E78',
            borderLeft: '1px solid #CBD5E1',
            borderRight: '1px solid #CBD5E1',
            paddingTop: '8px',
            paddingBottom: '8px',
        };
    }

    const defaultBorder = '1px solid #CBD5E1';

    if (val === 'Present' || val === '1.0') {
        return {
            backgroundColor: '#E6F4EA',
            color: '#137333',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    if (val === 'Absent' || val === '0.0') {
        return {
            backgroundColor: '#FCE8E6',
            color: '#C5221F',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return {
            backgroundColor: '#FEF7E0',
            color: '#B06000',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    if (val === 'Sun' || val === 'Sat') {
        return {
            backgroundColor: '#F1F3F4',
            color: '#5F6368',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    if (val.toLowerCase() === 'on leave' || val.toLowerCase() === 'leave' || val.toLowerCase() === 'half day') {
        return {
            backgroundColor: '#E8F0FE',
            color: '#1A73E8',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }

    return {
        backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF',
        color: '#333333',
        border: defaultBorder
    };
};

const AttendanceReportsTab = ({
    reportsTypeDropdownRef,
    reportsIsTypeDropdownOpen,
    setReportsIsTypeDropdownOpen,
    reportsReportType,
    setReportsReportType,
    reportsUseCustomRange,
    setReportsUseCustomRange,
    reportsCustomStartDate,
    setReportsCustomStartDate,
    reportsCustomEndDate,
    setReportsCustomEndDate,
    reportsSelectedMonth,
    setReportsSelectedMonth,
    reportsSelectedWeek,
    setReportsSelectedWeek,
    reportsWeeks,
    reportsWeekDropdownRef,
    reportsIsWeekDropdownOpen,
    setReportsIsWeekDropdownOpen,
    reportsSelectedDate,
    setReportsSelectedDate,
    reportsColsDropdownRef,
    reportsIsColsDropdownOpen,
    setReportsIsColsDropdownOpen,
    reportsExportColumns,
    setReportsExportColumns,
    reportsFileFormat,
    setReportsFileFormat,
    handleReportsGenerate,
    reportsIsGenerating,
    reportsActiveTab,
    setReportsActiveTab,
    reportsPreviewData,
    reportsSummary,
    reportsLoadingPreview,
    reportsExportHistory
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Control Bar: Generate Report */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-4 space-y-4">
                {/* Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
                    {/* Report Type Dropdown */}
                    <div className="relative xl:col-span-4" ref={reportsTypeDropdownRef}>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Report Type</label>
                        <button
                            type="button"
                            onClick={() => setReportsIsTypeDropdownOpen(!reportsIsTypeDropdownOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                        >
                            <span className="truncate">
                                {(() => {
                                    const opts = [
                                        { value: 'attendance_detailed', label: 'Detailed Attendance Report' },
                                        { value: 'attendance_matrix_daily', label: 'Daily Attendance Matrix' },
                                        { value: 'matrix_daily', label: 'Daily Attendance Report' },
                                        { value: 'attendance_matrix_monthly', label: 'Monthly Attendance Matrix' },
                                        { value: 'matrix_monthly', label: 'Monthly Attendance Report' },
                                        { value: 'attendance_summary', label: 'Monthly Summary Report' },
                                        { value: 'attendance_matrix_weekly', label: 'Weekly Attendance Matrix' },
                                        { value: 'matrix_weekly', label: 'Weekly Attendance Report' }
                                    ];
                                    return opts.find(o => o.value === reportsReportType)?.label || reportsReportType;
                                })()}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${reportsIsTypeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {reportsIsTypeDropdownOpen && (
                            <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                {[
                                    { value: 'attendance_detailed', label: 'Detailed Attendance Report' },
                                    { value: 'attendance_matrix_daily', label: 'Daily Attendance Matrix' },
                                    { value: 'matrix_daily', label: 'Daily Attendance Report' },
                                    { value: 'attendance_matrix_monthly', label: 'Monthly Attendance Matrix' },
                                    { value: 'matrix_monthly', label: 'Monthly Attendance Report' },
                                    { value: 'attendance_summary', label: 'Monthly Summary Report' },
                                    { value: 'attendance_matrix_weekly', label: 'Weekly Attendance Matrix' },
                                    { value: 'matrix_weekly', label: 'Weekly Attendance Report' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setReportsReportType(opt.value);
                                            setReportsIsTypeDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${reportsReportType === opt.value
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

                    {/* Date/Month/Week Pickers */}
                    <div className="xl:col-span-5">
                        {reportsUseCustomRange ? (
                            <div className="grid grid-cols-2 gap-3.5">
                                <DatePicker
                                    label="Start Date"
                                    value={reportsCustomStartDate}
                                    onChange={(val) => setReportsCustomStartDate(val)}
                                    compact={true}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={reportsCustomEndDate}
                                    onChange={(val) => setReportsCustomEndDate(val)}
                                    compact={true}
                                />
                            </div>
                        ) : (
                            <div>
                                {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(reportsReportType) ? (
                                    <MonthPicker
                                        label="Select Month"
                                        value={reportsSelectedMonth}
                                        onChange={(val) => setReportsSelectedMonth(val)}
                                        compact={true}
                                    />
                                ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportsReportType) ? (
                                    <div className="grid grid-cols-2 gap-3.5">
                                        <MonthPicker
                                            label="Select Month"
                                            value={reportsSelectedMonth}
                                            onChange={(val) => setReportsSelectedMonth(val)}
                                            compact={true}
                                        />
                                        <div className="relative" ref={reportsWeekDropdownRef}>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Select Week</label>
                                            <button
                                                type="button"
                                                onClick={() => setReportsIsWeekDropdownOpen(!reportsIsWeekDropdownOpen)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                            >
                                                <span className="truncate">{reportsWeeks.find(w => w.value === reportsSelectedWeek)?.label || 'Select Week'}</span>
                                                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${reportsIsWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {reportsIsWeekDropdownOpen && (
                                                <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                                    {reportsWeeks.map((w, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setReportsSelectedWeek(w.value);
                                                                setReportsIsWeekDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${reportsSelectedWeek === w.value
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
                                        value={reportsSelectedDate}
                                        onChange={(val) => setReportsSelectedDate(val)}
                                        compact={true}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Columns Selection Dropdown */}
                    <div className="relative xl:col-span-3" ref={reportsColsDropdownRef}>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Columns to Include</label>
                        <button
                            type="button"
                            onClick={() => setReportsIsColsDropdownOpen(!reportsIsColsDropdownOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                        >
                            <span className="truncate">
                                {Object.values(reportsExportColumns).filter(Boolean).length} Columns
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${reportsIsColsDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {reportsIsColsDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-full min-w-[220px] bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-3 space-y-2.5">
                                {[
                                    { id: 'shift', label: 'Shift' },
                                    { id: 'timeIn', label: 'Time In' },
                                    { id: 'timeOut', label: 'Time Out' },
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
                                            setReportsExportColumns(prev => ({
                                                ...prev,
                                                [col.id]: !prev[col.id]
                                            }));
                                        }}
                                        className="w-full flex items-center gap-2.5 cursor-pointer focus:outline-none group text-left"
                                    >
                                        <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${reportsExportColumns[col.id]
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                            : 'bg-white dark:bg-github-dark-subtle border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                            }`}>
                                            {reportsExportColumns[col.id] && (
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
                </div>

                {/* Action Toolbar */}
                <div className="border-t border-slate-100 dark:border-[#30363d] pt-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Date Range Toggle */}
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={() => setReportsUseCustomRange(!reportsUseCustomRange)}
                            className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${reportsUseCustomRange
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                : 'bg-white dark:bg-[#161b22] border-slate-300 dark:border-[#30363d] group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                }`}>
                                {reportsUseCustomRange && (
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

                    {/* Format Tabs & Action Buttons */}
                    <div data-tour-id="att-reports-download-actions" className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Format:</span>
                            <div className="h-8 flex items-center p-1 bg-slate-100 dark:bg-[#161b22] rounded-md border border-slate-200 dark:border-[#30363d]">
                                {[
                                    { id: 'xlsx', label: 'Excel' },
                                    { id: 'csv', label: 'CSV' },
                                    { id: 'pdf', label: 'PDF' }
                                ].map((format) => {
                                    const isSelected = reportsFileFormat === format.id;
                                    return (
                                        <button
                                            key={format.id}
                                            type="button"
                                            onClick={() => setReportsFileFormat(format.id)}
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

                        <button
                            onClick={handleReportsGenerate}
                            disabled={reportsIsGenerating}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider rounded-md shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-8 text-[10px] cursor-pointer"
                        >
                            {reportsIsGenerating ? (
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
                    </div>
                </div>
            </div>

            {/* Preview and History Views */}
            <div className="space-y-4">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-fit">
                    {[
                        { id: 'preview', label: 'Data Preview', icon: Eye },
                        { id: 'history', label: 'Export History', icon: DownloadCloud }
                    ].map((tab) => {
                        const isSelected = reportsActiveTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setReportsActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                    ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                <tab.icon size={15} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Card */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden transition-all">
                    {reportsActiveTab === 'preview' && (
                        <>
                            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                        <Table className="text-slate-400" size={18} />
                                        Report Preview
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">
                                        Report data for <span className="font-medium text-slate-700 dark:text-slate-300">{reportsReportType.replace(/_/g, ' ')}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Report Summary Cards */}
                            {reportsPreviewData.rows && reportsPreviewData.rows.length > 0 && reportsReportType !== 'employee_master' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/5">
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-450 dark:text-github-dark-muted uppercase tracking-wider">Total Present</span>
                                            <h3 className="text-xl font-black text-emerald-600 mt-0.5">{reportsSummary.present}</h3>
                                        </div>
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                            <CheckCircle size={16} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-450 dark:text-github-dark-muted uppercase tracking-wider">Total Absent</span>
                                            <h3 className="text-xl font-black text-rose-600 mt-0.5">{reportsSummary.absent}</h3>
                                        </div>
                                        <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg">
                                            <XCircle size={16} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-455 dark:text-github-dark-muted uppercase tracking-wider">Total Leave</span>
                                            <h3 className="text-xl font-black text-sky-600 mt-0.5">{reportsSummary.leave}</h3>
                                        </div>
                                        <div className="p-2 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 rounded-lg">
                                            <CalendarIcon size={16} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-455 dark:text-github-dark-muted uppercase tracking-wider">Total Half Day</span>
                                            <h3 className="text-xl font-black text-indigo-600 mt-0.5">{reportsSummary.halfDay}</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <Clock size={16} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-455 dark:text-github-dark-muted uppercase tracking-wider">Total Overtime</span>
                                            <h3 className="text-xl font-black text-purple-600 mt-0.5">{reportsSummary.overtime.toFixed(1)}h</h3>
                                        </div>
                                        <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
                                            <TrendingUp size={16} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto bg-slate-100 dark:bg-[#161b22]/50 p-4 border-t border-slate-200 dark:border-[#30363d] no-scrollbar">
                                {reportsLoadingPreview ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                        <p className="text-slate-500 text-sm font-medium">Loading preview data...</p>
                                    </div>
                                ) : reportsPreviewData.rows && reportsPreviewData.rows.length > 0 ? (
                                    <table className="w-full text-left border-collapse bg-white dark:bg-[#0d1117] text-slate-800 dark:text-github-dark-text shadow-sm rounded border border-slate-300 dark:border-[#30363d]" style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-[#30363d]">
                                            {reportsPreviewData.headers ? (
                                                <>
                                                    <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                        {reportsPreviewData.headers[0].map((cell, idx) => (
                                                            <th
                                                                key={idx}
                                                                rowSpan={cell.rowspan}
                                                                colSpan={cell.colspan}
                                                                className="px-4 py-3 whitespace-nowrap tracking-wider text-center text-xs font-bold uppercase border border-[#3A6085]"
                                                                style={{ backgroundColor: '#1F4E78', color: '#FFFFFF' }}
                                                            >
                                                                {cell.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                    <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold">
                                                        {reportsPreviewData.headers[1].map((cell, idx) => (
                                                            <th
                                                                key={idx}
                                                                className="px-4 py-2.5 whitespace-nowrap tracking-wider text-center text-xs font-bold uppercase border border-[#3A6085]"
                                                                style={{ backgroundColor: '#1F4E78', color: '#FFFFFF' }}
                                                            >
                                                                {cell.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </>
                                            ) : (
                                                <tr className="text-xs uppercase font-bold border-b border-slate-200 dark:border-[#30363d]">
                                                    {reportsPreviewData.columns.map((col, idx) => {
                                                        const alignment = getAlignmentClass(col);
                                                        return (
                                                            <th
                                                                key={idx}
                                                                className="px-4 py-3 whitespace-nowrap tracking-wider text-xs font-bold uppercase border border-[#3A6085]"
                                                                style={{
                                                                    backgroundColor: '#1F4E78',
                                                                    color: '#FFFFFF',
                                                                    textAlign: alignment
                                                                }}
                                                            >
                                                                {col?.toString().split('\n').map((line, lIdx) => (
                                                                    <div key={lIdx} className="leading-tight">{line}</div>
                                                                ))}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {reportsPreviewData.rows.map((row, rIdx) => {
                                                const isTotalsRow = row[0]?.toString().toUpperCase() === 'TOTALS';
                                                const isEven = rIdx % 2 === 0;
                                                return (
                                                    <tr key={rIdx} className="transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/10">
                                                        {row.map((cell, cIdx) => {
                                                            const colHeader = reportsPreviewData.columns[cIdx]?.toString() || '';
                                                            const cellStyle = getCellStyle(cell, colHeader, isTotalsRow, isEven);
                                                            const alignment = getAlignmentClass(colHeader);
                                                            return (
                                                                <td
                                                                    key={cIdx}
                                                                    className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                                                                    style={{ ...cellStyle, textAlign: alignment }}
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Table className="text-slate-200 dark:text-slate-700" size={48} />
                                        <p className="text-slate-500 text-sm">No data available for this selection.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {reportsActiveTab === 'history' && (
                        <>
                            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                    <DownloadCloud className="text-slate-400" size={18} />
                                    Export History
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#161b22]/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-[#30363d]">
                                        <tr className="bg-slate-50/50 dark:bg-github-dark-subtle/50 text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold">
                                            <th className="px-6 py-5">File Name</th>
                                            <th className="px-6 py-5">Generated</th>
                                            <th className="px-6 py-5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[#30363d]">
                                        {reportsExportHistory.map((file) => (
                                            <tr key={file.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2.5 rounded-lg shadow-sm ${file.name.endsWith('.pdf') ? 'bg-red-50 text-red-600' : file.name.endsWith('.csv') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'} dark:bg-github-dark-subtle dark:text-slate-300`}>
                                                            {file.name.endsWith('.pdf') ? <FileText size={18} /> : file.name.endsWith('.csv') ? <FileType size={18} /> : <FileSpreadsheet size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{file.type}</p>
                                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">{file.size}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-github-dark-muted">
                                                    {file.date}
                                                </td>
                                                <td className="px-6 py-5">
                                                    {file.status === 'Ready' ? (
                                                        <a
                                                            href={file.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={file.name}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-all cursor-pointer"
                                                        >
                                                            <CheckCircle size={14} /> Ready (Download)
                                                        </a>
                                                    ) : file.status === 'Generating' ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full shadow-sm animate-pulse">
                                                            <div className="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div> Generating...
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full shadow-sm">
                                                            <AlertCircle size={14} /> Failed
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceReportsTab;
