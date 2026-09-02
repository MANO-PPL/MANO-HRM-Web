import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import CorrectionDocumentModal from '../../components/attendance/CorrectionDocumentModal';
import { useTour } from '../../context/TourContext';
import Webcam from 'react-webcam';
import {
    ArrowRight,
    LogOut,
    MapPin,
    Calendar as CalendarIcon,
    Camera,
    X,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Download,
    Clock,
    BarChart3,
    History,
    MoreVertical,
    AlertCircle,
    Check,
    FileClock,
    CheckCircle,
    XCircle,
    Eye,
    User,
    Plus,
    ArrowUpRight,
    FileSpreadsheet,
    FileType,
    DownloadCloud,
    Table,
    ChevronDown,
    Search,
    TrendingUp,
    Paperclip,
    UploadCloud,
    Edit3,
    Trash2,
    Save,
    RotateCcw,
    Sparkles,
    Info,
    ExternalLink,
    Navigation,
    Locate,
    Target,
    ShieldCheck
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { Bar, Pie, Line, Radar } from 'react-chartjs-2';

import CustomCalendar from '../../components/CustomCalendar';
import DatePicker from '../../components/DatePicker';
import MonthPicker from '../../components/MonthPicker';
import VisualCorrectionTimeline from '../../components/attendance/VisualCorrectionTimeline';
import TimePicker from '../../components/TimePicker';
import { getStatusStyle, ATTENDANCE_STATUS } from '../../utils/attendanceStatus';

// Modular Components & Tabs
import AttendanceTimeLocationHeader from './components/AttendanceTimeLocationHeader';
import CheckpointModal from './components/CheckpointModal';
import AttendanceCameraModal from './components/AttendanceCameraModal';
import MarkAttendanceTab from './tabs/MarkAttendanceTab';
import AttendanceHistoryTab from './tabs/AttendanceHistoryTab';
import AttendanceAnalyticsTab from './tabs/AttendanceAnalyticsTab';
import AttendanceCorrectionTab from './tabs/AttendanceCorrectionTab';
import AttendanceReportsTab from './tabs/AttendanceReportsTab';

// ─── Per-Page Tour Steps ───────────────────────────────────────────────────
const PAGE_KEY = 'emp_attendance';

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

const getWeeksOfMonth = (monthStr) => {
    if (!monthStr) return [];
    const [year, monthNum] = monthStr.split('-').map(Number);
    const weeks = [];
    const firstDate = new Date(year, monthNum - 1, 1);
    const lastDate = new Date(year, monthNum, 0);

    let currentStart = new Date(firstDate);
    while (currentStart <= lastDate) {
        let currentEnd = new Date(currentStart);
        const dayOfWeek = currentStart.getDay();
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

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
);

const ThemedSelect = ({ label, value, options, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    return (
        <div className={`space-y-1.5 ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full h-11 px-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl flex items-center justify-between text-slate-700 dark:text-slate-200 text-sm font-normal transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99] shadow-sm select-none cursor-pointer group"
                >
                    <span className="truncate">{selectedOption ? selectedOption.label : 'Select...'}</span>
                    <ChevronDown size={14} className={`text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-1.5 z-[150] bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl overflow-hidden"
                        >
                            <div className="p-1.5 max-h-72 overflow-y-auto no-scrollbar">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-normal transition-all mb-0.5 last:mb-0 cursor-pointer ${value === opt.value
                                                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const Attendance = () => {
    const { user } = useAuth();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    const fetchUserLocation = useCallback(async (isManualRefresh = false) => {
        if (!navigator.geolocation) {
            setLocation(prev => ({ ...prev, error: "Geolocation not supported", address: "Location Access Denied" }));
            return;
        }

        setIsLoadingLoc(true);

        const onSuccess = async (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                const addr = data.address || {};

                const street = addr.road || addr.building || addr.amenity || addr.commercial;
                const locality = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential;
                const city = addr.city || addr.town || addr.village || addr.county;
                const state = addr.state;
                const postcode = addr.postcode;

                const primaryAddress = street
                    ? (locality ? `${street}, ${locality}` : street)
                    : (locality || city || data.display_name?.split(',')[0] || 'Unknown Location');

                const secondaryParts = [city, state, postcode].filter(Boolean);
                const secondaryAddress = secondaryParts.join(', ');

                setLocation({
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy ? Math.round(accuracy) : null,
                    address: primaryAddress,
                    secondaryAddress,
                    fullAddress: data.display_name || primaryAddress,
                    error: null
                });

                if (isManualRefresh) {
                    toast.success("Location synchronized via high-accuracy GPS");
                }
            } catch (err) {
                setLocation({
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy ? Math.round(accuracy) : null,
                    address: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
                    secondaryAddress: '',
                    fullAddress: '',
                    error: null
                });
            } finally {
                setIsLoadingLoc(false);
            }
        };

        const onError = (err) => {
            console.warn("fetchUserLocation (highAccuracy=true) failed, trying fallback with low accuracy...", err);
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                (fallbackErr) => {
                    setLocation(prev => ({ ...prev, error: fallbackErr.message, address: 'Location Access Denied' }));
                    setIsLoadingLoc(false);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
            );
        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        fetchUserLocation();

        let watchId;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;
                    setLocation(prev => ({
                        ...prev,
                        lat: latitude,
                        lng: longitude,
                        accuracy: accuracy ? Math.round(accuracy) : prev.accuracy
                    }));
                },
                (err) => console.warn("watchPosition failed:", err),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
            );
        }

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [fetchUserLocation]);

    // Current date for Mark Attendance
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(formattedToday);

    // Month for Reports/History/Analytics
    const [reportYear, setReportYear] = useState(today.getFullYear());
    const [reportMonthIdx, setReportMonthIdx] = useState(today.getMonth()); // 0-11
    const [fileFormat, setFileFormat] = useState('xlsx');

    // Derived YYYY-MM string for API
    const reportMonth = `${reportYear}-${String(reportMonthIdx + 1).padStart(2, '0')}`;

    // Data State
    const [dailySessions, setDailySessions] = useState([]); // For Mark Attendance tab
    const [monthlySessions, setMonthlySessions] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, today.getMonth() + 1, 0).toISOString().split('T')[0];
        const cacheKey = `${startDate}_${endDate}`;
        const cached = attendanceCacheData.records[cacheKey];
        return cached ? (cached.data || cached) : [];
    });
    const [loading, setLoading] = useState(false);
    const [holidays, setHolidays] = useState(() => attendanceCacheData.holidays?.holidays || attendanceCacheData.holidays || []);
    const [myShift, setMyShift] = useState(() => {
        // Handle both response structure { ok, shift } and direct shift object
        const cached = attendanceCacheData.shiftPolicy;
        if (cached?.shift) return cached.shift;
        if (cached?.id || cached?.name) return cached; // If it's already a shift object
        return null;
    });

    // Analytics Date Filter States
    const [analyticsFilterType, setAnalyticsFilterType] = useState('this_month'); // 'this_month' | 'last_month' | 'select_month' | 'custom'
    const [analyticsSelectedMonth, setAnalyticsSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [analyticsStartDate, setAnalyticsStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [analyticsEndDate, setAnalyticsEndDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });
    const [analyticsSessions, setAnalyticsSessions] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);



    // Fetch Holidays and Shift Policy
    useEffect(() => {
        attendanceService.getHolidays()
            .then(data => setHolidays(data.holidays || []))
            .catch(console.error);

        attendanceService.getMyShiftPolicy()
            .then(data => {
                if (data.success || data.ok || data.shift) setMyShift(data.shift);
            })
            .catch(console.error);
    }, []);

    // Navigation State
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'mark_attendance';
    });
    const [subTab, setSubTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('subTab') || 'history';
    });
    const [isCorrectionDrawerOpen, setIsCorrectionDrawerOpen] = useState(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    // ─── Tour Steps with Tab Navigation Hooks ─────────────────────────────
    const tourSteps = React.useMemo(() => [
        {
            targetId: 'att-tab-mark',
            title: 'Mark Attendance Tab',
            description: 'This tab is your clock-in/out screen. Use it every day to record your work session: it captures your GPS location and a webcam selfie.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('mark_attendance');
            }
        },
        {
            targetId: 'att-session-actions',
            title: 'Time In & Time Out',
            description: 'Use these buttons to start and end your work sessions. Click Time In to begin your workday (capturing your webcam selfie and GPS location), and click Time Out when you finish your shift to close the session.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('mark_attendance');
            }
        },
        {
            targetId: 'att-correction-btn',
            title: 'Request Correction',
            description: 'If you ever forget to clock in/out, or need to adjust your times, use this button to submit an adjustment request for a specific date.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('mark_attendance');
            }
        },
        {
            targetId: 'att-correction-drawer',
            title: 'Correction Drawer',
            description: 'When you click request correction, this sidebar opens. Use this sidebar to adjust your attendance. Select the date, choose a correction method (Manual Entry or Full Day Reset), enter your corrected times under Session Details, provide a clear explanation for the request, and click Submit Request to send it to your administrator for approval.',
            action: () => {
                setActiveTab('mark_attendance');
                setIsCorrectionDrawerOpen(true);
            }
        },
        {
            targetId: 'att-tab-my-attendance',
            title: 'My Attendance Tab',
            description: 'Switch to this tab to view your daily history, analytics, correction request logs, and self-service reports.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('my_attendance');
                setSubTab('history');
            }
        },
        {
            targetId: 'att-history-sub-tab',
            title: 'Attendance History',
            description: 'This section displays your complete daily log history for the month. You can view check-in/out times, captured selfie verifications, and GPS location pins.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('my_attendance');
                setSubTab('history');
            }
        },
        {
            targetId: 'att-analytics-sub-tab',
            title: 'Analytics & Insights',
            description: 'This section visualizes your attendance data. View your monthly active hours, check-in consistency, average late arrivals, and weekly activity metrics.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('my_attendance');
                setSubTab('analytics');
            }
        },
        {
            targetId: 'att-correction-sub-tab',
            title: 'Correction Requests',
            description: 'Track the real-time status of all your submitted attendance correction requests. View whether they are Pending, Approved, or Rejected, along with administrator remarks.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('my_attendance');
                setSubTab('correction');
            }
        },
        {
            targetId: 'att-reports-sub-tab',
            title: 'Reports & Exports',
            description: 'Under the Reports tab, you can export your official monthly attendance records. Select your preferred file format (Excel, CSV, or PDF) and click the Download Report button to export your records.',
            action: () => {
                setIsCorrectionDrawerOpen(false);
                setActiveTab('my_attendance');
                setSubTab('reports');
            }
        },
    ], []);


    // Reports Self-Service States
    const [reportsSelectedMonth, setReportsSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportsSelectedDate, setReportsSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportsReportType, setReportsReportType] = useState('attendance_detailed');
    const [reportsFileFormat, setReportsFileFormat] = useState('xlsx');
    const [reportsIsGenerating, setReportsIsGenerating] = useState(false);
    const [reportsActiveTab, setReportsActiveTab] = useState('preview'); // 'preview' | 'history'
    const [reportsUseCustomRange, setReportsUseCustomRange] = useState(false);
    const [reportsCustomStartDate, setReportsCustomStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportsCustomEndDate, setReportsCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [reportsSelectedWeek, setReportsSelectedWeek] = useState('');
    const [reportsExportColumns, setReportsExportColumns] = useState({
        shift: true,
        timeIn: true,
        timeOut: true,
        workedHours: true,
        requiredHours: true,
        late: true,
        location: true,
        attendanceDays: true
    });

    const [reportsIsTypeDropdownOpen, setReportsIsTypeDropdownOpen] = useState(false);
    const [reportsIsWeekDropdownOpen, setReportsIsWeekDropdownOpen] = useState(false);
    const [reportsIsColsDropdownOpen, setReportsIsColsDropdownOpen] = useState(false);

    const reportsTypeDropdownRef = useRef(null);
    const reportsWeekDropdownRef = useRef(null);
    const reportsColsDropdownRef = useRef(null);

    const [reportsExportHistory, setReportsExportHistory] = useState(() => {
        const savedHistory = localStorage.getItem('attendance_my_reports_export_history');
        return savedHistory ? JSON.parse(savedHistory) : [];
    });

    const [reportsPreviewData, setReportsPreviewData] = useState({ columns: [], rows: [] });
    const [reportsLoadingPreview, setReportsLoadingPreview] = useState(false);

    const reportsSummary = useMemo(() => {
        const summary = {
            present: 0,
            absent: 0,
            leave: 0,
            halfDay: 0,
            overtime: 0,
            hasData: false
        };

        if (!reportsPreviewData || !reportsPreviewData.rows || reportsPreviewData.rows.length === 0) {
            return summary;
        }

        // 1. If we have cardRecords, we can calculate from daily records directly
        if (reportsPreviewData.cardRecords && reportsPreviewData.cardRecords.length > 0) {
            summary.hasData = true;
            reportsPreviewData.cardRecords.forEach(record => {
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
                    summary.present += 1; // late/overtime counts as present
                }

                const otHrs = parseFloat(record.overtime_hours);
                if (!isNaN(otHrs) && otHrs > 0) {
                    summary.overtime += otHrs;
                }
            });
            return summary;
        }

        // 2. Otherwise, parse spreadsheet columns
        const columns = reportsPreviewData.columns || [];
        const rows = reportsPreviewData.rows || [];

        const dataRows = rows.filter(row => {
            const firstCell = row[0]?.toString().toUpperCase();
            return firstCell !== 'TOTALS' && firstCell !== 'TOTAL';
        });

        if (dataRows.length === 0) return summary;

        // Find indices of relevant columns
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
    }, [reportsPreviewData]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const sTab = params.get('subTab');
        const openDrawer = params.get('openDrawer');
        const date = params.get('date');
        if (tab) {
            setActiveTab(tab);
        }
        if (sTab) {
            setSubTab(sTab);
        }
        if (openDrawer === 'true') {
            setIsCorrectionDrawerOpen(true);
        }
        if (date) {
            setCorrDate(date);
        }
    }, [window.location.search]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab, subTab }
        }));
    }, [activeTab, subTab]);

    const [viewerImage, setViewerImage] = useState(null);

    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    // Handle outside click to close calendar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };
        if (showCalendar) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCalendar]);

    // Handle outside click for reports dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (reportsTypeDropdownRef.current && !reportsTypeDropdownRef.current.contains(event.target)) {
                setReportsIsTypeDropdownOpen(false);
            }
            if (reportsWeekDropdownRef.current && !reportsWeekDropdownRef.current.contains(event.target)) {
                setReportsIsWeekDropdownOpen(false);
            }
            if (reportsColsDropdownRef.current && !reportsColsDropdownRef.current.contains(event.target)) {
                setReportsIsColsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Save reports export history
    useEffect(() => {
        localStorage.setItem('attendance_my_reports_export_history', JSON.stringify(reportsExportHistory));
    }, [reportsExportHistory]);

    // Calculate weeks for reports selection
    const reportsWeeks = useMemo(() => getWeeksOfMonth(reportsSelectedMonth), [reportsSelectedMonth]);

    useEffect(() => {
        if (reportsWeeks.length > 0) {
            setReportsSelectedWeek(reportsWeeks[0].value);
        }
    }, [reportsWeeks]);

    // Fetch reports preview data
    const reportsExportColumnsKey = JSON.stringify(reportsExportColumns);

    useEffect(() => {
        if (activeTab !== 'my_attendance' || subTab !== 'reports') return;
        let cancelled = false;
        const fetchPreview = async () => {
            setReportsLoadingPreview(true);
            try {
                const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportsReportType);
                const dateToUse = (isWeekly && !reportsUseCustomRange) ? reportsSelectedWeek : reportsSelectedDate;

                const qStart = reportsUseCustomRange ? reportsCustomStartDate : "";
                const qEnd = reportsUseCustomRange ? reportsCustomEndDate : "";

                const res = await attendanceService.getMyReportPreview(
                    reportsSelectedMonth,
                    reportsReportType,
                    dateToUse,
                    qStart,
                    qEnd,
                    reportsExportColumnsKey
                );
                if (!cancelled && res.ok) {
                    setReportsPreviewData(res.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("fetchPreview failed:", error);
                    toast.error("Failed to load preview data");
                }
            } finally {
                if (!cancelled) setReportsLoadingPreview(false);
            }
        };
        fetchPreview();
        return () => { cancelled = true; };
    }, [activeTab, subTab, reportsSelectedMonth, reportsReportType, reportsSelectedDate, reportsUseCustomRange, reportsCustomStartDate, reportsCustomEndDate, reportsSelectedWeek, reportsExportColumnsKey]);

    // Poll status for generating self-service reports
    useEffect(() => {
        const generatingReports = reportsExportHistory.filter(item => item.status === 'Generating');
        if (generatingReports.length === 0) return;

        const interval = setInterval(async () => {
            let updated = false;
            const nextHistory = await Promise.all(reportsExportHistory.map(async (item) => {
                if (item.status === 'Generating' && item.reportId) {
                    try {
                        const res = await attendanceService.getMyReportStatus(item.reportId);
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
                setReportsExportHistory(nextHistory);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [reportsExportHistory]);

    const handleReportsGenerate = async () => {
        setReportsIsGenerating(true);
        try {
            const isWeekly = ['matrix_weekly', 'attendance_matrix_weekly'].includes(reportsReportType);
            const dateToUse = (isWeekly && !reportsUseCustomRange) ? reportsSelectedWeek : reportsSelectedDate;

            const qStart = reportsUseCustomRange ? reportsCustomStartDate : "";
            const qEnd = reportsUseCustomRange ? reportsCustomEndDate : "";

            const res = await attendanceService.queueMyReport(
                reportsSelectedMonth,
                reportsReportType,
                reportsFileFormat,
                dateToUse,
                qStart,
                qEnd,
                JSON.stringify(reportsExportColumns)
            );
            if (res.ok) {
                const reportId = res.reportId;
                const filename = `My_Report_${reportsReportType}_${reportsUseCustomRange ? `${reportsCustomStartDate}_to_${reportsCustomEndDate}` : (reportsSelectedMonth || dateToUse)}.${reportsFileFormat}`;
                const reportTypeLabel = reportsReportType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                const newReport = {
                    id: reportId || Date.now().toString(),
                    reportId: reportId,
                    name: filename,
                    type: reportTypeLabel,
                    date: new Date().toLocaleString(),
                    status: 'Generating',
                    size: 'Pending'
                };
                setReportsExportHistory(prev => [newReport, ...prev]);
                toast.info("Report is compiling in the background! Track it in Export History.");
                setReportsActiveTab('history');
            }
        } catch (error) {
            toast.error(error.message || "Failed to generate report");
        } finally {
            setReportsIsGenerating(false);
        }
    };

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [expandedDays, setExpandedDays] = useState(new Set());

    const toggleDayExpansion = (dayKey) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(dayKey)) {
                next.delete(dayKey);
            } else {
                next.add(dayKey);
            }
            return next;
        });
    };

    // Late Reason Context
    const [requireLateReason, setRequireLateReason] = useState(false);
    const [lateReasonMessage, setLateReasonMessage] = useState("");
    const [lateReasonText, setLateReasonText] = useState("");

    // Correction Request State
    const [correctionHistory, setCorrectionHistory] = useState([]);

    // Default corrDate to today
    const [corrDate, setCorrDate] = useState(() => {
        const d = new Date();
        const yOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - yOffset).toISOString().split('T')[0];
    });

    const [corrType, setCorrType] = useState('Missed Clock-Out'); // 'Missed Clock-Out' | 'Missed Clock-In' | 'Missed Entire Day' | 'Wrong Timestamp' | 'On-Duty' | 'Other'
    const [corrOtherType, setCorrOtherType] = useState(''); // Custom type input
    const [corrMethod, setCorrMethod] = useState('add_session'); // 'add_session' | 'reset'

    // Inputs for 'fix' and 'reset'
    const [corrIn, setCorrIn] = useState('');
    const [corrOut, setCorrOut] = useState('');

    // Inputs for sessions
    const [corrSessions, setCorrSessions] = useState([{ id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }]);
    const [drawerTab, setDrawerTab] = useState('editor'); // 'editor' | 'timeline'
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    const [corrReason, setCorrReason] = useState('');
    const [corrAttachment, setCorrAttachment] = useState(null);
    const [corrAttachmentPreview, setCorrAttachmentPreview] = useState(null);
    const [existingAttachmentUrl, setExistingAttachmentUrl] = useState(null);
    const [pendingRequestId, setPendingRequestId] = useState(null);
    const [existingRecord, setExistingRecord] = useState(null);
    const [originalSessions, setOriginalSessions] = useState([]); // Immutable snapshot of DB records at date-load time
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null); // For details sidebar
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [scrollerDates, setScrollerDates] = useState([]);

    // Inline Correction Request Editing & Review State
    const [correctionFilter, setCorrectionFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
    const [isOverrideMode, setIsOverrideMode] = useState(false); // Manual Override by Admin
    const [isEditingCorrection, setIsEditingCorrection] = useState(false);
    const [editCorrectionSessions, setEditCorrectionSessions] = useState([]);
    const [editCorrectionReason, setEditCorrectionReason] = useState('');
    const [isSavingCorrection, setIsSavingCorrection] = useState(false);
    const [showAdminRejectModal, setShowAdminRejectModal] = useState(false);
    const [adminRejectReason, setAdminRejectReason] = useState('');
    const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

    const isAdminUser = Boolean(user?.user_type === 'admin' || user?.user_type === 'superadmin' || user?.role === 'admin' || user?.is_admin);
    const isAdminOrHr = Boolean(
        user?.user_type === 'admin' ||
        user?.user_type === 'superadmin' ||
        user?.user_type === 'hr' ||
        user?.role === 'admin' ||
        user?.role === 'hr' ||
        user?.is_admin
    );

    const filteredCorrectionHistory = useMemo(() => {
        if (!Array.isArray(correctionHistory)) return [];
        if (correctionFilter === 'all') return correctionHistory;
        return correctionHistory.filter(r => (r.status || '').toLowerCase() === correctionFilter);
    }, [correctionHistory, correctionFilter]);

    const normalizeCorrectionSessions = useCallback((data, req) => {
        let parsed = data;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = []; }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed
                .map((s, idx) => ({
                    id: s.id || `sess-${idx}-${Date.now()}`,
                    time_in: s.time_in ? String(s.time_in).slice(0, 5) : (s.requested_time_in ? String(s.requested_time_in).slice(0, 5) : ''),
                    time_out: s.time_out ? String(s.time_out).slice(0, 5) : (s.requested_time_out ? String(s.requested_time_out).slice(0, 5) : ''),
                    punch_type: s.punch_type || 'regular',
                    ...(s.attachment ? { attachment: s.attachment } : {})
                }))
                .filter(s => s.time_in || s.time_out);
            if (cleaned.length > 0) return cleaned;
        }
        if (req?.requested_time_in || req?.requested_time_out) {
            const getTime = (val) => {
                if (!val) return '';
                const t = val.includes(' ') ? val.split(' ')[1] : (val.includes('T') ? val.split('T')[1] : val);
                return t.substring(0, 5);
            };
            const inT = getTime(req.requested_time_in);
            const outT = getTime(req.requested_time_out);
            if (inT || outT) {
                return [{
                    id: 'sess-0',
                    time_in: inT,
                    time_out: outT,
                    punch_type: 'regular'
                }];
            }
        }
        return [];
    }, []);

    // Shift deadline & allowed date bounds
    const correctionDeadlineDays = useMemo(() => {
        return myShift?.rules?.correction_deadline ?? 2;
    }, [myShift]);

    const minAllowedCorrectionDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - correctionDeadlineDays);
        const yOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - yOffset).toISOString().split('T')[0];
    }, [correctionDeadlineDays]);

    const maxAllowedCorrectionDate = useMemo(() => {
        const d = new Date();
        const yOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - yOffset).toISOString().split('T')[0];
    }, []);

    // Session duration calculation helper
    const calculateSessionDurationHours = useCallback((timeIn, timeOut) => {
        if (!timeIn || !timeOut) return 0;
        const [h1, m1] = String(timeIn).slice(0, 5).split(':').map(Number);
        const [h2, m2] = String(timeOut).slice(0, 5).split(':').map(Number);
        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
        let startMins = h1 * 60 + m1;
        let endMins = h2 * 60 + m2;
        if (endMins <= startMins) {
            endMins += 24 * 60; // Overnight shift
        }
        return (endMins - startMins) / 60;
    }, []);

    const totalProposedHours = useMemo(() => {
        const valid = corrSessions.filter(s => s.time_in && s.time_out);
        if (valid.length === 0) {
            if (corrIn && corrOut) return calculateSessionDurationHours(corrIn, corrOut);
            return 0;
        }
        return valid.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
    }, [corrSessions, corrIn, corrOut, calculateSessionDurationHours]);

    const handleSessionChange = (index, field, val) => {
        setCorrSessions(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: val };
            return copy;
        });
    };

    const handleAddCorrectionSession = () => {
        setCorrSessions(prev => [
            ...prev,
            { id: Date.now() + Math.random(), time_in: '', time_out: '', punch_type: 'regular' }
        ]);
    };

    const handleRemoveCorrectionSession = (index) => {
        setCorrSessions(prev => {
            if (prev.length <= 1) {
                return [{ id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }];
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleAutoFillMissingOut = () => {
        const shiftEnd = myShift?.end_time ? myShift.end_time.slice(0, 5) : '18:00';
        setCorrSessions(prev => {
            if (prev.length === 0) return [{ id: Date.now(), time_in: '09:00', time_out: shiftEnd, punch_type: 'regular' }];
            const updated = [...prev];
            updated[0] = { ...updated[0], time_out: shiftEnd };
            return updated;
        });
        toast.info(`Auto-filled Punch Out to standard shift end (${shiftEnd})`);
    };

    const handlePresetFullShift = () => {
        const shiftStart = myShift?.start_time ? myShift.start_time.slice(0, 5) : '09:00';
        const shiftEnd = myShift?.end_time ? myShift.end_time.slice(0, 5) : '18:00';
        setCorrSessions([{ id: Date.now(), time_in: shiftStart, time_out: shiftEnd, punch_type: 'regular' }]);
        toast.info(`Applied full shift preset (${shiftStart} to ${shiftEnd})`);
    };

    const handleResetCorrectionToOriginal = () => {
        if (originalSessions.length > 0) {
            setCorrSessions(originalSessions.map((s, i) => ({
                id: Date.now() + i,
                time_in: s.time_in || '',
                time_out: s.time_out || '',
                punch_type: s.punch_type || 'regular'
            })));
            toast.info("Reset to originally recorded punches");
        } else {
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }]);
            toast.info("Cleared sessions (no original punches recorded for this date)");
        }
    };

    useEffect(() => {
        const d = [];
        const today = new Date();
        // Generate 30 days around today
        for (let i = -15; i <= 15; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            d.push(date);
        }
        setScrollerDates(d);
    }, []);

    useEffect(() => {
        // Auto-scroll to selected date in the scroller
        const element = document.getElementById("selected-date-btn");
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedDate, scrollerDates]);

    // --- DATA FETCHING ---

    const [globalActiveSession, setGlobalActiveSession] = useState(false);
    const [missedPunchWarning, setMissedPunchWarning] = useState(null); // { dates: ['2026-05-01', ...] }

    // Checkpoint Marking State
    const [showCheckpointModal, setShowCheckpointModal] = useState(false);
    const [isMarkingCheckpoint, setIsMarkingCheckpoint] = useState(false);
    const [checkpointNote, setCheckpointNote] = useState('');
    const [checkpointLocation, setCheckpointLocation] = useState({
        lat: null,
        lng: null,
        accuracy: null,
        address: '',
        error: null,
        loading: false
    });

    // 1. Fetch Daily Records (for "Mark Attendance" tab)
    const fetchDailyRecords = useCallback(async (force = false) => {
        if (!force && activeTab !== 'mark_attendance') return;
        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok) setDailySessions(res.data);

            // Fetch recent records to detect missed punches and today's active session
            const recentRes = await attendanceService.getMyRecords();
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = today.toISOString().split('T')[0];

                // Create a midnight copy for day calculation
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                const deadlineDays = myShift?.rules?.correction_deadline || 2;
                const missedDates = [];
                let hasTodayActiveSession = false;

                // Fetch recent correction requests to check if any are pending/approved for missed dates
                let activeCorrections = [];
                try {
                    const corrRes = await attendanceService.getCorrectionRequests({ limit: 50, my_requests: 'true' });
                    if (corrRes && corrRes.data) {
                        activeCorrections = corrRes.data;
                    }
                } catch (corrErr) {
                    console.error("Failed to fetch correction requests in warning check", corrErr);
                }

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionDate = new Date(session.time_in);
                        const sessionDateStr = sessionDate.toISOString().split('T')[0];

                        if (sessionDateStr < todayDateStr) {
                            // PAST DATE missed checkout
                            const diffTime = todayMidnight - new Date(sessionDate).setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            // Show banner if not already escalated to ABSENT/REJECTED and within deadline
                            const isNotProcessed = !['ABSENT', 'REJECTED'].includes(session.status);

                            // Hide warning if a pending or approved correction request exists
                            const hasActiveCorrection = activeCorrections.some(c => {
                                const reqDateStr = c.request_date ? new Date(c.request_date).toISOString().split('T')[0] : '';
                                return reqDateStr === sessionDateStr && ['pending', 'approved'].includes(c.status);
                            });

                            if (isNotProcessed && diffDays <= deadlineDays && !hasActiveCorrection) {
                                missedDates.push(sessionDateStr);
                            }
                        } else if (sessionDateStr === todayDateStr) {
                            // TODAY'S active session
                            hasTodayActiveSession = true;
                        }
                    }
                }

                setGlobalActiveSession(hasTodayActiveSession);
                setMissedPunchWarning(missedDates.length > 0 ? { dates: [...new Set(missedDates)] } : null);
            } else {
                setGlobalActiveSession(false);
                setMissedPunchWarning(null);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch daily records");
        } finally {
            setLoading(false);
        }
    }, [selectedDate, activeTab, myShift]);

    // 2. Fetch Monthly Records (for "My Attendance" tab - History & Analytics)
    const fetchMonthlyRecords = useCallback(async (force = false) => {
        if (!force && activeTab !== 'my_attendance') return;

        const year = reportMonth.split('-')[0];
        const month = reportMonth.split('-')[1];
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const cacheKey = `${startDate}_${endDate}`;

        if (!force && attendanceCacheData.records[cacheKey]) {
            setMonthlySessions(attendanceCacheData.records[cacheKey].data || attendanceCacheData.records[cacheKey]);
            return;
        }

        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(startDate, endDate);
            if (res.ok) setMonthlySessions(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch monthly records");
        } finally {
            setLoading(false);
        }
    }, [reportMonth, activeTab]);

    // Fetch Filtered Analytics Records
    const fetchAnalyticsRecords = useCallback(async (force = false) => {
        if (!force && (activeTab !== 'my_attendance' || subTab !== 'analytics')) return;

        let start = '';
        let end = '';
        const today = new Date();

        if (analyticsFilterType === 'this_month') {
            const y = today.getFullYear();
            const m = today.getMonth();
            start = new Date(y, m, 1).toISOString().split('T')[0];
            end = new Date(y, m + 1, 0).toISOString().split('T')[0];
        } else if (analyticsFilterType === 'last_month') {
            const y = today.getFullYear();
            const m = today.getMonth() - 1;
            start = new Date(y, m, 1).toISOString().split('T')[0];
            end = new Date(y, m + 1, 0).toISOString().split('T')[0];
        } else if (analyticsFilterType === 'select_month') {
            if (analyticsSelectedMonth) {
                const [y, m] = analyticsSelectedMonth.split('-').map(Number);
                start = new Date(y, m - 1, 1).toISOString().split('T')[0];
                end = new Date(y, m, 0).toISOString().split('T')[0];
            }
        } else if (analyticsFilterType === 'custom') {
            start = analyticsStartDate;
            end = analyticsEndDate;
        }

        if (start && end) {
            const cacheKey = `${start}_${end}`;
            if (!force && attendanceCacheData.records[cacheKey]) {
                setAnalyticsSessions(attendanceCacheData.records[cacheKey].data || attendanceCacheData.records[cacheKey]);
                return;
            }

            setAnalyticsLoading(true);
            try {
                const res = await attendanceService.getMyRecords(start, end);
                if (res.ok) setAnalyticsSessions(res.data);
            } catch (error) {
                console.error("Failed to fetch analytics records", error);
                toast.error("Failed to fetch analytics data");
            } finally {
                setAnalyticsLoading(false);
            }
        }
    }, [activeTab, subTab, analyticsFilterType, analyticsSelectedMonth, analyticsStartDate, analyticsEndDate]);

    // 3. Fetch Correction History (my own requests only, even for admins)
    const fetchCorrectionHistory = useCallback(async () => {
        if (activeTab === 'my_attendance' && subTab === 'correction') {
            const cacheKey = JSON.stringify({ limit: 10000, my_requests: 'true' });
            if (attendanceCacheData.correctionRequests[cacheKey]) {
                const history = attendanceCacheData.correctionRequests[cacheKey].data || attendanceCacheData.correctionRequests[cacheKey] || [];
                setCorrectionHistory(history);
                // Auto-select the first item
                if (history.length > 0) {
                    const first = history[0];
                    const requestId = first.acr_id || first.request_id || first.id;
                    const cachedDetail = attendanceCacheData.correctionDetails[requestId];
                    const full = cachedDetail ? { ...first, ...(cachedDetail.data || cachedDetail) } : first;
                    const normProposed = normalizeCorrectionSessions(full.proposed_data, full);
                    const normOriginal = normalizeCorrectionSessions(full.original_data, full);
                    setSelectedRequest({
                        ...full,
                        proposed_data: normProposed,
                        original_data: normOriginal
                    });
                    setEditCorrectionSessions(normProposed);
                    setEditCorrectionReason(full.reason || '');
                } else {
                    setSelectedRequest(null);
                    setEditCorrectionSessions([]);
                    setEditCorrectionReason('');
                }
                return;
            }

            setLoading(true);
            try {
                const res = await attendanceService.getCorrectionRequests({ limit: 10000, my_requests: 'true' });
                const history = res.data || [];
                setCorrectionHistory(history);
                // Auto-select the first item: fetch its full details for the right panel
                if (history.length > 0) {
                    const first = history[0];
                    const requestId = first.acr_id || first.request_id || first.id;
                    try {
                        setIsFetchingDetails(true);
                        const detail = await attendanceService.getCorrectionDetails(requestId);
                        const full = { ...first, ...(detail.data || detail) };
                        const normProposed = normalizeCorrectionSessions(full.proposed_data, full);
                        const normOriginal = normalizeCorrectionSessions(full.original_data, full);
                        setSelectedRequest({
                            ...full,
                            proposed_data: normProposed,
                            original_data: normOriginal
                        });
                        setEditCorrectionSessions(normProposed);
                        setEditCorrectionReason(full.reason || '');
                    } catch {
                        const normProposed = normalizeCorrectionSessions(first.proposed_data, first);
                        const normOriginal = normalizeCorrectionSessions(first.original_data, first);
                        setSelectedRequest({
                            ...first,
                            proposed_data: normProposed,
                            original_data: normOriginal
                        });
                        setEditCorrectionSessions(normProposed);
                        setEditCorrectionReason(first.reason || '');
                    } finally {
                        setIsFetchingDetails(false);
                    }
                } else {
                    setSelectedRequest(null);
                    setEditCorrectionSessions([]);
                    setEditCorrectionReason('');
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch correction history");
            } finally {
                setLoading(false);
            }
        }
    }, [activeTab, subTab, normalizeCorrectionSessions]);

    // 4. Fetch Existing Record & Pending Correction for Selected Date
    const loadCorrectionDataForDate = useCallback(async (targetDate) => {
        if (!targetDate) {
            setExistingRecord(null);
            setOriginalSessions([]);
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setPendingRequestId(null);
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);
            return;
        }

        try {
            // Check if there is an active PENDING correction request for this date
            let pendingReq = null;
            try {
                const pendingRes = await attendanceService.getCorrectionRequests({ date: targetDate, my_requests: 'true', status: 'pending' });
                const pendingList = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
                if (pendingList.length > 0) {
                    pendingReq = pendingList[0];
                }
            } catch (e) {
                console.warn("Could not check pending correction requests", e);
            }

            if (pendingReq) {
                setPendingRequestId(pendingReq.id || pendingReq.acr_id);
                setCorrReason(pendingReq.reason || '');
                setExistingAttachmentUrl(pendingReq.attachment_url || null);
                setCorrAttachment(null);
                setCorrAttachmentPreview(null);
                setCorrType(pendingReq.correction_type === 'summary' ? 'Other' : 'Missed Punch');

                const proposedList = Array.isArray(pendingReq.proposed_data) ? pendingReq.proposed_data : [];
                const originalList = Array.isArray(pendingReq.original_data) ? pendingReq.original_data : [];

                setOriginalSessions(originalList);
                if (proposedList.length > 0) {
                    setCorrSessions(proposedList.map((s, i) => ({
                        id: Date.now() + i,
                        time_in: s.time_in ? String(s.time_in).slice(0, 5) : '',
                        time_out: s.time_out ? String(s.time_out).slice(0, 5) : '',
                        punch_type: s.punch_type || 'regular'
                    })));
                    setCorrIn(proposedList[0]?.time_in ? String(proposedList[0].time_in).slice(0, 5) : '');
                    setCorrOut(proposedList[0]?.time_out ? String(proposedList[0].time_out).slice(0, 5) : '');
                }
                return;
            }

            // No pending request: Fresh submission state
            setPendingRequestId(null);
            setCorrReason('');
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);

            const res = await attendanceService.getMyRecords(targetDate, targetDate);
            const rawList = Array.isArray(res)
                ? res
                : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []));

            if (rawList && rawList.length > 0) {
                setExistingRecord(rawList[0]);

                const extractHHMM = (val) => {
                    if (!val) return '';
                    if (val instanceof Date) {
                        const h = String(val.getHours()).padStart(2, '0');
                        const m = String(val.getMinutes()).padStart(2, '0');
                        return `${h}:${m}`;
                    }
                    const raw = String(val).trim();
                    if (raw.includes('T')) {
                        const timePart = raw.split('T')[1];
                        return timePart.slice(0, 5);
                    }
                    if (raw.includes(' ')) {
                        const timePart = raw.split(' ')[1];
                        return timePart.slice(0, 5);
                    }
                    return raw.slice(0, 5);
                };

                // Parse out all sessions and auto-populate the add_session array
                const loadedSessions = rawList.map((s, i) => {
                    const time_in_str = extractHHMM(s.time_in || s.time_in_ts);
                    const time_out_str = extractHHMM(s.time_out || s.time_out_ts);
                    return { id: Date.now() + i, time_in: time_in_str, time_out: time_out_str, punch_type: 'regular' };
                });

                // Save a frozen snapshot for original_data - never modified by form edits
                setOriginalSessions(loadedSessions.map(s => ({ time_in: s.time_in, time_out: s.time_out })));

                // Pre-fill form with existing sessions (user can edit and complete missing punch)
                setCorrSessions(loadedSessions);

                // Smart default for corrType
                if (loadedSessions.some(s => s.time_in && !s.time_out)) {
                    setCorrType('Missed Clock-Out');
                } else if (loadedSessions.some(s => !s.time_in && s.time_out)) {
                    setCorrType('Missed Clock-In');
                } else if (loadedSessions.length === 0) {
                    setCorrType('Missed Entire Day');
                } else {
                    setCorrType('Wrong Timestamp');
                }

                if (loadedSessions[0]) {
                    setCorrIn(loadedSessions[0].time_in || '');
                    setCorrOut(loadedSessions[0].time_out || '');
                }
            } else {
                setExistingRecord(null);
                setOriginalSessions([]);
                setCorrSessions([{ id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }]);
                setCorrType('Missed Entire Day');
                setCorrIn('');
                setCorrOut('');
            }
        } catch (error) {
            console.error("Failed to fetch existing record", error);
            setExistingRecord(null);
            setOriginalSessions([]);
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            setCorrIn('');
            setCorrOut('');
            setPendingRequestId(null);
        }
    }, []);

    useEffect(() => {
        loadCorrectionDataForDate(corrDate);
    }, [corrDate, loadCorrectionDataForDate]);

    useEffect(() => {
        fetchDailyRecords();
    }, [fetchDailyRecords]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [fetchMonthlyRecords]);

    useEffect(() => {
        fetchAnalyticsRecords();
    }, [fetchAnalyticsRecords]);

    useEffect(() => {
        fetchCorrectionHistory();
    }, [fetchCorrectionHistory]);
    // --- ACTION HANDLERS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setImgSrc(null);
        setRequireLateReason(false);
        setLateReasonMessage("");
        setLateReasonText("");
        setShowCamera(true);
    };

    const handlePunchClick = async (mode) => {
        const isSelfieRequired = mode === 'IN'
            ? (myShift?.rules?.entry_requirements?.selfie ?? false)
            : (myShift?.rules?.exit_requirements?.selfie ?? false);

        if (isSelfieRequired) {
            openCamera(mode);
        } else {
            await executeDirectPunch(mode);
        }
    };

    const handleOpenCheckpointModal = () => {
        if (!globalActiveSession) {
            toast.warning("You must Clock IN before marking a checkpoint.");
            return;
        }
        setShowCheckpointModal(true);
        setCheckpointNote('');
        setCheckpointLocation({ lat: null, lng: null, accuracy: null, address: '', error: null, loading: true });

        if (!navigator.geolocation) {
            setCheckpointLocation(prev => ({ ...prev, loading: false, error: "Geolocation is not supported by your browser." }));
            return;
        }

        const acquireLocation = (highAccuracy = true) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    let resolvedAddr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.display_name) resolvedAddr = data.display_name;
                        }
                    } catch (_) { }

                    setCheckpointLocation({
                        lat: latitude,
                        lng: longitude,
                        accuracy,
                        address: resolvedAddr,
                        error: null,
                        loading: false
                    });
                },
                (err) => {
                    if (highAccuracy && (err.code === 3 || err.code === 1)) {
                        acquireLocation(false);
                        return;
                    }
                    console.warn("Checkpoint geolocation error:", err);
                    setCheckpointLocation(prev => ({
                        ...prev,
                        loading: false,
                        error: err.message || "Failed to retrieve GPS location."
                    }));
                },
                { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 0 }
            );
        };

        acquireLocation(true);
    };

    const handleConfirmCheckpoint = async () => {
        if (!checkpointLocation.lat || !checkpointLocation.lng) {
            toast.error("Valid GPS coordinates are required to mark a checkpoint.");
            return;
        }

        setIsMarkingCheckpoint(true);
        try {
            const payload = {
                latitude: checkpointLocation.lat,
                longitude: checkpointLocation.lng,
                accuracy: checkpointLocation.accuracy,
                address: checkpointLocation.address,
                note: checkpointNote.trim() || undefined,
                is_geofence_violation: false
            };

            const res = await attendanceService.markCheckpoint(payload);
            toast.success(res.message || "Checkpoint marked successfully!");
            setShowCheckpointModal(false);
            setCheckpointNote('');
            fetchDailyRecords(true);
        } catch (err) {
            console.error("Checkpoint error:", err);
            toast.error(err.message || "Failed to record checkpoint");
        } finally {
            setIsMarkingCheckpoint(false);
        }
    };

    const executeDirectPunch = async (mode) => {
        setIsSubmitting(true);
        setCameraMode(mode);

        const isGeoRequired = mode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        const submitDirectData = async (latitude, longitude, accuracy) => {
            try {
                let payload = { latitude, longitude, accuracy };

                let res;
                if (mode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                setCameraMode(null);
                fetchDailyRecords();
            } catch (error) {
                console.error(error);
                const errorMsg = error.message || "Attendance failed";
                const errorLower = errorMsg.toLowerCase();

                if (mode === 'IN' && errorLower.includes("late") && errorLower.includes("reason")) {
                    setCameraMode(mode);
                    setImgSrc(null);
                    setRequireLateReason(true);
                    setLateReasonMessage(errorMsg);
                    setLateReasonText("");
                    setShowCamera(true);
                    toast.warning(errorMsg);
                } else {
                    setCameraMode(null);
                    toast.error(errorMsg);
                }
            } finally {
                setIsSubmitting(false);
            }
        };

        if (!isGeoRequired) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude, accuracy } = position.coords;
                        submitDirectData(latitude, longitude, accuracy);
                    },
                    (err) => {
                        console.warn("Direct punch location fetch failed, proceeding with null location", err);
                        submitDirectData(null, null, null);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                submitDirectData(null, null, null);
            }
        } else {
            if (!navigator.geolocation) {
                toast.error("Geolocation is not supported");
                setIsSubmitting(false);
                return;
            }

            const handleGeoSuccess = (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                submitDirectData(latitude, longitude, accuracy);
            };

            const handleGeoError = (error) => {
                console.warn("High accuracy geolocation failed during punch-in/out, retrying with low accuracy...", error);
                if (error.code === 3 || error.code === 1) {
                    navigator.geolocation.getCurrentPosition(
                        handleGeoSuccess,
                        (fallbackError) => {
                            console.error("Fallback geolocation also failed:", fallbackError);
                            toast.error("Location error: " + fallbackError.message);
                            setCameraMode(null);
                            setIsSubmitting(false);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                } else {
                    toast.error("Location error: " + error.message);
                    setCameraMode(null);
                    setIsSubmitting(false);
                }
            };

            navigator.geolocation.getCurrentPosition(
                handleGeoSuccess,
                handleGeoError,
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    };

    const closeCamera = () => {
        setShowCamera(false);
        setImgSrc(null);
        setCameraMode(null);
        setRequireLateReason(false);
        setLateReasonMessage("");
        setLateReasonText("");
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const dataURLtoBlob = (dataurl) => {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    const confirmAttendance = async () => {
        const isSelfieRequired = cameraMode === 'IN'
            ? (myShift?.rules?.entry_requirements?.selfie ?? false)
            : (myShift?.rules?.exit_requirements?.selfie ?? false);

        const isGeoRequired = cameraMode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        if (isSelfieRequired && !imgSrc) return;
        setIsSubmitting(true);

        const submitData = async (latitude, longitude, accuracy) => {
            try {
                let payload = { latitude, longitude, accuracy };
                if (imgSrc) {
                    const imageBlob = dataURLtoBlob(imgSrc);
                    payload.imageFile = imageBlob;
                }

                if (requireLateReason && lateReasonText.trim()) {
                    payload.late_reason = lateReasonText;
                }

                let res;
                if (cameraMode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                closeCamera();
                fetchDailyRecords();
            } catch (error) {
                console.error(error);

                // Intercept Late Reason missing error
                const errorMsg = error.message || "Attendance failed";
                const errorLower = errorMsg.toLowerCase();

                if (cameraMode === 'IN' && errorLower.includes("late") && errorLower.includes("reason")) {
                    setRequireLateReason(true);
                    setLateReasonMessage(errorMsg);
                    toast.warning(errorMsg);
                } else {
                    toast.error(errorMsg);
                }
            } finally {
                setIsSubmitting(false);
            }
        };

        if (!isGeoRequired) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude, accuracy } = position.coords;
                        submitData(latitude, longitude, accuracy);
                    },
                    (err) => {
                        console.warn("Selfie punch location fetch failed, proceeding with null location", err);
                        submitData(null, null, null);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                submitData(null, null, null);
            }
        } else {
            if (!navigator.geolocation) {
                toast.error("Geolocation is not supported");
                setIsSubmitting(false);
                return;
            }

            const handleGeoSuccess = (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                submitData(latitude, longitude, accuracy);
            };

            const handleGeoError = (error) => {
                console.warn("High accuracy geolocation failed, retrying with low accuracy...", error);
                if (error.code === 3 || error.code === 1) {
                    navigator.geolocation.getCurrentPosition(
                        handleGeoSuccess,
                        (fallbackError) => {
                            console.error("Fallback geolocation also failed:", fallbackError);
                            toast.error("Location error: " + fallbackError.message);
                            setIsSubmitting(false);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                } else {
                    toast.error("Location error: " + error.message);
                    setIsSubmitting(false);
                }
            };

            navigator.geolocation.getCurrentPosition(
                handleGeoSuccess,
                handleGeoError,
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    };

    const handleDownloadReport = async () => {
        const toastId = toast.loading("Report compilation starting...");
        try {
            const res = await attendanceService.downloadMyReport(reportMonth, fileFormat);
            if (res.ok && res.reportId) {
                toast.update(toastId, { render: "Compiling your report in the background...", type: "info", isLoading: true });
                const reportId = res.reportId;

                // Poll status
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await attendanceService.getMyReportStatus(reportId);
                        if (statusRes.ok && statusRes.data) {
                            const { status, file_url, error_message } = statusRes.data;
                            if (status === 'completed') {
                                clearInterval(pollInterval);
                                // Trigger download from S3 pre-signed URL
                                const link = document.createElement('a');
                                link.href = file_url;
                                link.setAttribute('download', `My_Attendance_${reportMonth}.${fileFormat}`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                toast.update(toastId, { render: "Report compiled and downloaded successfully!", type: "success", isLoading: false, autoClose: 3000 });
                            } else if (status === 'failed') {
                                clearInterval(pollInterval);
                                toast.update(toastId, { render: `Generation failed: ${error_message || 'Unknown error'}`, type: "error", isLoading: false, autoClose: 4000 });
                            }
                        }
                    } catch (pollErr) {
                        console.error("Error polling report status:", pollErr);
                    }
                }, 2000);

                // Safe fallback to prevent infinite polling loop in case anything hangs
                setTimeout(() => {
                    clearInterval(pollInterval);
                }, 60000); // 1 minute max timeout
            } else {
                toast.update(toastId, { render: "Failed to queue report.", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (error) {
            toast.update(toastId, { render: error.message || "Failed to download your report", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const handleSubmitCorrection = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!corrDate || !corrReason || !corrReason.trim()) {
            toast.error("Adjustment Date and Reason are required");
            return;
        }

        // ENFORCE DYNAMIC CORRECTION DEADLINE
        const deadlineDays = myShift?.rules?.correction_deadline ?? 2;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reqDate = new Date(corrDate);
        reqDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - reqDate) / (1000 * 60 * 60 * 24));

        if (diffDays > deadlineDays) {
            toast.error(`Correction requests can only be submitted within ${deadlineDays} days of the attendance date.`);
            return;
        }

        // Validation for sessions
        const validSessions = corrSessions.filter(s => s.time_in || s.time_out);
        if (validSessions.length === 0 && !corrIn && !corrOut) {
            toast.error("Please provide at least one punch time (In or Out).");
            return;
        }

        for (let i = 0; i < validSessions.length; i++) {
            const sessionA = validSessions[i];
            const isOvernightA = Boolean(sessionA.time_in && sessionA.time_out && sessionA.time_in >= sessionA.time_out);

            for (let j = i + 1; j < validSessions.length; j++) {
                const sessionB = validSessions[j];
                const isOvernightB = Boolean(sessionB.time_in && sessionB.time_out && sessionB.time_in >= sessionB.time_out);
                if (sessionA.time_in && sessionA.time_out && sessionB.time_in && sessionB.time_out) {
                    if (!isOvernightA && !isOvernightB && sessionA.time_in < sessionB.time_out && sessionA.time_out > sessionB.time_in) {
                        toast.error(`Sessions cannot overlap: ${sessionA.time_in} to ${sessionA.time_out} with ${sessionB.time_in} to ${sessionB.time_out}`);
                        return;
                    }
                }
            }
        }

        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitLoading(true);
        try {
            const original_data = originalSessions;
            const validSessions = corrSessions.filter(s => s.time_in || s.time_out);
            let proposed_data = [];

            if (validSessions.length > 0) {
                proposed_data = validSessions.map(s => {
                    const isOvernight = Boolean(s.time_in && s.time_out && s.time_in >= s.time_out);
                    return {
                        ...(s.time_in ? { time_in: s.time_in } : {}),
                        ...(s.time_out ? { time_out: s.time_out } : {}),
                        punch_type: s.punch_type || 'regular',
                        is_overnight: isOvernight
                    };
                });
            } else if (corrIn || corrOut) {
                const isOvernight = Boolean(corrIn && corrOut && corrIn >= corrOut);
                proposed_data = [{
                    ...(corrIn ? { time_in: corrIn } : {}),
                    ...(corrOut ? { time_out: corrOut } : {}),
                    punch_type: 'regular',
                    is_overnight: isOvernight
                }];
            }

            const formData = new FormData();
            formData.append('correction_type', corrType === 'summary' ? 'summary' : 'punch');
            formData.append('request_date', corrDate);

            const categoryTag = corrType === 'Other' && corrOtherType ? corrOtherType.trim() : corrType;
            const formattedReason = categoryTag ? `[${categoryTag}] ${corrReason.trim()}` : corrReason.trim();
            formData.append('reason', formattedReason);
            formData.append('original_data', JSON.stringify(original_data));
            formData.append('proposed_data', JSON.stringify(proposed_data));

            if (pendingRequestId) {
                formData.append('existing_request_id', pendingRequestId);
            }
            if (corrAttachment) {
                formData.append('attachment', corrAttachment);
            } else if (existingAttachmentUrl) {
                formData.append('attachment_url', existingAttachmentUrl);
            }

            const res = await attendanceService.submitCorrectionRequest(formData);
            if (res?.is_updated || pendingRequestId) {
                toast.success("Pending correction request updated successfully!");
            } else {
                toast.success("Correction request submitted successfully!");
            }

            setShowConfirmSubmit(false);
            setIsCorrectionDrawerOpen(false);

            // Reset Form State
            const d = new Date();
            const yOffset = d.getTimezoneOffset() * 60000;
            const todayLocal = new Date(d.getTime() - yOffset).toISOString().split('T')[0];

            setCorrDate(todayLocal);
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);
            setPendingRequestId(null);
            setCorrType('Missed Clock-Out');
            setCorrOtherType('');
            setCorrMethod('add_session');
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }]);
            setExistingRecord(null);

            fetchCorrectionHistory();
            fetchDailyRecords(true);   // Force refresh today's daily log / banners
            fetchMonthlyRecords(true); // Force refresh history tab
        } catch (error) {
            console.error(error);
            if (error.status === 409 || error.code === 'CORRECTION_ALREADY_CONFIRMED' || (error.message && error.message.includes('reviewed/confirmed'))) {
                toast.warning("This request has already been reviewed/confirmed by an administrator. Please submit a new request.");
                setPendingRequestId(null);
                loadCorrectionDataForDate(corrDate);
            } else {
                toast.error(error.message || "Failed to submit request");
            }
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRequestClick = async (req) => {
        if (isFetchingDetails) return;
        setIsEditingCorrection(false);
        setIsOverrideMode(false);
        try {
            setIsFetchingDetails(true);
            const requestId = req.acr_id || req.request_id || req.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            const fullData = { ...req, ...(res.data || res) };
            const normProposed = normalizeCorrectionSessions(fullData.proposed_data, fullData);
            const normOriginal = normalizeCorrectionSessions(fullData.original_data, fullData);
            setSelectedRequest({
                ...fullData,
                proposed_data: normProposed,
                original_data: normOriginal
            });
            setEditCorrectionSessions(normProposed);
            setEditCorrectionReason(fullData.reason || '');
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            const normProposed = normalizeCorrectionSessions(req.proposed_data, req);
            const normOriginal = normalizeCorrectionSessions(req.original_data, req);
            setSelectedRequest({
                ...req,
                proposed_data: normProposed,
                original_data: normOriginal
            });
            setEditCorrectionSessions(normProposed);
            setEditCorrectionReason(req.reason || '');
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleResetToEmployeeRequest = () => {
        if (!selectedRequest) return;
        const normProposed = normalizeCorrectionSessions(selectedRequest.proposed_data, selectedRequest);
        setEditCorrectionSessions(normProposed);
        setEditCorrectionReason(selectedRequest.reason || '');
        setIsOverrideMode(false);
        toast.info("Reset to employee's original submitted request");
    };

    const handleStartInlineEdit = () => {
        if (!selectedRequest) return;
        const proposed = Array.isArray(selectedRequest.proposed_data) && selectedRequest.proposed_data.length > 0
            ? selectedRequest.proposed_data.map((s, idx) => ({
                id: s.id || `session-${idx}-${Date.now()}`,
                time_in: s.time_in ? String(s.time_in).slice(0, 5) : '',
                time_out: s.time_out ? String(s.time_out).slice(0, 5) : '',
                punch_type: s.punch_type || 'regular'
            }))
            : [{ id: Date.now(), time_in: '09:00', time_out: '18:00', punch_type: 'regular' }];
        setEditCorrectionSessions(proposed);
        setEditCorrectionReason(selectedRequest.reason || '');
        setIsEditingCorrection(true);
    };

    const handleCancelInlineEdit = () => {
        setIsEditingCorrection(false);
        if (selectedRequest) {
            setEditCorrectionSessions(Array.isArray(selectedRequest.proposed_data) ? selectedRequest.proposed_data : []);
            setEditCorrectionReason(selectedRequest.reason || '');
        }
    };

    const handleAddInlineSession = () => {
        setEditCorrectionSessions(prev => [
            ...prev,
            { id: Date.now(), time_in: '', time_out: '', punch_type: 'regular' }
        ]);
    };

    const handleRemoveInlineSession = (idx) => {
        setEditCorrectionSessions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleEditSessionTime = (idx, field, val) => {
        setEditCorrectionSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
    };

    const handleSaveInlineEdit = async (andApprove = false) => {
        if (!selectedRequest) return;
        try {
            setIsSavingCorrection(true);
            const reqId = selectedRequest.acr_id || selectedRequest.id;
            const validSessions = editCorrectionSessions.filter(s => s.time_in || s.time_out);
            if (validSessions.length === 0) {
                toast.error("Please specify at least one session with a time");
                return;
            }

            const formData = new FormData();
            formData.append('correction_type', 'punch');
            formData.append('request_date', selectedRequest.request_date);
            formData.append('reason', editCorrectionReason.trim() || selectedRequest.reason || 'Attendance adjustment');
            formData.append('original_data', JSON.stringify(selectedRequest.original_data || []));
            formData.append('proposed_data', JSON.stringify(validSessions));
            formData.append('existing_request_id', reqId);

            await attendanceService.submitCorrectionRequest(formData);

            if (andApprove) {
                await attendanceService.updateCorrectionStatus(reqId, 'approved', 'Approved with adjustments');
                toast.success("Request updated and approved successfully!");
            } else {
                toast.success("Correction request updated successfully!");
            }

            setIsEditingCorrection(false);
            fetchCorrectionHistory();
            const updatedRes = await attendanceService.getCorrectionDetails(reqId);
            setSelectedRequest(prev => ({
                ...prev,
                ...(updatedRes.data || updatedRes),
                proposed_data: validSessions,
                reason: editCorrectionReason.trim() || prev?.reason,
                status: andApprove ? 'approved' : prev?.status
            }));
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to save changes");
        } finally {
            setIsSavingCorrection(false);
        }
    };

    const handleAdminApprove = async () => {
        if (!selectedRequest) return;
        try {
            setIsAdminActionLoading(true);
            const reqId = selectedRequest.acr_id || selectedRequest.id;

            const originalProposed = Array.isArray(selectedRequest.proposed_data) ? selectedRequest.proposed_data : [];
            const currentSessions = editCorrectionSessions.filter(s => s.time_in || s.time_out);

            const isModified = isOverrideMode && (
                JSON.stringify(originalProposed.map(s => ({ in: s.time_in ? String(s.time_in).slice(0, 5) : '', out: s.time_out ? String(s.time_out).slice(0, 5) : '' }))) !==
                JSON.stringify(currentSessions.map(s => ({ in: s.time_in ? String(s.time_in).slice(0, 5) : '', out: s.time_out ? String(s.time_out).slice(0, 5) : '' }))) ||
                (editCorrectionReason && editCorrectionReason.trim() !== (selectedRequest.reason || '').trim())
            );

            if (isModified && currentSessions.length > 0) {
                const formData = new FormData();
                formData.append('correction_type', 'punch');
                formData.append('request_date', selectedRequest.request_date);
                formData.append('reason', editCorrectionReason.trim() || selectedRequest.reason || 'Attendance adjustment');
                formData.append('original_data', JSON.stringify(selectedRequest.original_data || []));
                formData.append('proposed_data', JSON.stringify(currentSessions));
                formData.append('existing_request_id', reqId);
                await attendanceService.submitCorrectionRequest(formData);
            }

            await attendanceService.updateCorrectionStatus(reqId, 'approved', isModified ? 'Approved with manual override' : 'Approved by administrator');
            toast.success(isModified ? "Request updated with manual override and approved!" : "Request approved successfully!");

            setIsOverrideMode(false);
            fetchCorrectionHistory();
            const updatedRes = await attendanceService.getCorrectionDetails(reqId);
            const fullData = {
                ...selectedRequest,
                ...(updatedRes.data || updatedRes),
                status: 'approved',
                proposed_data: currentSessions.length > 0 ? currentSessions : selectedRequest.proposed_data
            };
            setSelectedRequest(fullData);
            setEditCorrectionSessions(fullData.proposed_data);
            fetchDailyRecords(true);
            fetchMonthlyRecords(true);
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to approve request");
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    const handleEmployeeUpdateRequest = async () => {
        if (!selectedRequest) return;
        try {
            setIsSavingCorrection(true);
            const reqId = selectedRequest.acr_id || selectedRequest.id;
            const validSessions = editCorrectionSessions.filter(s => s.time_in || s.time_out);
            if (validSessions.length === 0) {
                toast.error("Please enter at least one session with a time");
                return;
            }
            const formData = new FormData();
            formData.append('correction_type', 'punch');
            formData.append('request_date', selectedRequest.request_date);
            formData.append('reason', editCorrectionReason.trim() || selectedRequest.reason || 'Attendance adjustment');
            formData.append('original_data', JSON.stringify(selectedRequest.original_data || []));
            formData.append('proposed_data', JSON.stringify(validSessions));
            formData.append('existing_request_id', reqId);
            await attendanceService.submitCorrectionRequest(formData);
            toast.success("Correction request updated successfully!");
            fetchCorrectionHistory();
            const updatedRes = await attendanceService.getCorrectionDetails(reqId);
            setSelectedRequest(prev => ({
                ...prev,
                ...(updatedRes.data || updatedRes),
                proposed_data: validSessions,
                reason: editCorrectionReason.trim() || prev?.reason
            }));
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to update request");
        } finally {
            setIsSavingCorrection(false);
        }
    };

    const handleAdminReject = async () => {
        if (!selectedRequest) return;
        if (!adminRejectReason.trim()) {
            toast.error("Please enter a reason for rejection");
            return;
        }
        try {
            setIsAdminActionLoading(true);
            const reqId = selectedRequest.acr_id || selectedRequest.id;
            await attendanceService.updateCorrectionStatus(reqId, 'rejected', adminRejectReason.trim());
            toast.success("Request rejected");
            setShowAdminRejectModal(false);
            setAdminRejectReason('');
            setSelectedRequest(prev => prev ? { ...prev, status: 'rejected', review_comments: adminRejectReason.trim() } : null);
            fetchCorrectionHistory();
            fetchDailyRecords(true);
            fetchMonthlyRecords(true);
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to reject request");
        } finally {
            setIsAdminActionLoading(false);
        }
    };

    // --- HELPERS ---
    const formatCorrectionDate = (dateStr) => {
        if (!dateStr) return 'Unknown Date';
        try {
            const cleanStr = (dateStr.length === 10 && !dateStr.includes('T')) ? dateStr + 'T00:00:00' : dateStr;
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    const formatDateDisplay = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (timeVal, sessionRecord = null, isOut = false) => {
        if (!timeVal) return null;
        try {
            const str = String(timeVal).trim();
            const parts = str.split(/[- :T.]/);
            if (parts.length >= 5) {
                let hour = parseInt(parts[3], 10);
                const minute = String(parts[4]).padStart(2, '0');
                const ampm = hour >= 12 ? 'PM' : 'AM';
                hour = hour % 12;
                if (hour === 0) hour = 12;
                const pad = (n) => String(n).padStart(2, '0');
                return `${pad(hour)}:${minute} ${ampm}`;
            }

            const d = new Date(str);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return String(timeVal);
        }
    };

    const calculateDuration = (timeIn, timeOut) => {
        if (!timeIn || !timeOut) return null;
        const start = new Date(timeIn);
        const end = new Date(timeOut);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

        let diffMs = end - start;
        // Handle overnight shifts where end time is on the next day (or incorrectly stored as same day)
        if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) return `${minutes}m`;
        return `${hours}h ${minutes}m`;
    };

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handlePrevMonth = () => {
        if (reportMonthIdx === 0) {
            setReportYear(prev => prev - 1);
            setReportMonthIdx(11);
        } else {
            setReportMonthIdx(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (reportMonthIdx === 11) {
            setReportYear(prev => prev + 1);
            setReportMonthIdx(0);
        } else {
            setReportMonthIdx(prev => prev + 1);
        }
    };

    const handleCurrentMonth = () => {
        const now = new Date();
        setReportYear(now.getFullYear());
        setReportMonthIdx(now.getMonth());
    };

    // --- ANALYTICS DATA PREP ---
    const formatDateLabel = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    };

    const getSessionHours = (s) => {
        const val = s.total_hours || s.hours;
        if (val !== undefined && val !== null && val !== 0 && !isNaN(parseFloat(val))) {
            return parseFloat(val);
        }
        if (!s.time_in || !s.time_out) return 0;
        const start = new Date(s.time_in);
        const end = new Date(s.time_out);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        let diffMs = end - start;
        if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
        }
        if (diffMs <= 0) return 0;
        return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    };

    const chartData = useMemo(() => {
        return {
            labels: analyticsSessions.map(s => formatDateLabel(s.check_in || s.time_in)).reverse(),
            datasets: [
                {
                    label: 'Hours Worked',
                    data: analyticsSessions.map(s => getSessionHours(s)).reverse(),
                    backgroundColor: 'rgba(79, 70, 229, 0.6)',
                    borderRadius: 4,
                    sessions: [...analyticsSessions].reverse()
                }
            ]
        };
    }, [analyticsSessions]);

    const statusCounts = useMemo(() => {
        return analyticsSessions.reduce((acc, s) => {
            const label = getStatusStyle(s.status).label;
            acc[label] = (acc[label] || 0) + 1;
            return acc;
        }, {});
    }, [analyticsSessions]);

    const pieData = useMemo(() => {
        const labels = Object.keys(statusCounts);
        return {
            labels: labels,
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: labels.map(label => {
                    if (label === 'PRESENT') return '#10b981'; // emerald-500
                    if (label === 'LATE') return '#f59e0b';    // amber-500
                    if (label === 'OVERTIME') return '#8b5cf6'; // violet-500
                    if (label === 'ABSENT') return '#ef4444';   // red-500
                    if (label === 'MISSED PUNCH') return '#f43f5e'; // rose-500
                    if (label === 'HALF DAY') return '#f97316'; // orange-500
                    return '#94a3b8'; // slate-400
                }),
                borderWidth: 0
            }]
        };
    }, [statusCounts]);


    // --- COMPUTE CALENDAR EVENTS ---
    const calendarEvents = {};

    // 1. Add Holidays (Yellow)
    holidays.forEach(h => {
        calendarEvents[h.holiday_date] = { type: 'holiday' };
    });

    // 2. Add Absents (Red) - Simple Approximation
    // Mark past weekdays (not Sat/Sun) as absent if no record exists
    const daysInReportMonth = new Date(reportYear, reportMonthIdx + 1, 0).getDate();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const hasRecord = (dateStr) => {
        return monthlySessions.some(s =>
            (s.time_in && s.time_in.startsWith(dateStr)) ||
            (s.check_in && s.check_in.startsWith(dateStr))
        );
    };

    for (let d = 1; d <= daysInReportMonth; d++) {
        const date = new Date(reportYear, reportMonthIdx, d);
        const dateStr = date.toISOString().split('T')[0];

        if (dateStr > todayStr) break; // Don't mark future

        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isWeekend && !calendarEvents[dateStr] && !hasRecord(dateStr)) {
            if (dateStr !== todayStr) {
                calendarEvents[dateStr] = { type: 'absent' };
            }
        }
    }

    // --- NON-WORKING DAY CHECK ---
    const isWorkingDayToday = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Is it a holiday?
        if (holidays.some(h => h.holiday_date === todayStr)) return false;

        // 2. Is it in the shift working days?
        if (myShift?.rules?.workingDays) {
            const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
            if (!myShift.rules.workingDays.includes(todayDay)) {
                return false;
            }
        }

        return true;
    }, [myShift, holidays]);

    // --- DAY-LEVEL HISTORY AGGREGATION ---
    const groupedHistoryWeeks = useMemo(() => {
        if (!monthlySessions || monthlySessions.length === 0) return [];

        const daysMap = {};
        monthlySessions.forEach(session => {
            const timeIn = session.time_in || session.check_in;
            if (!timeIn) return;
            const d = new Date(timeIn);
            if (isNaN(d.getTime())) return;

            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateKey = `${yyyy}-${mm}-${dd}`;

            if (!daysMap[dateKey]) {
                daysMap[dateKey] = {
                    dateKey,
                    date: d,
                    sessions: []
                };
            }
            daysMap[dateKey].sessions.push(session);
        });

        const todayStr = new Date().toISOString().split('T')[0];

        const processedDays = Object.values(daysMap).map(day => {
            // Sort sessions ascending by time_in
            day.sessions.sort((a, b) => new Date(a.time_in || a.check_in) - new Date(b.time_in || b.check_in));

            const firstSession = day.sessions[0];
            const lastSession = day.sessions[day.sessions.length - 1];

            const firstIn = firstSession?.time_in || firstSession?.check_in;
            const lastOut = lastSession?.time_out || lastSession?.check_out || null;
            const hasOpenSession = !lastOut;
            const isPastDay = day.dateKey < todayStr;

            let totalDayHours = 0;
            day.sessions.forEach(s => {
                if (s.total_hours && !isNaN(Number(s.total_hours))) {
                    totalDayHours += Number(s.total_hours);
                } else if (s.time_in && s.time_out) {
                    const diff = (new Date(s.time_out) - new Date(s.time_in)) / (1000 * 60 * 60);
                    if (diff > 0) totalDayHours += diff;
                }
            });

            // Derive overall day status
            let dayStatus = 'PRESENT';
            const sessionStatuses = day.sessions.map(s => (s.status || '').toUpperCase());

            if (sessionStatuses.includes('MISSED_PUNCH') || (isPastDay && hasOpenSession)) {
                dayStatus = 'MISSED_PUNCH';
            } else if (sessionStatuses.includes('OVERTIME')) {
                dayStatus = 'OVERTIME';
            } else if (sessionStatuses.includes('LATE')) {
                dayStatus = 'LATE';
            } else if (sessionStatuses.includes('HALF_DAY')) {
                dayStatus = 'HALF_DAY';
            } else if (sessionStatuses.includes('ABSENT')) {
                dayStatus = 'ABSENT';
            } else if (sessionStatuses.includes('CLOSED') || sessionStatuses.includes('PRESENT')) {
                dayStatus = 'PRESENT';
            }

            return {
                ...day,
                firstIn,
                lastOut,
                hasOpenSession,
                isPastDay,
                totalDayHours: parseFloat(totalDayHours.toFixed(2)),
                dayStatus,
                firstSession,
                lastSession
            };
        });

        // Sort descending by date (most recent first)
        processedDays.sort((a, b) => b.date - a.date);

        // Group into week buckets
        const weeksMap = {};
        processedDays.forEach(day => {
            const firstDay = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
            const weekNumber = Math.ceil((((day.date - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
            const weekKey = `Week ${weekNumber}`;

            if (!weeksMap[weekKey]) weeksMap[weekKey] = [];
            weeksMap[weekKey].push(day);
        });

        return Object.entries(weeksMap);
    }, [monthlySessions]);

    return (
        <DashboardLayout title="Attendance" tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="pb-10 overflow-x-hidden" style={{ zoom: 0.8 }}>
                {/* Header & Command Center */}
                <AttendanceTimeLocationHeader
                    currentTime={currentTime}
                    user={user}
                    location={location}
                    isLoadingLoc={isLoadingLoc}
                    onRefreshLocation={fetchUserLocation}
                    myShift={myShift}
                    globalActiveSession={globalActiveSession}
                    onOpenCheckpointModal={handleOpenCheckpointModal}
                />

                {/* Tab Switcher - Floating Style */}
                <div className="max-w-xl mx-auto -mt-6 relative z-20 px-6">
                    <div className="bg-white/10 dark:bg-black/20 backdrop-blur-[40px] p-1.5 flex rounded-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] ring-1 ring-white/30 relative overflow-hidden group">
                        {/* Internal Liquid Highlights */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 blur-3xl rounded-full pointer-events-none" />

                        <button
                            onClick={() => setActiveTab('mark_attendance')}
                            data-tour-id="att-tab-mark"
                            className={`flex-1 py-4 text-sm font-semibold rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 cursor-pointer ${activeTab === 'mark_attendance'
                                ? 'bg-white text-indigo-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform scale-[1.01]'
                                : 'text-slate-200 dark:text-slate-400 hover:bg-white/5'
                                }`}
                        >
                            <User size={18} strokeWidth={2.5} />
                            Attendance
                        </button>
                        <button
                            onClick={() => setActiveTab('my_attendance')}
                            data-tour-id="att-tab-my-attendance"
                            className={`flex-1 py-4 text-sm font-semibold rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 cursor-pointer ${activeTab === 'my_attendance'
                                ? 'bg-white text-indigo-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform scale-[1.01]'
                                : 'text-slate-200 dark:text-slate-400 hover:bg-white/5'
                                }`}
                        >
                            <History size={18} strokeWidth={2.5} />
                            My Attendance
                        </button>
                    </div>
                </div>

                <div className="w-full mx-auto mt-5">
                    {/* 1. MARK ATTENDANCE TAB */}
                    {activeTab === 'mark_attendance' && (
                        <MarkAttendanceTab
                            globalActiveSession={globalActiveSession}
                            isSubmitting={isSubmitting}
                            isMarkingCheckpoint={isMarkingCheckpoint}
                            cameraMode={cameraMode}
                            showCamera={showCamera}
                            handlePunchClick={handlePunchClick}
                            handleOpenCheckpointModal={handleOpenCheckpointModal}
                            dailySessions={dailySessions}
                            isWorkingDayToday={isWorkingDayToday}
                            missedPunchWarning={missedPunchWarning}
                            setCorrDate={setCorrDate}
                            loadCorrectionDataForDate={loadCorrectionDataForDate}
                            setActiveTab={setActiveTab}
                            setSubTab={setSubTab}
                            setIsCorrectionDrawerOpen={setIsCorrectionDrawerOpen}
                            calendarRef={calendarRef}
                            showCalendar={showCalendar}
                            setShowCalendar={setShowCalendar}
                            selectedDate={selectedDate}
                            setSelectedDate={setSelectedDate}
                            formatDateDisplay={formatDateDisplay}
                            calendarEvents={calendarEvents}
                            scrollerDates={scrollerDates}
                            loading={loading}
                            formatTime={formatTime}
                            getStatusStyle={getStatusStyle}
                            calculateDuration={calculateDuration}
                            setViewerImage={setViewerImage}
                        />
                    )}

                    {/* 2. MY ATTENDANCE TAB */}
                    {activeTab === 'my_attendance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">


                            {/* Sub Tabs */}
                            <div className="border-b border-slate-200 dark:border-github-dark-border flex gap-6">
                                <button
                                    onClick={() => setSubTab('history')}
                                    data-tour-id="att-history-sub-tab"
                                    className={`pb-3 text-sm font-normal transition-all relative ${subTab === 'history'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <History size={16} />
                                        History
                                    </div>
                                    {subTab === 'history' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setSubTab('analytics')}
                                    data-tour-id="att-analytics-sub-tab"
                                    className={`pb-3 text-sm font-normal transition-all relative ${subTab === 'analytics'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <BarChart3 size={16} />
                                        Analytics
                                    </div>
                                    {subTab === 'analytics' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setSubTab('correction')}
                                    data-tour-id="att-correction-sub-tab"
                                    className={`pb-3 text-sm font-normal transition-all relative ${subTab === 'correction'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileClock size={16} />
                                        Correction Requests
                                    </div>
                                    {subTab === 'correction' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setSubTab('reports')}
                                    data-tour-id="att-reports-sub-tab"
                                    className={`pb-3 text-sm font-normal transition-all relative ${subTab === 'reports'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} />
                                        Reports
                                    </div>
                                    {subTab === 'reports' && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                    )}
                                </button>
                            </div>

                            {/* SUB-TAB: HISTORY (Day-Level Expandable Grouped Cards) */}
                            {subTab === 'history' && (
                                <AttendanceHistoryTab
                                    handlePrevMonth={handlePrevMonth}
                                    handleNextMonth={handleNextMonth}
                                    handleCurrentMonth={handleCurrentMonth}
                                    reportYear={reportYear}
                                    reportMonthIdx={reportMonthIdx}
                                    monthlySessions={monthlySessions}
                                    groupedHistoryWeeks={groupedHistoryWeeks}
                                    expandedDays={expandedDays}
                                    toggleDayExpansion={toggleDayExpansion}
                                    getStatusStyle={getStatusStyle}
                                    formatTime={formatTime}
                                    calculateDuration={calculateDuration}
                                    setPreviewImage={setPreviewImage}
                                    myShift={myShift}
                                    setIsCorrectionDrawerOpen={setIsCorrectionDrawerOpen}
                                    handleOpenCheckpointModal={handleOpenCheckpointModal}
                                    setSubTab={setSubTab}
                                />
                            )}

                            {/* SUB-TAB: ANALYTICS */}
                            {subTab === 'analytics' && (
                                <AttendanceAnalyticsTab
                                    analyticsFilterType={analyticsFilterType}
                                    setAnalyticsFilterType={setAnalyticsFilterType}
                                    analyticsSelectedMonth={analyticsSelectedMonth}
                                    setAnalyticsSelectedMonth={setAnalyticsSelectedMonth}
                                    analyticsStartDate={analyticsStartDate}
                                    setAnalyticsStartDate={setAnalyticsStartDate}
                                    analyticsEndDate={analyticsEndDate}
                                    setAnalyticsEndDate={setAnalyticsEndDate}
                                    analyticsLoading={analyticsLoading}
                                    analyticsSessions={analyticsSessions}
                                    getSessionHours={getSessionHours}
                                    chartData={chartData}
                                    pieData={pieData}
                                />
                            )}
                            {/* SUB-TAB: CORRECTION REQUESTS */}
                            {subTab === 'correction' && (
                                <AttendanceCorrectionTab
                                    filteredCorrectionHistory={filteredCorrectionHistory}
                                    correctionHistory={correctionHistory}
                                    correctionFilter={correctionFilter}
                                    setCorrectionFilter={setCorrectionFilter}
                                    loading={loading}
                                    selectedRequest={selectedRequest}
                                    handleRequestClick={handleRequestClick}
                                    calculateSessionDurationHours={calculateSessionDurationHours}
                                    formatCorrectionDate={formatCorrectionDate}
                                    formatDateDisplay={formatDateDisplay}
                                    isFetchingDetails={isFetchingDetails}
                                    isAdminUser={isAdminUser}
                                    isAdminOrHr={isAdminOrHr}
                                    normalizeCorrectionSessions={normalizeCorrectionSessions}
                                    setPreviewImage={setPreviewImage}
                                />
                            )}
                            {/* SUB-TAB: REPORTS (Self-Service) */}
                            {subTab === 'reports' && (
                                <AttendanceReportsTab
                                    reportsTypeDropdownRef={reportsTypeDropdownRef}
                                    reportsIsTypeDropdownOpen={reportsIsTypeDropdownOpen}
                                    setReportsIsTypeDropdownOpen={setReportsIsTypeDropdownOpen}
                                    reportsReportType={reportsReportType}
                                    setReportsReportType={setReportsReportType}
                                    reportsUseCustomRange={reportsUseCustomRange}
                                    setReportsUseCustomRange={setReportsUseCustomRange}
                                    reportsCustomStartDate={reportsCustomStartDate}
                                    setReportsCustomStartDate={setReportsCustomStartDate}
                                    reportsCustomEndDate={reportsCustomEndDate}
                                    setReportsCustomEndDate={setReportsCustomEndDate}
                                    reportsSelectedMonth={reportsSelectedMonth}
                                    setReportsSelectedMonth={setReportsSelectedMonth}
                                    reportsSelectedWeek={reportsSelectedWeek}
                                    setReportsSelectedWeek={setReportsSelectedWeek}
                                    reportsWeeks={reportsWeeks}
                                    reportsWeekDropdownRef={reportsWeekDropdownRef}
                                    reportsIsWeekDropdownOpen={reportsIsWeekDropdownOpen}
                                    setReportsIsWeekDropdownOpen={setReportsIsWeekDropdownOpen}
                                    reportsSelectedDate={reportsSelectedDate}
                                    setReportsSelectedDate={setReportsSelectedDate}
                                    reportsColsDropdownRef={reportsColsDropdownRef}
                                    reportsIsColsDropdownOpen={reportsIsColsDropdownOpen}
                                    setReportsIsColsDropdownOpen={setReportsIsColsDropdownOpen}
                                    reportsExportColumns={reportsExportColumns}
                                    setReportsExportColumns={setReportsExportColumns}
                                    reportsFileFormat={reportsFileFormat}
                                    setReportsFileFormat={setReportsFileFormat}
                                    handleReportsGenerate={handleReportsGenerate}
                                    reportsIsGenerating={reportsIsGenerating}
                                    reportsActiveTab={reportsActiveTab}
                                    setReportsActiveTab={setReportsActiveTab}
                                    reportsPreviewData={reportsPreviewData}
                                    reportsSummary={reportsSummary}
                                    reportsLoadingPreview={reportsLoadingPreview}
                                    reportsExportHistory={reportsExportHistory}
                                />
                            )}
                        </div>
                    )}

                    {/* --- CONFIRM SUBMISSION MODAL --- */}
                    {showConfirmSubmit && createPortal(
                        <div className="fixed inset-0 z-[9000] overflow-y-auto">
                            <div className="flex min-h-full items-center justify-center p-4 text-center animate-in fade-in duration-200">
                                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={() => !submitLoading && setShowConfirmSubmit(false)} />
                                <div className="relative bg-white dark:bg-github-dark-subtle w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-github-dark-border overflow-hidden animate-in zoom-in-95 duration-200 text-left">
                                    <div className="p-6 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-transparent dark:from-github-dark-bg/50">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                                <FileClock size={22} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text tracking-tight">Review & Submit Adjustment</h3>
                                                <p className="text-xs font-normal text-slate-500 dark:text-github-dark-muted mt-0.5">
                                                    {pendingRequestId ? `Updating Request #${pendingRequestId}` : 'New Request Submission'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => !submitLoading && setShowConfirmSubmit(false)}
                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-5">
                                        {/* Date & Category Banner */}
                                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                            <div>
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Date</span>
                                                <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text mt-0.5">{formatCorrectionDate(corrDate)}</p>
                                            </div>
                                            <span className="px-3 py-1 rounded-full text-xs font-normal bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                                                {corrType === 'Other' && corrOtherType ? corrOtherType : corrType}
                                            </span>
                                        </div>

                                        {/* Proposed Punches Summary */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Proposed Punches</span>
                                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                                                    Total: {totalProposedHours.toFixed(2)} hrs
                                                </span>
                                            </div>
                                            <div className="p-4 bg-slate-50/60 dark:bg-github-dark-bg/40 border border-slate-100 dark:border-github-dark-border rounded-xl space-y-2.5">
                                                {corrSessions.filter(s => s.time_in || s.time_out).length > 0 ? (
                                                    corrSessions.filter(s => s.time_in || s.time_out).map((s, idx) => {
                                                        const isOvernight = Boolean(s.time_in && s.time_out && s.time_in >= s.time_out);
                                                        const duration = calculateSessionDurationHours(s.time_in, s.time_out);
                                                        return (
                                                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-github-dark-border/50 last:border-0">
                                                                <span className="font-medium text-slate-500 dark:text-slate-400">Session #{idx + 1}</span>
                                                                <div className="flex items-center gap-2 font-mono font-normal">
                                                                    <span className="text-emerald-600 dark:text-emerald-400">{s.time_in ? formatTime(`2000-01-01T${s.time_in}:00`) : 'Missing In'}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className="text-rose-600 dark:text-rose-400">{s.time_out ? formatTime(`2000-01-01T${s.time_out}:00`) : 'Missing Out'}</span>
                                                                    {isOvernight && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-sans">Overnight</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs font-normal text-slate-600 dark:text-slate-300 font-mono">{duration.toFixed(1)} hrs</span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 font-normal">No punches entered</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reason & Attachment Info */}
                                        <div className="space-y-1.5 px-1">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Reason</span>
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-normal bg-slate-50/50 dark:bg-github-dark-bg/30 p-3 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                                "{corrReason}"
                                            </p>
                                        </div>

                                        {(corrAttachment || existingAttachmentUrl) && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-normal">
                                                <Paperclip size={14} className="shrink-0" />
                                                <span className="truncate">{corrAttachment ? corrAttachment.name : 'Existing proof document attached'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/80 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmSubmit(false)}
                                            disabled={submitLoading}
                                            className="flex-1 py-3 text-xs font-medium text-slate-600 dark:text-github-dark-muted hover:bg-slate-200/60 dark:hover:bg-github-dark-bg rounded-xl transition-all cursor-pointer"
                                        >
                                            Back to Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmSubmit}
                                            disabled={submitLoading}
                                            className="flex-1 py-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                                        >
                                            {submitLoading ? <RefreshCw className="animate-spin" size={16} /> : "Confirm & Send"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}


                    {/* --- IMAGE VIEWER MODAL --- */}
                    <AnimatePresence>
                        {viewerImage && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setViewerImage(null)}
                                className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 backdrop-blur-md p-4 md:p-10 cursor-zoom-out"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="relative max-w-5xl w-full h-full flex items-center justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="absolute -top-14 right-0 flex items-center gap-3">
                                        <button
                                            onClick={() => window.open(viewerImage, '_blank')}
                                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-xl transition-all border border-white/20 shadow-lg group"
                                            title="Open in new tab"
                                        >
                                            <Download size={18} className="group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Open Original</span>
                                        </button>
                                        <button
                                            onClick={() => setViewerImage(null)}
                                            className="p-2.5 bg-white/10 hover:bg-rose-500 text-white rounded-xl backdrop-blur-xl transition-all border border-white/20 shadow-lg"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <img
                                        src={viewerImage}
                                        alt="Verification"
                                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
                                    />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* --- CHECKPOINT MARKING MODAL --- */}
                    <CheckpointModal
                        showCheckpointModal={showCheckpointModal}
                        setShowCheckpointModal={setShowCheckpointModal}
                        isMarkingCheckpoint={isMarkingCheckpoint}
                        checkpointLocation={checkpointLocation}
                        handleOpenCheckpointModal={handleOpenCheckpointModal}
                        checkpointNote={checkpointNote}
                        setCheckpointNote={setCheckpointNote}
                        handleConfirmCheckpoint={handleConfirmCheckpoint}
                    />

                    {/* --- CAMERA MODAL --- */}
                    <AttendanceCameraModal
                        showCamera={showCamera}
                        cameraMode={cameraMode}
                        closeCamera={closeCamera}
                        myShift={myShift}
                        imgSrc={imgSrc}
                        webcamRef={webcamRef}
                        requireLateReason={requireLateReason}
                        lateReasonMessage={lateReasonMessage}
                        lateReasonText={lateReasonText}
                        setLateReasonText={setLateReasonText}
                        capture={capture}
                        retake={retake}
                        confirmAttendance={confirmAttendance}
                        isSubmitting={isSubmitting}
                    />
                    {/* --- CORRECTION DRAWER (RIGHT SIDEBAR) --- */}
                    <AnimatePresence>
                        {isCorrectionDrawerOpen && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                    onClick={() => setIsCorrectionDrawerOpen(false)}
                                    className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-xs cursor-pointer"
                                />
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                    data-tour-id="att-correction-drawer"
                                    className="fixed top-0 right-0 h-full w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-white dark:bg-github-dark-subtle z-[120] shadow-2xl border-l border-slate-200 dark:border-github-dark-border flex flex-col will-change-transform"
                                >
                                    {/* Drawer Header */}
                                    <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-transparent dark:from-github-dark-bg/60 dark:via-github-dark-subtle dark:to-transparent">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                                                <FileClock size={22} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2.5">
                                                    <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-github-dark-text tracking-tight">Attendance Correction</h3>
                                                    {pendingRequestId ? (
                                                        <span className="text-xs font-normal bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                                                            Editing #{pendingRequestId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-normal bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/40">
                                                            Adjustment
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-normal text-slate-500 dark:text-github-dark-muted mt-0.5">
                                                    Submit or adjust punches for manager review
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsCorrectionDrawerOpen(false)}
                                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90 cursor-pointer"
                                            title="Close drawer"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* Drawer Content */}
                                    <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6 custom-scrollbar">
                                        <form id="correction-form" onSubmit={handleSubmitCorrection} className="space-y-6">
                                            {/* Pending Edit Notice Banner */}
                                            {pendingRequestId && (
                                                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between shadow-2xs">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                            <Edit3 size={15} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-indigo-950 dark:text-indigo-200">
                                                                Updating Existing Pending Request #{pendingRequestId}
                                                            </p>
                                                            <p className="text-xs font-normal text-indigo-700/80 dark:text-indigo-300/80">
                                                                Your changes will update this pending request in-place without creating a duplicate.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium bg-indigo-200/60 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2.5 py-1 rounded-lg">
                                                        In-Place
                                                    </span>
                                                </div>
                                            )}

                                            {/* Shift Policy & Deadline Alert */}
                                            <div className="p-3.5 bg-slate-50 dark:bg-github-dark-bg/50 border border-slate-200/80 dark:border-github-dark-border rounded-xl flex items-center gap-3">
                                                <Info size={16} className="text-indigo-500 shrink-0" />
                                                <div className="text-xs font-normal text-slate-600 dark:text-slate-300">
                                                    <span className="font-medium text-slate-800 dark:text-slate-100">Shift Policy: </span>
                                                    Corrections are accepted within <span className="font-medium text-indigo-600 dark:text-indigo-400">{correctionDeadlineDays} days</span> of the attendance date. Eligible dates: <span className="font-normal text-slate-700 dark:text-slate-200">{minAllowedCorrectionDate}</span> to <span className="font-normal text-slate-700 dark:text-slate-200">Today ({maxAllowedCorrectionDate})</span>.
                                                </div>
                                            </div>

                                            {/* Date & Category Grid - Perfectly Aligned */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                                                <div data-tour-id="att-correction-date" className="space-y-1.5">
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        Adjustment Date
                                                    </label>
                                                    <div className="relative z-[130]">
                                                        <DatePicker
                                                            value={corrDate}
                                                            onChange={(val) => {
                                                                setCorrDate(val);
                                                                loadCorrectionDataForDate(val);
                                                            }}
                                                            minDate={minAllowedCorrectionDate}
                                                            maxDate={maxAllowedCorrectionDate}
                                                        />
                                                    </div>
                                                </div>

                                                <div data-tour-id="att-correction-type">
                                                    <ThemedSelect
                                                        label="Correction Category"
                                                        value={corrType}
                                                        onChange={(val) => setCorrType(val)}
                                                        options={[
                                                            { label: 'Missed Clock-Out', value: 'Missed Clock-Out' },
                                                            { label: 'Missed Clock-In', value: 'Missed Clock-In' },
                                                            { label: 'Missed Entire Day', value: 'Missed Entire Day' },
                                                            { label: 'Wrong Timestamp / Glitch', value: 'Wrong Timestamp' },
                                                            { label: 'On-Duty / Field Visit', value: 'On-Duty' },
                                                            { label: 'Other Reason', value: 'Other' }
                                                        ]}
                                                    />
                                                </div>
                                            </div>

                                            {corrType === 'Other' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="space-y-1.5"
                                                >
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        Specify Other Category
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., Biometric sensor failure, Travel exception..."
                                                        value={corrOtherType}
                                                        onChange={(e) => setCorrOtherType(e.target.value)}
                                                        className="w-full h-11 px-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                                        required
                                                    />
                                                </motion.div>
                                            )}

                                            {/* Original Attendance Context Card */}
                                            <div className="p-4 bg-slate-50/60 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <History size={15} className="text-slate-400" />
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                                            Originally Logged on {formatCorrectionDate(corrDate)}
                                                        </span>
                                                    </div>
                                                    {originalSessions.length === 0 ? (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                                                            No Punches Recorded
                                                        </span>
                                                    ) : originalSessions.some(s => s.time_in && !s.time_out) ? (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                                            Punch Out Missing
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                                            Punches Recorded
                                                        </span>
                                                    )}
                                                </div>

                                                {originalSessions.length > 0 ? (
                                                    <div className="space-y-2 pt-0.5">
                                                        {originalSessions.map((s, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-github-dark-subtle/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-github-dark-border/60">
                                                                <span className="font-medium text-slate-500 dark:text-slate-400">Session #{idx + 1}</span>
                                                                <div className="flex items-center gap-2 font-mono font-normal">
                                                                    <span className={s.time_in ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                                                        {s.time_in ? formatTime(`2000-01-01T${s.time_in}:00`) : 'Missing In'}
                                                                    </span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className={s.time_out ? "text-rose-600 dark:text-rose-400" : "text-amber-500 dark:text-amber-400 italic"}>
                                                                        {s.time_out ? formatTime(`2000-01-01T${s.time_out}:00`) : 'Not Clocked Out'}
                                                                    </span>
                                                                </div>
                                                                {s.time_in && s.time_out ? (
                                                                    <span className="text-xs font-normal text-slate-500">
                                                                        {calculateSessionDurationHours(s.time_in, s.time_out).toFixed(1)} hrs
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs font-normal text-amber-500">
                                                                        Incomplete
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 dark:text-slate-400 font-normal py-0.5">
                                                        No mobile or biometric punches found for this date. Enter your requested session times below.
                                                    </p>
                                                )}

                                                {/* Auto-fill actions */}
                                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-github-dark-border/40">
                                                    {originalSessions.some(s => s.time_in && !s.time_out) && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAutoFillMissingOut}
                                                            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/40 text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Sparkles size={13} /> Auto-fill Missing Out ({myShift?.end_time ? myShift.end_time.slice(0, 5) : '18:00'})
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={handlePresetFullShift}
                                                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-github-dark-bg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 border border-slate-200 dark:border-github-dark-border text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Clock size={13} /> Full Shift Preset ({myShift?.start_time ? myShift.start_time.slice(0, 5) : '09:00'} to {myShift?.end_time ? myShift.end_time.slice(0, 5) : '18:00'})
                                                    </button>
                                                    {originalSessions.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={handleResetCorrectionToOriginal}
                                                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-github-dark-bg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-github-dark-border text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <RotateCcw size={13} /> Reset to Logged
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Proposed Sessions Section with Tab Selector */}
                                            <div className="space-y-3.5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            Proposed Work Sessions
                                                        </label>
                                                        <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                                            Total Proposed: <span className="font-medium text-emerald-600 dark:text-emerald-400 font-mono">{totalProposedHours.toFixed(2)} hrs</span>
                                                        </p>
                                                    </div>

                                                    {/* View Mode Switcher */}
                                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-github-dark-bg rounded-xl border border-slate-200 dark:border-github-dark-border">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDrawerTab('editor')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer ${drawerTab === 'editor'
                                                                    ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 font-medium shadow-xs'
                                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                                                }`}
                                                        >
                                                            <Edit3 size={13} /> Form Editor
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDrawerTab('timeline')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer ${drawerTab === 'timeline'
                                                                    ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 font-medium shadow-xs'
                                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                                                }`}
                                                        >
                                                            <Clock size={13} /> Visual Timeline
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* TAB 1: DIRECT PUNCH FORM EDITOR */}
                                                {drawerTab === 'editor' && (
                                                    <div className="space-y-3">
                                                        {corrSessions.map((session, idx) => {
                                                            const duration = calculateSessionDurationHours(session.time_in, session.time_out);
                                                            const isOvernight = Boolean(session.time_in && session.time_out && session.time_in >= session.time_out);
                                                            return (
                                                                <div
                                                                    key={session.id || idx}
                                                                    className="p-4 bg-slate-50/60 dark:bg-github-dark-bg/30 border border-slate-200 dark:border-github-dark-border rounded-2xl space-y-3 relative group"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                                                                Session #{idx + 1}
                                                                            </span>
                                                                            {duration > 0 && (
                                                                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-mono">
                                                                                    {duration.toFixed(2)} hrs
                                                                                </span>
                                                                            )}
                                                                            {isOvernight && (
                                                                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                                                                                    Overnight (+1 Day)
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {corrSessions.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveCorrectionSession(idx)}
                                                                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                                                                                title="Remove session"
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                        <div className="space-y-1.5">
                                                                            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                                Punch In Time
                                                                            </span>
                                                                            <TimePicker
                                                                                value={session.time_in || ''}
                                                                                onChange={(val) => handleSessionChange(idx, 'time_in', val)}
                                                                                icon={<Clock size={15} className="text-emerald-500" />}
                                                                                placeholder="Set clock in time"
                                                                                className="w-full"
                                                                            />
                                                                        </div>

                                                                        <div className="space-y-1.5">
                                                                            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                                Punch Out Time
                                                                            </span>
                                                                            <TimePicker
                                                                                value={session.time_out || ''}
                                                                                onChange={(val) => handleSessionChange(idx, 'time_out', val)}
                                                                                icon={<Clock size={15} className="text-rose-500" />}
                                                                                placeholder="Set clock out time"
                                                                                className="w-full"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Add Session Button */}
                                                        <button
                                                            type="button"
                                                            onClick={handleAddCorrectionSession}
                                                            className="w-full h-11 border border-dashed border-slate-300 dark:border-github-dark-border hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-xs font-normal text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Plus size={15} /> Add Another Session (Split Shift / Break)
                                                        </button>
                                                    </div>
                                                )}

                                                {/* TAB 2: INTERACTIVE VISUAL TIMELINE */}
                                                {drawerTab === 'timeline' && (
                                                    <VisualCorrectionTimeline
                                                        requestData={{
                                                            original_data: originalSessions,
                                                            proposed_data: corrSessions.filter(s => s.time_in || s.time_out),
                                                            correction_type: corrType,
                                                            status: 'draft'
                                                        }}
                                                        editable={true}
                                                        onSessionsChange={(updated) => {
                                                            setCorrSessions(updated.map((s, idx) => ({
                                                                id: `session-${idx}-${s.time_in || s.time_out}`,
                                                                time_in: s.time_in || '',
                                                                time_out: s.time_out || '',
                                                                punch_type: s.punch_type || 'regular'
                                                            })));
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {/* Reason Section & Quick Reason Chips */}
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        Reason for Adjustment
                                                    </label>
                                                    <span className="text-xs font-normal text-slate-400">Required</span>
                                                </div>

                                                {/* Quick reason presets */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        "Forgot to punch out before leaving",
                                                        "Forgot to punch in upon arrival",
                                                        "App GPS / connection timeout",
                                                        "Webcam capture error",
                                                        "On-duty offsite client meeting"
                                                    ].map((r, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setCorrReason(r)}
                                                            className="text-xs font-normal px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-github-dark-bg dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-github-dark-border transition-colors cursor-pointer"
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>

                                                <textarea
                                                    data-tour-id="att-correction-reason"
                                                    value={corrReason}
                                                    onChange={(e) => setCorrReason(e.target.value)}
                                                    placeholder="Please provide details for the correction request..."
                                                    className="w-full px-4 py-3 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-normal text-sm h-24 resize-none shadow-2xs placeholder:text-slate-400"
                                                    required
                                                />
                                            </div>

                                            {/* Supporting Attachment Section */}
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        Supporting Proof / Attachment
                                                    </label>
                                                    <span className="text-xs font-normal text-slate-400">Optional</span>
                                                </div>

                                                {corrAttachment ? (
                                                    <div className="flex items-center justify-between p-3.5 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-xl">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {corrAttachmentPreview ? (
                                                                <div
                                                                    onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                    className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                                    title="Click to zoom preview"
                                                                >
                                                                    <img src={corrAttachmentPreview} alt="Preview" className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                                    <FileText size={20} />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                                                    {corrAttachment.name}
                                                                </p>
                                                                <p className="text-xs font-normal text-slate-400 font-mono">
                                                                    {(corrAttachment.size / 1024).toFixed(1)} KB • Click to preview
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {corrAttachmentPreview && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-github-dark-bg rounded-lg transition-colors cursor-pointer"
                                                                    title="Zoom preview"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCorrAttachment(null);
                                                                    setCorrAttachmentPreview(null);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                                                                title="Remove attachment"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : existingAttachmentUrl ? (
                                                    <div className="flex items-center justify-between p-3.5 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-xl">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Paperclip size={16} className="text-indigo-500 shrink-0" />
                                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                Existing document attached to pending request
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewImage(existingAttachmentUrl)}
                                                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Eye size={13} /> View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExistingAttachmentUrl(null)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                                                                title="Remove attachment"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                                                        onDragLeave={() => setIsDraggingFile(false)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsDraggingFile(false);
                                                            const file = e.dataTransfer.files?.[0];
                                                            if (file) {
                                                                setCorrAttachment(file);
                                                                if (file.type.startsWith('image/')) {
                                                                    setCorrAttachmentPreview(URL.createObjectURL(file));
                                                                } else {
                                                                    setCorrAttachmentPreview(null);
                                                                }
                                                            }
                                                        }}
                                                        className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${isDraggingFile
                                                                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/40'
                                                                : 'border-slate-200 dark:border-github-dark-border hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-github-dark-bg/30 hover:bg-indigo-50/10'
                                                            }`}
                                                    >
                                                        <label className="w-full flex flex-col items-center justify-center cursor-pointer">
                                                            <UploadCloud size={24} className="text-slate-400 group-hover:text-indigo-500 transition-colors mb-1.5" />
                                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 text-center">
                                                                Drag & drop receipt, doctor slip, or proof file here
                                                            </span>
                                                            <span className="text-[11px] font-normal text-slate-400 dark:text-slate-400 mt-0.5">
                                                                Images (JPG, PNG), PDF, Documents (up to 5MB)
                                                            </span>
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*,.pdf,.doc,.docx"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        setCorrAttachment(file);
                                                                        if (file.type.startsWith('image/')) {
                                                                            setCorrAttachmentPreview(URL.createObjectURL(file));
                                                                        } else {
                                                                            setCorrAttachmentPreview(null);
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </form>
                                    </div>

                                    {/* Drawer Footer */}
                                    <div className="px-6 py-5 sm:px-8 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/70 dark:bg-github-dark-bg/80 space-y-3">
                                        <div className="flex items-center justify-between text-xs px-1">
                                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                                                Adjusted Work Time:
                                            </span>
                                            <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 text-sm">
                                                {totalProposedHours.toFixed(2)} hrs ({corrSessions.filter(s => s.time_in || s.time_out).length} session{corrSessions.filter(s => s.time_in || s.time_out).length !== 1 ? 's' : ''})
                                            </span>
                                        </div>
                                        <button
                                            type="submit"
                                            form="correction-form"
                                            data-tour-id="att-correction-submit-btn"
                                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <FileClock size={18} />
                                            {pendingRequestId ? `Review & Update Request (#${pendingRequestId})` : 'Review & Submit Adjustment'}
                                        </button>
                                        <p className="text-xs text-center text-slate-400 dark:text-slate-500 font-normal">
                                            {pendingRequestId ? 'Updates will immediately reflect in manager review queue' : 'Requires Manager / HR Approval'}
                                        </p>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* UNIVERSAL DOCUMENT & SELFIE PREVIEW LIGHTBOX MODAL (Image, Word, PowerPoint, PDF, Excel, etc.) */}
                    {previewImage && (
                        <CorrectionDocumentModal
                            previewUrl={previewImage}
                            onClose={() => setPreviewImage(null)}
                        />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Attendance;
