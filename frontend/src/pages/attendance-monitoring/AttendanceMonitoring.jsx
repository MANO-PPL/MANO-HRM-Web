import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Search,
    Filter,
    Clock,
    FileClock,
    UserCheck,
    UserX,
    AlertTriangle,
    MoreVertical,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    Activity,
    LogOut,
    LayoutGrid,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    RefreshCcw,
    RefreshCw,
    MapPin,
    Table,
    ChevronDown,
    Layers,
    Check,
    Users,
    X,
    LogIn,
    Camera,
    Sparkles,
    Paperclip,
    Eye,
    Edit3,
    ArrowRight
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import DatePicker from '../../components/DatePicker';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import axios from 'axios';
import api from '../../services/api';
import CorrectionRequestsTab from './components/CorrectionRequestsTab';
import CorrectionDocumentModal from '../../components/attendance/CorrectionDocumentModal';
import LiveOverviewTab from './tabs/LiveOverviewTab';
import LiveTimelineTab from './tabs/LiveTimelineTab';
import LiveAnalyticsTab from './tabs/LiveAnalyticsTab';
import LiveMapTab from './tabs/LiveMapTab';
import UserAttendanceDetailsModal from './components/UserAttendanceDetailsModal';
import AiSummaryModal from './components/AiSummaryModal';


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
    } catch (e) { }

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
            const isMissedOrAbsent = u.status === 'MISSED_PUNCH' || u.status === 'Missed Punch' || u.status === 'ABSENT' || u.status === 'Absent' || r.status === 'MISSED_PUNCH' || r.status === 'ABSENT';
            let isActive = !r.time_out && !isMissedOrAbsent;

            const outTime = parseTimeInTimezone(r, true);
            if (outTime) {
                outStr = formatTime(outTime);
                if (inTime) totalMin += Math.max(0, (outTime.getTime() - inTime.getTime()) / 60000);
            } else if (isActive && inTime) {
                const now = new Date();
                totalMin += Math.max(0, (now.getTime() - inTime.getTime()) / 60000);
            }

            // Locations
            const inLoc = r.time_in_address || (r.time_in_lat ? `${r.time_in_lat}, ${r.time_in_lng}` : 'Unknown');
            const outLoc = r.time_out_address || (r.time_out_lat ? `${r.time_out_lat}, ${r.time_out_lng}` : null);

            return {
                rawIn: inTime,
                rawOut: outTime,
                in: inStr,
                out: outStr,
                date: inTime ? inTime.toLocaleDateString() : '-',
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
        const expectedHrs = u.expected_hours !== undefined && u.expected_hours !== null && u.expected_hours > 0 ? `${Number(u.expected_hours).toFixed(1)} hrs` : 'N/A';
        const lastLocation = u.sessions && u.sessions.length > 0
            ? u.sessions[0].time_in_address || (u.sessions[0].time_in_lat ? `${u.sessions[0].time_in_lat}, ${u.sessions[0].time_in_lng}` : 'N/A')
            : 'N/A';

        // Recreate allStatuses to retain compatibility with stats counts
        let allStatuses = [];
        if (status === 'Late Active') { allStatuses.push('Active', 'Late'); }
        else if (status === 'Active') { allStatuses.push('Active'); }
        else if (status === 'Present') { allStatuses.push('Present'); }
        else if (status === 'Late') { allStatuses.push('Present', 'Late'); }
        else if (status === 'Overtime') { allStatuses.push('Present', 'Overtime'); }
        else if (status === 'Missed Punch') { allStatuses.push('Missed Punch'); }
        else if (status === 'Week Off') { allStatuses.push('Week Off'); }
        else if (status === 'Holiday') { allStatuses.push('Holiday'); }
        else if (status === 'Leave' || status === 'On Leave' || status === 'ON_LEAVE') { allStatuses.push('Leave'); }
        else { allStatuses.push('Absent'); }

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
            expectedHours: expectedHrs,
            location: lastLocation,
            lateReason: u.late_reason || u.lateReason || sessions.find(s => s.lateReason)?.lateReason || ''
        };
    });

    // Sort: Active/Present/Late/Overtime first, then Absent, then Week Off/Holiday/Leave
    const statusWeights = {
        'Active': 10,
        'Late Active': 9,
        'Late': 8,
        'Overtime': 7,
        'Present': 6,
        'Missed Punch': 5,
        'Absent': 4,
        'Leave': 3,
        'Holiday': 2,
        'Week Off': 1
    };
    mergedData.sort((a, b) => (statusWeights[b.status] || 0) - (statusWeights[a.status] || 0));

    return mergedData;
};

const PAGE_KEY = 'admin_attendance_monitoring';

