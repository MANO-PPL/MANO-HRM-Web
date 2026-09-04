import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Table } from 'lucide-react';
import { toast } from 'react-toastify';
import DashboardLayout from '../../components/DashboardLayout';
import { adminService } from '../../services/adminService';
import { useTour } from '../../context/TourContext';

// Modular Subcomponents
import AttendanceViewToolbar from './components/AttendanceViewToolbar';
import AttendanceMatrixGrid from './components/AttendanceMatrixGrid';
import EmployeeReportCard from './components/EmployeeReportCard';
import FullReportFiltersPanel from './components/FullReportFiltersPanel';
import FullReportPreviewTable from './components/FullReportPreviewTable';
import AttendanceDetailDrawer from './components/AttendanceDetailDrawer';
import ExportHistoryDrawer from './components/ExportHistoryDrawer';
import AttendanceRecordTooltip from './components/AttendanceRecordTooltip';
import ImageLightboxModal from './components/ImageLightboxModal';
import { getWeeksOfMonth } from './components/reportsUtils';

const PAGE_KEY = 'admin_reports';

// ─── Module-level Attendance View Cache ────────────────────────────────────────
// Persists across re-renders and tab switches within the same browser session.
// Key: serialised query params string → Value: { data, fetchedAt }
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const attendanceViewCache = new Map();

