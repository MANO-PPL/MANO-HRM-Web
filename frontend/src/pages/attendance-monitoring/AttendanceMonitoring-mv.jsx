import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search, Filter, Clock, UserCheck, UserX, Activity, MapPin, Calendar,
    ChevronDown, FileText, CheckCircle, XCircle, AlertCircle, X, LogIn,
    LogOut, History, PieChart as PieChartIcon, BarChart as BarChartIcon,
    RefreshCcw, MoreVertical, LayoutGrid, ArrowRight, Eye, Info,
    ChevronRight, ChevronLeft, Map, Camera, Users, Check, Briefcase
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import DatePicker from '../../components/DatePicker';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Tooltip as MapTooltip } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Timezone-aware date/time parser and normalizer
const parseTimeInTimezone = (r, isOut, orgTimezone) => {
    let fallbackStr = isOut ? r.time_out : r.time_in;
    if (!fallbackStr) return null;
    
    if (fallbackStr instanceof Date) {
        return fallbackStr;
    }
    
    try {
        const parts = String(fallbackStr).split(/[- :T.]/);
        if (parts.length >= 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const hour = parts[3] ? parseInt(parts[3], 10) : 0;
            const minute = parts[4] ? parseInt(parts[4], 10) : 0;
            const second = parts[5] ? parseInt(parts[5], 10) : 0;
            const parsed = new Date(year, month, day, hour, minute, second);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    } catch (err) {
        console.error("Error parsing timestamp:", err);
    }
    return null;
};


const getCurrentTimeInTimezone = (orgTimezone) => {
    const d = new Date();
    try {
        const localStr = d.toLocaleString('en-US', { timeZone: orgTimezone || 'UTC' });
        return new Date(localStr);
    } catch (e) {
        return d;
    }
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

const processAttendanceData = (staff, resolvedTz) => {
    const mergedData = staff.map(u => {
        const daySessions = u.sessions || [];
        let totalMin = 0;
        const sessions = daySessions.map(r => {
            const inTime = parseTimeInTimezone(r, false, resolvedTz);
            const formatTime = (d) => {
                if (!d) return '-';
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };

            const inStr = formatTime(inTime);
            let outStr = '-';
            let isActive = !r.time_out && r.status !== 'MISSED_PUNCH';

            const outTime = parseTimeInTimezone(r, true, resolvedTz);
            if (outTime) {
                outStr = formatTime(outTime);
                if (inTime) totalMin += Math.max(0, (outTime - inTime) / 60000);
            } else if (isActive && inTime) {
                const nowTZ = getCurrentTimeInTimezone(resolvedTz);
                totalMin += Math.max(0, (nowTZ - inTime) / 60000);
            }

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
            'HOLIDAY': 'Holiday',
            'LEAVE': 'Leave',
            'ABSENT': 'Absent',
            'PRESENT': 'Present',
            'LATE': 'Late',
            'OVERTIME': 'Overtime',
            'MISSED_PUNCH': 'Missed Punch',
            'Active': 'Active',
            'Late Active': 'Late Active'
        };
        const status = statusMap[u.status] || u.status || 'Absent';

        const totalHrs = formatTotalTime(totalMin, u.total_hours > 0 ? Number(u.total_hours) : 0);
        const lastLocation = u.sessions && u.sessions.length > 0
            ? u.sessions[0].time_in_address || (u.sessions[0].time_in_lat ? `${u.sessions[0].time_in_lat}, ${u.sessions[0].time_in_lng}` : '-')
            : '-';

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
        else if (status === 'Leave') { allStatuses.push('Leave'); }
        else { allStatuses.push('Absent'); }

        return {
            id: u.user_id,
            name: u.user_name || 'Unknown',
            role: u.desg_name || 'Employee',
            avatar: (u.profile_image_url && u.profile_image_url.trim() !== '') ? u.profile_image_url : (u.user_name ? u.user_name.trim().charAt(0).toUpperCase() : 'U') || 'U',
            department: u.dept_name || 'General',
            sessions,
            status,
            allStatuses,
            totalHours: totalHrs,
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

const MobileAttendanceMonitoring = () => {
    const { avatarTimestamp, user: currentUser } = useAuth();

    // Get initial values from localStorage to support persistent views/filters
    const initialSubTab = localStorage.getItem('live_attendance_active_sub_tab') || 'overview';
    const initialDate = localStorage.getItem('live_attendance_selected_date') || new Date().toISOString().split("T")[0];
    const initialSearch = localStorage.getItem('live_attendance_search_term') || '';
    const initialDept = localStorage.getItem('live_attendance_department_filter') || 'All';
    const initialStatus = localStorage.getItem('live_attendance_status_filter') || 'All';

    // Synchronous memory cache check
    const cachedResponse = attendanceCacheData.dailySummaryAdmin[initialDate];

    const [orgTimezone, setOrgTimezone] = useState(() => cachedResponse?.timezone || 'UTC');

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
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'requests'
    const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'overview' | 'analytics' | 'timeline' | 'map'
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right
    const [loading, setLoading] = useState(() => !cachedResponse);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [activeTheme, setActiveTheme] = useState('voyager');
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

    const MAP_THEMES = {
        dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
        light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
        voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
        satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
        streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
    };

    // Data State
    const [attendanceData, setAttendanceData] = useState(() => {
        if (cachedResponse?.data) {
            return processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC');
        }
        return [];
    });
    const [stats, setStats] = useState(() => {
        if (cachedResponse?.data) {
            const merged = processAttendanceData(cachedResponse.data, cachedResponse.timezone || 'UTC');
            return {
                present: merged.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: merged.filter(d => d.status === 'Absent').length,
                active: merged.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: merged.length
            };
        }
        return { present: 0, late: 0, absent: 0, active: 0, total: 0 };
    });
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [requestCount, setRequestCount] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [selectedDept, setSelectedDept] = useState(initialDept);
    const [selectedDesg, setSelectedDesg] = useState('All');
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const [isDesgDropdownOpen, setIsDesgDropdownOpen] = useState(false);

    // Selection/Popup State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestSubTab, setRequestSubTab] = useState('PENDING');

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
        fetchDepts();
        fetchDesgs();
    }, []);

    const DEPARTMENTS = ['All', ...departments.map(d => d.dept_name)];
    const DESIGNATIONS = ['All', ...designations.map(d => d.desg_name)];

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
        localStorage.setItem('live_attendance_status_filter', statusFilter);
    }, [statusFilter]);

    // --- DATA FETCHING (Feature Parity with Web) ---
    const fetchData = async (silent = false, forceRefresh = false) => {
        const hasCache = !!attendanceCacheData.dailySummaryAdmin[selectedDate];
        if (!silent && !hasCache) setLoading(true);
        try {
            const [summaryRes, requestsRes] = await Promise.all([
                attendanceService.getDailySummaryAdmin(selectedDate, forceRefresh),
                attendanceService.getCorrectionRequests({ limit: 50 })
            ]);

            const staff = summaryRes.data || [];
            const requests = requestsRes.data || [];
            const resolvedTz = summaryRes.timezone || 'UTC';
            setOrgTimezone(resolvedTz);

            // Merge Data Logic using helper
            const mergedData = processAttendanceData(staff, resolvedTz);

            setAttendanceData(mergedData);
            setStats({
                present: mergedData.filter(d => d.status !== 'Absent' && d.status !== 'Week Off' && d.status !== 'Holiday' && d.status !== 'Leave').length,
                late: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Late') : d.status.includes('Late')).length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.allStatuses ? d.allStatuses.includes('Active') : d.status.includes('Active')).length,
                total: mergedData.length
            });

            setCorrectionRequests(requests);
            setRequestCount(requests.filter(r => (r.status || '').toLowerCase() === 'pending').length);

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
        const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'All' || (e.department && String(e.department) === String(selectedDept));
        const matchesDesg = selectedDesg === 'All' || (e.role && String(e.role) === String(selectedDesg));

        
        let matchesStatus = true;
        if (statusFilter === 'present') {
            matchesStatus = e.status !== 'Absent' && e.status !== 'Week Off' && e.status !== 'Holiday' && e.status !== 'Leave';
        } else if (statusFilter === 'late') {
            matchesStatus = e.allStatuses ? e.allStatuses.includes('Late') : e.status.includes('Late');
        } else if (statusFilter === 'absent') {
            matchesStatus = e.status === 'Absent';
        } else if (statusFilter === 'active') {
            matchesStatus = e.allStatuses ? e.allStatuses.includes('Active') : e.status.includes('Active');
        }
        
        return matchesSearch && matchesDept && matchesDesg && matchesStatus;
    });

    const activeEmployees = filteredEmployees.filter(e => e.status !== 'Absent' && e.status !== 'Week Off' && e.status !== 'Holiday' && e.status !== 'Leave');
    const absentEmployees = filteredEmployees.filter(e => ['Absent', 'Week Off', 'Holiday', 'Leave'].includes(e.status));

    return (
        <MobileDashboardLayout title="Live Attendance">
            <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg transition-colors duration-300 pb-24">

                {/* --- STANDARDIZED PILL TAB BAR --- */}
                <div className="sticky top-0 z-20 bg-white dark:bg-black px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-all duration-300">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md mb-4">
                        {MAIN_TABS.map((tab) => {
                            const isActive = activeTab === tab;
                            const label = tab === 'dashboard' ? 'Live Dashboard' : 'Correction Requests';
                            const Icon = tab === 'dashboard' ? Activity : FileText;

                            return (
                                <button
                                    key={tab}
                                    onClick={() => handleTabChange(tab)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 relative ${isActive
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02] shadow-sm'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <Icon size={12} className={`${isActive ? 'text-indigo-500' : 'text-slate-400'} -mt-[1px]`} />
                                    <span className="truncate leading-none">{label}</span>
                                    {tab === 'requests' && requestCount > 0 && !isActive && (
                                        <span className="ml-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                            {requestCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-Navigation Bar (Matching Screenshot Style) */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 px-1 overflow-x-auto no-scrollbar border-b border-slate-50 dark:border-white/5">
                                {SUB_TABS.map((sub) => {
                                    const isActive = activeSubTab === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveSubTab(sub.id)}
                                            className={`flex items-center gap-1.5 py-3 relative transition-all duration-300 whitespace-nowrap ${isActive
                                                ? 'text-indigo-600 dark:text-indigo-400'
                                                : 'text-slate-400 dark:text-github-dark-muted'
                                                }`}
                                        >
                                            <sub.icon size={13} className={`${isActive ? 'text-indigo-500' : 'text-slate-400'} -mt-[0.5px]`} />
                                            <span className={`text-[9.5px] font-black uppercase tracking-normal leading-none ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                                {sub.label}
                                            </span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="subTabUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Date Navigation Bar */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center justify-between gap-1 p-1.5 bg-white dark:bg-github-dark-subtle/20 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                    <button
                                        onClick={handlePrevDay}
                                        className="p-2.5 text-slate-400 hover:text-indigo-500 active:scale-90 transition-all rounded-xl hover:bg-slate-50 dark:hover:bg-white/5"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    <div className="flex-1 min-w-0 relative">
                                        <DatePicker
                                            value={selectedDate}
                                            onChange={setSelectedDate}
                                            maxDate={new Date().toISOString().split('T')[0]}
                                        />
                                        {isToday && (
                                            <div className="absolute -top-1 -right-1">
                                                <span className="flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleNextDay}
                                        disabled={isToday}
                                        className={`p-2.5 active:scale-90 transition-all rounded-xl ${isToday
                                            ? 'text-slate-200 dark:text-white/5 cursor-not-allowed'
                                            : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => fetchData(false, true)}
                                    className="w-12 h-12 bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-center text-slate-400 shadow-sm active:scale-90 transition-all group"
                                >
                                    <RefreshCcw size={18} className={loading ? 'animate-spin text-indigo-500' : 'group-active:rotate-180 transition-transform duration-500'} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats Banner (Closely Packed) */}
                    <div className="flex items-center justify-between pt-5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {activeEmployees.slice(0, 3).map((e, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-github-dark-subtle bg-slate-200 overflow-hidden shadow-sm">
                                        {e.avatar.length > 1 ? <img src={`${e.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black">{e.avatar}</div>}
                                    </div>
                                ))}
                                {activeEmployees.length > 3 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-github-dark-subtle bg-indigo-500 flex items-center justify-center text-[8px] text-white font-black">
                                        +{activeEmployees.length - 3}
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] font-black text-slate-500 dark:text-github-dark-muted uppercase tracking-tighter">
                                {activeEmployees.length} PRESENT TODAY
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusFilter !== 'All' && (
                                <button
                                    onClick={() => setStatusFilter('All')}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 rounded text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
                                >
                                    <span>{statusFilter === 'total' ? 'Total' : statusFilter === 'present' ? 'Present' : statusFilter === 'late' ? 'Late' : statusFilter === 'absent' ? 'Absent' : statusFilter === 'active' ? 'Active' : statusFilter}</span>
                                    <span>×</span>
                                </button>
                            )}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Live
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                        <motion.div
                            key={`${activeTab}-${activeSubTab}`}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag={activeTab === 'dashboard' ? "x" : false}
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={handleDragEnd}
                            className="p-3 space-y-3 touch-pan-y"
                        >
                            {/* --- DASHBOARD VIEW --- */}
                            {activeTab === 'dashboard' && (
                                <div className="space-y-6">
                                    {activeSubTab === 'overview' && (
                                        <div className="space-y-6">
                                            {/* Toolbar */}
                                            <div className="flex gap-2 relative z-[60]">
                                                <div className="relative flex-1 group">
                                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search employees..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-lg text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                                                    />
                                                </div>
                                                <div className="relative flex gap-2">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                                                            className={`w-12 h-12 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition-transform ${selectedDept !== 'All' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-50/20' : 'text-slate-400'}`}
                                                            title="Filter by Department"
                                                        >
                                                            <Filter size={18} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {isDeptDropdownOpen && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-[80]" 
                                                                        onClick={() => setIsDeptDropdownOpen(false)} 
                                                                    />
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                        transition={{ duration: 0.15 }}
                                                                        className="absolute right-0 mt-1.5 min-w-[180px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90]"
                                                                    >
                                                                        <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                                            {DEPARTMENTS.map((dept, idx) => {
                                                                                const deptName = typeof dept === 'object' && dept ? dept.dept_name || dept.value || '' : String(dept);
                                                                                const isSelected = String(selectedDept) === String(deptName);
                                                                                return (
                                                                                    <button
                                                                                        key={idx}
                                                                                        onClick={() => {
                                                                                            setSelectedDept(deptName);
                                                                                            setIsDeptDropdownOpen(false);
                                                                                        }}
                                                                                        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isSelected
                                                                                                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                            }`}
                                                                                    >
                                                                                        <span>{deptName}</span>
                                                                                        {isSelected && <Check size={12} className="text-indigo-500" />}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setIsDesgDropdownOpen(!isDesgDropdownOpen)}
                                                            className={`w-12 h-12 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition-transform ${selectedDesg !== 'All' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-50/20' : 'text-slate-400'}`}
                                                            title="Filter by Designation"
                                                        >
                                                            <Briefcase size={18} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {isDesgDropdownOpen && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-[80]" 
                                                                        onClick={() => setIsDesgDropdownOpen(false)} 
                                                                    />
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                                        transition={{ duration: 0.15 }}
                                                                        className="absolute right-0 mt-1.5 min-w-[180px] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden z-[90]"
                                                                    >
                                                                        <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                                            {DESIGNATIONS.map((desg, idx) => {
                                                                                const desgName = typeof desg === 'object' && desg ? desg.desg_name || desg.value || '' : String(desg);
                                                                                const isSelected = String(selectedDesg) === String(desgName);
                                                                                return (
                                                                                    <button
                                                                                        key={idx}
                                                                                        onClick={() => {
                                                                                            setSelectedDesg(desgName);
                                                                                            setIsDesgDropdownOpen(false);
                                                                                        }}
                                                                                        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isSelected
                                                                                                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                                                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                            }`}
                                                                                    >
                                                                                        <span>{desgName}</span>
                                                                                        {isSelected && <Check size={12} className="text-indigo-500" />}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="col-span-2">
                                                    <CompactStatCard label="Total Employees" value={stats.total} color="indigo" icon={Users} isSelected={statusFilter === 'total'} onClick={() => setStatusFilter(statusFilter === 'total' ? 'All' : 'total')} />
                                                </div>
                                                <CompactStatCard label="Present" value={stats.present} color="emerald" icon={UserCheck} isSelected={statusFilter === 'present'} onClick={() => setStatusFilter(statusFilter === 'present' ? 'All' : 'present')} />
                                                <CompactStatCard label="Late" value={stats.late} color="amber" icon={Clock} isSelected={statusFilter === 'late'} onClick={() => setStatusFilter(statusFilter === 'late' ? 'All' : 'late')} />
                                                <CompactStatCard label="Active" value={stats.active} color="blue" icon={Activity} isSelected={statusFilter === 'active'} onClick={() => setStatusFilter(statusFilter === 'active' ? 'All' : 'active')} />
                                                <CompactStatCard label="Absent" value={stats.absent} color="rose" icon={UserX} isSelected={statusFilter === 'absent'} onClick={() => setStatusFilter(statusFilter === 'absent' ? 'All' : 'absent')} />
                                            </div>

                                            {/* List Section */}
                                            <div className="space-y-3">
                                                {loading && !attendanceData.length ? (
                                                    [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-dark-card animate-pulse rounded-lg" />)
                                                ) : filteredEmployees.length > 0 ? (
                                                    <>
                                                        {activeEmployees.map(emp => (
                                                            <CompactEmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                                        ))}

                                                        {absentEmployees.length > 0 && (
                                                            <div className="flex items-center gap-4 py-4">
                                                                <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                                                                <span className="text-[10px] font-black text-slate-300 dark:text-github-dark-muted uppercase tracking-widest">NOT CHECKED IN</span>
                                                                <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                                                            </div>
                                                        )}

                                                        {absentEmployees.map(emp => (
                                                            <CompactEmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} avatarTimestamp={avatarTimestamp} />
                                                        ))}
                                                    </>
                                                ) : (
                                                    <div className="text-center py-20 bg-white dark:bg-dark-card rounded-lg border-2 border-dashed border-slate-100 dark:border-github-dark-border">
                                                        <p className="text-slate-400 font-bold text-sm">No employees found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeSubTab === 'timeline' && (
                                        <TimelineView
                                            data={filteredEmployees}
                                            loading={loading}
                                            onSelect={(emp) => setSelectedEmployee(emp)}
                                            avatarTimestamp={avatarTimestamp}
                                            orgTimezone={orgTimezone}
                                        />
                                    )}

                                    {activeSubTab === 'analytics' && (
                                        <div className="space-y-6">
                                            {/* Attendance Pie */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                    <PieChartIcon size={12} className="text-indigo-500" /> Attendance Distribution
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
                                                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="w-1/2 space-y-2 pl-4">
                                                        {chartData.status.map((d, i) => (
                                                            <div key={i} className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{d.name}: {d.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Activity Timeline */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest flex items-center gap-2">
                                                        <Activity size={12} className="text-emerald-500" /> Peak Hours Velocity
                                                    </h4>
                                                    <div className="flex gap-3">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[8px] font-black text-slate-400">ACTIVE</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                            <span className="text-[8px] font-black text-slate-400">NEW</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="h-48">
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
                                                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} />
                                                            <YAxis hide />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                            />
                                                            <Area type="monotone" name="Active Staff" dataKey="active" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                                                            <Area type="monotone" name="New Check-ins" dataKey="checkins" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Department Metrics */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                    <LayoutGrid size={12} className="text-purple-500" /> Department Health
                                                </h4>
                                                <div className="h-56">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={chartData.departments} margin={{ left: -30 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800 }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800 }} />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                                            />
                                                            <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                            <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                                            <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Login Frequency */}
                                            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-sm border border-slate-100 dark:border-github-dark-border">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                                                    <BarChartIcon size={12} className="text-rose-500" /> Session Intensity
                                                </h4>
                                                <div className="h-48">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={chartData.frequency} layout="vertical" margin={{ left: -10 }}>
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                                                            <XAxis type="number" hide />
                                                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 800, fill: '#64748b' }} width={70} />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                            />
                                                            <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12}>
                                                                {chartData.frequency.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill="url(#gradBar)" />
                                                                ))}
                                                            </Bar>
                                                            <defs>
                                                                <linearGradient id="gradBar" x1="0" y1="0" x2="1" y2="0">
                                                                    <stop offset="0%" stopColor="#6366f1" />
                                                                    <stop offset="100%" stopColor="#a855f7" />
                                                                </linearGradient>
                                                            </defs>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeSubTab === 'map' && (
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
                                    )}
                                </div>
                            )}

                            {/* --- REQUESTS VIEW --- */}
                            {activeTab === 'requests' && (
                                <div className="space-y-3">
                                    <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                                        {['PENDING', 'HISTORY'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setRequestSubTab(f)}
                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${requestSubTab === f
                                                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                                                    : 'text-slate-400 dark:text-github-dark-muted'
                                                    }`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>

                                    {(() => {
                                        const filtered = correctionRequests.filter(r => {
                                            const status = (r.status || '').toUpperCase();
                                            return requestSubTab === 'PENDING' ? status === 'PENDING' : status !== 'PENDING';
                                        });

                                        return filtered.length > 0 ? (
                                            filtered.map(req => (
                                                <button
                                                    key={req.acr_id}
                                                    onClick={() => setSelectedRequest(req)}
                                                                                                        className={`w-full p-4 rounded-xl border transition-all text-left active:scale-[0.98] flex flex-col ${selectedRequest?.acr_id === req.acr_id
                                                            ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-500/30 dark:border-indigo-500/40 shadow-sm shadow-indigo-500/5'
                                                            : 'bg-slate-50/40 dark:bg-github-dark-subtle/20 border-slate-200/60 dark:border-github-dark-border/80 hover:bg-slate-50/80 dark:hover:bg-github-dark-subtle/40 hover:border-slate-300 dark:hover:border-github-dark-border'
                                                        }`}
                                                >
                                                    <div className="w-full flex justify-between items-start mb-2.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                                                {req.profile_image_url && req.profile_image_url.startsWith('http') ? (
                                                                    <img src={`${req.profile_image_url}?t=${avatarTimestamp}`} alt={req.user_name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    (req.user_name || 'U').charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className={`text-sm font-semibold leading-none mb-1 ${selectedRequest?.acr_id === req.acr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{req.user_name}</h4>
                                                                <p className="text-[10px] font-medium text-slate-500 dark:text-github-dark-muted">ID: {req.user_id}</p>
                                                            </div>
                                                        </div>
                                                        <span className={getRequestTypeStyle(req.correction_type)}>
                                                            {(req.correction_type || '').replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="w-full flex justify-between items-center text-xs text-slate-500 dark:text-github-dark-muted mt-2 border-t border-slate-100 dark:border-github-dark-border/40 pt-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={12} className="text-slate-400" />
                                                            <span>{new Date(req.request_date).toLocaleDateString()}</span>
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            (req.status || '').toLowerCase() === 'pending'
                                                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                                                : (req.status || '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                                                        }`}>
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-20 bg-white dark:bg-dark-card rounded-lg border border-dashed border-slate-200 dark:border-github-dark-border">
                                                <p className="text-slate-400 font-bold text-sm">No {requestSubTab.toLowerCase()} requests</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* --- MODALS --- */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <EmployeeDetailModal
                            employee={selectedEmployee}
                            onClose={() => setSelectedEmployee(null)}
                            date={selectedDate}
                            avatarTimestamp={avatarTimestamp}
                        />
                    )}
                    {selectedRequest && (
                        <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onUpdate={() => fetchData(true, true)} />
                    )}
                </AnimatePresence>
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

const CompactStatCard = ({ label, value, color, icon: Icon, isSelected, onClick }) => {
    const colors = {
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600',
        amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600',
        rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600',
        indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    };
    return (
        <div
            onClick={onClick}
            className={`p-3 rounded-lg shadow-sm flex items-center gap-3 cursor-pointer select-none bg-white dark:bg-dark-card transition-all duration-300 border-2 ${
                isSelected
                    ? 'border-indigo-500 dark:border-indigo-500 scale-[1.01] shadow-md'
                    : 'border-slate-100 dark:border-github-dark-border hover:border-slate-350 dark:hover:border-slate-700'
            }`}
        >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
                <Icon size={16} strokeWidth={3} />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider leading-none mb-1">{label}</p>
                <p className="text-base font-black text-slate-800 dark:text-white leading-none">{value}</p>
            </div>
        </div>
    );
};

const CompactEmployeeCard = ({ employee, onClick, avatarTimestamp }) => {
    const isAbsentOrNonWorking = ['Absent', 'Week Off', 'Holiday', 'Leave'].includes(employee.status);
    return (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-dark-card p-3 rounded-lg border border-slate-100 dark:border-github-dark-border/60 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all relative overflow-hidden ${isAbsentOrNonWorking ? 'opacity-70 grayscale-[0.5]' : ''}`}
        >
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden border border-slate-200 dark:border-github-dark-border shrink-0">
                {employee.avatar.length > 1 ? (
                    <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-500 font-black text-xs">{employee.avatar}</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-black text-[13px] text-slate-800 dark:text-white truncate pr-2 leading-none">{employee.name}</h4>
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${employee.status.includes('Active') ? 'bg-indigo-100 text-indigo-600 animate-pulse' :
                        employee.status.includes('Late') ? 'bg-amber-100 text-amber-600' :
                            employee.status === 'Present' ? 'bg-emerald-100 text-emerald-600' :
                                employee.status === 'Overtime' ? 'bg-purple-100 text-purple-600' :
                                    employee.status === 'Missed Punch' ? 'bg-rose-100 text-rose-600' :
                                        employee.status === 'Week Off' ? 'bg-slate-100 text-slate-500 border border-dashed border-slate-200' :
                                            employee.status === 'Holiday' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                                employee.status === 'Leave' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                    'bg-slate-100 text-slate-500'
                        }`}>
                        {employee.status}
                    </span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-tighter truncate leading-none mb-2">{employee.role} • {employee.department}</p>



                {!isAbsentOrNonWorking && employee.sessions.length > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-50 dark:border-github-dark-border/50">
                        <div className="flex items-center gap-1">
                            <Clock size={8} className="text-slate-300" />
                            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">
                                {employee.sessions[0].in} → {employee.sessions[0].out === '-' ? 'Active' : employee.sessions[0].out}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const EmployeeDetailModal = ({ employee, onClose, date, avatarTimestamp }) => {
    const [previewImage, setPreviewImage] = useState(null);

    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="relative w-full bg-slate-50 dark:bg-dark-card rounded-t-xl p-6 pb-12 max-h-[90vh] overflow-y-auto border-t border-slate-200 dark:border-github-dark-border"
            >
                {/* Lightbox Preview */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4"
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

                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />

                <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 rounded-lg bg-white dark:bg-dark-card border-2 border-white dark:border-github-dark-border overflow-hidden shadow-xl">
                        {employee.avatar.length > 1 ? <img src={`${employee.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-500">{employee.avatar}</div>}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none mb-2">{employee.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">{employee.role}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{employee.department}</span>
                        </div>
                    </div>
                </div>

                {employee.status.includes('Late') && (
                    <div className="p-3 mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                        <h5 className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest mb-1 flex items-center gap-1.5">
                            <AlertCircle size={10} /> Late Reason
                        </h5>
                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed italic">
                            {employee.lateReason ? `"${employee.lateReason}"` : "No reason provided."}
                        </p>
                    </div>
                )}

                <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between">
                        <span>Daily Activity</span>
                        <span className="text-slate-300">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </h4>

                    {employee.sessions.length > 0 ? (
                        employee.sessions.map((s, i) => (
                            <div key={i} className="bg-white dark:bg-dark-card p-5 rounded-lg border border-slate-100 dark:border-github-dark-border shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={12} /> Session #{employee.sessions.length - i}
                                    </span>
                                    {s.isActive && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 animate-pulse">Active</span>}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><LogIn size={12} /></div>
                                                <span className="text-lg font-black text-slate-800 dark:text-white">{s.in}</span>
                                            </div>
                                            <div className="flex items-start gap-1.5 px-0.5">
                                                <MapPin size={10} className="shrink-0 mt-0.5 text-emerald-500 opacity-60" />
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.inLocation}</span>
                                            </div>
                                        </div>
                                        {s.inImage && (
                                            <div className="flex justify-center w-full mt-2">
                                                <div
                                                    onClick={() => setPreviewImage(s.inImage)}
                                                    className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border shadow-sm group active:scale-95 transition-all bg-transparent"
                                                >
                                                    <img src={s.inImage} className="max-h-40 max-w-full w-auto block object-contain" />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Camera size={16} className="text-white" />
                                                    </div>
                                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black text-white uppercase tracking-tighter">Selfie In</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><LogOut size={12} /></div>
                                                <span className="text-lg font-black text-slate-800 dark:text-white">{s.out}</span>
                                            </div>
                                            {s.outLocation && (
                                                <div className="flex items-start gap-1.5 px-0.5">
                                                    <MapPin size={10} className="shrink-0 mt-0.5 text-rose-500 opacity-60" />
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted leading-tight break-words">{s.outLocation}</span>
                                                </div>
                                            )}
                                        </div>
                                        {s.outImage && (
                                            <div className="flex justify-center w-full mt-2">
                                                <div
                                                    onClick={() => setPreviewImage(s.outImage)}
                                                    className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-github-dark-border shadow-sm group active:scale-95 transition-all bg-transparent"
                                                >
                                                    <img src={s.outImage} className="max-h-40 max-w-full w-auto block object-contain" />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Camera size={16} className="text-white" />
                                                    </div>
                                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black text-white uppercase tracking-tighter">Selfie Out</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 bg-white dark:bg-dark-card rounded-lg border-2 border-dashed border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-slate-300">
                            <Activity size={32} className="mb-2 opacity-20" />
                            <p className="text-sm font-bold opacity-50">No activity logged</p>
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={24} />
                </button>
            </motion.div>
        </motion.div>,
        document.body
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

    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-end">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="relative w-full bg-white dark:bg-dark-card rounded-t-xl p-8 pb-12 shadow-2xl border-t border-slate-200 dark:border-github-dark-border"
            >
                <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-8" />

                <div className="mb-8">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2 block">Correction Request</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{request.user_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{request.correction_type} • Request Date: {new Date(request.request_date).toLocaleDateString()}</p>
                </div>

                <div className="space-y-6 mb-8">
                    <div className="bg-slate-50 dark:bg-github-dark-subtle p-5 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3 text-slate-400">
                            <FileText size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Reason / Justification</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic leading-relaxed">"{request.reason || 'No justification provided'}"</p>
                    </div>

                    {request.status?.toUpperCase() === 'PENDING' ? (
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Decision Comment</span>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add internal review comment..."
                                className="w-full bg-slate-50 dark:bg-github-dark-subtle border border-slate-100 dark:border-white/5 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                                rows={3}
                            />
                        </div>
                    ) : (
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Decision</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${request.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                    }`}>
                                    {request.status}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {request.admin_comment || "No comment provided."}
                            </p>
                        </div>
                    )}
                </div>

                {request.status?.toUpperCase() === 'PENDING' && (
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleAction('REJECTED')}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-white dark:bg-github-dark-subtle border-2 border-rose-100 dark:border-rose-500/20 text-rose-500 font-black rounded-xl active:scale-95 transition-all shadow-sm disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleAction('APPROVED')}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                )}

                <button onClick={onClose} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                    <X size={24} />
                </button>
            </motion.div>
        </motion.div>,
        document.body
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

    return createPortal(
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-slate-50 dark:bg-dark-card border-t border-slate-200 dark:border-github-dark-border flex flex-col z-[9999] shadow-2xl rounded-t-2xl pb-6"
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
                                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-github-dark-border h-36 bg-slate-100 dark:bg-github-dark-subtle mt-2">
                                                        <img src={selectedUser.session.inImage} className="w-full h-full object-contain" />
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
                                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-github-dark-border h-36 bg-slate-100 dark:bg-github-dark-subtle mt-2">
                                                        <img src={selectedUser.session.outImage} className="w-full h-full object-contain" />
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
                                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-github-dark-border h-48 bg-slate-100 dark:bg-github-dark-subtle mt-2">
                                                    <img src={selectedUser.type === 'in' ? selectedUser.session.inImage : selectedUser.session.outImage} className="w-full h-full object-contain" />
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
        </>,
        document.body
    );
};

const MapRecenter = ({ data, searchTerm, selectedDept }) => {
    const map = useMap();
    useEffect(() => {
        if (!data || data.length === 0) return;

        // Find bounds for all markers
        const points = [];
        data.forEach(user => {
            user.sessions.forEach(s => {
                if (s.inLat && s.inLng) points.push([Number(s.inLat), Number(s.inLng)]);
                if (s.outLat && s.outLng) points.push([Number(s.outLat), Number(s.outLng)]);
            });
        });

        if (points.length > 0) {
            map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
        }
    }, [searchTerm, selectedDept, data.length > 0, map]);
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
        if (!lat1 || !lng1 || !lat2 || !lng2) return false;
        return Math.abs(Number(lat1) - Number(lat2)) < 0.0001 &&
            Math.abs(Number(lng1) - Number(lng2)) < 0.0001;
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <style>
                {`
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
                        chunkedLoading
                        maxClusterRadius={50}
                        iconCreateFunction={createClusterCustomIcon}
                        showCoverageOnHover={false}
                        spiderfyOnMaxZoom={false}
                        zoomToBoundsOnClick={false}
                    >
                        {data.map(user => (
                            user.sessions.map((session, sIdx) => {
                                const isSameLoc = areCoordsSame(session.inLat, session.inLng, session.outLat, session.outLng);

                                if (isSameLoc) {
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
                                        {session.inLat && session.inLng && (
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
                                        {session.outLat && session.outLng && (
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
