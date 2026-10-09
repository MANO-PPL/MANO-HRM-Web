import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search, Filter, Clock, UserCheck, UserX, Activity, MapPin, Calendar,
    ChevronDown, FileText, CheckCircle, XCircle, AlertCircle, X, LogIn,
    LogOut, History, PieChart as PieChartIcon, BarChart as BarChartIcon,
    RefreshCcw, MoreVertical, LayoutGrid, ArrowRight, Eye, Info,
    ChevronRight, ChevronLeft, Map, Camera, Users, Check, Briefcase, TrendingUp, Sparkles,
    Plus, Paperclip, Coffee
} from 'lucide-react';
import api from '../../services/api';
import AiSummaryModal from './components/AiSummaryModal';
import { adminService } from '../../services/adminService';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import DatePicker from '../../components/DatePicker';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { formatPlatformDate } from '../../utils/dateUtils';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Tooltip as MapTooltip } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MAP_THEMES } from '../../config/mapConfig';

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Time parser and normalizer (consumes backend local time directly)
const parseTimeInTimezone = (r, isOut) => {
    const rawVal = isOut ? r.time_out : r.time_in;
    if (!rawVal) return null;
    
    if (rawVal instanceof Date) {
        return rawVal;
    }

    // If metadata has timestamp_utc, use it for exact universal point-in-time
    try {
        let meta = r.metadata;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        const metaUtc = isOut ? meta?.time_out?.timestamp_utc : meta?.time_in?.timestamp_utc;
        if (metaUtc) {
            const parsedUtc = new Date(metaUtc);
            if (!isNaN(parsedUtc.getTime())) return parsedUtc;
        }
    } catch (e) {}
    
    try {
        const str = String(rawVal).trim();
        const parts = str.split(/[- :T.]/);
        if (parts.length >= 5) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const hour = parseInt(parts[3], 10);
            const minute = parseInt(parts[4], 10);
            const second = parts[5] ? parseInt(parts[5], 10) : 0;
            const parsed = new Date(year, month, day, hour, minute, second);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date(str);
    } catch (err) {
        return null;
    }
};

const getCurrentTimeInTimezone = () => {
    return new Date();
};

