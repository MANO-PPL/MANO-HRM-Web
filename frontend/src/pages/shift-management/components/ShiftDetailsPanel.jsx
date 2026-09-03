import React from 'react';
import {
    Clock, Edit2, ArrowRight, AlertTriangle, FileClock,
    Calendar, MapPin, Check, X, Zap
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { toast } from 'react-toastify';
import { parsePolicy } from '../../../utils/weekOffPolicy';

const ShiftDetailsPanel = ({
    selectedShift,
    calculateDuration,
    loadShifts,
    onEditShift,
    formatDecimalHours,
    DEFAULT_MAX_OT_HOURS = 3
}) => {
    if (!selectedShift) return null;

    return (
        <div data-tour-id="shift-detail-pane" className="flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-base text-slate-900 dark:text-github-dark-text">{selectedShift.name}</h2>
                        <p className="text-xs text-slate-500 font-mono font-normal">{selectedShift.start} → {selectedShift.end} • {calculateDuration(selectedShift.start, selectedShift.end)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Inline Status Toggle */}
                    <div className="flex items-center gap-2 border border-slate-200 dark:border-github-dark-border rounded-xl px-3 py-1.5 bg-slate-50 dark:bg-slate-800/30 text-xs font-medium select-none">
                        <span className="text-slate-600 dark:text-slate-350">Active</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={!!selectedShift.is_active} 
                                onChange={async (e) => {
                                    const newActive = e.target.checked;
                                    try {
                                        const updatedPolicy = {
                                            ...selectedShift.policy_rules,
                                            is_active: newActive
                                        };
                                        await adminService.updateShift(selectedShift.id, { 
                                            shift_name: selectedShift.name, 
                                            is_active: newActive, 
                                            policy_rules: updatedPolicy 
                                        });
                                        toast.success(newActive ? 'Shift activated successfully' : 'Shift deactivated successfully');
                                        loadShifts();
                                    } catch (err) {
                                        toast.error(err.message || 'Failed to toggle status');
                                    }
                                }} 
                            />
                            <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <button
                        onClick={() => onEditShift(selectedShift)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                        <Edit2 size={14} /> Edit
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                    {(() => {
                        const cardStyles = {
                            indigo: {
                                bg: 'from-indigo-50/40 to-white dark:from-indigo-950/15 dark:to-github-dark-card border-indigo-100/80 dark:border-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-indigo-500/5',
                                iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/20',
                                label: 'text-indigo-600 dark:text-indigo-400 font-semibold',
                            },
                            amber: {
                                bg: 'from-amber-50/40 to-white dark:from-amber-950/15 dark:to-github-dark-card border-amber-100/80 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-amber-500/5',
                                iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/20',
                                label: 'text-amber-700 dark:text-amber-400 font-semibold',
                            },
                            rose: {
                                bg: 'from-rose-50/40 to-white dark:from-rose-950/15 dark:to-github-dark-card border-rose-100/80 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-rose-500/5',
                                iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/20',
                                label: 'text-rose-600 dark:text-rose-400 font-semibold',
                            },
                            teal: {
                                bg: 'from-teal-50/40 to-white dark:from-teal-950/15 dark:to-github-dark-card border-teal-100/80 dark:border-teal-900/30 hover:border-teal-300 dark:hover:border-teal-800 hover:shadow-teal-500/5',
                                iconBg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/20',
                                label: 'text-teal-600 dark:text-teal-400 font-semibold',
                            }
                        };

                        return [
                            { label: 'Start Time', value: selectedShift.start, icon: <ArrowRight size={16} />, bg: 'indigo' },
                            { label: 'Grace Period', value: `${selectedShift.grace || 0} min`, icon: <AlertTriangle size={16} />, bg: 'amber' },
                            { label: 'Correction Window', value: `${selectedShift.correctionDeadline || 2}d`, icon: <FileClock size={16} />, bg: 'rose' },
                            { label: 'Duration', value: calculateDuration(selectedShift.start, selectedShift.end), icon: <Clock size={16} />, bg: 'teal' },
                        ].map(card => {
                            const styles = cardStyles[card.bg];
                            return (
                                <div
                                    key={card.label}
                                    className={`bg-gradient-to-br ${styles.bg} border rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                                >
                                    <div className={`p-2.5 rounded-xl border flex items-center justify-center ${styles.iconBg}`}>
                                        {card.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-[10px] uppercase tracking-wider ${styles.label} break-words`}>{card.label}</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-github-dark-text font-mono mt-0.5 leading-tight truncate">{card.value}</p>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>

                {/* Work Days Display */}
                <div className="bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-100 dark:border-github-dark-border/50 rounded-xl p-4 flex gap-6">
                    {(() => {
                        const rules = selectedShift.policy_rules || {};
                        const parsedRules = parsePolicy(rules.week_off_policy || rules.week_off || []);
                        const activeDays = parsedRules.workingDays.length > 0 ? parsedRules.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        
                        return (
                            <div className="w-full">
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar size={15} className="text-indigo-500" />
                                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Weekly Schedule & Holidays</h4>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                                        const isWork = activeDays.includes(d);
                                        const isHalf = parsedRules.halfDayRules.some(r => r.day === d);
                                        return (
                                            <div key={d} className={`px-3 py-2 rounded-xl border flex flex-col items-center min-w-[56px] transition-all ${
                                                isWork 
                                                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400' 
                                                    : 'bg-slate-50 dark:bg-slate-800/30 border-slate-150 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                                            }`}>
                                                <span className="text-xs font-semibold">{d}</span>
                                                <span className="text-[8px] font-medium uppercase tracking-widest mt-1">
                                                    {isHalf ? 'Half' : isWork ? 'Work' : 'Off'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Alternate Weekoffs & Half Days Info */}
                                <div className="space-y-2 mt-3">
                                    {parsedRules.weekOffRules.length > 0 && (
                                        <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-xl p-3 flex gap-2 items-center">
                                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                            <p className="text-xs text-slate-600 dark:text-github-dark-muted font-normal">
                                                Custom Week Offs: {parsedRules.weekOffRules.map(r => `${r.weeks.map(w => w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : w === 4 ? '4th' : '5th').join('/')} ${r.day}s`).join(', ')}
                                            </p>
                                        </div>
                                    )}

                                    {parsedRules.halfDayRules.length > 0 && (
                                        <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-xl p-3 flex flex-col gap-2">
                                            <div className="flex gap-2 items-center">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                <p className="text-xs font-semibold text-slate-600 dark:text-github-dark-muted">
                                                    Half Day Schedules & Timings:
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1.5 mt-1">
                                                {parsedRules.halfDayRules.map((rule, idx) => {
                                                    const weeksStr = rule.weeks.map(w => w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : w === 4 ? '4th' : '5th').join('/');
                                                    const start = rule.timing?.start_time ? rule.timing.start_time.substring(0, 5) : (selectedShift.start ? selectedShift.start.substring(0, 5) : '09:00');
                                                    const end = rule.timing?.end_time ? rule.timing.end_time.substring(0, 5) : (selectedShift.end ? selectedShift.end.substring(0, 5) : '13:00');
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between text-xs text-slate-600 dark:text-github-dark-muted font-normal">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 flex justify-center">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                                </div>
                                                                <span>{rule.day} ({weeksStr} Week)</span>
                                                            </div>
                                                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                                                {start} → {end}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Policies Display */}
                <div className="grid grid-cols-2 gap-6">
                    <div data-tour-id="shift-detail-policies" className="bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin size={16} className="text-indigo-500" />
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Punch In Rules</h4>
                        </div>
                        <div className="space-y-2">
                            {[
                                { label: 'Selfie Required', val: selectedShift.policy_rules?.entry_requirements?.selfie },
                            ].map(r => (
                                <div key={r.label} className="flex items-center gap-2 py-1">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                        {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                    </div>
                                    <span className="text-xs text-slate-600 dark:text-github-dark-muted font-normal">{r.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin size={16} className="text-indigo-500" />
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Punch Out Rules</h4>
                        </div>
                        <div className="space-y-2">
                            {[
                                { label: 'Selfie Required', val: selectedShift.policy_rules?.exit_requirements?.selfie },
                            ].map(r => (
                                <div key={r.label} className="flex items-center gap-2 py-1">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                        {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                    </div>
                                    <span className="text-xs text-slate-600 dark:text-github-dark-muted font-normal">{r.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {selectedShift.overtime && (
                    <div className="p-4 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400"><Zap size={16} /></div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Overtime enabled after {formatDecimalHours(selectedShift.otThreshold)}</span>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                                {selectedShift.otBuffer > 0 && (
                                    <span className="text-[10px] text-slate-500 font-normal">Buffer grace period: {formatDecimalHours(selectedShift.otBuffer)}</span>
                                )}
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Max Overtime limit: {formatDecimalHours(Number.isFinite(selectedShift.otMaxHours) ? selectedShift.otMaxHours : DEFAULT_MAX_OT_HOURS)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShiftDetailsPanel;