const Reports = () => {
    const navigate = useNavigate();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

    // Attendance View Filters State
    const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [attendanceEmployeeId, setAttendanceEmployeeId] = useState('');
    const [attendanceWeek, setAttendanceWeek] = useState('');
    const [attendanceReportType, setAttendanceReportType] = useState('matrix_monthly');
    const [attendanceIsEmpDropdownOpen, setAttendanceIsEmpDropdownOpen] = useState(false);
    const [attendanceEmpSearchQuery, setAttendanceEmpSearchQuery] = useState('');
    const [attendanceIsWeekDropdownOpen, setAttendanceIsWeekDropdownOpen] = useState(false);

    // Full Report Filters State
    const [tableMonth, setTableMonth] = useState(new Date().toISOString().slice(0, 7));
    const [tableDate, setTableDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableEmployeeId, setTableEmployeeId] = useState('');
    const [tableWeek, setTableWeek] = useState('');
    const [tableReportType, setTableReportType] = useState('matrix_monthly');
    const [tableUseCustomRange, setTableUseCustomRange] = useState(false);
    const [tableCustomStartDate, setTableCustomStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableCustomEndDate, setTableCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [tableExportColumns, setTableExportColumns] = useState({
        timeIn: true,
        timeOut: true,
        status: true,
        workedHours: true,
        requiredHours: false,
        late: false,
        location: false,
        attendanceDays: true
    });
    const [tableFileFormat, setTableFileFormat] = useState('xlsx');
    const [tableIsEmpDropdownOpen, setTableIsEmpDropdownOpen] = useState(false);
    const [tableEmpSearchQuery, setTableEmpSearchQuery] = useState('');
    const [tableIsTypeDropdownOpen, setTableIsTypeDropdownOpen] = useState(false);
    const [tableIsWeekDropdownOpen, setTableIsWeekDropdownOpen] = useState(false);
    const [tableIsColsDropdownOpen, setTableIsColsDropdownOpen] = useState(false);

    // UI View & Modal States
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewMode, setPreviewMode] = useState('card'); // 'card' | 'table'
    const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [hoveredRecord, setHoveredRecord] = useState(null);
    const [hoveredPosition, setHoveredPosition] = useState({ top: 0, left: 0 });

    // Metadata lists
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);

    // Department states
    const [attendanceDeptId, setAttendanceDeptId] = useState('');
    const [attendanceDeptSearchQuery, setAttendanceDeptSearchQuery] = useState('');
    const [attendanceIsDeptDropdownOpen, setAttendanceIsDeptDropdownOpen] = useState(false);

    const [tableDeptId, setTableDeptId] = useState('');
    const [tableDeptSearchQuery, setTableDeptSearchQuery] = useState('');
    const [tableIsDeptDropdownOpen, setTableIsDeptDropdownOpen] = useState(false);

    // Designation states
    const [attendanceDesgId, setAttendanceDesgId] = useState('');
    const [attendanceDesgSearchQuery, setAttendanceDesgSearchQuery] = useState('');
    const [attendanceIsDesgDropdownOpen, setAttendanceIsDesgDropdownOpen] = useState(false);

    const [tableDesgId, setTableDesgId] = useState('');
    const [tableDesgSearchQuery, setTableDesgSearchQuery] = useState('');
    const [tableIsDesgDropdownOpen, setTableIsDesgDropdownOpen] = useState(false);

    // Shift states
    const [attendanceShiftId, setAttendanceShiftId] = useState('');
    const [attendanceShiftSearchQuery, setAttendanceShiftSearchQuery] = useState('');
    const [attendanceIsShiftDropdownOpen, setAttendanceIsShiftDropdownOpen] = useState(false);

    const [tableShiftId, setTableShiftId] = useState('');
    const [tableShiftSearchQuery, setTableShiftSearchQuery] = useState('');
    const [tableIsShiftDropdownOpen, setTableIsShiftDropdownOpen] = useState(false);

    // Dropdown DOM refs for outside clicks
    const attendanceEmpDropdownRef = useRef(null);
    const attendanceWeekDropdownRef = useRef(null);
    const attendanceDeptDropdownRef = useRef(null);
    const attendanceDesgDropdownRef = useRef(null);
    const attendanceShiftDropdownRef = useRef(null);
    const tableEmpDropdownRef = useRef(null);
    const tableTypeDropdownRef = useRef(null);
    const tableWeekDropdownRef = useRef(null);
    const tableColsDropdownRef = useRef(null);
    const tableDeptDropdownRef = useRef(null);
    const tableDesgDropdownRef = useRef(null);
    const tableShiftDropdownRef = useRef(null);

    const tourSteps = useMemo(() => [
        {
            targetId: 'reports-attendance-view-tab',
            title: 'Attendance View',
            description: 'Switch to the Attendance View to display an interactive matrix showing a visual summary of daily attendance, leaves, and shift statuses.',
            action: () => setPreviewMode('card')
        },
        {
            targetId: 'reports-filters',
            title: 'Data Filters',
            description: 'Filter your report by date range, department, and specific employees.',
            action: () => setPreviewMode('card')
        },
        {
            targetId: 'reports-full-report-tab',
            title: 'Full Report',
            description: 'Switch to the Full Report tab to configure, generate, and export detailed reports for all activities, including Attendance, Daily Activity Reports (DAR), and Leaves in CSV or Excel format.',
            action: () => setPreviewMode('table')
        }
    ], [setPreviewMode]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (attendanceEmpDropdownRef.current && !attendanceEmpDropdownRef.current.contains(event.target)) {
                setAttendanceIsEmpDropdownOpen(false);
            }
            if (attendanceWeekDropdownRef.current && !attendanceWeekDropdownRef.current.contains(event.target)) {
                setAttendanceIsWeekDropdownOpen(false);
            }
            if (attendanceDeptDropdownRef.current && !attendanceDeptDropdownRef.current.contains(event.target)) {
                setAttendanceIsDeptDropdownOpen(false);
            }
            if (attendanceDesgDropdownRef.current && !attendanceDesgDropdownRef.current.contains(event.target)) {
                setAttendanceIsDesgDropdownOpen(false);
            }
            if (attendanceShiftDropdownRef.current && !attendanceShiftDropdownRef.current.contains(event.target)) {
                setAttendanceIsShiftDropdownOpen(false);
            }
            if (tableEmpDropdownRef.current && !tableEmpDropdownRef.current.contains(event.target)) {
                setTableIsEmpDropdownOpen(false);
            }
            if (tableTypeDropdownRef.current && !tableTypeDropdownRef.current.contains(event.target)) {
                setTableIsTypeDropdownOpen(false);
            }
            if (tableWeekDropdownRef.current && !tableWeekDropdownRef.current.contains(event.target)) {
                setTableIsWeekDropdownOpen(false);
            }
            if (tableColsDropdownRef.current && !tableColsDropdownRef.current.contains(event.target)) {
                setTableIsColsDropdownOpen(false);
            }
            if (tableDeptDropdownRef.current && !tableDeptDropdownRef.current.contains(event.target)) {
                setTableIsDeptDropdownOpen(false);
            }
            if (tableDesgDropdownRef.current && !tableDesgDropdownRef.current.contains(event.target)) {
                setTableIsDesgDropdownOpen(false);
            }
            if (tableShiftDropdownRef.current && !tableShiftDropdownRef.current.contains(event.target)) {
                setTableIsShiftDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const attendanceSelectedEmployeeName = employees.find(emp => emp.user_id === attendanceEmployeeId)?.user_name || 'All Employees';
    const attendanceFilteredEmployees = employees.filter(emp => {
        const matchesDept = !attendanceDeptId || String(emp.dept_id) === String(attendanceDeptId);
        const matchesDesg = !attendanceDesgId || String(emp.desg_id) === String(attendanceDesgId);
        const matchesShift = !attendanceShiftId || (attendanceShiftId === 'open_shift' ? !emp.shift_id : String(emp.shift_id) === String(attendanceShiftId));
        const matchesQuery = emp.user_name.toLowerCase().includes(attendanceEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesShift && matchesQuery;
    });

    const tableSelectedEmployeeName = employees.find(emp => emp.user_id === tableEmployeeId)?.user_name || 'All Employees';
    const tableFilteredEmployees = employees.filter(emp => {
        const matchesDept = !tableDeptId || String(emp.dept_id) === String(tableDeptId);
        const matchesDesg = !tableDesgId || String(emp.desg_id) === String(tableDesgId);
        const matchesShift = !tableShiftId || (tableShiftId === 'open_shift' ? !emp.shift_id : String(emp.shift_id) === String(tableShiftId));
        const matchesQuery = emp.user_name.toLowerCase().includes(tableEmpSearchQuery.toLowerCase());
        return matchesDept && matchesDesg && matchesShift && matchesQuery;
    });

    const attendanceWeeks = useMemo(() => getWeeksOfMonth(attendanceMonth), [attendanceMonth]);
    const tableWeeks = useMemo(() => getWeeksOfMonth(tableMonth), [tableMonth]);

    useEffect(() => {
        if (attendanceWeeks.length > 0) {
            setAttendanceWeek(attendanceWeeks[0].value);
        }
    }, [attendanceWeeks]);

    useEffect(() => {
        if (tableWeeks.length > 0) {
            setTableWeek(tableWeeks[0].value);
        }
    }, [tableWeeks]);

    useEffect(() => {
        if (attendanceEmployeeId) {
            const emp = employees.find(e => e.user_id === attendanceEmployeeId);
            if (emp) {
                const deptMismatch = attendanceDeptId && String(emp.dept_id) !== String(attendanceDeptId);
                const desgMismatch = attendanceDesgId && String(emp.desg_id) !== String(attendanceDesgId);
                const shiftMismatch = attendanceShiftId && (attendanceShiftId === 'open_shift' ? emp.shift_id !== null : String(emp.shift_id) !== String(attendanceShiftId));
                if (deptMismatch || desgMismatch || shiftMismatch) {
                    setAttendanceEmployeeId('');
                }
            }
        }
    }, [attendanceDeptId, attendanceDesgId, attendanceShiftId, employees, attendanceEmployeeId]);

    useEffect(() => {
        if (tableEmployeeId) {
            const emp = employees.find(e => e.user_id === tableEmployeeId);
            if (emp) {
                const deptMismatch = tableDeptId && String(emp.dept_id) !== String(tableDeptId);
                const desgMismatch = tableDesgId && String(emp.desg_id) !== String(tableDesgId);
                const shiftMismatch = tableShiftId && (tableShiftId === 'open_shift' ? emp.shift_id !== null : String(emp.shift_id) !== String(tableShiftId));
                if (deptMismatch || desgMismatch || shiftMismatch) {
                    setTableEmployeeId('');
                }
            }
        }
    }, [tableDeptId, tableDesgId, tableShiftId, employees, tableEmployeeId]);

    useEffect(() => {
        const fetchEmployeesAndDepts = async () => {
            try {
                const [empRes, deptRes, desgRes, shiftRes] = await Promise.all([
                    adminService.getAllUsers(),
                    adminService.getDepartments(),
                    adminService.getDesignations(),
                    adminService.getShifts()
                ]);
                if (empRes.success && empRes.users) {
                    const sorted = [...empRes.users].sort((a, b) => a.user_name.localeCompare(b.user_name));
                    setEmployees(sorted);
                }
                if (deptRes && deptRes.departments) {
                    const sortedDepts = [...deptRes.departments].sort((a, b) => a.dept_name.localeCompare(b.dept_name));
                    setDepartments(sortedDepts);
                }
                if (desgRes && desgRes.designations) {
                    const sortedDesgs = [...desgRes.designations].sort((a, b) => a.desg_name.localeCompare(b.desg_name));
                    setDesignations(sortedDesgs);
                }
                if (shiftRes && shiftRes.shifts) {
                    const sortedShifts = [...shiftRes.shifts].sort((a, b) => a.shift_name.localeCompare(b.shift_name));
                    setShifts(sortedShifts);
                }
            } catch (err) {
                console.error("Failed to load filter metadata", err);
            }
        };
        fetchEmployeesAndDepts();
    }, []);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: 'preview' }
        }));
    }, []);

    // Export History with Persistence
    const [exportHistory, setExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    useEffect(() => {
        localStorage.setItem('attendance_export_history', JSON.stringify(exportHistory));
    }, [exportHistory]);

    // Real Preview Data State
    const [previewData, setPreviewData] = useState({ columns: [], rows: [] });
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [cacheHit, setCacheHit] = useState(false);
    const bgRefreshTimerRef = useRef(null);

    // Compute activeFilters based on previewMode (card vs table)
    const activeFilters = useMemo(() => {
        const isCard = previewMode === 'card';
        const rType = isCard ? attendanceReportType : tableReportType;
        const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(rType);

        const selectedMonth = isCard ? attendanceMonth : tableMonth;
        const selectedDate = isCard ? attendanceDate : tableDate;
        const selectedWeek = isCard ? attendanceWeek : tableWeek;
        const selectedEmployeeId = isCard ? attendanceEmployeeId : tableEmployeeId;
        const selectedDeptId = isCard ? attendanceDeptId : tableDeptId;
        const selectedDesgId = isCard ? attendanceDesgId : tableDesgId;
        const selectedShiftId = isCard ? attendanceShiftId : tableShiftId;
        const useCustomRange = isCard ? false : tableUseCustomRange;
        const customStartDate = isCard ? '' : tableCustomStartDate;
        const customEndDate = isCard ? '' : tableCustomEndDate;
        const exportColumnsObj = isCard ? {
            timeIn: true,
            timeOut: true,
            status: true,
            workedHours: true,
            requiredHours: true,
            late: true,
            location: true,
            attendanceDays: true
        } : tableExportColumns;

        const dateToUse = (isWeekly && !useCustomRange) ? selectedWeek : selectedDate;
        const qStart = useCustomRange ? customStartDate : '';
        const qEnd = useCustomRange ? customEndDate : '';
        const exportColumnsKey = JSON.stringify(exportColumnsObj);

        return {
            reportType: rType,
            selectedMonth,
            selectedDate,
            selectedWeek,
            selectedEmployeeId,
            selectedDeptId,
            selectedDesgId,
            selectedShiftId,
            useCustomRange,
            customStartDate,
            customEndDate,
            exportColumnsKey,
            dateToUse,
            qStart,
            qEnd
        };
    }, [
        previewMode,
        attendanceReportType, attendanceMonth, attendanceDate, attendanceWeek, attendanceEmployeeId, attendanceDeptId, attendanceDesgId, attendanceShiftId,
        tableReportType, tableMonth, tableDate, tableWeek, tableEmployeeId, tableDeptId, tableDesgId, tableShiftId, tableUseCustomRange, tableCustomStartDate, tableCustomEndDate, tableExportColumns
    ]);

    // Build a stable cache key from activeFilters
    const cacheKey = useMemo(() => {
        return JSON.stringify({
            selectedMonth: activeFilters.selectedMonth,
            reportType: activeFilters.reportType,
            dateToUse: activeFilters.dateToUse,
            selectedEmployeeId: activeFilters.selectedEmployeeId,
            selectedDeptId: activeFilters.selectedDeptId,
            selectedDesgId: activeFilters.selectedDesgId,
            selectedShiftId: activeFilters.selectedShiftId,
            useCustomRange: activeFilters.useCustomRange,
            customStartDate: activeFilters.customStartDate,
            customEndDate: activeFilters.customEndDate,
            exportColumnsKey: activeFilters.exportColumnsKey
        });
    }, [activeFilters]);

    const fetchAndCachePreview = useCallback(async ({ key, cancelled, showLoadingIfNoCache }) => {
        if (showLoadingIfNoCache) setLoadingPreview(true);

        try {
            const res = await adminService.getReportPreview(
                activeFilters.selectedMonth,
                activeFilters.reportType,
                activeFilters.dateToUse,
                activeFilters.selectedEmployeeId,
                activeFilters.qStart,
                activeFilters.qEnd,
                activeFilters.exportColumnsKey,
                activeFilters.selectedDeptId,
                activeFilters.selectedDesgId,
                activeFilters.selectedShiftId
            );
            if (!cancelled && res.ok) {
                attendanceViewCache.set(key, { data: res.data, fetchedAt: Date.now() });
                setPreviewData(res.data);
                setCacheHit(false);
            }
        } catch (error) {
            if (!cancelled) {
                console.error('fetchPreview failed:', error);
                toast.error('Failed to load preview data');
            }
        } finally {
            if (!cancelled) setLoadingPreview(false);
        }
    }, [activeFilters]);

    // Reset hover and detail states when active filter settings or view modes change
    useEffect(() => {
        setHoveredRecord(null);
        setSelectedRecord(null);
        setIsDetailSidebarOpen(false);
    }, [
        attendanceDeptId,
        attendanceDesgId,
        attendanceMonth,
        attendanceDate,
        attendanceWeek,
        attendanceEmployeeId,
        attendanceReportType,
        tableDeptId,
        tableDesgId,
        tableMonth,
        tableDate,
        tableWeek,
        tableEmployeeId,
        tableReportType,
        tableUseCustomRange,
        tableCustomStartDate,
        tableCustomEndDate,
        previewMode
    ]);

    // Clear hover record if loading starts
    useEffect(() => {
        if (loadingPreview) {
            setHoveredRecord(null);
        }
    }, [loadingPreview]);

    useEffect(() => {
        let cancelled = false;

        const cached = attendanceViewCache.get(cacheKey);
        const now = Date.now();
        const isStale = !cached || (now - cached.fetchedAt) >= CACHE_TTL_MS;

        if (cached) {
            setPreviewData(cached.data);
            setCacheHit(true);
            setLoadingPreview(false);
        }

        if (isStale) {
            fetchAndCachePreview({ key: cacheKey, cancelled, showLoadingIfNoCache: !cached });
        }

        return () => { cancelled = true; };
    }, [cacheKey, fetchAndCachePreview]);

    // Background refresh every 15 minutes
    useEffect(() => {
        if (bgRefreshTimerRef.current) clearInterval(bgRefreshTimerRef.current);

        bgRefreshTimerRef.current = setInterval(() => {
            let cancelled = false;
            attendanceViewCache.delete(cacheKey);
            fetchAndCachePreview({ key: cacheKey, cancelled, showLoadingIfNoCache: false });
        }, CACHE_TTL_MS);

        return () => {
            if (bgRefreshTimerRef.current) clearInterval(bgRefreshTimerRef.current);
        };
    }, [cacheKey, fetchAndCachePreview]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(tableReportType);
            const dateToUse = (isWeekly && !tableUseCustomRange) ? tableWeek : tableDate;

            const qStart = tableUseCustomRange ? tableCustomStartDate : "";
            const qEnd = tableUseCustomRange ? tableCustomEndDate : "";

            const res = await adminService.queueReport(
                tableMonth,
                tableReportType,
                tableFileFormat,
                tableEmployeeId,
                dateToUse,
                qStart,
                qEnd,
                JSON.stringify(tableExportColumns),
                tableDeptId,
                tableDesgId,
                tableShiftId
            );
            if (res.ok) {
                const reportId = res.reportId;
                const filename = `Report_${tableReportType}_${tableUseCustomRange ? `${tableCustomStartDate}_to_${tableCustomEndDate}` : (tableMonth || dateToUse)}.${tableFileFormat}`;
                const reportTypeLabel = tableReportType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

    const reportsSummary = useMemo(() => {
        const summary = {
            present: 0,
            absent: 0,
            leave: 0,
            halfDay: 0,
            overtime: 0,
            hasData: false
        };

        if (!previewData || !previewData.rows || previewData.rows.length === 0) {
            return summary;
        }

        if (previewData.cardRecords && previewData.cardRecords.length > 0) {
            summary.hasData = true;
            previewData.cardRecords.forEach(record => {
                const status = record.status || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    summary.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    summary.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    summary.leave += 1;
                } else if (statusLower === 'half day') {
                    summary.halfDay += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    summary.present += 1;
                }

                const otHrs = parseFloat(record.overtime_hours);
                if (!isNaN(otHrs) && otHrs > 0) {
                    summary.overtime += otHrs;
                }
            });
            return summary;
        }

        const columns = previewData.columns || [];
        const rows = previewData.rows || [];

        const dataRows = rows.filter(row => {
            const firstCell = row[0]?.toString().toUpperCase();
            return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
        });

        if (dataRows.length === 0) return summary;

        const presentIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'present' || cl === 'present days';
        });
        const absentIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'absent' || cl === 'absent days';
        });
        const leaveIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'on leave' || cl === 'leave' || cl === 'leave days';
        });
        const halfDayIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl === 'half day' || cl === 'half days';
        });
        const overtimeIdx = columns.findIndex(c => {
            const cl = c?.toString().toLowerCase() || '';
            return cl.includes('overtime') || cl === 'ot' || cl === 'ot hrs';
        });
        const statusIdx = columns.findIndex(c => (c?.toString().toLowerCase() || '') === 'status');

        if (presentIdx !== -1 || absentIdx !== -1 || leaveIdx !== -1 || halfDayIdx !== -1 || overtimeIdx !== -1) {
            summary.hasData = true;
            dataRows.forEach(row => {
                if (presentIdx !== -1) summary.present += parseInt(row[presentIdx]) || 0;
                if (absentIdx !== -1) summary.absent += parseInt(row[absentIdx]) || 0;
                if (leaveIdx !== -1) summary.leave += parseInt(row[leaveIdx]) || 0;
                if (halfDayIdx !== -1) summary.halfDay += parseInt(row[halfDayIdx]) || 0;
                if (overtimeIdx !== -1) summary.overtime += parseFloat(row[overtimeIdx]) || 0;
            });
        } else if (statusIdx !== -1) {
            summary.hasData = true;
            dataRows.forEach(row => {
                const status = row[statusIdx]?.toString() || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    summary.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    summary.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    summary.leave += 1;
                } else if (statusLower === 'half day') {
                    summary.halfDay += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    summary.present += 1;
                }
            });
        }

        return summary;
    }, [previewData]);

    const matrixData = useMemo(() => {
        if (!previewData.cardRecords || previewData.cardRecords.length === 0) {
            return { employees: [], dates: [] };
        }
        const empMap = new Map();
        const dateSet = new Set();
        previewData.cardRecords.forEach(record => {
            if (!empMap.has(record.user_id)) {
                empMap.set(record.user_id, {
                    user_id: record.user_id,
                    user_name: record.user_name,
                    designation: record.designation,
                    department: record.department,
                    records: {}
                });
            }
            empMap.get(record.user_id).records[record.rawDate] = record;
            dateSet.add(record.rawDate);
        });
        const dates = Array.from(dateSet).sort();
        const employees = Array.from(empMap.values());

        employees.forEach(emp => {
            const stats = {
                present: 0,
                absent: 0,
                leave: 0,
                halfDay: 0,
                weeklyOff: 0,
                overtimeHrs: 0
            };

            dates.forEach(rawDate => {
                const record = emp.records[rawDate];
                if (!record) return;

                const status = record.status || '';
                const statusLower = status.toLowerCase();

                if (status === 'Present' || statusLower.includes('present')) {
                    stats.present += 1;
                } else if (status === 'Absent' || statusLower.includes('absent')) {
                    stats.absent += 1;
                } else if (statusLower === 'on leave' || statusLower === 'leave') {
                    stats.leave += 1;
                } else if (statusLower === 'half day') {
                    stats.halfDay += 1;
                } else if (status === 'Sun' || status === 'Sat' || statusLower.includes('weekly off') || statusLower === 'wo') {
                    stats.weeklyOff += 1;
                } else if (statusLower.includes('late') || statusLower.includes('overtime')) {
                    stats.present += 1;
                }

                const otHrs = parseFloat(record.overtime_hours);
                if (!isNaN(otHrs) && otHrs > 0) {
                    stats.overtimeHrs += otHrs;
                }
            });

            emp.stats = stats;
        });

        return {
            employees,
            dates
        };
    }, [previewData.cardRecords]);

    // Hover and Click Handlers for Matrix
    const handleCellHover = (e, record) => {
        if (record) {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoveredRecord(record);
            setHoveredPosition({
                top: rect.top,
                left: rect.left + rect.width / 2
            });
        }
    };

    const handleCellLeave = () => {
        setHoveredRecord(null);
    };

    const handleRecordClick = (record) => {
        setSelectedRecord(record);
        setIsDetailSidebarOpen(true);
        setHoveredRecord(null);
    };

    return (
        <DashboardLayout title="Reports & Exports" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="min-h-[calc(100vh-64px)] px-2 pt-1.5 pb-2.5 flex flex-col space-y-2.5">
                {/* Switcher & Filters Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                    {/* View Switcher Tabs */}
                    <div className="flex w-fit items-center gap-2 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                        {[
                            { id: 'card', label: 'Attendance View', icon: TrendingUp, tourId: 'reports-attendance-view-tab' },
                            { id: 'table', label: 'Full Report', icon: Table, tourId: 'reports-full-report-tab' }
                        ].map((tab) => {
                            const isSelected = previewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    data-tour-id={tab.tourId}
                                    onClick={() => setPreviewMode(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${isSelected
                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <tab.icon size={14} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Attendance View Filters Toolbar (In line with tab switcher) */}
                    {previewMode === 'card' && (
                        <AttendanceViewToolbar
                            attendanceReportType={attendanceReportType}
                            attendanceMonth={attendanceMonth}
                            setAttendanceMonth={setAttendanceMonth}
                            attendanceWeek={attendanceWeek}
                            setAttendanceWeek={setAttendanceWeek}
                            attendanceDate={attendanceDate}
                            setAttendanceDate={setAttendanceDate}
                            attendanceWeeks={attendanceWeeks}
                            attendanceIsWeekDropdownOpen={attendanceIsWeekDropdownOpen}
                            setAttendanceIsWeekDropdownOpen={setAttendanceIsWeekDropdownOpen}
                            attendanceWeekDropdownRef={attendanceWeekDropdownRef}

                            departments={departments}
                            attendanceDeptId={attendanceDeptId}
                            setAttendanceDeptId={setAttendanceDeptId}
                            attendanceDeptSearchQuery={attendanceDeptSearchQuery}
                            setAttendanceDeptSearchQuery={setAttendanceDeptSearchQuery}
                            attendanceIsDeptDropdownOpen={attendanceIsDeptDropdownOpen}
                            setAttendanceIsDeptDropdownOpen={setAttendanceIsDeptDropdownOpen}
                            attendanceDeptDropdownRef={attendanceDeptDropdownRef}

                            designations={designations}
                            attendanceDesgId={attendanceDesgId}
                            setAttendanceDesgId={setAttendanceDesgId}
                            attendanceDesgSearchQuery={attendanceDesgSearchQuery}
                            setAttendanceDesgSearchQuery={setAttendanceDesgSearchQuery}
                            attendanceIsDesgDropdownOpen={attendanceIsDesgDropdownOpen}
                            setAttendanceIsDesgDropdownOpen={setAttendanceIsDesgDropdownOpen}
                            attendanceDesgDropdownRef={attendanceDesgDropdownRef}

                            shifts={shifts}
                            attendanceShiftId={attendanceShiftId}
                            setAttendanceShiftId={setAttendanceShiftId}
                            attendanceShiftSearchQuery={attendanceShiftSearchQuery}
                            setAttendanceShiftSearchQuery={setAttendanceShiftSearchQuery}
                            attendanceIsShiftDropdownOpen={attendanceIsShiftDropdownOpen}
                            setAttendanceIsShiftDropdownOpen={setAttendanceIsShiftDropdownOpen}
                            attendanceShiftDropdownRef={attendanceShiftDropdownRef}

                            attendanceFilteredEmployees={attendanceFilteredEmployees}
                            attendanceEmployeeId={attendanceEmployeeId}
                            setAttendanceEmployeeId={setAttendanceEmployeeId}
                            attendanceSelectedEmployeeName={attendanceSelectedEmployeeName}
                            attendanceEmpSearchQuery={attendanceEmpSearchQuery}
                            setAttendanceEmpSearchQuery={setAttendanceEmpSearchQuery}
                            attendanceIsEmpDropdownOpen={attendanceIsEmpDropdownOpen}
                            setAttendanceIsEmpDropdownOpen={setAttendanceIsEmpDropdownOpen}
                            attendanceEmpDropdownRef={attendanceEmpDropdownRef}
                        />
                    )}
                </div>

                {/* Full Report Parameters Panel */}
                {previewMode === 'table' && (
                    <FullReportFiltersPanel
                        reportTypeOptions={reportTypeOptions}
                        tableReportType={tableReportType}
                        setTableReportType={setTableReportType}
                        tableIsTypeDropdownOpen={tableIsTypeDropdownOpen}
                        setTableIsTypeDropdownOpen={setTableIsTypeDropdownOpen}
                        tableTypeDropdownRef={tableTypeDropdownRef}

                        departments={departments}
                        tableDeptId={tableDeptId}
                        setTableDeptId={setTableDeptId}
                        tableDeptSearchQuery={tableDeptSearchQuery}
                        setTableDeptSearchQuery={setTableDeptSearchQuery}
                        tableIsDeptDropdownOpen={tableIsDeptDropdownOpen}
                        setTableIsDeptDropdownOpen={setTableIsDeptDropdownOpen}
                        tableDeptDropdownRef={tableDeptDropdownRef}

                        designations={designations}
                        tableDesgId={tableDesgId}
                        setTableDesgId={setTableDesgId}
                        tableDesgSearchQuery={tableDesgSearchQuery}
                        setTableDesgSearchQuery={setTableDesgSearchQuery}
                        tableIsDesgDropdownOpen={tableIsDesgDropdownOpen}
                        setTableIsDesgDropdownOpen={setTableIsDesgDropdownOpen}
                        tableDesgDropdownRef={tableDesgDropdownRef}

                        shifts={shifts}
                        tableShiftId={tableShiftId}
                        setTableShiftId={setTableShiftId}
                        tableShiftSearchQuery={tableShiftSearchQuery}
                        setTableShiftSearchQuery={setTableShiftSearchQuery}
                        tableIsShiftDropdownOpen={tableIsShiftDropdownOpen}
                        setTableIsShiftDropdownOpen={setTableIsShiftDropdownOpen}
                        tableShiftDropdownRef={tableShiftDropdownRef}

                        tableFilteredEmployees={tableFilteredEmployees}
                        tableEmployeeId={tableEmployeeId}
                        setTableEmployeeId={setTableEmployeeId}
                        tableSelectedEmployeeName={tableSelectedEmployeeName}
                        tableEmpSearchQuery={tableEmpSearchQuery}
                        setTableEmpSearchQuery={setTableEmpSearchQuery}
                        tableIsEmpDropdownOpen={tableIsEmpDropdownOpen}
                        setTableIsEmpDropdownOpen={setTableIsEmpDropdownOpen}
                        tableEmpDropdownRef={tableEmpDropdownRef}

                        tableUseCustomRange={tableUseCustomRange}
                        setTableUseCustomRange={setTableUseCustomRange}
                        tableCustomStartDate={tableCustomStartDate}
                        setTableCustomStartDate={setTableCustomStartDate}
                        tableCustomEndDate={tableCustomEndDate}
                        setTableCustomEndDate={setTableCustomEndDate}
                        tableMonth={tableMonth}
                        setTableMonth={setTableMonth}
                        tableDate={tableDate}
                        setTableDate={setTableDate}
                        tableWeek={tableWeek}
                        setTableWeek={setTableWeek}
                        tableWeeks={tableWeeks}
                        tableIsWeekDropdownOpen={tableIsWeekDropdownOpen}
                        setTableIsWeekDropdownOpen={setTableIsWeekDropdownOpen}
                        tableWeekDropdownRef={tableWeekDropdownRef}

                        tableExportColumns={tableExportColumns}
                        setTableExportColumns={setTableExportColumns}
                        tableIsColsDropdownOpen={tableIsColsDropdownOpen}
                        setTableIsColsDropdownOpen={setTableIsColsDropdownOpen}
                        tableColsDropdownRef={tableColsDropdownRef}

                        tableFileFormat={tableFileFormat}
                        setTableFileFormat={setTableFileFormat}
                        isGenerating={isGenerating}
                        handleGenerate={handleGenerate}
                        onOpenHistory={() => setIsHistorySidebarOpen(true)}
                    />
                )}

                {/* Main Content Area: Attendance Matrix / Employee Card vs Full Report Spreadsheet */}
                {previewMode === 'card' ? (
                    <div className="space-y-4">
                        {/* Dedicated Single Employee View if an individual employee is selected */}
                        {attendanceEmployeeId && previewData.rows && previewData.rows.length > 0 && (
                            <div className="animate-in fade-in duration-300">
                                <EmployeeReportCard
                                    row={previewData.rows[0]}
                                    columns={previewData.columns}
                                />
                            </div>
                        )}

                        {/* Attendance Matrix Table */}
                        <AttendanceMatrixGrid
                            loadingPreview={loadingPreview}
                            matrixData={matrixData}
                            onCellHover={handleCellHover}
                            onCellLeave={handleCellLeave}
                            onRecordClick={handleRecordClick}
                        />
                    </div>
                ) : (
                    /* Full Report View: Spreadsheet Excel-replica Table */
                    <FullReportPreviewTable
                        activeFilters={activeFilters}
                        previewData={previewData}
                        loadingPreview={loadingPreview}
                        reportsSummary={reportsSummary}
                        cacheHit={cacheHit}
                    />
                )}

                {/* Slide-over Export History Drawer */}
                <ExportHistoryDrawer
                    isOpen={isHistorySidebarOpen}
                    exportHistory={exportHistory}
                    onClose={() => setIsHistorySidebarOpen(false)}
                />

                {/* Attendance Record Detail Sidebar */}
                <AttendanceDetailDrawer
                    isOpen={isDetailSidebarOpen}
                    selectedRecord={selectedRecord}
                    onClose={() => setIsDetailSidebarOpen(false)}
                    onPreviewImage={(img) => setPreviewImage(img)}
                />

                {/* Cell Hover Tooltip */}
                <AttendanceRecordTooltip
                    hoveredRecord={hoveredRecord}
                    hoveredPosition={hoveredPosition}
                />
            </div>

            {/* Image Lightbox Modal */}
            <ImageLightboxModal
                previewImage={previewImage}
                onClose={() => setPreviewImage(null)}
            />
        </DashboardLayout>
    );
};

export default Reports;

// Reports Hub - Live Attendance Matrix & Export Generation
