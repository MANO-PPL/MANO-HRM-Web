import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
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
    Search
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
import { getStatusStyle, ATTENDANCE_STATUS } from '../../utils/attendanceStatus';

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

const ThemedSelect = ({ label, value, options, onChange }) => {
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
        <div className="space-y-3" ref={containerRef}>
            {label && <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-between text-slate-700 dark:text-white font-bold transition-all hover:bg-white dark:hover:bg-white/10 active:scale-[0.99] shadow-sm"
                >
                    <span>{selectedOption.label}</span>
                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                        <ChevronRight size={18} className="text-slate-400 rotate-90" />
                    </div>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 z-[150] bg-white/90 dark:bg-github-dark-subtle/90 border border-slate-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                        >
                            <div className="p-2 max-h-60 overflow-y-auto no-scrollbar">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all mb-1 last:mb-0 ${value === opt.value ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
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

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        const fetchLocation = async () => {
            if (!navigator.geolocation) {
                setLocation(prev => ({ ...prev, error: "Geolocation not supported", address: "Location Access Denied" }));
                return;
            }

            setIsLoadingLoc(true);

            const onSuccess = async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    const addr = data.address;
                    const simplifiedAddress = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village || data.display_name?.split(',')[0];
                    
                    setLocation({
                        lat: latitude,
                        lng: longitude,
                        address: simplifiedAddress || 'Unknown Location',
                        error: null
                    });
                } catch (err) {
                    setLocation({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, error: null });
                } finally {
                    setIsLoadingLoc(false);
                }
            };

            const onError = (err) => {
                console.warn("fetchLocation (highAccuracy=true) failed, trying fallback with low accuracy...", err);
                if (err.code === 3 || err.code === 1) {
                    navigator.geolocation.getCurrentPosition(
                        onSuccess,
                        (fallbackErr) => {
                            setLocation(prev => ({ ...prev, error: fallbackErr.message, address: 'Location Access Denied' }));
                            setIsLoadingLoc(false);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                } else {
                    setLocation(prev => ({ ...prev, error: err.message, address: 'Location Access Denied' }));
                    setIsLoadingLoc(false);
                }
            };

            navigator.geolocation.getCurrentPosition(
                onSuccess,
                onError,
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
            );
        };

        fetchLocation();
        
        let watchId;
        const startWatch = (highAccuracy = true) => {
            if (!navigator.geolocation) return;
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    // Only update address if moved significantly (approx 100m)
                    setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));
                },
                (err) => {
                    console.warn(`watchPosition (highAccuracy=${highAccuracy}) failed in Attendance.jsx:`, err);
                    if (highAccuracy && (err.code === 3 || err.code === 1)) {
                        if (watchId) navigator.geolocation.clearWatch(watchId);
                        startWatch(false);
                    }
                },
                { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 30000 }
            );
        };

        startWatch(true);

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

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

    // ─── Tour Steps with Tab Navigation Hooks ─────────────────────────────
    const tourSteps = React.useMemo(() => [
        {
            targetId: 'att-tab-mark',
            title: 'Mark Attendance Tab',
            description: 'This tab is your clock-in/out screen. Use it every day to record your work session — it captures your GPS location and a webcam selfie.',
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

    const [corrType, setCorrType] = useState('Correction'); // 'Correction' | 'Missed Punch' | 'Overtime' | 'Other'
    const [corrOtherType, setCorrOtherType] = useState(''); // Custom type input
    const [corrMethod, setCorrMethod] = useState('add_session'); // 'add_session' | 'reset'

    // Inputs for 'fix' and 'reset'
    const [corrIn, setCorrIn] = useState('');
    const [corrOut, setCorrOut] = useState('');

    // Inputs for 'add_session'
    const [corrSessions, setCorrSessions] = useState([{ id: Date.now(), time_in: '', time_out: '' }]);

    const [corrReason, setCorrReason] = useState('');
    const [existingRecord, setExistingRecord] = useState(null);
    const [originalSessions, setOriginalSessions] = useState([]); // Immutable snapshot of DB records at date-load time
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null); // For details sidebar
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [scrollerDates, setScrollerDates] = useState([]);

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
                    const corrRes = await attendanceService.getCorrectionRequests({ limit: 50 });
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
                    if (cachedDetail) {
                        setSelectedRequest({ ...first, ...(cachedDetail.data || cachedDetail) });
                    } else {
                        setSelectedRequest(first);
                    }
                } else {
                    setSelectedRequest(null);
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
                        setSelectedRequest({ ...first, ...(detail.data || detail) });
                    } catch {
                        setSelectedRequest(first);
                    } finally {
                        setIsFetchingDetails(false);
                    }
                } else {
                    setSelectedRequest(null);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch correction history");
            } finally {
                setLoading(false);
            }
        }
    }, [activeTab, subTab]);


    // 4. Fetch Existing Record for Correction Date
    useEffect(() => {
        if (!corrDate) {
            setExistingRecord(null);
            return;
        }

        const fetchRecord = async () => {
            try {
                const res = await attendanceService.getMyRecords(corrDate, corrDate);
                if (res?.data && res.data.length > 0) {
                    setExistingRecord(res.data[0]);

                    // Parse out all sessions and auto-populate the add_session array
                    const userSessions = res.data;
                    const loadedSessions = userSessions.map((s, i) => {
                        let time_in_str = '';
                        let time_out_str = '';
                        if (s.time_in) {
                            time_in_str = new Date(s.time_in).toTimeString().slice(0, 5);
                        }
                        if (s.time_out) {
                            time_out_str = new Date(s.time_out).toTimeString().slice(0, 5);
                        }
                        return { id: Date.now() + i, time_in: time_in_str, time_out: time_out_str, isExisting: true };
                    });

                    // Save a frozen snapshot for original_data — never modified by form edits
                    setOriginalSessions(loadedSessions.map(s => ({ time_in: s.time_in, time_out: s.time_out })));

                    // Pre-fill form with existing sessions (user will edit these)
                    setCorrSessions(loadedSessions);

                } else {
                    setExistingRecord(null);
                    setOriginalSessions([]);
                    setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
                }
            } catch (error) {
                console.error("Failed to fetch existing record", error);
                setExistingRecord(null);
                setOriginalSessions([]);
                setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            }
        };

        fetchRecord();
    }, [corrDate]);

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
        e.preventDefault();
        if (!corrDate || !corrReason) {
            toast.error("Date and Reason are required");
            return;
        }

        // ENFORCE DYNAMIC CORRECTION DEADLINE
        const deadlineDays = myShift?.rules?.correction_deadline || 2;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reqDate = new Date(corrDate);
        reqDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - reqDate) / (1000 * 60 * 60 * 24));

        if (diffDays > deadlineDays) {
            toast.error(`Correction requests can only be submitted within ${deadlineDays} days of the attendance date.`);
            return;
        }

        // Validation for sessions if manual correction
        if (corrMethod === 'add_session') {
            const validSessions = corrSessions.filter(s => s.time_in && s.time_out);
            if (validSessions.length === 0) {
                toast.error("Please add at least one valid session (Time In & Time Out)");
                return;
            }

            for (let i = 0; i < validSessions.length; i++) {
                const sessionA = validSessions[i];
                if (sessionA.time_in >= sessionA.time_out) {
                    toast.error(`Invalid range: In (${sessionA.time_in}) must be before Out (${sessionA.time_out})`);
                    return;
                }
                for (let j = i + 1; j < validSessions.length; j++) {
                    const sessionB = validSessions[j];
                    if (sessionA.time_in < sessionB.time_out && sessionA.time_out > sessionB.time_in) {
                        toast.error(`Sessions cannot overlap: ${sessionA.time_in}-${sessionA.time_out} with ${sessionB.time_in}-${sessionB.time_out}`);
                        return;
                    }
                }
            }
        } else if (corrMethod === 'reset') {
            if (!corrIn || !corrOut) {
                toast.error("New Time In and Time Out are required for Reset.");
                return;
            }
            if (corrIn >= corrOut) {
                toast.error("Time In must be before Time Out.");
                return;
            }
        }

        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitLoading(true);
        try {
            const original_data = originalSessions;
            let proposed_data = [];

            if (corrMethod === 'add_session') {
                const validSessions = corrSessions.filter(s => s.time_in && s.time_out);
                proposed_data = validSessions.map(s => ({ time_in: s.time_in, time_out: s.time_out }));
            } else if (corrMethod === 'reset') {
                proposed_data = [{ time_in: corrIn, time_out: corrOut }];
            }

            const payload = {
                correction_type: corrType === 'Other' ? corrOtherType : corrType,
                request_date: corrDate,
                reason: corrReason,
                original_data,
                proposed_data
            };

            await attendanceService.submitCorrectionRequest(payload);
            toast.success("Correction request submitted successfully!");

            setShowConfirmSubmit(false);
            setIsCorrectionDrawerOpen(false);

            // Reset Form after delay or on success popup close
            // (We'll do it here)
            const d = new Date();
            const yOffset = d.getTimezoneOffset() * 60000;
            const todayLocal = new Date(d.getTime() - yOffset).toISOString().split('T')[0];

            setCorrDate(todayLocal);
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setCorrType('Correction');
            setCorrOtherType('');
            setCorrMethod('add_session');
            setCorrSessions([{ id: Date.now(), time_in: '', time_out: '' }]);
            setExistingRecord(null);

            fetchCorrectionHistory();
            fetchDailyRecords(true);   // Force refresh today's daily log / banners
            fetchMonthlyRecords(true); // Force refresh history tab
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to submit request");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRequestClick = async (req) => {
        if (isFetchingDetails) return;
        try {
            setIsFetchingDetails(true);
            const requestId = req.acr_id || req.request_id || req.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            setSelectedRequest({ ...req, ...(res.data || res) });
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            setSelectedRequest(req);
        } finally {
            setIsFetchingDetails(false);
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

    const formatTime = (isoString, sessionRecord = null, isOut = false) => {
        if (!isoString) return null;
        
        let tz = null;
        if (sessionRecord?.metadata) {
            try {
                const meta = typeof sessionRecord.metadata === 'string' ? JSON.parse(sessionRecord.metadata) : sessionRecord.metadata;
                tz = isOut ? meta?.time_out?.timezone : meta?.time_in?.timezone;
            } catch (e) {}
        }
        
        if (tz === 'N/A' || tz === 'Simulated Timezone' || !tz) {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }

        try {
            const timeStr = new Date(isoString).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: tz
            });
            
            const abbrFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'short'
            });
            const parts = abbrFormatter.formatToParts(new Date(isoString));
            const tzPart = parts.find(p => p.type === 'timeZoneName');
            const abbr = tzPart ? tzPart.value : '';
            
            return abbr ? `${timeStr} (${abbr})` : timeStr;
        } catch (e) {
            return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
                    if (label === 'MISSED PUNCH') return '#d946ef'; // fuchsia-500
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

    return (
        <DashboardLayout title="Attendance" tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="pb-10 overflow-x-hidden" style={{ zoom: 0.8 }}>
                {/* Premium Header / Greeting */}
                <div className="pt-6 pb-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-900/40 dark:via-indigo-950/40 dark:to-black rounded-2xl shadow-xl relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-[30rem] h-[30rem] bg-sky-500/10 blur-3xl rounded-full"
                    />

                    <div className="relative z-10 w-full px-6 mx-auto">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.user_name?.split(' ')[0] || 'User'}!
                                </h1>
                                <p className="text-indigo-100/70 text-lg font-medium mt-2">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Current Time Widget */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-xl flex items-center justify-center text-white shadow-inner">
                                    <Clock size={40} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <span className="block text-xs font-black text-indigo-200 tracking-[0.2em] mb-1 opacity-80">Current Time</span>
                                    <span className="text-3xl font-black text-white font-mono tracking-tighter">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="w-full md:w-auto flex flex-col md:items-end gap-3">
                                <span className="block text-xs font-black text-indigo-200 tracking-[0.2em] opacity-80">Your Location</span>
                                <div className="flex items-center gap-3 text-white/90 font-bold text-sm bg-white/10 px-6 py-4 rounded-2xl border border-white/10 shadow-lg backdrop-blur-xl">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center">
                                        <MapPin size={18} className="text-indigo-300" />
                                    </div>
                                    <span className="truncate max-w-[200px] md:max-w-[400px]" title={location.address}>
                                        {isLoadingLoc ? 'Locating...' : location.address}
                                    </span>
                                    <button 
                                        onClick={() => window.location.reload()} 
                                        className="ml-2 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                    >
                                        <RefreshCw size={14} className={isLoadingLoc ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher - Floating Style */}
                <div className="max-w-xl mx-auto -mt-8 relative z-20 px-6">
                    <div className="bg-white/10 dark:bg-black/20 backdrop-blur-[40px] p-1.2 flex rounded-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] ring-1 ring-white/30 relative overflow-hidden group">
                        {/* Internal Liquid Highlights */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 blur-3xl rounded-full pointer-events-none" />
                        
                        <button
                            onClick={() => setActiveTab('mark_attendance')}
                            data-tour-id="att-tab-mark"
                            className={`flex-1 py-4 text-sm font-normal rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 ${
                                activeTab === 'mark_attendance'
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
                            className={`flex-1 py-4 text-sm font-normal rounded-xl transition-all duration-500 flex items-center justify-center gap-3 z-10 ${
                                activeTab === 'my_attendance'
                                    ? 'bg-white text-indigo-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform scale-[1.01]'
                                    : 'text-slate-200 dark:text-slate-400 hover:bg-white/5'
                            }`}
                        >
                            <History size={18} strokeWidth={2.5} />
                            My Attendance
                        </button>
                    </div>
                </div>

                <div className="w-full mx-auto mt-6">
                    {/* 1. MARK ATTENDANCE TAB */}
                    {activeTab === 'mark_attendance' && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Action Buttons & Correction Toggle */}
                        <div className="flex flex-col gap-6">
                            {/* Session Logic Calculation */}
                            {(() => {
                                const hasActiveSession = globalActiveSession;
                                return (
                                    <div data-tour-id="att-session-actions" className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Time In Card */}
                                        <button
                                            onClick={() => handlePunchClick('IN')}
                                            disabled={hasActiveSession || isSubmitting}
                                            data-tour-id="att-checkin-btn"
                                            className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 ${
                                                hasActiveSession
                                                    ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                                                    : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-emerald-500/30 active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                                                    hasActiveSession 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:rotate-[15deg] group-hover:scale-110 shadow-lg shadow-emerald-500/10'
                                                }`}>
                                                    <ArrowRight size={24} strokeWidth={2.5} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className={`text-xl font-black tracking-tight ${hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                                        {isSubmitting && cameraMode === 'IN' && !showCamera ? 'Processing...' : 'Time In'}
                                                    </h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                                        {hasActiveSession ? 'Session Active' : 'Start shift for today'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-500">
                                                <ChevronRight size={20} className={hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                            </div>
                                        </button>

                                        {/* Time Out Card */}
                                        <button
                                            onClick={() => handlePunchClick('OUT')}
                                            disabled={!hasActiveSession || isSubmitting}
                                            className={`group relative p-5 rounded-xl flex items-center justify-between transition-all duration-500 overflow-hidden border-2 ${
                                                !hasActiveSession
                                                    ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-white/5 opacity-40 grayscale-[0.5]'
                                                    : 'bg-white dark:bg-github-dark-subtle border-slate-100 dark:border-white/10 shadow-lg hover:shadow-xl hover:border-rose-500/30 active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                                                    !hasActiveSession 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
                                                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:rotate-[-15deg] group-hover:scale-110 shadow-lg shadow-rose-500/10'
                                                }`}>
                                                    <LogOut size={24} strokeWidth={2.5} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className={`text-xl font-black tracking-tight ${!hasActiveSession ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                                                        {isSubmitting && cameraMode === 'OUT' && !showCamera ? 'Processing...' : 'Time Out'}
                                                    </h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider opacity-60">
                                                        {!hasActiveSession ? 'No Active Session' : 'End your day'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:bg-rose-500/10 group-hover:text-rose-500">
                                                <ChevronRight size={20} className={!hasActiveSession ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'} />
                                            </div>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        {!isWorkingDayToday && !globalActiveSession && (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg shrink-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Non-Working Day</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                        Today is not a scheduled working day. Any hours worked today will not be counted towards your regular attendance.
                                    </p>
                                </div>
                            </div>
                        )}

                        {missedPunchWarning && (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-center animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg relative">
                                        <AlertCircle size={20} />
                                        {missedPunchWarning.dates.length > 1 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {missedPunchWarning.dates.length}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Missed Time Out</p>
                                        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                            You forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction request or it will be marked absent.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setActiveTab('my_attendance');
                                        setSubTab('correction');
                                        setIsCorrectionDrawerOpen(true);
                                        if (missedPunchWarning && missedPunchWarning.dates && missedPunchWarning.dates.length > 0) {
                                            setCorrDate(missedPunchWarning.dates[0]);
                                        }
                                    }}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                                >
                                    Fix Now
                                </button>
                            </div>
                        )}

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-center items-center gap-4 relative" ref={calendarRef}>
                                <div
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-dark-card py-2.5 px-6 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border min-w-[200px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none"
                                >
                                    <CalendarIcon size={18} />
                                    <span>{formatDateDisplay(selectedDate)}</span>
                                </div>

                                {showCalendar && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                        <CustomCalendar
                                            selectedDate={selectedDate}
                                            onChange={(date) => {
                                                setSelectedDate(date);
                                                setShowCalendar(false);
                                            }}
                                            onClose={() => setShowCalendar(false)}
                                            events={calendarEvents}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                            {/* Horizontal Date Scroller */}
                            <div className="flex gap-4 overflow-x-auto py-6 px-2 no-scrollbar scroll-smooth">
                                {scrollerDates.map((date) => {
                                    const dateStr = date.toISOString().split('T')[0];
                                    const isSelected = dateStr === selectedDate;
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    
                                    return (
                                        <button
                                            key={dateStr}
                                            id={isSelected ? "selected-date-btn" : undefined}
                                            onClick={() => setSelectedDate(dateStr)}
                                            className={`flex flex-col items-center justify-center min-w-[70px] h-24 rounded-xl transition-all duration-500 relative group ${
                                                isSelected 
                                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 transform scale-105 z-10' 
                                                    : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-white/5 hover:border-indigo-600/30'
                                            }`}
                                        >
                                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                {dayName}
                                            </span>
                                            <span className="text-xl font-black">{date.getDate()}</span>
                                            {isToday && !isSelected && <div className="absolute bottom-3 w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>}
                                            {isSelected && <motion.div layoutId="activeDate" className="absolute -inset-0.5 rounded-xl border-2 border-indigo-600/50" />}
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Logs Section Header */}
                        <div className="pt-8">
                            <div className="flex items-center justify-between mb-8 px-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                        {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Logs" : `Logs for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setCorrDate(selectedDate);
                                        setIsCorrectionDrawerOpen(true);
                                    }} 
                                    data-tour-id="att-correction-btn"
                                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl hover:shadow-lg transition-all active:scale-95 border border-indigo-100/50 dark:border-indigo-500/20"
                                >
                                    <Plus size={14} strokeWidth={3} /> Request Correction
                                </button>
                            </div>

                            {/* Daily Records List */}
                            <div className="space-y-4">
                                {loading ? (
                                    <p className="text-center text-slate-500 py-10">Loading...</p>
                                ) : dailySessions.length === 0 ? (
                                    <p className="text-center text-slate-400 py-10">No attendance records for this date.</p>
                                ) : (
                                    dailySessions.map((session, idx) => (
                                        <div key={session.attendance_id || session.id} className="bg-white dark:bg-github-dark-subtle p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-md space-y-6 transition-all hover:shadow-xl">
                                            {/* Session Header */}
                                            <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-white/5">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <div className="p-1.5 bg-slate-50 dark:bg-white/5 rounded-lg">
                                                        <Clock size={14} />
                                                    </div>
                                                    Session #{dailySessions.length - idx}
                                                </span>
                                                <div className="flex flex-col items-end gap-2">
                                                    {(() => {
                                                        const st = (session.status || (session.late_minutes > 0 ? 'LATE' : 'PRESENT')).toUpperCase();
                                                        const style = getStatusStyle(st);
                                                        return (
                                                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-2 ${style.bg} ${style.text}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                                                                {style.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50/50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-100/50 dark:border-white/5">
                                                        <Clock size={12} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
                                                        <span>Duration: <span className="font-black text-slate-800 dark:text-white">{session.total_hours || calculateDuration(session.time_in, session.time_out) || '--'}</span></span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* IN/OUT Sections Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Time In Section */}
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                                                            <ArrowUpRight size={24} strokeWidth={3} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time In</span>
                                                            <span className="text-2xl font-black text-slate-800 dark:text-white truncate block tracking-tight">
                                                                {formatTime(session.time_in, session, false)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* In Address */}
                                                    <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                                        <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            {session.time_in_address || 'Address not captured'}
                                                        </p>
                                                    </div>

                                                    {/* In Image */}
                                                    <div className="space-y-3 max-w-[280px]">
                                                        <div className="flex items-center justify-between px-1">
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                            {session.time_in_image && <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                                        </div>
                                                        <div 
                                                            onClick={() => session.time_in_image && setViewerImage(session.time_in_image)}
                                                            className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                                        >
                                                            {session.time_in_image ? (
                                                                <>
                                                                    <img src={session.time_in_image} alt="In" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                                        <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                                        <Camera size={24} />
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Time Out Section */}
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                                                            <LogOut size={24} strokeWidth={3} className="rotate-180" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest mb-1 opacity-70">Time Out</span>
                                                            <span className={`text-2xl font-black truncate block tracking-tight ${session.time_out ? 'text-slate-800 dark:text-white' : 'text-emerald-500 animate-pulse'}`}>
                                                                {session.time_out ? formatTime(session.time_out, session, true) : 'Active Session'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Out Address */}
                                                    <div className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                                        <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            {session.time_out ? (session.time_out_address || 'Address not captured') : 'Ongoing session...'}
                                                        </p>
                                                    </div>

                                                    {/* Out Image */}
                                                    <div className="space-y-3 max-w-[280px]">
                                                        <div className="flex items-center justify-between px-1">
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest opacity-60">Verification Image</p>
                                                            {session.time_out_image && <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md">Captured</span>}
                                                        </div>
                                                        <div 
                                                            onClick={() => session.time_out_image && setViewerImage(session.time_out_image)}
                                                            className="aspect-video rounded-xl overflow-hidden border-2 border-slate-100 dark:border-white/5 group relative shadow-inner cursor-pointer"
                                                        >
                                                            {session.time_out_image ? (
                                                                <>
                                                                    <img src={session.time_out_image} alt="Out" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                                        <Eye size={32} className="text-white transform scale-75 group-hover:scale-100 transition-transform duration-300" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300">
                                                                        <Camera size={24} />
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-slate-300 tracking-[0.2em]">No Image</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
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

                        {/* SUB-TAB: HISTORY (Weekly Grouped) */}
                        {subTab === 'history' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {monthlySessions.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl border border-slate-200 dark:border-github-dark-border border-dashed">
                                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No records found for this month</p>
                                    </div>
                                ) : (
                                    // Group by Week
                                    Object.entries(monthlySessions.reduce((groups, session) => {
                                        const date = new Date(session.time_in || session.check_in); // Handle both key names if backend varies
                                        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                                        const weekNumber = Math.ceil((((date - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
                                        const weekKey = `Week ${weekNumber}`;

                                        if (!groups[weekKey]) groups[weekKey] = [];
                                        groups[weekKey].push(session);
                                        return groups;
                                    }, {})).sort().map(([week, weekSessions]) => (
                                        <div key={week} className="space-y-4">
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 sticky top-0 bg-slate-50/95 dark:bg-black/20 backdrop-blur-sm py-2 z-10">
                                                {week}
                                            </h3>
                                            <div className="grid gap-4">
                                                {weekSessions.map((session, index) => (
                                                    <div key={session.attendance_id || index} className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${getStatusStyle(session.status).bg} ${getStatusStyle(session.status).text}`}>
                                                                    {new Date(session.time_in).getDate()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-github-dark-text">
                                                                        {new Date(session.time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                        {(() => {
                                                                            const style = getStatusStyle(session.status);
                                                                            return (
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                                                                                    {style.label}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                        <span>•</span>
                                                                        <span>{session.time_in_address || 'Remote'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-6 text-sm">
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">In</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatTime(session.time_in, session, false)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Out</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                                                        {session.time_out ? formatTime(session.time_out, session, true) : '--:--'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right min-w-[60px]">
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Hrs</p>
                                                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                        {session.total_hours || calculateDuration(session.time_in, session.time_out) || '-'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* SUB-TAB: ANALYTICS */}
                        {subTab === 'analytics' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Date Filters */}
                                <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <CalendarIcon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Analytics Period</h4>
                                            <p className="text-[11px] text-slate-400 dark:text-github-dark-muted font-bold mt-0.5">Configure the date range for metrics and charts</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* Filter Type Segment Selector */}
                                        <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex gap-1 border border-slate-200/50 dark:border-white/5 shrink-0">
                                            {[
                                                { id: 'this_month', label: 'This Month' },
                                                { id: 'last_month', label: 'Last Month' },
                                                { id: 'select_month', label: 'Select Month' },
                                                { id: 'custom', label: 'Custom' },
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => setAnalyticsFilterType(type.id)}
                                                    className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all ${
                                                        analyticsFilterType === type.id
                                                            ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {/* Contextual Inputs */}
                                        {analyticsFilterType === 'select_month' && (
                                            <div className="w-44">
                                                <MonthPicker
                                                    value={analyticsSelectedMonth}
                                                    onChange={(val) => setAnalyticsSelectedMonth(val)}
                                                    compact={true}
                                                />
                                            </div>
                                        )}
                                        
                                        {analyticsFilterType === 'custom' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-36">
                                                    <DatePicker
                                                        value={analyticsStartDate}
                                                        onChange={(val) => setAnalyticsStartDate(val)}
                                                        compact={true}
                                                        placeholder="Start Date"
                                                    />
                                                </div>
                                                <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-black uppercase">To</span>
                                                <div className="w-36">
                                                    <DatePicker
                                                        value={analyticsEndDate}
                                                        onChange={(val) => setAnalyticsEndDate(val)}
                                                        compact={true}
                                                        placeholder="End Date"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {analyticsLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                                        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
                                        <p className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Compiling Analytics Data...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* 1. KPI Cards Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                            {/* Card 1: Total Days */}
                                            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-slate-500 font-medium">Total Days</p>
                                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">{analyticsSessions.length}</h3>
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                    <CalendarIcon size={24} />
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                                                <div className="flex justify-between items-start z-10 relative">
                                                    <div>
                                                        <p className="text-sm text-slate-500 font-medium">Present</p>
                                                        <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                            {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / analyticsSessions.length) * 100) : 0}%
                                                        </h3>
                                                    </div>
                                                    <div className="h-12 w-12 rounded-full border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-500 flex items-center justify-center">
                                                        <span className="text-[10px] font-bold text-emerald-600">
                                                            {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / analyticsSessions.length) * 100) : 0}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card 3: Late % */}
                                            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                                                <div className="flex justify-between items-start z-10 relative">
                                                    <div>
                                                        <p className="text-sm text-slate-500 font-medium">Late</p>
                                                        <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                            {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.late_minutes > 0).length / analyticsSessions.length) * 100) : 0}%
                                                        </h3>
                                                    </div>
                                                    <div className="h-12 w-12 rounded-full border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-500 flex items-center justify-center">
                                                        <span className="text-[10px] font-bold text-amber-600">
                                                            {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.late_minutes > 0).length / analyticsSessions.length) * 100) : 0}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card 4: Overtime Days */}
                                            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-slate-500 font-medium">Overtime</p>
                                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                        {analyticsSessions.filter(s => s.status === 'OVERTIME').length}
                                                    </h3>
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                                    <History size={24} />
                                                </div>
                                            </div>

                                            {/* Card 5: Avg Hours */}
                                            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-slate-500 font-medium">Avg Hours</p>
                                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                                        {analyticsSessions.length > 0
                                                            ? (analyticsSessions.reduce((acc, s) => acc + getSessionHours(s), 0) / analyticsSessions.length).toFixed(1)
                                                            : '0'}
                                                    </h3>
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                    <Clock size={24} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Attendance Trends (Full Width) */}
                                        <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Total Attendance Report</h3>
                                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                            <div className="h-72">
                                                <Bar
                                                    data={chartData}
                                                    options={{
                                                        responsive: true,
                                                        maintainAspectRatio: false,
                                                        plugins: {
                                                            legend: { display: false },
                                                            tooltip: {
                                                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                                titleColor: '#fff',
                                                                bodyColor: '#e2e8f0',
                                                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                                                borderWidth: 1,
                                                                padding: 12,
                                                                boxPadding: 6,
                                                                usePointStyle: true,
                                                                callbacks: {
                                                                    title: function(context) {
                                                                        const index = context[0].dataIndex;
                                                                        const session = context[0].dataset.sessions?.[index];
                                                                        if (session) {
                                                                            const dateStr = session.check_in || session.time_in;
                                                                            if (dateStr) {
                                                                                return new Date(dateStr).toLocaleDateString('en-US', {
                                                                                    weekday: 'long',
                                                                                    year: 'numeric',
                                                                                    month: 'short',
                                                                                    day: 'numeric'
                                                                                });
                                                                            }
                                                                        }
                                                                        return context[0].label;
                                                                    },
                                                                    label: function(context) {
                                                                        const index = context.dataIndex;
                                                                        const session = context.dataset.sessions?.[index];
                                                                        const hours = context.parsed.y;
                                                                        const labelLines = [`Worked: ${hours} hrs`];
                                                                        if (session) {
                                                                            if (session.status) {
                                                                                labelLines.push(`Status: ${session.status}`);
                                                                            }
                                                                            if (session.time_in) {
                                                                                const inTime = new Date(session.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                                                labelLines.push(`In: ${inTime}`);
                                                                            }
                                                                            if (session.time_out) {
                                                                                const outTime = new Date(session.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                                                labelLines.push(`Out: ${outTime}`);
                                                                            } else if (session.time_in) {
                                                                                labelLines.push(`Out: Active / Missed`);
                                                                            }
                                                                        }
                                                                        return labelLines;
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        scales: {
                                                            y: {
                                                                beginAtZero: true,
                                                                grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                                                ticks: { color: '#94a3b8' }
                                                            },
                                                            x: {
                                                                grid: { display: false },
                                                                ticks: { color: '#94a3b8' }
                                                            }
                                                        },
                                                        borderRadius: 6,
                                                        barThickness: 24
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* 3. Bottom Row: Status & Weekly Pattern */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Status Breakdown */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Attendance Status</h3>
                                                <div className="h-64 flex justify-center relative">
                                                    <Pie
                                                        data={pieData}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            plugins: {
                                                                legend: {
                                                                    position: 'right',
                                                                    labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Weekly Activity Line/Area Chart */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Weekly Activity</h3>
                                                <div className="h-64">
                                                    <Line
                                                        data={{
                                                            labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                                                            datasets: [{
                                                                label: 'Avg Hours',
                                                                data: [0, 1, 2, 3, 4, 5, 6].map(d => {
                                                                    const sessionsOnDay = analyticsSessions.filter(s => new Date(s.time_in).getDay() === d);
                                                                    if (sessionsOnDay.length === 0) return 0;
                                                                    const total = sessionsOnDay.reduce((acc, s) => acc + getSessionHours(s), 0);
                                                                    return parseFloat((total / sessionsOnDay.length).toFixed(1));
                                                                }),
                                                                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                                                                borderColor: '#4f46e5',
                                                                borderWidth: 2,
                                                                tension: 0.4,
                                                                fill: true,
                                                                pointBackgroundColor: '#4f46e5',
                                                                pointHoverRadius: 6,
                                                            }]
                                                        }}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            plugins: {
                                                                legend: { display: false },
                                                                tooltip: {
                                                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                                    titleColor: '#fff',
                                                                    bodyColor: '#e2e8f0',
                                                                    callbacks: {
                                                                        label: function(context) {
                                                                            return `Avg Hours: ${context.parsed.y} hrs`;
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            scales: {
                                                                y: {
                                                                    beginAtZero: true,
                                                                    grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                                                    ticks: { color: '#94a3b8' }
                                                                },
                                                                x: {
                                                                    grid: { display: false },
                                                                    ticks: { color: '#94a3b8' }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {/* SUB-TAB: CORRECTION REQUESTS */}
                        {subTab === 'correction' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Split Panel */}
                                <div className="flex flex-col lg:flex-row gap-6 items-start">
                                    {/* LEFT — Request List */}
                                    <div 
                                        data-tour-id="att-correction-list"
                                        className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col lg:sticky lg:top-6" 
                                        style={{ height: 'calc(100vh - 120px)', minHeight: '650px' }}
                                    >
                                        <div className="p-4 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">My Requests</h3>
                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                                                {correctionHistory.length} Total
                                            </span>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-3 space-y-2 no-scrollbar">
                                            {loading ? (
                                                <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
                                            ) : correctionHistory.length === 0 ? (
                                                <div className="p-10 text-center">
                                                    <FileClock size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                                    <p className="text-sm text-slate-400 dark:text-github-dark-muted italic">No correction requests yet.</p>
                                                </div>
                                            ) : (
                                                correctionHistory.map((req) => (
                                                    <div
                                                        key={req.acr_id}
                                                        onClick={() => handleRequestClick(req)}
                                                        className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                                            selectedRequest?.acr_id === req.acr_id
                                                                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/40 dark:border-indigo-500/40 shadow-indigo-500/5'
                                                                : 'bg-slate-50/40 dark:bg-github-dark-subtle/20 border-slate-200/60 dark:border-github-dark-border/80 hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 hover:border-slate-300 dark:hover:border-github-dark-border'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                                    {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                                        <img src={req.profile_image_url} alt={req.user_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (req.user_name || 'U').charAt(0).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className={`text-xs font-bold leading-none ${selectedRequest?.acr_id === req.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{req.user_name}</p>
                                                                    <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-medium mt-1 inline-block">ID: {req.user_id}</span>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                                req.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                : req.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                            }`}>{req.status}</span>
                                                        </div>
                                                        <p className={`text-sm font-semibold mb-1 ${selectedRequest?.acr_id === req.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                            {formatCorrectionDate(req.request_date)}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted italic line-clamp-1">"{req.reason}"</p>
                                                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2.5 font-mono border-t border-slate-100/50 dark:border-github-dark-border/30 pt-2">
                                                            <span>Sub. {req.submitted_at ? formatCorrectionDate(req.submitted_at) : '—'}</span>
                                                            <span className="font-bold text-[9px] text-indigo-600 dark:text-indigo-400 bg-transparent dark:bg-transparent p-0">{(req.correction_type || '').replace('_', ' ')}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div 
                                        className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col lg:sticky lg:top-6"
                                        style={{ height: 'calc(100vh - 120px)', minHeight: '650px' }}
                                    >
                                        {isFetchingDetails ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                                                <p className="text-xs font-bold uppercase tracking-wider">Fetching details…</p>
                                            </div>
                                        ) : selectedRequest ? (
                                            <>
                                                {/* Detail Header */}
                                                <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                         <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                             {selectedRequest.profile_image_url && selectedRequest.profile_image_url.startsWith('http') ? (
                                                                 <img src={selectedRequest.profile_image_url} alt={selectedRequest.user_name} className="w-full h-full object-cover" />
                                                             ) : (
                                                                 (selectedRequest.user_name || 'U').charAt(0).toUpperCase()
                                                             )}
                                                         </div>
                                                         <div>
                                                             <h2 className="text-lg font-bold text-slate-900 dark:text-github-dark-text mb-0.5">Request #{selectedRequest.acr_id}</h2>
                                                             <p className="text-xs text-slate-500 dark:text-github-dark-muted">
                                                                 By <span className="font-bold text-slate-700 dark:text-slate-300">{selectedRequest.user_name}</span> • {formatCorrectionDate(selectedRequest.request_date)}
                                                             </p>
                                                         </div>
                                                     </div>
                                                    <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${
                                                        selectedRequest.status === 'approved'
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                                            : selectedRequest.status === 'rejected'
                                                            ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30'
                                                            : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'
                                                    }`}>
                                                        {selectedRequest.status}
                                                    </span>
                                                </div>

                                                <div className="flex-1 overflow-y-auto no-scrollbar">

                                                    {/* ── Visual Sync Timeline ── */}
                                                    {(() => {
                                                        const originalSnap = Array.isArray(selectedRequest.original_data) ? selectedRequest.original_data : [];
                                                        const proposedSnap = Array.isArray(selectedRequest.proposed_data) ? selectedRequest.proposed_data : [];
                                                        const fmtTime = (t) => t ? String(t).substring(0, 5) : '';
                                                        const originalTasks = originalSnap.map((s, i) => ({ id: `orig-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                                        const proposedTasks = proposedSnap.map((s, i) => ({ id: `prop-${i}`, startTime: fmtTime(s.time_in), endTime: fmtTime(s.time_out) })).filter(t => t.startTime && t.endTime);
                                                        const allTasks = [...originalTasks, ...proposedTasks];
                                                        if (allTasks.length === 0) return null;
                                                        const getMinutes = (t) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
                                                        let minMin = Math.min(...allTasks.map(t => getMinutes(t.startTime)));
                                                        let maxMin = Math.max(...allTasks.map(t => getMinutes(t.endTime)));
                                                        let startHour = Math.max(0, Math.floor((minMin - 60) / 60));
                                                        let endHour = Math.min(24, Math.ceil((maxMin + 60) / 60));
                                                        const span = Math.max(1, endHour - startHour);
                                                        const timeToPos = (time) => { if (!time) return 0; const [h, m] = time.split(':').map(Number); const mins = (h || 0) * 60 + (m || 0); return Math.max(0, Math.min(100, ((mins - startHour * 60) / (span * 60)) * 100)); };
                                                        const getDurationPct = (s, e) => Math.max(0, timeToPos(e) - timeToPos(s));
                                                        const changesList = [];
                                                        const origCopy = originalTasks.map(t => ({ ...t }));
                                                        proposedTasks.forEach(prop => {
                                                            const match = origCopy.find(o => o.startTime === prop.startTime && o.endTime === prop.endTime);
                                                            if (match) { match.matched = true; } else {
                                                                const over = origCopy.find(o => !o.matched && (Math.abs(getMinutes(o.startTime) - getMinutes(prop.startTime)) < 120 || Math.abs(getMinutes(o.endTime) - getMinutes(prop.endTime)) < 120));
                                                                if (over) { over.matched = true; changesList.push({ type: 'MODIFY', task: prop, original: over }); }
                                                                else { changesList.push({ type: 'ADD', task: prop }); }
                                                            }
                                                        });
                                                        origCopy.filter(o => !o.matched).forEach(o => changesList.push({ type: 'DELETE', task: o }));
                                                        // Show only every 2nd hour if span > 8 to avoid crowding
                                                        const hourStep = span > 8 ? 2 : 1;
                                                        return (
                                                            <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-200 dark:border-github-dark-border px-6 pt-4 pb-5">
                                                                {/* Title row */}
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Sync Timeline</span>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800">
                                                                        {(selectedRequest.correction_type || 'correction').toUpperCase()}
                                                                    </span>
                                                                    {/* Legend */}
                                                                    <div className="ml-auto flex items-center gap-3 text-[9px] font-bold uppercase text-slate-400">
                                                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-slate-400/30 border border-slate-400/40"></span>Original</span>
                                                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/40"></span>Proposed</span>
                                                                    </div>
                                                                </div>

                                                                {/* Scale */}
                                                                <div className="relative mb-1 h-5">
                                                                    {Array.from({ length: span + 1 }, (_, i) => startHour + i)
                                                                        .filter((_, i) => i % hourStep === 0)
                                                                        .map((h, i, arr) => (
                                                                            <span key={h} className="absolute text-[9px] text-slate-400 font-mono -translate-x-1/2" style={{ left: `${((h - startHour) / span) * 100}%` }}>
                                                                                {h}:00
                                                                            </span>
                                                                        ))}
                                                                </div>

                                                                {/* Tick lines + rows */}
                                                                <div className="relative">
                                                                    {/* Vertical grid lines */}
                                                                    <div className="absolute inset-0 pointer-events-none flex">
                                                                        {Array.from({ length: span + 1 }, (_, i) => i).map(i => (
                                                                            <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/40 dark:border-github-dark-border/40" style={{ left: `${(i / span) * 100}%` }} />
                                                                        ))}
                                                                    </div>

                                                                    {/* Original row */}
                                                                    <div className="mb-1">
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Original</div>
                                                                        <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden">
                                                                            {originalTasks.map(task => (
                                                                                <div key={task.id}
                                                                                    className="absolute inset-y-1 rounded-md bg-slate-400/25 border border-slate-400/40 flex items-center justify-center overflow-hidden"
                                                                                    style={{ left: `${timeToPos(task.startTime)}%`, width: `${getDurationPct(task.startTime, task.endTime)}%` }}>
                                                                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-1 truncate">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                                </div>
                                                                            ))}
                                                                            {originalTasks.length === 0 && (
                                                                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Original Records</div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Proposed row */}
                                                                    <div>
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Proposed</div>
                                                                        <div className="relative h-8 bg-slate-200/40 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-github-dark-border/50 overflow-hidden">
                                                                            {proposedTasks.map(task => {
                                                                                const isNew = changesList.some(c => c.type === 'ADD' && c.task.id === task.id);
                                                                                const isChanged = changesList.some(c => c.type === 'MODIFY' && c.task.id === task.id);
                                                                                const cls = isNew
                                                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                                                                                    : isChanged
                                                                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400'
                                                                                    : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-400';
                                                                                return (
                                                                                    <div key={task.id}
                                                                                        className={`absolute inset-y-1 rounded-md border flex items-center justify-center overflow-hidden ${cls}`}
                                                                                        style={{ left: `${timeToPos(task.startTime)}%`, width: `${getDurationPct(task.startTime, task.endTime)}%` }}>
                                                                                        {isNew && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />}
                                                                                        <span className="text-[10px] font-mono font-bold px-1 truncate">{fmtTime(task.startTime)}–{fmtTime(task.endTime)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ── Info Cards ── */}
                                                    <div className="p-5 space-y-4">

                                                        {/* Meta row */}
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">{selectedRequest.correction_type || '—'}</p>
                                                            </div>
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Method</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text capitalize">
                                                                    {selectedRequest.correction_method === 'add_session' ? 'Manual' : selectedRequest.correction_method || 'Fix'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/40 rounded-xl p-3 border border-slate-100 dark:border-github-dark-border/50">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Submitted</p>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-github-dark-text">
                                                                    {selectedRequest.submitted_at ? new Date(selectedRequest.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Proposed Sessions */}
                                                        {Array.isArray(selectedRequest.proposed_data) && selectedRequest.proposed_data.length > 0 && (
                                                            <div className="bg-slate-50 dark:bg-[#1a1c26] rounded-xl border border-slate-200 dark:border-github-dark-border overflow-hidden">
                                                                <div className="px-4 py-3 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-github-dark-text">Proposed Sessions</h3>
                                                                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                                        {selectedRequest.proposed_data.length} session{selectedRequest.proposed_data.length !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="divide-y divide-slate-100 dark:divide-github-dark-border">
                                                                    {selectedRequest.proposed_data.map((s, i) => (
                                                                        <div key={i} className="flex items-center px-4 py-3 gap-4">
                                                                            <span className="text-[10px] font-black text-slate-400 w-5 shrink-0">#{i + 1}</span>
                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">In</span>
                                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_in || '').substring(0, 5)}</span>
                                                                            </div>
                                                                            <span className="text-slate-300 dark:text-slate-600">→</span>
                                                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Out</span>
                                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text font-mono">{String(s.time_out || '').substring(0, 5)}</span>
                                                                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Reason */}
                                                        <div className="bg-slate-50 dark:bg-[#1e202e] rounded-xl border border-slate-200 dark:border-github-dark-border p-4">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                                <FileClock size={12} /> Request Reason
                                                            </h3>
                                                            <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                                                                "{selectedRequest.reason || 'No reason provided.'}"
                                                            </p>
                                                        </div>

                                                        {/* Reviewer Decision */}
                                                        {selectedRequest.status !== 'pending' && (
                                                            <div className={`rounded-xl border p-4 ${
                                                                selectedRequest.status === 'approved'
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30'
                                                                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'
                                                            }`}>
                                                                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                                                                    selectedRequest.status === 'approved'
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : 'text-red-600 dark:text-red-400'
                                                                }`}>
                                                                    <CheckCircle size={12} /> Reviewer Decision
                                                                </h3>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                                                    {selectedRequest.review_comments || 'No reviewer comments provided.'}
                                                                </p>
                                                                <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                    Reviewed {selectedRequest.reviewed_at ? formatDateDisplay(selectedRequest.reviewed_at) : '—'}
                                                                </p>
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>

                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 p-12">
                                                <FileText size={48} className="mb-4 opacity-40" />
                                                <p className="text-sm">Select a request to view details</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        )}
                        {/* SUB-TAB: REPORTS (Self-Service) */}
                        {subTab === 'reports' && (
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
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                                reportsReportType === opt.value 
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
                                                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors ${
                                                                                    reportsSelectedWeek === w.value 
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
                                                            <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${
                                                                reportsExportColumns[col.id]
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
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                    reportsUseCustomRange
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
                        )}
                     </div>
                )}

                {/* --- CONFIRM SUBMISSION MODAL --- */}
                {showConfirmSubmit && createPortal(
                    <div className="fixed inset-0 z-[9000] overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center animate-in fade-in duration-200">
                            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => !submitLoading && setShowConfirmSubmit(false)} />
                            <div className="relative bg-white dark:bg-dark-card w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-github-dark-border overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-6 text-center">
                                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-github-dark-text tracking-tight mb-2">Confirm Submission</h3>
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-6">
                                        Are you sure you want to submit this correction request for <span className="font-bold text-slate-800 dark:text-github-dark-text">{formatDateDisplay(corrDate)}</span>?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowConfirmSubmit(false)}
                                            className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmSubmit}
                                            disabled={submitLoading}
                                            className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            {submitLoading ? <RefreshCw className="animate-spin" size={16} /> : "Confirm & Send"}
                                        </button>
                                    </div>
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

                {/* --- CAMERA PORTAL --- */}
                {showCamera && createPortal(
                    <div className="fixed inset-0 z-[9000] overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center transition-all duration-200">
                            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" onClick={closeCamera} />
                            <div className="relative w-full max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-200 text-left mx-auto">
                            <div className="relative flex justify-center items-center px-4">
                                <h3 className="text-2xl font-bold text-white tracking-tight text-center">
                                    {cameraMode === 'IN' ? 'Check In' : 'Check Out'}
                                </h3>
                                <button
                                    onClick={closeCamera}
                                    className="absolute right-4 p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            {(() => {
                                const isSelfieRequired = cameraMode === 'IN'
                                    ? (myShift?.rules?.entry_requirements?.selfie ?? true)
                                    : (myShift?.rules?.exit_requirements?.selfie ?? false);

                                return (
                                    <>
                                        {isSelfieRequired && (
                                            <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-video">
                                                {imgSrc ? (
                                                    <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Webcam
                                                        audio={false}
                                                        ref={webcamRef}
                                                        screenshotFormat="image/jpeg"
                                                        className="w-full h-full object-cover"
                                                        videoConstraints={{ facingMode: "user" }}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {requireLateReason && (!isSelfieRequired || imgSrc) && (
                                            <div className="space-y-3 px-2 w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex items-center gap-2 text-amber-300 bg-amber-900/40 border border-amber-500/30 p-3 rounded-xl mb-4 text-sm font-medium">
                                                    <AlertCircle size={18} className="shrink-0" />
                                                    <p>{lateReasonMessage}</p>
                                                </div>
                                                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                                                    Please provide a reason
                                                </label>
                                                <textarea
                                                    value={lateReasonText}
                                                    onChange={(e) => setLateReasonText(e.target.value)}
                                                    placeholder="I got held up in traffic..."
                                                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-slate-400 h-24 resize-none backdrop-blur-md"
                                                    required
                                                ></textarea>
                                            </div>
                                        )}

                                        <div className="flex justify-center gap-6 pt-2">
                                            {!isSelfieRequired ? (
                                                <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                                    <button
                                                        onClick={closeCamera}
                                                        className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95">
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={confirmAttendance}
                                                        disabled={isSubmitting}
                                                        className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none">
                                                        {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
                                                    </button>
                                                </div>
                                            ) : !imgSrc ? (
                                                <button
                                                    onClick={capture}
                                                    className="w-24 h-24 rounded-full bg-white text-indigo-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 ring-8 ring-white/20">
                                                    <Camera size={40} />
                                                </button>
                                            ) : (
                                                <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                                    <button
                                                        onClick={retake}
                                                        className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95">
                                                        <RefreshCw size={22} /> Retake
                                                    </button>
                                                    <button
                                                        onClick={confirmAttendance}
                                                        disabled={isSubmitting}
                                                        className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none">
                                                        {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    </div>,
                    document.body
                )}
                {/* --- CORRECTION DRAWER (RIGHT SIDEBAR) --- */}
                <AnimatePresence>
                    {isCorrectionDrawerOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsCorrectionDrawerOpen(false)}
                                className="fixed inset-0 z-[110] bg-slate-950/20 backdrop-blur-sm cursor-pointer"
                            />
                            <motion.div
                                initial={{ x: '100%', opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0.5 }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                data-tour-id="att-correction-drawer"
                                className="fixed top-0 right-0 h-full w-full max-w-xl bg-white dark:bg-github-dark-subtle z-[120] shadow-2xl border-l border-slate-100 dark:border-github-dark-border flex flex-col"
                            >
                                <div className="p-8 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-github-dark-bg/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                            <FileClock size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-github-dark-text tracking-tight">Request Correction</h3>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted tracking-widest mt-1">Submit Your Attendance Adjustments</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsCorrectionDrawerOpen(false)}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
 
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <form id="correction-form" onSubmit={handleSubmitCorrection} className="space-y-8">
                                        {/* Date Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Adjustment Date</label>
                                            <div data-tour-id="att-correction-date" className="relative z-[130]">
                                                <DatePicker
                                                    value={corrDate}
                                                    onChange={(val) => setCorrDate(val)}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>
 
                                        {/* Type & Method Grid */}
                                        <div className="grid grid-cols-1 gap-6">
                                            <div data-tour-id="att-correction-type">
                                                <ThemedSelect 
                                                    label="Correction Type"
                                                    value={corrType}
                                                    onChange={(val) => setCorrType(val)}
                                                    options={[
                                                        { label: 'Normal Correction', value: 'Correction' },
                                                        { label: 'Missed Punch', value: 'Missed Punch' },
                                                        { label: 'Overtime Request', value: 'Overtime' },
                                                        { label: 'Other Adjustment', value: 'Other' }
                                                    ]}
                                                />
                                            </div>
                                            {corrType === 'Other' && (
                                                <motion.input
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    type="text"
                                                    placeholder="Specify Adjustment Type"
                                                    value={corrOtherType}
                                                    onChange={(e) => setCorrOtherType(e.target.value)}
                                                    className="w-full mt-3 px-5 py-4 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-bold shadow-sm"
                                                    required
                                                />
                                            )}
 
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Correction Method</label>
                                                <div data-tour-id="att-correction-method" className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 dark:bg-github-dark-bg rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('add_session')}
                                                        className={`py-3 text-[11px] font-black tracking-widest rounded-xl transition-all ${corrMethod === 'add_session' ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border' : 'text-slate-400'}`}
                                                    >
                                                        Manual Entry
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('reset')}
                                                        className={`py-3 text-[11px] font-black tracking-widest rounded-xl transition-all ${corrMethod === 'reset' ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-github-dark-border' : 'text-slate-400'}`}
                                                    >
                                                        Full Day Reset
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
 
                                        {/* Dynamic Session Inputs */}
                                        <div data-tour-id="att-correction-sessions" className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em]">Session Details</label>
                                                {corrMethod === 'add_session' && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setCorrSessions(prev => [...prev, { id: Date.now(), time_in: '', time_out: '' }])}
                                                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:shadow-md transition-all active:scale-95"
                                                    >
                                                        + Add Session
                                                    </button>
                                                )}
                                            </div>
 
                                            {corrMethod === 'reset' ? (
                                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-github-dark-bg p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">New In</label>
                                                        <input
                                                            type="time"
                                                            value={corrIn}
                                                            onChange={(e) => setCorrIn(e.target.value)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-mono font-bold"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">New Out</label>
                                                        <input
                                                            type="time"
                                                            value={corrOut}
                                                            onChange={(e) => setCorrOut(e.target.value)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-mono font-bold"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {[...corrSessions].sort((a, b) => {
                                                        if (!a.time_in) return 1;
                                                        if (!b.time_in) return -1;
                                                        return a.time_in.localeCompare(b.time_in);
                                                    }).map((session, index, arr) => (
                                                        <motion.div 
                                                            layout
                                                            key={session.id} 
                                                            className={`flex items-end gap-3 p-4 rounded-2xl border transition-all ${
                                                                session.isExisting 
                                                                    ? 'bg-slate-100/30 dark:bg-github-dark-border/20 border-slate-200 dark:border-github-dark-border/50' 
                                                                    : 'bg-white dark:bg-github-dark-bg/50 border-indigo-100 dark:border-indigo-500/20 shadow-sm'
                                                            }`}
                                                        >
                                                            {session.isExisting ? (
                                                                <div className="flex-1 flex gap-4 w-full">
                                                                    <div className="flex-1 bg-slate-100/50 dark:bg-github-dark-bg p-4 rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col justify-center shadow-inner">
                                                                        <span className="block text-[9px] font-black text-slate-500 dark:text-github-dark-muted tracking-widest mb-1.5">Existing In</span>
                                                                        <span className="text-base font-black text-slate-800 dark:text-github-dark-text font-mono tracking-tight">{session.time_in || '--:--'}</span>
                                                                    </div>
                                                                    <div className="flex-1 bg-slate-100/50 dark:bg-github-dark-bg p-4 rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col justify-center shadow-inner">
                                                                        <span className="block text-[9px] font-black text-slate-500 dark:text-github-dark-muted tracking-widest mb-1.5">Existing Out</span>
                                                                        <span className="text-base font-black text-slate-800 dark:text-github-dark-text font-mono tracking-tight">{session.time_out || '--:--'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">In</label>
                                                                        <input
                                                                            type="time"
                                                                            value={session.time_in}
                                                                            onChange={(e) => setCorrSessions(prev => prev.map(s => s.id === session.id ? { ...s, time_in: e.target.value } : s))}
                                                                            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm bg-slate-50 dark:bg-github-dark-bg text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">Out</label>
                                                                        <input
                                                                            type="time"
                                                                            value={session.time_out}
                                                                            onChange={(e) => setCorrSessions(prev => prev.map(s => s.id === session.id ? { ...s, time_out: e.target.value } : s))}
                                                                            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm bg-slate-50 dark:bg-github-dark-bg text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                            {arr.length > 1 && !session.isExisting && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCorrSessions(prev => prev.filter(s => s.id !== session.id))}
                                                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            )}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reason Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1">Reason for Adjustment</label>
                                            <textarea
                                                data-tour-id="att-correction-reason"
                                                value={corrReason}
                                                onChange={(e) => setCorrReason(e.target.value)}
                                                placeholder="Please provide context for this correction..."
                                                className="w-full px-5 py-4 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-github-dark-text font-medium h-32 resize-none shadow-sm"
                                                required
                                            />
                                        </div>
                                    </form>
                                </div>

                                <div className="p-8 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/80">
                                    <button 
                                        type="submit" 
                                        form="correction-form"
                                        data-tour-id="att-correction-submit-btn"
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-[0.15em] rounded-[1.25rem] shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                                    >
                                        <FileClock size={20} className="group-hover:scale-110 transition-transform" />
                                        Submit Request
                                    </button>
                                    <p className="text-[9px] text-center text-slate-400 font-bold mt-4 tracking-widest opacity-60">Requires Admin Approval</p>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </DashboardLayout>
);
};

export default Attendance;
