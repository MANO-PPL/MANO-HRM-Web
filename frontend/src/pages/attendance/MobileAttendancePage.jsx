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
    Check,
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
    ExternalLink,
    Loader2,
    Trash2,
    RotateCcw,
    Edit3
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { getLocalDateString, formatLocalTimeString, formatPlatformDate } from '../../utils/dateUtils';
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
import { injectAbsentDaysIntoHistory, isCheckpointRecord, normalizeDailySessionsWithCheckpoints, parseCorrectionDetails } from '../../utils/attendanceStatus';

const ThemedSelect = ({ label, value, options, onChange, className = '', labelClassName = '', buttonClassName = '' }) => {
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
                <label className={labelClassName || "block text-xs font-bold text-slate-800 dark:text-slate-100"}>
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={buttonClassName || "w-full h-10 px-3 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl flex items-center justify-between text-slate-800 dark:text-slate-100 text-xs font-medium transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99] shadow-2xs select-none cursor-pointer group"}
                >
                    <span className="truncate">{selectedOption ? selectedOption.label : 'Select...'}</span>
                    <ChevronDown size={15} className={`text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
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
                                        className={`w-full px-3 py-2 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${value === opt.value
                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-github-dark-bg'
                                            }`}
                                    >
                                        <span>{opt.label}</span>
                                        {value === opt.value && <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
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
        otherType: '',
        date: getLocalDateString(),
        in_time: '',
        out_time: '',
        reason: '',
        document: null
    });

    const [pendingRequestId, setPendingRequestId] = useState(null);
    const [existingAttachmentUrl, setExistingAttachmentUrl] = useState(null);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    const [originalSessions, setOriginalSessions] = useState([]);
    const [corrSessions, setCorrSessions] = useState([]);
    const [timelineHasIncomplete, setTimelineHasIncomplete] = useState(false);
    const [corrAttachment, setCorrAttachment] = useState(null);
    const [corrAttachmentPreview, setCorrAttachmentPreview] = useState(null);
    const corrFileInputRef = useRef(null);


    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const [imgSrc, setImgSrc] = useState(null);
    const webcamRef = useRef(null);
    const lastCoordsRef = useRef({ lat: null, lng: null });
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
    const [showLateReasonModal, setShowLateReasonModal] = useState(false);
    const [optimisticSelfies, setOptimisticSelfies] = useState({});

    // Image URL resolver helper
    const resolveImageUrl = (raw) => {
        if (!raw) return null;
        const str = String(raw).trim();
        if (!str || str === 'null' || str === 'undefined') return null;
        if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
            return str;
        }
        return null;
    };

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
    const [monthlyDailySummaries, setMonthlyDailySummaries] = useState([]);
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

    // Shift deadline & allowed date bounds for the correction date picker
    const correctionDeadlineDays = useMemo(() => {
        return myShift?.rules?.correction_deadline ?? 30;
    }, [myShift]);

    const minAllowedCorrectionDate = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - correctionDeadlineDays);
        return getLocalDateString(cutoff);
    }, [correctionDeadlineDays]);

    const maxAllowedCorrectionDate = useMemo(() => {
        return getLocalDateString();
    }, []);

    const extractHHMM = useCallback((val) => {
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
    }, []);

    const calculateSessionDurationHours = useCallback((startStr, endStr) => {
        if (!startStr || !endStr) return 0;
        const [sH, sM] = startStr.split(':').map(Number);
        const [eH, eM] = endStr.split(':').map(Number);
        if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
        let startMins = sH * 60 + sM;
        let endMins = eH * 60 + eM;
        if (endMins < startMins) {
            endMins += 24 * 60; // Overnight
        }
        return (endMins - startMins) / 60;
    }, []);

    const totalProposedHours = useMemo(() => {
        const valid = corrSessions.filter(s => s.time_in && s.time_out);
        return valid.reduce((acc, s) => acc + calculateSessionDurationHours(s.time_in, s.time_out), 0);
    }, [corrSessions, calculateSessionDurationHours]);

    const hasIncompleteSession = useMemo(() => {
        if (!showAdvancedOptions) return false;
        const hasIncompleteInCorr = corrSessions.some(s => {
            if (isCheckpointRecord(s) || s.punch_type === 'normal') return false;
            const hasIn = Boolean(s.time_in && String(s.time_in).trim());
            const hasOut = Boolean(s.time_out && String(s.time_out).trim());
            return (hasIn && !hasOut) || (!hasIn && hasOut);
        });
        return Boolean(hasIncompleteInCorr || timelineHasIncomplete);
    }, [showAdvancedOptions, corrSessions, timelineHasIncomplete]);

    // Check if user has already raised a correction request for the selected date
    const existingRequestForCorrDate = useMemo(() => {
        const targetDate = correctionForm.date;
        if (!targetDate) return null;
        if (Array.isArray(correctionHistory)) {
            const found = correctionHistory.find(req => {
                if (!req.request_date) return false;
                const dStr = String(req.request_date).split('T')[0];
                return dStr === targetDate;
            });
            if (found) return found;
        }
        if (pendingRequestId) {
            return {
                id: pendingRequestId,
                status: 'pending',
                request_date: targetDate,
                reason: correctionForm.reason
            };
        }
        return null;
    }, [correctionForm.date, correctionHistory, pendingRequestId, correctionForm.reason]);

    const handleResetCorrectionToOriginal = useCallback(() => {
        if (originalSessions.length > 0) {
            const resetList = [];
            originalSessions.forEach((s, idx) => {
                if (isCheckpointRecord(s) || s.punch_type === 'normal') {
                    resetList.push({
                        id: `chk-${Date.now()}-${idx}`,
                        time_in: s.time_in || '',
                        time_out: '',
                        punch_type: 'normal',
                        address: s.address || ''
                    });
                } else {
                    resetList.push({
                        id: `sess-${Date.now()}-${idx}`,
                        time_in: s.time_in || '',
                        time_out: s.time_out || '',
                        punch_type: s.punch_type || 'regular',
                        address: s.address || ''
                    });
                    const chkList = Array.isArray(s.checkpoints) ? s.checkpoints : [];
                    chkList.forEach((chk, cIdx) => {
                        const chkTime = extractHHMM(chk.punch_time || chk.time || chk.time_in);
                        if (chkTime) {
                            resetList.push({
                                id: `chk-${Date.now()}-${idx}-${cIdx}`,
                                time_in: chkTime,
                                time_out: '',
                                punch_type: 'normal',
                                address: chk.address || ''
                            });
                        }
                    });
                }
            });
            setCorrSessions(resetList);
            toast.info("Reset to originally recorded punches");
        } else {
            setCorrSessions([]);
            toast.info("Cleared sessions (no original punches recorded for this date)");
        }
    }, [originalSessions, extractHHMM]);

    const handleUpdateTime = useCallback((id, field, val) => {
        setCorrSessions(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, [field]: val };
            }
            return s;
        }));
    }, []);

    const handleRemoveSession = useCallback((id) => {
        setCorrSessions(prev => prev.filter(s => s.id !== id));
    }, []);

    const handleAddSession = useCallback(() => {
        const shiftIn = myShift?.start_time?.slice(0, 5) || myShift?.startTime?.slice(0, 5) || '09:00';
        const shiftOut = myShift?.end_time?.slice(0, 5) || myShift?.endTime?.slice(0, 5) || '18:00';
        setCorrSessions(prev => {
            const workSessions = prev.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal');
            if (workSessions.length === 0) {
                return [
                    ...prev,
                    {
                        id: `sess-${Date.now()}-${prev.length}`,
                        time_in: shiftIn,
                        time_out: shiftOut,
                        punch_type: 'regular'
                    }
                ];
            }
            const lastSession = workSessions[workSessions.length - 1];
            let nextIn = '';
            let nextOut = '';
            if (lastSession.time_out) {
                const [lH, lM] = lastSession.time_out.split(':').map(Number);
                if (!isNaN(lH)) {
                    const nextH = Math.min(23, lH + 1);
                    const nextEndH = Math.min(23, nextH + 2);
                    nextIn = `${String(nextH).padStart(2, '0')}:${String(lM || 0).padStart(2, '0')}`;
                    nextOut = `${String(nextEndH).padStart(2, '0')}:${String(lM || 0).padStart(2, '0')}`;
                }
            }
            return [
                ...prev,
                {
                    id: `sess-${Date.now()}-${prev.length}`,
                    time_in: nextIn,
                    time_out: nextOut,
                    punch_type: 'regular'
                }
            ];
        });
    }, [myShift]);

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
        document.documentElement.classList.add('no-scrollbar');
        document.body.classList.add('no-scrollbar');
        return () => {
            document.documentElement.classList.remove('no-scrollbar');
            document.body.classList.remove('no-scrollbar');
        };
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
            if (attendanceCacheData.dailySummary && attendanceCacheData.dailySummary[cacheKey]) {
                const cachedSummaries = attendanceCacheData.dailySummary[cacheKey].data || attendanceCacheData.dailySummary[cacheKey] || [];
                setMonthlyDailySummaries(Array.isArray(cachedSummaries) ? cachedSummaries : []);
            }
            return;
        }

        setLoading(true);
        try {
            const [recordsRes, summaryRes] = await Promise.allSettled([
                attendanceService.getMyRecords(startDate, endDate, force),
                attendanceService.getDailySummary(startDate, endDate, force)
            ]);

            if (recordsRes.status === 'fulfilled' && (recordsRes.value?.ok || recordsRes.value?.data || Array.isArray(recordsRes.value))) {
                const records = recordsRes.value.data || recordsRes.value || [];
                setMonthlySessions(Array.isArray(records) ? records : []);
            }
            if (summaryRes.status === 'fulfilled' && (summaryRes.value?.ok || Array.isArray(summaryRes.value?.data))) {
                setMonthlyDailySummaries(summaryRes.value.data || []);
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
                    const prevCoords = lastCoordsRef.current;
                    if (prevCoords.lat && prevCoords.lng) {
                        const dLat = Math.abs(prevCoords.lat - latitude);
                        const dLng = Math.abs(prevCoords.lng - longitude);
                        // Avoid spamming reverse-geocoding if moved less than ~20 meters
                        if (dLat < 0.0002 && dLng < 0.0002) {
                            return;
                        }
                    }
                    lastCoordsRef.current = { lat: latitude, lng: longitude };
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

    const loadCorrectionDataForDate = useCallback(async (targetDate) => {
        if (!targetDate) {
            setOriginalSessions([]);
            setCorrSessions([]);
            setPendingRequestId(null);
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);
            setCorrectionForm(prev => ({ ...prev, reason: '', type: 'Missed Punch', otherType: '' }));
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
                const { category: parsedCat, cleanReason } = parseCorrectionDetails(pendingReq);
                const standardTypes = ['Missed Punch', 'Missed Day', 'Late Arrival', 'Early Departure', 'Biometric Issue', 'Overtime'];
                let nextType = 'Missed Punch';
                let nextOther = '';
                if (standardTypes.includes(parsedCat)) {
                    nextType = parsedCat;
                } else if (pendingReq.correction_type === 'summary') {
                    nextType = 'Other';
                    nextOther = 'Summary Adjustment';
                } else if (parsedCat) {
                    nextType = 'Other';
                    nextOther = parsedCat;
                }
                setCorrectionForm(prev => ({
                    ...prev,
                    reason: cleanReason || pendingReq.reason || '',
                    type: nextType,
                    otherType: nextOther
                }));
                setExistingAttachmentUrl(pendingReq.attachment_url || null);
                setCorrAttachment(null);
                setCorrAttachmentPreview(null);

                const proposedList = Array.isArray(pendingReq.proposed_data) ? pendingReq.proposed_data : [];
                const originalList = Array.isArray(pendingReq.original_data) ? pendingReq.original_data : [];

                setOriginalSessions(originalList);
                if (proposedList.length > 0) {
                    setCorrSessions(proposedList.map((s, i) => {
                        const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                        return {
                            id: s.id || Date.now() + i,
                            time_in: s.time_in ? String(s.time_in).slice(0, 5) : (s.punch_time ? String(s.punch_time).slice(11, 16) : ''),
                            time_out: isChk ? '' : (s.time_out ? String(s.time_out).slice(0, 5) : ''),
                            punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                            address: s.address || ''
                        };
                    }));
                }
                return;
            }

            // No pending request: Fresh submission state
            setPendingRequestId(null);
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);

            const res = await attendanceService.getMyRecords(targetDate, targetDate);
            const rawList = Array.isArray(res)
                ? res
                : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []));

            if (rawList && rawList.length > 0) {
                const normalizedRaw = normalizeDailySessionsWithCheckpoints(rawList);

                const loadedSessions = normalizedRaw.map((s, i) => {
                    const isChk = isCheckpointRecord(s);
                    const time_in_str = extractHHMM(s.time_in || s.time_in_ts || s.punch_time);
                    const time_out_str = isChk ? '' : extractHHMM(s.time_out || s.time_out_ts);
                    return {
                        id: Date.now() + i,
                        time_in: time_in_str,
                        time_out: time_out_str,
                        punch_type: isChk ? 'normal' : 'regular',
                        checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : (Array.isArray(s.raw_checkpoints) ? s.raw_checkpoints : []),
                        address: s.address || s.time_in_address || '',
                        status: s.status,
                        raw_session: s
                    };
                });

                // Frozen snapshot for original_data reference
                setOriginalSessions(loadedSessions.map(s => ({
                    time_in: s.time_in,
                    time_out: s.time_out,
                    punch_type: s.punch_type,
                    checkpoints: s.checkpoints,
                    address: s.address,
                    status: s.status,
                    raw_session: s.raw_session
                })));

                // Pre-populate proposed sessions with existing logged sessions & checkpoints for timeline editing
                const initialCorr = [];
                loadedSessions.forEach((s, idx) => {
                    if (s.punch_type === 'normal') {
                        initialCorr.push({
                            id: `chk-${Date.now()}-${idx}`,
                            time_in: s.time_in || '',
                            time_out: '',
                            punch_type: 'normal',
                            address: s.address || ''
                        });
                    } else {
                        initialCorr.push({
                            id: `sess-${Date.now()}-${idx}`,
                            time_in: s.time_in || '',
                            time_out: s.time_out || '',
                            punch_type: s.punch_type || 'regular',
                            address: s.address || ''
                        });
                        const chkList = Array.isArray(s.checkpoints) ? s.checkpoints : [];
                        chkList.forEach((chk, cIdx) => {
                            const chkTime = extractHHMM(chk.punch_time || chk.time || chk.time_in);
                            if (chkTime) {
                                initialCorr.push({
                                    id: `chk-${Date.now()}-${idx}-${cIdx}`,
                                    time_in: chkTime,
                                    time_out: '',
                                    punch_type: 'normal',
                                    address: chk.address || ''
                                });
                            }
                        });
                    }
                });
                setCorrSessions(initialCorr);
            } else {
                setOriginalSessions([]);
                setCorrSessions([]);
            }
        } catch (error) {
            console.error("Failed to fetch existing record for correction", error);
            setOriginalSessions([]);
            setCorrSessions([]);
        }
    }, [extractHHMM]);

    useEffect(() => {
        loadCorrectionDataForDate(correctionForm.date);
    }, [correctionForm.date, loadCorrectionDataForDate]);

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
            ? Boolean(myShift?.rules?.entry_requirements?.selfie)
            : Boolean(myShift?.rules?.exit_requirements?.selfie);

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

                    // Unlock GPS state immediately without blocking on reverse geocoding
                    setCheckpointLocation({
                        lat: latitude,
                        lng: longitude,
                        accuracy,
                        address: resolvedAddr,
                        error: null,
                        loading: false
                    });

                    // Enhance with street address asynchronously
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.display_name) {
                                setCheckpointLocation(prev => ({ ...prev, address: data.display_name }));
                            }
                        }
                    } catch (_) {}
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

    const executeDirectCheckpoint = async () => {
        setIsMarkingCheckpoint(true);
        try {
            let lat = location.lat;
            let lng = location.lng;
            let accuracy = location.lat ? 10 : null;
            let address = location.address || null;

            if (!lat || !lng) {
                if (navigator.geolocation) {
                    try {
                        const pos = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 0
                            });
                        });
                        lat = pos.coords.latitude;
                        lng = pos.coords.longitude;
                        accuracy = pos.coords.accuracy;
                        address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                    } catch (geoErr) {
                        console.warn("Direct checkpoint geolocation error:", geoErr);
                    }
                }
            }

            if (!lat || !lng) {
                toast.error("Valid GPS coordinates are required to mark a checkpoint.");
                return;
            }

            const payload = {
                latitude: lat,
                longitude: lng,
                accuracy: accuracy || 10,
                address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                is_geofence_violation: false
            };

            const res = await attendanceService.markCheckpoint(payload);
            toast.success(res?.message || "Checkpoint marked successfully!");
            await fetchDailyRecords(true);
            await fetchMonthlyRecords(true);
            setTimeout(() => fetchDailyRecords(true), 2500);
            setTimeout(() => fetchDailyRecords(true), 6000);
        } catch (err) {
            console.error("Direct checkpoint error:", err);
            toast.error(err.message || "Failed to record checkpoint");
        } finally {
            setIsMarkingCheckpoint(false);
        }
    };

    const handleCheckpointClick = async () => {
        if (!isCheckpointAllowed) {
            toast.error("Checkpoints are disabled by your assigned shift policy.");
            return;
        }
        if (!hasActiveSession) {
            toast.warning("You must Clock IN before marking a checkpoint.");
            return;
        }

        if (isCheckpointSelfieRequired) {
            handleOpenCheckpointModal();
        } else {
            await executeDirectCheckpoint();
        }
    };

    const executeDirectPunch = async (mode, explicitLateReason = null) => {
        const isGeoRequired = mode === 'IN'
            ? (myShift?.rules?.entry_requirements?.geofence ?? false)
            : (myShift?.rules?.exit_requirements?.geofence ?? false);

        if (isGeoRequired && !location.lat) {
            toast.error("Location not found");
            return;
        }

        const reason = explicitLateReason !== null ? explicitLateReason : (requireLateReason ? lateReasonText.trim() : null);

        setIsSubmitting(true);
        setCameraMode(mode);
        try {
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.lat ? 10 : null,
                address: location.address || null
            };

            if (reason) {
                payload.late_reason = reason;
            }

            if (mode === 'IN') {
                await attendanceService.timeIn(payload);
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                toast.success("Checked Out Successfully!");
            }

            closeCamera();
            setShowLateReasonModal(false);

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
            const errorMsg = error.message || "Attendance failed";
            const errorLower = errorMsg.toLowerCase();

            if (mode === 'IN' && errorLower.includes("late") && errorLower.includes("reason")) {
                setCameraMode(mode);
                setImgSrc(null);
                setRequireLateReason(true);
                setLateReasonMessage(errorMsg);
                setShowLateReasonModal(true);
                toast.warning(errorMsg);
            } else {
                closeCamera();
                setShowLateReasonModal(false);
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
        setShowLateReasonModal(false);
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
            ? Boolean(myShift?.rules?.entry_requirements?.selfie)
            : Boolean(myShift?.rules?.exit_requirements?.selfie);

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
                if (imgSrc) {
                    setOptimisticSelfies(prev => ({ ...prev, [selectedDate + '_in']: imgSrc }));
                }
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                if (imgSrc) {
                    setOptimisticSelfies(prev => ({ ...prev, [selectedDate + '_out']: imgSrc }));
                }
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

    const handleSubmitCorrection = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!correctionForm.date || !correctionForm.reason || !correctionForm.reason.trim()) {
            toast.error("Adjustment Date and Reason are required");
            return;
        }

        if (hasIncompleteSession) {
            toast.error("Cannot submit request with incomplete sessions. Please complete or remove all unmatched punch times.");
            return;
        }

        const deadlineDays = myShift?.rules?.correction_deadline ?? 30;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reqDate = new Date(correctionForm.date);
        reqDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - reqDate) / (1000 * 60 * 60 * 24));

        if ((minAllowedCorrectionDate && correctionForm.date < minAllowedCorrectionDate) || diffDays > deadlineDays) {
            toast.error(`Correction requests can only be submitted within ${deadlineDays} days of the attendance date.`);
            return;
        }

        // Validation for session overlaps (only if user customized punches on advanced timeline)
        if (showAdvancedOptions) {
            let validSessions = corrSessions.filter(s => s.time_in || s.time_out);

            for (let i = 0; i < validSessions.length; i++) {
                const sessionA = validSessions[i];
                if (isCheckpointRecord(sessionA) || sessionA.punch_type === 'normal') continue;
                const isOvernightA = Boolean(sessionA.time_in && sessionA.time_out && sessionA.time_in >= sessionA.time_out);

                for (let j = i + 1; j < validSessions.length; j++) {
                    const sessionB = validSessions[j];
                    if (isCheckpointRecord(sessionB) || sessionB.punch_type === 'normal') continue;
                    const isOvernightB = Boolean(sessionB.time_in && sessionB.time_out && sessionB.time_in >= sessionB.time_out);
                    if (sessionA.time_in && sessionA.time_out && sessionB.time_in && sessionB.time_out) {
                        if (!isOvernightA && !isOvernightB && sessionA.time_in < sessionB.time_out && sessionA.time_out > sessionB.time_in) {
                            toast.error(`Sessions cannot overlap: ${sessionA.time_in} to ${sessionA.time_out} with ${sessionB.time_in} to ${sessionB.time_out}`);
                            return;
                        }
                    }
                }
            }
        }

        setShowConfirmSubmit(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitLoading(true);
        try {
            const original_data = originalSessions || [];
            let validSessions = corrSessions.filter(s => s.time_in || s.time_out);
            let proposed_data = [];

            if (showAdvancedOptions && validSessions.length > 0) {
                proposed_data = validSessions.map(s => {
                    const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                    const isOvernight = Boolean(!isChk && s.time_in && s.time_out && s.time_in >= s.time_out);
                    return {
                        ...(s.time_in ? { time_in: s.time_in } : {}),
                        ...(s.time_out && !isChk ? { time_out: s.time_out } : {}),
                        punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                        is_overnight: isOvernight,
                        ...(s.address ? { address: s.address } : {})
                    };
                });
            } else if (original_data && original_data.length > 0) {
                // If user didn't customize punches, preserve originally recorded punches as starting punch baseline
                proposed_data = original_data.map(s => {
                    const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                    return {
                        ...(s.time_in ? { time_in: s.time_in } : {}),
                        ...(s.time_out && !isChk ? { time_out: s.time_out } : {}),
                        punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                        ...(s.address ? { address: s.address } : {})
                    };
                });
            } else {
                proposed_data = [];
            }

            const formData = new FormData();
            formData.append('correction_type', correctionForm.type === 'summary' ? 'summary' : 'punch');
            formData.append('request_date', correctionForm.date);

            const categoryTag = correctionForm.type === 'Other' && correctionForm.otherType ? correctionForm.otherType.trim() : correctionForm.type;
            const formattedReason = categoryTag ? `[${categoryTag}] ${correctionForm.reason.trim()}` : correctionForm.reason.trim();
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
                toast.success("Adjustment request submitted successfully!");
            }

            setShowConfirmSubmit(false);
            setIsCorrectionOpen(false);
            setCorrAttachment(null);
            setCorrAttachmentPreview(null);
            setExistingAttachmentUrl(null);
            setPendingRequestId(null);
            setShowAdvancedOptions(false);
            setCorrectionForm({ type: 'Missed Punch', otherType: '', date: getLocalDateString(), reason: '', in_time: '', out_time: '', document: null });
            fetchCorrectionHistory();
            fetchDailyRecords(true);
            fetchMonthlyRecords(true);
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const reqId = Number(params.get('requestId') || params.get('acr_id') || params.get('id'));
        if (reqId) {
            handleRequestClick({ acr_id: reqId });
        }
    }, [window.location.search]);


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
        return formatPlatformDate(dateStr) || 'Unknown Date';
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
        const daysMap = {};
        (monthlySessions || []).forEach(session => {
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

        // Incorporate Absent days for selected reportMonth
        if (reportMonth) {
            const [rYear, rMonth] = reportMonth.split('-').map(Number);
            injectAbsentDaysIntoHistory({
                daysMap,
                year: rYear,
                monthIndex: rMonth - 1,
                todayStr,
                monthlyDailySummaries,
                holidays: myShift?.holidays || [],
                myShift
            });
        }

        if (Object.keys(daysMap).length === 0) return [];

        const processed = Object.values(daysMap).map(day => {
            if (day.dayStatus === 'ABSENT') {
                return day;
            }

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
    }, [monthlySessions, reportMonth, monthlyDailySummaries, myShift]);

    const hasActiveSession = dailySessions.some(s => !s.time_out);

    return (
        <MobileDashboardLayout title="Attendance" hideScrollbar={true} contentClassName="p-0 space-y-0">
            <div className="pb-24 no-scrollbar w-full">
                {/* Premium Header / Greeting */}
                <div className="w-full px-4 sm:px-5 pt-4 pb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-[#0a0d14] dark:via-[#0e1320] dark:to-[#0a0d14] rounded-b-2xl border-b border-indigo-500/20 shadow-xl relative overflow-hidden">
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

                    <div className="relative z-10 space-y-3.5">
                        <AttendancePermissionsBanner
                            onPermissionsUpdated={(permStatus) => {
                                if (permStatus.location === 'granted' && (location.error || location.address?.includes('Denied'))) {
                                    fetchUserLocation();
                                }
                            }}
                        />
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                                    Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.user_name?.split(' ')[0] || 'User'}!
                                </h1>
                                <p className="text-indigo-200/80 text-xs font-normal mt-0.5">
                                    {formatPlatformDate(currentTime)}
                                </p>
                            </div>

                        </div>

                        {/* Current Time Widget */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-3.5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-indigo-500/30 rounded-xl flex items-center justify-center text-white shrink-0">
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-indigo-200 tracking-wider">Current Time</span>
                                    <span className="text-lg sm:text-xl font-bold text-white font-mono">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[9px] font-bold text-indigo-200 tracking-wider mb-0.5">Location</span>
                                <div className="flex items-center gap-1.5 text-white/90 font-semibold text-[11px] bg-white/5 px-2.5 py-1 rounded-full border border-white/5 max-w-[150px] truncate">
                                    <MapPin size={11} className="text-indigo-300 shrink-0" />
                                    <span className="truncate">{isLoadingLoc ? 'Locating...' : location.address}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher - Floating Style - Standardized */}
                <div className="px-3.5 sm:px-4 -mt-4 relative z-20">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1 flex rounded-xl backdrop-blur-md border border-white/20 dark:border-white/5 shadow-md">
                        <button
                            onClick={() => handleMainTabChange('attendance')}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                mainTab === 'attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <User size={13} />
                            Attendance
                        </button>
                        <button
                            onClick={() => handleMainTabChange('my_attendance')}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                mainTab === 'my_attendance'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <History size={13} />
                            My Attendance
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="px-3.5 sm:px-4 pt-3.5">
                    <AnimatePresence mode="wait">
                        {mainTab === 'attendance' ? (
                            <motion.div
                                key="attendance-tab"
                                custom={direction}
                                variants={{
                                    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
                                    center: { x: 0, opacity: 1 },
                                    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0, position: 'absolute', width: '100%' })
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
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button
                                        onClick={() => !hasActiveSession && !isSubmitting && handlePunchClick('IN')}
                                        disabled={hasActiveSession || isSubmitting}
                                        className={`group relative p-3 sm:p-3.5 rounded-xl flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-2xs active:scale-[0.99]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                                hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                                            }`}>
                                                <ArrowRight size={18} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-sm font-bold tracking-tight ${hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {isSubmitting && cameraMode === 'IN' && !showCamera ? 'Processing...' : 'Time In'}
                                                </h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mt-0.5">
                                                    {hasActiveSession ? 'Session active' : 'Start shift for today'}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Mark Checkpoint Button */}
                                    <button
                                        onClick={() => hasActiveSession && !isSubmitting && !isMarkingCheckpoint && handleCheckpointClick()}
                                        disabled={!hasActiveSession || isSubmitting || isMarkingCheckpoint}
                                        className={`group relative p-3 sm:p-3.5 rounded-xl flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            !hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-2xs active:scale-[0.99]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${
                                                !hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                                            }`}>
                                                <MapPin size={18} strokeWidth={2.5} className={hasActiveSession ? 'animate-bounce' : ''} />
                                                {hasActiveSession && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-sm font-bold tracking-tight ${!hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {isMarkingCheckpoint ? 'Marking...' : 'Mark Checkpoint'}
                                                </h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mt-0.5">
                                                    {!hasActiveSession ? 'Requires active session' : 'Record mid-shift location'}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => hasActiveSession && !isSubmitting && handlePunchClick('OUT')}
                                        disabled={!hasActiveSession || isSubmitting}
                                        className={`group relative p-3 sm:p-3.5 rounded-xl flex items-center justify-between transition-all duration-300 overflow-hidden border ${
                                            !hasActiveSession
                                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-white/5 opacity-40'
                                                : 'bg-white dark:bg-[#000000] border-slate-100 dark:border-white/10 shadow-2xs active:scale-[0.99]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                                !hasActiveSession 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' 
                                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                                            }`}>
                                                <LogOut size={18} strokeWidth={2.5} />
                                            </div>
                                            <div className="text-left">
                                                <h3 className={`text-sm font-bold tracking-tight ${!hasActiveSession ? 'text-slate-300 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {isSubmitting && cameraMode === 'OUT' && !showCamera ? 'Processing...' : 'Time Out'}
                                                </h3>
                                                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mt-0.5">
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

                                    <div className="flex gap-2 overflow-x-auto py-2.5 px-0.5 no-scrollbar scroll-smooth">
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
                                                    className={`flex flex-col items-center justify-center min-w-[48px] h-14 rounded-xl transition-all duration-200 ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-bold' 
                                                            : 'bg-white dark:bg-github-dark-subtle text-slate-400 dark:text-github-dark-muted border border-slate-100 dark:border-github-dark-border'
                                                    }`}
                                                >
                                                    <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">
                                                        {dayName}
                                                    </span>
                                                    <span className="text-sm font-bold mt-0.5">{date.getDate()}</span>
                                                    {isToday && !isSelected && <div className="w-1 h-1 bg-indigo-500 rounded-full mt-0.5"></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Today's Activity */}
                                <div className="pt-3">
                                    <div className="flex items-center justify-between mb-2.5 px-0.5">
                                        <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-github-dark-text tracking-tight">
                                            {selectedDate === getLocalDateString() ? "Today's Logs" : `Logs for ${formatPlatformDate(selectedDate)}`}
                                        </h3>
                                        <button 
                                            onClick={() => {
                                                const targetDate = selectedDate || getLocalDateString();
                                                setCorrectionForm(prev => ({ ...prev, date: targetDate }));
                                                loadCorrectionDataForDate(targetDate);
                                                setIsCorrectionOpen(true);
                                            }} 
                                            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-xs bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-full active:scale-95 transition-all cursor-pointer shadow-2xs"
                                        >
                                            <Plus size={13} /> Correction
                                        </button>
                                    </div>

                                    <div className="space-y-2.5">
                                        {(() => {
                                            const rawWorkSessions = Array.isArray(dailySessions) ? dailySessions.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal') : [];
                                            if (rawWorkSessions.length === 0) {
                                                return (
                                                    <div className="py-8 bg-white dark:bg-github-dark-subtle rounded-xl border-2 border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                                                        <div className="w-12 h-12 bg-slate-50 dark:bg-github-dark-border/50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                                                            <Calendar size={24} />
                                                        </div>
                                                        <p className="text-slate-400 text-xs font-semibold">No records found for today</p>
                                                    </div>
                                                );
                                            }

                                            // 1. Sort chronologically (earliest first) to determine natural Session #1, #2...
                                            const sortedChronological = [...rawWorkSessions].sort((a, b) => {
                                                const tA = new Date(a.time_in || 0).getTime();
                                                const tB = new Date(b.time_in || 0).getTime();
                                                return tA - tB;
                                            });

                                            // 2. Attach sequential session number (Session #1 for day's first punch, etc.)
                                            const numberedSessions = sortedChronological.map((s, idx) => ({
                                                ...s,
                                                sessionNumber: idx + 1
                                            }));

                                            // 3. Stack format: The day's last session is at the top of the page,
                                            // and the day's first session (Session #1) is at the bottom of the page.
                                            const stackedSessions = [...numberedSessions].reverse();

                                            return stackedSessions.map((s, idx) => {
                                                const isLatestSession = idx === 0;
                                                const timeInImg = resolveImageUrl(s.time_in_image || s.time_in_image_url || s.time_in_photo || s.timeInImage)
                                                    || (isLatestSession ? optimisticSelfies[selectedDate + '_in'] : null);
                                                const timeOutImg = resolveImageUrl(s.time_out_image || s.time_out_image_url || s.time_out_photo || s.timeOutImage)
                                                    || (isLatestSession ? optimisticSelfies[selectedDate + '_out'] : null);

                                                return (
                                                <div key={s.acr_id || s.id || s.time_in || `session-${s.sessionNumber}`} className="bg-white dark:bg-github-dark-subtle p-3 rounded-xl border border-slate-100 dark:border-github-dark-border shadow-2xs space-y-2.5 transition-all active:scale-[0.99]">
                                                    {/* Session Header */}
                                                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-50 dark:border-github-dark-border/10">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted tracking-wider flex items-center gap-1.5">
                                                            <Clock size={11} /> Session #{s.sessionNumber}
                                                        </span>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.late_minutes > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {s.late_minutes > 0 ? 'Late' : 'On Time'}
                                                    </span>
                                                </div>

                                                {/* IN/OUT Sections Grid */}
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {/* Time In Section */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                                                                <ArrowUpRight size={14} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-bold text-slate-400 dark:text-github-dark-muted tracking-wider leading-none mb-0.5">Time In</span>
                                                                <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text font-mono truncate block">{formatTime(s.time_in, s, false)}</span>
                                                            </div>
                                                        </div>
                                                        {timeInImg && (
                                                            <div 
                                                                onClick={() => setPreviewImage(timeInImg)}
                                                                className="w-full flex justify-center cursor-pointer relative group active:scale-95 transition-all mt-1"
                                                            >
                                                                <img 
                                                                    src={timeInImg} 
                                                                    alt="Time In Selfie" 
                                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                    className="w-full h-20 rounded-xl shadow-xs object-cover border border-slate-100 dark:border-github-dark-border" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                                    <Eye size={16} className="text-white drop-shadow-md" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Time Out Section */}
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
                                                                <ArrowDownRight size={14} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-[9px] font-bold text-slate-400 dark:text-github-dark-muted tracking-wider leading-none mb-0.5">Time Out</span>
                                                                <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text font-mono truncate block">{formatTime(s.time_out, s, true)}</span>
                                                            </div>
                                                        </div>
                                                        {timeOutImg && (
                                                            <div 
                                                                onClick={() => setPreviewImage(timeOutImg)}
                                                                className="w-full flex justify-center cursor-pointer relative group active:scale-95 transition-all mt-1"
                                                            >
                                                                <img 
                                                                    src={timeOutImg} 
                                                                    alt="Time Out Selfie" 
                                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                    className="w-full h-20 rounded-xl shadow-xs object-cover border border-slate-100 dark:border-github-dark-border" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                                    <Eye size={16} className="text-white drop-shadow-md" />
                                                                </div>
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
                                                            {!s.time_out && (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCheckpointClick}
                                                                    disabled={isMarkingCheckpoint}
                                                                    className="text-[9px] font-black text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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
                                                                            ) : null}

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
                                            );
                                        });
                                    })()}
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
                                <div className="flex items-center gap-4 sm:gap-5 px-1 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-white/5 mb-1.5">
                                    {SUB_TABS.map((sub) => {
                                        const isActive = subTab === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSubTabChange(sub.id)}
                                                className={`flex items-center gap-1.5 py-2 relative transition-all duration-300 whitespace-nowrap ${
                                                    isActive 
                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                        : 'text-slate-400 dark:text-github-dark-muted'
                                                }`}
                                            >
                                                <sub.icon size={14} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                                                <span className={`text-[10px] font-medium uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
                                        className="space-y-3 pt-2"
                                    >
                                        {subTab === 'history' && (
                                            <div className="space-y-3">
                                                {groupedHistoryDays.length > 0 ? groupedHistoryDays.map((day) => {
                                                    const isExpanded = expandedDays.has(day.dateKey);
                                                    const totalHoursDisplay = day.totalDayHours > 0 
                                                        ? `${day.totalDayHours} hrs` 
                                                        : (day.hasOpenSession ? '--:--' : '0 hrs');

                                                    return (
                                                        <div 
                                                            key={day.dateKey} 
                                                            className={`bg-white dark:bg-github-dark-subtle rounded-xl border transition-all duration-200 shadow-2xs overflow-hidden ${
                                                                isExpanded 
                                                                    ? 'border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-500/20' 
                                                                    : 'border-slate-100 dark:border-github-dark-border'
                                                            }`}
                                                        >
                                                            {/* Day Header Summary */}
                                                            <div 
                                                                onClick={() => toggleDayExpansion(day.dateKey)}
                                                                className="p-3 sm:p-3.5 space-y-2.5 cursor-pointer select-none"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-10 h-12 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 border ${day.dayStatus === 'ABSENT' ? 'bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-slate-400 border-slate-200 dark:border-github-dark-border' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100/50'}`}>
                                                                        <span className="text-[9px] uppercase opacity-70 leading-none mb-0.5">{day.date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                                        <span className="text-base font-black leading-none">{day.date.getDate()}</span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-github-dark-text">
                                                                                {day.date.toLocaleDateString('en-US', { weekday: 'long' })}
                                                                            </h4>
                                                                            <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md border shadow-2xs ${
                                                                                day.dayStatus === 'MISSED_PUNCH' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200/50' :
                                                                                day.dayStatus === 'LATE' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200/50' :
                                                                                day.dayStatus === 'OVERTIME' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200/50' :
                                                                                day.dayStatus === 'ABSENT' ? 'bg-slate-100 dark:bg-github-dark-subtle text-slate-600 dark:text-slate-300 border-slate-200 dark:border-github-dark-border' :
                                                                                'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/50'
                                                                            }`}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${day.dayStatus === 'ABSENT' ? 'bg-slate-400' : 'bg-current'}`}></span>
                                                                                {day.dayStatus === 'MISSED_PUNCH' ? 'Missed Punch' : day.dayStatus === 'ABSENT' ? 'Absent' : day.dayStatus}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mt-0.5">
                                                                            <span className={day.sessions.length === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-indigo-600 dark:text-indigo-400 font-semibold'}>
                                                                                {day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full leading-none">
                                                                            {totalHoursDisplay}
                                                                        </span>
                                                                        <div className={`p-0.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}>
                                                                            <ChevronDown size={14} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* First / Last Punch Summary Bar */}
                                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 dark:border-github-dark-border/10">
                                                                    <div className="bg-slate-50/70 dark:bg-github-dark-border/20 p-2 rounded-xl">
                                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">First In</span>
                                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{formatTime(day.firstIn, day.firstSession, false) || '--:--'}</span>
                                                                    </div>
                                                                    <div className="bg-slate-50/70 dark:bg-github-dark-border/20 p-2 rounded-xl">
                                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Last Out</span>
                                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{day.lastOut ? formatTime(day.lastOut, day.lastSession, true) : (day.dayStatus === 'ABSENT' ? '--:--' : (day.isPastDay ? 'Missed Out' : '--:--'))}</span>
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
                                                                        className="border-t border-slate-100 dark:border-github-dark-border/40 bg-slate-50/40 dark:bg-white/[0.015] p-3 space-y-2.5"
                                                                    >
                                                                        <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                                                                            Individual Punches ({day.sessions.length})
                                                                        </div>

                                                                        {day.sessions.length === 0 ? (
                                                                            <div className="py-3 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                                                                                No attendance punches recorded for this day.
                                                                            </div>
                                                                        ) : (
                                                                            day.sessions.map((s, sIdx) => {
                                                                            const isSessionOpen = !s.time_out;
                                                                            const isSessionMissed = s.status === 'MISSED_PUNCH' || (day.isPastDay && isSessionOpen);
                                                                            const sessionStatus = isSessionMissed ? 'MISSED_PUNCH' : (isSessionOpen ? 'ACTIVE' : 'COMPLETED');
                                                                            const sStyle = getStatusStyle(sessionStatus);
                                                                            const sDuration = isSessionOpen 
                                                                                ? (isSessionMissed ? '' : '--:--') 
                                                                                : (s.total_hours ? `${s.total_hours} hrs` : (calculateHours(s.time_in, s.time_out) || 'N/A'));
                                                                            return (
                                                                                <div key={s.attendance_id || sIdx} className="bg-white dark:bg-github-dark-subtle p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border space-y-2 shadow-2xs">
                                                                                    <div className="flex items-center justify-between text-xs">
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">Session {sIdx + 1}</span>
                                                                                            {sessionStatus === 'MISSED_PUNCH' && (
                                                                                                <span className="px-1.5 py-0.2 rounded-full text-[8px] font-bold uppercase tracking-wider inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/40 text-slate-800 dark:text-white">
                                                                                                    <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                                                                                                    MISSED OUT
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        {sDuration && <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">{sDuration}</span>}
                                                                                    </div>

                                                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                        <div className="bg-slate-50/70 dark:bg-white/5 p-2 rounded-lg">
                                                                                            <span className="block text-[8px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">In</span>
                                                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{formatTime(s.time_in, s, false)}</span>
                                                                                            {s.time_in_image && (
                                                                                                <button onClick={() => setPreviewImage(s.time_in_image)} className="mt-1 w-6 h-6 rounded border border-white overflow-hidden block">
                                                                                                    <img src={s.time_in_image} alt="In" className="w-full h-full object-cover" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="bg-slate-50/70 dark:bg-white/5 p-2 rounded-lg">
                                                                                            <span className="block text-[8px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Out</span>
                                                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{s.time_out ? formatTime(s.time_out, s, true) : (s.status === 'MISSED_PUNCH' ? 'Missed Out' : '--:--')}</span>
                                                                                            {s.time_out_image && (
                                                                                                <button onClick={() => setPreviewImage(s.time_out_image)} className="mt-1 w-6 h-6 rounded border border-white overflow-hidden block">
                                                                                                    <img src={s.time_out_image} alt="Out" className="w-full h-full object-cover" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {s.late_minutes > 0 && (
                                                                                        <div className="p-1.5 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-lg flex items-center gap-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
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
                                                                        })                                                             )}
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
                                    <div className="space-y-4">
                                        {/* Date Filters Bar */}
                                        <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs space-y-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <Calendar size={14} />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Analytics Period</h4>
                                                    <p className="text-[9px] text-slate-400 dark:text-github-dark-muted font-normal mt-0.5">Filter statistics and trend charts</p>
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
                                                        className={`flex-1 min-w-[65px] py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all text-center whitespace-nowrap ${
                                                            analyticsFilterType === type.id
                                                                ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-2xs'
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
                                                <div className="grid grid-cols-2 gap-2.5">
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
                                            <div className="py-14 flex flex-col items-center justify-center bg-white dark:bg-github-dark-subtle rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Compiling Analytics Data...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Premium Stats Grid */}
                                                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                                                    <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                        <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 mb-2.5">
                                                            <CheckCircle size={16} />
                                                        </div>
                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Attendance</span>
                                                        <h4 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-0.5">{presentPercentage}%</h4>
                                                        <p className="text-[9px] font-medium text-slate-400 mt-0.5">{presentCount} Days Present</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                        <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 mb-2.5">
                                                            <Clock size={16} />
                                                        </div>
                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Avg Shift</span>
                                                        <h4 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-0.5">{avgHours}h</h4>
                                                        <p className="text-[9px] font-medium text-slate-400 mt-0.5">Per Working Day</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                        <div className="w-8 h-8 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600 mb-2.5">
                                                            <AlertCircle size={16} />
                                                        </div>
                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Late Arrival</span>
                                                        <h4 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-0.5">{lateCount}</h4>
                                                        <p className="text-[9px] font-medium text-slate-400 mt-0.5">{latePercentage}% of shifts</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                        <div className="w-8 h-8 bg-sky-50 dark:bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-600 mb-2.5">
                                                            <BarChart3 size={16} />
                                                        </div>
                                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Short Shifts</span>
                                                        <h4 className="text-xl font-black text-slate-800 dark:text-github-dark-text mt-0.5">{underHoursCount}</h4>
                                                        <p className="text-[9px] font-medium text-slate-400 mt-0.5">Under 8 Hours</p>
                                                    </div>
                                                </div>

                                                {/* Trends Chart */}
                                                <div className="bg-white dark:bg-github-dark-subtle p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-2xs">
                                                    <h3 className="text-[9px] font-bold text-slate-800 dark:text-github-dark-text uppercase tracking-wider mb-4 flex items-center justify-between opacity-70">
                                                        Daily Work Hours
                                                        <div className="flex items-center gap-1.5 text-indigo-500 font-semibold tracking-tight">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                            Trend
                                                        </div>
                                                    </h3>
                                                    <div className="h-40 -ml-4">
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
                                                                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'rgb(255 255 255 / 0.95)', fontSize: '11px' }}
                                                                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                                                                />
                                                                <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHours)" />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Download Action Section */}
                                                <div className="bg-indigo-600 rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden shadow-lg shadow-indigo-500/20">
                                                    <div className="relative z-10">
                                                        <h3 className="text-base sm:text-lg font-bold tracking-tight mb-1">Monthly Summary</h3>
                                                        <p className="text-indigo-100/80 text-[10px] sm:text-xs font-normal mb-3 max-w-[240px]">Download your detailed attendance report for {new Date(reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
                                                        <div className="mb-3.5">
                                                            <label className="block text-[8px] font-bold uppercase text-indigo-200 tracking-wider mb-1.5">File Format</label>
                                                            <select
                                                                value={fileFormat}
                                                                onChange={(e) => setFileFormat(e.target.value)}
                                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                                                            >
                                                                <option value="xlsx" className="text-slate-800">Excel (xlsx)</option>
                                                                <option value="csv" className="text-slate-800">CSV (csv)</option>
                                                                <option value="pdf" className="text-slate-800">PDF (pdf)</option>
                                                            </select>
                                                        </div>
                                                        <button
                                                            onClick={downloadReport}
                                                            disabled={isDownloading}
                                                            className="w-full py-2.5 bg-white text-indigo-600 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                                                        >
                                                            {isDownloading ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                                                            Download Report
                                                        </button>
                                                    </div>
                                                    {/* Abstract Background Element */}
                                                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-14 -mt-14 blur-2xl" />
                                                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-sky-400/20 rounded-full -ml-10 -mb-10 blur-2xl" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {subTab === 'corrections' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex gap-1.5">
                                                {['pending', 'history'].map(f => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setCorrectionFilter(f)}
                                                        className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                                            correctionFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-transparent border-slate-200 text-slate-400'
                                                        }`}
                                                    >
                                                        {f}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const todayStr = getLocalDateString();
                                                    setCorrectionForm(prev => ({ ...prev, date: todayStr }));
                                                    loadCorrectionDataForDate(todayStr);
                                                    setIsCorrectionOpen(true);
                                                }}
                                                className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                                            >
                                                <Plus size={13} />
                                                <span>Request</span>
                                            </button>
                                        </div>

                                        <div className="space-y-2.5">
                                            {filteredCorrections.length > 0 ? filteredCorrections.map((item, idx) => (
                                                <div
                                                    key={item.acr_id || item.request_id || item.id}
                                                    onClick={() => handleRequestClick(item)}
                                                    className="bg-white dark:bg-github-dark-subtle p-3 rounded-xl border border-slate-100 dark:border-github-dark-border shadow-2xs flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                                                            <FileText size={15} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-xs text-slate-800 dark:text-github-dark-text truncate max-w-[150px] leading-tight">{item.correction_type}</h4>
                                                            <p className="text-[9px] font-medium text-slate-400 uppercase mt-0.5">{formatCorrectionDate(item.request_date)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                                            item.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            item.status?.toLowerCase() === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                        }`}>
                                                            {item.status || 'PENDING'}
                                                        </span>
                                                        {item.status?.toLowerCase() === 'pending' && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const targetDate = item.request_date ? String(item.request_date).split('T')[0] : correctionForm.date;
                                                                    setCorrectionForm(prev => ({ ...prev, date: targetDate }));
                                                                    loadCorrectionDataForDate(targetDate);
                                                                    setIsCorrectionOpen(true);
                                                                }}
                                                                className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/50 dark:border-indigo-800/40 transition-colors"
                                                                title="Edit Request"
                                                            >
                                                                <Edit3 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="text-center text-slate-400 py-10 font-bold uppercase tracking-wider text-xs">No {correctionFilter} requests</p>
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
                        ? Boolean(myShift?.rules?.entry_requirements?.selfie)
                        : Boolean(myShift?.rules?.exit_requirements?.selfie);

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
                                {requireLateReason && (
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

            {/* Correction Modal / Bottom Sheet Drawer */}
            <AnimatePresence>
                {isCorrectionOpen && (
                    <motion.div
                        key="mobile-correction-drawer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9000] flex items-end justify-center sm:items-center p-0 sm:p-4"
                    >
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setIsCorrectionOpen(false)} 
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer" 
                        />
                        <motion.div 
                            initial={{ y: '100%' }} 
                            animate={{ y: 0 }} 
                            exit={{ y: '100%' }} 
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] border border-slate-200/80 dark:border-github-dark-border z-10 overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="px-4 pt-3 pb-3 border-b border-slate-100 dark:border-github-dark-border bg-gradient-to-r from-indigo-50/50 via-white to-transparent dark:from-github-dark-bg/60 dark:via-github-dark-subtle dark:to-transparent shrink-0">
                                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2.5 sm:hidden" />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-github-dark-text tracking-tight">
                                                Attendance Correction
                                            </h3>
                                            {pendingRequestId && (
                                                <span className="text-[10px] sm:text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                                                    Editing Request
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted font-normal mt-0.5">
                                            Submit or adjust punches for manager review
                                        </p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCorrectionOpen(false)} 
                                        className="p-2 rounded-xl bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90 cursor-pointer"
                                        title="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 no-scrollbar">
                                <form id="mobile-correction-form" onSubmit={handleSubmitCorrection} className="space-y-4">

                                    {/* Date & Category Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                        <div className="space-y-1.5">
                                            <MobileDatePicker
                                                label="Adjustment Date"
                                                value={correctionForm.date}
                                                onChange={(val) => {
                                                    setCorrectionForm(prev => ({ ...prev, date: val }));
                                                    loadCorrectionDataForDate(val);
                                                }}
                                                minDate={minAllowedCorrectionDate}
                                                maxDate={maxAllowedCorrectionDate}
                                            />
                                        </div>

                                        <div>
                                            <ThemedSelect
                                                label="Correction Category"
                                                value={correctionForm.type}
                                                onChange={(val) => setCorrectionForm(prev => ({ ...prev, type: val }))}
                                                options={[
                                                    { label: 'Missed Punch', value: 'Missed Punch' },
                                                    { label: 'Missed Day', value: 'Missed Day' },
                                                    { label: 'Other Reason', value: 'Other' }
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    {correctionForm.type === 'Other' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-1.5"
                                        >
                                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                                                Specify Other Category
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Biometric sensor failure, Travel exception..."
                                                value={correctionForm.otherType || ''}
                                                onChange={(e) => setCorrectionForm(prev => ({ ...prev, otherType: e.target.value }))}
                                                className="w-full h-10 px-3 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                                required
                                            />
                                        </motion.div>
                                    )}

                                    {/* Existing Correction Request Notice for Selected Date */}
                                    {existingRequestForCorrDate && (
                                        <div className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all text-xs ${
                                            (existingRequestForCorrDate.status || '').toLowerCase() === 'approved'
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
                                                : (existingRequestForCorrDate.status || '').toLowerCase() === 'rejected'
                                                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/50 text-rose-900 dark:text-rose-200'
                                                    : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                                        }`}>
                                            <div className="shrink-0 mt-0.5">
                                                {(existingRequestForCorrDate.status || '').toLowerCase() === 'approved' ? (
                                                    <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
                                                ) : (existingRequestForCorrDate.status || '').toLowerCase() === 'rejected' ? (
                                                    <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
                                                ) : (
                                                    <FileClock size={15} className="text-amber-600 dark:text-amber-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-xs">
                                                        {(existingRequestForCorrDate.status || '').toLowerCase() === 'approved'
                                                            ? 'Request Already Approved'
                                                            : (existingRequestForCorrDate.status || '').toLowerCase() === 'rejected'
                                                                ? 'Previous Request Rejected'
                                                                : 'Correction Request Raised for this Date'}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                                                        (existingRequestForCorrDate.status || '').toLowerCase() === 'approved'
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                                            : (existingRequestForCorrDate.status || '').toLowerCase() === 'rejected'
                                                                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                                                : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                                                    }`}>
                                                        {existingRequestForCorrDate.status || 'Pending'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] mt-1 leading-snug opacity-90 font-medium">
                                                    {(existingRequestForCorrDate.status || '').toLowerCase() === 'approved'
                                                        ? 'Attendance for this date was previously approved by management.'
                                                        : (existingRequestForCorrDate.status || '').toLowerCase() === 'rejected'
                                                            ? (existingRequestForCorrDate.review_comments ? `Admin remarks: "${existingRequestForCorrDate.review_comments}". You can submit a revised request below.` : 'Your previous request was rejected. You can submit revised details below.')
                                                            : 'A correction request has already been submitted for this day and is pending review. Submitting below will update your request.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Original Attendance Context Card */}
                                    <div className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-github-dark-bg/40 border border-slate-200 dark:border-github-dark-border rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <History size={16} className="text-slate-400 shrink-0" />
                                                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                                    Originally Logged on {formatCorrectionDate(correctionForm.date)}
                                                </span>
                                            </div>
                                            {originalSessions.length === 0 ? (
                                                <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 shrink-0">
                                                    No Punches Recorded
                                                </span>
                                            ) : originalSessions.some(s => s.time_in && !s.time_out) ? (
                                                <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5 shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Active Session
                                                </span>
                                            ) : (
                                                <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                                                    {originalSessions.length} Session{originalSessions.length > 1 ? 's' : ''} Recorded
                                                </span>
                                            )}
                                        </div>

                                        {/* Original Sessions List & Checkpoints */}
                                        {originalSessions.length > 0 ? (
                                            <div className="space-y-2 pt-0.5">
                                                {originalSessions.map((s, idx) => {
                                                    const isActive = Boolean(s.time_in && !s.time_out);
                                                    const checkpointsList = Array.isArray(s.checkpoints) ? s.checkpoints : [];
                                                    return (
                                                        <div key={idx} className="bg-white dark:bg-github-dark-subtle/80 p-3 rounded-xl border border-slate-200/80 dark:border-github-dark-border/60 space-y-2">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
                                                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                                                        Session #{idx + 1}
                                                                    </span>
                                                                    {isActive && (
                                                                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                                                                            In Progress
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                                                                    <span className={s.time_in ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                                                        {s.time_in ? (formatTime ? formatTime(`2000-01-01T${s.time_in}:00`) : s.time_in) : 'Missing In'}
                                                                    </span>
                                                                    <span className="text-slate-400 font-bold">→</span>
                                                                    <span className={s.time_out ? "text-rose-600 dark:text-rose-400" : "text-amber-500 dark:text-amber-400 italic"}>
                                                                        {s.time_out ? (formatTime ? formatTime(`2000-01-01T${s.time_out}:00`) : s.time_out) : 'Not Clocked Out'}
                                                                    </span>
                                                                    {s.time_in && s.time_out && (
                                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-github-dark-bg px-2 py-0.5 rounded-md ml-1">
                                                                            {calculateSessionDurationHours(s.time_in, s.time_out).toFixed(1)} hrs
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Checkpoints shown compactly */}
                                                            {checkpointsList.length > 0 && (
                                                                <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/60">
                                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                                        <MapPin size={13} className="text-amber-500 shrink-0" />
                                                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                                                            Checkpoints ({checkpointsList.length})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {checkpointsList.map((chk, cIdx) => {
                                                                            const selfieUrl = chk.image_url || chk.image;
                                                                            const chkTime = chk.punch_time ? (formatTime ? formatTime(chk.punch_time) : formatLocalTimeString(chk.punch_time)) : (chk.time || `Point #${cIdx + 1}`);
                                                                            const locLabel = chk.address ? chk.address.split(',')[0] : (chk.lat && chk.lng ? `${Number(chk.lat).toFixed(2)}, ${Number(chk.lng).toFixed(2)}` : null);
                                                                            return (
                                                                                <div
                                                                                    key={chk.id || cIdx}
                                                                                    onClick={() => selfieUrl && setPreviewImage(selfieUrl)}
                                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/40 ${selfieUrl ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40' : ''}`}
                                                                                    title={chk.address || (selfieUrl ? 'Click to view photo' : undefined)}
                                                                                >
                                                                                    {selfieUrl ? (
                                                                                        <Camera size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                                                    ) : (
                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                                    )}
                                                                                    <span>#{cIdx + 1}</span>
                                                                                    <span className="font-mono text-[11px] font-semibold">{chkTime}</span>
                                                                                    {locLabel && (
                                                                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
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
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 py-0.5">
                                                No mobile or biometric punches found for this date. Enter your requested session times below.
                                            </p>
                                        )}
                                    </div>

                                    {/* Reason Field */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
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
                                            className={`relative flex items-center gap-2.5 bg-white dark:bg-dark-card border rounded-xl px-3.5 py-2.5 min-h-[48px] shadow-2xs transition-all ${
                                                isDraggingFile
                                                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/30'
                                                    : 'border-slate-200 dark:border-github-dark-border focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500'
                                            }`}
                                        >
                                            <textarea
                                                value={correctionForm.reason}
                                                onChange={(e) => setCorrectionForm(prev => ({ ...prev, reason: e.target.value }))}
                                                placeholder="Write your message or reason for adjustment..."
                                                rows={1}
                                                onInput={(e) => {
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                                }}
                                                className="flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none min-h-[28px] max-h-32 py-0.5 px-0 leading-5"
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

                                            <button
                                                type="button"
                                                onClick={() => corrFileInputRef.current?.click()}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                                                title="Attach document, doctor's slip, or proof file"
                                            >
                                                <Paperclip size={18} />
                                            </button>
                                        </div>

                                        {/* Attached File Preview Chip / Existing Attachment */}
                                        {(corrAttachment || existingAttachmentUrl) && (
                                            <div className="space-y-2 pt-1">
                                                {corrAttachment && (
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/80 dark:border-github-dark-border text-xs">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {corrAttachmentPreview ? (
                                                                <img
                                                                    src={corrAttachmentPreview}
                                                                    alt="Attachment Preview"
                                                                    className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-github-dark-border cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                                                    onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                    title="Click to view full image"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                                    <FileText size={18} />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                                                    {corrAttachment.name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                    {(corrAttachment.size / 1024).toFixed(1)} KB • Document
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {corrAttachmentPreview && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewImage(corrAttachmentPreview)}
                                                                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-github-dark-border text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                                                    title="Preview file"
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCorrAttachment(null);
                                                                    setCorrAttachmentPreview(null);
                                                                    if (corrFileInputRef.current) corrFileInputRef.current.value = '';
                                                                }}
                                                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors cursor-pointer"
                                                                title="Remove file"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {existingAttachmentUrl && !corrAttachment && (
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-200/80 dark:border-github-dark-border text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Paperclip size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                            <span className="truncate font-bold text-slate-800 dark:text-slate-200 text-xs">Existing attached proof</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewImage(existingAttachmentUrl)}
                                                                className="text-xs font-bold underline text-indigo-600 dark:text-indigo-400 hover:opacity-80 flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Eye size={13} /> View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExistingAttachmentUrl(null)}
                                                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                                                title="Remove existing file"
                                                            >
                                                                <Trash2 size={14} />
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
                                            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-github-dark-bg/60 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                    <Clock size={15} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                                                        Advanced
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-github-dark-border text-slate-600 dark:text-slate-300">
                                                        Optional
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {corrSessions.filter(s => s.time_in || s.time_out).length > 0 ? (
                                                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                                                        {totalProposedHours.toFixed(2)} hrs
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-github-dark-bg px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-github-dark-border/60">
                                                        Not Set
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
                                                    className="overflow-hidden border-t border-slate-200 dark:border-github-dark-border p-3.5 space-y-3 bg-white dark:bg-github-dark-subtle/50"
                                                >
                                                    {/* Quick helper actions */}
                                                    {originalSessions.length > 0 && (
                                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-github-dark-border/60">
                                                            <button
                                                                type="button"
                                                                onClick={handleResetCorrectionToOriginal}
                                                                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-github-dark-bg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-github-dark-border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                                            >
                                                                <RotateCcw size={13} /> Reset to Logged
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Interactive Visual Timeline */}
                                                    <div className="overflow-x-auto no-scrollbar">
                                                        <VisualCorrectionTimeline
                                                            requestData={{
                                                                original_data: originalSessions,
                                                                proposed_data: corrSessions.filter(s => s.time_in || s.time_out),
                                                                correction_type: correctionForm.type,
                                                                status: 'draft'
                                                            }}
                                                            editable={true}
                                                            shift={myShift}
                                                            frameless={true}
                                                            hideHeader={true}
                                                            scale={0.85}
                                                            onIncompleteChange={setTimelineHasIncomplete}
                                                            onSessionsChange={(updated) => {
                                                                setCorrSessions(updated.map((s, idx) => {
                                                                    const isChk = isCheckpointRecord(s) || s.punch_type === 'normal';
                                                                    return {
                                                                        id: `session-${idx}-${s.time_in || s.time_out}`,
                                                                        time_in: s.time_in || '',
                                                                        time_out: isChk ? '' : (s.time_out || ''),
                                                                        punch_type: isChk ? 'normal' : (s.punch_type || 'regular'),
                                                                        address: s.address || ''
                                                                    };
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </form>
                            </div>

                            {/* Modal Fixed Footer */}
                            <div className="px-3.5 sm:px-4 py-3 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/80 dark:bg-github-dark-bg/90 shrink-0 space-y-2.5">
                                <div className="flex items-center justify-between text-xs px-0.5">
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                                        Adjusted Work Time:
                                    </span>
                                    {corrSessions.filter(s => s.time_in || s.time_out).length > 0 ? (
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                            {totalProposedHours.toFixed(2)} hrs ({corrSessions.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal' && (s.time_in || s.time_out)).length} session{corrSessions.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal' && (s.time_in || s.time_out)).length !== 1 ? 's' : ''})
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                                            Optional (Per Remarks)
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSubmitCorrection}
                                    disabled={hasIncompleteSession || submitLoading}
                                    className={`w-full h-10 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
                                        hasIncompleteSession || submitLoading
                                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60 shadow-none'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99] cursor-pointer'
                                    }`}
                                    title={hasIncompleteSession ? "Please complete all session punch pairs (Clock IN & OUT) before requesting correction" : undefined}
                                >
                                    {submitLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            {pendingRequestId ? (
                                                <Check size={16} strokeWidth={2.5} />
                                            ) : (
                                                <Plus size={16} strokeWidth={2.5} />
                                            )}
                                            <span>{pendingRequestId ? 'Review & Update Request' : 'Request Correction'}</span>
                                        </>
                                    )}
                                </button>
                                {hasIncompleteSession && (
                                    <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1.5 pt-0.5">
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span>Please complete all session punch pairs (Clock IN &amp; OUT) before requesting correction</span>
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- CONFIRM SUBMISSION MODAL (REVIEW STEP) --- */}
            <AnimatePresence>
                {showConfirmSubmit && (
                    <motion.div
                        key="mobile-confirm-submit-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9000] flex items-end justify-center sm:items-center p-0 sm:p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
                            onClick={() => !submitLoading && setShowConfirmSubmit(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="relative bg-white dark:bg-github-dark-subtle w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-github-dark-border overflow-hidden z-10 flex flex-col max-h-[92vh] text-left"
                        >
                            <div className="px-3.5 pt-2.5 pb-2.5 border-b border-slate-100 dark:border-github-dark-border bg-gradient-to-r from-indigo-50/70 to-transparent dark:from-github-dark-bg/50 shrink-0">
                                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                            <FileClock size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-github-dark-text tracking-tight">Review Correction Request</h3>
                                            <p className="text-[11px] font-normal text-slate-500 dark:text-github-dark-muted">
                                                {pendingRequestId ? 'Updating Existing Request' : 'New Request Submission'}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => !submitLoading && setShowConfirmSubmit(false)} 
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-github-dark-bg transition-colors cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 sm:p-3.5 space-y-3 overflow-y-auto flex-1 no-scrollbar">
                                {/* Date & Category Banner */}
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-bg/60 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                    <div>
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Target Date</span>
                                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-github-dark-text mt-0.5">{formatCorrectionDate(correctionForm.date)}</p>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                                        {correctionForm.type === 'Other' && correctionForm.otherType ? correctionForm.otherType : correctionForm.type}
                                    </span>
                                </div>

                                {/* Proposed Punches Summary */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between px-0.5">
                                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Proposed Punches</span>
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                                            Total: {totalProposedHours.toFixed(2)} hrs
                                        </span>
                                    </div>
                                    <div className="p-3 bg-slate-50/60 dark:bg-github-dark-bg/40 border border-slate-100 dark:border-github-dark-border rounded-xl space-y-2">
                                        {(() => {
                                            const activeItems = corrSessions.filter(s => s.time_in || s.time_out);
                                            const workSessions = activeItems.filter(s => !isCheckpointRecord(s) && s.punch_type !== 'normal');
                                            const checkpoints = activeItems.filter(s => isCheckpointRecord(s) || s.punch_type === 'normal');

                                            if (activeItems.length === 0) {
                                                return (
                                                    <div className="py-0.5">
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                            No custom timeline punches specified.
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                            Request will be processed based on your stated remarks & attached proof document.
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-2">
                                                    {/* Work Sessions */}
                                                    {workSessions.length > 0 && (
                                                        <div className="space-y-1">
                                                            {workSessions.map((s, idx) => {
                                                                const isOvernight = Boolean(s.time_in && s.time_out && s.time_in >= s.time_out);
                                                                const duration = calculateSessionDurationHours(s.time_in, s.time_out);
                                                                return (
                                                                    <div key={s.id || idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-github-dark-border/50 last:border-0">
                                                                        <span className="font-medium text-slate-500 dark:text-slate-400">Session #{idx + 1}</span>
                                                                        <div className="flex items-center gap-1.5 font-mono">
                                                                            <span className="text-emerald-600 dark:text-emerald-400">{s.time_in ? (formatTime ? formatTime(`2000-01-01T${s.time_in}:00`) : s.time_in) : 'Missing In'}</span>
                                                                            <span className="text-slate-400">→</span>
                                                                            <span className="text-rose-600 dark:text-rose-400">{s.time_out ? (formatTime ? formatTime(`2000-01-01T${s.time_out}:00`) : s.time_out) : 'Missing Out'}</span>
                                                                            {isOvernight && (
                                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-sans">Overnight</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{duration.toFixed(1)} hrs</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Checkpoints Section */}
                                                    {checkpoints.length > 0 && (
                                                        <div className={`space-y-1 ${workSessions.length > 0 ? 'pt-2 border-t border-slate-200/60 dark:border-github-dark-border/60' : ''}`}>
                                                            <div className="flex items-center gap-1 px-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                                <MapPin size={11} className="shrink-0" />
                                                                <span>Checkpoints ({checkpoints.length})</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {checkpoints.map((chk, cIdx) => {
                                                                    const chkTime = chk.time_in ? (formatTime ? formatTime(`2000-01-01T${chk.time_in}:00`) : chk.time_in) : '--:--';
                                                                    return (
                                                                        <div key={chk.id || cIdx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                                <span className="font-medium text-amber-900 dark:text-amber-300 text-[11px]">Point #{cIdx + 1}</span>
                                                                                <span className="font-mono text-slate-700 dark:text-slate-200 text-[11px]">{chkTime}</span>
                                                                                {chk.address && (
                                                                                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]" title={chk.address}>
                                                                                        • {chk.address}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium shrink-0">
                                                                                Logged
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Reason & Attachment Info */}
                                <div className="space-y-1 px-0.5">
                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Reason</span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-normal bg-slate-50/50 dark:bg-github-dark-bg/30 p-2.5 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                        "{correctionForm.reason}"
                                    </p>
                                </div>

                                {(corrAttachment || existingAttachmentUrl) && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-normal">
                                        <Paperclip size={13} className="shrink-0" />
                                        <span className="truncate">{corrAttachment ? corrAttachment.name : 'Existing proof document attached'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 border-t border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/80 flex items-center gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmSubmit(false)}
                                    disabled={submitLoading}
                                    className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-github-dark-muted hover:bg-slate-200/60 dark:hover:bg-github-dark-bg rounded-xl transition-all cursor-pointer"
                                >
                                    Back to Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmSubmit}
                                    disabled={submitLoading}
                                    className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {submitLoading ? <RefreshCw className="animate-spin" size={14} /> : "Submit Request"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Request Details Drawer Modal */}
            <AnimatePresence>
                {selectedRequest && (
                    <motion.div
                        key="mobile-selected-request-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9000] flex items-end justify-center sm:items-center p-0 sm:p-4"
                    >
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setSelectedRequest(null)} 
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
                        />
                        <motion.div 
                            initial={{ y: '100%' }} 
                            animate={{ y: 0 }} 
                            exit={{ y: '100%' }} 
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200/80 dark:border-github-dark-border z-10 overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="px-3.5 pt-2.5 pb-2.5 border-b border-slate-100 dark:border-github-dark-border shrink-0">
                                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-github-dark-text">Request Details</h3>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedRequest(null)} 
                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-github-dark-bg rounded-lg transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3 no-scrollbar">
                                {/* Status Header Card */}
                                <div className="flex items-center gap-2.5 bg-slate-50/50 dark:bg-github-dark-bg p-3 rounded-xl border border-slate-200 dark:border-github-dark-border">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                                        selectedRequest.status?.toLowerCase() === 'approved' 
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20' 
                                            : selectedRequest.status?.toLowerCase() === 'rejected'
                                                ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20'
                                                : 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20'
                                    }`}>
                                        {selectedRequest.status?.toLowerCase() === 'approved' && <CheckCircle size={16} />}
                                        {selectedRequest.status?.toLowerCase() === 'rejected' && <XCircle size={16} />}
                                        {selectedRequest.status?.toLowerCase() !== 'approved' && selectedRequest.status?.toLowerCase() !== 'rejected' && <Clock size={16} />}
                                    </div>
                                    <div>
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                            selectedRequest.status?.toLowerCase() === 'approved' 
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                                                : selectedRequest.status?.toLowerCase() === 'rejected'
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                        }`}>
                                            {selectedRequest.status || 'PENDING'}
                                        </span>
                                        <p className="text-[11px] text-slate-500 dark:text-github-dark-muted mt-0.5 font-normal">
                                            Submitted on {selectedRequest.submitted_at ? formatPlatformDate(selectedRequest.submitted_at) : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-2.5 rounded-xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">Request Date</span>
                                        <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text block truncate">
                                            {selectedRequest.request_date ? formatPlatformDate(selectedRequest.request_date) : 'Invalid Date'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-2.5 rounded-xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">Correction Type</span>
                                        <span className="text-xs font-semibold text-slate-800 dark:text-github-dark-text block truncate">
                                            {selectedRequest.correction_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div className="bg-slate-50/50 dark:bg-github-dark-bg p-3 rounded-xl border border-slate-200 dark:border-github-dark-border/50">
                                    <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">Reason for Request</span>
                                    <div className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                                        "{selectedRequest.reason}"
                                    </div>
                                </div>

                                {/* Proposed Attendance */}
                                {selectedRequest.correction_data && (
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-3 rounded-xl border border-slate-200 dark:border-github-dark-border/50">
                                        <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-2">Proposed Attendance</span>
                                        <div className="space-y-1.5">
                                            {(typeof selectedRequest.correction_data === 'string'
                                                ? JSON.parse(selectedRequest.correction_data).sessions
                                                : selectedRequest.correction_data.sessions || []
                                            ).sort((a, b) => (a.time_in || "").localeCompare(b.time_in || "")).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-lg shadow-2xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">In</span>
                                                        <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text font-mono">{s.time_in}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">Out</span>
                                                        <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text font-mono">{s.time_out}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Single Session Check */}
                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_in && (
                                                <div className="flex items-center justify-between p-2 bg-white dark:bg-github-dark-bg/60 border border-slate-200 dark:border-github-dark-border rounded-lg shadow-2xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">In</span>
                                                        <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text font-mono">
                                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_in}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">Out</span>
                                                        <span className="text-xs font-medium text-slate-800 dark:text-github-dark-text font-mono">
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
                                    <div className="bg-slate-50/50 dark:bg-github-dark-bg p-3 rounded-xl border border-slate-200 dark:border-github-dark-border/50 border-t-2 border-t-indigo-500">
                                        <span className="block text-[10px] font-semibold text-indigo-500 mb-1">Reviewer Decision</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-normal">
                                            {selectedRequest.review_comments || "No reviewer comments provided."}
                                        </p>
                                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-github-dark-border/50 text-[10px] text-slate-400 font-normal">
                                            Reviewed on {selectedRequest.reviewed_at ? formatPlatformDate(selectedRequest.reviewed_at) : 'N/A'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Fixed Footer */}
                            <div className="px-3.5 sm:px-4 py-2.5 bg-white dark:bg-github-dark-subtle border-t border-slate-100 dark:border-github-dark-border shrink-0 flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setSelectedRequest(null)}
                                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-bg dark:hover:bg-github-dark-border text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors text-center cursor-pointer"
                                >
                                    Close Details
                                </button>
                                {selectedRequest.status?.toLowerCase() === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetDate = selectedRequest.request_date ? String(selectedRequest.request_date).split('T')[0] : correctionForm.date;
                                            setSelectedRequest(null);
                                            setCorrectionForm(prev => ({ ...prev, date: targetDate }));
                                            loadCorrectionDataForDate(targetDate);
                                            setIsCorrectionOpen(true);
                                        }}
                                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Edit3 size={13} />
                                        <span>Edit Request</span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Standalone Late Reason Modal (No Camera Required) */}
            {showLateReasonModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLateReasonModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            className="relative w-full max-w-sm bg-white dark:bg-github-dark-surface rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-100 dark:border-github-dark-border z-10"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-github-dark-text tracking-tight">Late Check-In</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reason Required</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowLateReasonModal(false)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-github-dark-bg text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-github-dark-muted mb-3 font-medium leading-relaxed">
                                {lateReasonMessage || "You are checking in after the shift start time. Please provide a reason to complete your check-in."}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                                {['Traffic Delay', 'Public Transit', 'Medical Issue', 'Personal Emergency', 'Client Meeting'].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setLateReasonText(preset)}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-github-dark-bg text-slate-600 dark:text-github-dark-muted hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={lateReasonText}
                                onChange={(e) => setLateReasonText(e.target.value)}
                                placeholder="Explain why you are checking in late..."
                                rows={3}
                                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-800 dark:text-github-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium mb-3"
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLateReasonModal(false);
                                        setLateReasonText('');
                                    }}
                                    className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-slate-100 dark:bg-github-dark-bg text-slate-600 dark:text-github-dark-muted hover:bg-slate-200 dark:hover:bg-github-dark-border transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!lateReasonText.trim() || isSubmitting}
                                    onClick={() => executeDirectPunch('IN', lateReasonText.trim())}
                                    className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw size={13} className="animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <span>Confirm Check-In</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

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
