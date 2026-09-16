import React from 'react';
import { Search, RotateCcw, Trash2, UserCheck, UserX, Edit2 } from 'lucide-react';

const EmployeeTable = ({
    loading = false,
    filteredEmployees = [],
    visibleColumns = {},
    avatarTimestamp,
    getEmployeeProfile,
    handleSelectEmployee,
    handleRestore,
    handleForceDelete,
    handleToggleStatus,
    setEditMode,
    handleDelete
}) => {
    return (
        <div className="flex-1 min-h-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm transition-colors duration-300 flex flex-col">
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                        <tr className="text-slate-500 dark:text-github-dark-muted font-bold text-xs uppercase tracking-wider">
                            {visibleColumns.employeeId && <th className="px-6 py-4 font-bold">Emp ID</th>}
                            {visibleColumns.employee && <th className="px-6 py-4 font-bold">Employee</th>}
                            {visibleColumns.roleDept && <th className="px-6 py-4 font-bold">Role & Dept</th>}
                            {visibleColumns.phone && <th className="px-6 py-4 font-bold">Phone</th>}
                            {visibleColumns.shift && <th className="px-6 py-4 font-bold">Shift</th>}
                            {visibleColumns.geofences && <th className="px-6 py-4 font-bold">Allowed Geofences</th>}
                            {visibleColumns.joiningDate && <th className="px-6 py-4 font-bold">Joining Date</th>}
                            {visibleColumns.reportingManager && <th className="px-6 py-4 font-bold">Reporting Manager</th>}
                            {visibleColumns.workLocation && <th className="px-6 py-4 font-bold">Work Location</th>}
                            {visibleColumns.address && <th className="px-6 py-4 font-bold">Address</th>}
                            {visibleColumns.onboardingProgress && <th className="px-6 py-4 font-bold">Onboarding</th>}
                            {visibleColumns.actions && <th className="px-6 py-4 font-bold text-center">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan="12" className="px-6 py-12 text-center text-slate-400 italic">
                                    Loading employee directory files...
                                </td>
                            </tr>
                        ) : filteredEmployees.length > 0 ? (
                            filteredEmployees.map((emp, index) => {
                                const profile = getEmployeeProfile ? getEmployeeProfile(emp.id, emp.name) : {};
                                const progress = emp.onboarding_progress || 0;

                                return (
                                    <tr
                                        key={emp.id}
                                        onClick={() => handleSelectEmployee(emp)}
                                        data-tour-id={index === 0 ? "emp-unified-table-row" : undefined}
                                        className="group hover:bg-indigo-50/35 dark:hover:bg-[#161b22]/30 cursor-pointer border-l-2 border-transparent hover:border-indigo-500 transition-all duration-200"
                                    >
                                        {/* 1. Employee ID */}
                                        {visibleColumns.employeeId && (
                                            <td className="px-6 py-4 font-mono font-bold text-[#0969da] dark:text-github-dark-accent">
                                                {emp.user_code}
                                            </td>
                                        )}

                                        {/* 2. Employee Profile */}
                                        {visibleColumns.employee && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                        {emp.profile_image_url ? (
                                                            <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt={emp.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            emp.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                                            {emp.name}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-medium">{emp.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        {/* 3. Role & Dept */}
                                        {visibleColumns.roleDept && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-750 dark:text-slate-350">{emp.designation}</span>
                                                    <span className="text-xs font-semibold text-slate-400">{emp.department}</span>
                                                </div>
                                            </td>
                                        )}

                                        {/* 4. Phone */}
                                        {visibleColumns.phone && (
                                            <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 font-mono">
                                                {emp.phone}
                                            </td>
                                        )}

                                        {/* 5. Shift */}
                                        {visibleColumns.shift && (
                                            <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                                                {emp.shift}
                                            </td>
                                        )}

                                        {/* 6. Geofences */}
                                        {visibleColumns.geofences && (
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {emp.workLocations && emp.workLocations.filter(l => l.is_active).length > 0 ? (
                                                        emp.workLocations.filter(l => l.is_active).map((loc, i) => (
                                                            <span key={i} className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-github-dark-border text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-github-dark-border whitespace-nowrap">
                                                                {loc.loc_name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">Office Bound</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}

                                        {/* 7. Joining Date */}
                                        {visibleColumns.joiningDate && (
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono font-medium">
                                                {profile.joining_date || emp.joiningDate || 'N/A'}
                                            </td>
                                        )}

                                        {/* 8. Reporting Manager */}
                                        {visibleColumns.reportingManager && (
                                            <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">
                                                {profile.reporting_manager}
                                            </td>
                                        )}

                                        {/* 9. Work Location */}
                                        {visibleColumns.workLocation && (
                                            <td className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">
                                                {profile.work_location}
                                            </td>
                                        )}

                                        {/* 10. Address */}
                                        {visibleColumns.address && (
                                            <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 max-w-xs truncate" title={profile.address}>
                                                {profile.address}
                                            </td>
                                        )}

                                        {/* 11. Onboarding Progress */}
                                        {visibleColumns.onboardingProgress && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 min-w-[120px]">
                                                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                progress === 100
                                                                    ? 'bg-emerald-500'
                                                                    : progress > 50
                                                                        ? 'bg-indigo-500'
                                                                        : 'bg-amber-500'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-bold font-mono text-[10px]">{progress}%</span>
                                                </div>
                                            </td>
                                        )}

                                        {/* 12. Actions */}
                                        {visibleColumns.actions && (
                                            <td className="px-6 py-4">
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center justify-center gap-1"
                                                >
                                                    {emp.status === 'Deleted' ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleRestore(e, emp.id)}
                                                                title="Restore Employee"
                                                                className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors"
                                                            >
                                                                <RotateCcw size={15} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleForceDelete(e, emp.id)}
                                                                title="Delete Permanently"
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleToggleStatus(e, emp.id, emp.is_active)}
                                                                title={emp.is_active ? "Deactivate" : "Activate"}
                                                                disabled={emp.designation === 'admin'}
                                                                className={`p-1.5 rounded-lg transition-colors ${
                                                                    emp.designation === 'admin'
                                                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                                                        : emp.is_active
                                                                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                                                                            : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                                                }`}
                                                            >
                                                                {emp.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    handleSelectEmployee(emp);
                                                                    setTimeout(() => setEditMode(true), 150);
                                                                }}
                                                                title="Edit Details"
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>

                                                            <button
                                                                onClick={(e) => handleDelete(e, emp.id)}
                                                                title="Move to Trash"
                                                                disabled={emp.designation === 'admin'}
                                                                className={`p-1.5 rounded-lg transition-colors ${
                                                                    emp.designation === 'admin'
                                                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                                                                }`}
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="12" className="px-6 py-12 text-center text-slate-500 dark:text-github-dark-muted font-medium">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search size={32} className="text-slate-350 dark:text-slate-700" />
                                        <p>No employees found matching the filters.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EmployeeTable;
