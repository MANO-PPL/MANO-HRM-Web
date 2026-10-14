import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Activity, Settings, Clock, FileText, BarChart3, RefreshCw,
    Search, Filter, ChevronRight, CheckCircle2, AlertTriangle,
    Download, Shield, TrendingUp, TrendingDown, Calendar, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import DashboardLayout from '../../components/DashboardLayout';
import DashboardInsights from '../../components/dar/admin/DashboardInsights';
import RequestManager from '../../components/dar/admin/RequestManager';
import MasterDataView from '../../components/dar/admin/MasterDataView';
import AdminConfigurations from '../../components/dar/admin/AdminConfigurations';
import MinimalSelect from '../../components/MinimalSelect';
import { getLocalDateString, formatPlatformDate } from '../../utils/dateUtils';
import {
    calculateSubmissionRate,
    calculateAvgWorkHours,
    calculateIdleTimeMinutes,
    calculateTopActivity,
    formatDurationFromMinutes,
    formatDurationFromHours
} from '../../utils/darAdminMetrics';

const DARAdmin = ({
    embedded = false,
    activeTab: propActiveTab,
    setActiveTab: propSetActiveTab,
    activeMainTab = 'admin',
    setActiveMainTab,
    canAccessAdmin = true
}) => {
    const location = useLocation();

    // Helper to calculate date presets
    const getPresetDates = (preset) => {
        const today = new Date();
        const end = getLocalDateString(today);

        if (preset === 'today') {
            return { start: end, end };
        }
        if (preset === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const yStr = getLocalDateString(y);
            return { start: yStr, end: yStr };
        }
        if (preset === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            return { start: getLocalDateString(d), end };
        }
        // Default: 7 days
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return { start: getLocalDateString(d), end };
    };

    // Determine initial active tab
    const getInitialTab = () => {
        const params = new URLSearchParams(location.search || window.location.search);
        const tab = params.get('tab');
        if (tab && ['insights', 'requests', 'data', 'timeline'].includes(tab)) {
            return tab === 'data' ? 'timeline' : tab;
        }
        if (params.get('requestId') || params.get('req_id') || params.get('id')) {
            return 'requests';
        }
        return 'timeline';
    };

    const [localActiveTab, localSetActiveTab] = useState(getInitialTab);
    const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
    const rawSetActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : localSetActiveTab;

    // Normalize activeTab: 'data' -> 'timeline'
    const normalizedActiveTab = activeTab === 'data' ? 'timeline' : activeTab;
    const setActiveTab = (tab) => {
        rawSetActiveTab(tab === 'data' ? 'timeline' : tab);
    };

    // Sync from URL search params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab && ['insights', 'requests', 'data', 'timeline'].includes(tab)) {
            setActiveTab(tab === 'data' ? 'timeline' : tab);
        } else if (params.get('requestId') || params.get('req_id') || params.get('id')) {
            setActiveTab('requests');
        }
    }, [location.search]);

    // Drawer state
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // Refresh trigger
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Shared Filters State
    const [datePreset, setDatePreset] = useState('7d');
    const [dateRange, setDateRange] = useState(() => getPresetDates('7d'));
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [selectedShift, setSelectedShift] = useState('All Shifts');
    const [selectedDesignation, setSelectedDesignation] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Shared Data State
    const [departments, setDepartments] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // KPI Summary Stats
    const [kpiStats, setKpiStats] = useState({
        submissionRate: 0,
        submittedCount: 0,
        totalEmployees: 0,
        topActivity: 'None',
        topActivityPercent: 0,
        avgHours: '0h 0m',
        avgDiff: 0,
        avgTrend: 'neutral',
        avgIdle: '0h 0m'
    });

    const isTrashOrInactiveUser = (u) => {
        const isTrash = u.is_deleted === 1 || u.is_deleted === true || u.isDeleted === true || Boolean(u.deleted_at);
        const isInactive = u.is_active === 0 || u.is_active === false || u.isActive === false;
        return isTrash || isInactive;
    };

    // Filtered users for metrics
    const activeEmployeesList = useMemo(() => {
        let list = allUsers.filter(u => !isTrashOrInactiveUser(u));
        if (selectedDepartment && selectedDepartment !== 'All' && selectedDepartment !== 'All Departments') {
            list = list.filter(u => u.dept === selectedDepartment);
        }
        if (selectedShift && selectedShift !== 'All' && selectedShift !== 'All Shifts') {
            list = list.filter(u => u.shift === selectedShift);
        }
        if (selectedDesignation && selectedDesignation !== 'All' && selectedDesignation !== 'All Designations') {
            list = list.filter(u => u.designation === selectedDesignation);
        }
        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.dept || '').toLowerCase().includes(q));
        }
        return list;
    }, [allUsers, selectedDepartment, selectedShift, selectedDesignation, searchQuery]);

    // Designations list
    const designationsList = useMemo(() => {
        const desgs = allUsers
            .filter(u => !isTrashOrInactiveUser(u))
            .map(u => u.designation)
            .filter(d => d && d !== '-' && d !== 'N/A');
        return ["All", ...new Set(desgs)].sort((a, b) => a.localeCompare(b));
    }, [allUsers]);

    // 1. Fetch Users, Departments & Shifts
    const fetchCoreData = useCallback(async () => {
        try {
            const [usersRes, deptsRes, shiftsRes] = await Promise.allSettled([
                api.get('/admin/users', { params: { active_only: true } }),
                api.get('/admin/departments'),
                api.get('/policies/shifts')
            ]);

            if (usersRes.status === 'fulfilled' && usersRes.value.data?.success) {
                setAllUsers(usersRes.value.data.users
                    .filter(u => {
                        const isTrash = u.is_deleted === 1 || u.is_deleted === true || Boolean(u.deleted_at);
                        const isInactive = u.is_active === 0 || u.is_active === false;
                        return !isTrash && !isInactive;
                    })
                    .map(u => ({
                        userId: u.user_id,
                        name: u.user_name,
                        dept: u.dept_name,
                        shift: u.shift_name,
                        role: u.user_type,
                        designation: u.desg_name || 'N/A',
                        isActive: u.is_active === 1 || u.is_active === true,
                        isDeleted: u.is_deleted === 1 || u.is_deleted === true || Boolean(u.deleted_at),
                        is_active: u.is_active,
                        is_deleted: u.is_deleted
                    }))
                );
            }

            if (deptsRes.status === 'fulfilled' && deptsRes.value.data?.success) {
                const uniqueDepts = [...new Set(deptsRes.value.data.departments.map(d => d.dept_name))];
                setDepartments(uniqueDepts);
            }

            if (shiftsRes.status === 'fulfilled' && shiftsRes.value.data?.success) {
                setShifts(shiftsRes.value.data.shifts);
            }
        } catch (e) {
            console.error("Failed to load core admin data", e);
        }
    }, []);

    // 2. Fetch Pending Requests Count
    const fetchRequestsCount = useCallback(async () => {
        try {
            const res = await api.get('/dar/requests/list');
            const list = res.data?.data || [];
            const pending = list.filter(r => (r.status || '').toLowerCase() === 'pending').length;
            setPendingRequestsCount(pending);
        } catch (e) {
            console.error("Failed to fetch pending requests count", e);
        }
    }, []);

    // 3. Fetch KPI Stats for Top Ribbon
    const fetchKpis = useCallback(async () => {
        try {
            const { start, end } = dateRange;
            const res = await api.get(`/dar/activities/admin/all?startDate=${start}&endDate=${end}`);
            if (res.data?.ok) {
                let activities = res.data.data || [];

                // Filter activities matching selected department/designation
                if (selectedDepartment && selectedDepartment !== 'All' && selectedDepartment !== 'All Departments') {
                    activities = activities.filter(a => a.user_dept === selectedDepartment);
                }

                if (selectedDesignation && selectedDesignation !== 'All' && selectedDesignation !== 'All Designations') {
                    const userMap = {};
                    allUsers.forEach(u => { userMap[u.userId] = u; });
                    activities = activities.filter(a => {
                        const u = userMap[a.user_id];
                        return u && u.designation === selectedDesignation;
                    });
                }

                const totalEmps = activeEmployeesList.length || allUsers.length || 1;
                const { rate, count } = calculateSubmissionRate(activities, totalEmps, start, end);
                const avgWorkHrs = calculateAvgWorkHours(activities);
                const avgIdleM = calculateIdleTimeMinutes(activities);
                const { topActivity, topActivityPercent } = calculateTopActivity(activities);

                setKpiStats(prev => ({
                    ...prev,
                    submissionRate: rate,
                    submittedCount: count,
                    totalEmployees: totalEmps,
                    topActivity,
                    topActivityPercent,
                    avgHours: formatDurationFromHours(avgWorkHrs),
                    avgIdle: formatDurationFromMinutes(avgIdleM)
                }));
            }
        } catch (e) {
            console.error("Failed to calculate KPIs", e);
        }
    }, [dateRange, selectedDepartment, selectedDesignation, activeEmployeesList, allUsers]);

    // Initial load
    useEffect(() => {
        fetchCoreData();
        fetchRequestsCount();
    }, [fetchCoreData, fetchRequestsCount]);

    // Fetch KPIs when date range, department, designation change
    useEffect(() => {
        fetchKpis();
    }, [fetchKpis, refreshTrigger]);

    // Trigger full refresh
    const handleGlobalRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchCoreData(),
                fetchRequestsCount(),
                fetchKpis()
            ]);
            setRefreshTrigger(prev => prev + 1);
        } finally {
            setTimeout(() => setIsRefreshing(false), 400);
        }
    };

    // Date Preset Handler
    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            setDateRange(getPresetDates(preset));
        }
    };

    // Callback when DashboardInsights computes deeper stats
    const handleStatsFromInsights = useCallback((stats) => {
        setKpiStats(prev => ({
            ...prev,
            ...stats
        }));
    }, []);

    // Filters for DashboardInsights
    const insightsFilters = useMemo(() => ({
        startDate: dateRange.start,
        endDate: dateRange.end,
        dept: selectedDepartment,
        shift: selectedShift,
        desg: selectedDesignation,
        search: searchQuery
    }), [dateRange, selectedDepartment, selectedShift, selectedDesignation, searchQuery]);

    const content = (
        <div className={`dar-context flex flex-col h-full bg-slate-50 dark:bg-dark-bg transition-colors ${embedded ? '' : 'p-4'}`}>

            {/* Standalone Header (only when not embedded in /daily-activity) */}
            {!embedded && (
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-github-dark-text">Daily Activity Report Admin</h1>
                        <p className="text-slate-500 text-xs">Unified team timeline, productivity insights, and revision request approvals</p>
                    </div>
                </div>
            )}

            {/* --- 1. UNIFIED COMMAND & FILTER BAR (INLINE WITH PAGE TAB BAR) --- */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 mb-2.5 shrink-0">
                {/* Left: Page Tab Bar (Daily Activity / Admin Panel) */}
                <div className="flex flex-wrap items-center gap-2">
                    {embedded && canAccessAdmin && (
                        <div className="flex items-center gap-1.5 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0 mr-1">
                            <button
                                data-tour-id="dar-main-tab-activity"
                                onClick={() => setActiveMainTab ? setActiveMainTab('daily_activity') : null}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    activeMainTab === 'daily_activity'
                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <Calendar size={13} className={`${activeMainTab === 'daily_activity' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Daily Activity</span>
                            </button>
                            <button
                                data-tour-id="dar-main-tab-admin"
                                onClick={() => setActiveMainTab ? setActiveMainTab('admin') : null}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    activeMainTab === 'admin'
                                        ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <Shield size={13} className={`${activeMainTab === 'admin' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
                                <span className="leading-none">Admin Panel</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Dropdowns, Search & Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Department Dropdown */}
                    <MinimalSelect
                        options={[
                            { value: 'All', label: 'All Depts' },
                            ...departments.map(d => ({ value: d, label: d }))
                        ]}
                        value={selectedDepartment}
                        onChange={(val) => setSelectedDepartment(val)}
                        placeholder="All Depts"
                        icon={Filter}
                        size="sm"
                    />

                    {/* Shift Dropdown */}
                    <MinimalSelect
                        options={[
                            { value: 'All Shifts', label: 'All Shifts' },
                            ...shifts.map(s => ({ value: s.shift_name, label: s.shift_name }))
                        ]}
                        value={selectedShift}
                        onChange={(val) => setSelectedShift(val)}
                        placeholder="All Shifts"
                        searchable={true}
                        icon={Clock}
                        size="sm"
                    />

                    {/* Designation Dropdown */}
                    <MinimalSelect
                        options={[
                            { value: 'All', label: 'All Designations' },
                            ...designationsList.filter(d => d !== "All").map(d => ({ value: d, label: d }))
                        ]}
                        value={selectedDesignation}
                        onChange={(val) => setSelectedDesignation(val)}
                        placeholder="All Designations"
                        searchable={true}
                        icon={Filter}
                        size="sm"
                    />

                    {/* Employee Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search employee..."
                            className="pl-7 pr-3 py-1.5 w-[130px] focus:w-[170px] transition-all bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-medium text-slate-800 dark:text-github-dark-text outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Configurations Button */}
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-github-dark-subtle dark:hover:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Configure DAR buffer time & task categories"
                    >
                        <Settings size={14} />
                        <span className="hidden sm:inline">Settings</span>
                    </button>

                    {/* Global Refresh Button */}
                    <button
                        onClick={handleGlobalRefresh}
                        disabled={isRefreshing}
                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 dark:bg-github-dark-subtle dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-github-dark-border rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Refresh all data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
                    </button>
                </div>
            </div>

            {/* --- 2. STREAMLINED VIEW SWITCHER (Underline Tab Bar matching My Attendance) --- */}
            <div className="border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between mb-3 shrink-0 px-3.5 sm:px-4">
                <div data-tour-id="dar-admin-tabs" className="flex items-center gap-6 sm:gap-8">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`pb-2.5 text-xs sm:text-sm font-medium transition-all relative cursor-pointer flex items-center gap-2 ${
                            normalizedActiveTab === 'timeline'
                                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                    >
                        <Clock size={16} />
                        <span>Activity Timeline</span>
                        {normalizedActiveTab === 'timeline' && (
                            <motion.div
                                layoutId="darSubTabUnderline"
                                className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"
                            />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('insights')}
                        className={`pb-2.5 text-xs sm:text-sm font-medium transition-all relative cursor-pointer flex items-center gap-2 ${
                            normalizedActiveTab === 'insights'
                                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                    >
                        <BarChart3 size={16} />
                        <span>Analytics & Trends</span>
                        {normalizedActiveTab === 'insights' && (
                            <motion.div
                                layoutId="darSubTabUnderline"
                                className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"
                            />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`pb-2.5 text-xs sm:text-sm font-medium transition-all relative cursor-pointer flex items-center gap-2 ${
                            normalizedActiveTab === 'requests'
                                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted'
                        }`}
                    >
                        <FileText size={16} />
                        <span>Requests</span>
                        {pendingRequestsCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold leading-tight animate-pulse ml-0.5">
                                {pendingRequestsCount}
                            </span>
                        )}
                        {normalizedActiveTab === 'requests' && (
                            <motion.div
                                layoutId="darSubTabUnderline"
                                className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"
                            />
                        )}
                    </button>
                </div>

                {/* If on insights tab, show date switcher here */}
                {normalizedActiveTab === 'insights' && (
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-github-dark-border overflow-hidden bg-white dark:bg-github-dark-subtle">
                            {[
                                { key: 'today', label: 'Day' },
                                { key: '7d', label: 'Week' },
                                { key: '30d', label: 'Month' },
                            ].map((preset) => (
                                <button
                                    key={preset.key}
                                    onClick={() => handlePresetChange(preset.key)}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors border-r last:border-r-0 border-slate-200 dark:border-github-dark-border cursor-pointer ${
                                        datePreset === preset.key
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg px-2.5 py-1">
                            <Calendar size={13} className="text-indigo-500 shrink-0" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => {
                                    setDatePreset('custom');
                                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-[95px] cursor-pointer"
                            />
                            <span className="text-slate-400 text-[10px] font-bold uppercase">to</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => {
                                    setDatePreset('custom');
                                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-[95px] cursor-pointer"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* --- 5. WORKSPACE CONTENT AREA --- */}
            <div className="flex-1 overflow-hidden min-h-0 relative">
                {/* 1. Activity Timeline (formerly Master Data) */}
                {normalizedActiveTab === 'timeline' && (
                    <div data-tour-id="dar-admin-master-data-tab-content" className="h-full">
                        <MasterDataView
                            departments={departments}
                            shifts={shifts}
                            allUsers={allUsers}
                            dateRange={dateRange}
                            setDateRange={setDateRange}
                            datePreset={datePreset}
                            setDatePreset={setDatePreset}
                            selectedDepartment={selectedDepartment}
                            setSelectedDepartment={setSelectedDepartment}
                            selectedShift={selectedShift}
                            setSelectedShift={setSelectedShift}
                            selectedDesignation={selectedDesignation}
                            setSelectedDesignation={setSelectedDesignation}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            isEmbeddedInAdmin={true}
                        />
                    </div>
                )}

                {/* 2. Analytics & Insights Dashboard */}
                {normalizedActiveTab === 'insights' && (
                    <div data-tour-id="dar-admin-insights-tab-content" className="h-full">
                        <DashboardInsights
                            departments={departments}
                            allUsers={allUsers}
                            filters={insightsFilters}
                            onStatsUpdate={handleStatsFromInsights}
                            hideTopControls={true}
                            refreshTrigger={refreshTrigger}
                            onOpenConfig={() => setIsConfigOpen(true)}
                        />
                    </div>
                )}

                {/* 3. Requests Review Manager */}
                {normalizedActiveTab === 'requests' && (
                    <div data-tour-id="dar-admin-requests-tab-content" className="h-full">
                        <RequestManager
                            departments={departments}
                            selectedDepartment={selectedDepartment}
                            searchQuery={searchQuery}
                            onRequestHandled={() => {
                                fetchRequestsCount();
                                fetchKpis();
                            }}
                            onRequestCountsUpdated={({ pending }) => setPendingRequestsCount(pending)}
                        />
                    </div>
                )}
            </div>

            {/* --- 6. CONFIGURATION SIDEBAR DRAWER --- */}
            <AnimatePresence>
                {isConfigOpen && (
                    <Portal>
                        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsConfigOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                            />

                            {/* Sidebar Container */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative w-[85vw] max-w-[340px] sm:w-full sm:max-w-[360px] h-full bg-white dark:bg-github-dark-subtle shadow-2xl flex flex-col dar-context border-l border-slate-200 dark:border-github-dark-border"
                            >
                                <AdminConfigurations onClose={() => setIsConfigOpen(false)} />
                            </motion.div>
                        </div>
                    </Portal>
                )}
            </AnimatePresence>
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <DashboardLayout>
            {content}
        </DashboardLayout>
    );
};

// Portal Helper
const Portal = ({ children }) => {
    return ReactDOM.createPortal(children, document.body);
};

export default DARAdmin;
