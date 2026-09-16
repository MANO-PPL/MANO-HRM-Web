import React from 'react';
import { Sliders } from 'lucide-react';

const ColumnCustomizerDrawer = ({
    showColumnCustomizer,
    setShowColumnCustomizer,
    visibleColumns,
    toggleColumn,
    resetColumnsToDefault
}) => {
    return (
        <div className="relative w-full sm:w-auto">
            <button
                onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold w-full sm:w-auto transition-all ${
                    showColumnCustomizer
                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-400 text-indigo-600 dark:text-indigo-400'
                        : 'bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-100'
                }`}
            >
                <Sliders size={14} />
                <span>Customize Columns</span>
            </button>

            {/* Column customizer popover box */}
            {showColumnCustomizer && (
                <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowColumnCustomizer(false)} />
                    <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl p-4 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-github-dark-border">
                            <span className="font-bold text-xs text-slate-700 dark:text-github-dark-text">Toggle Columns</span>
                            <button
                                onClick={resetColumnsToDefault}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Reset Default
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1">Default columns</span>
                            {[
                                { key: 'employee', label: 'Employee Profile' },
                                { key: 'roleDept', label: 'Role & Dept' },
                                { key: 'shift', label: 'Work Shift' },
                                { key: 'geofences', label: 'Allowed Geofences' },
                                { key: 'joiningDate', label: 'Joining Date' },
                                { key: 'onboardingProgress', label: 'Onboarding Progress' },
                                { key: 'actions', label: 'Row Actions' }
                            ].map(col => (
                                <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-slate-600 dark:text-github-dark-text">
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns[col.key]}
                                        onChange={() => toggleColumn(col.key)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5"
                                    />
                                    <span>{col.label}</span>
                                </label>
                            ))}

                            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400 mt-3 mb-1">Optional Extras</span>
                            {[
                                { key: 'employeeId', label: 'Employee ID' },
                                { key: 'phone', label: 'Phone Number' },
                                { key: 'reportingManager', label: 'Reporting Manager' },
                                { key: 'workLocation', label: 'Work Location' },
                                { key: 'address', label: 'Home Address' }
                            ].map(col => (
                                <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-slate-600 dark:text-github-dark-muted">
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns[col.key]}
                                        onChange={() => toggleColumn(col.key)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5"
                                    />
                                    <span>{col.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ColumnCustomizerDrawer;
