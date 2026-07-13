import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import employeeService from '../../services/employeeService';
import { parsePolicy } from '../../utils/weekOffPolicy';
import {
    Clock,
    Calendar,
    Briefcase,
    AlertCircle,
    CheckCircle,
    XCircle,
    TrendingUp,
    ChevronRight,
    Coffee,
    Activity,
    MapPin,
    RefreshCw
} from 'lucide-react';
import { attendanceService, attendanceCacheData } from '../../services/attendanceService';
import { toast } from 'react-toastify';

const EmployeeDashboard = () => {
    const { user, avatarTimestamp } = useAuth();
    const navigate = useNavigate();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

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
                    console.warn(`watchPosition failed in dashboard:`, err);
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

        return () => {
            clearInterval(timer);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

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
    const [loading, setLoading] = useState(() => {
        return !attendanceCacheData.myStats[monthKey] || !attendanceCacheData.todayStatus[todayStr];
    });
    const [missedPunchWarning, setMissedPunchWarning] = useState(null);
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
        } finally {
            setLoading(false);
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
        <MobileDashboardLayout title="Employee Dashboard" hideHeader={false}>
            <div className="space-y-6">
                {/* 1. Welcome Section */}
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-indigo-900/40 dark:via-indigo-950/40 dark:to-black rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    {/* Animated Background Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.5, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-24 -left-24 w-80 h-80 bg-sky-500/10 blur-3xl rounded-full pointer-events-none"
                    />

                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center text-2xl font-bold overflow-hidden shadow-inner shrink-0">
                            {user?.profile_image_url ? (
                                <img
                                    src={`${user.profile_image_url}?t=${avatarTimestamp}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                user?.name?.charAt(0) || 'U'
                            )}
                        </div>
                        <div>
                            <p className="text-indigo-100 text-sm font-medium opacity-90">{getGreeting()},</p>
                            <h2 className="text-2xl font-bold tracking-tight">{user?.name?.split(' ')[0]}</h2>
                            <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1">
                                <Briefcase size={12} />
                                {user?.designation || 'Employee'}
                            </p>
                        </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="mt-6 flex gap-3 relative z-10">
                        <button
                            onClick={() => navigate('/attendance')}
                            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/10 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Clock size={16} /> My Attendance
                        </button>
                        <button
                            onClick={() => navigate('/holidays?tab=leaves&apply=true')}
                            className="flex-1 py-3 border border-indigo-300/35 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
                        >
                            <Coffee size={16} /> Apply Leave
                        </button>
                    </div>

                    {/* Current Time / Location Widget */}
                    <div className="mt-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between text-white relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center text-white shadow-inner">
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
                                <span className="truncate max-w-[100px] inline-block align-middle" title={location.address}>
                                    {isLoadingLoc ? 'Locating...' : location.address}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Missed Time Out Banner */}
                {missedPunchWarning && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex flex-col gap-3 justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl relative mt-0.5 shrink-0">
                                <AlertCircle size={20} />
                                {missedPunchWarning.dates.length > 1 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                        {missedPunchWarning.dates.length}
                                    </span>
                                )}
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
                            className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md text-center cursor-pointer"
                        >
                            Fix Now
                        </button>
                    </div>
                )}

                {/* Shift Details Card */}
                {shift ? (
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border animate-fade-in">
                        <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Calendar size={14} className="text-amber-500" /> Shift Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Shift Name</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text mt-1 block">{shift.name}</span>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Start Time</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text font-mono mt-1 block">{formatTime12h(shift.start_time || shift.rules?.shift_timing?.start_time)}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">End Time</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text font-mono mt-1 block">{formatTime12h(shift.end_time || shift.rules?.shift_timing?.end_time)}</span>
                                </div>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mb-2">Working Days</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {weekdays.map(day => {
                                        const active = activeWorkingDays.includes(day);
                                        return (
                                            <span
                                                key={day}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                                                    active 
                                                        ? 'bg-indigo-600 text-white dark:bg-indigo-650/40 dark:text-indigo-200' 
                                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500'
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
                ) : (
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border animate-fade-in">
                        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-500" /> Shift Details
                        </h3>
                        <div className="flex flex-col items-center justify-center text-center py-6">
                            <div className="relative w-14 h-14 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 bg-slate-50/50 dark:bg-slate-800/20">
                                <Calendar className="text-slate-400 dark:text-slate-500" size={20} />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                                    <Clock className="text-slate-400 dark:text-slate-500" size={10} />
                                </div>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-github-dark-text mb-1">No Shift Assigned</h4>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed max-w-[220px]">
                                Your shift details will appear here once your administrator assigns a shift.
                            </p>
                        </div>
                    </div>
                )}

                {/* 2. Today's Status Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock size={14} /> Today's Status
                    </h3>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Check In</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.time_in ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-300 dark:text-slate-600'}`}>
                                {formatDashboardTime(todayStatus?.time_in)}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Check Out</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.time_out ? 'text-slate-800 dark:text-github-dark-text' : 'text-slate-300 dark:text-slate-600'}`}>
                                {formatDashboardTime(todayStatus?.time_out)}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-400 font-medium uppercase">Duration</span>
                            <span className={`text-xl font-bold font-mono ${todayStatus?.duration ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                {todayStatus?.duration || '0h'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Monthly Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                            <CheckCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.daysPresent}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Present Days</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                            <AlertCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.lateDays}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Late Check-ins</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-2">
                            <XCircle size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.daysAbsent}</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Absents</span>
                    </div>

                    <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-github-dark-border flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-github-dark-text">{stats.avgHours}h</span>
                        <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Avg Hours</span>
                    </div>
                </div>

                {/* 4. Recent Activity */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 mb-4">
                        <Activity size={16} className="text-emerald-500" /> Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 5).map((activity, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        activity.action.toLowerCase().includes('in') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        <Clock size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate">{activity.action}</p>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{activity.time || activity.date}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-sm text-slate-400 italic">No recent activity</div>
                        )}
                    </div>
                </div>

                {/* 5. Upcoming Holidays */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-github-dark-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-500" /> Upcoming Holidays
                        </h3>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline" onClick={() => navigate('/holidays')}>View All</span>
                    </div>

                    <div className="space-y-3">
                        {upcomingHolidays.length > 0 ? (
                            upcomingHolidays.slice(0, 3).map((holiday, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-100 dark:border-github-dark-border">
                                    <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-center border border-slate-200 dark:border-github-dark-border">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{attendanceService.safeParseDate(holiday.date).toLocaleString('default', { month: 'short' })}</span>
                                        <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text">{attendanceService.safeParseDate(holiday.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">{holiday.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{attendanceService.safeParseDate(holiday.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-sm text-slate-400 italic">No upcoming holidays</div>
                        )}
                    </div>
                </div>

            </div>
        </MobileDashboardLayout>
    );
};

export default EmployeeDashboard;
