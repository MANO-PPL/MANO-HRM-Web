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
    ShieldCheck,
    MessageSquare,
    CheckCheck,
    Send,
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
import { getLocalDateString, formatLocalTimeString } from '../../utils/dateUtils';

// Modular Components & Tabs
import AttendanceTimeLocationHeader from './components/AttendanceTimeLocationHeader';
import AttendancePermissionsBanner from './components/AttendancePermissionsBanner';
import CheckpointModal from './components/CheckpointModal';
import AttendanceCameraModal from './components/AttendanceCameraModal';
import MarkAttendanceTab from './tabs/MarkAttendanceTab';
import AttendanceHistoryTab from './tabs/AttendanceHistoryTab';
import AttendanceAnalyticsTab from './tabs/AttendanceAnalyticsTab';
import AttendanceCorrectionTab from './tabs/AttendanceCorrectionTab';

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
        const startVal = getLocalDateString(currentStart);
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
                    if (isManualRefresh && (fallbackErr.code === 1 || err.code === 1)) {
                        toast.error("Location permission is blocked. Click the lock icon (🔒) beside the URL in your address bar to allow location.");
                    }
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

    // Current date for Mark Attendance (using local date, avoiding UTC day-shift)
    const today = new Date();
    const formattedToday = getLocalDateString(today);
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
        const endDate = getLocalDateString(new Date(year, today.getMonth() + 1, 0));
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
        return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    });
    const [analyticsEndDate, setAnalyticsEndDate] = useState(() => {
        const d = new Date();
        return getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    });
    const [analyticsSessions, setAnalyticsSessions] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);



    const refreshMyShiftPolicy = useCallback(async (force = true) => {
        try {
            const data = await attendanceService.getMyShiftPolicy(force);
            if (data?.success || data?.ok || data?.shift) {
                setMyShift(data.shift || data);
            }
        } catch (err) {
            console.error("Failed to refresh shift policy:", err);
        }
    }, []);

    // Fetch Holidays and Shift Policy
    useEffect(() => {
        attendanceService.getHolidays()
            .then(data => setHolidays(data.holidays || []))
            .catch(console.error);

        refreshMyShiftPolicy(true);

        const handleShiftUpdate = () => {
            refreshMyShiftPolicy(true);
        };

        window.addEventListener('shift_policy_updated', handleShiftUpdate);
        window.addEventListener('focus', handleShiftUpdate);

        let bc;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                bc = new BroadcastChannel('mano_shifts_channel');
                bc.onmessage = (event) => {
                    if (event?.data?.type === 'shift_policy_updated' || event?.data === 'shift_policy_updated') {
                        handleShiftUpdate();
                    }
                };
            } catch (e) {}
        }

        return () => {
            window.removeEventListener('shift_policy_updated', handleShiftUpdate);
            window.removeEventListener('focus', handleShiftUpdate);
            if (bc) {
                try { bc.close(); } catch (e) {}
            }
        };
    }, [refreshMyShiftPolicy]);

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
    ], []);


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

    // Close preview modal on ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setViewerImage(null);
        };
        if (viewerImage) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [viewerImage]);

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
    const [corrDate, setCorrDate] = useState(() => getLocalDateString());

    const [corrType, setCorrType] = useState('Missed Punch'); // 'Missed Punch' | 'Missed Day' | 'Other'
    const [corrOtherType, setCorrOtherType] = useState(''); // Custom type input
    const [corrMethod, setCorrMethod] = useState('add_session'); // 'add_session' | 'reset'

    // Inputs for 'fix' and 'reset'
    const [corrIn, setCorrIn] = useState('');
    const [corrOut, setCorrOut] = useState('');

    // Inputs for sessions - starts empty so user can construct with their own mindset
    const [corrSessions, setCorrSessions] = useState([]);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const corrFileInputRef = useRef(null);

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

    // Shift deadline & allowed date bounds (temporarily unlimited for testing)
    const correctionDeadlineDays = useMemo(() => {
        return 3650; // Unlimited for testing
    }, [myShift]);

    const minAllowedCorrectionDate = useMemo(() => {
        return '2000-01-01'; // Unlimited for testing
    }, []);

    const maxAllowedCorrectionDate = useMemo(() => {
        return getLocalDateString();
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
            if (prev.length === 0) {
                const defaultIn = originalSessions[0]?.time_in || '09:00';
                return [{ id: Date.now(), time_in: defaultIn, time_out: shiftEnd, punch_type: 'regular' }];
            }
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            updated[lastIdx] = { ...updated[lastIdx], time_out: shiftEnd };
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
            setCorrSessions([]);
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
    const [checkpointImgSrc, setCheckpointImgSrc] = useState(null);
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
        if (force) {
            refreshMyShiftPolicy(true);
        }
        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate, force);
            if (res.ok) setDailySessions(res.data);

            // Fetch recent records to detect missed punches and today's active session
            const recentRes = await attendanceService.getMyRecords(undefined, undefined, force);
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = getLocalDateString(today);

                // Create a midnight copy for day calculation
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                // Check only previous 30 days
                const thirtyDaysAgo = new Date(todayMidnight);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo);

                const missedDates = [];
                let hasTodayActiveSession = false;

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionTimeIn = new Date(session.time_in);
                        const sessionDateStr = getLocalDateString(sessionTimeIn);
                        const hoursSinceIn = (Date.now() - sessionTimeIn.getTime()) / (1000 * 60 * 60);

                        // If unclosed session started within the last 24 hours and not absent/rejected, it is ACTIVE
                        if (hoursSinceIn < 24 && !['ABSENT', 'REJECTED'].includes(session.status)) {
                            hasTodayActiveSession = true;
                        } else if (sessionDateStr < todayDateStr && hoursSinceIn >= 24 && sessionDateStr >= thirtyDaysAgoStr) {
                            // PAST DATE missed checkout within previous 30 days
                            if (!['ABSENT', 'REJECTED'].includes(session.status)) {
                                missedDates.push(sessionDateStr);
                            }
                        }
                    }
                }

                // Also check if dailySessions for selected date has an open session
                if (!hasTodayActiveSession && Array.isArray(res?.data) && res.data.some(s => !s.time_out)) {
                    hasTodayActiveSession = true;
                }

                setGlobalActiveSession(hasTodayActiveSession);
                // Sort descending so the latest date is first (dates[0])
                const sortedMissedDates = [...new Set(missedDates)].sort((a, b) => b.localeCompare(a));
                setMissedPunchWarning(sortedMissedDates.length > 0 ? { dates: sortedMissedDates } : null);
            } else {
                const hasOpenInDaily = Array.isArray(res?.data) && res.data.some(s => !s.time_out);
                setGlobalActiveSession(Boolean(hasOpenInDaily));
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
        const endDate = getLocalDateString(new Date(year, month, 0));
        const cacheKey = `${startDate}_${endDate}`;

        if (!force && attendanceCacheData.records[cacheKey]) {
            setMonthlySessions(attendanceCacheData.records[cacheKey].data || attendanceCacheData.records[cacheKey]);
            return;
        }

        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(startDate, endDate, force);
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
            start = getLocalDateString(new Date(y, m, 1));
            end = getLocalDateString(new Date(y, m + 1, 0));
        } else if (analyticsFilterType === 'last_month') {
            const y = today.getFullYear();
            const m = today.getMonth() - 1;
            start = getLocalDateString(new Date(y, m, 1));
            end = getLocalDateString(new Date(y, m + 1, 0));
        } else if (analyticsFilterType === 'select_month') {
            if (analyticsSelectedMonth) {
                const [y, m] = analyticsSelectedMonth.split('-').map(Number);
                start = getLocalDateString(new Date(y, m - 1, 1));
                end = getLocalDateString(new Date(y, m, 0));
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
                    return {
                        id: Date.now() + i,
                        time_in: time_in_str,
                        time_out: time_out_str,
                        punch_type: 'regular',
                        checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : (Array.isArray(s.raw_checkpoints) ? s.raw_checkpoints : []),
                        status: s.status,
                        raw_session: s
                    };
                });

                // Save a frozen snapshot for original_data - never modified by form edits
                setOriginalSessions(loadedSessions.map(s => ({
                    time_in: s.time_in,
                    time_out: s.time_out,
                    checkpoints: s.checkpoints,
                    status: s.status,
                    raw_session: s.raw_session
                })));

                // Pre-populate proposed sessions with existing logged sessions so user can edit or add punches directly
                setCorrSessions(loadedSessions.map((s, idx) => ({
                    id: Date.now() + idx,
                    time_in: s.time_in || '',
                    time_out: s.time_out || '',
                    punch_type: s.punch_type || 'regular'
                })));
                setCorrIn(loadedSessions[0]?.time_in || '');
                setCorrOut(loadedSessions[loadedSessions.length - 1]?.time_out || '');

                // Smart default for corrType: Missed Punch vs Missed Day
                if (loadedSessions.length === 0) {
                    setCorrType('Missed Day');
                } else {
                    setCorrType('Missed Punch');
                }
            } else {
                setExistingRecord(null);
                setOriginalSessions([]);
                setCorrSessions([]);
                setCorrType('Missed Day');
                setCorrIn('');
                setCorrOut('');
            }
        } catch (error) {
            console.error("Failed to fetch existing record", error);
            setExistingRecord(null);
            setOriginalSessions([]);
            setCorrSessions([]);
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

    const isCheckpointAllowed = myShift?.rules?.checkpoint_requirements?.enabled !== false;
    const isCheckpointSelfieRequired = Boolean(myShift?.rules?.checkpoint_requirements?.selfie);

    const handlePunchClick = async (mode) => {
        const isSelfieRequired = mode === 'IN'
            ? (myShift?.rules?.entry_requirements?.selfie ?? true)
            : (myShift?.rules?.exit_requirements?.selfie ?? false);

        if (isSelfieRequired) {
            openCamera(mode);
        } else {
            await executeDirectPunch(mode);
        }
    };

    const handleOpenCheckpointModal = () => {
        if (!isCheckpointAllowed) {
            toast.error("Checkpoints are disabled by your assigned shift policy.");
            return;
        }
        const isSessionActive = globalActiveSession || (Array.isArray(dailySessions) && dailySessions.some(s => !s.time_out));
        if (!isSessionActive) {
            toast.warning("You must Clock IN before marking a checkpoint.");
            return;
        }
        setShowCheckpointModal(true);
        setCheckpointNote('');
        setCheckpointImgSrc(null);
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

    const handleConfirmCheckpoint = async (capturedPhoto) => {
        if (!checkpointLocation.lat || !checkpointLocation.lng) {
            toast.error("Valid GPS coordinates are required to mark a checkpoint.");
            return;
        }

        if (isCheckpointSelfieRequired && !capturedPhoto && !checkpointImgSrc) {
            toast.error("Selfie is required to mark a checkpoint.");
            return;
        }

        setIsMarkingCheckpoint(true);
        try {
            // Only attach selfie photo if selfie is enabled by shift policy
            const photoSrc = isCheckpointSelfieRequired ? (capturedPhoto || checkpointImgSrc) : null;
            let imageBlob = null;
            if (photoSrc) {
                try {
                    imageBlob = dataURLtoBlob(photoSrc);
                } catch (bErr) {
                    console.warn("Failed to convert checkpoint selfie to blob:", bErr);
                }
            }

            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const localTimeStr = `${getLocalDateString(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

            const payload = {
                latitude: checkpointLocation.lat,
                longitude: checkpointLocation.lng,
                accuracy: checkpointLocation.accuracy,
                address: checkpointLocation.address,
                note: checkpointNote.trim() || undefined,
                imageFile: imageBlob,
                image: photoSrc,
                is_geofence_violation: false,
                localTime: localTimeStr
            };

            const res = await attendanceService.markCheckpoint(payload);
            toast.success(res.message || "Checkpoint marked successfully!");
            setShowCheckpointModal(false);
            setCheckpointNote('');
            setCheckpointImgSrc(null);
            fetchDailyRecords(true);
            setTimeout(() => fetchDailyRecords(true), 2500);
            setTimeout(() => fetchDailyRecords(true), 6000);
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
                let payload = {
                    latitude,
                    longitude,
                    accuracy,
                    address: location.fullAddress || location.address
                };

                let res;
                if (mode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                setCameraMode(null);
                fetchDailyRecords(true);
                // Delayed re-fetches to pick up async geocoded address and S3 image URL
                setTimeout(() => fetchDailyRecords(true), 2500);
                setTimeout(() => fetchDailyRecords(true), 6000);
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
                        console.warn("Direct punch location fetch failed, using fallback location state", err);
                        submitDirectData(location.lat || null, location.lng || null, 10);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                submitDirectData(location.lat || null, location.lng || null, 10);
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
            ? (myShift?.rules?.entry_requirements?.selfie ?? true)
            : (myShift?.rules?.exit_requirements?.selfie ?? false);

        const isGeoRequired = cameraMode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        if (isSelfieRequired && !imgSrc) return;
        setIsSubmitting(true);

        const submitData = async (latitude, longitude, accuracy) => {
            try {
                let payload = {
                    latitude,
                    longitude,
                    accuracy,
                    address: location.fullAddress || location.address
                };
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
                    setGlobalActiveSession(true);
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                    setGlobalActiveSession(false);
                }

                closeCamera();
                fetchDailyRecords(true);
                // Delayed re-fetches to pick up async geocoded address and S3 image URL
                setTimeout(() => fetchDailyRecords(true), 2500);
                setTimeout(() => fetchDailyRecords(true), 6000);
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
                        console.warn("Selfie punch location fetch failed, using fallback location state", err);
                        submitData(location.lat || null, location.lng || null, 10);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                submitData(location.lat || null, location.lng || null, 10);
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

        // ENFORCE DYNAMIC CORRECTION DEADLINE (Bypassed / unlimited for testing)
        /*
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
        */

        // Validation for sessions (optional: only checked if user customized punches on timeline)
        let validSessions = corrSessions.filter(s => s.time_in || s.time_out);

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
            let validSessions = corrSessions.filter(s => s.time_in || s.time_out);
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
            } else {
                // Advanced custom punch timeline was not used - submit with remarks only
                proposed_data = [];
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
            const todayLocal = getLocalDateString();

            setCorrDate(todayLocal);
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);
            setPendingRequestId(null);
            setCorrType('Missed Punch');
            setCorrOtherType('');
            setShowAdvancedOptions(false);
            setCorrMethod('add_session');
            setCorrSessions([]);
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
            if (!editCorrectionReason.trim() && validSessions.length === 0) {
                toast.error("Please enter updated remarks or at least one session with a time");
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
        if (!dateString) return '';
        const parts = String(dateString).split('T')[0].split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        }
        return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (timeVal, sessionRecord = null, isOut = false) => {
        if (!timeVal) return null;
        return formatLocalTimeString(timeVal) || null;
    };

    const calculateDuration = (timeIn, timeOut) => {
        if (!timeIn || !timeOut) return null;
        const parseIso = (v) => {
            const s = String(v).trim().replace(' ', 'T').replace('Z', '');
            return new Date(s);
        };
        const start = parseIso(timeIn);
        const end = parseIso(timeOut);

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
        const parts = selectedDate.split('-');
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        date.setDate(date.getDate() - 1);
        setSelectedDate(getLocalDateString(date));
    };

    const handleNextDay = () => {
        const parts = selectedDate.split('-');
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        date.setDate(date.getDate() + 1);
        setSelectedDate(getLocalDateString(date));
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
    const todayStr = getLocalDateString(now);

    const hasRecord = (dateStr) => {
        return monthlySessions.some(s =>
            (s.time_in && s.time_in.startsWith(dateStr)) ||
            (s.check_in && s.check_in.startsWith(dateStr))
        );
    };

    for (let d = 1; d <= daysInReportMonth; d++) {
        const date = new Date(reportYear, reportMonthIdx, d);
        const dateStr = getLocalDateString(date);

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
        const todayStr = getLocalDateString();

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

        const todayStr = getLocalDateString();

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

            // Check shift timing for lateness
            let isLateByShift = false;
            const shiftStartTime = myShift?.start_time || myShift?.rules?.shift_timing?.start_time;
            const isOpenShift = myShift?.id === null || !shiftStartTime || myShift?.name?.toLowerCase().includes('open');
            const graceMinutes = Number(myShift?.rules?.grace_period?.minutes ?? myShift?.grace_period ?? 0);

            if (!isOpenShift && shiftStartTime && firstIn) {
                try {
                    const shiftParts = shiftStartTime.slice(0, 5).split(':').map(Number);
                    const shiftStartMins = shiftParts[0] * 60 + shiftParts[1];

                    let inMins = null;
                    const str = String(firstIn).trim().replace('Z', '');
                    const parts = str.split(/[- :T.]/);
                    if (parts.length >= 5) {
                        const inH = parseInt(parts[3], 10);
                        const inM = parseInt(parts[4], 10);
                        if (!isNaN(inH) && !isNaN(inM)) inMins = inH * 60 + inM;
                    } else {
                        const d = new Date(firstIn);
                        if (!isNaN(d.getTime())) inMins = d.getHours() * 60 + d.getMinutes();
                    }

                    if (inMins !== null && !isNaN(shiftStartMins)) {
                        let diff = inMins - shiftStartMins;
                        if (shiftStartMins >= 1080 && inMins < 720) {
                            diff += 1440;
                        }
                        if (diff > graceMinutes) {
                            isLateByShift = true;
                        }
                    }
                } catch (err) {
                    console.warn("Error evaluating shift lateness:", err);
                }
            }

            const hasLateSession = day.sessions.some(s =>
                Number(s.late_minutes || 0) > 0 ||
                Boolean(s.late_reason) ||
                Boolean(s.isLate) ||
                Boolean(s.is_late) ||
                (s.status && String(s.status).toUpperCase().includes('LATE'))
            );

            const isDayLate = isLateByShift || hasLateSession;

            // Derive overall day status
            let dayStatus = 'PRESENT';
            const sessionStatuses = day.sessions.map(s => (s.status || '').toUpperCase());

            if (sessionStatuses.includes('MISSED_PUNCH') || (isPastDay && hasOpenSession)) {
                dayStatus = 'MISSED_PUNCH';
            } else if (sessionStatuses.includes('ABSENT')) {
                dayStatus = 'ABSENT';
            } else if (sessionStatuses.includes('HALF_DAY')) {
                dayStatus = 'HALF_DAY';
            } else if (isDayLate) {
                dayStatus = 'LATE';
            } else if (sessionStatuses.includes('OVERTIME')) {
                dayStatus = 'OVERTIME';
            } else {
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
                isDayLate,
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
    }, [monthlySessions, myShift]);

    return (
        <DashboardLayout title="Attendance" tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="pb-10 overflow-x-hidden" style={{ zoom: 0.8 }}>
                {/* Browser Permissions Alert & Prompt Banner */}
                <div className="mb-4">
                    <AttendancePermissionsBanner
                        onPermissionsUpdated={(permStatus) => {
                            if (permStatus.location === 'granted' && (location.error || location.address === 'Location Access Denied')) {
                                fetchUserLocation();
                            }
                        }}
                    />
                </div>

                {/* Header & Command Center */}
                <AttendanceTimeLocationHeader
                    currentTime={currentTime}
                    user={user}
                    location={location}
                    isLoadingLoc={isLoadingLoc}
                    onRefreshLocation={fetchUserLocation}
                    myShift={myShift}
                    globalActiveSession={Boolean(globalActiveSession || (Array.isArray(dailySessions) && dailySessions.some(s => !s.time_out)))}
                    isCheckpointAllowed={isCheckpointAllowed}
                    onOpenCheckpointModal={isCheckpointAllowed ? handleOpenCheckpointModal : undefined}
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
                            globalActiveSession={Boolean(globalActiveSession || (Array.isArray(dailySessions) && dailySessions.some(s => !s.time_out)))}
                            isSubmitting={isSubmitting}
                            isMarkingCheckpoint={isMarkingCheckpoint}
                            cameraMode={cameraMode}
                            showCamera={showCamera}
                            handlePunchClick={handlePunchClick}
                            handleOpenCheckpointModal={handleOpenCheckpointModal}
                            isCheckpointAllowed={isCheckpointAllowed}
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
                                    setViewerImage={setViewerImage}
                                    myShift={myShift}
                                    setIsCorrectionDrawerOpen={setIsCorrectionDrawerOpen}
                                    setCorrDate={setCorrDate}
                                    loadCorrectionDataForDate={loadCorrectionDataForDate}
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
                                    setIsCorrectionDrawerOpen={setIsCorrectionDrawerOpen}
                                    setCorrDate={setCorrDate}
                                    loadCorrectionDataForDate={loadCorrectionDataForDate}
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
                                                <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text tracking-tight">Review Correction Request</h3>
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
                                                    <div className="py-2 text-center sm:text-left">
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                            No custom timeline punches specified.
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                            Request will be processed based on your stated remarks & attached proof document.
                                                        </p>
                                                    </div>
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
                                            {submitLoading ? <RefreshCw className="animate-spin" size={16} /> : "Submit Correction Request"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}


                    {/* --- Universal Image Viewer Modal (Exact Live Attendance Lightbox) --- */}
                    {viewerImage && createPortal(
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                                onClick={() => setViewerImage(null)}
                            >
                                <button
                                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                                    onClick={() => setViewerImage(null)}
                                >
                                    <XCircle size={32} />
                                </button>
                                <motion.img
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    src={typeof viewerImage === 'string' ? viewerImage : (viewerImage?.url || viewerImage)}
                                    alt="Selfie Preview"
                                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </motion.div>
                        </AnimatePresence>,
                        document.body
                    )}

                    {/* --- CHECKPOINT MARKING MODAL --- */}
                    <CheckpointModal
                        isOpen={showCheckpointModal}
                        showCheckpointModal={showCheckpointModal}
                        onClose={() => !isMarkingCheckpoint && setShowCheckpointModal(false)}
                        setShowCheckpointModal={setShowCheckpointModal}
                        isMarkingCheckpoint={isMarkingCheckpoint}
                        checkpointLocation={checkpointLocation}
                        onRetryLocation={handleOpenCheckpointModal}
                        handleOpenCheckpointModal={handleOpenCheckpointModal}
                        checkpointNote={checkpointNote}
                        setCheckpointNote={setCheckpointNote}
                        onConfirm={handleConfirmCheckpoint}
                        handleConfirmCheckpoint={handleConfirmCheckpoint}
                        checkpointImgSrc={checkpointImgSrc}
                        setCheckpointImgSrc={setCheckpointImgSrc}
                        isSelfieRequired={isCheckpointSelfieRequired}
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
                                                        <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/40">
                                                            Request Correction
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
                                                            { label: 'Missed Punch', value: 'Missed Punch' },
                                                            { label: 'Missed Day', value: 'Missed Day' },
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
                                            <div className="p-4 bg-slate-50/60 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-2xl space-y-3.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <History size={15} className="text-slate-400" />
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                            Originally Logged on {formatCorrectionDate(corrDate)}
                                                        </span>
                                                    </div>
                                                    {originalSessions.length === 0 ? (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                                                            No Punches Recorded
                                                        </span>
                                                    ) : originalSessions.some(s => s.time_in && !s.time_out) ? (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Active Session
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                                            {originalSessions.length} Session{originalSessions.length > 1 ? 's' : ''} Recorded
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Text Stating Each Session and Checkpoints */}
                                                {originalSessions.length > 0 ? (
                                                    <div className="space-y-2 pt-0.5">
                                                        {originalSessions.map((s, idx) => {
                                                            const isActive = Boolean(s.time_in && !s.time_out);
                                                            const checkpointsList = Array.isArray(s.checkpoints) ? s.checkpoints : [];
                                                            return (
                                                                <div key={idx} className="bg-white dark:bg-github-dark-subtle/80 p-3 rounded-xl border border-slate-200/70 dark:border-github-dark-border/60 space-y-2">
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
                                                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                                                Session #{idx + 1}
                                                                            </span>
                                                                            {isActive && (
                                                                                <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                                                                                    In Progress
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 font-mono text-xs">
                                                                            <span className={s.time_in ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400"}>
                                                                                {s.time_in ? formatTime(`2000-01-01T${s.time_in}:00`) : 'Missing In'}
                                                                            </span>
                                                                            <span className="text-slate-400">→</span>
                                                                            <span className={s.time_out ? "text-rose-600 dark:text-rose-400 font-medium" : "text-amber-500 dark:text-amber-400 italic"}>
                                                                                {s.time_out ? formatTime(`2000-01-01T${s.time_out}:00`) : 'Not Clocked Out'}
                                                                            </span>
                                                                            {s.time_in && s.time_out && (
                                                                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-github-dark-bg px-2 py-0.5 rounded-md ml-1">
                                                                                    {calculateSessionDurationHours(s.time_in, s.time_out).toFixed(1)} hrs
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Checkpoints shown compactly without taking much space */}
                                                                    {checkpointsList.length > 0 && (
                                                                        <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/60">
                                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                                <MapPin size={12} className="text-amber-500 shrink-0" />
                                                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                                    Checkpoints ({checkpointsList.length})
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {checkpointsList.map((chk, cIdx) => {
                                                                                    const selfieUrl = chk.image_url || chk.image;
                                                                                    const chkTime = chk.punch_time ? (formatTime ? formatTime(chk.punch_time, null, false) : formatLocalTimeString(chk.punch_time)) : (chk.time || `Point #${cIdx + 1}`);
                                                                                    const locLabel = chk.address ? chk.address.split(',')[0] : (chk.lat && chk.lng ? `${Number(chk.lat).toFixed(2)}, ${Number(chk.lng).toFixed(2)}` : null);
                                                                                    return (
                                                                                        <div
                                                                                            key={chk.id || cIdx}
                                                                                            onClick={() => selfieUrl && setPreviewImage(selfieUrl)}
                                                                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/40 ${selfieUrl ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40' : ''}`}
                                                                                            title={chk.address || (selfieUrl ? 'Click to view photo' : undefined)}
                                                                                        >
                                                                                            {selfieUrl ? (
                                                                                                <Camera size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                                                            ) : (
                                                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                                            )}
                                                                                            <span className="font-medium">#{cIdx + 1}</span>
                                                                                            <span className="font-mono text-[10px] text-amber-700/80 dark:text-amber-400/80">{chkTime}</span>
                                                                                            {locLabel && (
                                                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[110px] truncate">
                                                                                                    • {locLabel}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 dark:text-slate-400 font-normal py-0.5">
                                                        No mobile or biometric punches found for this date. Enter your requested session times below.
                                                    </p>
                                                )}

                                                {/* Auto-fill actions */}
                                                {(originalSessions.some(s => s.time_in && !s.time_out) || originalSessions.length > 0) && (
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
                                                )}
                                            </div>

                                            {/* Reason Field */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                    Reason <span className="text-rose-500 font-bold">*</span>
                                                </label>

                                                {/* Text Box with Attach Icon on the Right */}
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
                                                    className={`relative flex items-center gap-2.5 bg-white dark:bg-dark-card border rounded-xl px-3 py-2 min-h-[44px] shadow-2xs transition-all ${
                                                        isDraggingFile
                                                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/30'
                                                            : 'border-slate-200 dark:border-github-dark-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500'
                                                    }`}
                                                >
                                                    {/* Textarea */}
                                                    <textarea
                                                        data-tour-id="att-correction-reason"
                                                        value={corrReason}
                                                        onChange={(e) => setCorrReason(e.target.value)}
                                                        onInput={(e) => {
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                        }}
                                                        placeholder="Write your message or reason for adjustment..."
                                                        rows={1}
                                                        className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none resize-none min-h-[22px] max-h-32 py-0 px-0 leading-5"
                                                        required
                                                    />

                                                    <input
                                                        ref={corrFileInputRef}
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
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

                                                    {/* Attach Button (Right Aligned) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => corrFileInputRef.current?.click()}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                                                        title="Attach document, doctor's slip, or proof file"
                                                    >
                                                        <Paperclip size={18} />
                                                    </button>
                                                </div>

                                                {/* Attached File Preview Chip / Existing Attachment */}
                                                {(corrAttachment || existingAttachmentUrl) && (
                                                    <div className="space-y-2">
                                                        {corrAttachment && (
                                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/80 dark:border-github-dark-border text-xs">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    {corrAttachmentPreview ? (
                                                                        <img
                                                                            src={corrAttachmentPreview}
                                                                            alt="Attachment Preview"
                                                                            className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-github-dark-border cursor-pointer hover:opacity-80 transition-opacity"
                                                                            onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                            title="Click to view full image"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                                            <FileText size={18} />
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-[300px]">
                                                                            {corrAttachment.name}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">
                                                                            {(corrAttachment.size / 1024).toFixed(1)} KB • Document
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {corrAttachmentPreview && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-github-dark-border text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                                                            title="Preview file"
                                                                        >
                                                                            <Eye size={14} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setCorrAttachment(null);
                                                                            setCorrAttachmentPreview(null);
                                                                        }}
                                                                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors cursor-pointer"
                                                                        title="Remove file"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {existingAttachmentUrl && !corrAttachment && (
                                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/80 dark:border-github-dark-border text-xs">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Paperclip size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">Existing attached proof</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewImage(existingAttachmentUrl)}
                                                                        className="text-xs font-semibold underline text-indigo-600 dark:text-indigo-400 hover:opacity-80 flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <Eye size={12} /> View
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExistingAttachmentUrl(null)}
                                                                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                                                        title="Remove existing file"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Advanced: Custom Punch Timeline (Collapsible Accordion) */}
                                            <div className="border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-github-dark-bg/30 transition-all">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAdvancedOptions(prev => !prev)}
                                                    className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-github-dark-bg/60 transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                            <Clock size={15} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                                Advanced
                                                            </span>
                                                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-github-dark-border text-slate-600 dark:text-slate-300">
                                                                Optional
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {corrSessions.filter(s => s.time_in || s.time_out).length > 0 ? (
                                                            <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                                                                {totalProposedHours.toFixed(2)} hrs
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-github-dark-bg px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-github-dark-border/60">
                                                                Not Set (Optional)
                                                            </span>
                                                        )}
                                                        <div className={`transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : 'rotate-0'}`}>
                                                            <ChevronDown size={18} className="text-slate-400" />
                                                        </div>
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {showAdvancedOptions && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden border-t border-slate-200 dark:border-github-dark-border p-4 sm:p-5 space-y-4 bg-white dark:bg-github-dark-subtle/50"
                                                        >
                                                            {/* Quick helper actions if applicable */}
                                                            {(originalSessions.some(s => s.time_in && !s.time_out) || originalSessions.length > 0) && (
                                                                <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100 dark:border-github-dark-border/60">
                                                                    {originalSessions.some(s => s.time_in && !s.time_out) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleAutoFillMissingOut}
                                                                            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/40 text-xs font-normal transition-all flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            <Sparkles size={13} /> Auto-fill Missing Out
                                                                        </button>
                                                                    )}
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
                                                            )}

                                                            {/* Interactive Visual Timeline Only */}
                                                            <VisualCorrectionTimeline
                                                                requestData={{
                                                                    original_data: originalSessions,
                                                                    proposed_data: corrSessions.filter(s => s.time_in || s.time_out),
                                                                    correction_type: corrType,
                                                                    status: 'draft'
                                                                }}
                                                                editable={true}
                                                                shift={myShift}
                                                                frameless={true}
                                                                hideHeader={true}
                                                                onSessionsChange={(updated) => {
                                                                    setCorrSessions(updated.map((s, idx) => ({
                                                                        id: `session-${idx}-${s.time_in || s.time_out}`,
                                                                        time_in: s.time_in || '',
                                                                        time_out: s.time_out || '',
                                                                        punch_type: s.punch_type || 'regular'
                                                                    })));
                                                                }}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </form>
                                    </div>

                                    {/* Drawer Footer */}
                                    <div className="px-6 py-5 sm:px-8 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/70 dark:bg-github-dark-bg/80 space-y-3">
                                        <div className="flex items-center justify-between text-xs px-1">
                                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                                                Adjusted Work Time:
                                            </span>
                                            {corrSessions.filter(s => s.time_in || s.time_out).length > 0 ? (
                                                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 text-sm">
                                                    {totalProposedHours.toFixed(2)} hrs ({corrSessions.filter(s => s.time_in || s.time_out).length} session{corrSessions.filter(s => s.time_in || s.time_out).length !== 1 ? 's' : ''})
                                                </span>
                                            ) : (
                                                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                                                    Optional (Per Remarks)
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="submit"
                                            form="correction-form"
                                            data-tour-id="att-correction-submit-btn"
                                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Plus size={18} strokeWidth={2.5} />
                                            {pendingRequestId ? `Review & Update Request (#${pendingRequestId})` : 'Request Correction'}
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
                    {previewImage && (() => {
                        const isDoc = typeof previewImage === 'string' && /\.(pdf|docx?|xlsx?|pptx?|csv|txt)/i.test(previewImage.split('?')[0]);
                        if (isDoc) {
                            return (
                                <CorrectionDocumentModal
                                    previewUrl={previewImage}
                                    onClose={() => setPreviewImage(null)}
                                />
                            );
                        }
                        return createPortal(
                            <AnimatePresence>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                                    onClick={() => setPreviewImage(null)}
                                >
                                    <button
                                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                                        onClick={() => setPreviewImage(null)}
                                    >
                                        <XCircle size={32} />
                                    </button>
                                    <motion.img
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        src={typeof previewImage === 'string' ? previewImage : (previewImage?.url || previewImage)}
                                        alt="Selfie Preview"
                                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </motion.div>
                            </AnimatePresence>,
                            document.body
                        );
                    })()}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Attendance;
