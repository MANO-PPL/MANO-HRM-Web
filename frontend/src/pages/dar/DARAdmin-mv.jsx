import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, Calendar, Building, Clock, Users, ChevronRight, X, 
    CheckSquare, Video, ArrowRight, RefreshCw, AlertCircle, Settings
} from 'lucide-react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';
import MiniCalendar from '../../components/dar/MiniCalendar';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { formatPlatformDate } from '../../utils/dateUtils';
import { formatTaskDuration } from '../../utils/darAdminMetrics';

const getLocalDateYMD = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateLabel = (ymdStr) => {
    if (!ymdStr) return '';
    return formatPlatformDate(ymdStr);
};

const DARAdminMobile = ({ embedded = false, onOpenConfig }) => {
    // Helper to calculate date presets matching web admin panel (DARAdmin.jsx)
    const getPresetDates = (preset, anchor = new Date()) => {
        const end = getLocalDateYMD(anchor);
        if (preset === 'today' || preset === 'day') {
            return { start: end, end };
        }
        if (preset === 'yesterday') {
            const y = new Date(anchor);
            y.setDate(y.getDate() - 1);
            const yStr = getLocalDateYMD(y);
            return { start: yStr, end: yStr };
        }
        if (preset === '30d' || preset === 'month') {
            const d = new Date(anchor);
            d.setDate(d.getDate() - 29);
            return { start: getLocalDateYMD(d), end };
        }
        // Default: 7 days
        const d = new Date(anchor);
        d.setDate(d.getDate() - 6);
        return { start: getLocalDateYMD(d), end };
    };

    const [datePreset, setDatePreset] = useState('day'); // 'day' | 'week' | 'month' | 'custom'
    const [dateRange, setDateRange] = useState(() => getPresetDates('day'));
    const [showCalendar, setShowCalendar] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState(null);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // Data State
    const [employees, setEmployees] = useState([]);
    const [activities, setActivities] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Detailed employee timeline sheet
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Compute effective date range
    const effectiveStart = dateRange.start;
    const effectiveEnd = dateRange.end;

    // Handle preset changes like web admin panel
    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        const newRange = getPresetDates(preset);
        setDateRange(newRange);
    };

    // Fetch data whenever date range changes
    useEffect(() => {
        fetchAllData();
    }, [effectiveStart, effectiveEnd]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [usersRes, actsRes, evtsRes] = await Promise.allSettled([
                api.get('/admin/users', { params: { active_only: true } }),
                api.get('/dar/activities/admin/all', { params: { startDate: effectiveStart, endDate: effectiveEnd } }),
                api.get('/dar/events/admin/all', { params: { date_from: effectiveStart, date_to: effectiveEnd } })
            ]);

            if (usersRes.status === 'fulfilled' && usersRes.value?.data?.users) {
                const rawUsers = usersRes.value.data.users.filter(u => {
                    const isTrash = u.is_deleted === 1 || u.is_deleted === true || Boolean(u.deleted_at);
                    const isInactive = u.is_active === 0 || u.is_active === false;
                    return !isTrash && !isInactive;
                });
                setEmployees(rawUsers);
            }

            if (actsRes.status === 'fulfilled') {
                const acts = actsRes.value?.data?.data || actsRes.value?.data || [];
                setActivities(Array.isArray(acts) ? acts : []);
            }

            if (evtsRes.status === 'fulfilled') {
                const evts = evtsRes.value?.data?.data || evtsRes.value?.data || [];
                setEvents(Array.isArray(evts) ? evts : []);
            }
        } catch (err) {
            console.error('Failed to load DAR admin data:', err);
            toast.error('Failed to load activities');
        } finally {
            setLoading(false);
        }
    };

    // Extract unique departments
    const departments = useMemo(() => {
        const set = new Set();
        employees.forEach(e => {
            const d = e.dept_name || e.department;
            if (d) set.add(d);
        });
        return Array.from(set).sort();
    }, [employees]);

    // Aggregate stats per employee
    const employeeStatsMap = useMemo(() => {
        const map = {};
        employees.forEach(emp => {
            const uid = emp.user_id || emp.id;
            map[uid] = { tasks: 0, meetings: 0, hours: 0, items: [] };
        });

        activities.forEach(act => {
            const uid = act.user_id;
            if (map[uid]) {
                map[uid].tasks += 1;
                const rawDur = parseFloat(act.duration_hours || act.hours || 0);
                const dur = Math.round(rawDur * 10) / 10;
                map[uid].hours = Math.round((map[uid].hours + dur) * 10) / 10;
                map[uid].items.push({
                    type: 'task',
                    id: act.id,
                    title: act.activity_name || act.task_name || 'Task',
                    category: act.category || 'General',
                    duration: dur,
                    startTime: act.start_time ? String(act.start_time).slice(0, 5) : '',
                    endTime: act.end_time ? String(act.end_time).slice(0, 5) : '',
                    description: act.description || '',
                    date: act.activity_date || act.date || effectiveStart
                });
            }
        });

        events.forEach(evt => {
            const uid = evt.user_id || evt.created_by;
            if (map[uid]) {
                map[uid].meetings += 1;
                const rawDur = parseFloat(evt.duration_hours || evt.hours || 1);
                const dur = Math.round(rawDur * 10) / 10;
                map[uid].hours = Math.round((map[uid].hours + dur) * 10) / 10;
                map[uid].items.push({
                    type: 'meeting',
                    id: evt.id,
                    title: evt.title || evt.event_name || 'Meeting',
                    category: 'Meeting',
                    duration: dur,
                    startTime: evt.start_time ? String(evt.start_time).slice(0, 5) : '',
                    endTime: evt.end_time ? String(evt.end_time).slice(0, 5) : '',
                    description: evt.description || '',
                    date: evt.event_date || evt.date || effectiveStart
                });
            }
        });

        return map;
    }, [employees, activities, events, effectiveStart]);

    // Filter employees by search & department
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const name = (emp.user_name || emp.name || '').toLowerCase();
            const dept = (emp.dept_name || emp.department || '');
            const role = (emp.user_type || emp.role || '').toLowerCase();

            if (selectedDept && dept !== selectedDept) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return name.includes(q) || dept.toLowerCase().includes(q) || role.includes(q);
            }
            return true;
        });
    }, [employees, selectedDept, searchQuery]);

    const content = (
        <>
            <div className="space-y-3 pb-12">
                {/* 1. Filter Bar (replicates Flutter _FilterBar) */}
                <div className="bg-white dark:bg-github-dark-subtle rounded-xl p-3 border border-slate-200 dark:border-github-dark-border space-y-2.5 shadow-sm">
                    {/* Row 1: Search Input */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search employee or role..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-medium text-slate-900 dark:text-github-dark-text focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Row 2: Mode Presets (Day/Week/Month) + Quick Actions (Calendar & Dept) */}
                    <div className="flex items-center justify-between gap-2">
                        {/* Presets: Day / Week / Month (Replicating web admin panel) */}
                        <div className="inline-flex rounded-lg border border-slate-200/90 dark:border-github-dark-border overflow-hidden bg-white dark:bg-github-dark-subtle shrink-0 shadow-2xs">
                            {[
                                { key: 'day', label: 'Day' },
                                { key: 'week', label: 'Week' },
                                { key: 'month', label: 'Month' },
                            ].map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => handlePresetChange(p.key)}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200/90 dark:border-github-dark-border cursor-pointer ${
                                        datePreset === p.key
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons: Calendar Modal & Department Filter */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowCalendar(true)}
                                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                                    showCalendar || datePreset === 'custom'
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200/80 dark:border-github-dark-border text-slate-500'
                                }`}
                                title="Open Calendar Range Picker"
                            >
                                <Calendar size={15} />
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsDeptModalOpen(true)}
                                className={`p-2 rounded-lg border transition-all shrink-0 cursor-pointer ${
                                    selectedDept
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200/80 dark:border-github-dark-border text-slate-500'
                                }`}
                                title="Filter by Department"
                            >
                                <Building size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Row 3: Native Date Range Pickers (Web Admin Panel Style) */}
                    <div className="flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200/80 dark:border-github-dark-border rounded-lg px-2.5 py-1.5 shadow-2xs">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Calendar size={13} className="text-indigo-500 shrink-0" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        if (datePreset === 'day') {
                                            setDateRange({ start: val, end: val });
                                        } else {
                                            setDatePreset('custom');
                                            setDateRange(prev => ({
                                                start: val,
                                                end: prev.end < val ? val : prev.end
                                            }));
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
                                value={dateRange.end}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        setDatePreset('custom');
                                        setDateRange(prev => ({
                                            start: prev.start > val ? val : prev.start,
                                            end: val
                                        }));
                                    }
                                }}
                                className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full min-w-0 text-right cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Active Multi-Day Range Banner with Quick Reset */}
                    {dateRange.start !== dateRange.end && (
                        <div className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200/60 dark:border-indigo-900/40 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <Calendar size={13} className="shrink-0" />
                                <span className="truncate text-[11px]">
                                    {formatDateLabel(dateRange.start)} — {formatDateLabel(dateRange.end)}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handlePresetChange('day')}
                                className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full shrink-0 cursor-pointer"
                                title="Reset to today"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Active Department Chip Indicator */}
                {selectedDept && (
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            Dept: {selectedDept}
                        </span>
                        <button onClick={() => setSelectedDept(null)} className="text-indigo-400 hover:text-indigo-600">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* 2. Employee List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-500" />
                        <span className="text-xs">Loading activities...</span>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                        <Users size={36} className="text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-medium">No employees found</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredEmployees.map(emp => {
                            const uid = emp.user_id || emp.id;
                            const stats = employeeStatsMap[uid] || { tasks: 0, meetings: 0, hours: 0, items: [] };
                            const name = emp.user_name || emp.name || 'Employee';
                            const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                            const dept = emp.dept_name || emp.department || 'General';
                            const desg = emp.desg_name || emp.designation || emp.user_type || 'Staff';

                            return (
                                <motion.div
                                    key={uid}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedEmployee({ emp, stats })}
                                    className="bg-white dark:bg-github-dark-subtle rounded-xl p-3 border border-slate-200/80 dark:border-github-dark-border flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text truncate">
                                                {name}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 dark:text-github-dark-muted truncate">
                                                {dept} • {desg}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats Badges & Arrow */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {stats.tasks > 0 || stats.meetings > 0 ? (
                                            <div className="flex items-center gap-1.5">
                                                {stats.tasks > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                                                        {stats.tasks} {stats.tasks === 1 ? 'task' : 'tasks'}
                                                    </span>
                                                )}
                                                {stats.hours > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                                                        {formatTaskDuration(stats.hours)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-medium text-slate-400">
                                                No activity
                                            </span>
                                        )}
                                        <ChevronRight size={15} className="text-slate-400" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Department Picker Bottom Sheet */}
            <AnimatePresence>
                {isDeptModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDeptModalOpen(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                            className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle rounded-t-2xl p-5 border-t border-slate-200 dark:border-github-dark-border shadow-2xl z-10 space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Filter by Department</h3>
                                <button onClick={() => setIsDeptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto no-scrollbar py-1">
                                <button
                                    onClick={() => { setSelectedDept(null); setIsDeptModalOpen(false); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                        selectedDept === null
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-[#0d1117] text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    All Departments
                                </button>
                                {departments.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => { setSelectedDept(d); setIsDeptModalOpen(false); }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                            selectedDept === d
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-[#0d1117] text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            {/* Employee Detailed DAR Sheet (replicates Flutter DarAdminSheet) */}
            <AnimatePresence>
                {selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedEmployee(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                            className="relative w-full max-w-lg bg-white dark:bg-[#161b22] rounded-t-2xl p-5 border-t border-slate-200 dark:border-[#30363d] shadow-2xl z-10 flex flex-col max-h-[85vh]"
                        >
                            {/* Drag handle */}
                            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

                            {/* Sheet Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#30363d] shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center">
                                        {(selectedEmployee.emp.user_name || selectedEmployee.emp.name || 'U').charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            {selectedEmployee.emp.user_name || selectedEmployee.emp.name}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            {selectedEmployee.emp.dept_name || selectedEmployee.emp.department} • {selectedEmployee.stats.hours} hrs logged
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Activity Items List */}
                            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2.5">
                                {selectedEmployee.stats.items.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <CheckSquare size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-xs font-medium">No activity records logged for this period</p>
                                    </div>
                                ) : (
                                    selectedEmployee.stats.items.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200/80 dark:border-github-dark-border space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {item.type === 'meeting' ? (
                                                        <Video size={14} className="text-purple-500 shrink-0" />
                                                    ) : (
                                                        <CheckSquare size={14} className="text-indigo-500 shrink-0" />
                                                    )}
                                                    <span className="text-xs font-bold text-slate-800 dark:text-github-dark-text truncate">
                                                        {item.title}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200/40 shrink-0">
                                                    {formatTaskDuration(item.duration, item.startTime, item.endTime)}
                                                </span>
                                            </div>
                                            {item.description && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                                    {item.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                                                {item.startTime && item.endTime && (
                                                    <>
                                                        <span className="font-semibold text-slate-600 dark:text-slate-300">{item.startTime} - {item.endTime}</span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                <span>{formatDateLabel(item.date)}</span>
                                                <span>•</span>
                                                <span className="capitalize">{item.category}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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

            {/* Calendar Modal Portal */}
            {showCalendar && createPortal(
                <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowCalendar(false)} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl"
                    >
                        <MiniCalendar
                            selectedDate={dateRange.start}
                            endDate={dateRange.end}
                            disableRange={false}
                            onDateSelect={(range) => {
                                setDateRange(range);
                                setDatePreset(range.start === range.end ? 'day' : 'custom');
                                setShowCalendar(false);
                            }}
                        />
                    </motion.div>
                </div>,
                document.body
            )}
        </>
    );

    if (embedded) {
        return content;
    }

    return (
        <MobileDashboardLayout 
            title="DAR Overview"
            headerAction={
                <button
                    onClick={() => {
                        if (onOpenConfig) onOpenConfig();
                        else setIsConfigOpen(true);
                    }}
                    className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer active:scale-95"
                    title="Configurations"
                >
                    <Settings size={18} />
                </button>
            }
        >
            {content}
        </MobileDashboardLayout>
    );
};

export default DARAdminMobile;
