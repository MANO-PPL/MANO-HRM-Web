import React from 'react';
import {
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    Activity,
    Clock
} from 'lucide-react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    AreaChart,
    Area
} from 'recharts';

const CustomHoursTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const loggedHrs = data.logged;
        const expectedHrs = data.expected;

        const totalMin = Math.round(loggedHrs * 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        const loggedFormatted = `${h}h ${m}m`;

        const pct = expectedHrs > 0 ? Math.round((loggedHrs / expectedHrs) * 100) : 0;

        return (
            <div className="bg-slate-800/95 dark:bg-[#161b22]/95 border border-slate-700 dark:border-github-dark-border p-3 rounded-xl text-white shadow-xl text-xs backdrop-blur-sm">
                <p className="font-semibold mb-1.5 text-slate-200">{data.fullName}</p>
                <div className="space-y-1">
                    <p className="flex justify-between gap-4">
                        <span className="text-slate-400 font-normal">Logged:</span>
                        <span className="font-semibold text-indigo-400">{loggedFormatted}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-slate-400 font-normal">Expected:</span>
                        <span className="font-semibold text-slate-300">{expectedHrs} hrs</span>
                    </p>
                    <p className="flex justify-between gap-4 border-t border-slate-700/50 pt-1 mt-1">
                        <span className="text-slate-400 font-normal">Progress:</span>
                        <span className={`font-semibold ${pct >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{pct}%</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const LiveAnalyticsTab = ({
    getStatusData,
    getDepartmentData,
    getTimelineData,
    getLoginFrequencyData,
    presentStaffChartData = []
}) => {
    const loginFrequencyData = getLoginFrequencyData ? getLoginFrequencyData() : [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text">Attendance Status</h3>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-md">
                            <PieChartIcon size={20} />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={getStatusData ? getStatusData() : []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {(getStatusData ? getStatusData() : []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Department Breakdown */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text">Department Metrics</h3>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                            <BarChartIcon size={20} />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getDepartmentData ? getDepartmentData() : []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Check-in Activity */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text">Staff Activity Timeline</h3>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-github-dark-muted">Login</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-lg border border-slate-100 dark:border-github-dark-border">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-github-dark-muted">Active</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getTimelineData ? getTimelineData() : []}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                />
                                <Area name="Active Staff" type="monotone" dataKey="active" stroke="#10b981" fillOpacity={1} fill="url(#colorActive)" strokeWidth={3} />
                                <Area name="Staff Check-ins" type="monotone" dataKey="checkins" stroke="#6366f1" fillOpacity={1} fill="url(#colorCheckins)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Login Frequency */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text">Session Frequency</h3>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={loginFrequencyData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.3} />
                                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', color: '#fff' }}
                                />
                                <Bar dataKey="value" name="Employees" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24}>
                                    {loginFrequencyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`url(#gradBar-${index})`} />
                                    ))}
                                </Bar>
                                <defs>
                                    {loginFrequencyData.map((_, i) => (
                                        <linearGradient key={i} id={`gradBar-${i}`} x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#a855f7" />
                                        </linearGradient>
                                    ))}
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Shift Hours Progress */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-slate-200 dark:border-github-dark-border shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                        <Clock size={20} className="text-indigo-500" /> Shift Hours Progress
                    </h3>
                    <span className="text-xs font-normal text-slate-500 dark:text-github-dark-muted">
                        Actual logged hours vs. Expected shift duration today
                    </span>
                </div>
                {presentStaffChartData.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-github-dark-muted text-center py-12">
                        No checked-in employees to track shift hours.
                    </p>
                ) : (
                    <div className="h-[400px] w-full overflow-y-auto pr-2 no-scrollbar">
                        <div style={{ height: Math.max(350, presentStaffChartData.length * 45) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={presentStaffChartData}
                                    layout="vertical"
                                    margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                                    barGap={4}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.3} />
                                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'dataMax + 1']} />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip content={<CustomHoursTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <Bar dataKey="logged" name="Logged Hours" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                                    <Bar dataKey="expected" name="Expected Hours" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={12} opacity={0.5} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveAnalyticsTab;
