import React from 'react';
import { ArrowLeft, Users, Search, Loader2, UserMinus, UserPlus } from 'lucide-react';

const PolicyStaffAssignment = ({
    selectedPolicy,
    assignedStaff = [],
    availableStaff = [],
    loadingBalances = false,
    selectedYear,
    setSelectedYear,
    balanceSearch = '',
    setBalanceSearch,
    openEditBalanceDrawer,
    setConfirmUnassignUser,
    handleAssignUser,
    activeMobileTab,
    setActiveMobileTab
}) => {
    if (!selectedPolicy) {
        return (
            <div className={`w-full lg:w-1/3 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden shrink-0 ${activeMobileTab !== 'staff' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                    <Users size={48} className="opacity-20 mb-3" />
                    <h4 className="font-bold text-xs">No Policy Selected</h4>
                    <p className="text-[11px] mt-1 font-normal">Select a leave policy from the directory to manage assigned staff balances.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full lg:w-1/3 h-full bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden shrink-0 ${activeMobileTab !== 'staff' ? 'hidden lg:flex' : 'flex'}`}>
            {/* Header assigned list */}
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border space-y-4">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setActiveMobileTab('details')}
                        className="lg:hidden flex items-center gap-1 text-xs font-medium text-indigo-650 cursor-pointer"
                    >
                        <ArrowLeft size={14} />
                        Back Details
                    </button>
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-1.5">
                        <Users size={12} />
                        Assigned Staff ({assignedStaff.length})
                    </h3>

                    {/* Target Year selection */}
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-[#30363d] rounded-lg text-[10px] font-normal text-slate-600 dark:text-slate-350 outline-none cursor-pointer"
                    >
                        {Array.from({ length: 5 }, (_, i) => {
                            const y = new Date().getFullYear() - 2 + i;
                            return <option key={y} value={y}>{y}</option>;
                        })}
                    </select>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                        type="text"
                        placeholder="Search staff, design..."
                        value={balanceSearch}
                        onChange={(e) => setBalanceSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 text-slate-705 dark:text-github-dark-text font-normal"
                    />
                </div>
            </div>

            {/* Split Staff lists */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800 no-scrollbar p-2 space-y-3">
                {/* Section 1: Assigned Staff list */}
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Assigned Staff ({assignedStaff.length})</h4>
                    {loadingBalances ? (
                        <div className="flex justify-center items-center py-4">
                            <Loader2 className="animate-spin text-indigo-600" size={16} />
                        </div>
                    ) : assignedStaff.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-2 font-normal">No assigned staff matches query.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {assignedStaff.map(user => (
                                <div
                                    key={user.user_id}
                                    className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-all"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-medium text-xs text-slate-650 overflow-hidden shrink-0">
                                            {user.profile_image_url && user.profile_image_url.startsWith('http') ? (
                                                <img src={user.profile_image_url} alt={user.user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                (user.user_name || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="text-xs font-semibold text-slate-850 dark:text-github-dark-text truncate">{user.user_name}</p>
                                                {user.designation && (
                                                    <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 shrink-0">{user.designation}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">{user.email}</p>
                                            
                                            {/* Summarize rule balances inside a clean structured layout */}
                                            {user.policyBalances && user.policyBalances.length > 0 && (
                                                <div className="grid grid-cols-1 gap-1.5 mt-2 bg-slate-50 dark:bg-github-dark-subtle/50 p-2 rounded-lg border border-slate-200 dark:border-github-dark-border">
                                                    {user.policyBalances.map(bal => (
                                                        <div
                                                            key={bal.lb_id}
                                                            onClick={() => openEditBalanceDrawer(bal)}
                                                            className="text-[9px] font-medium text-slate-605 dark:text-slate-350 cursor-pointer hover:text-indigo-600 flex flex-col"
                                                            title="Adjust Balance"
                                                        >
                                                            <span className="text-[9px] text-slate-500 font-medium truncate">{bal.leave_type}</span>
                                                            <span className="mt-0.5 text-slate-750 dark:text-slate-200">
                                                                Available: <strong className="text-indigo-650 dark:text-indigo-400">{Number(bal.available)}</strong>/{Number(bal.allocated)}d
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setConfirmUnassignUser({ isOpen: true, user, balancesToDelete: user.policyBalances || [] })}
                                        className="w-7 h-7 flex items-center justify-center text-slate-450 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-all shrink-0 cursor-pointer ml-2 self-start"
                                        title="Unassign Policy"
                                    >
                                        <UserMinus size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 2: Available Staff list */}
                <div className="space-y-3 pt-3">
                    <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">Available Staff ({availableStaff.length})</h4>
                    {availableStaff.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-2 font-normal">No available staff.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {availableStaff.map(user => (
                                <div
                                    key={user.user_id}
                                    className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-medium text-xs text-slate-650 overflow-hidden shrink-0">
                                            {user.profile_image_url && user.profile_image_url.startsWith('http') ? (
                                                <img src={user.profile_image_url} alt={user.user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                (user.user_name || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="text-xs font-semibold text-slate-850 dark:text-github-dark-text truncate">{user.user_name}</p>
                                                {user.designation && (
                                                    <span className="text-[10px] font-medium text-slate-500 dark:text-github-dark-muted shrink-0">{user.designation}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">{user.email}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleAssignUser(user)}
                                        className="w-7 h-7 flex items-center justify-center text-slate-405 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-full transition-all shrink-0 cursor-pointer ml-2"
                                        title="Assign Policy"
                                    >
                                        <UserPlus size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PolicyStaffAssignment;
