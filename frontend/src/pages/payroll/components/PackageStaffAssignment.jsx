import React from 'react';
import { Users, Search, Check, Plus } from 'lucide-react';

const PackageStaffAssignment = ({
    selectedPackage,
    employees = [],
    filteredEmployees = [],
    isLoadingEmployees = false,
    employeeSearch = '',
    setEmployeeSearch,
    packages = [],
    avatarTimestamp,
    onAssignClick,
    onUnassignClick
}) => {
    return (
        <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-500" />
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">Staff Assignments</h3>
                    {selectedPackage && (
                        <span className="ml-auto text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {employees.filter(e => e.package_group_id === selectedPackage.package_group_id).length} Assigned
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        value={employeeSearch}
                        onChange={e => setEmployeeSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-0.5">
                {isLoadingEmployees && (
                    <p className="text-xs text-slate-400 px-3 py-4 text-center font-normal">Loading users...</p>
                )}
                {!isLoadingEmployees && filteredEmployees.map(emp => {
                    const isAssigned = selectedPackage && emp.package_group_id === selectedPackage.package_group_id;

                    return (
                        <div key={emp.user_id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                                    {emp.profile_image_url ? (
                                        <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt={emp.user_name} className="w-full h-full object-cover" />
                                    ) : emp.user_name?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text truncate">
                                            {emp.user_name}
                                        </p>
                                        {emp.package_group_id && (() => {
                                            const assignedPkg = packages.find(p => p.package_group_id === emp.package_group_id);
                                            if (!assignedPkg) return null;
                                            return (
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${
                                                    isAssigned
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50'
                                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-450 border border-amber-250/30'
                                                }`}>
                                                    {assignedPkg.package_name}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate font-normal">
                                        {emp.desg_name || 'No designation'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (!selectedPackage) return;
                                    if (isAssigned) {
                                        onUnassignClick(emp);
                                    } else {
                                        onAssignClick(emp);
                                    }
                                }}
                                disabled={!selectedPackage}
                                title={!selectedPackage ? 'Select a package first' : isAssigned ? 'Unassign from package' : 'Assign to package'}
                                className={`p-1.5 rounded-md transition-all flex-shrink-0 cursor-pointer ${!selectedPackage ? 'cursor-not-allowed opacity-30' : isAssigned
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-250'
                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                                    }`}
                            >
                                {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PackageStaffAssignment;