const AttendanceMonitoring = () => {
    const navigate = useNavigate();
    const { avatarTimestamp } = useAuth();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

    // Get initial values from localStorage to support persistent views/filters
    const initialView = localStorage.getItem('live_attendance_active_view') || 'cards';
    const initialDate = localStorage.getItem('live_attendance_selected_date') || new Date().toISOString().split("T")[0];
    const initialSearch = localStorage.getItem('live_attendance_search_term') || '';
    const initialDept = localStorage.getItem('live_attendance_department_filter') || 'All';
    const initialStatus = localStorage.getItem('live_attendance_status_filter') || 'All';
    const initialDesg = localStorage.getItem('live_attendance_desg_filter') || 'All';
    const initialShift = localStorage.getItem('live_attendance_shift_filter') || 'All';

    // Synchronous memory cache check
    const cachedResponse = attendanceCacheData.dailySummaryAdmin[initialDate];

    const [orgTimezone, setOrgTimezone] = useState(() => cachedResponse?.timezone || 'UTC');

    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'live';
    });

    const tourSteps = React.useMemo(() => [
        {
            targetId: 'attendance-tabs',
            title: 'Attendance Modules',
            description: 'Switch between the Live Attendance dashboard and the Correction Requests queue.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-live-stats',
            title: 'Live Metrics & Filters',
            description: 'Track real-time employee counts for different attendance states. Click any metric card to filter the employee list below to only those matching that state.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-controls',
            title: 'Data Controls & Views',
            description: 'Search for specific employees, filter by department, select dates, or switch between Overview cards, Analytics charts, and high-density Timeline views.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-employee-card',
            title: 'Employee Card & Status Badges',
            description: 'Each card displays an employee\'s active session details. The color-coded status badges indicate their shift status: "Present" (on-time check-in), "Late" (checked in past the grace period), "Absent" (no check-in yet), "On Leave" (approved time off), and a pulsing "Active" badge showing they are currently logged in.',
            action: () => {
                setActiveTab('live');
            }
        },
        {
            targetId: 'attendance-requests-queue',
            title: 'Correction Requests Queue',
            description: 'This is the Correction Requests queue. As an administrator, you can review, approve, or reject attendance adjustment requests submitted by employees. You can view the request details, employee comments, and adjust or confirm their sessions directly from this interface.',
            action: () => {
                setActiveTab('requests');
            }
        }
    ], [setActiveTab]);
    const [activeView, setActiveView] = useState(initialView); // 'cards' | 'graph' | 'table' | 'map'

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [window.location.search]);

    const [selectedRequest, setSelectedRequest] = useState(1); // For Detail View
    const [selectedLiveUser, setSelectedLiveUser] = useState(null); // For Live Attendance Detail Modal
    const [previewImage, setPreviewImage] = useState(null);

    const [loading, setLoading] = useState(() => !cachedResponse);
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
                present: merged.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: merged.filter(d => d.status === 'Absent').length,
                active: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: merged.length
            };
        }
        return {
            present: 0,
            late: 0,
            absent: 0,
            active: 0,
            total: 0
        };
    });

    // Correction Requests State
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [requestCount, setRequestCount] = useState(0);
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [selectedRequestData, setSelectedRequestData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [reviewComment, setReviewComment] = useState('');
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [correctionSearchTerm, setCorrectionSearchTerm] = useState('');
    // Correction Filters
    const [correctionFilter, setCorrectionFilter] = useState({
        type: 'day',
        date: new Date().toISOString().split('T')[0],
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    // Admin Override State
    const [lockedMarkerId, setLockedMarkerId] = useState(null);
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideMethod, setOverrideMethod] = useState('fix');
    const [overrideIn, setOverrideIn] = useState('');
    const [overrideOut, setOverrideOut] = useState('');
    const [overrideSessions, setOverrideSessions] = useState([{ time_in: '', time_out: '' }]);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [departmentFilter, setDepartmentFilter] = useState(initialDept);
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [desgFilter, setDesgFilter] = useState(initialDesg);
    const [shiftFilter, setShiftFilter] = useState(initialShift);
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [shifts, setShifts] = useState([]);
    const [selectedDate, setSelectedDate] = React.useState(initialDate);
    const [lastSynced, setLastSynced] = React.useState(new Date());

    // AI Summary State
    const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [aiSummaryData, setAiSummaryData] = useState(null);
    const [aiSummaryError, setAiSummaryError] = useState(null);

    const presentStaffChartData = React.useMemo(() => {
        return attendanceData
            .filter(emp => {
                const statusLower = emp.status ? emp.status.toLowerCase() : '';
                return statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
            })
            .map(emp => {
                let totalMin = 0;
                if (emp.sessions && emp.sessions.length > 0) {
                    emp.sessions.forEach(r => {
                        const inTime = r.rawIn;
                        const outTime = r.rawOut;
                        const isActive = r.isActive;
                        if (outTime && inTime) {
                            totalMin += Math.max(0, (outTime - inTime) / 60000);
                        } else if (isActive && inTime) {
                            const now = getCurrentTimeInTimezone(orgTimezone);
                            totalMin += Math.max(0, (now - inTime) / 60000);
                        }
                    });
                }
                const logged = Number((totalMin / 60).toFixed(2));

                const expectedHoursDecimal = parseFloat(emp.expectedHours);
                const expected = isNaN(expectedHoursDecimal) ? 8.0 : expectedHoursDecimal;

                const truncatedName = emp.name.length > 15 ? `${emp.name.slice(0, 12)}...` : emp.name;

                return {
                    name: truncatedName,
                    fullName: emp.name,
                    logged: logged,
                    expected: expected
                };
            });
    }, [attendanceData, orgTimezone]);

    const localAnalytics = React.useMemo(() => {
        let presentCount = 0;
        let lateCount = 0;
        attendanceData.forEach(emp => {
            const statusLower = emp.status ? emp.status.toLowerCase() : '';
            const isPresent = statusLower.includes('present') || statusLower.includes('late') || statusLower.includes('active') || statusLower.includes('overtime');
            const isLate = statusLower.includes('late');
            if (isPresent) presentCount++;
            if (isLate) lateCount++;
        });
        const total = attendanceData.length || 1;
        return {
            presentRate: Math.round((presentCount / total) * 100),
            lateRate: Math.round((lateCount / total) * 100)
        };
    }, [attendanceData]);

    const generateAiSummary = async () => {
        if (!attendanceData || attendanceData.length === 0) {
            toast.error("No attendance data available for the selected date to analyze.");
            return;
        }

        setIsAiSummaryOpen(true);
        setAiSummaryLoading(true);
        setAiSummaryError(null);
        try {
            const token = localStorage.getItem('accessToken');

            // Construct payload matching Python schema
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
                if (statusLower.includes('leave')) {
                    status = 'on_leave';
                }
                if (statusLower.includes('absent')) {
                    status = 'absent';
                }
                if (statusLower.includes('week off') || statusLower.includes('holiday')) {
                    status = 'on_leave';
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

    // Automatically clear AI Summary data when date changes
    useEffect(() => {
        setAiSummaryData(null);
    }, [selectedDate]);

    const handlePrevDay = () => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() - 1);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dayStr = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${dayStr}`);
    };

    const handleNextDay = () => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + 1);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dayStr = String(current.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${dayStr}`);
    };

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const deptRes = await adminService.getDepartments();
                if (deptRes && deptRes.departments) {
                    const sortedDepts = [...deptRes.departments].sort((a, b) => a.dept_name.localeCompare(b.dept_name));
                    setDepartments(sortedDepts);
                }
            } catch (err) {
                console.error("Failed to load departments", err);
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
                console.error("Failed to load designations", err);
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
                console.error("Failed to load shifts", err);
            }
        };
        fetchDepts();
        fetchDesgs();
        fetchShifts();
    }, []);

    const DEPARTMENTS = useMemo(() => {
        const unique = [{ value: 'All', label: 'All Departments' }];
        const seen = new Set();
        (departments || []).forEach(d => {
            if (d?.dept_name && !seen.has(d.dept_name)) {
                seen.add(d.dept_name);
                unique.push({ value: d.dept_name, label: d.dept_name });
            }
        });
        return unique;
    }, [departments]);

    const DESIGNATIONS = useMemo(() => {
        const unique = [{ value: 'All', label: 'All Designations' }];
        const seen = new Set();
        (designations || []).forEach(d => {
            if (d?.desg_name && !seen.has(d.desg_name)) {
                seen.add(d.desg_name);
                unique.push({ value: d.desg_name, label: d.desg_name });
            }
        });
        return unique;
    }, [designations]);

    const SHIFTS = useMemo(() => {
        const unique = [
            { value: 'All', label: 'All Shifts' },
            { value: 'open_shift', label: 'Open Shift' }
        ];
        const seen = new Set(['All', 'open_shift']);
        (shifts || []).forEach(s => {
            const val = String(s?.shift_id || '');
            if (val && !seen.has(val)) {
                seen.add(val);
                unique.push({ value: s.shift_id, label: s.shift_name });
            }
        });
        return unique;
    }, [shifts]);

    // Sync filter states to localStorage
    useEffect(() => {
        localStorage.setItem('live_attendance_active_view', activeView);
    }, [activeView]);

    useEffect(() => {
        localStorage.setItem('live_attendance_selected_date', selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        localStorage.setItem('live_attendance_search_term', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('live_attendance_department_filter', departmentFilter);
    }, [departmentFilter]);

    useEffect(() => {
        localStorage.setItem('live_attendance_desg_filter', desgFilter);
    }, [desgFilter]);

    useEffect(() => {
        localStorage.setItem('live_attendance_shift_filter', shiftFilter);
    }, [shiftFilter]);

    useEffect(() => {
        localStorage.setItem('live_attendance_status_filter', statusFilter);
    }, [statusFilter]);

    // Ensure body/html has no unwanted scrollbar while on live attendance
    useEffect(() => {
        document.body.classList.add('no-scrollbar');
        return () => {
            document.body.classList.remove('no-scrollbar');
        };
    }, []);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (departmentFilter !== 'All') count++;
        if (desgFilter !== 'All') count++;
        if (shiftFilter !== 'All') count++;
        return count;
    }, [departmentFilter, desgFilter, shiftFilter]);

    const handleClearAllFilters = () => {
        setDepartmentFilter('All');
        setDesgFilter('All');
        setShiftFilter('All');
    };

    // Data Fetching
    const fetchData = async (silent = false, forceRefresh = false) => {
        if (!silent) setLoading(true);
        const startTime = Date.now();
        try {
            // 1. Fetch Dynamic Daily Summary for Admin
            const res = await attendanceService.getDailySummaryAdmin(selectedDate, forceRefresh);
            const staff = res.data || [];
            const resolvedTz = res.timezone || 'UTC';
            setOrgTimezone(resolvedTz);

            // 2. Map Data using helper
            const mergedData = processAttendanceData(staff, resolvedTz, selectedDate);

            setAttendanceData(mergedData);

            // 3. Calculate Stats precisely from merged data for consistency
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: mergedData.length
            });

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (!silent) {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 300 - elapsed);
                setTimeout(() => setLoading(false), remaining);
            } else {
                setLoading(false);
            }
            setLastSynced(new Date());
        }
    };



    useEffect(() => {
        if (activeTab === 'live') {
            fetchData(false, false);
            // Auto refresh every 15 seconds (Live Monitoring)
            const interval = setInterval(() => fetchData(true, true), 15000);
            return () => clearInterval(interval);
        } else if (activeTab === 'requests') {
            fetchCorrectionRequests(correctionRequests.length > 0);
        }
    }, [activeTab, selectedDate]);

    // Initial badge count load on mount
    useEffect(() => {
        fetchCorrectionRequests(true);
    }, []);

    const fetchCorrectionRequests = async (silent = false) => {
        if (!silent && correctionRequests.length === 0) {
            setRequestsLoading(true);
        }
        try {
            const params = { limit: 10000 };
            const res = await attendanceService.getCorrectionRequests(params);

            // Sort: Pending first, then by date (newest first)
            const sortedData = (res.data || []).sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(b.request_date) - new Date(a.request_date);
            });

            setCorrectionRequests(sortedData);
            setRequestCount(sortedData.filter(r => r.status === 'pending').length);

            // Auto-select first request if none selected or if previously selected one is gone
            if (sortedData.length > 0) {
                if (!selectedRequestId || !sortedData.find(r => r.acr_id === selectedRequestId)) {
                    setSelectedRequestId(sortedData[0].acr_id);
                    fetchRequestDetail(sortedData[0].acr_id, silent);
                }
            } else {
                setSelectedRequestData(null);
                setSelectedRequestId(null);
            }
        } catch (error) {
            if (!silent) toast.error(error.message);
        } finally {
            setRequestsLoading(false);
        }
    };

    const fetchRequestDetail = async (acr_id, silent = false) => {
        if (!silent && (!selectedRequestData || selectedRequestData.acr_id !== acr_id)) {
            setDetailLoading(true);
        }
        try {
            const data = await attendanceService.getCorrectionDetails(acr_id);
            setSelectedRequestData(data);
            setReviewComment(data.review_comments || '');

            // Reset Override State - default sessions from proposed_data snapshot
            setOverrideMode(false);
            setOverrideMethod('add_session');

            const proposedSnap = Array.isArray(data.proposed_data) ? data.proposed_data : [];
            setOverrideSessions(proposedSnap.length > 0 ? proposedSnap : [{ time_in: '', time_out: '' }]);
            setOverrideIn('');
            setOverrideOut('');
        } catch (error) {
            if (!silent) toast.error("Failed to fetch request details");
        } finally {
            if (!silent) setDetailLoading(false);
        }
    };

    const handleUpdateStatus = async (acr_id, status) => {
        setActionLoading(true);
        try {
            const overrides = {};
            if (status === 'approved' && overrideMode) {
                const valid = overrideSessions.filter(s => s.time_in && s.time_out);
                if (valid.length === 0) {
                    toast.error("At least one valid session required for manual correction");
                    setActionLoading(false);
                    return;
                }
                overrides.sessions = valid;
            }

            // 1. Optimistic Update (Immediate UI response)
            const updatedComment = reviewComment || null;
            setSelectedRequestData(prev => prev && prev.acr_id === acr_id ? {
                ...prev,
                status,
                review_comments: updatedComment,
                audit_trail: [
                    ...(Array.isArray(prev.audit_trail) ? prev.audit_trail : []),
                    { action: status, at: new Date().toISOString(), comments: updatedComment }
                ]
            } : prev);
            setCorrectionRequests(prev => prev.map(r => r.acr_id === acr_id ? { ...r, status } : r));
            setRequestCount(prev => Math.max(0, prev - 1));

            // 2. Network Request
            await attendanceService.updateCorrectionStatus(acr_id, status, reviewComment, overrides);
            toast.success(`Request ${status} successfully`);

            // 3. Silent background refresh without reloading screens
            fetchCorrectionRequests(true);
            fetchRequestDetail(acr_id, true);
        } catch (error) {
            toast.error(error.message);
            // Revert state by silent re-fetch
            fetchCorrectionRequests(true);
            fetchRequestDetail(acr_id, true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcknowledgeRequest = async (acrId, status, rejectReason = '') => {
        setActionLoading(true);
        try {
            // Optimistic update
            setSelectedRequestData(prev => prev && prev.acr_id === acrId ? { ...prev, status, review_comments: rejectReason } : prev);
            setCorrectionRequests(prev => prev.map(r => r.acr_id === acrId ? { ...r, status } : r));
            setRequestCount(prev => Math.max(0, prev - 1));

            await attendanceService.updateCorrectionStatus(acrId, status, rejectReason);
            toast.success(`Request ${status} successfully`);
            fetchCorrectionRequests(true);
            fetchRequestDetail(acrId, true);
        } catch (error) {
            toast.error(error.message);
            fetchCorrectionRequests(true);
            fetchRequestDetail(acrId, true);
        } finally {
            setActionLoading(false);
        }
    };

    // Stats Cards Data
    const statCards = [
        { id: 'total', label: 'Total Employees', value: stats.total, icon: <Users size={20} />, bg: 'bg-indigo-50 dark:bg-indigo-500/10', color: 'text-indigo-600 dark:text-indigo-400' },
        { id: 'present', label: 'Total Present', value: stats.present, icon: <UserCheck size={20} />, bg: 'bg-emerald-50 dark:bg-emerald-500/10', color: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'late', label: 'Late Arrivals', value: stats.late, icon: <Clock size={20} />, bg: 'bg-amber-50 dark:bg-amber-500/10', color: 'text-amber-600 dark:text-amber-400' },
        { id: 'absent', label: 'Absent', value: stats.absent, icon: <UserX size={20} />, bg: 'bg-rose-50 dark:bg-rose-500/10', color: 'text-rose-600 dark:text-rose-400' },
        { id: 'active', label: 'Currently Active', value: stats.active, icon: <Activity size={20} />, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-blue-600 dark:text-blue-400' },
    ];

    // Filter Logic for Live Tab
    const filteredData = attendanceData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = departmentFilter === 'All' || item.department === departmentFilter;
        const matchesDesg = desgFilter === 'All' || item.role === desgFilter;
        const matchesShift = shiftFilter === 'All' || (shiftFilter === 'open_shift' ? !item.shift_id : String(item.shift_id) === String(shiftFilter));

        let matchesStatus = true;
        if (statusFilter === 'present') {
            matchesStatus = item.status !== 'Absent' && item.status !== 'Week Off' && item.status !== 'Holiday' && item.status !== 'Leave';
        } else if (statusFilter === 'late') {
            matchesStatus = item.allStatuses ? item.allStatuses.includes('Late') : item.status.includes('Late');
        } else if (statusFilter === 'absent') {
            matchesStatus = item.status === 'Absent';
        } else if (statusFilter === 'active') {
            matchesStatus = item.allStatuses ? item.allStatuses.includes('Active') : item.status.includes('Active');
        }

        return matchesSearch && matchesDept && matchesDesg && matchesShift && matchesStatus;
    });

    const getStatusStyle = (status) => {
        if (String(status).includes('Late')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse';
            case 'Absent': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted';
            case 'Half Day': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'Overtime': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
            case 'Missed Punch': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'Week Off': return 'bg-slate-100 text-slate-500 dark:bg-github-dark-subtle dark:text-github-dark-muted border border-dashed border-slate-200 dark:border-github-dark-border';
            case 'Holiday': return 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30';
            case 'Leave': return 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30';
            default: return 'bg-slate-100 text-slate-700 dark:bg-github-dark-subtle dark:text-slate-300';
        }
    };

    const getRequestTypeStyle = (type) => {
        const typeStr = String(type).toLowerCase().replace(/_/g, ' ');

        // Match the screenshot colors with backgrounds
        // Check overtime FIRST before checking 'time' to avoid false matches
        if (typeStr.includes('overtime')) {
            return 'text-[10px] font-medium px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        }
        if (typeStr.includes('missed') || typeStr.includes('manual')) {
            return 'text-[10px] font-medium px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        }
        if (typeStr.includes('correction') || typeStr.includes('time') || typeStr.includes('adjustment')) {
            return 'text-[10px] font-medium px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        }
        return 'text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-github-dark-muted dark:bg-github-dark-subtle';
    };

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

    // Correction Date Navigation
    const handleCorrectionPrevDay = () => {
        const date = new Date(correctionFilter.date);
        date.setDate(date.getDate() - 1);
        setCorrectionFilter(prev => ({ ...prev, type: 'day', date: date.toISOString().split('T')[0] }));
    };

    const handleCorrectionNextDay = () => {
        const date = new Date(correctionFilter.date);
        date.setDate(date.getDate() + 1);
        setCorrectionFilter(prev => ({ ...prev, type: 'day', date: date.toISOString().split('T')[0] }));
    };

    const filteredRequests = correctionRequests.filter(req =>
        req.user_name?.toLowerCase().includes(correctionSearchTerm.toLowerCase())
    );

    const getStatusData = () => {
        // Create disjoint sets that sum to total headcount for a valid Pie Chart
        const active = attendanceData.filter(d => d.status === 'Active' || d.status === 'Late Active').length;
        const missedPunch = attendanceData.filter(d => d.status === 'Missed Punch').length;
        const overtime = attendanceData.filter(d => d.status === 'Overtime').length;
        const late = attendanceData.filter(d => d.status === 'Late').length;
        const present = attendanceData.filter(d => d.status === 'Present').length;
        const absent = attendanceData.filter(d => d.status === 'Absent').length;
        const weekOff = attendanceData.filter(d => d.status === 'Week Off').length;
        const holiday = attendanceData.filter(d => d.status === 'Holiday').length;
        const leave = attendanceData.filter(d => d.status === 'Leave').length;

        return [
            { name: 'Present', value: present, color: '#10b981' },
            { name: 'Late', value: late, color: '#f59e0b' },
            { name: 'Overtime', value: overtime, color: '#8b5cf6' },
            { name: 'Missed Punch', value: missedPunch, color: '#f43f5e' },
            { name: 'Absent', value: absent, color: '#ef4444' },
            { name: 'Active', value: active, color: '#3b82f6' },
            { name: 'Week Off', value: weekOff, color: '#6b7280' },
            { name: 'Holiday', value: holiday, color: '#0ea5e9' },
            { name: 'Leave', value: leave, color: '#a855f7' },
        ].filter(item => item.value > 0);
    };

    const getDepartmentData = () => {
        const deptStats = {};
        attendanceData.forEach(item => {
            const dept = item.department || 'Unknown';
            if (!deptStats[dept]) deptStats[dept] = { name: dept, Present: 0, Absent: 0, Late: 0 };

            if (item.status === 'Absent') deptStats[dept].Absent++;
            else if (item.allStatuses ? item.allStatuses.includes('Late') : item.status.includes('Late')) deptStats[dept].Late++;
            else deptStats[dept].Present++;
        });
        return Object.values(deptStats);
    };

    const getTimelineData = () => {
        const hourlyData = {};
        // Initialize hours from 12 AM (0) to 11 PM (23)
        for (let i = 0; i <= 23; i++) {
            hourlyData[i] = { checkins: 0, repeats: 0, active: 0 };
        }

        attendanceData.forEach(item => {
            item.sessions.forEach((session, index) => {
                const inTime = session.rawIn;
                const inHour = inTime.getHours();

                if (hourlyData.hasOwnProperty(inHour)) {
                    if (index === 0) {
                        hourlyData[inHour].checkins++; // First login of the day
                    } else {
                        hourlyData[inHour].repeats++; // Subsequent login
                    }
                }

                const outTime = session.rawOut;
                for (let h = 0; h <= 23; h++) {
                    const hourStart = h;
                    if (inHour <= hourStart) {
                        if (!outTime || outTime.getHours() > hourStart) {
                            hourlyData[h].active++;
                        }
                    }
                }
            });
        });

        return Object.keys(hourlyData).map(hour => {
            const h = parseInt(hour);
            const label = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
            return {
                time: label,
                checkins: hourlyData[hour].checkins,
                repeats: hourlyData[hour].repeats,
                active: hourlyData[hour].active
            };
        });
    };

    const getLoginFrequencyData = () => {
        const frequency = {
            '1 Session': 0,
            '2 Sessions': 0,
            '3 Sessions': 0,
            '4+ Sessions': 0
        };

        attendanceData.forEach(item => {
            if (item.status !== 'Absent') {
                const count = item.sessions.length;
                if (count === 1) frequency['1 Session']++;
                else if (count === 2) frequency['2 Sessions']++;
                else if (count === 3) frequency['3 Sessions']++;
                else if (count >= 4) frequency['4+ Sessions']++;
            }
        });

        return Object.entries(frequency).map(([name, value]) => ({ name, value }));
    };



    return (
        <>
            <style>
                {`
                .no-scrollbar::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
                .no-scrollbar {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                }
                `}
            </style>
            <DashboardLayout title="Live Attendance" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
                <div className="h-[calc(100vh-64px)] overflow-hidden p-3 flex flex-col space-y-3 no-scrollbar">
                    {/* Top Header Row: Tab bar on the left, filters and buttons in line */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                        {/* Tabs */}
                        <div data-tour-id="attendance-tabs" className="flex w-fit items-center gap-1.5 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                            <button
                                onClick={() => setActiveTab('live')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'}`}
                            >
                                <LayoutGrid size={14} className={`${activeTab === 'live' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Live Dashboard</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('requests')}
                                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'}`}
                            >
                                <FileText size={14} className={`${activeTab === 'requests' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Correction Requests</span>
                                {requestCount > 0 && activeTab !== 'requests' && (
                                    <span className={`absolute -top-1.5 -right-2 ${requestCount > 9 ? 'min-w-[20px] h-5 px-1.5 rounded-full' : 'w-5 h-5 rounded-full aspect-square'} bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs leading-none select-none`}>
                                        {requestCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Buttons & Filters in line with the tab bar */}
                        {activeTab === 'live' && (
                            <div data-tour-id="attendance-controls" className="flex flex-wrap items-center gap-2">
                                {/* Search */}
                                <div className="relative w-48 sm:w-56 group">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search name, role, dept..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-7 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs font-normal text-slate-700 dark:text-github-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* AI Summary Button */}
                                <button
                                    onClick={generateAiSummary}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
                                >
                                    <Sparkles size={13} className="animate-pulse" />
                                    <span>AI Summary</span>
                                </button>

                                {/* Unified Filter Button & Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer shadow-sm ${
                                            activeFilterCount > 0
                                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium'
                                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d] text-slate-700 dark:text-github-dark-text hover:bg-slate-50 dark:hover:bg-[#21262d]'
                                        }`}
                                        title="Filter by Department, Designation, or Shift"
                                    >
                                        <Filter size={12} className={activeFilterCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                        <span>Filter</span>
                                        {activeFilterCount > 0 && (
                                            <span className="w-4 h-4 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {isFilterPopoverOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-[80]"
                                                    onClick={() => setIsFilterPopoverOpen(false)}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90] p-3.5 space-y-3"
                                                >
                                                    {/* Popover Header */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#30363d]">
                                                        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 dark:text-github-dark-text">
                                                            <Filter size={13} className="text-indigo-600 dark:text-indigo-400" />
                                                            <span>Filter Options</span>
                                                            {activeFilterCount > 0 && (
                                                                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium rounded-full">
                                                                    {activeFilterCount} active
                                                                </span>
                                                            )}
                                                        </div>
                                                        {activeFilterCount > 0 && (
                                                            <button
                                                                onClick={handleClearAllFilters}
                                                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                                            >
                                                                Reset All
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Department Selection */}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">
                                                            Department
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={departmentFilter}
                                                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                                                className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer font-medium appearance-none"
                                                            >
                                                                {DEPARTMENTS.map((dept) => (
                                                                    <option key={dept.value} value={dept.value} className="bg-white dark:bg-[#0d1117]">
                                                                        {dept.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    {/* Designation Selection */}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">
                                                            Designation
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={desgFilter}
                                                                onChange={(e) => setDesgFilter(e.target.value)}
                                                                className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer font-medium appearance-none"
                                                            >
                                                                {DESIGNATIONS.map((desg) => (
                                                                    <option key={desg.value} value={desg.value} className="bg-white dark:bg-[#0d1117]">
                                                                        {desg.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    {/* Shift Selection */}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted">
                                                            Shift
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={shiftFilter}
                                                                onChange={(e) => setShiftFilter(e.target.value)}
                                                                className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer font-medium appearance-none"
                                                            >
                                                                {SHIFTS.map((s) => (
                                                                    <option key={s.value} value={s.value} className="bg-white dark:bg-[#0d1117]">
                                                                        {s.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    {/* Active Filter Chips inside popover */}
                                                    {activeFilterCount > 0 && (
                                                        <div className="pt-2 border-t border-slate-100 dark:border-[#30363d] flex flex-wrap gap-1.5">
                                                            {departmentFilter !== 'All' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                                                    Dept: {DEPARTMENTS.find(d => d.value === departmentFilter)?.label || departmentFilter}
                                                                    <button type="button" onClick={() => setDepartmentFilter('All')} className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold">×</button>
                                                                </span>
                                                            )}
                                                            {desgFilter !== 'All' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                                                    Role: {DESIGNATIONS.find(d => d.value === desgFilter)?.label || desgFilter}
                                                                    <button type="button" onClick={() => setDesgFilter('All')} className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold">×</button>
                                                                </span>
                                                            )}
                                                            {shiftFilter !== 'All' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                                                    Shift: {SHIFTS.find(s => s.value === shiftFilter)?.label || shiftFilter}
                                                                    <button type="button" onClick={() => setShiftFilter('All')} className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold">×</button>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Active Filter Quick-Clear Pills on Toolbar */}
                                {departmentFilter !== 'All' && (
                                    <button
                                        onClick={() => setDepartmentFilter('All')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors cursor-pointer"
                                        title="Clear department filter"
                                    >
                                        <span>Dept: {DEPARTMENTS.find(d => d.value === departmentFilter)?.label || departmentFilter}</span>
                                        <span className="text-xs font-normal">×</span>
                                    </button>
                                )}
                                {desgFilter !== 'All' && (
                                    <button
                                        onClick={() => setDesgFilter('All')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors cursor-pointer"
                                        title="Clear designation filter"
                                    >
                                        <span>Role: {DESIGNATIONS.find(d => d.value === desgFilter)?.label || desgFilter}</span>
                                        <span className="text-xs font-normal">×</span>
                                    </button>
                                )}
                                {shiftFilter !== 'All' && (
                                    <button
                                        onClick={() => setShiftFilter('All')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors cursor-pointer"
                                        title="Clear shift filter"
                                    >
                                        <span>Shift: {SHIFTS.find(s => s.value === shiftFilter)?.label || shiftFilter}</span>
                                        <span className="text-xs font-normal">×</span>
                                    </button>
                                )}

                                {/* Active Status Filter Pill */}
                                {statusFilter !== 'All' && (
                                    <button
                                        onClick={() => setStatusFilter('All')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors cursor-pointer"
                                        title="Clear status filter"
                                    >
                                        <span>Filter: {statusFilter === 'total' ? 'Total Employees' : statusFilter === 'present' ? 'Present' : statusFilter === 'late' ? 'Late Arrivals' : statusFilter === 'absent' ? 'Absent' : statusFilter === 'active' ? 'Currently Active' : statusFilter}</span>
                                        <span className="text-xs font-normal">×</span>
                                    </button>
                                )}

                                {/* Date Navigation */}
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={handlePrevDay}
                                        type="button"
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                        title="Previous Day"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>

                                    <div className="w-[200px]">
                                        <DatePicker
                                            value={selectedDate}
                                            onChange={(date) => setSelectedDate(date)}
                                            compact={true}
                                        />
                                    </div>

                                    <button
                                        onClick={handleNextDay}
                                        type="button"
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                        title="Next Day"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>

                                {/* View Switcher Buttons */}
                                <div className="flex items-center gap-1 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                                    {[
                                        { id: 'cards', label: 'Overview', icon: LayoutGrid },
                                        { id: 'graph', label: 'Analytics', icon: BarChartIcon },
                                        { id: 'table', label: 'Timeline', icon: Table },
                                        { id: 'map', label: 'Map View', icon: MapPin }
                                    ].map((view) => {
                                        const isSelected = activeView === view.id;
                                        return (
                                            <button
                                                key={view.id}
                                                onClick={() => setActiveView(view.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer ${isSelected
                                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                                                    }`}
                                            >
                                                <view.icon size={13} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                                <span className="leading-none">{view.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col space-y-3 no-scrollbar">

                        {activeTab === 'live' ? (
                            <>
                                {/* Stats Cards */}
                                <div data-tour-id="attendance-live-stats" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 shrink-0">
                                    {statCards.map((stat, index) => {
                                        const isSelected = statusFilter === stat.id;
                                        return (
                                            <div
                                                key={index}
                                                onClick={() => setStatusFilter(isSelected ? 'All' : stat.id)}
                                                className={`p-4 rounded-lg shadow-sm flex items-center justify-between transition-all duration-300 cursor-pointer select-none bg-white dark:bg-dark-card border-2 ${isSelected
                                                        ? 'border-indigo-500 dark:border-indigo-500 scale-[1.01] shadow-md'
                                                        : 'border-slate-200 dark:border-github-dark-border hover:border-slate-350 dark:hover:border-slate-700'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs font-normal text-slate-500 dark:text-github-dark-muted">{stat.label}</p>
                                                        {isSelected && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    <p className="text-2xl font-semibold text-slate-800 dark:text-github-dark-text mt-1">{stat.value}</p>
                                                </div>
                                                <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                                    {stat.icon}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 min-h-0 transition-colors duration-300 flex flex-col space-y-3 no-scrollbar">
                                    <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar ${activeView === 'map' ? 'flex flex-col' : ''}`}>
                                        {activeView === 'table' ? (
                                            <LiveTimelineTab
                                                loading={loading}
                                                attendanceData={attendanceData}
                                                filteredData={filteredData}
                                                setSelectedLiveUser={setSelectedLiveUser}
                                                setPreviewImage={setPreviewImage}
                                                orgTimezone={orgTimezone}
                                            />
                                        ) : activeView === 'cards' ? (
                                            <LiveOverviewTab
                                                loading={loading}
                                                attendanceData={attendanceData}
                                                filteredData={filteredData}
                                                setSelectedLiveUser={setSelectedLiveUser}
                                                setPreviewImage={setPreviewImage}
                                                avatarTimestamp={avatarTimestamp}
                                                getStatusStyle={getStatusStyle}
                                            />
                                        ) : activeView === 'map' ? (
                                            <LiveMapTab
                                                filteredData={filteredData}
                                                searchTerm={searchTerm}
                                                departmentFilter={departmentFilter}
                                            />
                                        ) : activeView === 'graph' ? (
                                            <LiveAnalyticsTab
                                                localAnalytics={localAnalytics}
                                                filteredData={filteredData}
                                                getStatusData={getStatusData}
                                                getDepartmentData={getDepartmentData}
                                                getTimelineData={getTimelineData}
                                                getLoginFrequencyData={getLoginFrequencyData}
                                                presentStaffChartData={presentStaffChartData}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </>
                        ) : (
                            // Approvals Tab Content
                            <CorrectionRequestsTab
                                correctionRequests={correctionRequests}
                                setCorrectionRequests={setCorrectionRequests}
                                selectedRequestId={selectedRequestId}
                                setSelectedRequestId={setSelectedRequestId}
                                selectedRequestData={selectedRequestData}
                                setSelectedRequestData={setSelectedRequestData}
                                requestsLoading={requestsLoading}
                                detailLoading={detailLoading}
                                fetchCorrectionRequests={fetchCorrectionRequests}
                                fetchRequestDetail={fetchRequestDetail}
                                formatCorrectionDate={formatCorrectionDate}
                                setPreviewImage={setPreviewImage}
                                avatarTimestamp={avatarTimestamp}
                            />
                        )}

                        {/* --- Live Attendance Detail Sidebar --- */}
                        <AnimatePresence>
                            {selectedLiveUser && (
                                <UserAttendanceDetailsModal
                                    user={selectedLiveUser}
                                    onClose={() => setSelectedLiveUser(null)}
                                />
                            )}
                        </AnimatePresence>

                        {/* --- Universal Document & Image Preview Modal (Safe separation for document vs selfie lightbox) --- */}
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
                                            src={previewImage}
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
                {/* AI Summary Panel */}
                <AiSummaryModal
                    isOpen={isAiSummaryOpen}
                    onClose={() => setIsAiSummaryOpen(false)}
                    aiSummaryLoading={aiSummaryLoading}
                    aiSummaryError={aiSummaryError}
                    aiSummaryData={aiSummaryData}
                    localAnalytics={localAnalytics}
                    selectedDate={selectedDate}
                    generateAiSummary={generateAiSummary}
                />
            </DashboardLayout>
        </>
    );
};

export default AttendanceMonitoring;

// Attendance Monitoring - Verified Geo-Punches & Biometric Audit Trail
