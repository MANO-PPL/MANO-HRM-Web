import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import employeeService from '../../services/employeeService';
import { parsePolicy } from '../../utils/weekOffPolicy';
import { useTour } from '../../context/TourContext';
import {
    Calendar,
    Clock,
    MapPin,
    Coffee,
    CheckCircle,
    AlertCircle,
    XCircle,
    TrendingUp,
    ChevronRight,
    Activity,
    Briefcase
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { toast } from 'react-toastify';

// ─── Per-Page Tour Steps ───────────────────────────────────────────────────
const PAGE_KEY = 'emp_dashboard';

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

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
    const [recentActivity, setRecentActivity] = useState(() => {
        const cached = attendanceCacheData.recentActivity[todayStr];
        return cached?.data || [];
    });
    const [missedPunchWarning, setMissedPunchWarning] = useState(null);
    const [isLoading, setIsLoading] = useState(() => {
        return !attendanceCacheData.myStats[monthKey] || !attendanceCacheData.todayStatus[todayStr];
    });
    const [shift, setShift] = useState(() => {
        return attendanceCacheData.shiftPolicy?.shift || null;
    });

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const formatTime12h = (timeStr) => {
        if (!timeStr) return '--:--';
        const parts = timeStr.split(':');
        if (parts.length < 2) return timeStr;
        let hour = parseInt(parts[0], 10);
        const minute = parts[1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12; // the hour '0' should be '12'
        const strHour = hour < 10 ? '0' + hour : hour;
        return `${strHour}:${minute} ${ampm}`;
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

    // Memoize tour steps to dynamically omit the missed punch warning if there isn't one
    const tourSteps = React.useMemo(() => {
        const steps = [
            {
                targetId: 'emp-dashboard-attendance-btn',
                title: 'My Attendance',
                description: 'Click here to go to the clock-in screen. Use this every day at the start and end of your workday to record your session.',
            },
            {
                targetId: 'emp-dashboard-holiday-btn',
                title: 'Holiday List',
                description: 'View all upcoming public holidays your organization has scheduled. No action needed — these are automatic days off.',
            },
            {
                targetId: 'emp-dashboard-apply-leave-btn',
                title: 'Apply Leave',
                description: 'Submit a time-off request here. Your manager is notified immediately after submission and will approve or reject it.',
            },
        ];

        if (missedPunchWarning) {
            steps.push({
                targetId: 'emp-dashboard-missed-punch',
                title: 'Missed Time Out Warning',
                description: 'This amber banner means you forgot to clock out on a past day. Click Fix Now to submit a correction before it is marked as absent.',
            });
        }

        return steps;
    }, [missedPunchWarning]);

    useEffect(() => {
        fetchDashboardData();
    }, []);



    const fetchDashboardData = async () => {
        try {
            const [statsRes, todayRes, holidaysRes, activityRes, shiftRes] = await Promise.all([
                attendanceService.getMyStats(),
                attendanceService.getTodayStatus(),
                attendanceService.getUpcomingHolidays(),
                attendanceService.getRecentActivity(),
                employeeService.getMyShift()
            ]);

            if (statsRes.success) setStats(statsRes.data);
            if (todayRes.success) setTodayStatus(todayRes.data);
            if (holidaysRes.success) setUpcomingHolidays(holidaysRes.data);
            if (activityRes.success) setRecentActivity(activityRes.data);
            if (shiftRes && (shiftRes.ok || shiftRes.success)) {
                setShift(shiftRes.shift);
            }

            // Fetch recent records to detect missed punches
            const recentRes = await attendanceService.getMyRecords();
            if (recentRes && recentRes.data && recentRes.data.length > 0) {
                const today = new Date();
                const todayDateStr = today.toISOString().split('T')[0];
                
                const todayMidnight = new Date(today);
                todayMidnight.setHours(0, 0, 0, 0);

                const missedDates = [];

                for (const session of recentRes.data) {
                    if (!session.time_out) {
                        const sessionDate = new Date(session.time_in);
                        const sessionDateStr = sessionDate.toISOString().split('T')[0];

                        if (sessionDateStr < todayDateStr) {
                            const diffTime = todayMidnight - new Date(sessionDate).setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            const isNotProcessed = !['ABSENT', 'REJECTED'].includes(session.status);
                            if (isNotProcessed && diffDays <= 7) {
                                missedDates.push(sessionDateStr);
                            }
                        }
                    }
                }
                setMissedPunchWarning(missedDates.length > 0 ? { dates: [...new Set(missedDates)] } : null);
            }
        } catch (error) {
            console.error("Dashboard Error:", error);
            toast.error("Failed to load dashboard parameters");
        } finally {
            setIsLoading(false);
        }
    };

    const formatDashboardTime = (isoString) => {
        if (!isoString || isoString === '--:--') return '--:--';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return isoString;
            
            const timeStr = d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const abbrFormatter = new Intl.DateTimeFormat('en-US', {
                timeZoneName: 'short'
            });
            const parts = abbrFormatter.formatToParts(d);
            const tzPart = parts.find(p => p.type === 'timeZoneName');
            const abbr = tzPart ? tzPart.value : '';
            
            return abbr ? `${timeStr} (${abbr})` : timeStr;
        } catch (e) {
            return isoString;
        }
    };

    const formatDuration = (hours) => {
        if (hours === undefined || hours === null) return '0h';
        const numHours = parseFloat(hours);
        if (isNaN(numHours) || numHours === 0) return '0h';
        const h = Math.floor(numHours);
        const m = Math.round((numHours - h) * 60);
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const getStatusLabel = (status) => {
        if (!status || status === 'ABSENT') return 'No Session Today';
        if (status === 'Active') return 'Active Session';
        if (status === 'Late Active') return 'Late Active';
        return status;
    };

    const getStatusBadgeClass = (status) => {
        if (!status || status === 'ABSENT') return 'bg-white/10 text-white/60 border border-white/5';
        switch (status) {
            case 'Active':
                return 'bg-emerald-500/30 text-emerald-250 border border-emerald-500/20 animate-pulse';
            case 'Late Active':
                return 'bg-orange-500/30 text-orange-200 border border-orange-500/20 animate-pulse';
            case 'PRESENT':
            case 'LATE':
            case 'OVERTIME':
                return 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/20';
            case 'WEEK_OFF':
            case 'HOLIDAY':
                return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
            case 'LEAVE':
                return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
            case 'MISSED_PUNCH':
                return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
            default:
                return 'bg-white/10 text-white/60 border border-white/5';
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <DashboardLayout
            title="Employee Dashboard"
            tourPageKey={PAGE_KEY}
            tourSteps={tourSteps}
        >
            <div className="space-y-8 animate-fade-in-up">
                {/* Welcome Section */}
                <div className="pt-8 pb-8 px-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-900/40 dark:via-indigo-950/40 dark:to-black rounded-2xl shadow-xl relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-[30rem] h-[30rem] bg-sky-500/10 blur-3xl rounded-full pointer-events-none"
                    />

                    <div className="relative z-10 w-full mx-auto flex flex-col gap-6">
                        {/* Greeting and Action Buttons */}
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                                {getGreeting()}, {user?.user_name || user?.name || 'Employee'}!
                            </h1>
                            <p className="text-indigo-100/70 text-base font-medium mt-2">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2">
                            <button
                                onClick={() => navigate('/attendance')}
                                data-tour-id="emp-dashboard-attendance-btn"
                                className="px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-xl shadow-md hover:bg-indigo-50 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2 border border-transparent"
                            >
                                <Clock size={18} className="text-indigo-600" />
                                My Attendance
                            </button>
                            <button
                                onClick={() => navigate('/holidays')}
                                data-tour-id="emp-dashboard-holiday-btn"
                                className="px-6 py-2.5 bg-indigo-555/40 border border-indigo-300/30 text-white font-semibold rounded-xl hover:bg-indigo-500/60 transition-all flex items-center gap-2 backdrop-blur-sm"
                            >
                                <Calendar size={18} />
                                Holiday List
                            </button>
                            <button
                                onClick={() => navigate('/holidays?tab=leaves&apply=true')}
                                data-tour-id="emp-dashboard-apply-leave-btn"
                                className="px-6 py-2.5 bg-indigo-555/40 border border-indigo-300/30 text-white font-semibold rounded-xl hover:bg-indigo-500/60 transition-all flex items-center gap-2 backdrop-blur-sm cursor-pointer"
                            >
                                <Coffee size={18} />
                                Apply Leave
                            </button>
                        </div>

                        {/* Today's Status & Shift Details Side-by-Side Glass Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
                            {/* Today's Status Card */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-center shadow-xl text-white">
                                <div className="flex items-center gap-4 w-full">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                        <Clock size={32} strokeWidth={2.5} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-[10px] font-black text-indigo-200 tracking-[0.2em] mb-3 opacity-90 uppercase">Today's Status</span>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <span className="block text-[10px] font-black text-indigo-200/60 tracking-wider uppercase mb-1">Check In</span>
                                                <span className="text-base font-extrabold font-mono block text-white mt-1">
                                                    {formatDashboardTime(todayStatus?.first_in || todayStatus?.time_in)}
                                                </span>
                                            </div>
                                            <div className="hidden sm:block h-8 w-px bg-white/20"></div>
                                            <div>
                                                <span className="block text-[10px] font-black text-indigo-200/60 tracking-wider uppercase mb-1">Check Out</span>
                                                <span className="text-base font-extrabold font-mono block text-white mt-1">
                                                    {formatDashboardTime(todayStatus?.last_out || todayStatus?.time_out)}
                                                </span>
                                            </div>
                                            <div className="hidden sm:block h-8 w-px bg-white/20"></div>
                                            <div>
                                                <span className="block text-[10px] font-black text-indigo-200/60 tracking-wider uppercase mb-1">Duration</span>
                                                <span className="text-base font-extrabold font-mono text-emerald-350 block mt-1">
                                                    {formatDuration(todayStatus?.total_hours)}
                                                </span>
                                            </div>
                                            <div className="hidden sm:block h-8 w-px bg-white/20"></div>
                                            <div>
                                                <span className="block text-[10px] font-black text-indigo-200/60 tracking-wider uppercase mb-1.5">Status</span>
                                                <div className="mt-1">
                                                    <span className={`px-4 py-1 rounded-full text-xs font-black tracking-wider block text-center ${
                                                        getStatusBadgeClass(todayStatus?.status)
                                                    }`}>
                                                        {getStatusLabel(todayStatus?.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Shift Details Card */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-center shadow-xl text-white">
                                <div className="w-full">
                                    <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-wider text-xs mb-3">
                                        <Calendar size={14} className="text-indigo-300" />
                                        <span>Shift Details</span>
                                    </div>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-bold text-white">
                                            {shift ? shift.name : 'No Shift Assigned'}
                                        </h2>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-l-2 border-indigo-500/30 pl-4 mt-2">
                                        <div className="flex-1">
                                            <span className="block text-[10px] font-black text-indigo-250/70 tracking-wider uppercase">Start Time</span>
                                            <span className="text-base font-extrabold font-mono text-white mt-1 block">
                                                {shift ? formatTime12h(shift.start_time || shift.rules?.shift_timing?.start_time) : '--:--'}
                                            </span>
                                        </div>
                                        <div className="w-px h-10 bg-white/10"></div>
                                        <div className="flex-1">
                                            <span className="block text-[10px] font-black text-indigo-250/70 tracking-wider uppercase">End Time</span>
                                            <span className="text-base font-extrabold font-mono text-white mt-1 block">
                                                {shift ? formatTime12h(shift.end_time || shift.rules?.shift_timing?.end_time) : '--:--'}
                                            </span>
                                        </div>
                                        <div className="w-px h-10 bg-white/10"></div>
                                        <div className="flex-2">
                                            <span className="block text-[10px] font-black text-indigo-250/70 tracking-wider uppercase mb-1.5">Working Days</span>
                                            <div className="flex flex-wrap gap-1">
                                                {weekdays.map(day => {
                                                    const active = shift ? activeWorkingDays.includes(day) : false;
                                                    return (
                                                        <span
                                                            key={day}
                                                            className={`px-2.5 py-0.5 text-[10px] rounded ${
                                                                active 
                                                                    ? 'bg-white/15 text-white border border-white/10 font-semibold' 
                                                                    : 'bg-white/5 text-white/30'
                                                            }`}
                                                        >
                                                            {day}
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
                </div>

                {/* Missed Time Out Banner */}
                {missedPunchWarning && (
                    <div data-tour-id="emp-dashboard-missed-punch" className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl mt-0.5 shrink-0">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-500">Missed Time Out</p>
                                <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed font-medium">
                                    You forgot to time out on {missedPunchWarning.dates.join(', ')}. Please submit a correction request or it will be marked absent.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const missedDate = missedPunchWarning && missedPunchWarning.dates && missedPunchWarning.dates.length > 0 ? missedPunchWarning.dates[0] : '';
                                navigate(`/attendance?tab=my_attendance&subTab=correction&openDrawer=true${missedDate ? `&date=${missedDate}` : ''}`);
                            }}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
                        >
                            Fix Now
                        </button>
                    </div>
                )}



                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Card 1: Present */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-lg text-slate-500 dark:text-github-dark-muted">This Month</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-800 dark:text-github-dark-text mb-1">{stats.daysPresent}</h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-github-dark-muted">Present Days</p>
                    </div>
                    
                    {/* Card 2: Late */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-lg text-slate-500 dark:text-github-dark-muted">This Month</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-800 dark:text-github-dark-text mb-1">{stats.lateDays}</h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-github-dark-muted">Late Arrivals</p>
                    </div>

                    {/* Card 3: Absent */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-lg text-slate-500 dark:text-github-dark-muted">This Month</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-800 dark:text-github-dark-text mb-1">{stats.daysAbsent}</h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-github-dark-muted">Absent Days</p>
                    </div>

                    {/* Card 4: Avg Hours */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-github-dark-subtle rounded-lg text-slate-500 dark:text-github-dark-muted">This Month</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-800 dark:text-github-dark-text mb-1">{stats.avgHours}h</h3>
                        <p className="text-sm font-semibold text-slate-500 dark:text-github-dark-muted">Avg Work Hours</p>
                    </div>
                </div>

                {/* Two-Column Details Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Recent Activity (Today's status) */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col">
                        <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 mb-5">
                            <Activity size={18} className="text-emerald-500" /> Recent Activity
                        </h3>
                        <div className="space-y-4">
                            {[
                                {
                                    label: 'Checked In',
                                    value: formatDashboardTime(todayStatus?.first_in || todayStatus?.time_in),
                                    badge: todayStatus?.status === 'LATE' || todayStatus?.late_minutes > 0 ? 'LATE' : (todayStatus?.first_in ? 'PRESENT' : '--'),
                                    badgeColor: todayStatus?.status === 'LATE' || todayStatus?.late_minutes > 0 
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' 
                                        : (todayStatus?.first_in ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500')
                                },
                                {
                                    label: 'Checked Out',
                                    value: formatDashboardTime(todayStatus?.last_out || todayStatus?.time_out),
                                    badge: todayStatus?.last_out ? 'COMPLETED' : '--',
                                    badgeColor: todayStatus?.last_out 
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' 
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500'
                                },
                                {
                                    label: 'Total Work Hours',
                                    value: formatDuration(todayStatus?.total_hours),
                                    badge: '--',
                                    badgeColor: 'bg-slate-100 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500'
                                },
                                {
                                    label: 'Status',
                                    value: getStatusLabel(todayStatus?.status),
                                    badge: '--',
                                    badgeColor: 'bg-slate-100 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500'
                                }
                            ].map((row, index) => (
                                <div key={index} className="flex items-center gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors border border-slate-100/50 dark:border-transparent">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-650 dark:text-indigo-400">
                                        <Clock size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center justify-between pr-4">
                                        <p className="text-sm font-bold text-slate-800 dark:text-github-dark-text">{row.label}</p>
                                        <p className="text-sm font-semibold text-slate-500 dark:text-github-dark-muted font-mono">{row.value}</p>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${row.badgeColor}`}>
                                        {row.badge}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
 
                    {/* Right Column: Upcoming Holidays */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                <Calendar className="text-indigo-500" size={18} /> Upcoming Holidays
                            </h3>
                            <span 
                                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5" 
                                onClick={() => navigate('/holidays')}
                            >
                                View All <ChevronRight size={14} />
                            </span>
                        </div>
 
                        <div className="space-y-3 flex-1 flex flex-col justify-center py-6">
                            {upcomingHolidays.length > 0 ? (
                                upcomingHolidays.slice(0, 3).map((holiday, index) => (
                                    <div key={index} className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200/50 dark:border-github-dark-border">
                                        <div className="flex flex-col items-center justify-center w-11 h-11 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-center border border-slate-200 dark:border-github-dark-border shrink-0">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tighter">{attendanceService.safeParseDate(holiday.date).toLocaleString('default', { month: 'short' })}</span>
                                            <span className="text-base font-black text-slate-800 dark:text-github-dark-text mt-0.5 leading-none">{attendanceService.safeParseDate(holiday.date).getDate()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-github-dark-text truncate">{holiday.name}</h4>
                                            <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">{attendanceService.safeParseDate(holiday.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 flex flex-col items-center justify-center gap-4">
                                    <div className="w-16 h-16 rounded-full border border-slate-100 dark:border-slate-800/60 flex items-center justify-center bg-slate-50 dark:bg-slate-800/10">
                                        <Calendar size={28} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text">No Upcoming Holidays</h4>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">Enjoy your work!</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default EmployeeDashboard;
