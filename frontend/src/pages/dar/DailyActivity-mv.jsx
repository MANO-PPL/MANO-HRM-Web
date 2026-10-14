import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, 
    Plus, 
    ChevronDown, 
    CheckSquare, 
    Video, 
    Shield, 
    Clock, 
    MoreVertical, 
    AlertCircle, 
    CheckCircle2,
    Briefcase,
    User,
    Users,
    MapPin,
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    RefreshCw,
    Settings,
    X
} from 'lucide-react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import MiniCalendar from '../../components/dar/MiniCalendar';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';
import DARAdminMobile from './DARAdmin-mv';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import TaskCreationPanel from '../../components/dar/TaskCreationPanel';
import EventMeetingModal from '../../components/dar/EventMeetingModal';
import { formatPlatformDate } from '../../utils/dateUtils';
import { formatTaskDuration } from '../../utils/darAdminMetrics';
import { usePageRefresh } from '../../context/PageRefreshContext';

const getTodayLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLocalDateString = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DailyActivityMobile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdminOrHr = ['admin', 'hr', 'super_admin'].includes(user?.user_type) || Boolean(user?.isAdmin);

    // Main Tab State: 'my_dar' | 'employees_dar' (matching Flutter DailyActivityScreen)
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t === 'admin' || t === 'employees_dar') return 'employees_dar';
        return 'my_dar';
    });

    const [selectedDate, setSelectedDate] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('date');
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        return getTodayLocalDateString();
    });
    const [rangeEndDate, setRangeEndDate] = useState(null);
    const [datePreset, setDatePreset] = useState('day'); // 'day' | 'week' | 'month' | 'custom'

    const handleModePreset = (preset) => {
        setDatePreset(preset);
        const today = new Date();
        const endStr = getTodayLocalDateString();
        if (preset === 'day') {
            setSelectedDate(endStr);
            setRangeEndDate(null);
        } else if (preset === 'week') {
            const d = new Date(today);
            d.setDate(d.getDate() - 6);
            setSelectedDate(getLocalDateString(d));
            setRangeEndDate(endStr);
        } else if (preset === 'month') {
            const d = new Date(today);
            d.setDate(d.getDate() - 29);
            setSelectedDate(getLocalDateString(d));
            setRangeEndDate(endStr);
        }
    };

    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const calendarButtonRef = useRef(null);
    const dateStripRef = useRef(null);

    const [tasks, setTasks] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [holidays, setHolidays] = useState({});
    const [loading, setLoading] = useState(true);
    const [sidebarMode, setSidebarMode] = useState('default'); // 'default' | 'create-task'
    const [showActions, setShowActions] = useState(false);
    const [eventModal, setEventModal] = useState({ isOpen: false, type: 'Meeting' });
    const [lastCreateRequest, setLastCreateRequest] = useState({ type: 'TASK', timestamp: 0 });
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // Sync tab switcher URL state
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        const url = new URL(window.location.href);
        if (tabId === 'employees_dar') {
            url.searchParams.set('tab', 'employees_dar');
        } else {
            url.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', url.toString());
    };

    // Generate 15-day scrollable date strip or range days (matching Flutter _syncDateStrip)
    const dateStrip = useMemo(() => {
        if (!rangeEndDate) {
            const list = [];
            const base = new Date(selectedDate);
            for (let i = -7; i <= 7; i++) {
                const d = new Date(base);
                d.setDate(base.getDate() + i);
                list.push(getLocalDateString(d));
            }
            return list;
        }
        const list = [];
        const start = new Date(selectedDate);
        const end = new Date(rangeEndDate);
        const cur = new Date(start);
        while (cur <= end) {
            list.push(getLocalDateString(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return list;
    }, [selectedDate, rangeEndDate]);

    // Center active date on strip when selectedDate changes
    useEffect(() => {
        if (dateStripRef.current) {
            const activeEl = dateStripRef.current.querySelector('[data-active="true"]');
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [selectedDate]);

    // Fetch data whenever selectedDate or rangeEndDate changes
    useEffect(() => {
        fetchDayData();
    }, [selectedDate, rangeEndDate]);

    const fetchDayData = async () => {
        setLoading(true);
        try {
            const effectiveStart = selectedDate;
            const effectiveEnd = rangeEndDate || selectedDate;
            const fromDate = dateStrip[0] || effectiveStart;
            const toDate = dateStrip[dateStrip.length - 1] || effectiveEnd;

            const [eventsRes, activitiesRes, attendanceRes, holidayRes] = await Promise.allSettled([
                api.get('/dar/events/list', { params: { date_from: effectiveStart, date_to: effectiveEnd } }),
                api.get('/dar/activities/list', { params: { date_from: effectiveStart, date_to: effectiveEnd } }),
                api.get('/attendance/records', { params: { date_from: fromDate, date_to: toDate } }),
                api.get('/holiday')
            ]);

            // Process Holidays
            const rawHols = (holidayRes.status === 'fulfilled' && holidayRes.value?.data?.holidays) || [];
            const holMap = {};
            rawHols.forEach(h => { holMap[h.holiday_date] = h.holiday_name; });
            setHolidays(holMap);

            // Process Tasks & Events
            const transformedData = [];
            const events = (eventsRes.status === 'fulfilled' && eventsRes.value?.data?.data) || [];
            const activities = (activitiesRes.status === 'fulfilled' && activitiesRes.value?.data?.data) || [];
            const attendanceRecs = (attendanceRes.status === 'fulfilled' && attendanceRes.value?.data?.data) || [];
            
            // Events
            events.forEach(e => {
                const sTime = e.start_time ? e.start_time.slice(0, 5) : '';
                const eTime = e.end_time ? e.end_time.slice(0, 5) : '';
                const durH = parseFloat(e.duration_hours || e.hours || 0);
                transformedData.push({
                    id: `evt-${e.event_id}`,
                    title: e.title,
                    description: e.description,
                    startTime: sTime,
                    endTime: eTime,
                    durationHours: durH,
                    date: e.event_date,
                    type: e.type.toLowerCase(),
                    location: e.location
                });
            });

            // Activities
            activities.forEach(a => {
                const sTime = a.start_time ? a.start_time.slice(0, 5) : '';
                const eTime = a.end_time ? a.end_time.slice(0, 5) : '';
                const durH = parseFloat(a.duration_hours || a.hours || 0);
                transformedData.push({
                    id: `act-${a.activity_id}`,
                    title: a.title,
                    description: a.description,
                    startTime: sTime,
                    endTime: eTime,
                    durationHours: durH,
                    date: a.activity_date,
                    type: 'task',
                    status: a.status
                });
            });

            // Sort chronologically
            transformedData.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setTasks(transformedData);

            // Process Attendance
            const attMap = {};
            attendanceRecs.forEach(a => {
                const dateKey = getLocalDateString(a.time_in);
                const timeIn = new Date(a.time_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const timeOut = a.time_out ? new Date(a.time_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null;

                if (!attMap[dateKey]) {
                    attMap[dateKey] = {
                        timeIn,
                        timeOut,
                        status: a.status || 'Present',
                        hasTimedIn: true,
                        intervals: []
                    };
                }
                attMap[dateKey].intervals.push({ start: timeIn, end: timeOut });
                if (timeOut && (!attMap[dateKey].timeOut || timeOut > attMap[dateKey].timeOut)) {
                    attMap[dateKey].timeOut = timeOut;
                }
            });
            setAttendanceData(attMap);

        } catch (error) {
            console.error("Failed to load mobile DAR data", error);
        } finally {
            setLoading(false);
        }
    };

    usePageRefresh(fetchDayData);

    const handleCreate = (type) => {
        const createType = (type === 'Task' ? 'TASK' : type.toUpperCase());
        setLastCreateRequest({ type: createType, timestamp: Date.now() });
        setSidebarMode('create-task');
        setShowActions(false);
    };

    const handleEditTask = (t) => {
        if (t.type === 'task') {
            setSidebarMode('create-task');
            const rawId = t.id.startsWith('act-') ? t.id.split('-')[1] : null;
            if (rawId) setSelectedTaskId(Number(rawId));
        } else {
            const type = t.type === 'meeting' ? 'Meeting' : 'Event';
            setEventModal({ isOpen: true, type, initialData: t });
        }
    };

    const isToday = selectedDate === getTodayLocalDateString();
    const holidayName = holidays[selectedDate];
    const todayStr = getTodayLocalDateString();
    const isPastDate = selectedDate < todayStr;
    const hasTimedInToday = Boolean(attendanceData[selectedDate]?.hasTimedIn);
    const isAbsent = isPastDate && !holidayName && !hasTimedInToday;

    return (
        <MobileDashboardLayout 
            title="Daily Activity"
            headerAction={
                isAdminOrHr ? (
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer active:scale-95"
                        title="Configurations"
                    >
                        <Settings size={18} />
                    </button>
                ) : null
            }
        >
            <div className="flex flex-col gap-3">
                {/* --- TOP PILL TAB BAR FOR ADMIN / HR (Replicates Flutter DailyActivityScreen) --- */}
                {isAdminOrHr && (
                    <div className="bg-slate-100 dark:bg-[#161B22] p-1 flex rounded-xl border border-slate-200/80 dark:border-[#30363D] shadow-xs w-full">
                        <button
                            onClick={() => handleTabChange('my_dar')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'my_dar'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-xs border border-slate-200/60 dark:border-[#30363D]'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <User size={15} className={activeTab === 'my_dar' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>My DAR</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('employees_dar')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'employees_dar'
                                    ? 'bg-white dark:bg-[#2D3139] text-indigo-600 dark:text-white shadow-xs border border-slate-200/60 dark:border-[#30363D]'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <Users size={15} className={activeTab === 'employees_dar' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'} />
                            <span>Employees' DAR</span>
                        </button>
                    </div>
                )}

                {/* --- TAB CONTENT: EMPLOYEES' DAR (Admin Overview) --- */}
                {isAdminOrHr && activeTab === 'employees_dar' ? (
                    <DARAdminMobile embedded={true} onOpenConfig={() => setIsConfigOpen(true)} />
                ) : (
                    /* --- TAB CONTENT: MY DAR (Personal Daily Activity) --- */
                    <div className="flex flex-col gap-4">
                        
                        {/* 1. Header Strip with Month/Year & Range Presets */}
                        <div className="bg-white dark:bg-github-dark-subtle rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                                <div 
                                    ref={calendarButtonRef}
                                    onClick={() => setShowFullCalendar(!showFullCalendar)}
                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity active:scale-98"
                                >
                                    <span className="text-sm font-bold text-slate-800 dark:text-white uppercase">
                                        {rangeEndDate
                                            ? `${new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} — ${new Date(rangeEndDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                            : new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                        }
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showFullCalendar ? 'rotate-180' : ''}`} />
                                </div>

                                <button 
                                    onClick={() => handleModePreset('day')}
                                    className={`px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-widest transition-all cursor-pointer ${
                                        isToday && !rangeEndDate 
                                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' 
                                            : 'bg-slate-100 text-slate-500 dark:bg-white/5 hover:bg-slate-200'
                                    }`}
                                >
                                    Today
                                </button>
                            </div>

                            {/* Row 1: Mode Presets: Day | Week | Month + Calendar Action */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="inline-flex rounded-lg border border-slate-200/90 dark:border-github-dark-border overflow-hidden bg-white dark:bg-github-dark-subtle shrink-0 shadow-2xs">
                                    {[
                                        { key: 'day', label: 'Day' },
                                        { key: 'week', label: 'Week' },
                                        { key: 'month', label: 'Month' },
                                    ].map((p) => {
                                        const isActive = (p.key === 'day' && !rangeEndDate) ||
                                            (p.key === 'week' && rangeEndDate && datePreset === 'week') ||
                                            (p.key === 'month' && rangeEndDate && datePreset === 'month');
                                        return (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => handleModePreset(p.key)}
                                                className={`px-3 py-1.5 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200/90 dark:border-github-dark-border cursor-pointer ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowFullCalendar(!showFullCalendar)}
                                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                                        showFullCalendar || rangeEndDate
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200/80 dark:border-github-dark-border text-slate-500'
                                    }`}
                                    title="Custom Calendar Range"
                                >
                                    <Calendar size={15} />
                                </button>
                            </div>

                            {/* Row 2: Direct Native Date Range Inputs (Web Admin Panel Style) */}
                            <div className="flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200/80 dark:border-github-dark-border rounded-lg px-2.5 py-1.5 shadow-2xs">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <Calendar size={13} className="text-indigo-500 shrink-0" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                if (!rangeEndDate) {
                                                    setSelectedDate(val);
                                                } else {
                                                    setDatePreset('custom');
                                                    setSelectedDate(val);
                                                    if (rangeEndDate < val) setRangeEndDate(val);
                                                }
                                            }
                                        }}
                                        className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full min-w-0 cursor-pointer"
                                    />
                                </div>

                                <span className="text-slate-400 text-[10px] font-bold uppercase shrink-0 px-1">to</span>

                                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                    <input
                                        type="date"
                                        value={rangeEndDate || selectedDate}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                setDatePreset('custom');
                                                setRangeEndDate(val);
                                                if (val < selectedDate) setSelectedDate(val);
                                            }
                                        }}
                                        className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full min-w-0 text-right cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Active Range Pill Banner */}
                            {rangeEndDate && (
                                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                    <div className="flex items-center gap-2 min-w-0 truncate">
                                        <Calendar size={14} className="shrink-0" />
                                        <span className="truncate">
                                            {formatPlatformDate(selectedDate)} — {formatPlatformDate(rangeEndDate)}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setRangeEndDate(null);
                                            setDatePreset('day');
                                        }} 
                                        className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full shrink-0 cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* 2. Horizontal Swipable Date-Strip (replicates Flutter _dateStrip ListView) */}
                            <div 
                                ref={dateStripRef}
                                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
                            >
                                {dateStrip.map((dateStr) => {
                                    const d = new Date(dateStr);
                                    const active = dateStr === selectedDate;
                                    const isCurrentDay = dateStr === todayStr;

                                    const dayHols = holidays[dateStr];
                                    const dayAtt = attendanceData[dateStr];
                                    const isDayHoliday = Boolean(dayHols);
                                    const isDayPast = dateStr < todayStr;
                                    const isDayAbsent = isDayPast && !isDayHoliday && !dayAtt?.hasTimedIn;

                                    let dotColor = 'transparent';
                                    if (isDayHoliday) dotColor = 'bg-emerald-500';
                                    else if (isDayAbsent) dotColor = 'bg-rose-500';
                                    else if (dayAtt?.hasTimedIn) dotColor = 'bg-indigo-500';

                                    return (
                                        <button
                                            key={dateStr}
                                            data-active={active}
                                            onClick={() => {
                                                setSelectedDate(dateStr);
                                                setRangeEndDate(null);
                                            }}
                                            className={`shrink-0 w-11 flex flex-col items-center py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                                                active 
                                                    ? 'bg-[#6366F1] text-white shadow-md scale-105 z-10' 
                                                    : isCurrentDay
                                                    ? 'border border-indigo-400/50 bg-indigo-50/20 text-slate-700 dark:text-slate-200'
                                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <span className={`text-[8.5px] font-bold uppercase tracking-tight ${active ? 'opacity-80' : ''}`}>
                                                {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                                            </span>
                                            <span className="text-xs font-bold mt-0.5">
                                                {d.getDate()}
                                            </span>
                                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotColor}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Calendar Dropdown Modal Portal */}
                        {showFullCalendar && createPortal(
                            <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4">
                                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowFullCalendar(false)} />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl"
                                >
                                    <MiniCalendar
                                        selectedDate={selectedDate}
                                        endDate={rangeEndDate}
                                        disableRange={false}
                                        onDateSelect={(range) => {
                                            setSelectedDate(range.start);
                                            if (range.end && range.end !== range.start) {
                                                setRangeEndDate(range.end);
                                                setDatePreset('custom');
                                            } else {
                                                setRangeEndDate(null);
                                                setDatePreset('day');
                                            }
                                            setShowFullCalendar(false);
                                        }}
                                    />
                                </motion.div>
                            </div>,
                            document.body
                        )}

                        {/* 3. Focused Day Snapshot Card (Replicates Flutter DailyActivityDaySnapshotCard) */}
                        <div className="bg-white dark:bg-github-dark-subtle rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-xs space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                        {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Focused day snapshot</p>
                                </div>
                                {holidayName ? (
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {holidayName}
                                    </span>
                                ) : isAbsent ? (
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                        ABSENT
                                    </span>
                                ) : attendanceData[selectedDate]?.hasTimedIn ? (
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                        PRESENT
                                    </span>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="bg-emerald-500/10 dark:bg-emerald-500/10 rounded-xl p-3 flex flex-col justify-center">
                                    <span className="text-[8.5px] font-bold uppercase text-slate-400 tracking-wider">TIME IN</span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                        {attendanceData[selectedDate]?.timeIn || '--:--'}
                                    </span>
                                </div>
                                <div className="bg-amber-500/10 dark:bg-amber-500/10 rounded-xl p-3 flex flex-col justify-center">
                                    <span className="text-[8.5px] font-bold uppercase text-slate-400 tracking-wider">TIME OUT</span>
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                                        {attendanceData[selectedDate]?.timeOut || '--:--'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Agenda / Activities List */}
                        <div className="space-y-3 pb-20">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-[0.2em]">Agenda</h3>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                    {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>

                            <div className="relative pl-4 space-y-3">
                                {/* Timeline vertical line */}
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-white/5 rounded-full" />

                                {loading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                                        <div className="w-8 h-8 border-3 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 rounded-full animate-spin" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading activities...</p>
                                    </div>
                                ) : tasks.length > 0 ? (
                                    <AnimatePresence mode="popLayout">
                                        {tasks.map((task, idx) => {
                                            const isMeeting = task.type === 'meeting';
                                            
                                            let typeIcon = <CheckSquare size={14} />;
                                            let typeColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
                                            let borderColor = 'border-emerald-100 dark:border-emerald-500/10';
                                            
                                            if (isMeeting) {
                                                typeIcon = <Video size={14} />;
                                                typeColor = 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400';
                                                borderColor = 'border-purple-100 dark:border-purple-500/10';
                                            } else if (task.type === 'event') {
                                                typeIcon = <Users size={14} />;
                                                typeColor = 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
                                                borderColor = 'border-blue-100 dark:border-blue-500/10';
                                            }

                                            return (
                                                <motion.div
                                                    key={task.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    onClick={() => handleEditTask(task)}
                                                    className="relative flex items-start gap-3 active:scale-[0.98] transition-all cursor-pointer"
                                                >
                                                    {/* Timeline dot */}
                                                    <div className="absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-github-dark-bg z-10 bg-indigo-500" />

                                                    <div className={`flex-1 bg-white dark:bg-github-dark-subtle p-3.5 rounded-2xl border ${borderColor} shadow-xs space-y-2.5`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${typeColor}`}>
                                                                    {typeIcon}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase leading-tight truncate">
                                                                        {task.title}
                                                                    </h4>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <Clock size={10} className="text-slate-400 shrink-0" />
                                                                        <span className="text-[9px] font-semibold text-slate-400 uppercase">{task.startTime} - {task.endTime}</span>
                                                                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/40 dark:border-indigo-800/40 shrink-0">
                                                                            {formatTaskDuration(task.durationHours, task.startTime, task.endTime)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {task.status === 'PLANNED' ? (
                                                                <span className="text-[8px] font-bold uppercase px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-lg border border-slate-200 dark:border-white/5 shrink-0">PLANNED</span>
                                                            ) : (
                                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                            )}
                                                        </div>

                                                        {task.description && (
                                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 pl-0.5">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                        
                                                        {(task.location || isMeeting) && (
                                                            <div className="flex items-center gap-1.5 pl-0.5">
                                                                <MapPin size={10} className="text-slate-400 shrink-0" />
                                                                <span className="text-[10px] font-semibold text-slate-400 truncate uppercase tracking-tight">
                                                                    {task.location || 'Remote Session'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                ) : (
                                    <div className="bg-white dark:bg-github-dark-subtle rounded-2xl border border-dashed border-slate-200 dark:border-white/5 p-10 flex flex-col items-center justify-center gap-3 text-center">
                                        <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-white/10">
                                            <RefreshCw size={26} />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold text-slate-800 dark:text-white uppercase">Quiet Day Ahead</h5>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">No activities scheduled yet</p>
                                        </div>
                                        <button 
                                            onClick={() => handleCreate('Task')}
                                            className="px-5 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                                        >
                                            Add Your First Task
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Floating Action Button (FAB) */}
                        <div className="fixed right-6 z-40" style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
                            <div className="relative">
                                <AnimatePresence>
                                    {showActions && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                            className="absolute bottom-20 right-0 w-52 bg-white dark:bg-github-dark-subtle rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 p-1.5 overflow-hidden flex flex-col gap-1"
                                        >
                                            <button 
                                                onClick={() => handleCreate('Task')}
                                                className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <CheckSquare size={16} strokeWidth={2.5} />
                                                </div>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-white whitespace-nowrap">Log Task</span>
                                            </button>
                                            <button 
                                                onClick={() => handleCreate('Meeting')}
                                                className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                    <Video size={16} strokeWidth={2.5} />
                                                </div>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-white whitespace-nowrap">Schedule Meeting</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                
                                <button
                                    onClick={() => setShowActions(!showActions)}
                                    className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
                                        showActions ? 'bg-slate-900 rotate-45' : 'bg-indigo-600 shadow-indigo-500/40'
                                    } text-white`}
                                >
                                    <Plus size={28} strokeWidth={3} />
                                </button>
                            </div>
                        </div>

                        {/* Modals & Full Screen Panels */}
                        <AnimatePresence>
                            {sidebarMode === 'create-task' && (
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="fixed inset-0 z-50 bg-white dark:bg-github-dark-bg overflow-hidden"
                                >
                                    <TaskCreationPanel
                                        onClose={() => {
                                            setSidebarMode('default');
                                            setSelectedTaskId(null);
                                            fetchDayData();
                                        }}
                                        onUpdate={() => {}}
                                        initialTimeIn={attendanceData[selectedDate]?.timeIn || "09:00"}
                                        attendanceIntervals={attendanceData[selectedDate]?.intervals || []}
                                        highlightTaskId={selectedTaskId}
                                        initialDate={selectedDate}
                                        lastCreateRequest={lastCreateRequest}
                                        onDateChange={(d) => setSelectedDate(d)}
                                        isAbsent={isAbsent}
                                    />
                                </motion.div>
                            )}

                            {eventModal.isOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="w-full max-w-sm"
                                    >
                                        <EventMeetingModal
                                            type={eventModal.type}
                                            initialDate={selectedDate}
                                            initialData={eventModal.initialData}
                                            onClose={() => setEventModal({ ...eventModal, isOpen: false, initialData: null })}
                                            onSave={() => {
                                                fetchDayData();
                                                toast.success(`${eventModal.type} updated successfully!`);
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Configuration Drawer */}
            <AnimatePresence>
                {isConfigOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsConfigOpen(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-[85vw] max-w-[340px] h-full bg-white dark:bg-github-dark-subtle shadow-2xl flex flex-col border-l border-slate-200 dark:border-github-dark-border"
                        >
                            <AdminConfigurations onClose={() => setIsConfigOpen(false)} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </MobileDashboardLayout>
    );
};

export default DailyActivityMobile;
