import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    MapPin,
    Clock,
    Camera,
    History,
    Calendar,
    AlertCircle,
    X,
    CheckCircle,
    RefreshCw,
    Download,
    ChevronRight,
    FileText,
    User,
    ArrowRight,
    LogOut,
    Plus,
    Minus,
    Paperclip,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Navigation,
    Scan,
    XCircle,
    Image as ImageIcon,
    Eye,
    FileClock,
    FileSpreadsheet,
    FileType,
    DownloadCloud,
    Table,
    ChevronDown,
    ExternalLink
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { getLocalDateString } from '../../utils/dateUtils';
import { toast } from 'react-toastify';
import MobileDatePicker from '../../components/MobileDatePicker';
import AttendancePermissionsBanner from './components/AttendancePermissionsBanner';
import CheckpointModal from './components/CheckpointModal';
import { requestCameraAccess } from '../../utils/permissionUtils';
import MonthPicker from '../../components/MonthPicker';
import VisualCorrectionTimeline from '../../components/attendance/VisualCorrectionTimeline';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

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

const MobileAttendancePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const SUB_TABS = [
        { id: 'history', label: 'History', icon: History },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'corrections', label: 'Corrections', icon: FileClock }
    ];

    // --- STATE ---
    const [mainTab, setMainTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'mark_attendance') return 'attendance';
        return tab || 'attendance';
    });
    const [subTab, setSubTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const sTab = params.get('subTab');
        if (sTab === 'correction') return 'corrections';
        return sTab || 'history';
    });
    const [correctionFilter, setCorrectionFilter] = useState('pending'); // 'pending', 'history'
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const sTab = params.get('subTab');
        if (tab) {
            setMainTab(tab === 'mark_attendance' ? 'attendance' : tab);
        }
        if (sTab) {
            setSubTab(sTab === 'correction' ? 'corrections' : sTab);
        }
    }, [window.location.search]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: {
                tab: mainTab === 'attendance' ? 'mark_attendance' : 'my_attendance',
                subTab: subTab === 'corrections' ? 'correction' : subTab
            }
        }));
    }, [mainTab, subTab]);

    const mainTabs = ['attendance', 'my_attendance'];
    const currentMainIndex = mainTabs.indexOf(mainTab);

    const subTabs = ['history', 'analytics', 'corrections'];
    const currentSubIndex = subTabs.indexOf(subTab);

    // Correction Form State
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
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

    const [correctionForm, setCorrectionForm] = useState({
        type: 'Missed Punch',
        date: getLocalDateString(),
        in_time: '',
        out_time: '',
        reason: '',
        document: null
    });

    const [originalSessions, setOriginalSessions] = useState([]);
    const [showMobileAdvanced, setShowMobileAdvanced] = useState(false);


    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const [imgSrc, setImgSrc] = useState(null);
    const webcamRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [isRequestingCam, setIsRequestingCam] = useState(false);

    const handleRequestCamera = async () => {
        setIsRequestingCam(true);
        setCameraError(null);
        const res = await requestCameraAccess();
        setIsRequestingCam(false);
        if (!res.success) {
            setCameraError(res.message);
        } else {
            setCameraError(null);
        }
    };

    // Late Reason
    const [requireLateReason, setRequireLateReason] = useState(false);
    const [lateReasonMessage, setLateReasonMessage] = useState('');
    const [lateReasonText, setLateReasonText] = useState('');

    // Checkpoint State
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

    // Data
    const [dailySessions, setDailySessions] = useState([]);
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
    const [correctionHistory, setCorrectionHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [fileFormat, setFileFormat] = useState('xlsx');
    const [myShift, setMyShift] = useState(() => {
        // Handle both response structure { ok, shift } and direct shift object
        const cached = attendanceCacheData.shiftPolicy;
        if (cached?.shift) return cached.shift;
        if (cached?.id || cached?.name) return cached; // If it's already a shift object
        return null;
    });



    // Dates
    const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

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
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [scrollerDates, setScrollerDates] = useState([]);

    const refreshMyShiftPolicy = useCallback(async (force = true) => {
        try {
            const data = await attendanceService.getMyShiftPolicy(force);
            if (data?.success || data?.ok || data?.shift) {
                setMyShift(data.shift || data);
            }
        } catch (err) {
            console.error("Failed to refresh mobile shift policy:", err);
        }
    }, []);

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

    // --- FETCHING ---

    const fetchDailyRecords = async (force = false) => {
        if (force) {
            refreshMyShiftPolicy(true);
        }
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate, force);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setDailySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to fetch daily records", error);
        }
    };

    const fetchMonthlyRecords = async (force = false) => {
        if (!reportMonth) return;
        const [year, month] = reportMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = getLocalDateString(new Date(year, month, 0));
        const cacheKey = `${startDate}_${endDate}`;

        if (!force && attendanceCacheData.records[cacheKey]) {
            const records = attendanceCacheData.records[cacheKey].data || attendanceCacheData.records[cacheKey] || [];
            setMonthlySessions(Array.isArray(records) ? records : []);
            return;
        }

        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(startDate, endDate, force);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setMonthlySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalyticsRecords = useCallback(async (force = false) => {
        if (!force && (mainTab !== 'my_attendance' || subTab !== 'analytics')) return;

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
                const records = attendanceCacheData.records[cacheKey].data || attendanceCacheData.records[cacheKey] || [];
                setAnalyticsSessions(Array.isArray(records) ? records : []);
                return;
            }

            setAnalyticsLoading(true);
            try {
                const res = await attendanceService.getMyRecords(start, end);
                if (res.ok || res.data) {
                    const records = res.data || res || [];
                    setAnalyticsSessions(Array.isArray(records) ? records : []);
                }
            } catch (error) {
                console.error("Failed to fetch analytics records", error);
                toast.error("Failed to fetch analytics data");
            } finally {
                setAnalyticsLoading(false);
            }
        }
    }, [mainTab, subTab, analyticsFilterType, analyticsSelectedMonth, analyticsStartDate, analyticsEndDate]);


    const fetchCorrectionHistory = async (force = false) => {
        const cacheKey = JSON.stringify({});
        if (!force && attendanceCacheData.correctionRequests[cacheKey]) {
            setCorrectionHistory(attendanceCacheData.correctionRequests[cacheKey].data || attendanceCacheData.correctionRequests[cacheKey] || []);
            return;
        }

        try {
            const res = await attendanceService.getCorrectionRequests({ my_requests: 'true' });
            setCorrectionHistory(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    // --- EFFECTS ---

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        let watchId;
        const startWatch = (highAccuracy = true) => {
            if (!navigator.geolocation) return;
            setIsLoadingLoc(true);
            watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                        const data = await res.json();
                        setLocation({
                            lat: latitude,
                            lng: longitude,
                            address: data.display_name?.split(',')[0] || 'Unknown Location',
                            error: null
                        });
                    } catch (err) {
                        setLocation({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, error: null });
                    } finally {
                        setIsLoadingLoc(false);
                    }
                },
                (err) => {
                    console.warn(`watchPosition (highAccuracy=${highAccuracy}) failed in MobileAttendancePage.jsx:`, err);
                    if (highAccuracy && (err.code === 3 || err.code === 1)) {
                        if (watchId) navigator.geolocation.clearWatch(watchId);
                        startWatch(false);
                    } else {
                        setLocation(prev => ({ ...prev, error: err.message, address: 'Location Access Denied' }));
                        setIsLoadingLoc(false);
                    }
                },
                { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 30000 }
            );
        };

        startWatch(true);

        fetchDailyRecords();
        fetchMonthlyRecords();
        fetchAnalyticsRecords(true);
        fetchCorrectionHistory();

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    useEffect(() => {
        fetchAnalyticsRecords();
    }, [fetchAnalyticsRecords]);

    useEffect(() => {
        // Auto-scroll to selected date in the scroller
        const element = document.getElementById("selected-date-btn");
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedDate, scrollerDates]);

    useEffect(() => {
        fetchDailyRecords();
    }, [selectedDate]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [reportMonth]);

    useEffect(() => {
        if (!correctionForm.date) {
            setOriginalSessions([]);
            return;
        }

        const fetchRecord = async () => {
            try {
                const res = await attendanceService.getMyRecords(correctionForm.date, correctionForm.date);
                if (res?.data && res.data.length > 0) {
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
                        return { in: time_in_str, out: time_out_str, isExisting: true };
                    });

                    setOriginalSessions(loadedSessions.map(s => ({ time_in: s.in, time_out: s.out })));
                    setCorrectionForm(prev => ({
                        ...prev,
                        sessions: []
                    }));
                } else {
                    setOriginalSessions([]);
                    setCorrectionForm(prev => ({
                        ...prev,
                        sessions: []
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch existing record", error);
                setOriginalSessions([]);
                setCorrectionForm(prev => ({
                    ...prev,
                    sessions: []
                }));
            }
        };

        fetchRecord();
    }, [correctionForm.date]);

    // --- ACTIONS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setShowCamera(true);
        setImgSrc(null);
        setRequireLateReason(false);
        setLateReasonMessage('');
        setLateReasonText('');
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
        if (!hasActiveSession) {
            toast.warning("You must Clock IN before marking a checkpoint.");
            return;
        }
        setShowCheckpointModal(true);
        setCheckpointNote('');
        setCheckpointImgSrc(null);
        setCheckpointLocation({ lat: null, lng: null, accuracy: null, address: '', error: null, loading: true });

        if (!navigator.geolocation) {
            setCheckpointLocation(prev => ({ ...prev, loading: false, error: "Geolocation not supported." }));
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
                    } catch (_) {}

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

    const dataURLtoBlob = (dataurl) => {
        try {
            let arr = dataurl.split(',');
            let mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            let bstr = atob(arr[1]);
            let n = bstr.length;
            let u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            console.warn("Failed dataURLtoBlob conversion:", e);
            return null;
        }
    };

    const handleConfirmCheckpoint = async (capturedPhoto) => {
        if (!checkpointLocation.lat || !checkpointLocation.lng) {
            toast.error("Valid GPS coordinates are required.");
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

            const payload = {
                latitude: checkpointLocation.lat,
                longitude: checkpointLocation.lng,
                accuracy: checkpointLocation.accuracy,
                address: checkpointLocation.address,
                note: checkpointNote.trim() || undefined,
                imageFile: imageBlob,
                image: photoSrc,
                is_geofence_violation: false
            };

            const res = await attendanceService.markCheckpoint(payload);
            toast.success(res.message || "Checkpoint marked successfully!");
            setShowCheckpointModal(false);
            setCheckpointNote('');
            setCheckpointImgSrc(null);
            await fetchDailyRecords(true);
            await fetchMonthlyRecords(true);
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
        const isGeoRequired = mode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        if (isGeoRequired && !location.lat) {
            toast.error("Location not found");
            return;
        }

        setIsSubmitting(true);
        setCameraMode(mode);
        try {
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.lat ? 10 : null,
                address: location.address || null
            };

            if (requireLateReason && lateReasonText.trim()) {
                payload.late_reason = lateReasonText.trim();
            }

            if (mode === 'IN') {
                await attendanceService.timeIn(payload);
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                toast.success("Checked Out Successfully!");
            }

            closeCamera();

            try {
                await fetchDailyRecords(true);
                await fetchMonthlyRecords(true);
                // Delayed re-fetches to pick up async geocoded address and S3 image URL
                setTimeout(() => fetchDailyRecords(true), 2500);
                setTimeout(() => fetchDailyRecords(true), 6000);
            } catch (refErr) {
                console.error("Failed to refresh records after punch:", refErr);
            }
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
                closeCamera();
                toast.error(errorMsg);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeCamera = () => {
        setShowCamera(false);
        setImgSrc(null);
        setCameraMode(null);
        setCameraError(null);
        setRequireLateReason(false);
        setLateReasonMessage('');
        setLateReasonText('');
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const confirmAttendance = async () => {
        const isSelfieRequired = cameraMode === 'IN'
            ? (myShift?.rules?.entry_requirements?.selfie ?? false)
            : (myShift?.rules?.exit_requirements?.selfie ?? false);

        const isGeoRequired = cameraMode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        if (isSelfieRequired && !imgSrc) return;
        if (isGeoRequired && !location.lat) {
            toast.error("Location not found");
            return;
        }

        if (requireLateReason && !lateReasonText.trim()) {
            toast.warning("Please provide a reason for being late");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.lat ? 10 : null,
                address: location.address || null
            };
            if (imgSrc) {
                const imageBlob = dataURLtoBlob(imgSrc);
                payload.imageFile = imageBlob;
            }

            if (requireLateReason && lateReasonText.trim()) {
                payload.late_reason = lateReasonText.trim();
            }

            if (cameraMode === 'IN') {
                await attendanceService.timeIn(payload);
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                toast.success("Checked Out Successfully!");
            }

            closeCamera();

            try {
                await fetchDailyRecords(true);
                await fetchMonthlyRecords(true);
                // Delayed re-fetches to pick up async geocoded address and S3 image URL
                setTimeout(() => fetchDailyRecords(true), 2500);
                setTimeout(() => fetchDailyRecords(true), 6000);
            } catch (refErr) {
                console.error("Failed to refresh records after punch:", refErr);
            }
        } catch (error) {
            console.error(error);
            const errorMsg = error.message || "Attendance failed";
            const errorLower = errorMsg.toLowerCase();

            if (cameraMode === 'IN' && errorLower.includes("late") && errorLower.includes("reason")) {
                setRequireLateReason(true);
                setLateReasonMessage(errorMsg);
                toast.warning(errorMsg);
            } else {
                closeCamera();
                toast.error(errorMsg);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadReport = async () => {
        if (!reportMonth) return;
        setIsDownloading(true);
        const toastId = toast.loading("Starting report compilation...");
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
                                link.setAttribute('download', `Attendance_Report_${reportMonth}.${fileFormat}`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                toast.update(toastId, { render: "Report compiled and downloaded successfully!", type: "success", isLoading: false, autoClose: 3000 });
                                setIsDownloading(false);
                            } else if (status === 'failed') {
                                clearInterval(pollInterval);
                                toast.update(toastId, { render: `Generation failed: ${error_message || 'Unknown error'}`, type: "error", isLoading: false, autoClose: 4000 });
                                setIsDownloading(false);
                            }
                        }
                    } catch (pollErr) {
                        console.error("Error polling report status:", pollErr);
                    }
                }, 2000);

                // Safe fallback to prevent infinite polling loop in case anything hangs
                setTimeout(() => {
                    clearInterval(pollInterval);
                    setIsDownloading(false);
                }, 60000); // 1 minute max timeout
            } else {
                toast.update(toastId, { render: "Failed to queue report.", type: "error", isLoading: false, autoClose: 3000 });
                setIsDownloading(false);
            }
        } catch (error) {
            console.error("Download failed", error);
            toast.update(toastId, { render: error.message || "Failed to download your report", type: "error", isLoading: false, autoClose: 3000 });
            setIsDownloading(false);
        }
    };

    const handleCorrectionSubmit = async () => {
        if (!correctionForm.reason) {
            toast.error("Reason is required");
            return;
        }
        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmitMobile = async () => {
        setSubmitLoading(true);
        try {
            const original_data = originalSessions;
            let proposed_data = [];
            if (validSessions.length > 0) {
                proposed_data = validSessions.map(s => {
                    const isOvernight = Boolean(s.in && s.out && s.in >= s.out);
                    return {
                        time_in: s.in,
                        time_out: s.out,
                        is_overnight: isOvernight
                    };
                });
            } else {
                proposed_data = [];
            }

            const payload = {
                request_date: correctionForm.date,
                correction_type: correctionForm.type || 'Correction',
                reason: correctionForm.reason,
                original_data,
                proposed_data
            };

            await attendanceService.submitCorrectionRequest(payload);
            toast.success("Adjustment request submitted successfully!");
            setShowConfirmSubmit(false);
            setIsCorrectionOpen(false);
            setShowMobileAdvanced(false);
            setCorrectionForm({ ...correctionForm, sessions: [{ in: '', out: '' }], reason: '' });
            fetchCorrectionHistory();
        } catch (error) {
            console.error("Correction submit failed", error);
            toast.error(error.message || "Failed to submit correction");
        } finally {
            setSubmitLoading(false);
        }
    };


    const handleRequestClick = async (item) => {
        if (isFetchingDetails) return;
        try {
            setIsFetchingDetails(true);
            const requestId = item.acr_id || item.request_id || item.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            setSelectedRequest({ ...item, ...(res.data || res) });
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            setSelectedRequest(item);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const addSession = () => {
        setCorrectionForm({
            ...correctionForm,
            sessions: [...correctionForm.sessions, { in: '', out: '' }]
        });
    };

    const removeSession = (index) => {
        if (correctionForm.sessions.length > 1) {
            const newSessions = [...correctionForm.sessions];
            newSessions.splice(index, 1);
            setCorrectionForm({ ...correctionForm, sessions: newSessions });
        }
    };

    const updateSession = (index, field, value) => {
        const newSessions = [...correctionForm.sessions];
        newSessions[index][field] = value;
        setCorrectionForm({ ...correctionForm, sessions: newSessions });
    };

    const handleMainTabChange = (newTab) => {
        const newIndex = mainTabs.indexOf(newTab);
        setDirection(newIndex > currentMainIndex ? 1 : -1);
        setMainTab(newTab);
    };

    const handleSubTabChange = (newTab) => {
        const newIndex = subTabs.indexOf(newTab);
        setDirection(newIndex > currentSubIndex ? 1 : -1);
        setSubTab(newTab);
    };



    const handleSwipe = (swipeDir) => {
        if (mainTab === 'attendance') {
            if (swipeDir === 'left' && currentMainIndex < mainTabs.length - 1) {
                setDirection(1);
                setMainTab(mainTabs[currentMainIndex + 1]);
            }
        } else {
            // In my_attendance, swipe subtabs
            if (swipeDir === 'left') {
                if (currentSubIndex < subTabs.length - 1) {
                    setDirection(1);
                    setSubTab(subTabs[currentSubIndex + 1]);
                }
            } else if (swipeDir === 'right') {
                if (currentSubIndex > 0) {
                    setDirection(-1);
                    setSubTab(subTabs[currentSubIndex - 1]);
                } else {
                    // At the first subtab, swipe back to main attendance
                    setDirection(-1);
                    setMainTab('attendance');
                }
            }
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

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime) return '0h 0m';
        const start = new Date(inTime);
        const end = new Date(outTime);
        const diffMs = end - start;
        if (diffMs < 0) return '0h 0m';
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.round((diffMs % 3600000) / 60000);
        return `${diffHrs}h ${diffMins}m`;
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

    // Analytics Calcs
    const {
        presentCount,
        lateCount,
        totalHours,
        attendanceTrendData,
        weeklyActivityData,
        statusPieData,
        avgHours,
        presentPercentage,
        latePercentage,
        underHoursCount,
        totalRecords
    } = useMemo(() => {
        const total = analyticsSessions.length;
        let present = 0;
        let late = 0;
        let hrs = 0;
        const trend = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const wStats = { Sun: { hrs: 0, count: 0 }, Mon: { hrs: 0, count: 0 }, Tue: { hrs: 0, count: 0 }, Wed: { hrs: 0, count: 0 }, Thu: { hrs: 0, count: 0 }, Fri: { hrs: 0, count: 0 }, Sat: { hrs: 0, count: 0 } };

        analyticsSessions.forEach(session => {
            const h = getSessionHours(session);
            hrs += h;
            if (session.status !== 'ABSENT') {
                present++;
                if (session.late_minutes > 0) late++;
            }

            const dateString = session.time_in || session.date || session.shift_date;
            const d = dateString ? new Date(dateString) : null;

            if (d && !isNaN(d)) {
                const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                trend.push({ date: label, hours: h, rawDate: d });
                const dayName = days[d.getDay()];
                if (wStats[dayName]) {
                    wStats[dayName].hrs += h;
                    wStats[dayName].count += 1;
                }
            }
        });

        trend.sort((a, b) => a.rawDate - b.rawDate);

        const wActData = days.map(day => ({
            day,
            hours: wStats[day].count > 0 ? (wStats[day].hrs / wStats[day].count).toFixed(1) : 0
        }));

        const pie = [
            { name: 'On Time', value: present - late, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' }
        ].filter(d => d.value > 0);

        const avg = total > 0 ? (hrs / total).toFixed(1) : '0.0';
        const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
        const latePct = present > 0 ? Math.round((late / present) * 100) : 0;

        let underHours = 0;
        analyticsSessions.forEach(session => {
            const h = getSessionHours(session);
            if (session.status !== 'ABSENT' && h > 0 && h < 8) underHours++;
        });

        return {
            presentCount: present,
            lateCount: late,
            totalHours: hrs,
            attendanceTrendData: trend,
            weeklyActivityData: wActData,
            statusPieData: pie,
            avgHours: avg,
            presentPercentage: presentPct,
            latePercentage: latePct,
            underHoursCount: underHours,
            totalRecords: total
        };
    }, [analyticsSessions]);

    const filteredCorrections = correctionHistory.filter(item => {
        const status = (item.status || 'PENDING').toUpperCase();
        if (correctionFilter === 'pending') return status === 'PENDING';
        return status !== 'PENDING';
    });

    // --- DAY-LEVEL HISTORY AGGREGATION ---
    const groupedHistoryDays = useMemo(() => {
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

        const processed = Object.values(daysMap).map(day => {
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

        processed.sort((a, b) => b.date - a.date);
        return processed;
    }, [monthlySessions]);

    const hasActiveSession = dailySessions.some(s => !s.time_out);

    return (
        <MobileDashboardLayout title="Attendance">
            <div className="pb-24" style={{ zoom: 0.8 }}>
                {/* Premium Header / Greeting */}
                <div className="px-5 pt-8 pb-12 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-[#0a0d14] dark:via-[#0e1320] dark:to-[#0a0d14] rounded-b-[2.5rem] border-b border-indigo-500/20 shadow-xl relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/10 blur-3xl rounded-full"
                    />

                    <div className="relative z-10 space-y-4">
                        <AttendancePermissionsBanner
                            onPermissionsUpdated={(permStatus) => {
                                if (permStatus.location === 'granted' && (location.error || location.address?.includes('Denied'))) {
                                    fetchUserLocation();
                                }
                            }}
                        />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.user_name?.split(' ')[0] || 'User'}!
                                </h1>
                                <p className="text-indigo-200/80 text-sm font-medium mt-1">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>

                        </div>

                        {/* Current Time Widget */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-500/30 rounded-2xl flex items-center justify-center text-white">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-indigo-200 tracking-widest">Current Time</span>
                                    <span className="text-2xl font-black text-white font-mono">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-bold text-indigo-200 tracking-widest mb-1">Location</span>
                                <div className="flex items-center gap-1.5 text-white/90 font-bold text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                    <MapPin size={12} className="text-indigo-300" />
                                    {isLoadingLoc ? 'Locating...' : location.address}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher - Floating Style - Standardized */}
                <div className="px-5 -mt-6 relative z-20">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5 shadow-xl">
                        <button
                            onClick={() => handleMainTabChange('attendance')}
                            className={`flex-1 py-2.5 text-[11px] font-normal rounded-xl transition-all flex items-center justify-center gap-2 ${
                                mainTab === 'attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <User size={14} />
                            Attendance
                        </button>
                        <button
                            onClick={() => handleMainTabChange('my_attendance')}
                            className={`flex-1 py-2.5 text-[11px] font-normal rounded-xl transition-all flex items-center justify-center gap-2 ${
                                mainTab === 'my_attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <History size={14} />
                            My Attendance
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="px-5 pt-8">
                    <AnimatePresence mode="wait">
                        {mainTab === 'attendance' ? (
                            <motion.div
                                key="attendance-tab"
                                custom={direction}
                                variants={{
                                    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
                                    center: { x: 0, opacity: 1 },
                                    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0, position: 'absolute', width: 'calc(100% - 40px)' })
                                }}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                className="space-y-6"
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={(e, info) => {
                                    if (info.offset.x < -80) handleSwipe('left');
                                    else if (info.offset.x > 80) handleSwipe('right');
                                }}
                            >
                                {/* Punch Cards - Redesigned to match image */}
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={() => !hasActiveSession && !isSubmitting && handlePunchClick('IN')}
                                        disabled={hasActiveSession || isSubmitting}
                                        className={`group relative p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-lg dark:shadow-2xl active:scale-[0.98]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                                hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                                            }`}>
                                                <ArrowRight size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-base font-bold tracking-tight ${hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {isSubmitting && cameraMode === 'IN' && !showCamera ? 'Processing...' : 'Time In'}
                                                </h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
                                                    {hasActiveSession ? 'Session active' : 'Start shift for today'}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Mark Checkpoint Button */}
                                    {isCheckpointAllowed && (
                                        <button
                                            onClick={() => hasActiveSession && !isSubmitting && !isMarkingCheckpoint && handleOpenCheckpointModal()}
                                            disabled={!hasActiveSession || isSubmitting || isMarkingCheckpoint}
                                            className={`group relative p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                                !hasActiveSession
                                                    ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                    : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-lg dark:shadow-2xl active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative ${
                                                    !hasActiveSession 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                                                }`}>
                                                    <MapPin size={22} strokeWidth={2.5} className={hasActiveSession ? 'animate-bounce' : ''} />
                                                    {hasActiveSession && (
                                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <h3 className={`text-base font-bold tracking-tight ${!hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                        {isMarkingCheckpoint ? 'Marking...' : 'Mark Checkpoint'}
                                                    </h3>
                                                    <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
                                                        {!hasActiveSession ? 'Requires active session' : 'Record mid-shift location'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => hasActiveSession && !isSubmitting && handlePunchClick('OUT')}
                                        disabled={!hasActiveSession || isSubmitting}
                                        className={`group relative p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            !hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-lg dark:shadow-2xl active:scale-[0.98]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                                !hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                                            }`}>
                                                <LogOut size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-base font-bold tracking-tight ${!hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {isSubmitting && cameraMode === 'OUT' && !showCamera ? 'Processing...' : 'Time Out'}
                                                </h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[11px] font-medium mt-0.5">
                                                    {!hasActiveSession ? 'No active session' : 'End your day'}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Date Selection Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em]">Select Date</h3>
                                        <button 
                                            onClick={() => setShowFullCalendar(!showFullCalendar)}
                                            className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl active:scale-95 transition-all"
                                        >
                                            <Calendar size={18} />
                                        </button>
                                    </div>

                                    {showFullCalendar && (
                                        <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-[2rem] border border-slate-100 dark:border-github-dark-border shadow-xl mb-4 relative z-50">
                                            <div className="grid grid-cols-7 gap-1">
                                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                                    <div key={d} className="text-center text-[10px] font-black text-slate-400 py-2">{d}</div>
                                                ))}
                                                {/* Simple inline calendar for demo or implement full logic */}
                                                {(() => {
                                                    const today = new Date();
                                                    const year = today.getFullYear();
                                                    const month = today.getMonth();
                                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                    const firstDay = new Date(year, month, 1).getDay();
                                                    const cells = [];
                                                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`p-${i}`} />);
                                                    for (let d = 1; d <= daysInMonth; d++) {
                                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                        const isSelected = dateStr === selectedDate;
                                                        const isToday = dateStr === getLocalDateString(today);
                                                        cells.push(
                                                            <button
                                                                key={d}
                                                                onClick={() => {
                                                                    setSelectedDate(dateStr);
                                                                    setShowFullCalendar(false);
                                                                }}
                                                                className={`h-10 rounded-xl text-xs font-bold transition-all ${
                                                                    isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 dark:text-github-dark-text hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                {d}
                                                            </button>
                                                        );
                                                    }
                                                    return cells;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 overflow-x-auto py-5 px-1 no-scrollbar scroll-smooth">
                                        {scrollerDates.map((date) => {
                                            const dateStr = getLocalDateString(date);
                                            const isSelected = dateStr === selectedDate;
                                            const isToday = dateStr === getLocalDateString();
                                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                            
                                            return (
                                                <button
                                                    key={dateStr}
                                                    id={isSelected ? "selected-date-btn" : undefined}
                                                    onClick={() => setSelectedDate(dateStr)}
                                                    className={`flex flex-col items-center justify-center min-w-[60px] h-20 rounded-[1.8rem] transition-all duration-300 ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 transform scale-105' 
                                                            : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-github-dark-border'
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-tighter mb-1 opacity-70">
                                                        {dayName}
                                                    </span>
                                                    <span className="text-lg font-black">{date.getDate()}</span>
                                                    {isToday && !isSelected && <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1"></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Today's Activity */}
                                <div className="pt-4">
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-github-dark-text tracking-tight">
                                            {selectedDate === getLocalDateString() ? "Today's Logs" : `Logs for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                        </h3>
                                        <button onClick={() => setIsCorrectionOpen(true)} className="flex items-center gap-1.5 text-indigo-600 font-black text-xs tracking-widest bg-indigo-50 px-4 py-2 rounded-full active:scale-95 transition-all">
                                            <Plus size={14} strokeWidth={3} /> Correction
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {dailySessions.length > 0 ? dailySessions.map((s, idx) => (
                                            <div key={s.acr_id || s.id || s.time_in} className="bg-white dark:bg-github-dark-subtle p-6 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm space-y-5 transition-all active:scale-[0.98]">
                                                {/* Session Header */}
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-github-dark-border/10">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest flex items-center gap-2">
                                                        <Clock size={12} /> Session #{dailySessions.length - idx}
                                                    </span>
                                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${s.late_minutes > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {s.late_minutes > 0 ? 'Late' : 'On Time'}
                                                    </span>
                                                </div>

                                                {/* IN/OUT Sections Grid */}
                                                <div className="grid grid-cols-2 gap-5">
                                                    {/* Time In Section */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                                                <ArrowUpRight size={16} strokeWidth={3} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest leading-none mb-1">Time In</span>
                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text truncate block">{formatTime(s.time_in, s, false)}</span>
                                                            </div>
                                                        </div>
                                                        {s.time_in_image ? (
                                                            <div 
                                                                onClick={() => setPreviewImage(s.time_in_image)}
                                                                className="w-full flex justify-center cursor-pointer relative group active:scale-95 transition-all"
                                                            >
                                                                <img src={s.time_in_image} alt="In" className="w-auto h-auto max-h-56 max-w-full block rounded-2xl shadow-md object-contain" />
                                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-2xl">
                                                                    <Eye size={20} className="text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-32 rounded-2xl bg-slate-50 dark:bg-github-dark-border/30 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                                                                <ImageIcon size={20} />
                                                                <span className="text-[8px] font-bold mt-1 tracking-tighter">No Photo</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Time Out Section */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600">
                                                                <ArrowDownRight size={16} strokeWidth={3} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-black text-slate-400 dark:text-github-dark-muted tracking-widest leading-none mb-1">Time Out</span>
                                                                <span className="text-sm font-black text-slate-800 dark:text-github-dark-text truncate block">{s.time_out ? formatTime(s.time_out, s, true) : 'In Progress'}</span>
                                                            </div>
                                                        </div>
                                                        {s.time_out_image ? (
                                                            <div 
                                                                onClick={() => setPreviewImage(s.time_out_image)}
                                                                className="w-full flex justify-center cursor-pointer relative group active:scale-95 transition-all"
                                                            >
                                                                <img src={s.time_out_image} alt="Out" className="w-auto h-auto max-h-56 max-w-full block rounded-2xl shadow-md object-contain" />
                                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-2xl">
                                                                    <Eye size={20} className="text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-32 rounded-2xl bg-slate-50 dark:bg-github-dark-border/30 border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                                                                <ImageIcon size={20} />
                                                                <span className="text-[8px] font-bold mt-1 uppercase tracking-tighter">No Photo</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Session Footer */}
                                                <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-github-dark-border/10">
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-github-dark-muted text-[10px] font-bold truncate max-w-[150px]">
                                                        <MapPin size={12} className="text-indigo-400" />
                                                        {s.time_in_address && s.time_in_address !== 'Locating...' && s.time_in_address !== 'Pending...'
                                                            ? s.time_in_address
                                                            : (s.time_in_lat && s.time_in_lng
                                                                ? `${parseFloat(s.time_in_lat).toFixed(4)}, ${parseFloat(s.time_in_lng).toFixed(4)}`
                                                                : 'Address not captured')}
                                                    </div>
                                                    <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">
                                                        Total: {s.total_hours || calculateHours(s.time_in, s.time_out)}
                                                    </div>
                                                </div>

                                                {s.late_minutes > 0 && s.late_reason && (
                                                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl flex items-start gap-2.5">
                                                        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="block text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Late Reason</span>
                                                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-tight">{s.late_reason}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mobile Session Checkpoints List */}
                                                {Array.isArray(s.checkpoints) && s.checkpoints.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-github-dark-border/20 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                                                    Checkpoints ({s.checkpoints.length})
                                                                </span>
                                                            </div>
                                                            {!s.time_out && isCheckpointAllowed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleOpenCheckpointModal}
                                                                    className="text-[9px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    <Plus size={10} strokeWidth={3} /> Add Checkpoint
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {s.checkpoints.map((chk, cIdx) => {
                                                                const selfieUrl = chk.image_url || chk.image;
                                                                return (
                                                                    <div
                                                                        key={chk.id || cIdx}
                                                                        className="p-2.5 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[11px] space-y-2 transition-all"
                                                                    >
                                                                        <div className="flex items-start gap-2.5">
                                                                            {/* Checkpoint Selfie / Image Thumbnail */}
                                                                            {selfieUrl ? (
                                                                                <div
                                                                                    onClick={() => setPreviewImage({
                                                                                        url: selfieUrl,
                                                                                        title: `Checkpoint #${cIdx + 1} Photo`,
                                                                                        subtitle: chk.address || 'Verified Checkpoint Selfie'
                                                                                    })}
                                                                                    className="relative group/chkimg w-14 h-14 rounded-xl overflow-hidden border-2 border-amber-500/40 bg-black/30 shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all"
                                                                                    title="Tap to preview checkpoint selfie"
                                                                                >
                                                                                    <img
                                                                                        src={selfieUrl}
                                                                                        alt={`Checkpoint #${cIdx + 1}`}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/chkimg:opacity-100 flex items-center justify-center transition-opacity">
                                                                                        <Eye size={16} className="text-white drop-shadow-md" />
                                                                                    </div>
                                                                                    <div className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/60 backdrop-blur-xs text-white">
                                                                                        <Camera size={9} />
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    className="w-12 h-12 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center shrink-0 shadow-xs"
                                                                                    title="Logged without selfie"
                                                                                >
                                                                                    <Camera size={16} className="opacity-50" />
                                                                                    <span className="text-[7px] font-bold uppercase tracking-tight opacity-75 mt-0.5">No Photo</span>
                                                                                </div>
                                                                            )}

                                                                            <div className="flex-1 min-w-0 space-y-1">
                                                                                <div className="flex items-center justify-between font-black text-slate-800 dark:text-slate-200">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <span className="text-amber-600 dark:text-amber-400 font-black">
                                                                                            #{cIdx + 1}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                                                                                            {formatTime(chk.punch_time, s, false)}
                                                                                        </span>
                                                                                        {chk.accuracy && (
                                                                                            <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.2 rounded">
                                                                                                ±{Math.round(chk.accuracy)}m
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                                        {selfieUrl && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setPreviewImage({
                                                                                                    url: selfieUrl,
                                                                                                    title: `Checkpoint #${cIdx + 1} Photo`,
                                                                                                    subtitle: chk.address || 'Verified Checkpoint Selfie'
                                                                                                })}
                                                                                                className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                                                                                            >
                                                                                                <Eye size={10} /> Photo
                                                                                            </button>
                                                                                        )}
                                                                                        {chk.lat && chk.lng && (
                                                                                            <a
                                                                                                href={`https://www.google.com/maps?q=${chk.lat},${chk.lng}`}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                                                                            >
                                                                                                <ExternalLink size={9} /> Map
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <p className="text-slate-600 dark:text-slate-300 text-[10px] leading-snug flex items-center gap-1 break-words">
                                                                                    <MapPin size={11} className="text-amber-500 shrink-0" />
                                                                                    <span className="line-clamp-2">{chk.address || `${chk.lat}, ${chk.lng}`}</span>
                                                                                </p>

                                                                                {chk.note && (
                                                                                    <p className="text-[9px] italic text-slate-500 dark:text-slate-400 pl-2 border-l border-amber-500/30 break-words">
                                                                                        "{chk.note}"
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="py-12 bg-white dark:bg-github-dark-subtle rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-github-dark-border/50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                                    <Calendar size={32} />
                                                </div>
                                                <p className="text-slate-400 text-sm font-bold">No records found for today</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="logs-tab"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                {/* Logs Subtabs - Standardized Icon Style */}
                                <div className="flex items-center gap-6 px-1 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-white/5 mb-2">
                                    {SUB_TABS.map((sub) => {
                                        const isActive = subTab === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSubTabChange(sub.id)}
                                                className={`flex items-center gap-2 py-3 relative transition-all duration-300 whitespace-nowrap ${
                                                    isActive 
                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                        : 'text-slate-400 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                <sub.icon size={16} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                                                <span className={`text-[11px] font-normal uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                                    {sub.label}
                                                </span>
                                                {isActive && (
                                                    <motion.div 
                                                        layoutId="subTabUnderlineMyAttendance"
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <AnimatePresence mode="wait" initial={false} custom={direction}>
                                    <motion.div
                                        key={subTab}
                                        custom={direction}
                                        variants={{
                                            enter: (direction) => ({ x: direction > 0 ? 30 : -30, opacity: 0 }),
                                            center: { x: 0, opacity: 1 },
                                            exit: (direction) => ({ x: direction < 0 ? 30 : -30, opacity: 0, position: 'absolute', width: '100%' })
                                        }}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={0.2}
                                        onDragEnd={(e, info) => {
                                            if (info.offset.x < -80) handleSwipe('left');
                                            else if (info.offset.x > 80) handleSwipe('right');
                                        }}
                                        className="space-y-4 pt-4"
                                    >
                                        {subTab === 'history' && (
                                            <div className="space-y-4">
                                                {groupedHistoryDays.length > 0 ? groupedHistoryDays.map((day) => {
                                                    const isExpanded = expandedDays.has(day.dateKey);
                                                    const totalHoursDisplay = day.totalDayHours > 0 
                                                        ? `${day.totalDayHours} hrs` 
                                                        : (day.hasOpenSession ? 'In Progress' : '0 hrs');

                                                    return (
                                                        <div 
                                                            key={day.dateKey} 
                                                            className={`bg-white dark:bg-github-dark-subtle rounded-[2rem] border transition-all duration-200 shadow-sm overflow-hidden ${
                                                                isExpanded 
                                                                    ? 'border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-500/20' 
                                                                    : 'border-slate-100 dark:border-github-dark-border'
                                                            }`}
                                                        >
                                                            {/* Day Header Summary */}
                                                            <div 
                                                                onClick={() => toggleDayExpansion(day.dateKey)}
                                                                className="p-5 space-y-4 cursor-pointer select-none"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 w-12 h-14 rounded-2xl flex flex-col items-center justify-center text-indigo-700 dark:text-indigo-400 font-black shrink-0 border border-indigo-100/50">
                                                                        <span className="text-[10px] uppercase opacity-60 leading-none mb-0.5">{day.date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                                        <span className="text-xl leading-none">{day.date.getDate()}</span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text">
                                                                                {day.date.toLocaleDateString('en-US', { weekday: 'long' })}
                                                                            </h4>
                                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                                                day.dayStatus === 'MISSED_PUNCH' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200/50' :
                                                                                day.dayStatus === 'LATE' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/50' :
                                                                                day.dayStatus === 'OVERTIME' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200/50' :
                                                                                'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50'
                                                                            }`}>
                                                                                {day.dayStatus === 'MISSED_PUNCH' ? 'Missed Punch' : day.dayStatus}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1">
                                                                            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'}</span>
                                                                            <span>•</span>
                                                                            <span className="truncate max-w-[140px]" title={day.sessions[0]?.time_in_address || 'Office'}>
                                                                                {day.sessions[0]?.time_in_address || 'Office'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full leading-none">
                                                                            {totalHoursDisplay}
                                                                        </span>
                                                                        <div className={`p-1 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}>
                                                                            <ChevronDown size={14} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* First / Last Punch Summary Bar */}
                                                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 dark:border-github-dark-border/10">
                                                                    <div className="bg-slate-50/50 dark:bg-github-dark-border/20 p-2.5 rounded-2xl">
                                                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">First In</span>
                                                                        <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{formatTime(day.firstIn, day.firstSession, false)}</span>
                                                                    </div>
                                                                    <div className="bg-slate-50/50 dark:bg-github-dark-border/20 p-2.5 rounded-2xl">
                                                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Out</span>
                                                                        <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{day.lastOut ? formatTime(day.lastOut, day.lastSession, true) : (day.isPastDay ? 'Missed Out' : 'In Progress')}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Expanded Session Details */}
                                                            <AnimatePresence>
                                                                {isExpanded && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="border-t border-slate-100 dark:border-github-dark-border/40 bg-slate-50/40 dark:bg-white/[0.015] p-4 space-y-3"
                                                                    >
                                                                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                                            Individual Punches ({day.sessions.length})
                                                                        </div>

                                                                        {day.sessions.map((s, sIdx) => {
                                                                            const isSessionOpen = !s.time_out;
                                                                            const isSessionMissed = s.status === 'MISSED_PUNCH' || (day.isPastDay && isSessionOpen);
                                                                            const sessionStatus = isSessionMissed ? 'MISSED_PUNCH' : (isSessionOpen ? 'ACTIVE' : 'COMPLETED');
                                                                            const sStyle = getStatusStyle(sessionStatus);
                                                                            const sDuration = isSessionOpen 
                                                                                ? (isSessionMissed ? 'Missed Out' : 'In Progress') 
                                                                                : (s.total_hours ? `${s.total_hours} hrs` : (calculateHours(s.time_in, s.time_out) || 'N/A'));
                                                                            return (
                                                                                <div key={s.attendance_id || sIdx} className="bg-white dark:bg-github-dark-subtle p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border space-y-2.5 shadow-xs">
                                                                                    <div className="flex items-center justify-between text-xs">
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="font-bold text-slate-700 dark:text-slate-200">Session #{sIdx + 1}</span>
                                                                                            {sessionStatus === 'MISSED_PUNCH' && (
                                                                                                <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${sStyle.bg} ${sStyle.text}`}>
                                                                                                    <span className={`w-1 h-1 rounded-full ${sStyle.dot}`}></span>
                                                                                                    {sStyle.label}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">{sDuration}</span>
                                                                                    </div>

                                                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                        <div className="bg-slate-50/70 dark:bg-white/5 p-2 rounded-xl">
                                                                                            <span className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">In</span>
                                                                                            <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{formatTime(s.time_in, s, false)}</span>
                                                                                            {s.time_in_image && (
                                                                                                <button onClick={() => setPreviewImage(s.time_in_image)} className="mt-1 w-6 h-6 rounded border border-white overflow-hidden block">
                                                                                                    <img src={s.time_in_image} alt="In" className="w-full h-full object-cover" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="bg-slate-50/70 dark:bg-white/5 p-2 rounded-xl">
                                                                                            <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Out</span>
                                                                                            <span className="text-[11px] font-black text-slate-700 dark:text-github-dark-text">{s.time_out ? formatTime(s.time_out, s, true) : (s.status === 'MISSED_PUNCH' ? 'Missed Out' : 'In Progress')}</span>
                                                                                            {s.time_out_image && (
                                                                                                <button onClick={() => setPreviewImage(s.time_out_image)} className="mt-1 w-6 h-6 rounded border border-white overflow-hidden block">
                                                                                                    <img src={s.time_out_image} alt="Out" className="w-full h-full object-cover" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {s.late_minutes > 0 && (
                                                                                        <div className="p-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-xl flex items-center gap-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                                                                            <AlertCircle size={10} className="shrink-0" />
                                                                                            <span>Late by {s.late_minutes}m {s.late_reason ? `(${s.late_reason})` : ''}</span>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* History Session Checkpoints */}
                                                                                    {Array.isArray(s.checkpoints) && s.checkpoints.length > 0 && (
                                                                                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                                                                                    Checkpoints ({s.checkpoints.length})
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="space-y-1.5">
                                                                                                {s.checkpoints.map((chk, cIdx) => {
                                                                                                    const selfieUrl = chk.image_url || chk.image;
                                                                                                    return (
                                                                                                        <div key={chk.id || cIdx} className="p-2 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 text-[10px] space-y-1.5">
                                                                                                            <div className="flex items-start gap-2">
                                                                                                                {selfieUrl ? (
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => setPreviewImage({
                                                                                                                            url: selfieUrl,
                                                                                                                            title: `Checkpoint #${cIdx + 1} Photo`,
                                                                                                                            subtitle: chk.address || 'Verified Checkpoint Selfie'
                                                                                                                        })}
                                                                                                                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-amber-500/40 shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                                                                                                                    >
                                                                                                                        <img src={selfieUrl} alt={`Checkpoint #${cIdx + 1}`} className="w-full h-full object-cover" />
                                                                                                                    </button>
                                                                                                                ) : (
                                                                                                                    <div className="w-8 h-8 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                                                                                                        <Camera size={13} className="opacity-50" />
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                                                                                    <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                                                                                                                        <span className="text-amber-700 dark:text-amber-400 font-black">
                                                                                                                            #{cIdx + 1} • {formatTime(chk.punch_time, s, false)}
                                                                                                                        </span>
                                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                                            {selfieUrl && (
                                                                                                                                <button
                                                                                                                                    type="button"
                                                                                                                                    onClick={() => setPreviewImage({
                                                                                                                                        url: selfieUrl,
                                                                                                                                        title: `Checkpoint #${cIdx + 1} Photo`,
                                                                                                                                        subtitle: chk.address || 'Verified Checkpoint Selfie'
                                                                                                                                    })}
                                                                                                                                    className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                                                                                                                                >
                                                                                                                                    Photo
                                                                                                                                </button>
                                                                                                                            )}
                                                                                                                            {chk.lat && chk.lng && (
                                                                                                                                <a
                                                                                                                                    href={`https://www.google.com/maps?q=${chk.lat},${chk.lng}`}
                                                                                                                                    target="_blank"
                                                                                                                                    rel="noopener noreferrer"
                                                                                                                                    className="text-amber-600 font-bold hover:underline"
                                                                                                                                >
                                                                                                                                    Map
                                                                                                                                </a>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <p className="text-slate-500 text-[9px] truncate">{chk.address || `${chk.lat}, ${chk.lng}`}</p>
                                                                                                                    {chk.note && <p className="text-slate-400 text-[8px] italic truncate">"{chk.note}"</p>}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                }) : (
                                                    <p className="text-center text-slate-400 py-12 font-bold uppercase tracking-widest text-xs">No history this month</p>
                                                )}
                                            </div>
                                        )}

                                {subTab === 'analytics' && (
                                    <div className="space-y-6">
                                        {/* Date Filters Bar */}
                                        <div className="bg-white dark:bg-github-dark-subtle p-4 rounded-[2rem] border border-slate-100 dark:border-github-dark-border shadow-sm space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <Calendar size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Analytics Period</h4>
                                                    <p className="text-[9px] text-slate-400 dark:text-github-dark-muted font-bold mt-0.5">Filter statistics and trend charts</p>
                                                </div>
                                            </div>

                                            {/* Selector Segment Buttons */}
                                            <div className="bg-slate-100 dark:bg-[#161b22] p-1 rounded-xl flex gap-1 border border-slate-200/50 dark:border-white/5 overflow-x-auto no-scrollbar">
                                                {[
                                                    { id: 'this_month', label: 'This Month' },
                                                    { id: 'last_month', label: 'Last' },
                                                    { id: 'select_month', label: 'Month' },
                                                    { id: 'custom', label: 'Custom' },
                                                ].map(type => (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => setAnalyticsFilterType(type.id)}
                                                        className={`flex-1 min-w-[70px] py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap ${
                                                            analyticsFilterType === type.id
                                                                ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                                : 'text-slate-500 dark:text-slate-400'
                                                        }`}
                                                    >
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Contextual Filter Pickers */}
                                            {analyticsFilterType === 'select_month' && (
                                                <div className="w-full">
                                                    <MonthPicker
                                                        value={analyticsSelectedMonth}
                                                        onChange={(val) => setAnalyticsSelectedMonth(val)}
                                                        compact={true}
                                                    />
                                                </div>
                                            )}

                                            {analyticsFilterType === 'custom' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <MobileDatePicker
                                                        label="Start Date"
                                                        value={analyticsStartDate}
                                                        onChange={(val) => setAnalyticsStartDate(val)}
                                                    />
                                                    <MobileDatePicker
                                                        label="End Date"
                                                        value={analyticsEndDate}
                                                        onChange={(val) => setAnalyticsEndDate(val)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {analyticsLoading ? (
                                            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-github-dark-subtle rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
                                                <p className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Compiling Analytics Data...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Premium Stats Grid */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                                                            <CheckCircle size={20} />
                                                        </div>
                                                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Attendance</span>
                                                        <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{presentPercentage}%</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">{presentCount} Days Present</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                                                            <Clock size={20} />
                                                        </div>
                                                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Avg Shift</span>
                                                        <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{avgHours}h</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">Per Working Day</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                        <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
                                                            <AlertCircle size={20} />
                                                        </div>
                                                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Late Arrival</span>
                                                        <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{lateCount}</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">{latePercentage}% of shifts</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-5 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                        <div className="w-10 h-10 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-600 mb-4">
                                                            <BarChart3 size={20} />
                                                        </div>
                                                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Short Shifts</span>
                                                        <h4 className="text-2xl font-black text-slate-800 dark:text-github-dark-text mt-1">{underHoursCount}</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">Under 8 Hours</p>
                                                    </div>
                                                </div>

                                                {/* Trends Chart */}
                                                <div className="bg-white dark:bg-github-dark-subtle p-6 rounded-[2.5rem] border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                    <h3 className="text-[10px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-[0.2em] mb-8 flex items-center justify-between opacity-60">
                                                        Daily Work Hours
                                                        <div className="flex items-center gap-1.5 text-indigo-500 font-bold tracking-tight">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                            Trend
                                                        </div>
                                                    </h3>
                                                    <div className="h-48 -ml-4">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={attendanceTrendData}>
                                                                <defs>
                                                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:opacity-10" />
                                                                <XAxis dataKey="date" hide />
                                                                <YAxis hide />
                                                                <RechartsTooltip 
                                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: 'rgb(255 255 255 / 0.9)' }}
                                                                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                                                                />
                                                                <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Download Action Section */}
                                                <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                                                    <div className="relative z-10">
                                                        <h3 className="text-xl font-black tracking-tight mb-2">Monthly Summary</h3>
                                                        <p className="text-indigo-100/70 text-[11px] font-medium mb-4 max-w-[200px]">Download your detailed attendance report for {new Date(reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
                                                        <div className="mb-5">
                                                            <label className="block text-[9px] font-black uppercase text-indigo-200 tracking-wider mb-2">File Format</label>
                                                            <select
                                                                value={fileFormat}
                                                                onChange={(e) => setFileFormat(e.target.value)}
                                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
                                                            >
                                                                <option value="xlsx" className="text-slate-800">Excel (xlsx)</option>
                                                                <option value="csv" className="text-slate-800">CSV (csv)</option>
                                                                <option value="pdf" className="text-slate-800">PDF (pdf)</option>
                                                            </select>
                                                        </div>
                                                        <button
                                                            onClick={downloadReport}
                                                            disabled={isDownloading}
                                                            className="w-full py-4 bg-white text-indigo-600 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] transition-all"
                                                        >
                                                            {isDownloading ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                                                            Download Report
                                                        </button>
                                                    </div>
                                                    {/* Abstract Background Element */}
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-400/20 rounded-full -ml-12 -mb-12 blur-2xl" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {subTab === 'corrections' && (
                                    <div className="space-y-4">
                                        <div className="flex gap-2 mb-2">
                                            {['pending', 'history'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setCorrectionFilter(f)}
                                                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                        correctionFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-transparent border-slate-200 text-slate-400'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-3">
                                            {filteredCorrections.length > 0 ? filteredCorrections.map((item, idx) => (
                                                <div
                                                    key={item.acr_id || item.request_id || item.id}
                                                    onClick={() => handleRequestClick(item)}
                                                    className="bg-white dark:bg-github-dark-subtle p-5 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center justify-between active:scale-95 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text truncate max-w-[150px] leading-none">{item.correction_type}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5">{formatCorrectionDate(item.request_date)}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                                                        item.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        item.status?.toLowerCase() === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {item.status || 'PENDING'}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-center text-slate-400 py-12 font-bold uppercase tracking-widest text-xs">No {correctionFilter} requests</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                </motion.div>
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* --- MODALS & PORTALS --- */}

            {/* Mobile Checkpoint Modal */}
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

            {/* Camera Overlay */}
            {showCamera && createPortal(
                (() => {
                    const isSelfieRequired = cameraMode === 'IN'
                        ? (myShift?.rules?.entry_requirements?.selfie ?? true)
                        : (myShift?.rules?.exit_requirements?.selfie ?? false);

                    return (
                        <div className="fixed inset-0 z-[9999] bg-[#070a12]/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto no-scrollbar">
                            {/* Modal Header */}
                            <div className="w-full max-w-lg mx-auto flex items-center justify-between py-2 shrink-0">
                                <div className="w-10" />
                                <h3 className="text-base font-bold text-white text-center">
                                    {cameraMode === 'IN' ? 'Check In' : 'Check Out'}
                                </h3>
                                <button 
                                    onClick={closeCamera} 
                                    className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Main Content */}
                            <div className="w-full max-w-lg mx-auto my-auto space-y-4 py-2">
                                {/* Photo / Camera Container */}
                                <div className="w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl relative max-h-[340px] aspect-[4/3] flex items-center justify-center mx-auto">
                                    {isSelfieRequired ? (
                                        imgSrc ? (
                                            <img src={imgSrc} alt="Captured Selfie" className="w-full h-full object-cover" />
                                        ) : cameraError ? (
                                            <div className="p-5 text-center space-y-3 bg-slate-900 text-white max-w-sm mx-auto rounded-xl">
                                                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                                                    <Camera size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-black text-white">Camera Access Blocked or Needed</h4>
                                                    <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                                                        {cameraError}
                                                    </p>
                                                </div>
                                                <div className="text-[10px] bg-white/5 border border-white/10 rounded-lg p-2.5 text-left text-slate-300 space-y-1">
                                                    <div className="font-bold text-amber-400">Browser Permissions:</div>
                                                    <p>1. Tap the lock/settings icon in the browser URL bar.</p>
                                                    <p>2. Set Camera to <strong>Allow</strong>.</p>
                                                    <p>3. Tap <strong>Ask Browser for Permission</strong> below.</p>
                                                </div>
                                                <div className="flex items-center justify-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={handleRequestCamera}
                                                        disabled={isRequestingCam}
                                                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                                    >
                                                        {isRequestingCam ? (
                                                            <>
                                                                <RefreshCw size={12} className="animate-spin" /> Requesting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Camera size={12} /> Ask Browser for Permission
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCameraError(null)}
                                                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                className="w-full h-full object-cover"
                                                videoConstraints={{ facingMode: "user" }}
                                                onUserMediaError={(err) => {
                                                    console.warn("Mobile attendance webcam error:", err);
                                                    const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
                                                    setCameraError(isDenied 
                                                        ? "Camera permission was denied in your browser settings."
                                                        : (err?.message || "Camera access denied or unavailable."));
                                                }}
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full bg-slate-900/50 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
                                            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 text-indigo-400 border border-indigo-500/20">
                                                <Clock size={36} />
                                            </div>
                                            <h4 className="text-xl font-bold text-white mb-2">Ready to {cameraMode === 'IN' ? 'Time In' : 'Time Out'}</h4>
                                            <p className="text-sm text-slate-400 max-w-xs">
                                                Selfie verification is not required. Click confirm below to record your attendance.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Late Reason Input Section */}
                                {requireLateReason && (!isSelfieRequired || imgSrc) && (
                                    <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-2.5 text-amber-300 bg-amber-950/40 border border-amber-500/30 p-3.5 rounded-xl text-xs font-medium">
                                            <AlertCircle size={18} className="shrink-0 text-amber-400" />
                                            <p className="leading-snug">{lateReasonMessage || "You are arriving late. Please provide a reason to check in."}</p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Please provide a reason
                                            </label>
                                            <textarea
                                                value={lateReasonText}
                                                onChange={(e) => setLateReasonText(e.target.value)}
                                                placeholder="I got held up in traffic..."
                                                className="w-full px-4 py-3 bg-[#0d1322] border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white text-xs placeholder-slate-500 h-24 resize-none shadow-inner"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Bottom Action Controls */}
                            <div className="w-full max-w-lg mx-auto py-2 shrink-0">
                                {!isSelfieRequired ? (
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={closeCamera} 
                                            className="flex-1 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 font-bold text-sm transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={confirmAttendance} 
                                            disabled={isSubmitting || (requireLateReason && !lateReasonText.trim())} 
                                            className="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={18} />
                                        </button>
                                    </div>
                                ) : !imgSrc ? (
                                    <div className="flex justify-center py-2">
                                        <button 
                                            onClick={capture} 
                                            className="w-20 h-20 rounded-full bg-white text-indigo-600 hover:scale-105 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all ring-8 ring-white/20"
                                        >
                                            <Camera size={36} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={retake} 
                                            className="flex-1 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 font-bold text-sm transition-all flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw size={18} /> Retake
                                        </button>
                                        <button 
                                            onClick={confirmAttendance} 
                                            disabled={isSubmitting || (requireLateReason && !lateReasonText.trim())} 
                                            className="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })(),
                document.body
            )}

            {/* Correction Modal */}
            <AnimatePresence>
                {isCorrectionOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-end justify-center">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setIsCorrectionOpen(false)} 
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        />
                        <motion.div 
                            initial={{ y: '100%' }} 
                            animate={{ y: 0 }} 
                            exit={{ y: '100%' }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full bg-white dark:bg-github-dark-subtle rounded-t-[3rem] p-8 pb-12 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar border-t border-slate-100 dark:border-github-dark-border"
                        >
                            {/* Handle Bar */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-github-dark-border rounded-full mx-auto mb-8 shrink-0" />

                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-github-dark-text tracking-tight">Apply Correction</h3>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted tracking-widest mt-1">Adjust Your Attendance Records</p>
                                </div>
                                <button onClick={() => setIsCorrectionOpen(false)} className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Date Selection */}
                                <div className="space-y-2.5 relative z-30">
                                    <MobileDatePicker
                                        label="Adjustment Date"
                                        value={correctionForm.date}
                                        onChange={(val) => setCorrectionForm({...correctionForm, date: val})}
                                    />

                                    {/* Smart Context Banner */}
                                    {(() => {
                                        const hasSessions = originalSessions.length > 0;
                                        const hasOpenSession = hasSessions && originalSessions.some(s => s.time_in && !s.time_out);
                                        if (!hasSessions) {
                                            return (
                                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                                                    <span className="text-amber-700 dark:text-amber-300 font-medium">No punches found (Absent)</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrectionForm({ ...correctionForm, sessions: [{ in: '09:00', out: '18:00' }] })}
                                                        className="px-2.5 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider"
                                                    >
                                                        Fill 9-6
                                                    </button>
                                                </div>
                                            );
                                        }
                                        if (hasOpenSession) {
                                            return (
                                                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                                                    <span className="text-indigo-700 dark:text-indigo-300 font-medium">In at {originalSessions[0]?.time_in} (No out)</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrectionForm({ ...correctionForm, sessions: [{ in: originalSessions[0]?.time_in || '09:00', out: '18:00' }] })}
                                                        className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider"
                                                    >
                                                        Out: 18:00
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                {/* Adjustment Reason Category */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1 uppercase">Adjustment Reason</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Missed Punch', 'Missed Day', 'Other'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setCorrectionForm({...correctionForm, type})}
                                                className={`py-3 px-2 rounded-xl text-[10px] font-black tracking-wider transition-all border ${
                                                    correctionForm.type === type 
                                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                                                        : 'bg-slate-50 dark:bg-github-dark-bg text-slate-500 dark:text-github-dark-muted border-slate-200 dark:border-github-dark-border'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reason for Adjustment */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] px-1 uppercase">Reason & Details</label>
                                    <textarea
                                        value={correctionForm.reason}
                                        onChange={(e) => setCorrectionForm({...correctionForm, reason: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 text-sm font-bold min-h-[100px] focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-github-dark-text resize-none"
                                        placeholder="Explain why this adjustment is needed..."
                                        required
                                    />
                                </div>

                                {/* Advanced Options Accordion */}
                                <div className="border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-github-dark-bg/30">
                                    <button
                                        type="button"
                                        onClick={() => setShowMobileAdvanced(prev => !prev)}
                                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-github-dark-bg/60 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-github-dark-text">Advanced</span>
                                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-github-dark-border text-slate-600 dark:text-slate-300">Optional</span>
                                        </div>
                                        <div className={`transition-transform duration-200 ${showMobileAdvanced ? 'rotate-180' : 'rotate-0'}`}>
                                            <ChevronDown size={18} className="text-slate-400" />
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {showMobileAdvanced && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden border-t border-slate-200 dark:border-github-dark-border p-4 space-y-4 bg-white dark:bg-github-dark-subtle/50"
                                            >
                                                {/* ── Interactive Draggable Before / After Timeline ── */}
                                                <VisualCorrectionTimeline
                                                    requestData={{
                                                        original_data: originalSessions,
                                                        proposed_data: (correctionForm.sessions || []).filter(s => s.in && s.out).map(s => ({ time_in: s.in, time_out: s.out })),
                                                        correction_type: correctionForm.type,
                                                        status: 'draft'
                                                    }}
                                                    editable={true}
                                                    frameless={true}
                                                    hideHeader={true}
                                                    onSessionsChange={(updated) => {
                                                        setCorrectionForm(prev => ({
                                                            ...prev,
                                                            sessions: updated.map(s => ({ in: s.time_in, out: s.time_out, punch_type: s.punch_type || 'regular' }))
                                                        }));
                                                    }}
                                                />

                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted tracking-[0.2em] uppercase">Session Times</label>
                                                    <button 
                                                        type="button"
                                                        onClick={addSession}
                                                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg"
                                                    >
                                                        + Add Session
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {correctionForm.sessions.map((s, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-end gap-3 p-4 rounded-[2rem] border transition-all bg-white dark:bg-github-dark-bg/50 border-slate-200 dark:border-github-dark-border shadow-sm"
                                                        >
                                                            <div className="flex-1 space-y-1.5">
                                                                <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">
                                                                    {s.isExisting ? `Session ${idx + 1} In` : 'Time In'}
                                                                </label>
                                                                <input 
                                                                    type="time" 
                                                                    value={s.in || ''} 
                                                                    onChange={(e) => updateSession(idx, 'in', e.target.value)}
                                                                    className="w-full bg-slate-50 dark:bg-github-dark-bg rounded-xl p-3 text-xs font-bold text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border" 
                                                                />
                                                            </div>
                                                            <div className="flex-1 space-y-1.5">
                                                                <label className="text-[9px] font-black text-slate-400 tracking-widest px-1">
                                                                    {s.isExisting ? `Session ${idx + 1} Out` : 'Time Out'}
                                                                </label>
                                                                <input 
                                                                    type="time" 
                                                                    value={s.out || ''} 
                                                                    onChange={(e) => updateSession(idx, 'out', e.target.value)}
                                                                    className="w-full bg-slate-50 dark:bg-github-dark-bg rounded-xl p-3 text-xs font-bold text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border" 
                                                                />
                                                            </div>
                                                            {correctionForm.sessions.length > 1 && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => removeSession(idx)} 
                                                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                                                                    title="Remove Session"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button 
                                    onClick={handleCorrectionSubmit} 
                                    className="w-full py-4.5 bg-indigo-600 text-white text-xs font-black tracking-[0.15em] rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                                >
                                    <FileClock size={18} />
                                    Submit Adjustment Request
                                </button>
                                <p className="text-[9px] text-center text-slate-400 font-bold mt-2 tracking-widest opacity-60 uppercase">Reviewed & verified by HR / Admin</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Request Details Drawer Modal */}
            <AnimatePresence>
                {selectedRequest && (
                    <div className="fixed inset-0 z-[1000] flex items-end justify-center">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setSelectedRequest(null)} 
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        />
                        <motion.div 
                            initial={{ y: '100%' }} 
                            animate={{ y: 0 }} 
                            exit={{ y: '100%' }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full bg-white dark:bg-github-dark-subtle rounded-t-[3rem] p-8 pb-12 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar border-t border-slate-100 dark:border-github-dark-border"
                        >
                            {/* Handle Bar */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-github-dark-border rounded-full mx-auto mb-8 shrink-0" />

                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-github-dark-text tracking-tight uppercase">Request Details</h3>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mt-1 font-mono">ID: #{selectedRequest.acr_id || selectedRequest.id}</p>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Status Header Card */}
                                <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-github-dark-bg p-5 rounded-[2rem] border border-slate-200 dark:border-github-dark-border">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                                        selectedRequest.status?.toLowerCase() === 'approved' 
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20' 
                                            : selectedRequest.status?.toLowerCase() === 'rejected'
                                                ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20'
                                                : 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20'
                                    }`}>
                                        {selectedRequest.status?.toLowerCase() === 'approved' && <CheckCircle size={24} />}
                                        {selectedRequest.status?.toLowerCase() === 'rejected' && <XCircle size={24} />}
                                        {selectedRequest.status?.toLowerCase() !== 'approved' && selectedRequest.status?.toLowerCase() !== 'rejected' && <Clock size={24} />}
                                    </div>
                                    <div>
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            selectedRequest.status?.toLowerCase() === 'approved' 
                                                ? 'bg-emerald-100 text-emerald-700' 
                                                : selectedRequest.status?.toLowerCase() === 'rejected'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {selectedRequest.status || 'PENDING'}
                                        </span>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted mt-1 uppercase tracking-widest">
                                            Submitted on {selectedRequest.submitted_at ? new Date(selectedRequest.submitted_at).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Request Date</span>
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text block truncate">
                                            {selectedRequest.request_date ? new Date(selectedRequest.request_date).toLocaleDateString() : 'Invalid Date'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Correction Type</span>
                                        <span className="text-xs font-bold text-slate-700 dark:text-github-dark-text block truncate">
                                            {selectedRequest.correction_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div className="bg-slate-50/50 dark:bg-github-dark-bg p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border/50">
                                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Reason for Request</span>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                        "{selectedRequest.reason}"
                                    </div>
                                </div>

                                {/* Proposed Attendance */}
                                {selectedRequest.correction_data && (
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-4 opacity-60">Proposed Attendance</span>
                                        <div className="space-y-3">
                                            {(typeof selectedRequest.correction_data === 'string'
                                                ? JSON.parse(selectedRequest.correction_data).sessions
                                                : selectedRequest.correction_data.sessions || []
                                            ).sort((a, b) => (a.time_in || "").localeCompare(b.time_in || "")).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between p-3.5 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">In</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-github-dark-text font-mono">{s.time_in}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Out</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-github-dark-text font-mono">{s.time_out}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Single Session Check */}
                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_in && (
                                                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">In</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-github-dark-text font-mono">
                                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_in}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Out</span>
                                                        <span className="text-xs font-black text-slate-800 dark:text-github-dark-text font-mono">
                                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_out}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Decision Section */}
                                {selectedRequest.status?.toLowerCase() !== 'pending' && (
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-5 rounded-2xl border border-slate-200 dark:border-github-dark-border/50 border-t-4 border-t-indigo-500/20">
                                        <span className="block text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-3">Reviewer Decision</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                            {selectedRequest.review_comments || "No reviewer comments provided."}
                                        </p>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-github-dark-border/50 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                                            Reviewed on {selectedRequest.reviewed_at ? formatCorrectionDate(selectedRequest.reviewed_at) : 'N/A'}
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={() => setSelectedRequest(null)}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-bg dark:hover:bg-github-dark-border text-slate-700 dark:text-github-dark-muted text-xs font-black uppercase tracking-[0.2em] rounded-2xl active:scale-[0.98] transition-all"
                                >
                                    Close Details
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Image Preview Modal (Live Attendance Lightbox) */}
            {previewImage && createPortal(
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
            )}

        </MobileDashboardLayout>
    );
};

export default MobileAttendancePage;
