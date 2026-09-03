import React from 'react';
import {
    X, Calendar, Settings, ChevronDown, ChevronUp, Clock, Save, Check
} from 'lucide-react';

const Toggle = ({ label, subLabel, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
        <div>
            <p className="text-xs font-medium text-slate-800 dark:text-github-dark-text">{label}</p>
            {subLabel && <p className="text-[10px] text-slate-400 font-normal">{subLabel}</p>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
    </div>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2.5 cursor-pointer py-1.5 group">
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-github-dark-border group-hover:border-indigo-400'}`}
            onClick={onChange}>
            {checked && <Check size={10} className="text-white" strokeWidth={3} />}
        </div>
        <span className="text-xs text-slate-700 dark:text-slate-300 font-normal">{label}</span>
    </label>
);

const ShiftFormDrawer = ({
    editingShift,
    shiftForm,
    setShiftForm,
    onSaveShift,
    onClose,
    isOtEnabled,
    setIsOtEnabled,
    showAdvancedSettings,
    setShowAdvancedSettings,
    toggleRule,
    setRuleTiming,
    otThresholdHr,
    otThresholdMin,
    handleOtThresholdChange,
    otBufferHr,
    otBufferMin,
    handleOtBufferChange,
    otMaxHoursHr,
    otMaxHoursMin,
    handleOtMaxHoursChange
}) => {
    return (
        <>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-github-dark-border">
                <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">
                    {editingShift ? 'Edit Shift' : 'Create New Shift'}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer">
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={onSaveShift} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Shift Name</label>
                    <input
                        type="text" required value={shiftForm.name}
                        onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                        placeholder="e.g. Morning Shift A"
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                    />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">Shift Status</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Toggle active/inactive status in directory</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={shiftForm.is_active} 
                            onChange={e => setShiftForm(p => ({ ...p, is_active: e.target.checked }))} 
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
                        <input type="time" required value={shiftForm.start}
                            onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time</label>
                        <input type="time" required value={shiftForm.end}
                            onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                        />
                    </div>
                </div>

                {/* Working Days */}
                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-4">
                    <div>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text mb-3 flex items-center gap-2">
                            <Calendar size={15} className="text-slate-400" /> Working Days
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                const isSelected = shiftForm.workingDays.includes(day);
                                const hasAlternateOff = shiftForm.weekOffRules.find(r => r.day === day)?.weeks.length > 0;
                                const hasHalfDay = shiftForm.halfDayRules.find(r => r.day === day)?.weeks.length > 0;

                                let buttonClass = "";
                                if (isSelected) {
                                    if (hasHalfDay) {
                                        buttonClass = "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 scale-105 shadow-sm";
                                    } else {
                                        buttonClass = "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 scale-105 shadow-sm";
                                    }
                                } else {
                                    if (hasAlternateOff) {
                                        buttonClass = "bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-black dark:text-amber-400 scale-105 shadow-sm";
                                    } else {
                                        buttonClass = "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100";
                                    }
                                }

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            setShiftForm(prev => {
                                                const newDays = isSelected 
                                                    ? prev.workingDays.filter(d => d !== day)
                                                    : [...prev.workingDays, day];
                                                const newWo = isSelected ? prev.weekOffRules : prev.weekOffRules.filter(r => r.day !== day);
                                                const newHd = isSelected ? prev.halfDayRules.filter(r => r.day !== day) : prev.halfDayRules;
                                                return { ...prev, workingDays: newDays, weekOffRules: newWo, halfDayRules: newHd };
                                            });
                                        }}
                                        className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${buttonClass}`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Color Legends */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-150 dark:border-slate-800 text-[10px] font-medium text-slate-500 dark:text-slate-400 select-none">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                                <span>Full Workday</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                                <span>Half Day</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                                <span>Alternate Off</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                <span>Weekly Off</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="w-full py-3 flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border transition-colors cursor-pointer"
                >
                    <Settings size={16} />
                    {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                    {showAdvancedSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {/* Advanced Settings Section */}
                {showAdvancedSettings && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Grace Period</label>
                                <div className="relative">
                                    <input type="number" required min="0" value={shiftForm.grace}
                                        onChange={e => setShiftForm({ ...shiftForm, grace: e.target.value })}
                                        className="w-full pl-3 pr-14 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">minutes</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 font-normal">Allowed lateness buffer.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Correction Deadline</label>
                                <div className="relative">
                                    <input type="number" required min="1" value={shiftForm.correctionDeadline}
                                        onChange={e => setShiftForm({ ...shiftForm, correctionDeadline: e.target.value })}
                                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">days</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 font-normal">Days to correct missed punches.</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                            <Toggle
                                label="Overtime Calculation" subLabel="Enable automatic OT tracking"
                                checked={isOtEnabled} onChange={e => setIsOtEnabled(e.target.checked)}
                            />
                            {isOtEnabled && (
                                <div className="pt-3 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">OT Threshold</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input type="number" min="0" placeholder="0" value={otThresholdHr || ''}
                                                        onChange={e => handleOtThresholdChange(e.target.value, otThresholdMin)}
                                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">h</span>
                                                </div>
                                                <div className="relative flex-1">
                                                    <input type="number" min="0" max="59" step="5" placeholder="0" value={otThresholdMin || ''}
                                                        onChange={e => handleOtThresholdChange(otThresholdHr, e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">m</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 font-normal">Standard duration to start OT.</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Buffer Window</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input type="number" min="0" placeholder="0" value={otBufferHr || ''}
                                                        onChange={e => handleOtBufferChange(e.target.value, otBufferMin)}
                                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">h</span>
                                                </div>
                                                <div className="relative flex-1">
                                                    <input type="number" min="0" max="59" step="5" placeholder="0" value={otBufferMin || ''}
                                                        onChange={e => handleOtBufferChange(otBufferHr, e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">m</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 font-normal">Grace before OT is counted.</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Maximum Overtime Cap</label>
                                        <div className="flex gap-2 max-w-[240px]">
                                            <div className="relative flex-1">
                                                <input type="number" min="0" placeholder="0" value={otMaxHoursHr || ''}
                                                    onChange={e => handleOtMaxHoursChange(e.target.value, otMaxHoursMin)}
                                                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">h</span>
                                            </div>
                                            <div className="relative flex-1">
                                                <input type="number" min="0" max="59" step="5" placeholder="0" value={otMaxHoursMin || ''}
                                                    onChange={e => handleOtMaxHoursChange(otMaxHoursHr, e.target.value)}
                                                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">m</span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Max OT duration credited per shift.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Alternate Weekoffs & Half Days Configuration */}
                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-4">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                <Calendar size={15} className="text-slate-400" /> Alternate Schedule Rules
                            </h4>

                            {/* Half Days */}
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-500 mb-3 flex items-center gap-2">
                                    <Clock size={14} /> Half Days
                                </h4>
                                <div className="space-y-4">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                        const rule = shiftForm.halfDayRules.find(r => r.day === day) || { weeks: [] };
                                        const hasHalfDays = rule.weeks.length > 0;
                                        return (
                                            <div key={day} className="flex flex-col gap-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 text-xs font-semibold text-slate-500 dark:text-slate-400">{day}</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[1, 2, 3, 4, 5].map(week => {
                                                            const isHalf = rule.weeks.includes(week);
                                                            return (
                                                                <button
                                                                    key={week} type="button"
                                                                    onClick={() => toggleRule(day, 'halfDayRules', week)}
                                                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer ${isHalf ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/50 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                                                                >
                                                                    {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                {hasHalfDays && (
                                                    <div className="ml-14 flex items-center gap-2 text-xs bg-white dark:bg-slate-800 p-2 rounded border border-blue-100 dark:border-blue-900/30">
                                                        <span className="text-slate-500 font-normal">Timing:</span>
                                                        <input 
                                                            type="time" 
                                                            value={rule.timing?.start_time || shiftForm.start}
                                                            onChange={e => setRuleTiming(day, 'halfDayRules', 'start_time', e.target.value)}
                                                            className="px-1.5 py-0.5 border rounded bg-slate-50 dark:bg-slate-700 text-xs font-normal"
                                                        />
                                                        <span className="text-slate-400">→</span>
                                                        <input 
                                                            type="time" 
                                                            value={rule.timing?.end_time || shiftForm.end}
                                                            onChange={e => setRuleTiming(day, 'halfDayRules', 'end_time', e.target.value)}
                                                            className="px-1.5 py-0.5 border rounded bg-slate-50 dark:bg-slate-700 text-xs font-normal"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Alternate Offs */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-500 mb-3 flex items-center gap-2">
                                    <Calendar size={14} /> Alternate Offs
                                </h4>
                                <div className="space-y-3">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                        const rule = shiftForm.weekOffRules.find(r => r.day === day) || { weeks: [] };
                                        return (
                                            <div key={day} className="flex items-center gap-4">
                                                <div className="w-14 text-xs font-semibold text-slate-500 dark:text-slate-400">{day}</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[1, 2, 3, 4, 5].map(week => {
                                                        const isOff = rule.weeks.includes(week);
                                                        return (
                                                            <button
                                                                key={week} type="button"
                                                                onClick={() => toggleRule(day, 'weekOffRules', week)}
                                                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer ${isOff ? 'bg-amber-100 border-amber-300 text-black dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                                                            >
                                                                {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Punch In / Out Verification */}
                        <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-3">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-github-dark-text">Verification Requirements</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Check-In</p>
                                    <Checkbox label="Selfie Required" checked={shiftForm.reqEntrySelfie} onChange={() => setShiftForm(p => ({ ...p, reqEntrySelfie: !p.reqEntrySelfie }))} />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Check-Out</p>
                                    <Checkbox label="Selfie Required" checked={shiftForm.reqExitSelfie} onChange={() => setShiftForm(p => ({ ...p, reqExitSelfie: !p.reqExitSelfie }))} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button type="submit"
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Save size={15} /> Save Shift
                    </button>
                </div>
            </form>
        </>
    );
};

export default ShiftFormDrawer;