const formatTotalTime = (totalMin, fallbackHours) => {
    let minutes = 0;
    if (totalMin > 0) {
        minutes = totalMin;
    } else if (fallbackHours > 0) {
        minutes = fallbackHours * 60;
    }
    
    if (minutes <= 0) return '-';
    
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hrs > 0 && mins > 0) {
        return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ${mins} ${mins === 1 ? 'min' : 'mins'}`;
    } else if (hrs > 0) {
        return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
    } else {
        return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
    }
};

const processAttendanceData = (staff, tz = 'UTC', selectedDateStr = null) => {
    const isSelectedSunday = selectedDateStr ? new Date(selectedDateStr + 'T12:00:00').getDay() === 0 : false;
    const mergedData = staff.map(u => {
        const daySessions = u.sessions || [];
        let totalMin = 0;
        const sessions = daySessions.map(r => {
            const inTime = parseTimeInTimezone(r, false);
            const formatTime = (d) => {
                if (!d) return '-';
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            };

            const inStr = formatTime(inTime);
            let outStr = '-';
            let isActive = !r.time_out && r.status !== 'MISSED_PUNCH' && r.status !== 'ABSENT';

            const outTime = parseTimeInTimezone(r, true);
            if (outTime) {
                outStr = formatTime(outTime);
                if (inTime) totalMin += Math.max(0, (outTime.getTime() - inTime.getTime()) / 60000);
            } else if (isActive && inTime) {
                const now = new Date();
                totalMin += Math.max(0, (now.getTime() - inTime.getTime()) / 60000);
            }

            const inLoc = r.time_in_address || (r.time_in_lat ? `${r.time_in_lat}, ${r.time_in_lng}` : 'Unknown');
            const outLoc = r.time_out_address || (r.time_out_lat ? `${r.time_out_lat}, ${r.time_out_lng}` : null);

            return {
                rawIn: inTime,
                rawOut: outTime,
                in: inStr,
                out: outStr,
                date: inTime ? formatPlatformDate(inTime) : 'N/A',
                isActive,
                inLocation: inLoc,
                outLocation: outLoc,
                lateMinutes: r.late_minutes || 0,
                isLate: (r.late_minutes || 0) > 0,
                lateReason: r.late_reason || r.lateReason || '',
                inImage: r.time_in_image,
                outImage: r.time_out_image,
                inLat: r.time_in_lat,
                inLng: r.time_in_lng,
                outLat: r.time_out_lat,
                outLng: r.time_out_lng
            };
        });

        // Standardize Status String to match frontend layout colors
        const statusMap = {
            'WEEK_OFF': 'Week Off',
            'Week Off': 'Week Off',
            'HOLIDAY': 'Holiday',
            'Holiday': 'Holiday',
            'LEAVE': 'Leave',
            'ON_LEAVE': 'Leave',
            'On Leave': 'Leave',
            'Leave': 'Leave',
            'ABSENT': 'Absent',
            'Absent': 'Absent',
            'PRESENT': 'Present',
            'Present': 'Present',
            'LATE': 'Late',
            'Late': 'Late',
            'OVERTIME': 'Overtime',
            'Overtime': 'Overtime',
            'MISSED_PUNCH': 'Missed Punch',
            'Missed Punch': 'Missed Punch',
            'HALF_DAY': 'Half Day',
            'Half Day': 'Half Day',
            'Active': 'Active',
            'Late Active': 'Late Active'
        };
        let status = statusMap[u.status] || (u.status && String(u.status).toUpperCase().includes('LEAVE') ? 'Leave' : (u.status || 'Absent'));

        // Sunday comes under Holiday (not Week Off)
        if (isSelectedSunday && status === 'Week Off') {
            status = 'Holiday';
        }

        const totalHrs = (status === 'Missed Punch' || status === 'Absent' || status === 'Leave' || status === 'Week Off' || status === 'Holiday')
            ? '0.0 hrs'
            : formatTotalTime(totalMin, u.total_hours > 0 ? Number(u.total_hours) : 0);
        const lastLocation = u.sessions && u.sessions.length > 0
            ? u.sessions[0].time_in_address || (u.sessions[0].time_in_lat ? `${u.sessions[0].time_in_lat}, ${u.sessions[0].time_in_lng}` : 'N/A')
            : 'N/A';

        const userLateMinutes = Number(u.late_minutes || 0);
        const userOvertimeHours = Number(u.overtime_hours || 0);
        const userOvertimeMinutes = Number(u.overtime_minutes || Math.round(userOvertimeHours * 60));

        const isLate = userLateMinutes > 0 || (u.status && String(u.status).toLowerCase().includes('late')) || sessions.some(s => s.isLate || s.lateMinutes > 0);
        const isOvertime = userOvertimeHours > 0 || userOvertimeMinutes > 0 || (u.status && String(u.status).toLowerCase().includes('overtime'));

        // Dynamic multi-status badges to support simultaneous Active/Present, Late, and Overtime
        let allStatuses = [];
        const isNonWorking = ['Absent', 'Week Off', 'Holiday', 'Leave'].includes(status);

        if (status === 'Late Active' || status === 'Active' || (sessions.some(s => s.isActive) && !isNonWorking)) {
            allStatuses.push('Active');
            if (isLate && !allStatuses.includes('Late')) allStatuses.push('Late');
            if (isOvertime && !allStatuses.includes('Overtime')) allStatuses.push('Overtime');
        } else if (status === 'Missed Punch') {
            allStatuses.push('Missed Punch');
            if (isLate && !allStatuses.includes('Late')) allStatuses.push('Late');
            if (isOvertime && !allStatuses.includes('Overtime')) allStatuses.push('Overtime');
        } else if (status === 'Half Day') {
            // A Half Day is already the backend's final determination for the day (it only ever
            // replaces what would otherwise have been Present/Late) — shown as its own distinct
            // badge, not re-decorated with a separate Late tag that would just be confusing.
            allStatuses.push('Half Day');
        } else if (status === 'Week Off') {
            allStatuses.push('Week Off');
        } else if (status === 'Holiday') {
            allStatuses.push('Holiday');
        } else if (status === 'Leave' || status === 'On Leave' || status === 'ON_LEAVE') {
            allStatuses.push('Leave');
        } else if (status === 'Absent') {
            allStatuses.push('Absent');
        } else {
            allStatuses.push('Present');
            if (isLate && !allStatuses.includes('Late')) allStatuses.push('Late');
            if (isOvertime && !allStatuses.includes('Overtime')) allStatuses.push('Overtime');
        }

        return {
            id: u.user_id,
            name: u.user_name || 'Unknown',
            role: u.desg_name || 'Employee',
            avatar: (u.profile_image_url && u.profile_image_url.trim() !== '') ? u.profile_image_url : (u.user_name ? u.user_name.trim().charAt(0).toUpperCase() : 'U') || 'U',
            department: u.dept_name || 'General',
            shift_id: u.shift_id,
            sessions,
            status,
            allStatuses,
            totalHours: totalHrs,
            location: lastLocation,
            lateReason: u.late_reason || u.lateReason || sessions.find(s => s.lateReason)?.lateReason || '',
            lateMinutes: userLateMinutes || (sessions.find(s => s.lateMinutes > 0)?.lateMinutes || 0),
            overtimeHours: userOvertimeHours,
            overtimeMinutes: userOvertimeMinutes,
            isLate,
            isOvertime
        };
    });

    // Sort: Active/Present/Late/Overtime first, then Absent, then Week Off/Holiday/Leave
    const statusWeights = {
        'Active': 10,
        'Late Active': 9,
        'Late': 8,
        'Overtime': 7,
        'Present': 6,
        'Half Day': 5.5,
        'Missed Punch': 5,
        'Absent': 4,
        'Leave': 3,
        'Holiday': 2,
        'Week Off': 1
    };
    mergedData.sort((a, b) => (statusWeights[b.status] || 0) - (statusWeights[a.status] || 0));

    return mergedData;
};

const MobileAttendanceMonitoring = () => {
    const { avatarTimestamp, user: currentUser } = useAuth();

    // Get initial values from localStorage to support persistent views/filters
    const initialSubTab = localStorage.getItem('live_attendance_active_sub_tab') || 'overview';
    const initialDate = localStorage.getItem('live_attendance_selected_date') || new Date().toISOString().split("T")[0];
    const initialSearch = localStorage.getItem('live_attendance_search_term') || '';
    const initialDept = localStorage.getItem('live_attendance_department_filter') || 'All';
    const initialStatus = localStorage.getItem('live_attendance_status_filter') || 'All';
    const initialShift = localStorage.getItem('live_attendance_shift_filter') || 'All';

    // Synchronous memory cache check
    const cachedResponse = attendanceCacheData.dailySummaryAdmin[initialDate];

    const [orgTimezone, setOrgTimezone] = useState(() => cachedResponse?.timezone || 'UTC');

    const formatHeaderDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    const calculateProposedHours = (req) => {
        try {
            let sessions = [];
            if (req.sessions && Array.isArray(req.sessions)) {
                sessions = req.sessions;
            } else if (req.correction_data) {
                const data = typeof req.correction_data === 'string' ? JSON.parse(req.correction_data) : req.correction_data;
                if (data?.sessions && Array.isArray(data.sessions)) sessions = data.sessions;
                else if (data?.time_in && data?.time_out) sessions = [data];
            } else if (req.time_in && req.time_out) {
                sessions = [{ time_in: req.time_in, time_out: req.time_out }];
            }

            let totalMin = 0;
            sessions.forEach(s => {
                if (s.time_in && s.time_out) {
                    const inParts = s.time_in.split(':').map(Number);
                    const outParts = s.time_out.split(':').map(Number);
                    const inMin = inParts[0] * 60 + inParts[1];
                    const outMin = outParts[0] * 60 + outParts[1];
                    if (outMin > inMin) totalMin += (outMin - inMin);
                }
            });
            return totalMin > 0 ? (totalMin / 60).toFixed(1) : null;
        } catch (e) {
            return null;
        }
    };

    const getRequestTypeStyle = (type) => {
        const typeStr = String(type).toLowerCase().replace(/_/g, ' ');
        if (typeStr.includes('overtime')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        }
        if (typeStr.includes('missed') || typeStr.includes('manual')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        }
        if (typeStr.includes('correction') || typeStr.includes('time') || typeStr.includes('adjustment')) {
            return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        }
        return 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-github-dark-muted dark:bg-github-dark-subtle';
    };
    const MAIN_TABS = ['dashboard', 'requests'];
    const SUB_TABS = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
        { id: 'timeline', label: 'Timeline', icon: History },
        { id: 'map', label: 'Map View', icon: MapPin }
    ];

    // UI State
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'requests') return 'requests';
        return 'dashboard';
    });
    const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'overview' | 'analytics' | 'timeline' | 'map'
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right
    const [loading, setLoading] = useState(() => !cachedResponse);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [activeTheme, setActiveTheme] = useState('voyager');
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

    // AI Summary State
    const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [aiSummaryData, setAiSummaryData] = useState(null);
    const [aiSummaryError, setAiSummaryError] = useState(null);

    // Data State
    const [attendanceData, setAttendanceData] = useState(() => {
        if (cachedResponse?.data) {
            return processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC', initialDate);
        }
        return [];
    });
    const [stats, setStats] = useState(() => {
        if (cachedResponse?.data) {
            const merged = processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC', initialDate);
            return {
                present: merged.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave' && d.status !== 'Half Day').length,
                late: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : (d.status.includes('Late') || d.isLate)).length,
                overtime: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Overtime') : (d.status.includes('Overtime') || d.isOvertime)).length,
                absent: merged.filter(d => d.status === 'Absent').length,
                halfDay: merged.filter(d => d.status === 'Half Day').length,
                active: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: merged.length
            };
        }
        return { present: 0, late: 0, overtime: 0, absent: 0, halfDay: 0, active: 0, total: 0 };
    });
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [requestCount, setRequestCount] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [selectedDept, setSelectedDept] = useState(initialDept);
    const [selectedDesg, setSelectedDesg] = useState('All');
    const [selectedShift, setSelectedShift] = useState(initialShift);
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const [isDesgDropdownOpen, setIsDesgDropdownOpen] = useState(false);
    const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);

    // Requests Tab Filters
    const [requestSearchTerm, setRequestSearchTerm] = useState('');
    const [requestFilterStatus, setRequestFilterStatus] = useState('All');

    // Selection/Popup State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestSubTab, setRequestSubTab] = useState('PENDING');

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [shifts, setShifts] = useState([]);

    const generateAiSummary = async () => {
        if (!attendanceData || attendanceData.length === 0) {
            toast.error("No attendance data available for the selected date to analyze.");
            return;
        }

        setIsAiSummaryOpen(true);
        setAiSummaryLoading(true);
        setAiSummaryError(null);
        try {
            let presentCount = 0;
            let lateCount = 0;
            const deptStats = {};

            attendanceData.forEach(emp => {
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                const isPresent = statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
                const isLate = statusLower.includes('late');

                if (isPresent) presentCount++;
                if (isLate) lateCount++;

                const dept = emp.department || 'Unassigned';
                if (!deptStats[dept]) deptStats[dept] = { present: 0, absent: 0, late: 0 };

                if (isPresent) deptStats[dept].present++;
                if (isLate) deptStats[dept].late++;
                if (statusLower.includes('absent')) deptStats[dept].absent++;
            });

            const total = attendanceData.length || 1;
            const analytics = {
                present_rate: Math.round((presentCount / total) * 100),
                late_rate: Math.round((lateCount / total) * 100),
                avg_work_hours: 8.0,
                department_breakdown: Object.keys(deptStats).map(dept => ({
                    department: dept,
                    present: deptStats[dept].present,
                    absent: deptStats[dept].absent,
                    late: deptStats[dept].late
                })),
                timeline_peaks: ["09:00", "17:00"]
            };

            const employees = attendanceData.map(emp => {
                const firstSession = emp.sessions && emp.sessions.length > 0 ? emp.sessions[0] : null;
                const lastSession = emp.sessions && emp.sessions.length > 0 ? emp.sessions[emp.sessions.length - 1] : null;

                let status = 'absent';
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                if (statusLower.includes('active') || statusLower.includes('present') || statusLower.includes('overtime')) {
                    status = 'present';
                }
                if (statusLower.includes('late')) {
                    status = 'late';
                }
                if (statusLower.includes('leave') || statusLower.includes('week off') || statusLower.includes('holiday')) {
                    status = 'on_leave';
                }
                if (statusLower.includes('absent')) {
                    status = 'absent';
                }

                return {
                    name: emp.name || 'Unknown',
                    department: emp.department || 'Unassigned',
                    status: status,
                    check_in: firstSession && firstSession.in !== '-' ? firstSession.in : null,
                    check_out: lastSession && lastSession.out !== '-' ? lastSession.out : null
                };
            });

            const payload = {
                date: selectedDate,
                total_employees: attendanceData.length,
                employees: employees,
                analytics: analytics
            };

            const res = await api.post('/attendance/ai-summary', payload);
            setAiSummaryData(res.data);
        } catch (err) {
            console.error("AI Summary Error:", err);
            let errorMessage = "Failed to generate AI summary. Please try again.";
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (typeof err.response?.data?.error === 'string') {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.error?.message) {
                errorMessage = err.response.data.error.message;
            }
            setAiSummaryError(errorMessage);
        } finally {
            setAiSummaryLoading(false);
        }
    };

    useEffect(() => {
        setAiSummaryData(null);
    }, [selectedDate]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const reqId = Number(params.get('requestId') || params.get('acr_id') || params.get('id'));
        if (tab === 'requests') {
            setActiveTab('requests');
        } else if (tab === 'dashboard' || tab === 'live') {
            setActiveTab('dashboard');
        }
        if (reqId && correctionRequests.length > 0) {
            const targetReq = correctionRequests.find(r => Number(r.acr_id) === reqId || Number(r.id) === reqId);
            if (targetReq) {
                setSelectedRequest(targetReq);
                if (targetReq.status && targetReq.status.toUpperCase() !== 'PENDING') {
                    setRequestSubTab('HISTORY');
                }
            }
        }
    }, [window.location.search, correctionRequests]);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const deptRes = await adminService.getDepartments();
                if (deptRes && deptRes.departments) {
                    const sortedDepts = [...deptRes.departments].sort((a, b) => a.dept_name.localeCompare(b.dept_name));
                    setDepartments(sortedDepts);
                }
            } catch (err) {
                console.error("Failed to load departments (mobile)", err);
            }
        };
        const fetchDesgs = async () => {
            try {
                const desgRes = await adminService.getDesignations();
                if (desgRes && desgRes.designations) {
                    const sortedDesgs = [...desgRes.designations].sort((a, b) => a.desg_name.localeCompare(b.desg_name));
                    setDesignations(sortedDesgs);
                }
            } catch (err) {
                console.error("Failed to load designations (mobile)", err);
            }
        };
        const fetchShifts = async () => {
            try {
                const shiftRes = await adminService.getShifts();
                if (shiftRes && shiftRes.shifts) {
                    const sortedShifts = [...shiftRes.shifts].sort((a, b) => a.shift_name.localeCompare(b.shift_name));
                    setShifts(sortedShifts);
                }
            } catch (err) {
                console.error("Failed to load shifts (mobile)", err);
            }
        };
        fetchDepts();
        fetchDesgs();
        fetchShifts();
    }, []);

    const DEPARTMENTS = ['All', ...departments.map(d => d.dept_name)];
    const DESIGNATIONS = ['All', ...designations.map(d => d.desg_name)];
    const SHIFTS = [
        { value: 'All', label: 'All Shifts' },
        { value: 'open_shift', label: 'Open Shift' },
        ...shifts.map(s => ({ value: s.shift_id, label: s.shift_name }))
    ];

    const handleTabChange = (newTab) => {
        const currentIndex = MAIN_TABS.indexOf(activeTab);
        const newIndex = MAIN_TABS.indexOf(newTab);
        setDirection(newIndex > currentIndex ? 1 : -1);
        setActiveTab(newTab);
    };

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        const today = new Date().toISOString().split('T')[0];
        if (date.toISOString().split('T')[0] <= today) {
            setSelectedDate(date.toISOString().split('T')[0]);
        }
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const handleDragEnd = (event, info) => {
        const swipeThreshold = 50;

        if (activeTab === 'dashboard') {
            const currentIndex = SUB_TABS.findIndex(t => t.id === activeSubTab);
            if (info.offset.x < -swipeThreshold && currentIndex < SUB_TABS.length - 1) {
                setActiveSubTab(SUB_TABS[currentIndex + 1].id);
            } else if (info.offset.x > swipeThreshold && currentIndex > 0) {
                setActiveSubTab(SUB_TABS[currentIndex - 1].id);
            }
        }
    };

    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0
        })
    };

    // Sync filter states to localStorage
    useEffect(() => {
        localStorage.setItem('live_attendance_active_sub_tab', activeSubTab);
    }, [activeSubTab]);

    useEffect(() => {
        localStorage.setItem('live_attendance_selected_date', selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        localStorage.setItem('live_attendance_search_term', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('live_attendance_department_filter', selectedDept);
    }, [selectedDept]);

    useEffect(() => {
        localStorage.setItem('live_attendance_shift_filter', selectedShift);
    }, [selectedShift]);

    useEffect(() => {
        localStorage.setItem('live_attendance_status_filter', statusFilter);
    }, [statusFilter]);

    // --- DATA FETCHING (Feature Parity with Web) ---
    const fetchData = async (silent = false, forceRefresh = false) => {
        const hasCache = !!attendanceCacheData.dailySummaryAdmin[selectedDate];
        if (!silent && !hasCache) setLoading(true);
        try {
            const [summaryRes, requestsRes] = await Promise.allSettled([
                attendanceService.getDailySummaryAdmin(selectedDate, forceRefresh),
                attendanceService.getCorrectionRequests({ limit: 50 })
            ]);

            const staff = (summaryRes.status === 'fulfilled' && summaryRes.value?.data) || [];
            const requests = (requestsRes.status === 'fulfilled' && requestsRes.value?.data) || [];
            const resolvedTz = (summaryRes.status === 'fulfilled' && summaryRes.value?.timezone) || 'UTC';
            setOrgTimezone(resolvedTz);

            // Merge Data Logic using helper
            const mergedData = processAttendanceData(staff, resolvedTz, selectedDate);

            setAttendanceData(mergedData);
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave' && d.status !== 'Half Day').length,
                late: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : (d.status.includes('Late') || d.isLate)).length,
                overtime: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Overtime') : (d.status.includes('Overtime') || d.isOvertime)).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                halfDay: mergedData.filter(d => d.status === 'Half Day').length,
                active: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: mergedData.length
            });

            setCorrectionRequests(requests);
            setRequestCount(requests.filter(r => (r.status || '').toLowerCase() === 'pending').length);

            // Auto-open specific request if requestId is in URL
            const urlParams = new URLSearchParams(window.location.search);
            const targetReqId = Number(urlParams.get('requestId') || urlParams.get('acr_id') || urlParams.get('id'));
            if (targetReqId && requests.length > 0) {
                const targetReq = requests.find(r => Number(r.acr_id) === targetReqId || Number(r.id) === targetReqId);
                if (targetReq) {
                    setSelectedRequest(targetReq);
                    if (targetReq.status && targetReq.status.toUpperCase() !== 'PENDING') {
                        setRequestSubTab('HISTORY');
                    }
                }
            }

        } catch (error) {
            console.error("Sync failed", error);
        } finally {
            if (!silent) setLoading(false);
            setLastSynced(new Date());
        }
    };

    useEffect(() => {
        fetchData(false, false);
        const interval = setInterval(() => fetchData(true, true), 15000);
        return () => clearInterval(interval);
    }, [activeTab, selectedDate]);

    // Theme Sync Effect
    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setActiveTheme(isDark ? 'dark' : 'voyager');

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const darkActive = document.documentElement.classList.contains('dark');
                    setActiveTheme(darkActive ? 'dark' : 'voyager');
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    // --- ANALYTICS DATA PROCESSING (Ported from Web) ---
    const chartData = useMemo(() => {
        if (!attendanceData.length) return { status: [], timeline: [], departments: [], frequency: [] };

        // 1. Status Pie
        const active = attendanceData.filter(d => d.status === 'Active' || d.status === 'Late Active').length;
        const present = attendanceData.filter(d => d.status === 'Present').length;
        const late = attendanceData.filter(d => d.status === 'Late').length;
        const overtime = attendanceData.filter(d => d.status === 'Overtime').length;
        const missedPunch = attendanceData.filter(d => d.status === 'Missed Punch').length;
        const absent = attendanceData.filter(d => d.status === 'Absent').length;
        const weekOff = attendanceData.filter(d => d.status === 'Week Off').length;
        const holiday = attendanceData.filter(d => d.status === 'Holiday').length;
        const leave = attendanceData.filter(d => d.status === 'Leave').length;

        const status = [
            { name: 'Active', value: active, color: '#3b82f6' },
            { name: 'Present', value: present, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' },
            { name: 'Overtime', value: overtime, color: '#8b5cf6' },
            { name: 'Missed Punch', value: missedPunch, color: '#f43f5e' },
            { name: 'Absent', value: absent, color: '#ef4444' },
            { name: 'Week Off', value: weekOff, color: '#6b7280' },
            { name: 'Holiday', value: holiday, color: '#0ea5e9' },
            { name: 'Leave', value: leave, color: '#a855f7' },
        ].filter(d => d.value > 0);

        // 2. Timeline (Hourly with Repeats)
        const hourlyData = {};
        for (let i = 0; i <= 23; i++) hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };

        attendanceData.forEach(item => {
            item.sessions.forEach((s, idx) => {
                const h = s.rawIn.getHours();
                if (hourlyData.hasOwnProperty(h)) {
                    if (idx === 0) hourlyData[h].checkins++;
                    else hourlyData[h].repeats++;
                }

                const outH = s.rawOut ? s.rawOut.getHours() : 23;
                for (let j = h; j <= outH; j++) {
                    if (hourlyData.hasOwnProperty(j)) hourlyData[j].active++;
                }
            });
        });

        const timeline = Object.keys(hourlyData).map(key => {
            const h = parseInt(key);
            const label = h === 0 ? '12AM' : h === 12 ? '12PM' : h > 12 ? `${h - 12}PM` : `${h}AM`;
            return {
                time: label,
                checkins: hourlyData[key].checkins,
                repeats: hourlyData[key].repeats,
                active: hourlyData[key].active
            };
        });

        // 3. Department Breakdown
        const deptStats = {};
        attendanceData.forEach(item => {
            const dept = item.department || 'General';
            if (!deptStats[dept]) deptStats[dept] = { name: dept, Present: 0, Absent: 0, Late: 0 };

            if (item.status === 'Absent') deptStats[dept].Absent++;
            else if (item.status.includes('Late')) deptStats[dept].Late++;
            else if (item.status !== 'Week Off' && item.status !== 'Holiday' && item.status !== 'Leave') deptStats[dept].Present++;
        });
        const departments = Object.values(deptStats);

        // 4. Login Frequency
        const freq = { '1 Session': 0, '2 Sessions': 0, '3 Sessions': 0, '4+ Sessions': 0 };
        attendanceData.forEach(item => {
            if (item.status !== 'Absent' && item.status !== 'Week Off' && item.status !== 'Holiday' && item.status !== 'Leave') {
                const count = item.sessions.length;
                if (count === 1) freq['1 Session']++;
                else if (count === 2) freq['2 Sessions']++;
                else if (count === 3) freq['3 Sessions']++;
                else if (count >= 4) freq['4+ Sessions']++;
            }
        });
        const frequency = Object.entries(freq).map(([name, value]) => ({ name, value }));

        return { status, timeline, departments, frequency };
    }, [attendanceData]);

    // --- FILTERED DATA ---
    const filteredEmployees = attendanceData.filter(e => {
        const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.role && e.role.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesDept = selectedDept === 'All' || selectedDept === 'All Departments' || (e.department && String(e.department) === String(selectedDept));
        const matchesDesg = selectedDesg === 'All' || (e.role && String(e.role) === String(selectedDesg));
        const matchesShift = selectedShift === 'All' || selectedShift === 'All Shifts' || (selectedShift === 'open_shift' ? !e.shift_id : String(e.shift_id) === String(selectedShift));

        let matchesStatus = true;
        if (statusFilter === 'present' || statusFilter === 'PRESENT') {
            matchesStatus = e.status !== 'Absent' && e.status !== 'Week Off' && e.status !== 'Holiday' && e.status !== 'Leave' && e.status !== 'Half Day';
        } else if (statusFilter === 'late' || statusFilter === 'LATE') {
            matchesStatus = e.allStatuses ? e.allStatuses.includes('Late') : (e.status.includes('Late') || e.isLate);
        } else if (statusFilter === 'overtime') {
            matchesStatus = e.allStatuses ? e.allStatuses.includes('Overtime') : (e.status.includes('Overtime') || e.isOvertime);
        } else if (statusFilter === 'halfDay') {
            matchesStatus = e.status === 'Half Day';
        } else if (statusFilter === 'absent' || statusFilter === 'ABSENT') {
            matchesStatus = e.status === 'Absent';
        } else if (statusFilter === 'active' || statusFilter === 'ACTIVE') {
            matchesStatus = e.allStatuses ? e.allStatuses.includes('Active') : e.status.includes('Active');
        } else if (statusFilter === 'on_leave' || statusFilter === 'ON_LEAVE') {
            matchesStatus = ['Leave', 'Week Off', 'Holiday'].includes(e.status);
        }

        return matchesSearch && matchesDept && matchesDesg && matchesShift && matchesStatus;
    });

    const presentEmployees = filteredEmployees.filter(e => e.status !== 'Absent');
    const absentEmployees = filteredEmployees.filter(e => e.status === 'Absent');
    const onLeaveCount = attendanceData.filter(e => ['Leave', 'Week Off', 'Holiday'].includes(e.status)).length;

    // Filtered requests for the Requests Tab
    const filteredRequests = useMemo(() => {
        return correctionRequests.filter(req => {
            const status = (req.status || 'PENDING').toUpperCase();
            const matchesStatus = 
                requestFilterStatus === 'All' ? true :
                requestFilterStatus === 'Pending' ? status === 'PENDING' :
                requestFilterStatus === 'Approved' ? status === 'APPROVED' :
                requestFilterStatus === 'Rejected' ? status === 'REJECTED' : true;
            
            const q = requestSearchTerm.trim().toLowerCase();
            const matchesSearch = !q ? true :
                (req.user_name || '').toLowerCase().includes(q) ||
                (req.user_id || '').toString().toLowerCase().includes(q) ||
                (req.reason || '').toLowerCase().includes(q) ||
                (req.correction_type || '').toLowerCase().includes(q) ||
                (String(req.acr_id || req.id || '')).includes(q);

            return matchesStatus && matchesSearch;
        });
    }, [correctionRequests, requestFilterStatus, requestSearchTerm]);

    const requestCounts = useMemo(() => {
        return {
            all: correctionRequests.length,
            pending: correctionRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length,
            approved: correctionRequests.filter(r => (r.status || '').toUpperCase() === 'APPROVED').length,
            rejected: correctionRequests.filter(r => (r.status || '').toUpperCase() === 'REJECTED').length,
        };
    }, [correctionRequests]);

    return (
        <MobileDashboardLayout title="Live Attendance">
            <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg transition-colors duration-300 pb-24">

                {/* --- TOP TABS (Matching Flutter _buildTabs) --- */}
                <div className="sticky top-0 z-20 bg-white/95 dark:bg-github-dark-bg/95 backdrop-blur-md px-3 pt-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-100 dark:bg-[#161B22] p-1 flex rounded-xl border border-slate-200/70 dark:border-github-dark-border shadow-sm max-w-lg mx-auto">
                        <button
                            onClick={() => handleTabChange('dashboard')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'dashboard'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <LayoutGrid size={14} className={activeTab === 'dashboard' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>Live Dashboard</span>
                        </button>

                        <button
                            onClick={() => handleTabChange('requests')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'requests'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <FileText size={14} className={activeTab === 'requests' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>Correction Requests</span>
                            {requestCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center leading-none">
                                    {requestCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* --- TAB CONTENT --- */}
                {activeTab === 'dashboard' ? (
                    <div className="max-w-lg mx-auto space-y-3 pb-6">
                        {/* 1. Date Selector + Action Buttons (Matching Flutter _buildDateSelector) */}
                        <div className="flex items-center justify-between gap-2 px-3 pt-3">
                            <div className="relative flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl shadow-sm">
                                <Calendar size={13} className="text-indigo-600 dark:text-white shrink-0" />
                                <DatePicker
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                    maxDate={new Date().toISOString().split('T')[0]}
                                    customDisplay={
                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer">
                                            {formatHeaderDate(selectedDate)}
                                        </span>
                                    }
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={generateAiSummary}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white text-xs font-semibold shadow-md shadow-indigo-500/25 active:scale-95 transition-all"
                                >
                                    <Sparkles size={13} className="text-white" />
                                    <span>AI Insights</span>
                                </button>

                                <button
                                    onClick={() => fetchData(false, true)}
                                    className="p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/80 hover:text-indigo-600 shadow-sm active:scale-95 transition-all"
                                    title="Refresh"
                                >
                                    <RefreshCcw size={15} className={loading ? 'animate-spin text-indigo-500' : ''} />
                                </button>
                            </div>
                        </div>

                        {/* 2. KPIs (2x2 Grid matching Flutter _buildKPIGrid) */}
                        <div className="grid grid-cols-2 gap-2.5 px-3">
                            <StatCard
                                title="Total Present"
                                value={stats.present}
                                total={`/ ${stats.total}`}
                                contextText="For Selected Date"
                                icon={Users}
                                baseColor="#5B60F6"
                                isSelected={statusFilter === 'present'}
                                onClick={() => setStatusFilter(statusFilter === 'present' ? 'All' : 'present')}
                            />
                            <StatCard
                                title="Late"
                                value={stats.late}
                                contextText="Late Check-ins"
                                icon={Clock}
                                baseColor="#F59E0B"
                                isSelected={statusFilter === 'late'}
                                onClick={() => setStatusFilter(statusFilter === 'late' ? 'All' : 'late')}
                            />
                            <StatCard
                                title="Absent"
                                value={stats.absent}
                                contextText="Not checked in"
                                icon={UserX}
                                baseColor="#EF4444"
                                isSelected={statusFilter === 'absent'}
                                onClick={() => setStatusFilter(statusFilter === 'absent' ? 'All' : 'absent')}
                            />
                            <StatCard
                                title="Active Now"
                                value={stats.active}
                                contextText="Currently Clocked In"
                                icon={Coffee}
                                baseColor="#10B981"
                                isSelected={statusFilter === 'active'}
                                onClick={() => setStatusFilter(statusFilter === 'active' ? 'All' : 'active')}
                            />
                        </div>

                        {/* 3. Sub-Tabs Switcher (Overview, Analytics, Timeline, Map View matching Flutter) */}
                        <div className="px-3 pt-1">
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                {SUB_TABS.map((tab) => {
                                    const isSelected = activeSubTab === tab.id;
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveSubTab(tab.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                                    : 'bg-slate-100 dark:bg-[#21262D] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Icon size={13} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Sub-Tab Content */}
                        {activeSubTab === 'overview' && (
                            <div className="space-y-3">
                                {/* Search Bar (Matching Flutter) */}
                                <div className="px-3">
                                    <div className="relative flex items-center h-9 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2.5 shadow-sm">
                                        <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search employee..."
                                            className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} className="p-1 text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Dual Dropdowns: Department + Shift (Matching Flutter) */}
                                <div className="grid grid-cols-2 gap-2 px-3">
                                    <div className="relative">
                                        <select
                                            value={selectedDept}
                                            onChange={(e) => setSelectedDept(e.target.value)}
                                            className="w-full h-9 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-github-dark-border rounded-xl px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none appearance-none truncate pr-7 cursor-pointer shadow-sm"
                                        >
                                            <option value="All">All Departments</option>
                                            {departments.map((d, i) => (
                                                <option key={i} value={d.dept_name || d}>{d.dept_name || d}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={selectedShift}
                                            onChange={(e) => setSelectedShift(e.target.value)}
                                            className="w-full h-9 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-github-dark-border rounded-xl px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none appearance-none truncate pr-7 cursor-pointer shadow-sm"
                                        >
                                            <option value="All">All Shifts</option>
                                            <option value="open_shift">Open Shift</option>
                                            {shifts.map((s, i) => (
                                                <option key={i} value={s.shift_id}>{s.shift_name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Quick Status Filter Chips (Matching Flutter) */}
                                <div className="px-3 overflow-x-auto no-scrollbar">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        {[
                                            { key: 'All', label: 'All', count: stats.total, color: '#6366F1' },
                                            { key: 'present', label: 'Present', count: stats.present, color: '#10B981' },
                                            { key: 'late', label: 'Late', count: stats.late, color: '#F59E0B' },
                                            { key: 'absent', label: 'Absent', count: stats.absent, color: '#EF4444' },
                                            { key: 'on_leave', label: 'On Leave', count: onLeaveCount, color: '#8B5CF6' },
                                        ].map(tab => {
                                            const isSelected = statusFilter === tab.key;
                                            return (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => setStatusFilter(tab.key)}
                                                    style={{
                                                        borderColor: isSelected ? tab.color : undefined,
                                                        backgroundColor: isSelected ? `${tab.color}18` : undefined,
                                                        color: isSelected ? tab.color : undefined
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                        isSelected
                                                            ? 'font-semibold'
                                                            : 'bg-slate-100 dark:bg-[#161B22] border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-400'
                                                    }`}
                                                >
                                                    <span>{tab.label}</span>
                                                    <span
                                                        style={{
                                                            backgroundColor: isSelected ? tab.color : undefined,
                                                            color: isSelected ? '#ffffff' : undefined
                                                        }}
                                                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                            isSelected ? '' : 'bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                                        }`}
                                                    >
                                                        {tab.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Employee Cards List (Matching Flutter _buildOverviewTab) */}
                                <div className="px-3 space-y-2.5">
                                    {loading && !attendanceData.length ? (
                                        [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200/50 dark:bg-white/5 animate-pulse rounded-2xl" />)
                                    ) : filteredEmployees.length === 0 ? (
                                        <div className="text-center py-16 bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-github-dark-border p-6">
                                            <p className="text-slate-400 text-xs font-semibold">No attendance records found.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {presentEmployees.map(emp => (
                                                <MonitoringCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                            ))}

                                            {presentEmployees.length > 0 && absentEmployees.length > 0 && (
                                                <div className="flex items-center gap-3 py-2">
                                                    <div className="h-px bg-slate-200 dark:bg-github-dark-border flex-1" />
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">
                                                        NOT CHECKED IN
                                                    </span>
                                                    <div className="h-px bg-slate-200 dark:bg-github-dark-border flex-1" />
                                                </div>
                                            )}

                                            {absentEmployees.map(emp => (
                                                <MonitoringCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'timeline' && (
                            <div className="px-3">
                                <TimelineView
                                    data={filteredEmployees}
                                    loading={loading}
                                    onSelect={(emp) => setSelectedEmployee(emp)}
                                    avatarTimestamp={avatarTimestamp}
                                    orgTimezone={orgTimezone}
                                />
                            </div>
                        )}

                        {activeSubTab === 'analytics' && (
                            <div className="px-3 space-y-4">
                                {/* Attendance Pie */}
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <PieChartIcon size={14} className="text-indigo-500" /> Attendance Distribution
                                    </h4>
                                    <div className="h-48 flex items-center justify-center">
                                        <div className="w-1/2 h-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData.status}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={35}
                                                        outerRadius={55}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {chartData.status.map((entry, i) => (
                                                            <Cell key={i} fill={entry.color} stroke="none" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="w-1/2 space-y-2 pl-4">
                                            {chartData.status.map((d, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{d.name}: {d.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Timeline */}
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[11px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-2">
                                            <Activity size={14} className="text-emerald-500" /> Peak Hours Velocity
                                        </h4>
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[9px] font-bold text-slate-400">ACTIVE</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span className="text-[9px] font-bold text-slate-400">NEW</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-44">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData.timeline}>
                                                <defs>
                                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                                                <YAxis hide />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" name="Active Staff" dataKey="active" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActive)" />
                                                <Area type="monotone" name="New Check-ins" dataKey="checkins" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNew)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Department Health */}
                                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <LayoutGrid size={14} className="text-purple-500" /> Department Health
                                    </h4>
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData.departments} margin={{ left: -30 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700 }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold' }} />
                                                <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                                <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'map' && (
                            <div className="px-3">
                                <MapView
                                    data={filteredEmployees}
                                    searchTerm={searchTerm}
                                    selectedDept={selectedDept}
                                    activeTheme={activeTheme}
                                    MAP_THEMES={MAP_THEMES}
                                    isThemeMenuOpen={isThemeMenuOpen}
                                    setIsThemeMenuOpen={setIsThemeMenuOpen}
                                    setActiveTheme={setActiveTheme}
                                    avatarTimestamp={avatarTimestamp}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    /* --- CORRECTION REQUESTS TAB (Matching Flutter AdminCorrectionRequests) --- */
                    <div className="max-w-lg mx-auto px-3 pt-3 space-y-3 pb-6">
                        {/* Header: Title + Refresh (Matching Flutter _buildHeader) */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Correction Requests</h3>
                            <button
                                onClick={() => fetchData(false, true)}
                                className="p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 shadow-sm active:scale-95 transition-all"
                                title="Refresh"
                            >
                                <RefreshCcw size={15} className={loading ? 'animate-spin text-indigo-500' : ''} />
                            </button>
                        </div>

                        {/* Search Bar (Matching Flutter _buildSearchBar) */}
                        <div className="relative flex items-center h-9 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2.5 shadow-sm">
                            <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                            <input
                                type="text"
                                value={requestSearchTerm}
                                onChange={(e) => setRequestSearchTerm(e.target.value)}
                                placeholder="Search correction requests..."
                                className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                            />
                            {requestSearchTerm && (
                                <button onClick={() => setRequestSearchTerm('')} className="p-1 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filter Tabs (Matching Flutter _buildFilterTabs) */}
                        <div className="overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                {[
                                    { label: 'All', count: requestCounts.all },
                                    { label: 'Pending', count: requestCounts.pending },
                                    { label: 'Approved', count: requestCounts.approved },
                                    { label: 'Rejected', count: requestCounts.rejected },
                                ].map(tab => {
                                    const isActive = requestFilterStatus === tab.label;
                                    return (
                                        <button
                                            key={tab.label}
                                            onClick={() => setRequestFilterStatus(tab.label)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border ${
                                                isActive
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                                                    : 'bg-white dark:bg-[#161B22] border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-400'
                                            }`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Requests List (Matching Flutter _buildRequestCard list) */}
                        <div className="space-y-2.5 pt-1">
                            {filteredRequests.length > 0 ? (
                                filteredRequests.map(req => (
                                    <RequestCard
                                        key={req.acr_id || req.id}
                                        request={req}
                                        onClick={() => setSelectedRequest(req)}
                                        avatarTimestamp={avatarTimestamp}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-16 bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200/80 dark:border-github-dark-border p-6">
                                    <p className="text-slate-400 text-xs font-semibold">No {requestFilterStatus.toLowerCase()} requests found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MODALS (Rendered directly with AnimatePresence) --- */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <EmployeeDetailModal
                            employee={selectedEmployee}
                            onClose={() => setSelectedEmployee(null)}
                            date={selectedDate}
                            avatarTimestamp={avatarTimestamp}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {selectedRequest && (
                        <RequestDetailModal
                            request={selectedRequest}
                            onClose={() => setSelectedRequest(null)}
                            onUpdate={() => fetchData(true, true)}
                        />
                    )}
                </AnimatePresence>

                {/* AI Summary Modal */}
                <AiSummaryModal
                    isOpen={isAiSummaryOpen}
                    onClose={() => setIsAiSummaryOpen(false)}
                    date={selectedDate}
                    data={aiSummaryData}
                    loading={aiSummaryLoading}
                    error={aiSummaryError}
                    onRegenerate={generateAiSummary}
                />
            </div>
        </MobileDashboardLayout>
    );
};

// --- SUB-COMPONENTS ---

const TimelineView = ({ data, loading, onSelect, avatarTimestamp, orgTimezone }) => {
    const startHour = 0;
    const totalHours = 24;

    const timeToPct = (date) => {
        if (!date) return null;
        const h = date.getHours();
        const m = date.getMinutes();
        const totalMinutes = (h - startHour) * 60 + m;
        return Math.max(0, Math.min(100, (totalMinutes / (totalHours * 60)) * 100));
    };

    return (
        <div className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1500px]">
                    {/* Timeline Header */}
                    <div className="flex bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                        <div className="w-[150px] shrink-0 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-slate-50 dark:bg-github-dark-subtle z-30">
                            Employee
                        </div>
                        <div className="flex-1 flex">
                            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                <div key={hour} className="flex-1 py-3 text-center text-[9px] font-black text-slate-400 border-r border-slate-200 dark:border-github-dark-border/30 last:border-r-0">
                                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border/50">
                        {loading && data.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-xs font-bold">Loading timeline...</div>
                        ) : data.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-xs font-bold">No employees found.</div>
                        ) : (
                            data.map((item) => (
                                <div key={item.id} className="flex hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer h-16 items-center" onClick={() => onSelect(item)}>
                                    {/* Employee Info (Sticky) */}
                                    <div className="w-[150px] shrink-0 px-4 flex items-center gap-2 border-r border-slate-200 dark:border-github-dark-border sticky left-0 bg-white dark:bg-dark-card group-hover:bg-slate-50 dark:group-hover:bg-github-dark-subtle z-20">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0 ${item.status === 'Absent' ? 'bg-slate-100 text-slate-400 dark:bg-github-dark-subtle dark:text-github-dark-muted' : 'bg-gradient-to-br from-indigo-500/10 to-purple-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'}`}>
                                            {item.avatar.startsWith('http') ? (
                                                <img src={`${item.avatar}?t=${avatarTimestamp}`} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                item.avatar
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-[10px] text-slate-800 dark:text-github-dark-text truncate leading-tight">{item.name}</p>
                                            <p className="text-[8px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-tighter truncate">
                                                {item.totalHours && (item.totalHours.toLowerCase().includes('hr') || item.totalHours.toLowerCase().includes('min') || item.totalHours === '-') ? item.totalHours : `${item.totalHours} Hrs`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Timeline Grid */}
                                    <div className="flex-1 relative flex h-full items-center">
                                        <div className="absolute inset-0 flex">
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-slate-100 dark:border-github-dark-border/30 last:border-r-0"></div>
                                            ))}
                                        </div>

                                        <div className="absolute inset-x-0 h-6 z-10 px-1">
                                            {item.sessions.map((session, sIdx) => {
                                                const startPos = timeToPct(session.rawIn);
                                                const endPos = session.isActive ? timeToPct(getCurrentTimeInTimezone(orgTimezone)) : timeToPct(session.rawOut);
                                                const width = endPos - startPos;
                                                if (startPos === null) return null;

                                                return (
                                                    <div
                                                        key={sIdx}
                                                        className={`absolute top-0 h-full rounded border shadow-sm transition-all ${session.isActive ? 'bg-gradient-to-r from-indigo-500 to-blue-500 border-indigo-400/50 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/50'}`}
                                                        style={{ left: `${startPos}%`, width: `${Math.max(width, 1)}%` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, total, contextText, icon: Icon, baseColor, isSelected, onClick }) => {
    return (
        <div
            onClick={onClick}
            style={{
                borderColor: isSelected ? baseColor : undefined,
            }}
            className={`p-3 rounded-2xl bg-white dark:bg-[#161B22] border transition-all duration-200 shadow-sm active:scale-[0.98] cursor-pointer flex flex-col justify-between ${
                isSelected
                    ? 'ring-2 ring-indigo-500/20 shadow-md border-indigo-500'
                    : 'border-slate-200/80 dark:border-github-dark-border hover:border-slate-300'
            }`}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</span>
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${baseColor}1A`, color: baseColor }}
                >
                    <Icon size={14} />
                </div>
            </div>

            <div className="mt-2 mb-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">{value}</span>
                {total && <span className="text-xs font-semibold text-slate-400 leading-none">{total}</span>}
            </div>

            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate">{contextText}</span>
        </div>
    );
};

const MonitoringCard = ({ employee, onClick, avatarTimestamp }) => {
    const getStatusTheme = (label) => {
        switch (label) {
            case 'Active':
            case 'Late Active':
                return { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800/40', text: 'text-blue-600 dark:text-blue-400' };
            case 'Present':
                return { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-600 dark:text-emerald-400' };
            case 'Late':
                return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-600 dark:text-amber-400' };
            case 'Absent':
                return { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800/40', text: 'text-rose-600 dark:text-rose-400' };
            case 'Half Day':
                return { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800/40', text: 'text-indigo-600 dark:text-indigo-400' };
            case 'Leave':
            case 'Week Off':
            case 'Holiday':
                return { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800/40', text: 'text-purple-600 dark:text-purple-400' };
            default:
                return { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400' };
        }
    };

    const statusStyle = getStatusTheme(employee.status);
    const firstSession = employee.sessions && employee.sessions.length > 0 ? employee.sessions[0] : null;
    const lastSession = employee.sessions && employee.sessions.length > 0 ? employee.sessions[employee.sessions.length - 1] : null;

    const timeIn = firstSession?.in && firstSession.in !== '-' ? firstSession.in : '--';
    const timeOut = lastSession?.out && lastSession.out !== '-' ? lastSession.out : '--';
    const shiftName = employee.shift_name || (employee.shift_id ? `Shift #${employee.shift_id}` : 'General');

    return (
        <div
            onClick={onClick}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-github-dark-border shadow-sm active:scale-[0.99] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all cursor-pointer"
        >
            {/* Row 1: Profile + Status */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/30 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {employee.avatar && employee.avatar.length > 1 ? (
                        <img src={`${employee.avatar}?t=${avatarTimestamp}`} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                        (employee.avatar || 'U')
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
                        {employee.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {employee.role} • {employee.department}
                    </p>
                </div>

                {/* Status Badge */}
                <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text} shrink-0`}>
                    {employee.status}
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 dark:bg-github-dark-border/40 my-2.5" />

            {/* Row 2: Metrics */}
            <div className="grid grid-cols-3 gap-2 text-left">
                <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Time In</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate mt-0.5">{timeIn}</span>
                </div>
                <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Time Out</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate mt-0.5">{timeOut}</span>
                </div>
                <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Shift</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate mt-0.5">{shiftName}</span>
                </div>
            </div>
        </div>
    );
};

const RequestCard = ({ request, onClick, avatarTimestamp }) => {
    const status = (request.status || 'PENDING').toUpperCase();
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';

    const statusBadge = isApproved
        ? { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-600 dark:text-emerald-400' }
        : isRejected
        ? { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800/40', text: 'text-rose-600 dark:text-rose-400' }
        : { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-600 dark:text-amber-400' };

    const proposedHours = calculateProposedHours(request);

    return (
        <div
            onClick={onClick}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-github-dark-border shadow-sm active:scale-[0.99] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all cursor-pointer space-y-2"
        >
            {/* Top Row: Avatar + Name + ID/Type + Status */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/30 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {request.profile_image_url && request.profile_image_url.startsWith('http') ? (
                        <img src={`${request.profile_image_url}?t=${avatarTimestamp}`} alt={request.user_name} className="w-full h-full object-cover" />
                    ) : (
                        (request.user_name || 'U').charAt(0).toUpperCase()
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
                        {request.user_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        #{request.acr_id || request.id} • {(request.correction_type || '').replace(/_/g, ' ')}
                    </p>
                </div>

                <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.bg} ${statusBadge.border} ${statusBadge.text} shrink-0`}>
                    {status}
                </div>
            </div>

            {/* Middle Row: Date & Proposed Hours */}
            <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {formatHeaderDate(request.request_date)}
                </span>
                {proposedHours && Number(proposedHours) > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                        {proposedHours} hrs
                    </span>
                )}
            </div>

            {/* Reason Snippet */}
            <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1">
                "{request.reason || 'No explanation provided.'}"
            </p>

            {/* Attachment Chip if present */}
            {request.attachment_url && (
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 pt-0.5">
                    <Paperclip size={12} />
                    <span className="truncate max-w-[200px]">
                        {request.attachment_url.split('?')[0].split('/').pop()}
                    </span>
                </div>
            )}
        </div>
    );
};

const EmployeeDetailModal = ({ employee, onClose, date, avatarTimestamp }) => {
    const [previewImage, setPreviewImage] = useState(null);

    return (
        <motion.div
            key="employee-detail-modal-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] flex items-end justify-center sm:items-center"
        >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="relative w-full max-w-lg bg-slate-50 dark:bg-github-dark-bg rounded-t-[2rem] sm:rounded-2xl p-6 pb-12 max-h-[90vh] overflow-y-auto border-t border-slate-200 dark:border-github-dark-border shadow-2xl z-10"
            >
                {/* Lightbox Preview */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9100] bg-black/95 flex items-center justify-center p-4"
                            onClick={() => setPreviewImage(null)}
                        >
                            <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full"><X size={24} /></button>
                            <motion.img
                                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                                src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-6" />

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-dark-card border-2 border-white dark:border-github-dark-border overflow-hidden shadow-lg flex items-center justify-center">
                        {employee.avatar.length > 1 ? <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" /> : <div className="text-xl font-black text-indigo-500">{employee.avatar}</div>}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight mb-1">{employee.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">{employee.role}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{employee.department}</span>
                        </div>
                    </div>
                </div>

                {((employee.allStatuses && employee.allStatuses.includes('Late')) || (employee.lateMinutes > 0) || employee.status.includes('Late')) && (
                    <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm">
                        <h5 className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-500 tracking-wider mb-1 flex items-center gap-1.5">
                            <AlertCircle size={12} /> Reason for Late
                        </h5>
                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed italic">
                            {employee.lateReason ? `"${employee.lateReason}"` : "No reason provided."}
                        </p>
                    </div>
                )}

                {((employee.allStatuses && employee.allStatuses.includes('Overtime')) || (employee.overtimeHours > 0) || employee.status.includes('Overtime')) && (
                    <div className="p-3 mb-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl shadow-sm">
                        <h5 className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 tracking-wider mb-1 flex items-center gap-1.5">
                            <TrendingUp size={12} /> Overtime Worked
                        </h5>
                        <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
                            {employee.overtimeHours ? `${employee.overtimeHours} hrs overtime` : 'Overtime detected according to shift policy.'}
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex justify-between">
                        <span>Daily Activity</span>
                        <span className="text-slate-400 font-normal">{formatPlatformDate(date)}</span>
                    </h4>

                    {employee.sessions.length > 0 ? (
                        employee.sessions.map((s, i) => (
                            <div key={i} className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-100 dark:border-github-dark-border shadow-sm space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} /> Session #{employee.sessions.length - i}
                                    </span>
                                    {s.isActive && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 animate-pulse">Active</span>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><LogIn size={12} /></div>
                                            <span className="text-base font-bold text-slate-800 dark:text-white">{s.in}</span>
                                        </div>
                                        {s.inLocation && (
                                            <div className="flex items-start gap-1 px-0.5">
                                                <MapPin size={10} className="shrink-0 mt-0.5 text-emerald-500 opacity-60" />
                                                <span className="text-[10px] text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.inLocation}</span>
                                            </div>
                                        )}
                                        {s.inImage && (
                                            <div className="w-full mt-1.5" onClick={() => setPreviewImage(s.inImage)}>
                                                <img src={s.inImage} className="max-h-32 rounded-lg object-contain cursor-pointer shadow-sm border border-slate-100 dark:border-github-dark-border" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><LogOut size={12} /></div>
                                            <span className="text-base font-bold text-slate-800 dark:text-white">{s.out}</span>
                                        </div>
                                        {s.outLocation && (
                                            <div className="flex items-start gap-1 px-0.5">
                                                <MapPin size={10} className="shrink-0 mt-0.5 text-rose-500 opacity-60" />
                                                <span className="text-[10px] text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.outLocation}</span>
                                            </div>
                                        )}
                                        {s.outImage && (
                                            <div className="w-full mt-1.5" onClick={() => setPreviewImage(s.outImage)}>
                                                <img src={s.outImage} className="max-h-32 rounded-lg object-contain cursor-pointer shadow-sm border border-slate-100 dark:border-github-dark-border" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-10 bg-white dark:bg-dark-card rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-400">
                            <Activity size={28} className="mb-2 opacity-30" />
                            <p className="text-xs font-semibold">No activity logged for this date</p>
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={20} />
                </button>
            </motion.div>
        </motion.div>
    );
};

const RequestDetailModal = ({ request, onClose, onUpdate }) => {
    const [comment, setComment] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAction = async (status) => {
        setIsProcessing(true);
        try {
            await attendanceService.updateCorrectionStatus(request.acr_id || request.id, status, comment);
            toast.success(`Request ${status} successfully`);
            onUpdate();
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <motion.div
            key="request-detail-modal-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] flex items-end justify-center sm:items-center"
        >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle rounded-t-[2rem] sm:rounded-2xl p-6 pb-12 shadow-2xl border-t border-slate-200 dark:border-github-dark-border z-10 max-h-[90vh] overflow-y-auto"
            >
                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-6" />

                <div className="mb-6">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1 block">Correction Request</span>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{request.user_name}</h3>
                    <p className="text-[11px] font-medium text-slate-400 uppercase mt-1 tracking-wider">
                        {request.correction_type} • Request Date: {formatHeaderDate(request.request_date)}
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-slate-50 dark:bg-github-dark-subtle/40 p-4 rounded-xl space-y-2 border border-slate-100 dark:border-github-dark-border">
                        <div className="flex items-center gap-2 text-slate-400">
                            <FileText size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Reason / Justification</span>
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 italic leading-relaxed">
                            "{request.reason || 'No justification provided'}"
                        </p>
                    </div>

                    {request.status?.toUpperCase() === 'PENDING' ? (
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Decision Comment</span>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add internal review comment..."
                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/30 border border-slate-200 dark:border-github-dark-border rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                                rows={3}
                            />
                        </div>
                    ) : (
                        <div className="bg-indigo-50/50 dark:bg-indigo-500/10 p-4 rounded-xl space-y-2 border border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Decision</span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    request.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                }`}>
                                    {request.status}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {request.admin_comment || "No comment provided."}
                            </p>
                        </div>
                    )}
                </div>

                {request.status?.toUpperCase() === 'PENDING' && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleAction('rejected')}
                            disabled={isProcessing}
                            className="flex-1 py-3 bg-white dark:bg-github-dark-subtle border-2 border-rose-200 dark:border-rose-500/30 text-rose-600 font-bold text-xs rounded-xl active:scale-95 transition-all shadow-sm disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleAction('approved')}
                            disabled={isProcessing}
                            className="flex-1 py-3 bg-emerald-500 text-white font-bold text-xs rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                )}

                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={20} />
                </button>
            </motion.div>
        </motion.div>
    );
};

const MobileClusterDrawer = ({ selectedCluster, onClose, avatarTimestamp }) => {
    const [selectedUser, setSelectedUser] = useState(() => 
        selectedCluster.data.length === 1 ? selectedCluster.data[0] : null
    );
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setSelectedUser(selectedCluster.data.length === 1 ? selectedCluster.data[0] : null);
        setSearchQuery('');
    }, [selectedCluster]);

    const filteredClusterData = selectedCluster.data.filter(item => {
        const name = item.user.name || '';
        const role = item.user.role || '';
        const dept = item.user.department || '';
        const q = searchQuery.toLowerCase();
        return name.toLowerCase().includes(q) || role.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
    });

    return (
        <div className="fixed inset-0 z-[9000] flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative max-h-[85vh] bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-github-dark-border flex flex-col z-10 shadow-2xl rounded-t-2xl pb-6 w-full"
            >
                {/* Drag Handle Visual */}
                <div className="w-12 h-1 bg-slate-350 dark:bg-white/10 rounded-full mx-auto my-3 shrink-0" />

                {/* Header */}
                <div className="px-5 pb-3 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedUser && selectedCluster.data.length > 1 && (
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 mr-1"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h3 className="text-xs font-black text-slate-800 dark:text-github-dark-text uppercase tracking-widest">
                                {selectedUser ? 'Session Details' : 'Location Group'}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {selectedUser ? 'Employee Activity' : `${selectedCluster.data.length} checked-in at this location`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-github-dark-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search Bar - only shown in list view */}
                {!selectedUser && selectedCluster.data.length > 1 && (
                    <div className="p-3 border-b border-slate-100 dark:border-github-dark-border shrink-0 bg-white dark:bg-[#0d1117]">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-github-dark-muted" size={16} />
                            <input
                                type="text"
                                placeholder="Search staff, role, or dept..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 text-slate-800 dark:text-github-dark-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-github-dark-muted dark:hover:text-github-dark-text"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-dark-card">
                    <AnimatePresence initial={false} mode="wait">
                        {!selectedUser ? (
                            <motion.div
                                key="list"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2.5"
                            >
                                {filteredClusterData.length > 0 ? (
                                    filteredClusterData.map((m, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedUser(m)}
                                            className="flex items-center gap-3 p-3 bg-white dark:bg-github-dark-subtle/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 rounded-2xl cursor-pointer transition-all border border-slate-100 dark:border-github-dark-border hover:border-indigo-200 dark:hover:border-indigo-500/20 group shadow-sm"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm overflow-hidden shrink-0 border border-indigo-100/50 dark:border-indigo-500/10">
                                                {m.user.avatar.length > 1 ? (
                                                    <img src={`${m.user.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    m.user.avatar
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text truncate leading-tight">
                                                    {m.user.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-github-dark-muted truncate mt-0.5">
                                                    {m.user.role} • {m.user.department}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                                        m.session.isActive && m.type === 'in'
                                                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 animate-pulse'
                                                            : m.type === 'in' 
                                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                            : m.type === 'out' 
                                                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' 
                                                            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                    }`}>
                                                        {m.session.isActive && m.type === 'in' ? 'Active' : m.type === 'combined' ? 'Full Session' : m.type === 'in' ? 'Check In' : 'Check Out'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono flex items-center gap-1">
                                                        <Clock size={8} /> {m.type === 'out' ? m.session.out : m.session.in}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-350 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                <ChevronRight size={14} />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-slate-400 dark:text-github-dark-muted">
                                        <Search size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs font-medium">No results match your search</p>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="detail"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#13151f] rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0 shadow-md">
                                        {selectedUser.user.avatar.length > 1 ? (
                                            <img src={`${selectedUser.user.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                                        ) : (
                                            selectedUser.user.avatar
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-github-dark-text text-sm leading-tight">
                                            {selectedUser.user.name}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {selectedUser.user.role} • {selectedUser.user.department}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {selectedUser.type === 'combined' ? (
                                        <>
                                            <div className="space-y-2 bg-white dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Time In</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-md">
                                                        {selectedUser.session.in}
                                                    </span>
                                                </div>
                                                {selectedUser.session.inImage ? (
                                                    <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.session.inImage)}>
                                                        <img src={selectedUser.session.inImage} alt="In Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer active:scale-95 transition-transform" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-4 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                        <Camera size={16} className="text-slate-400 mb-1" />
                                                        <span className="text-[9px] text-slate-400">No Check-in Selfie</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 bg-white dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Time Out</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-md">
                                                        {selectedUser.session.out}
                                                    </span>
                                                </div>
                                                {selectedUser.session.outImage ? (
                                                    <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.session.outImage)}>
                                                        <img src={selectedUser.session.outImage} alt="Out Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer active:scale-95 transition-transform" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-4 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                        <Camera size={16} className="text-slate-400 mb-1" />
                                                        <span className="text-[9px] text-slate-400">No Check-out Selfie</span>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between bg-white dark:bg-github-dark-subtle/30 p-3 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedUser.session.isActive && selectedUser.type === 'in' ? 'bg-indigo-500 animate-pulse' : selectedUser.type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                        {selectedUser.session.isActive && selectedUser.type === 'in' ? 'Active Session' : selectedUser.type === 'in' ? 'Check In' : 'Check Out'}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold ${
                                                    selectedUser.session.isActive && selectedUser.type === 'in'
                                                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 animate-pulse'
                                                        : selectedUser.type === 'in' 
                                                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' 
                                                        : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'
                                                } px-2.5 py-0.5 rounded-md uppercase`}>
                                                    {selectedUser.type === 'in' ? selectedUser.session.in : selectedUser.session.out}
                                                </span>
                                            </div>
                                            { (selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage) ? (
                                                <div className="flex justify-center w-full mt-2" onClick={() => setPreviewImage(selectedUser.session.inImage ? selectedUser.session.inImage : selectedUser.session.outImage)}>
                                                    <img src={selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage} alt="Selfie" className="max-h-56 max-w-full w-auto block rounded-2xl shadow-md object-contain cursor-pointer active:scale-95 transition-transform" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-6 bg-slate-100/50 dark:bg-github-dark-subtle/10 rounded-2xl border border-dashed border-slate-200 dark:border-github-dark-border mt-2">
                                                    <Camera size={20} className="text-slate-400 mb-1" />
                                                    <span className="text-[10px] text-slate-400">No Selfie image captured</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-github-dark-subtle/30 rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <MapPin size={12} className="text-indigo-500" /> Location Details
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-normal mt-0.5">
                                            {selectedUser.type === 'out' ? selectedUser.session.outLocation : selectedUser.session.inLocation}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

const isValidCoord = (lat, lng) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
    const nLat = Number(lat);
    const nLng = Number(lng);
    return !isNaN(nLat) && !isNaN(nLng) && Math.abs(nLat) > 0.001 && Math.abs(nLng) > 0.001;
};

const MapRecenter = ({ data, searchTerm, selectedDept }) => {
    const map = useMap();
    const hasInitialFit = React.useRef(false);
    const prevFilterRef = React.useRef({ searchTerm, selectedDept });

    // Dynamically calculate and enforce minZoom to fit the panel width
    useEffect(() => {
        const updateMinZoom = () => {
            const container = map.getContainer();
            if (container) {
                const containerWidth = container.clientWidth;
                if (containerWidth) {
                    const calculatedMinZoom = Math.max(3, Math.ceil(Math.log2(containerWidth / 256)));
                    map.setMinZoom(calculatedMinZoom);
                }
            }
        };

        updateMinZoom();

        const resizeObserver = new ResizeObserver(() => {
            updateMinZoom();
        });
        
        const container = map.getContainer();
        if (container) {
            resizeObserver.observe(container);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [map]);

    useEffect(() => {
        if (!data || data.length === 0) return;

        const filterChanged =
            prevFilterRef.current.searchTerm !== searchTerm ||
            prevFilterRef.current.selectedDept !== selectedDept;

        // ONLY auto-fit bounds on initial load OR when search/filter actively changes
        if (!hasInitialFit.current || filterChanged) {
            prevFilterRef.current = { searchTerm, selectedDept };

            // Find bounds for valid markers only
            const points = [];
            data.forEach(user => {
                user.sessions.forEach(s => {
                    if (isValidCoord(s.inLat, s.inLng)) points.push([Number(s.inLat), Number(s.inLng)]);
                    if (isValidCoord(s.outLat, s.outLng)) points.push([Number(s.outLat), Number(s.outLng)]);
                });
            });

            if (points.length > 0) {
                map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
                hasInitialFit.current = true;
            }
        }
    }, [searchTerm, selectedDept, data, map]);

    return null;
};

const createClusterCustomIcon = (cluster) => {
    const count = cluster.getChildCount();
    let colorClass = 'bg-indigo-600';
    if (count > 10) colorClass = 'bg-rose-600';
    else if (count > 5) colorClass = 'bg-amber-600';

    return L.divIcon({
        html: `<div class="flex items-center justify-center ${colorClass} text-white rounded-full border-4 border-white dark:border-github-dark-subtle shadow-xl w-10 h-10 ring-4 ring-indigo-500/20">
                <span class="text-xs font-black">${count}</span>
               </div>`,
        className: 'custom-marker-cluster',
        iconSize: L.point(40, 40, true),
    });
};

const MapView = ({ data, searchTerm, selectedDept, activeTheme, MAP_THEMES, isThemeMenuOpen, setIsThemeMenuOpen, setActiveTheme, avatarTimestamp }) => {
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [clusterGroupElement, setClusterGroupElement] = useState(null);

    useEffect(() => {
        if (!clusterGroupElement) return;

        const handleClusterClick = (e) => {
            const markers = e.layer.getAllChildMarkers();
            if (markers.length > 1) {
                const data = markers.map(m => m.options.customSessionData).filter(Boolean);
                setSelectedCluster({
                    position: [e.latlng.lat, e.latlng.lng],
                    data: data
                });
            }
        };

        clusterGroupElement.on('clusterclick', handleClusterClick);
        return () => {
            clusterGroupElement.off('clusterclick', handleClusterClick);
        };
    }, [clusterGroupElement]);

    const areCoordsSame = (lat1, lng1, lat2, lng2) => {
        if (!isValidCoord(lat1, lng1) || !isValidCoord(lat2, lng2)) return false;
        return Math.abs(Number(lat1) - Number(lat2)) < 0.0001 &&
            Math.abs(Number(lng1) - Number(lng2)) < 0.0001;
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <style>
                {`
                .leaflet-container {
                    background-color: ${
                        activeTheme === 'dark' ? '#0f0f11' : 
                        activeTheme === 'voyager' ? '#cadbe3' : 
                        activeTheme === 'streets' ? '#aad3df' : 
                        activeTheme === 'satellite' ? '#040810' : 
                        '#e4edf2'
                    } !important;
                }
                .leaflet-tile-pane {
                    will-change: auto !important;
                }
                .leaflet-tile {
                    image-rendering: -webkit-optimize-contrast;
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    transform: scale(1.002);
                }
                .user-marker-in, .user-marker-out, .user-marker-combined {
                    z-index: 500 !important;
                }
                .marker-inner {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    transform-origin: bottom center;
                }
                .premium-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .premium-tooltip::before {
                    display: none !important;
                }
                .leaflet-popup-content-wrapper {
                    padding: 0 !important;
                    overflow: hidden !important;
                    border-radius: 12px !important;
                }
                .leaflet-popup-content {
                    margin: 0 !important;
                    width: 280px !important;
                }
                `}
            </style>

            <div className="h-[500px] bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-github-dark-border shadow-sm overflow-hidden relative">
                <MapContainer
                    center={[20, 78]}
                    zoom={5}
                    minZoom={3}
                    maxBounds={[[-90, -180], [90, 180]]}
                    maxBoundsViscosity={1.0}
                    zoomAnimation={true}
                    zoomDelta={0.5}
                    zoomSnap={0.5}
                    wheelDebounceTime={60}
                    className="h-full w-full z-0"
                    attributionControl={false}
                >
                    <TileLayer url={MAP_THEMES[activeTheme].url} noWrap={true} />

                    {/* Map Theme Switcher Overlay */}
                    <div className="absolute top-4 right-4 z-[1001]">
                        <div className="relative">
                            <button
                                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                className="flex items-center gap-2 bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-github-dark-border active:scale-95 transition-all"
                            >
                                <Map size={16} className="text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase">{MAP_THEMES[activeTheme].name}</span>
                                <ChevronDown size={12} className={`text-slate-400 transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isThemeMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsThemeMenuOpen(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-20">
                                        <div className="py-1">
                                            {Object.entries(MAP_THEMES).map(([id, theme]) => (
                                                <button
                                                    key={id}
                                                    onClick={() => {
                                                        setActiveTheme(id);
                                                        setIsThemeMenuOpen(false);
                                                     }}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase transition-colors ${activeTheme === id
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span>{theme.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <MapRecenter data={data} searchTerm={searchTerm} selectedDept={selectedDept} />

                    <MarkerClusterGroup
                        ref={setClusterGroupElement}
                        chunkedLoading={false}
                        removeOutsideVisibleBounds={false}
                        maxClusterRadius={50}
                        iconCreateFunction={createClusterCustomIcon}
                        showCoverageOnHover={false}
                        spiderfyOnMaxZoom={false}
                        zoomToBoundsOnClick={false}
                    >
                        {data.map(user => (
                            user.sessions.map((session, sIdx) => {
                                const isSameLoc = areCoordsSame(session.inLat, session.inLng, session.outLat, session.outLng);

                                if (isSameLoc && isValidCoord(session.inLat, session.inLng)) {
                                    return (
                                        <Marker
                                            key={`${user.id}-${sIdx}-combined`}
                                            position={[Number(session.inLat), Number(session.inLng)]}
                                            customSessionData={{ user, session, type: 'combined' }}
                                            eventHandlers={{
                                                click: () => {
                                                    setSelectedCluster({
                                                        position: [Number(session.inLat), Number(session.inLng)],
                                                        data: [{ user, session, type: 'combined' }]
                                                    });
                                                }
                                            }}
                                            icon={L.divIcon({
                                                className: 'user-marker-combined',
                                                html: `<div class="marker-inner relative">
                                                    <div class="w-10 h-10 rounded-full border-2 border-transparent bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center" style="border-image: linear-gradient(to bottom right, #10b981 50%, #f43f5e 50%) 1;">
                                                        <div class="absolute inset-0 border-2 border-emerald-500 rounded-full" style="clip-path: polygon(0 0, 100% 0, 0 100%);"></div>
                                                        <div class="absolute inset-0 border-2 border-rose-500 rounded-full" style="clip-path: polygon(100% 0, 100% 100%, 0 100%);"></div>
                                                        ${user.avatar.length > 1
                                                        ? `<img src="${user.avatar}?t=${avatarTimestamp}" class="w-full h-full object-cover rounded-full" />`
                                                        : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                    }
                                                    </div>
                                                    <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                    </div>
                                                   </div>`,
                                                iconSize: [40, 40],
                                                iconAnchor: [20, 20]
                                            })}
                                        />
                                    );
                                }

                                return (
                                    <React.Fragment key={`${user.id}-${sIdx}`}>
                                        {isValidCoord(session.inLat, session.inLng) && (
                                            <Marker
                                                position={[Number(session.inLat), Number(session.inLng)]}
                                                customSessionData={{ user, session, type: 'in' }}
                                                eventHandlers={{
                                                    click: () => {
                                                        setSelectedCluster({
                                                            position: [Number(session.inLat), Number(session.inLng)],
                                                            data: [{ user, session, type: 'in' }]
                                                        });
                                                    }
                                                }}
                                                icon={L.divIcon({
                                                    className: 'user-marker-in',
                                                    html: `<div class="marker-inner relative">
                                                        <div class="w-10 h-10 rounded-full border-2 border-emerald-500 bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center">
                                                            ${user.avatar.length > 1
                                                            ? `<img src="${user.avatar}?t=${avatarTimestamp}" class="w-full h-full object-cover" />`
                                                            : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                        }
                                                        </div>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                                                        </div>
                                                       </div>`,
                                                    iconSize: [40, 40],
                                                    iconAnchor: [20, 20]
                                                })}
                                            />
                                        )}
                                        {isValidCoord(session.outLat, session.outLng) && (
                                            <Marker
                                                position={[Number(session.outLat), Number(session.outLng)]}
                                                customSessionData={{ user, session, type: 'out' }}
                                                eventHandlers={{
                                                    click: () => {
                                                        setSelectedCluster({
                                                            position: [Number(session.outLat), Number(session.outLng)],
                                                            data: [{ user, session, type: 'out' }]
                                                        });
                                                    }
                                                }}
                                                icon={L.divIcon({
                                                    className: 'user-marker-out',
                                                    html: `<div class="marker-inner relative">
                                                        <div class="w-10 h-10 rounded-full border-2 border-rose-500 bg-white dark:bg-github-dark-subtle shadow-lg overflow-hidden flex items-center justify-center">
                                                            ${user.avatar.length > 1
                                                            ? `<img src="${user.avatar}?t=${avatarTimestamp}" class="w-full h-full object-cover" />`
                                                            : `<span class="text-[10px] font-black text-slate-600 dark:text-slate-300">${user.avatar}</span>`
                                                        }
                                                        </div>
                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-dark-card flex items-center justify-center shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                                        </div>
                                                       </div>`,
                                                    iconSize: [40, 40],
                                                    iconAnchor: [20, 20]
                                                })}
                                            />
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ))}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>

            <AnimatePresence>
                {selectedCluster && (
                    <MobileClusterDrawer
                        selectedCluster={selectedCluster}
                        onClose={() => setSelectedCluster(null)}
                        avatarTimestamp={avatarTimestamp}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default MobileAttendanceMonitoring; 
