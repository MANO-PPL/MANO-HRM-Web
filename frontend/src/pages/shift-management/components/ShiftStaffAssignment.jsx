import React from 'react';
import { Users, Search, Clock, Check, Plus } from 'lucide-react';

const ShiftStaffAssignment = ({
    selectedShift,
    users = [],
    shifts = [],
    loadingUsers = false,
    userSearch = '',
    setUserSearch,
    selectedUserId,
    setSelectedUserId,
    avatarTimestamp,
    handleToggleUserShift
}) => {
    const filteredUsers = users.filter(u =>
        u.user_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.desg_name?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <div data-tour-id="shift-mgmt-users" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-500" />
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">Assigned Staff</h3>
                    {selectedShift && (
                        <span className="ml-auto text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {users.filter(u => u.shift_id === selectedShift.id).length}
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-4">
                {loadingUsers && <p className="text-xs text-slate-400 px-3 py-4 text-center font-normal">Loading users...</p>}
                {!loadingUsers && (() => {
                    const assignedUsers = filteredUsers.filter(user => selectedShift && user.shift_id === selectedShift.id);
                    const unassignedUsers = filteredUsers.filter(user => !selectedShift || user.shift_id !== selectedShift.id);
                    
                    const renderUserCard = (user) => {
                        const isAssigned = selectedShift && user.shift_id === selectedShift.id;
                        const userShift = shifts.find(s => s.id === user.shift_id);
                        const isSelected = selectedUserId === user.user_id;
                        return (
                            <div
                                key={user.user_id}
                                onClick={() => setSelectedUserId(prev => prev === user.user_id ? null : user.user_id)}
                                className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer group ${
                                    isSelected
                                        ? 'bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/10'
                                        : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                                        {user.profile_image_url ? (
                                            <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.user_name} className="w-full h-full object-cover" />
                                        ) : user.user_name?.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text truncate">{user.user_name}</p>
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            <p className="text-[11px] text-slate-400 truncate font-normal">{user.desg_name}</p>
                                            {userShift ? (
                                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/20 flex items-center gap-1 w-max">
                                                    <Clock size={8} /> {userShift.name}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1 w-max">
                                                    No Shift
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedShift) {
                                            handleToggleUserShift(user.user_id, isAssigned);
                                        }
                                    }}
                                    disabled={!selectedShift}
                                    title={!selectedShift ? 'Select a shift first' : isAssigned ? 'Remove from shift' : 'Assign to shift'}
                                    className={`p-1.5 rounded-md transition-all flex-shrink-0 cursor-pointer ${!selectedShift ? 'cursor-not-allowed opacity-30' : isAssigned
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                                        }`}
                                >
                                    {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                                </button>
                            </div>
                        );
                    };

                    return (
                        <div className="space-y-4">
                            {assignedUsers.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2">Assigned Staff ({assignedUsers.length})</p>
                                    {assignedUsers.map(renderUserCard)}
                                </div>
                            )}
                            {unassignedUsers.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2">
                                        {assignedUsers.length > 0 ? "Available Staff" : "All Staff"} ({unassignedUsers.length})
                                    </p>
                                    {unassignedUsers.map(renderUserCard)}
                                </div>
                            )}
                            {assignedUsers.length === 0 && unassignedUsers.length === 0 && (
                                <p className="text-xs text-slate-400 px-3 text-center py-4 font-normal">No staff matched search query</p>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default ShiftStaffAssignment;
