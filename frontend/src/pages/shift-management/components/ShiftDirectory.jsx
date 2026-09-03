import React from 'react';
import { Plus, Search, Briefcase, Clock, Users, ArrowRight } from 'lucide-react';

const ShiftDirectory = ({
    shifts = [],
    filteredShifts = [],
    selectedShift,
    setSelectedShift,
    isLoadingShifts = false,
    shiftSearch = '',
    setShiftSearch,
    users = [],
    selectedUserId,
    onOpenAddShift,
    calculateDuration
}) => {
    return (
        <div data-tour-id="shift-mgmt-list" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">Shifts</h3>
                    <button
                        data-tour-id="shift-mgmt-add"
                        onClick={onOpenAddShift}
                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                        title="Create new shift"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search shifts..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        value={shiftSearch}
                        onChange={e => setShiftSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                {isLoadingShifts && (
                    <div className="py-10 text-center text-slate-400 text-xs font-normal">Loading shifts...</div>
                )}
                {!isLoadingShifts && filteredShifts.length === 0 && (
                    <div className="py-10 text-center space-y-2">
                        <Briefcase size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="text-xs text-slate-400 font-normal">No shifts found</p>
                        <button
                            onClick={onOpenAddShift}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >+ Create first shift</button>
                    </div>
                )}
                {filteredShifts.map((shift, idx) => {
                    const selectedUser = selectedUserId ? users.find(u => u.user_id === selectedUserId) : null;
                    const isUserAssignedShift = selectedUser && selectedUser.shift_id === shift.id;
                    return (
                        <div
                            key={shift.id}
                            data-tour-id={idx === 0 ? "shift-management-card" : undefined}
                            onClick={() => setSelectedShift(shift)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer group ${selectedShift?.id === shift.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                } ${isUserAssignedShift
                                    ? 'ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5'
                                    : ''
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isUserAssignedShift ? 'bg-emerald-500 animate-pulse' : shift.is_active ? 'bg-indigo-500' : 'bg-slate-350 dark:bg-slate-600'}`} />
                                    <h4 className={`font-semibold text-sm ${selectedShift?.id === shift.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                        {shift.name}
                                    </h4>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                    {!shift.is_active && (
                                        <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">
                                            Inactive
                                        </span>
                                    )}
                                    {isUserAssignedShift && (
                                        <span className="text-[9px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                            Assigned
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-mono mb-2">
                                {shift.start} → {shift.end}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-github-dark-muted font-normal">
                                <span className="flex items-center gap-1 font-normal"><Clock size={12} /> {calculateDuration(shift.start, shift.end)}</span>
                                <span className="flex items-center gap-1 font-normal"><Users size={12} /> {users.filter(u => u.shift_id === shift.id).length} staff</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ShiftDirectory;
