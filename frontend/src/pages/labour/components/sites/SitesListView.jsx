import React from 'react';
import { Building, Users, Edit2, Trash2 } from 'lucide-react';

const SitesListView = ({
    sites,
    labours,
    siteSearch,
    setSelectedSite,
    handleEditSite,
    handleDeleteSite
}) => {
    return (
        <div className="space-y-3 animate-in fade-in duration-200">
            {/* Sites Table */}
            <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
                {sites.length === 0 ? (
                    <div className="border border-dashed border-slate-300 dark:border-github-dark-border rounded-xl p-10 text-center m-4">
                        <Building className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                        <h4 className="text-xs font-bold text-slate-500">No Construction Sites Found</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Create a site first to start assigning labour forces.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-github-dark-border/40 text-slate-500 dark:text-github-dark-muted font-bold border-b border-slate-200 dark:border-github-dark-border">
                                <th className="p-3">Site Name</th>
                                <th className="p-3">Location</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Workers Assigned</th>
                                <th className="p-3">Created On</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sites
                                .filter(site => !siteSearch || site.site_name.toLowerCase().includes(siteSearch.toLowerCase()) || (site.location_details && site.location_details.toLowerCase().includes(siteSearch.toLowerCase())))
                                .map(site => {
                                    const assignedCount = labours.filter(l =>
                                        (l.site_ids && Array.isArray(l.site_ids) && l.site_ids.includes(site.site_id)) ||
                                        l.site_id === site.site_id
                                    ).length;
                                    return (
                                        <tr
                                            key={site.site_id}
                                            onClick={() => setSelectedSite(site)}
                                            className="border-b border-slate-100 dark:border-github-dark-border/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shrink-0">
                                                        <Building size={13} className="text-indigo-500" />
                                                    </div>
                                                    <span className="font-bold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {site.site_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-slate-500 dark:text-github-dark-muted max-w-[200px]">
                                                <span className="line-clamp-1">{site.location_details || <span className="italic text-slate-400">No details</span>}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${site.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                        : site.status === 'Completed'
                                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                    {site.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                                    <Users size={11} />
                                                    {assignedCount}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-400 dark:text-github-dark-muted">
                                                {new Date(site.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditSite(site); }}
                                                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-github-dark-border transition-colors"
                                                        title="Edit site"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.site_id); }}
                                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded border border-slate-200 dark:border-github-dark-border transition-colors"
                                                        title="Delete site"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SitesListView;
