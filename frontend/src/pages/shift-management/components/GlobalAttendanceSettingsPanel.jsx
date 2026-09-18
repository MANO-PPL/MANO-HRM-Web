import React from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

/**
 * Org-wide (not per-shift) attendance/timing settings. Currently holds just the threshold-based
 * half-day policy, but is meant to be the home for any future org-wide timing/attendance setting
 * — add a new section (bordered card + its own controls) below the existing one, following the
 * same pattern, rather than starting a new panel elsewhere.
 */
const GlobalAttendanceSettingsPanel = ({
    settingsForm,
    setSettingsForm,
    onSubmit,
    onClose,
    isSaving = false
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/20">
                <div className="flex items-center gap-2">
                    <Settings className="text-indigo-500" size={18} />
                    <h3 className="font-semibold text-slate-900 dark:text-github-dark-text text-base">Global Attendance Settings</h3>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">

                {/* ── Section: Org-Wide Half-Day Threshold ────────────────────────────── */}
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 rounded-xl space-y-1">
                    <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Half-Day Threshold
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted leading-relaxed font-normal">
                        Automatically mark a day as Half Day if arrival/departure falls outside these times. Only ever applies on a normal working day — never overrides a shift's own half-day or week-off rules.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                            Enable threshold-based Half Day
                        </label>
                        <button
                            type="button"
                            onClick={() => setSettingsForm({ ...settingsForm, halfDayThresholdEnabled: !settingsForm.halfDayThresholdEnabled })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${settingsForm.halfDayThresholdEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settingsForm.halfDayThresholdEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {settingsForm.halfDayThresholdEnabled && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Half Day if arrival after
                                </label>
                                <input
                                    type="time"
                                    value={settingsForm.halfDayLateAfterTime || ''}
                                    onChange={e => setSettingsForm({ ...settingsForm, halfDayLateAfterTime: e.target.value || null })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 font-normal">Leave blank to disable this specific rule.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Half Day if leaves before
                                </label>
                                <input
                                    type="time"
                                    value={settingsForm.halfDayEarlyBeforeTime || ''}
                                    onChange={e => setSettingsForm({ ...settingsForm, halfDayEarlyBeforeTime: e.target.value || null })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 font-normal">Leave blank to disable this specific rule.</p>
                            </div>
                        </>
                    )}
                </div>
                {/* ── End section: Half-Day Threshold ─────────────────────────────────── */}

                {/* Future org-wide timing/attendance settings: add a new section here, above the
                    Save/Cancel buttons, following the same bordered-card + controls pattern. */}

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-github-dark-text rounded-lg transition-all cursor-pointer"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>Save Settings</span>
                        )}
                    </button>
                </div>
            </form>
        </>
    );
};

export default GlobalAttendanceSettingsPanel;
