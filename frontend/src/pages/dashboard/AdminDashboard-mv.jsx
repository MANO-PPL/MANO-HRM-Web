import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    Calendar,
    Briefcase,
    RefreshCw,
    Activity,
    MapPin,
    UserPlus,
    FileText,
    ChevronRight,
    Coffee,
    AlertCircle
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { adminService, adminCacheData } from '../../services/adminService';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import employeeService from '../../services/employeeService';
import { parsePolicy } from '../../utils/weekOffPolicy';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user, avatarTimestamp } = useAuth();
    const isHr = Boolean(user?.role === 'hr' || user?.isHr || (user?.designation && user.designation.toLowerCase().includes('hr')));

    const defaultCacheKey = 'weekly_null_null';

    const [stats, setStats] = useState(() => {
        const cached = adminCacheData.dashboardStats[defaultCacheKey];
        return cached?.stats || {
            presentToday: 0,
            totalEmployees: 0,
            absentToday: 0,
            lateCheckins: 0,
            onLeave: 0
        };
    });
    const [trends, setTrends] = useState(() => {
        const cached = adminCacheData.dashboardStats[defaultCacheKey];
        return cached?.trends || {
            present: '0%',
            absent: '0%',
            late: '0%'
        };
    });
    const [chartData, setChartData] = useState(() => {
        const cached = adminCacheData.dashboardStats[defaultCacheKey];
        return cached?.chartData || [];
    });
    const [activities, setActivities] = useState(() => {
        const cached = adminCacheData.dashboardStats[defaultCacheKey];
        return cached?.activities || [];
    });
    const [isLoading, setIsLoading] = useState(() => !adminCacheData.dashboardStats[defaultCacheKey]);

    const [todayStatus, setTodayStatus] = useState(null);
    const [shift, setShift] = useState(null);
    const [missedPunchWarning, setMissedPunchWarning] = useState(null);

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const formatTime12h = (timeVal) => {
        if (!timeVal || timeVal === '--:--' || timeVal === '-') return '--:--';
        try {
            const str = String(timeVal).trim();
            if (str.includes('T') || str.includes(' ')) {
                const parsed = new Date(str);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                }
            }
            const parts = str.split(':');
            if (parts.length >= 2) {
                let hour = parseInt(parts[0], 10);
                const minute = parts[1].padStart(2, '0');
                const ampm = hour >= 12 ? 'PM' : 'AM';
                hour = hour % 12;
                if (hour === 0) hour = 12;
                const strHour = hour < 10 ? '0' + hour : hour;
                return `${strHour}:${minute} ${ampm}`;
            }
            return str;
        } catch (_) {
            return String(timeVal);
        }
    };

    const activeWorkingDays = (() => {
        const policy = shift?.rules?.week_off_policy;
        if (!policy) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        try {
            const parsed = parsePolicy(policy);
            return parsed.workingDays || [];
        } catch (e) {
            return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        }
    })();

    const todayDate = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(todayDate);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const firstName = user?.user_name?.split(' ')[0] || user?.name?.split(' ')[0] || (isHr ? 'HR Manager' : 'Admin');

    useEffect(() => {
        fetchDashboardData(false);
        fetchPersonalStatus();
    }, []);

    const fetchPersonalStatus = async () => {
        try {
            const [statusRes, shiftRes, recentRes] = await Promise.allSettled([
                attendanceService.getTodayStatus(),
                employeeService.getMyShift(),
                attendanceService.getMyRecords()
            ]);

            if (statusRes.status === 'fulfilled' && statusRes.value?.success) {
                setTodayStatus(statusRes.value.data);
            }
            if (shiftRes.status === 'fulfilled' && shiftRes.value && (shiftRes.value.ok || shiftRes.value.success)) {
                setShift(shiftRes.value.shift);
            }

            if (recentRes.status === 'fulfilled' && recentRes.value?.data?.length > 0) {
                const todayStr = new Date().toISOString().split('T')[0];
                const missed = [];
                for (const session of recentRes.value.data) {
                    if (!session.time_out && session.time_in) {
                        const sDate = new Date(session.time_in).toISOString().split('T')[0];
                        if (sDate < todayStr && !['ABSENT', 'REJECTED'].includes(session.status)) {
                            missed.push(sDate);
                        }
                    }
                }
                setMissedPunchWarning(missed.length > 0 ? [...new Set(missed)] : null);
            }
        } catch (err) {
            console.error("Failed to fetch admin personal attendance info:", err);
        }
    };

    const fetchDashboardData = async (forceRefresh = false) => {
        try {
            if (!adminCacheData.dashboardStats[defaultCacheKey] || forceRefresh) {
                setIsLoading(true);
            }
            const res = await adminService.getDashboardStats('weekly', null, null, forceRefresh);
            if (res.success) {
                let finalActivities = res.activities || [];
                if (finalActivities.length === 0) {
                    try {
                        const attendanceRes = await attendanceService.getRealTimeAttendance(null, forceRefresh);
                        if (attendanceRes.data) {
                            finalActivities = attendanceRes.data.map(record => ({
                                id: `att-${record.attendance_id || record.acr_id || record.id || Math.random()}`,
                                user: record.user_name,
                                action: record.time_out ? 'Checked Out' : 'Checked In',
                                time: (() => {
                                    const raw = record.time_out || record.time_in;
                                    if (!raw) return '';
                                    const d = new Date(raw);
                                    return isNaN(d.getTime()) ? String(raw) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                })(),
                                profile_image_url: record.profile_image_url,
                                role: record.designation || 'Staff'
                            })).slice(0, 10);
                        }
                    } catch (_) {}
                }

                setStats(res.stats);
                setTrends(res.trends);
                setChartData(res.chartData);
                setActivities(finalActivities);

                adminCacheData.dashboardStats[defaultCacheKey] = {
                    success: true,
                    stats: res.stats,
                    trends: res.trends,
                    chartData: res.chartData,
                    activities: finalActivities
                };
            }
        } catch (error) {
            console.error("Dashboard error:", error);
            toast.error("Failed to load dashboard statistics");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchDashboardData(true);
        fetchPersonalStatus();
    };

    const refreshButton = (
        <button
            onClick={handleRefresh}
            className="p-1 text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            title="Refresh Dashboard"
        >
            <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
        </button>
    );

    // Personal Session Status computation
    const hasActiveSession = Boolean(todayStatus?.time_in && !todayStatus?.time_out);
    const isLate = Boolean(todayStatus?.is_late || todayStatus?.late_minutes > 0 || (todayStatus?.status && todayStatus.status.toUpperCase() === 'LATE'));
    let sessionStatusLabel = 'No Session Today';
    if (hasActiveSession) {
        sessionStatusLabel = isLate ? 'Late Active' : 'Active Session';
    } else if (todayStatus?.time_out) {
        sessionStatusLabel = isLate ? 'LATE' : 'PRESENT';
    } else if (todayStatus?.status) {
        sessionStatusLabel = todayStatus.status;
    }

    // Quick Action Definitions matching Flutter MobileAdminDashboardContent & MobileHrDashboardContent
    const quickActions = isHr ? [
        { title: 'Mark Attendance', icon: CheckCircle, color: '#10B981', path: '/attendance' },
        { title: 'Add Employee', icon: UserPlus, color: '#6366F1', path: '/employees' },
        { title: 'Live Monitor', icon: Activity, color: '#EF4444', path: '/attendance-monitoring' },
        { title: 'Generate Report', icon: FileText, color: '#10B981', path: '/reports' }
    ] : [
        { title: 'Mark Attendance', icon: CheckCircle, color: '#10B981', path: '/attendance' },
        { title: 'Manage Shifts', icon: Briefcase, color: '#8B5CF6', path: '/shifts' },
        { title: 'Geo Fencing', icon: MapPin, color: '#E11D48', path: '/geo-fencing' },
        { title: 'Add Employee', icon: UserPlus, color: '#6366F1', path: '/employees' }
    ];

    return (
        <MobileDashboardLayout title="Dashboard" hideHeader={false} headerAction={refreshButton} contentClassName="pb-10 space-y-3">
            {/* 1. Flush Edge-to-Edge Welcome Header matching Flutter's EmployeeHeaderStack */}
            <div className="relative overflow-hidden w-full bg-gradient-to-br from-[#4F46E5] to-[#3730A3] dark:from-[#090A1A] dark:to-[#05060A] rounded-b-[24px] shadow-xl text-white pt-3 pb-5 px-3.5 sm:px-5">
                <div className="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-white/[0.08] pointer-events-none" />
                <div className="absolute -bottom-12 -left-10 w-44 h-44 rounded-full bg-purple-500/[0.12] pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-[21px] sm:text-[23px] font-extrabold tracking-tight leading-tight text-white truncate">
                        {getGreeting()}, {firstName}!
                    </h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-white/85 font-medium flex-wrap">
                        <span>{formattedDate}</span>
                        <span className="opacity-50">•</span>
                        <span className="truncate max-w-[200px]">
                            {user?.designation || (isHr ? 'HR Manager' : 'Administrator')}
                        </span>
                    </div>

                    {/* Quick Navigation Row */}
                    <div className="mt-3.5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                        <button
                            onClick={() => navigate('/attendance')}
                            className="h-9 px-3.5 rounded-[10px] bg-white text-[#4F46E5] font-bold text-[11.5px] flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 transition-transform cursor-pointer"
                        >
                            <Clock size={15} />
                            <span>My Attendance</span>
                        </button>
                        <button
                            onClick={() => navigate('/holidays?tab=holidays')}
                            className="h-9 px-3.5 rounded-[10px] bg-white/15 hover:bg-white/20 border border-white/20 text-white font-semibold text-[11.5px] flex items-center gap-1.5 shrink-0 backdrop-blur-md active:scale-95 transition-transform cursor-pointer"
                        >
                            <Calendar size={15} />
                            <span>Holiday List</span>
                        </button>
                        <button
                            onClick={() => navigate('/holidays?tab=leaves&apply=true')}
                            className="h-9 px-3.5 rounded-[10px] bg-white/15 hover:bg-white/20 border border-white/20 text-white font-semibold text-[11.5px] flex items-center gap-1.5 shrink-0 backdrop-blur-md active:scale-95 transition-transform cursor-pointer"
                        >
                            <Coffee size={15} />
                            <span>Apply Leave</span>
                        </button>
                    </div>

                    {/* Glass Cards: Today's Status & Shift Details */}
                    <div className="mt-3.5 space-y-2.5">
                        {/* Today's Status */}
                        <div className="bg-white/12 border border-white/18 backdrop-blur-md rounded-[14px] p-3 text-white">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-[7px] bg-white/20 flex items-center justify-center">
                                        <Clock size={14} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/90 tracking-wider">
                                        TODAY'S STATUS
                                    </span>
                                </div>
                                <div className={`px-2 py-0.5 rounded-[6px] text-[9.5px] font-semibold border ${
                                    sessionStatusLabel.includes('Active')
                                        ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300'
                                        : sessionStatusLabel === 'LATE' || sessionStatusLabel.includes('Late')
                                            ? 'bg-orange-500/25 border-orange-500/60 text-orange-300'
                                            : sessionStatusLabel === 'PRESENT'
                                                ? 'bg-white/25 border-white/40 text-white'
                                                : 'bg-white/10 border-white/20 text-white/80'
                                }`}>
                                    {sessionStatusLabel}
                                </div>
                            </div>

                            <div className="text-[13px] font-bold text-white mb-2 truncate">
                                {hasActiveSession
                                    ? 'Current Active Session'
                                    : todayStatus?.time_in
                                        ? 'Daily Attendance Logged'
                                        : 'No Active Session Today'}
                            </div>

                            <div className="h-[54px] bg-black/15 border border-white/10 rounded-[10px] px-2.5 py-1.5 flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-1">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">CHECK IN</span>
                                    <span className="block text-[12.5px] font-bold font-mono text-white mt-0.5 truncate">
                                        {formatTime12h(todayStatus?.time_in)}
                                    </span>
                                </div>
                                <div className="w-px h-[26px] bg-white/20 shrink-0" />
                                <div className="flex-1 min-w-0 px-2">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">CHECK OUT</span>
                                    <span className="block text-[12.5px] font-bold font-mono text-white mt-0.5 truncate">
                                        {formatTime12h(todayStatus?.time_out)}
                                    </span>
                                </div>
                                <div className="w-px h-[26px] bg-white/20 shrink-0" />
                                <div className="flex-1 min-w-0 pl-1">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">DURATION</span>
                                    <span className="block text-[12.5px] font-bold font-mono text-[#6EE7B7] mt-0.5 truncate">
                                        {todayStatus?.duration || '0h'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Shift Details */}
                        <div className="bg-white/12 border border-white/18 backdrop-blur-md rounded-[14px] p-3 text-white">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-[7px] bg-white/20 flex items-center justify-center">
                                        <Calendar size={14} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/90 tracking-wider">
                                        SHIFT DETAILS
                                    </span>
                                </div>
                                <div className="px-2 py-0.5 rounded-[6px] text-[9.5px] font-semibold bg-white/15 border border-white/25 text-white">
                                    {shift ? 'Active' : 'Regular'}
                                </div>
                            </div>

                            <div className="text-[13px] font-bold text-white mb-2 truncate">
                                {shift?.name || 'Regular General Shift'}
                            </div>

                            <div className="h-[54px] bg-black/15 border border-white/10 rounded-[10px] px-2.5 py-1.5 flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-1">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">START TIME</span>
                                    <span className="block text-[12.5px] font-bold font-mono text-white mt-0.5 truncate">
                                        {formatTime12h(shift?.start_time || shift?.rules?.shift_timing?.start_time || '09:00')}
                                    </span>
                                </div>
                                <div className="w-px h-[26px] bg-white/20 shrink-0" />
                                <div className="flex-1 min-w-0 px-2">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">END TIME</span>
                                    <span className="block text-[12.5px] font-bold font-mono text-white mt-0.5 truncate">
                                        {formatTime12h(shift?.end_time || shift?.rules?.shift_timing?.end_time || '18:00')}
                                    </span>
                                </div>
                                <div className="w-px h-[26px] bg-white/20 shrink-0" />
                                <div className="flex-1 min-w-0 pl-1">
                                    <span className="block text-[9px] font-bold text-white/75 tracking-wider truncate">WORK DAYS</span>
                                    <div className="flex items-center gap-0.5 mt-1 overflow-hidden">
                                        {weekdays.map(d => {
                                            const isActive = activeWorkingDays.includes(d);
                                            return (
                                                <span
                                                    key={d}
                                                    className={`text-[8.5px] font-bold leading-none ${
                                                        isActive ? 'text-white' : 'text-white/40'
                                                    }`}
                                                >
                                                    {d[0]}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className="px-3 space-y-3">
                {/* Missed Punch Banner (if applicable) */}
                {missedPunchWarning && (
                    <div className="p-3.5 bg-amber-50 dark:bg-[#451A03]/50 border border-amber-200 dark:border-[#B45309]/50 rounded-[14px] flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-amber-500/18 flex items-center justify-center shrink-0 text-amber-600">
                                <AlertCircle size={20} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-[#FDE68A] leading-tight">
                                    Missed Time Out
                                </h4>
                                <p className="text-[11px] text-amber-700/90 dark:text-[#FDE68A]/80 leading-snug mt-0.5">
                                    Forgot to time out on {missedPunchWarning.join(', ')}. Please submit a correction.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate(`/attendance?tab=my_attendance&subTab=correction&openDrawer=true`)}
                            className="px-3 py-1.5 bg-[#D97706] hover:bg-amber-600 active:scale-95 text-white font-bold text-[11px] rounded-[8px] shrink-0 shadow-sm transition-transform cursor-pointer"
                        >
                            Fix Now
                        </button>
                    </div>
                )}

                {/* 2. KPI Section Grid (Present, Absent, Late, On Leave) */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Present Today */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-emerald-500/12 flex items-center justify-center text-[#10B981]">
                                <CheckCircle size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-[6px]">
                                {trends.present?.startsWith('-') ? trends.present : `+${trends.present || '0%'}`}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                    {stats.presentToday}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400 dark:text-gray-500">
                                    / {stats.totalEmployees}
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Present Today
                            </span>
                        </div>
                    </div>

                    {/* Absent Today */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-red-500/12 flex items-center justify-center text-[#EF4444]">
                                <XCircle size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-1.5 py-0.5 rounded-[6px]">
                                {trends.absent || '0%'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.absentToday}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Absent Today
                            </span>
                        </div>
                    </div>

                    {/* Late Check-ins */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-amber-500/12 flex items-center justify-center text-[#F59E0B]">
                                <Clock size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-1.5 py-0.5 rounded-[6px]">
                                {trends.late || '0%'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.lateCheckins}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Late Check-ins
                            </span>
                        </div>
                    </div>

                    {/* On Leave */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                <Calendar size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-1.5 py-0.5 rounded-[6px]">
                                Monthly
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.onLeave || 0}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                On Leave
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Quick Actions matching Flutter's adminQuickActions / hrQuickActions */}
                <div>
                    <h3 className="text-[12px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-0.5">
                        Quick Actions
                    </h3>
                    <div className="space-y-1.5">
                        {quickActions.map(action => {
                            const IconComponent = action.icon;
                            return (
                                <div
                                    key={action.title}
                                    onClick={() => navigate(action.path)}
                                    className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center"
                                            style={{ backgroundColor: `${action.color}1F`, color: action.color }}
                                        >
                                            <IconComponent size={18} />
                                        </div>
                                        <span className="text-[13.5px] font-semibold text-[#0F172A] dark:text-white">
                                            {action.title}
                                        </span>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400 dark:text-gray-500" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Analytics Section (Trends Chart & Activity Feed) */}
                <div>
                    <h3 className="text-[12px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-0.5">
                        Analytics
                    </h3>

                    {/* Chart Container */}
                    <div className="p-3.5 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[16px] shadow-sm mb-3">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-[13px] font-bold text-[#0F172A] dark:text-white block">
                                    Attendance Trends
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">
                                    Weekly check-in pattern
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                <TrendingUp size={15} />
                                <span>{trends.present || '+0%'}</span>
                            </div>
                        </div>

                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAdminPresent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0F172A',
                                            borderRadius: '12px',
                                            border: 'none',
                                            color: '#fff',
                                            fontSize: '11px',
                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="present"
                                        stroke="#10B981"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#colorAdminPresent)"
                                        name="Present"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Live Activity Feed */}
                    <div className="p-3.5 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[16px] shadow-sm">
                        <div className="flex items-center justify-between mb-3 px-0.5">
                            <h4 className="text-[13px] font-bold text-[#0F172A] dark:text-white">
                                Activity Feed
                            </h4>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                                    LIVE
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {activities.length > 0 ? (
                                activities.slice(0, 5).map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        className="p-2.5 rounded-[12px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/60 dark:border-[#30363D]/40 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-[#6366F1] font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                                                {item.profile_image_url ? (
                                                    <img
                                                        src={`${item.profile_image_url}?t=${avatarTimestamp}`}
                                                        alt={item.user}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    item.user?.charAt(0) || 'U'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[12.5px] font-bold text-[#0F172A] dark:text-white truncate">
                                                    {item.user}
                                                </div>
                                                <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate block">
                                                    {item.role || 'Staff'} • {item.action}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-mono text-[10.5px] font-semibold text-slate-500 dark:text-gray-400 shrink-0">
                                            {item.time || 'Now'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-5 text-xs text-slate-400 dark:text-gray-500 italic">
                                    No activity records today
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default AdminDashboard;
