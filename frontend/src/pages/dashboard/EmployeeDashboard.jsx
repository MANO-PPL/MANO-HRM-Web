import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
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
        if (cached?.data) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return cached.data
                .filter(holiday => new Date(holiday.date) >= today)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
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

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, todayRes, holidaysRes, activityRes] = await Promise.all([
                attendanceService.getMyStats(),
                attendanceService.getTodayStatus(),
                attendanceService.getUpcomingHolidays(),
                attendanceService.getRecentActivity()
            ]);

            if (statsRes.success) setStats(statsRes.data);
            if (todayRes.success) setTodayStatus(todayRes.data);
            if (holidaysRes.success) setUpcomingHolidays(holidaysRes.data);
            if (activityRes.success) setRecentActivity(activityRes.data);

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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <DashboardLayout title="Employee Dashboard">
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

                    <div className="relative z-10 w-full mx-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    {getGreeting()}, {user?.user_name || user?.name || 'Employee'}!
                                </h1>
                                <p className="text-indigo-100/70 text-base font-medium mt-2">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 mb-8">
                            <button
                                onClick={() => navigate('/attendance')}
                                className="px-6 py-2.5 bg-white text-indigo-600 font-semibold rounded-xl shadow-md hover:bg-indigo-50 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2 border border-transparent"
                            >
                                <Clock size={18} />
                                My Attendance
                            </button>
                            <button
                                onClick={() => navigate('/holidays')}
                                className="px-6 py-2.5 bg-indigo-500/40 border border-indigo-300/30 text-white font-semibold rounded-xl hover:bg-indigo-500/60 transition-all flex items-center gap-2 backdrop-blur-sm"
                            >
                                <Calendar size={18} />
                                Holiday List
                            </button>
                            <button
                                onClick={() => navigate('/apply-leave')}
                                className="px-6 py-2.5 bg-indigo-500/40 border border-indigo-300/30 text-white font-semibold rounded-xl hover:bg-indigo-500/60 transition-all flex items-center gap-2 backdrop-blur-sm"
                            >
                                <Coffee size={18} />
                                Apply Leave
                            </button>
                        </div>

                        {/* Recent Session Glass Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl text-white">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-xl flex items-center justify-center shadow-inner shrink-0">
                                    <Clock size={32} strokeWidth={2.5} className="text-white" />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black text-indigo-200 tracking-[0.2em] mb-1 opacity-90 uppercase">Recent Session</span>
                                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                                        <div>
                                            <span className="text-xs text-indigo-100 font-semibold opacity-85">Check In: </span>
                                            <span className="text-sm font-bold font-mono">
                                                {formatDashboardTime(todayStatus?.time_in)}
                                            </span>
                                        </div>
                                        <div className="hidden md:block h-5 w-px bg-white/20"></div>
                                        <div>
                                            <span className="text-xs text-indigo-100 font-semibold opacity-85">Check Out: </span>
                                            <span className="text-sm font-bold font-mono">
                                                {formatDashboardTime(todayStatus?.time_out)}
                                            </span>
                                        </div>
                                        {todayStatus?.duration && (
                                            <>
                                                <div className="hidden md:block h-5 w-px bg-white/20"></div>
                                                <div>
                                                    <span className="text-xs text-indigo-100 font-semibold opacity-85">Duration: </span>
                                                    <span className="text-sm font-bold font-mono text-emerald-300">
                                                        {todayStatus.duration}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full md:w-auto flex flex-col md:items-end shrink-0">
                                <span className="block text-[10px] font-black text-indigo-200 tracking-[0.2em] mb-1 opacity-90 uppercase">Status</span>
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider ${
                                    todayStatus ? (todayStatus.time_out ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/20' : 'bg-emerald-500/30 text-emerald-250 border border-emerald-500/20 animate-pulse') : 'bg-white/10 text-white/60 border border-white/5'
                                }`}>
                                    {todayStatus ? (todayStatus.time_out ? 'Completed' : 'Active Session') : 'No Session Today'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Missed Time Out Banner */}
                {missedPunchWarning && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in shadow-sm">
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
                            onClick={() => navigate('/attendance?tab=my_attendance&subTab=correction')}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 active:scale-95"
                        >
                            Fix Now
                        </button>
                    </div>
                )}

                {/* Today's Status Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                        <Clock size={16} className="text-indigo-500" /> Today's Status
                    </h3>
                    <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                        <div className="flex flex-col gap-1 text-center sm:text-left">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Check In</span>
                            <span className={`text-2xl font-extrabold font-mono ${todayStatus?.time_in ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-350 dark:text-slate-600'}`}>
                                {formatDashboardTime(todayStatus?.time_in)}
                            </span>
                        </div>
                        <div className="hidden sm:block h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1 text-center sm:text-left">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Check Out</span>
                            <span className={`text-2xl font-extrabold font-mono ${todayStatus?.time_out ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-350 dark:text-slate-650'}`}>
                                {formatDashboardTime(todayStatus?.time_out)}
                            </span>
                        </div>
                        <div className="hidden sm:block h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1 text-center sm:text-left">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Duration</span>
                            <span className={`text-2xl font-extrabold font-mono ${todayStatus?.duration ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-350 dark:text-slate-650'}`}>
                                {todayStatus?.duration || '0h'}
                            </span>
                        </div>
                    </div>
                </div>

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
                    {/* Left Column: Recent Activity & Location */}
                    <div className="space-y-6">
                        {/* Recent Activity */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col">
                            <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 mb-5">
                                <Activity size={18} className="text-emerald-500" /> Recent Activity
                            </h3>
                            <div className="space-y-4 max-h-[320px] overflow-y-auto no-scrollbar pr-1">
                                {recentActivity.length > 0 ? (
                                    recentActivity.slice(0, 5).map((activity, index) => (
                                        <div key={index} className="flex items-center gap-3.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors border border-slate-100/50 dark:border-transparent">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                                activity.action.toLowerCase().includes('in') 
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                                                    : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                                            }`}>
                                                <Clock size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-github-dark-text truncate">{activity.action}</p>
                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">{activity.time || activity.date}</p>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                activity.status === 'LATE' 
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' 
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                            }`}>
                                                {activity.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-600 font-medium italic">No recent activity recorded</div>
                                )}
                            </div>
                        </div>

                        {/* Your Work Location */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6">
                            <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text mb-4 flex items-center gap-2">
                                <MapPin size={18} className="text-indigo-500" />
                                Your Work Location
                            </h3>
                            <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200/50 dark:border-github-dark-border">
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                    You are currently assigned to standard work locations. Please ensure you are within your geofenced area boundaries when timing in or out.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Upcoming Holidays & Policies */}
                    <div className="space-y-6">
                        {/* Upcoming Holidays */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-github-dark-border">
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

                            <div className="space-y-3">
                                {upcomingHolidays.length > 0 ? (
                                    upcomingHolidays.slice(0, 3).map((holiday, index) => (
                                        <div key={index} className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200/50 dark:border-github-dark-border">
                                            <div className="flex flex-col items-center justify-center w-11 h-11 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-center border border-slate-200 dark:border-github-dark-border shrink-0">
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tighter">{new Date(holiday.date).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-base font-black text-slate-800 dark:text-github-dark-text mt-0.5 leading-none">{new Date(holiday.date).getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-github-dark-text truncate">{holiday.name}</h4>
                                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5">{new Date(holiday.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-600 italic">No upcoming holidays</div>
                                )}
                            </div>
                        </div>

                        {/* Policies & Reminders */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border p-6">
                            <h3 className="text-base font-bold text-slate-800 dark:text-github-dark-text mb-4 flex items-center gap-2">
                                <AlertCircle size={18} className="text-indigo-500" />
                                Policies & Reminders
                            </h3>
                            <ul className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                <li className="flex items-start gap-2.5">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                    Mark your check-in before 09:30 AM to avoid being flagged as LATE.
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                    Submit your attendance correction request within 7 days of any missed timed out session.
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                    Always apply for planned leaves at least 2 days in advance.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default EmployeeDashboard;
