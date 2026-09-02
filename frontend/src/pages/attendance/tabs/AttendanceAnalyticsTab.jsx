import React from 'react';
import {
    Calendar as CalendarIcon,
    RefreshCw,
    History,
    Clock,
    MoreVertical
} from 'lucide-react';
import { Bar, Pie, Line } from 'react-chartjs-2';
import MonthPicker from '../../../components/MonthPicker';
import DatePicker from '../../../components/DatePicker';

const AttendanceAnalyticsTab = ({
    analyticsFilterType,
    setAnalyticsFilterType,
    analyticsSelectedMonth,
    setAnalyticsSelectedMonth,
    analyticsStartDate,
    setAnalyticsStartDate,
    analyticsEndDate,
    setAnalyticsEndDate,
    analyticsLoading,
    analyticsSessions,
    getSessionHours,
    chartData,
    pieData
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Date Filters */}
            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-github-dark-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <CalendarIcon size={20} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Analytics Period</h4>
                        <p className="text-[11px] text-slate-400 dark:text-github-dark-muted font-bold mt-0.5">Configure the date range for metrics and charts</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Type Segment Selector */}
                    <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex gap-1 border border-slate-200/50 dark:border-white/5 shrink-0">
                        {[
                            { id: 'this_month', label: 'This Month' },
                            { id: 'last_month', label: 'Last Month' },
                            { id: 'select_month', label: 'Select Month' },
                            { id: 'custom', label: 'Custom' },
                        ].map(type => (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => setAnalyticsFilterType(type.id)}
                                className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${analyticsFilterType === type.id
                                    ? 'bg-white dark:bg-github-dark-subtle text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Contextual Inputs */}
                    {analyticsFilterType === 'select_month' && (
                        <div className="w-44">
                            <MonthPicker
                                value={analyticsSelectedMonth}
                                onChange={(val) => setAnalyticsSelectedMonth(val)}
                                compact={true}
                            />
                        </div>
                    )}

                    {analyticsFilterType === 'custom' && (
                        <div className="flex items-center gap-2">
                            <div className="w-36">
                                <DatePicker
                                    value={analyticsStartDate}
                                    onChange={(val) => setAnalyticsStartDate(val)}
                                    compact={true}
                                    placeholder="Start Date"
                                />
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-black uppercase">To</span>
                            <div className="w-36">
                                <DatePicker
                                    value={analyticsEndDate}
                                    onChange={(val) => setAnalyticsEndDate(val)}
                                    compact={true}
                                    placeholder="End Date"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {analyticsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm">
                    <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
                    <p className="text-xs font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-widest">Compiling Analytics Data...</p>
                </div>
            ) : (
                <>
                    {/* 1. KPI Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Card 1: Total Days */}
                        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Total Days</p>
                                <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">{analyticsSessions.length}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <CalendarIcon size={24} />
                            </div>
                        </div>

                        {/* Card 2: Present % */}
                        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                            <div className="flex justify-between items-start z-10 relative">
                                <div>
                                    <p className="text-sm text-slate-500 font-medium">Present</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                        {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / analyticsSessions.length) * 100) : 0}%
                                    </h3>
                                </div>
                                <div className="h-12 w-12 rounded-full border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-500 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-emerald-600">
                                        {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.status !== 'ABSENT' && s.status !== 'LATE' && s.status !== 'OVERTIME').length / analyticsSessions.length) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Late % */}
                        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border relative overflow-hidden">
                            <div className="flex justify-between items-start z-10 relative">
                                <div>
                                    <p className="text-sm text-slate-500 font-medium">Late</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                        {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.late_minutes > 0).length / analyticsSessions.length) * 100) : 0}%
                                    </h3>
                                </div>
                                <div className="h-12 w-12 rounded-full border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-500 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-amber-600">
                                        {analyticsSessions.length > 0 ? Math.round((analyticsSessions.filter(s => s.late_minutes > 0).length / analyticsSessions.length) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Overtime Days */}
                        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Overtime</p>
                                <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                    {analyticsSessions.filter(s => s.status === 'OVERTIME').length}
                                </h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <History size={24} />
                            </div>
                        </div>

                        {/* Card 5: Avg Hours */}
                        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Avg Hours</p>
                                <h3 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1">
                                    {analyticsSessions.length > 0
                                        ? (analyticsSessions.reduce((acc, s) => acc + getSessionHours(s), 0) / analyticsSessions.length).toFixed(1)
                                        : '0'}
                                </h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Clock size={24} />
                            </div>
                        </div>
                    </div>

                    {/* 2. Attendance Trends (Full Width) */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text">Total Attendance Report</h3>
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                        <div className="h-72">
                            <Bar
                                data={chartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            titleColor: '#fff',
                                            bodyColor: '#e2e8f0',
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            borderWidth: 1,
                                            padding: 12,
                                            boxPadding: 6,
                                            usePointStyle: true,
                                            callbacks: {
                                                title: function (context) {
                                                    const index = context[0].dataIndex;
                                                    const session = context[0].dataset.sessions?.[index];
                                                    if (session) {
                                                        const dateStr = session.check_in || session.time_in;
                                                        if (dateStr) {
                                                            return new Date(dateStr).toLocaleDateString('en-US', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            });
                                                        }
                                                    }
                                                    return context[0].label;
                                                },
                                                label: function (context) {
                                                    const index = context.dataIndex;
                                                    const session = context.dataset.sessions?.[index];
                                                    const hours = context.parsed.y;
                                                    const labelLines = [`Worked: ${hours} hrs`];
                                                    if (session) {
                                                        if (session.status) {
                                                            labelLines.push(`Status: ${session.status}`);
                                                        }
                                                        if (session.time_in) {
                                                            const inTime = new Date(session.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                            labelLines.push(`In: ${inTime}`);
                                                        }
                                                        if (session.time_out) {
                                                            const outTime = new Date(session.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                            labelLines.push(`Out: ${outTime}`);
                                                        } else if (session.time_in) {
                                                            labelLines.push(`Out: Active / Missed`);
                                                        }
                                                    }
                                                    return labelLines;
                                                }
                                            }
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                            ticks: { color: '#94a3b8' }
                                        },
                                        x: {
                                            grid: { display: false },
                                            ticks: { color: '#94a3b8' }
                                        }
                                    },
                                    borderRadius: 6,
                                    barThickness: 24
                                }}
                            />
                        </div>
                    </div>

                    {/* 3. Bottom Row: Status & Weekly Pattern */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Breakdown */}
                        <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Attendance Status</h3>
                            <div className="h-64 flex justify-center relative">
                                <Pie
                                    data={pieData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'right',
                                                labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Weekly Activity Line/Area Chart */}
                        <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-github-dark-text mb-6">Weekly Activity</h3>
                            <div className="h-64">
                                <Line
                                    data={{
                                        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                                        datasets: [{
                                            label: 'Avg Hours',
                                            data: [0, 1, 2, 3, 4, 5, 6].map(d => {
                                                const sessionsOnDay = analyticsSessions.filter(s => new Date(s.time_in).getDay() === d);
                                                if (sessionsOnDay.length === 0) return 0;
                                                const total = sessionsOnDay.reduce((acc, s) => acc + getSessionHours(s), 0);
                                                return parseFloat((total / sessionsOnDay.length).toFixed(1));
                                            }),
                                            backgroundColor: 'rgba(79, 70, 229, 0.1)',
                                            borderColor: '#4f46e5',
                                            borderWidth: 2,
                                            tension: 0.4,
                                            fill: true,
                                            pointBackgroundColor: '#4f46e5',
                                            pointHoverRadius: 6,
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: {
                                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                titleColor: '#fff',
                                                bodyColor: '#e2e8f0',
                                                callbacks: {
                                                    label: function (context) {
                                                        return `Avg Hours: ${context.parsed.y} hrs`;
                                                    }
                                                }
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                                ticks: { color: '#94a3b8' }
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: '#94a3b8' }
                                            }
                                        }
                                    }}
                            />
                        </div>
                    </div>
                </div>
            </>
        )}
    </div>
);
};

export default AttendanceAnalyticsTab;
