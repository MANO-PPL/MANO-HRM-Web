import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import employeeService from '../../services/employeeService';
import { parsePolicy } from '../../utils/weekOffPolicy';
import {
    Clock,
    Calendar,
    AlertCircle,
    CheckCircle,
    XCircle,
    TrendingUp,
    ChevronRight,
    Coffee,
    Zap
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { toast } from 'react-toastify';

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const todayDate = new Date();
    const monthKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = todayDate.toISOString().split('T')[0];

    const [stats, setStats] = useState(() => {
        const cached = attendanceCacheData.myStats[monthKey];
        return cached?.data || {
            daysPresent: 0,
            daysAbsent: 0,
            lateDays: 0,
            avgHours: 0
        };
    });
    const [todayStatus, setTodayStatus] = useState(() => {
        const cached = attendanceCacheData.todayStatus[todayStr];
        return cached?.data || null;
    });
    const [upcomingHolidays, setUpcomingHolidays] = useState(() => {
        const cached = attendanceCacheData.holidays;
        if (cached?.holidays) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return cached.holidays
                .filter(holiday => {
                    const dateObj = attendanceService.safeParseDate(holiday.holiday_date);
                    return dateObj >= today;
                })
                .sort((a, b) => {
                    const aDate = attendanceService.safeParseDate(a.holiday_date);
                    const bDate = attendanceService.safeParseDate(b.holiday_date);
                    return aDate - bDate;
                })
                .map(holiday => ({
                    id: holiday.holiday_id,
                    name: holiday.holiday_name,
                    date: holiday.holiday_date,
                    type: holiday.holiday_type
                }));
        }
        return [];
    });
    const [loading, setLoading] = useState(() => {
        return !attendanceCacheData.myStats[monthKey] || !attendanceCacheData.todayStatus[todayStr];
    });
    const [missedPunchWarning, setMissedPunchWarning] = useState(null);
    const [shift, setShift] = useState(() => {
        return attendanceCacheData.shiftPolicy?.shift || null;
    });

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
            console.error("Failed to parse policy", e);
            return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        }
    })();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(todayDate);

    const firstName = user?.name ? user.name.trim().split(' ')[0] : 'Employee';

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, todayRes, holidaysRes, shiftRes] = await Promise.allSettled([
                attendanceService.getMyStats(),
                attendanceService.getTodayStatus(),
                attendanceService.getUpcomingHolidays(),
                employeeService.getMyShift()
            ]);

            if (statsRes.status === 'fulfilled' && statsRes.value?.success) setStats(statsRes.value.data);
            if (todayRes.status === 'fulfilled' && todayRes.value?.success) setTodayStatus(todayRes.value.data);
            if (holidaysRes.status === 'fulfilled' && holidaysRes.value?.success) setUpcomingHolidays(holidaysRes.value.data);
            if (shiftRes.status === 'fulfilled' && shiftRes.value && (shiftRes.value.ok || shiftRes.value.success)) {
                setShift(shiftRes.value.shift);
            }

            // Fetch recent records to detect missed punches
            const recentRes = await attendanceService.getMyRecords();
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = today.toISOString().split('T')[0];
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                const correctionDeadlineDays = shiftRes.value?.shift?.rules?.correction_deadline ?? 30;
                const missedDates = [];

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionDate = new Date(session.time_in);
                        const sessionDateStr = sessionDate.toISOString().split('T')[0];

                        if (sessionDateStr < todayDateStr) {
                            const diffTime = todayMidnight - new Date(sessionDate).setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const isNotProcessed = !['ABSENT', 'REJECTED'].includes(session.status);
                            if (isNotProcessed && diffDays <= correctionDeadlineDays) {
                                missedDates.push(sessionDateStr);
                            }
                        }
                    }
                }
                setMissedPunchWarning(missedDates.length > 0 ? { dates: [...new Set(missedDates)] } : null);
            }
        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Session Status computation matching Flutter TodaySessionSummary
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

    return (
        <MobileDashboardLayout title="Employee Dashboard" hideHeader={false} contentClassName="pb-10 space-y-3">
            {/* 1. Edge-to-Edge Welcome Banner matching Flutter's EmployeeWelcomeBanner */}
            <div className="relative overflow-hidden w-full bg-gradient-to-br from-[#4F46E5] to-[#3730A3] dark:from-[#090A1A] dark:to-[#05060A] rounded-b-[24px] shadow-xl text-white pt-3 pb-5 px-3.5 sm:px-5">
                {/* Ambient glowing circles */}
                <div className="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-white/[0.08] pointer-events-none" />
                <div className="absolute -bottom-12 -left-10 w-44 h-44 rounded-full bg-purple-500/[0.12] pointer-events-none" />

                <div className="relative z-10">
                    {/* Greeting & Date */}
                    <h2 className="text-[21px] sm:text-[23px] font-extrabold tracking-tight leading-tight text-white truncate">
                        {getGreeting()}, {firstName}!
                    </h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-white/85 font-medium flex-wrap">
                        <span>{formattedDate}</span>
                        {(user?.designation || user?.department) && (
                            <>
                                <span className="opacity-50">•</span>
                                <span className="truncate max-w-[200px]">
                                    {[user?.designation, user?.department].filter(Boolean).join(' • ')}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Quick Action Buttons (Uniform height 36px single row) */}
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
                        {/* Today's Status Glass Card */}
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

                            {/* 3 Metric Columns */}
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

                        {/* Shift Details Glass Card */}
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

                            {/* 3 Metric Columns */}
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

            {/* Content Container matching Flutter's Padding(horizontal: 12) */}
            <div className="px-3 space-y-3">
                {/* 2. Missed Punch Warning Banner (if applicable) */}
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
                                    Forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const missedDate = missedPunchWarning.dates[0];
                                navigate(`/attendance?tab=my_attendance&subTab=correction&openDrawer=true${missedDate ? `&date=${missedDate}` : ''}`);
                            }}
                            className="px-3 py-1.5 bg-[#D97706] hover:bg-amber-600 active:scale-95 text-white font-bold text-[11px] rounded-[8px] shrink-0 shadow-sm transition-transform cursor-pointer"
                        >
                            Fix Now
                        </button>
                    </div>
                )}

                {/* 3. Quick Stats Grid (4 Dynamic Cards matching Flutter: Present, Late, Absent, Avg Hours) */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Present Days */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-emerald-500/12 flex items-center justify-center text-[#10B981]">
                                <CheckCircle size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-2 py-0.5 rounded-[6px]">
                                This Month
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.daysPresent}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Present Days
                            </span>
                        </div>
                    </div>

                    {/* Late Arrivals */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-amber-500/12 flex items-center justify-center text-[#F59E0B]">
                                <Clock size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-2 py-0.5 rounded-[6px]">
                                This Month
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.lateDays}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Late Arrivals
                            </span>
                        </div>
                    </div>

                    {/* Absent Days */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-red-500/12 flex items-center justify-center text-[#EF4444]">
                                <XCircle size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-2 py-0.5 rounded-[6px]">
                                This Month
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {stats.daysAbsent}
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Absent Days
                            </span>
                        </div>
                    </div>

                    {/* Avg Work Hours */}
                    <div className="p-3 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[14px] shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-[9px] bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                <TrendingUp size={18} />
                            </div>
                            <span className="text-[8.5px] font-semibold text-[#64748B] dark:text-gray-400 bg-slate-100 dark:bg-[#21262D] px-2 py-0.5 rounded-[6px]">
                                This Month
                            </span>
                        </div>
                        <div>
                            <div className="text-[22px] font-extrabold text-[#0F172A] dark:text-white leading-none tracking-tight">
                                {typeof stats.avgHours === 'number' ? stats.avgHours.toFixed(1) : stats.avgHours}h
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B] dark:text-gray-400 mt-1 block">
                                Avg Work Hours
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Recent Activity Card matching Flutter EmployeeRecentActivityCard */}
                <div className="p-4 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[16px] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={18} className="text-[#10B981]" />
                        <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-white">
                            Recent Activity
                        </h3>
                    </div>

                    <div className="space-y-2">
                        {/* Checked In */}
                        <div className="p-2.5 rounded-[10px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/70 dark:border-[#30363D]/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                    <Clock size={15} />
                                </div>
                                <span className="text-[12.5px] font-semibold text-[#1E293B] dark:text-white">Checked In</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[12.5px] font-semibold text-slate-700 dark:text-gray-300">
                                    {formatTime12h(todayStatus?.time_in)}
                                </span>
                                {todayStatus?.time_in && (
                                    <span className={`px-1.5 py-0.5 rounded-[6px] text-[9px] font-bold ${
                                        isLate ? 'bg-amber-500/15 text-[#F59E0B]' : 'bg-emerald-500/15 text-[#10B981]'
                                    }`}>
                                        {isLate ? 'LATE' : 'PRESENT'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Checked Out */}
                        <div className="p-2.5 rounded-[10px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/70 dark:border-[#30363D]/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                    <Clock size={15} />
                                </div>
                                <span className="text-[12.5px] font-semibold text-[#1E293B] dark:text-white">Checked Out</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[12.5px] font-semibold text-slate-700 dark:text-gray-300">
                                    {formatTime12h(todayStatus?.time_out)}
                                </span>
                                {todayStatus?.time_out && (
                                    <span className="px-1.5 py-0.5 rounded-[6px] text-[9px] font-bold bg-indigo-500/15 text-[#6366F1]">
                                        COMPLETED
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Total Work Hours */}
                        <div className="p-2.5 rounded-[10px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/70 dark:border-[#30363D]/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                    <Clock size={15} />
                                </div>
                                <span className="text-[12.5px] font-semibold text-[#1E293B] dark:text-white">Total Work Hours</span>
                            </div>
                            <span className="font-mono text-[12.5px] font-semibold text-slate-700 dark:text-gray-300">
                                {todayStatus?.duration || '0h'}
                            </span>
                        </div>

                        {/* Status */}
                        <div className="p-2.5 rounded-[10px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/70 dark:border-[#30363D]/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/12 flex items-center justify-center text-[#6366F1]">
                                    <Clock size={15} />
                                </div>
                                <span className="text-[12.5px] font-semibold text-[#1E293B] dark:text-white">Status</span>
                            </div>
                            <span className="font-mono text-[12.5px] font-semibold text-slate-700 dark:text-gray-300">
                                {sessionStatusLabel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 5. Upcoming Holidays Card matching Flutter EmployeeUpcomingHolidaysCard */}
                <div className="p-4 bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-[16px] shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-[#6366F1]" />
                            <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-white">
                                Upcoming Holidays
                            </h3>
                        </div>
                        <button
                            onClick={() => navigate('/holidays?tab=holidays')}
                            className="inline-flex items-center gap-0.5 text-[12px] font-bold text-[#6366F1] hover:underline cursor-pointer"
                        >
                            <span>View All</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {upcomingHolidays.length > 0 ? (
                            upcomingHolidays.slice(0, 3).map((holiday, idx) => {
                                const dateObj = attendanceService.safeParseDate(holiday.date);
                                const monthStr = dateObj ? dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'HOL';
                                const dayStr = dateObj ? String(dateObj.getDate()).padStart(2, '0') : '--';
                                const dayName = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long' }) : '';

                                return (
                                    <div
                                        key={holiday.id || idx}
                                        className="p-2.5 rounded-[12px] bg-slate-50 dark:bg-[#21262D]/50 border border-slate-200/70 dark:border-[#30363D]/40 flex items-center gap-3"
                                    >
                                        <div className="w-11 py-1 rounded-[8px] bg-indigo-500/12 border border-indigo-500/25 flex flex-col items-center justify-center text-center shrink-0">
                                            <span className="text-[9px] font-extrabold text-[#6366F1] uppercase tracking-wider leading-none">
                                                {monthStr}
                                            </span>
                                            <span className="text-[14px] font-extrabold text-[#0F172A] dark:text-white leading-tight mt-0.5">
                                                {dayStr}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-[12.5px] font-bold text-[#0F172A] dark:text-white truncate">
                                                {holiday.name}
                                            </h4>
                                            <p className="text-[10.5px] text-slate-500 dark:text-gray-400 mt-0.5">
                                                {dayName}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-5 text-xs text-slate-400 dark:text-gray-500 italic">
                                No upcoming holidays
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MobileDashboardLayout>
    );
};

export default EmployeeDashboard;
