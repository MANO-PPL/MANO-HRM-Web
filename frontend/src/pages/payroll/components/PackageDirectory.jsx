import React from 'react';
import { Layers, Settings, Plus, Search, Users } from 'lucide-react';

const PackageDirectory = ({
    packages = [],
    filteredPackages = [],
    selectedPackage,
    setSelectedPackage,
    isLoadingPackages = false,
    packageSearch = '',
    setPackageSearch,
    employees = [],
    onOpenSettings,
    onOpenCreatePackage
}) => {
    return (
        <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-sm">
                        <Layers size={16} className="text-indigo-500" />
                        <span>Salary Packages</span>
                    </h3>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onOpenSettings}
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Global Payroll LOP Settings"
                        >
                            <Settings size={16} />
                        </button>
                        <button
                            onClick={onOpenCreatePackage}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                            title="Create new package"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search packages..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        value={packageSearch}
                        onChange={e => setPackageSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                {isLoadingPackages && (
                    <div className="py-10 text-center text-slate-400 text-xs font-normal">Loading packages...</div>
                )}
                {!isLoadingPackages && filteredPackages.length === 0 && (
                    <div className="py-10 text-center space-y-2">
                        <Layers size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="text-xs text-slate-400 font-normal">No packages found</p>
                        <button
                            onClick={onOpenCreatePackage}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                            + Create first package
                        </button>
                    </div>
                )}
                {filteredPackages.map(pkg => (
                    <div
                        key={pkg.package_group_id}
                        onClick={() => setSelectedPackage(pkg)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer group ${selectedPackage?.package_group_id === pkg.package_group_id
                            ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                            : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${pkg.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                <h4 className={`font-semibold text-sm ${selectedPackage?.package_group_id === pkg.package_group_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                    {pkg.package_name}
                                </h4>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pkg.is_active ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {pkg.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-github-dark-muted font-semibold mb-2">
                            ₹{Number(pkg.active_rate?.gross_salary || 0).toLocaleString('en-IN')}/mo
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-github-dark-muted font-normal">
                            <span className="flex items-center gap-1">
                                <Users size={10} />
                                {employees.filter(e => e.package_group_id === pkg.package_group_id).length} Staff
                            </span>
                            {pkg.active_rate?.overtime_enabled === 1 && (
                                <span className="text-indigo-500 font-medium bg-indigo-50 dark:bg-indigo-900/20 px-1 rounded">OT Enabled</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PackageDirectory;
