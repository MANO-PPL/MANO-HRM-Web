import React from 'react';
import { Search, Upload, Plus, Calendar, Pencil, Trash2 } from 'lucide-react';
import { parseLocalDate } from '../../../services/holidayService';

const HolidaysTab = ({
    holidays,
    isLoading,
    searchTerm,
    setSearchTerm,
    calendarDate,
    user,
    navigate,
    onOpenAddModal,
    onEditHoliday,
    onDeleteHoliday
}) => {
    const filteredHolidays = holidays.filter(h =>
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const currentYear = calendarDate.getFullYear();
    const currentMonth = calendarDate.getMonth();

    const selectedMonthHolidays = filteredHolidays.filter(h => {
        const d = parseLocalDate(h.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const upcomingHolidays = filteredHolidays.filter(h => {
        const d = parseLocalDate(h.date);
        return d >= new Date().setHours(0, 0, 0, 0);
    });

    const renderHolidayList = (holidayList, title) => {
        const groups = holidayList.reduce((groups, holiday) => {
            const date = parseLocalDate(holiday.date);
            const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groups[monthYear]) {
                groups[monthYear] = [];
            }
            groups[monthYear].push(holiday);
            return groups;
        }, {});

        const sortedKeys = Object.keys(groups).sort((a, b) => {
            return parseLocalDate(groups[a][0].date) - parseLocalDate(groups[b][0].date);
        });

        return (
            <div className="space-y-4">
                {title && <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1">{title}</h3>}

                <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-github-dark-border overflow-hidden flex flex-col transition-all">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedKeys.map(monthYear => (
                            <div key={monthYear} className="p-5 space-y-3.5">
                                {/* Month Subheading */}
                                <div className="flex items-center justify-between pb-1">
                                    <h4 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm tracking-tight flex items-center gap-2">
                                        <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></span>
                                        {monthYear}
                                    </h4>
                                    <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500 dark:text-github-dark-muted border border-slate-200 dark:border-github-dark-border/40">
                                        {groups[monthYear].length} {groups[monthYear].length === 1 ? 'Holiday' : 'Holidays'}
                                    </span>
                                </div>

                                {/* List of Holidays */}
                                <div className="space-y-2.5">
                                    {groups[monthYear].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)).map(holiday => (
                                        <div key={holiday.id} className="p-3 bg-slate-50/30 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group flex items-center gap-4">
                                            {/* Date Box */}
                                            <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-650 dark:text-indigo-400 flex flex-col items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
                                                <span className="text-[9px] font-medium leading-none opacity-70 mb-0.5">
                                                    {parseLocalDate(holiday.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                </span>
                                                <span className="text-lg font-bold leading-tight">
                                                    {parseLocalDate(holiday.date).getDate()}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col">
                                                    <h4 className="font-semibold text-sm text-slate-800 dark:text-github-dark-text truncate">
                                                        {holiday.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${holiday.type === 'Public'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/50'
                                                            : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50'
                                                            }`}>
                                                            {holiday.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Visible Action Buttons */}
                                            {['admin', 'hr'].includes(user?.user_type) && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => onEditHoliday(holiday)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all cursor-pointer"
                                                        title="Edit Holiday"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteHoliday(holiday)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer"
                                                        title="Delete Holiday"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search holidays..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 dark:text-github-dark-text"
                        />
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {['admin', 'hr'].includes(user?.user_type) && (
                        <>
                            <button
                                onClick={() => navigate('/holidays/bulk')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                                <Upload size={16} />
                                <span className="hidden sm:inline">Import</span>
                            </button>
                            <button
                                data-tour-id="holiday-admin-add"
                                onClick={onOpenAddModal}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
                            >
                                <Plus size={16} />
                                <span>Add</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-500">Loading holidays...</div>
                ) : filteredHolidays.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No holidays found.</p>
                    </div>
                ) : (
                    <>
                        {selectedMonthHolidays.length > 0 ? (
                            renderHolidayList(selectedMonthHolidays, "Selected Month")
                        ) : (
                            <div className="text-center py-8 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-github-dark-border">
                                <p className="text-slate-500 text-sm">No holidays in {calendarDate.toLocaleString('default', { month: 'long' })}</p>
                            </div>
                        )}

                        {upcomingHolidays.length > 0 && renderHolidayList(upcomingHolidays, "Upcoming Holidays")}
                    </>
                )}
            </div>
        </div>
    );
};

export default HolidaysTab;
