import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    FileText,
    Download,
    Calendar,
    FileSpreadsheet,
    FileType,
    CheckCircle,
    AlertCircle,
    DownloadCloud,
    Eye,
    Table,
    ChevronDown,
    Search
} from 'lucide-react';

import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import DatePicker from '../../components/DatePicker';
import MonthPicker from '../../components/MonthPicker';

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

    // 1. Totals row styling
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

    // Default borders
    const defaultBorder = '1px solid #CBD5E1';

    // 2. Conditional formatting based on cell values (Excel replica colors)
    // Present or 1.0 status (Green)
    if (val === 'Present' || val === '1.0') {
        return {
            backgroundColor: '#E6F4EA',
            color: '#137333',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Absent or 0.0 status (Red)
    if (val === 'Absent' || val === '0.0') {
        return {
            backgroundColor: '#FCE8E6',
            color: '#C5221F',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Late or Late Minutes/Count > 0 (Orange)
    if (val.toLowerCase().includes('late') || (header.includes('late') && Number(val) > 0)) {
        return {
            backgroundColor: '#FEF7E0',
            color: '#B06000',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Weekend Sat/Sun (Lavender)
    if (val === 'Sun' || val === 'Sat') {
        return {
            backgroundColor: '#F1F3F4',
            color: '#5F6368',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }
    // Leaves status
    if (val.toLowerCase() === 'on leave' || val.toLowerCase() === 'leave' || val.toLowerCase() === 'half day') {
        return {
            backgroundColor: '#E8F0FE',
            color: '#1A73E8',
            fontWeight: 'bold',
            border: defaultBorder
        };
    }

    // Default Zebra Striping Styles
    return {
        backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF',
        color: '#333333',
        border: defaultBorder
    };
};

const getWeeksOfMonth = (monthStr) => {
    if (!monthStr) return [];
    const [year, monthNum] = monthStr.split('-').map(Number);
    const weeks = [];
    const firstDate = new Date(year, monthNum - 1, 1);
    const lastDate = new Date(year, monthNum, 0);

    let currentStart = new Date(firstDate);
    while (currentStart <= lastDate) {
        let currentEnd = new Date(currentStart);
        const dayOfWeek = currentStart.getDay(); // 0 is Sunday, 1 is Monday...
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        currentEnd.setDate(currentStart.getDate() + daysToSunday);

        if (currentEnd > lastDate) {
            currentEnd = new Date(lastDate);
        }

        const weekLabel = `Week ${weeks.length + 1} (${currentStart.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - ${currentEnd.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })})`;
        const startVal = currentStart.toISOString().slice(0, 10);
        weeks.push({ label: weekLabel, value: startVal });

        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }
    return weeks;
};

const Reports = () => {
    const navigate = useNavigate();

    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportType, setReportType] = useState('matrix_monthly');
    const [fileFormat, setFileFormat] = useState('xlsx');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'history'

    // New filters states
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [useCustomRange, setUseCustomRange] = useState(false);
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedWeek, setSelectedWeek] = useState('');
    const [exportColumns, setExportColumns] = useState({
        timeIn: true,
        timeOut: true,
        workedHours: true,
        requiredHours: true,
        late: true,
        location: true,
        attendanceDays: true
    });

    // Searchable employee select states
    const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
    const [empSearchQuery, setEmpSearchQuery] = useState('');
    const empDropdownRef = React.useRef(null);

    // Custom dropdown states
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
    const [isColsDropdownOpen, setIsColsDropdownOpen] = useState(false);

    const typeDropdownRef = React.useRef(null);
    const weekDropdownRef = React.useRef(null);
    const colsDropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
                setIsEmpDropdownOpen(false);
            }
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
                setIsTypeDropdownOpen(false);
            }
            if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target)) {
                setIsWeekDropdownOpen(false);
            }
            if (colsDropdownRef.current && !colsDropdownRef.current.contains(event.target)) {
                setIsColsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedEmployeeName = employees.find(emp => emp.user_id === selectedEmployeeId)?.user_name || 'All Employees';
    const filteredEmployees = employees.filter(emp => 
        emp.user_name.toLowerCase().includes(empSearchQuery.toLowerCase())
    );

    const weeks = React.useMemo(() => getWeeksOfMonth(selectedMonth), [selectedMonth]);

    useEffect(() => {
        if (weeks.length > 0) {
            setSelectedWeek(weeks[0].value);
        }
    }, [weeks]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await adminService.getAllUsers();
                if (res.success && res.users) {
                    const sorted = [...res.users].sort((a, b) => a.user_name.localeCompare(b.user_name));
                    setEmployees(sorted);
                }
            } catch (err) {
                console.error("Failed to load employees for filtering", err);
            }
        };
        fetchEmployees();
    }, []);

    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab }
        }));
    }, [activeTab]);

    // Export History with Persistence
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    // Save history to localStorage whenever it changes
    React.useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Real Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Fetch Preview — use JSON.stringify(exportColumns) so any checkbox toggle reliably
    // re-fires this effect, even if React batches the object-reference comparison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const exportColumnsKey = JSON.stringify(exportColumns);

    React.useEffect(() => {
        let cancelled = false;
        const fetchPreview = async () => {
            console.log("fetchPreview triggered:", {
                selectedMonth,
                reportType,
                dateToUse: (['matrix_weekly', 'attendance_matrix_weekly'].includes(reportType) && !useCustomRange) ? selectedWeek : selectedDate,
                selectedEmployeeId,
                useCustomRange,
                customStartDate,
                customEndDate,
                exportColumns
            });
            setLoadingPreview(true);
            try {
                const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportType);
                const dateToUse = (isWeekly && !useCustomRange) ? selectedWeek : selectedDate;

                const qStart = useCustomRange ? customStartDate : "";
                const qEnd = useCustomRange ? customEndDate : "";

                const res = await adminService.getReportPreview(
                    selectedMonth,
                    reportType,
                    dateToUse,
                    selectedEmployeeId,
                    qStart,
                    qEnd,
                    exportColumnsKey
                );
                if (!cancelled && res.ok) {
                    console.log("fetchPreview success, columns count:", res.data.columns?.length);
                    setPreviewData(res.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("fetchPreview failed:", error);
                    toast.error("Failed to load preview data");
                }
            } finally {
                if (!cancelled) setLoadingPreview(false);
            }
        };
        fetchPreview();
        return () => { cancelled = true; };
    }, [selectedMonth, reportType, selectedDate, selectedEmployeeId, useCustomRange, customStartDate, customEndDate, selectedWeek, exportColumnsKey]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportType);
            const dateToUse = (isWeekly && !useCustomRange) ? selectedWeek : selectedDate;

            const qStart = useCustomRange ? customStartDate : "";
            const qEnd = useCustomRange ? customEndDate : "";

            const res = await adminService.queueReport(
                selectedMonth,
                reportType,
                fileFormat,
                selectedEmployeeId,
                dateToUse,
                qStart,
                qEnd,
                JSON.stringify(exportColumns)
            );
            if (res.ok) {
                const reportId = res.reportId;
                const filename = `Report_${reportType}_${useCustomRange ? `${customStartDate}_to_${customEndDate}` : (selectedMonth || dateToUse)}.${fileFormat}`;
                const reportTypeLabel = reportType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                const newReport = {
                    id: reportId || Date.now().toString(),
                    reportId: reportId,
                    name: filename,
                    type: reportTypeLabel,
                    date: new Date().toLocaleString(),
                    status: 'Generating',
                    size: 'Pending'
                };
                setExportHistory(prev => [newReport, ...prev]);
                toast.info("Report is compiling in the background! Track it in Export History.");
                setActiveTab('history');
            }
        } catch (error) {
            toast.error(error.message || "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };

    // Poll status of generating reports in history
    useEffect(() => {
        const generatingReports = exportHistory.filter(item => item.status === 'Generating');
        if (generatingReports.length === 0) return;

        const interval = setInterval(async () => {
            let updated = false;
            const nextHistory = await Promise.all(exportHistory.map(async (item) => {
                if (item.status === 'Generating' && item.reportId) {
                    try {
                        const res = await adminService.getReportStatus(item.reportId);
                        if (res.ok && res.data) {
                            const { status, file_url, error_message } = res.data;
                            if (status === 'completed') {
                                updated = true;
                                toast.success(`Report Ready: ${item.type} has compiled successfully.`);
                                // Trigger automatic download in background
                                const link = document.createElement('a');
                                link.href = file_url;
                                link.setAttribute('download', item.name);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                return {
                                    ...item,
                                    status: 'Ready',
                                    file_url,
                                    size: 'S3 Link'
                                };
                            } else if (status === 'failed') {
                                updated = true;
                                toast.error(`Report Failed: ${error_message || 'Compilation failed'}`);
                                return {
                                    ...item,
                                    status: 'Failed',
                                    size: 'Error'
                                };
                            }
                        }
                    } catch (err) {
                        console.error("Failed to poll status for report", item.reportId, err);
                    }
                }
                return item;
            }));

            if (updated) {
                setExportHistory(nextHistory);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [exportHistory]);

    const reportTypeOptions = [
        { value: 'attendance_matrix_daily', label: 'Daily Attendance Matrix' },
        { value: 'matrix_daily', label: 'Daily Attendance Report' },
        { value: 'employee_master', label: 'Employee Master Data' },
        { value: 'attendance_matrix_monthly', label: 'Monthly Attendance Matrix' },
        { value: 'matrix_monthly', label: 'Monthly Attendance Report' },
        { value: 'attendance_summary', label: 'Monthly Summary Report' },
        { value: 'attendance_matrix_weekly', label: 'Weekly Attendance Matrix' },
        { value: 'matrix_weekly', label: 'Weekly Attendance Report' }
    ];

    const selectedReportTypeLabel = reportTypeOptions.find(opt => opt.value === reportType)?.label || reportType;
    const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportType);

    return (
        <DashboardLayout title="Reports & Exports">
            <div className="space-y-6">
                {/* Top Control Bar: Generate Report */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border p-4 space-y-4">
                    {/* Row 1: Parameters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
                        {/* Custom Report Type Dropdown */}
                        <div className="relative xl:col-span-3" ref={typeDropdownRef}>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Report Type</label>
                            <button
                                type="button"
                                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                            >
                                <span className="truncate">{selectedReportTypeLabel}</span>
                                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isTypeDropdownOpen && (
                                <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                    {reportTypeOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                setReportType(opt.value);
                                                setIsTypeDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                reportType === opt.value 
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

                        {/* Custom Searchable Employee Select */}
                        <div className="relative xl:col-span-3" ref={empDropdownRef}>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Employee</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEmpDropdownOpen(!isEmpDropdownOpen);
                                    setEmpSearchQuery('');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                            >
                                <span className="truncate">{selectedEmployeeName}</span>
                                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isEmpDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isEmpDropdownOpen && (
                                <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 flex flex-col">
                                    <div className="relative mb-2">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search employees..."
                                            value={empSearchQuery}
                                            onChange={(e) => setEmpSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedEmployeeId('');
                                                setIsEmpDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                selectedEmployeeId === '' 
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            All Employees
                                        </button>
                                        {filteredEmployees.length > 0 ? (
                                            filteredEmployees.map(emp => (
                                                <button
                                                    key={emp.user_id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedEmployeeId(emp.user_id);
                                                        setIsEmpDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                        selectedEmployeeId === emp.user_id 
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
                        {reportType !== 'employee_master' && (
                            <div className="xl:col-span-4">
                                {useCustomRange ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <DatePicker
                                            label="Start Date"
                                            value={customStartDate}
                                            onChange={(val) => setCustomStartDate(val)}
                                            compact={true}
                                        />
                                        <DatePicker
                                            label="End Date"
                                            value={customEndDate}
                                            onChange={(val) => setCustomEndDate(val)}
                                            compact={true}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        {['matrix_monthly', 'attendance_matrix_monthly', 'attendance_detailed', 'attendance_summary'].includes(reportType) ? (
                                            <MonthPicker
                                                label="Select Month"
                                                value={selectedMonth}
                                                onChange={(val) => setSelectedMonth(val)}
                                                compact={true}
                                            />
                                        ) : ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportType) ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                                <MonthPicker
                                                    label="Select Month"
                                                    value={selectedMonth}
                                                    onChange={(val) => setSelectedMonth(val)}
                                                    compact={true}
                                                />
                                                <div className="relative" ref={weekDropdownRef}>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Select Week</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                                    >
                                                        <span className="truncate">{weeks.find(w => w.value === selectedWeek)?.label || 'Select Week'}</span>
                                                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isWeekDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {isWeekDropdownOpen && (
                                                        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                                                            {weeks.map((w, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedWeek(w.value);
                                                                        setIsWeekDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                                        selectedWeek === w.value 
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
                                                value={selectedDate}
                                                onChange={(val) => setSelectedDate(val)}
                                                compact={true}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Columns Selection Dropdown */}
                        {reportType !== 'employee_master' && (
                            <div className="relative xl:col-span-2" ref={colsDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted mb-1 ml-0.5">Columns to Include</label>
                                <button
                                    type="button"
                                    onClick={() => setIsColsDropdownOpen(!isColsDropdownOpen)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-semibold text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all text-left shadow-sm select-none hover:bg-slate-100 dark:hover:bg-[#21262d]"
                                >
                                    <span className="truncate">
                                        {Object.values(exportColumns).filter(Boolean).length} Columns Selected
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-300 ${isColsDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isColsDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-full min-w-[220px] bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl z-50 p-3 space-y-2.5">
                                        {[
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
                                                    setExportColumns(prev => ({
                                                        ...prev,
                                                        [col.id]: !prev[col.id]
                                                    }));
                                                }}
                                                className="w-full flex items-center gap-2.5 cursor-pointer focus:outline-none group text-left"
                                            >
                                                <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${
                                                    exportColumns[col.id]
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                                        : 'bg-white dark:bg-github-dark-subtle border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                                }`}>
                                                    {exportColumns[col.id] && (
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
                                onClick={() => setUseCustomRange(!useCustomRange)}
                                className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    useCustomRange
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                        : 'bg-white dark:bg-[#161b22] border-slate-300 dark:border-[#30363d] group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                                }`}>
                                    {useCustomRange && (
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
                        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                            {/* File Format Tabs Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-github-dark-muted">Format:</span>
                                <div className="h-8 flex items-center p-1 bg-slate-100 dark:bg-[#161b22] rounded-md border border-slate-200 dark:border-[#30363d]">
                                    {[
                                        { id: 'xlsx', label: 'Excel' },
                                        { id: 'csv', label: 'CSV' },
                                        { id: 'pdf', label: 'PDF' }
                                    ].map((format) => {
                                        const isSelected = fileFormat === format.id;
                                        return (
                                            <button
                                                key={format.id}
                                                type="button"
                                                onClick={() => setFileFormat(format.id)}
                                                className={`h-full px-3 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                                                    isSelected 
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
                        </div>
                    </div>
                </div>

                {/* Main Content Area: Tabs + Full Width Table */}
                <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-fit">
                        {[
                            { id: 'preview', label: 'Data Preview', icon: Eye },
                            { id: 'history', label: 'Export History', icon: DownloadCloud }
                        ].map((tab) => {
                            const isSelected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-202'
                                    }`}
                                >
                                    <tab.icon size={15} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                    <span className="leading-none">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Full Width Card - Responsive Height */}
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden transition-all">

                        {activeTab === 'preview' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                            <Table className="text-slate-400" size={18} />
                                            Report Preview
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">
                                            Report data for <span className="font-medium text-slate-700 dark:text-slate-300">{reportType.replace(/_/g, ' ')}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto no-scrollbar bg-slate-100 p-4 border-t border-slate-200 dark:border-github-dark-border">
                                    {loadingPreview ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                            <p className="text-slate-500 text-sm font-medium">Loading preview data...</p>
                                        </div>
                                    ) : previewData.rows && previewData.rows.length > 0 ? (
                                        <table className="w-full text-left border-collapse bg-white text-slate-800 shadow-sm rounded border border-slate-300" style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-github-dark-border">
                                                {previewData.headers ? (
                                                    <>
                                                        <tr className="text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                            {previewData.headers[0].map((cell, idx) => (
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
                                                            {previewData.headers[1].map((cell, idx) => (
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
                                                    <tr className="text-xs uppercase font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                        {previewData.columns.map((col, idx) => {
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
                                                {previewData.rows.map((row, rIdx) => {
                                                    const isTotalsRow = row[0]?.toString().toUpperCase() === 'TOTALS';
                                                    const isEven = rIdx % 2 === 0;
                                                    return (
                                                        <tr key={rIdx} className="transition-colors hover:bg-slate-100/50">
                                                            {row.map((cell, cIdx) => {
                                                                const colHeader = previewData.columns[cIdx]?.toString() || '';
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

                        {activeTab === 'history' && (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/10 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                        <DownloadCloud className="text-slate-400" size={18} />
                                        Export History
                                    </h3>

                                </div>
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-github-dark-subtle/95 backdrop-blur-md shadow-sm">
                                            <tr className="bg-slate-50/50 dark:bg-github-dark-subtle/50 text-xs uppercase text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                                <th className="px-6 py-5">File Name</th>
                                                <th className="px-6 py-5">Generated</th>
                                                <th className="px-6 py-5">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {exportHistory.map((file) => (
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
        </DashboardLayout>
    );
};

export default Reports;
