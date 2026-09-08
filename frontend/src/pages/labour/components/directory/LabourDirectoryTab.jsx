import React from 'react';
import { Info, Building, Calendar, Edit2, Trash2 } from 'lucide-react';

const LabourDirectoryTab = ({
    labours,
    labourSearch,
    labourRoleFilter,
    labourSiteFilter,
    sites,
    handleViewHistory,
    handleOpenScheduleModal,
    handleEditLabour,
    handleDeleteLabour
}) => {
    return (
        <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-[#161b22] text-slate-500 dark:text-[#8b949e] font-medium border-b border-slate-200 dark:border-[#30363d]">
                            <th className="p-3">Labour Name</th>
                            <th className="p-3">Phone Number</th>
                            <th className="p-3">Gender</th>
                            <th className="p-3">Role / Designation</th>
                            <th className="p-3">Daily Wage</th>
                            <th className="p-3">OT Pay / hr</th>
                            <th className="p-3">Assigned Site</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labours
                            .filter(lab => {
                                const matchesSearch = lab.name.toLowerCase().includes(labourSearch.toLowerCase());
                                const matchesRole = !labourRoleFilter || lab.role.toLowerCase() === labourRoleFilter.toLowerCase();

                                let matchesSite = true;
                                if (labourSiteFilter === 'Unassigned') {
                                    const hasNoSites = (!lab.site_ids || lab.site_ids.length === 0) && lab.site_id === null;
                                    matchesSite = hasNoSites;
                                } else if (labourSiteFilter !== 'All') {
                                    const siteIdNum = Number(labourSiteFilter);
                                    matchesSite = (lab.site_ids && Array.isArray(lab.site_ids) && lab.site_ids.includes(siteIdNum)) ||
                                        lab.site_id === siteIdNum;
                                }

                                return matchesSearch && matchesRole && matchesSite;
                            })
                            .map(lab => (
                                <tr key={lab.labour_id} className="border-b border-slate-100 dark:border-[#21262d] hover:bg-slate-50/50 dark:hover:bg-[#161b22]/50">
                                    <td className="p-3 font-semibold text-slate-800 dark:text-[#f0f6fc] cursor-pointer hover:text-indigo-600 dark:hover:text-[#58a6ff]" onClick={() => handleViewHistory(lab)}>
                                        <div className="flex items-center gap-1.5">
                                            <span>{lab.name}</span>
                                            <Info size={12} className="text-slate-400 dark:text-[#8b949e]" />
                                        </div>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-[#8b949e] font-mono">{lab.phone || 'No phone'}</td>
                                    <td className="p-3 text-slate-600 dark:text-[#8b949e]">{lab.sex}</td>
                                    <td className="p-3 text-slate-600 dark:text-[#8b949e]">{lab.role}</td>
                                    <td className="p-3 font-medium text-slate-700 dark:text-[#c9d1d9]">
                                        ₹{Number(lab.monthly_salary).toLocaleString()}
                                    </td>
                                    <td className="p-3 font-medium text-slate-700 dark:text-[#c9d1d9]">
                                        ₹{Number(lab.overtime_pay_per_hour || 0).toLocaleString()}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-[#8b949e]">
                                        {(() => {
                                            const assignedSites = lab.site_ids && Array.isArray(lab.site_ids) && lab.site_ids.length > 0
                                                ? lab.site_ids.map(sid => {
                                                    const found = sites.find(s => s.site_id === sid);
                                                    return found ? found.site_name : null;
                                                }).filter(Boolean)
                                                : (lab.site_name ? [lab.site_name] : []);

                                            if (assignedSites.length === 0) {
                                                return <span className="text-amber-500 italic">Unassigned</span>;
                                            }
                                            return (
                                                <div className="flex flex-wrap gap-1">
                                                    {assignedSites.map((sn, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] text-[10px] font-medium border border-transparent dark:border-[#30363d]/50">
                                                            <Building size={10} className="text-slate-400 dark:text-[#8b949e]" />
                                                            {sn}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenScheduleModal(lab)}
                                                title="Plan Daily Schedule"
                                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-[#21262d] text-indigo-500 dark:text-indigo-400 rounded border border-slate-200 dark:border-[#30363d] transition-colors"
                                            >
                                                <Calendar size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleEditLabour(lab)}
                                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-[#21262d] text-slate-500 dark:text-[#8b949e] hover:text-slate-800 dark:hover:text-[#f0f6fc] rounded border border-slate-200 dark:border-[#30363d] transition-colors"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLabour(lab.labour_id)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-955/20 text-red-500 rounded border border-slate-200 dark:border-[#30363d] transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LabourDirectoryTab;
