import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Plus,
    Clock,
    MoreVertical,
    Zap,
    AlertTriangle,
    X,
    Sun,
    Moon,
    Hourglass,
    XCircle,
    CheckCircle2,
    Settings2,
    Calendar,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Save,
    Trash2,
    MapPin,
    ArrowRight,
    FileClock,
    Users
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { buildPolicy, parsePolicy } from '../../utils/weekOffPolicy';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const ShiftManagement = () => {
    const { avatarTimestamp } = useAuth();
    
    // Data State
    const [shifts, setShifts] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Modal States
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Create/Edit Shift Form State
    const [newShiftName, setNewShiftName] = useState('');
    const [newStartTime, setNewStartTime] = useState('09:00');
    const [newEndTime, setNewEndTime] = useState('18:00');
    const [newGracePeriod, setNewGracePeriod] = useState('0');
    const [newOvertime, setNewOvertime] = useState(false);
    const [newOtThreshold, setNewOtThreshold] = useState('8.0');
    const [newOtBuffer, setNewOtBuffer] = useState('0.5');
    const [newCorrectionDeadline, setNewCorrectionDeadline] = useState('2');
    const [newValCheckInGps, setNewValCheckInGps] = useState(true);
    const [newValCheckInSelfie, setNewValCheckInSelfie] = useState(true);
    const [newValCheckOutGps, setNewValCheckOutGps] = useState(false);
    const [newValCheckOutSelfie, setNewValCheckOutSelfie] = useState(false);
    const [newWorkingDays, setNewWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    const [newWeekOffRules, setNewWeekOffRules] = useState([]);
    const [newHalfDayRules, setNewHalfDayRules] = useState([]);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // Helpers
    const calculateDuration = (start, end) => {
        if (!start || !end) return '0h 00m';
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m`;
    };

    const loadShifts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminService.getShifts();
            if (res.shifts) {
                const mapped = res.shifts.map((s) => ({
                    id: s.shift_id,
                    name: s.shift_name,
                    startTime: (s.start_time || '09:00').substring(0, 5),
                    endTime: (s.end_time || '18:00').substring(0, 5),
                    gracePeriod: s.grace_period_mins || 0,
                    overtime: !!s.is_overtime_enabled,
                    otThreshold: parseFloat(s.overtime_threshold_hours || 8.0),
                    otBuffer: parseFloat(s.overtime_buffer_hours ?? s.policy_rules?.overtime?.buffer ?? 0.5),
                    correctionDeadline: parseInt(s.policy_rules?.correction_deadline ?? 2),
                    color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                    policy_rules: s.policy_rules || {},
                    type: 'Shift'
                }));
                setShifts(mapped);
                setSelectedShift(prev => {
                    if (!prev) return null;
                    const updated = mapped.find(s => s.id === prev.id);
                    return updated || prev;
                });
            }
        } catch (e) {
            toast.error('Failed to load shifts');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await adminService.getShiftUsers();
            if (res.ok) setUsers(res.users);
        } catch (e) {
            toast.error('Failed to load users');
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        loadShifts();
        loadUsers();
    }, [loadShifts, loadUsers]);

    const handleOpenViewModal = (shift) => {
        setSelectedShift(shift);
        setIsViewModalOpen(true);
    };

    const handleOpenAddModal = () => {
        setIsEditing(false);
        setNewShiftName('');
        setNewStartTime('09:00');
        setNewEndTime('18:00');
        setNewGracePeriod('0');
        setNewOvertime(false);
        setNewOtThreshold('8.0');
        setNewOtBuffer('0.5');
        setNewCorrectionDeadline('2');
        setNewValCheckInGps(true);
        setNewValCheckInSelfie(true);
        setNewValCheckOutGps(false);
        setNewValCheckOutSelfie(false);
        setNewWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
        setNewWeekOffRules([]);
        setNewHalfDayRules([]);
        setShowAdvancedSettings(false);
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = () => {
        if (!selectedShift) return;
        setIsEditing(true);
        const rules = selectedShift.policy_rules || {};
        const parsed = parsePolicy(rules.week_off_policy || rules.week_off || []);

        setNewShiftName(selectedShift.name);
        setNewStartTime(selectedShift.startTime);
        setNewEndTime(selectedShift.endTime);
        setNewGracePeriod(selectedShift.gracePeriod.toString());
        setNewOvertime(selectedShift.overtime);
        setNewOtThreshold(selectedShift.otThreshold.toString());
        setNewOtBuffer(selectedShift.otBuffer.toString());
        setNewCorrectionDeadline(selectedShift.correctionDeadline.toString());
        setNewValCheckInGps(rules.entry_requirements?.geofence ?? true);
        setNewValCheckInSelfie(rules.entry_requirements?.selfie ?? true);
        setNewValCheckOutGps(rules.exit_requirements?.geofence ?? false);
        setNewValCheckOutSelfie(rules.exit_requirements?.selfie ?? false);
        setNewWorkingDays(parsed.workingDays.length > 0 ? parsed.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
        setNewWeekOffRules(parsed.weekOffRules);
        setNewHalfDayRules(parsed.halfDayRules);
        setShowAdvancedSettings(false);
        setIsViewModalOpen(false);
        setIsAddModalOpen(true);
    };

    const toggleRule = (day, ruleType, week) => {
        const setFn = ruleType === 'weekOffRules' ? setNewWeekOffRules : setNewHalfDayRules;
        setFn(prev => {
            const rules = [...prev];
            const existingIdx = rules.findIndex(r => r.day === day);
            if (existingIdx >= 0) {
                const rule = rules[existingIdx];
                const weeks = rule.weeks.includes(week)
                    ? rule.weeks.filter(w => w !== week)
                    : [...rule.weeks, week];
                if (weeks.length === 0) rules.splice(existingIdx, 1);
                else rules[existingIdx] = { ...rule, weeks };
            } else {
                rules.push({ day, weeks: [week] });
            }
            return rules;
        });
    };

    const setRuleTiming = (day, ruleType, field, value) => {
        const setFn = ruleType === 'weekOffRules' ? setNewWeekOffRules : setNewHalfDayRules;
        setFn(prev => {
            const rules = [...prev];
            const existingIdx = rules.findIndex(r => r.day === day);
            if (existingIdx >= 0) {
                const rule = rules[existingIdx];
                rules[existingIdx] = {
                    ...rule,
                    timing: {
                        ...(rule.timing || { start_time: newStartTime, end_time: newEndTime }),
                        [field]: value
                    }
                };
            }
            return rules;
        });
    };

    const handleSaveShift = async () => {
        const baseRules = isEditing ? (selectedShift.policy_rules || {}) : {};
        const week_off_policy = buildPolicy(newWorkingDays, newWeekOffRules, newHalfDayRules);
        const policies = {
            ...baseRules,
            shift_timing: { start_time: newStartTime, end_time: newEndTime },
            grace_period: { minutes: parseInt(newGracePeriod) || 0 },
            overtime: { enabled: newOvertime, threshold: parseFloat(newOtThreshold) || 0, buffer: parseFloat(newOtBuffer) || 0 },
            correction_deadline: parseInt(newCorrectionDeadline) || 2,
            entry_requirements: { selfie: newValCheckInSelfie, geofence: newValCheckInGps },
            exit_requirements: { selfie: newValCheckOutSelfie, geofence: newValCheckOutGps },
            week_off_policy
        };

        try {
            if (isEditing) {
                await adminService.updateShift(selectedShift.id, { shift_name: newShiftName, policy_rules: policies });
                toast.success('Shift updated');
            } else {
                await adminService.createShift({ shift_name: newShiftName, policy_rules: policies });
                toast.success('Shift created');
            }
            setIsAddModalOpen(false);
            setIsEditing(false);
            loadShifts();
        } catch (err) {
            toast.error(err.message || 'Failed to save shift');
        }
    };

    const handleDeleteShift = async (shiftId) => {
        if (!window.confirm('Are you sure you want to delete this shift?')) return;
        try {
            await adminService.deleteShift(shiftId);
            toast.success('Shift deleted');
            setIsViewModalOpen(false);
            loadShifts();
        } catch (err) {
            toast.error(err.message || 'Failed to delete shift');
        }
    };

    return (
        <MobileDashboardLayout title="Shift Management">
            <div className="px-2 pb-24 pt-2 space-y-4">
                {/* Header Stats / Info Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-github-dark-border flex justify-between items-center bg-gradient-to-br from-white to-slate-50/50 dark:from-dark-card dark:to-github-dark-subtle/30">
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800 dark:text-github-dark-text tracking-tight">Active Shifts</h2>
                        <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-medium mt-0.5">Total {shifts.length} configured shifts</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-90 transition-all"
                    >
                        <Plus size={22} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Shifts List - High Density Grid */}
                <div className="grid grid-cols-1 gap-3">
                    {shifts.map((shift) => (
                        <div
                            key={shift.id}
                            onClick={() => handleOpenViewModal(shift)}
                            className="group bg-white dark:bg-dark-card rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-github-dark-border relative cursor-pointer active:scale-[0.98] transition-all overflow-hidden"
                        >
                            {/* Accent line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${shift.color.split(' ')[2]} opacity-70`}></div>

                            <div className="flex items-center gap-3">
                                {/* Icon/Avatar Area */}
                                <div className={`w-11 h-11 rounded-xl ${shift.color} flex items-center justify-center shrink-0 shadow-sm`}>
                                    <Clock size={20} strokeWidth={2.5} />
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-800 dark:text-github-dark-text text-[14px] truncate tracking-tight">{shift.name}</h3>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted border border-slate-200/50 dark:border-github-dark-border uppercase tracking-wider">{shift.type}</span>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1.5">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={10} className="text-slate-400" />
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text font-mono">{shift.startTime} - {shift.endTime}</span>
                                        </div>
                                        <div className="h-3 w-[1px] bg-slate-200 dark:bg-github-dark-border"></div>
                                        <div className="flex items-center gap-1">
                                            <AlertTriangle size={10} className="text-amber-500" />
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">{shift.gracePeriod}m</span>
                                        </div>
                                        {shift.overtime && (
                                            <>
                                                <div className="h-3 w-[1px] bg-slate-200 dark:bg-github-dark-border"></div>
                                                <div className="flex items-center gap-1">
                                                    <Zap size={10} className="text-indigo-500" />
                                                    <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-tighter">OT</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <ChevronRight size={18} className="text-slate-300 dark:text-github-dark-muted group-hover:text-indigo-500 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Sheet: View Shift Details */}
            {isViewModalOpen && selectedShift && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsViewModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-white dark:bg-dark-card w-full rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 border-t border-slate-200/50 dark:border-github-dark-border"
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                            </div>

                            <div className="p-6 pt-2">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl ${selectedShift.color} flex items-center justify-center shadow-lg shadow-indigo-500/10`}>
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800 dark:text-github-dark-text tracking-tight leading-tight">{selectedShift.name}</h2>
                                            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-[0.15em] mt-0.5">{selectedShift.type} Configuration</p>
                                        </div>
                                    </div>
                                     <div className="flex items-center justify-between gap-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleOpenEditModal}
                                                className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                                            >
                                                <Settings2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteShift(selectedShift.id)}
                                                className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setIsViewModalOpen(false)}
                                            className="w-10 h-10 bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Timing Section */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                                    <Sun size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starts</span>
                                            </div>
                                            <p className="text-xl font-black text-slate-800 dark:text-github-dark-text font-mono">{selectedShift.startTime}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                    <Moon size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ends</span>
                                            </div>
                                            <p className="text-xl font-black text-slate-800 dark:text-github-dark-text font-mono">{selectedShift.endTime}</p>
                                        </div>
                                    </div>

                                    {/* Work Days Display (Mirrored from Web) */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                        {(() => {
                                            const rules = selectedShift.policy_rules || {};
                                            const parsedRules = parsePolicy(rules.week_off_policy || rules.week_off || []);
                                            const activeDays = parsedRules.workingDays.length > 0 ? parsedRules.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                            
                                            return (
                                                <div className="w-full">
                                                    <div className="flex items-center gap-1.5 mb-3">
                                                        <Calendar size={14} className="text-indigo-500" />
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Working Days</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                                            const isWork = activeDays.includes(day);
                                                            return (
                                                                <span key={day} className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${isWork ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 line-through'}`}>
                                                                    {day}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>

                                                    {(parsedRules.weekOffRules.length > 0 || parsedRules.halfDayRules.length > 0) && (
                                                        <div className="pt-3 border-t border-slate-200/50 dark:border-github-dark-border space-y-3">
                                                            {parsedRules.weekOffRules.length > 0 && (
                                                                <div>
                                                                    <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1 uppercase"><AlertTriangle size={10} /> Alternate Full Days Off</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {parsedRules.weekOffRules.map((rule, idx) => (
                                                                            <span key={idx} className="text-[9px] px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-100 dark:border-amber-900/50 uppercase">
                                                                                {rule.day} ({rule.weeks.map(w => `${w}${w === 1 ? 'st' : w === 2 ? 'nd' : w === 3 ? 'rd' : 'th'}`).join(', ')})
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {parsedRules.halfDayRules.length > 0 && (
                                                                <div>
                                                                    <p className="text-[9px] font-black text-blue-600 dark:text-blue-500 mb-1.5 flex items-center gap-1 uppercase"><Clock size={10} /> Half Days</p>
                                                                    <div className="flex flex-col gap-2">
                                                                        {parsedRules.halfDayRules.map((rule, idx) => (
                                                                            <div key={idx} className="flex items-center gap-2">
                                                                                <span className="text-[9px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-900/50 uppercase">
                                                                                    {rule.day} ({rule.weeks.map(w => `${w}${w === 1 ? 'st' : w === 2 ? 'nd' : w === 3 ? 'rd' : 'th'}`).join(', ')})
                                                                                </span>
                                                                                {rule.timing && rule.timing.start_time && (
                                                                                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-github-dark-muted">
                                                                                        {rule.timing.start_time.substring(0,5)} → {rule.timing.end_time.substring(0,5)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Config Stats */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border divide-y divide-slate-200/50 dark:divide-github-dark-border">
                                        <div className="flex justify-between items-center pb-3">
                                            <div className="flex items-center gap-2">
                                                <Hourglass size={16} className="text-slate-400" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Grace Period</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text bg-white dark:bg-github-dark-subtle px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-github-dark-border">{selectedShift.gracePeriod}m</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3">
                                            <div className="flex items-center gap-2">
                                                <FileClock size={16} className="text-rose-500" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Corr. Deadline</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-github-dark-text bg-white dark:bg-github-dark-subtle px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-github-dark-border">{selectedShift.correctionDeadline || 2} Days</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3">
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-indigo-500" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Overtime Tracking</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedShift.overtime ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-github-dark-muted'}`}>
                                                    {selectedShift.overtime ? 'Active' : 'Off'}
                                                </div>
                                                {selectedShift.overtime && (
                                                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Threshold: {selectedShift.otThreshold}h | Buffer: {selectedShift.otBuffer}h</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assigned Staff Summary */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-indigo-500" />
                                                <span className="text-sm font-semibold text-slate-600 dark:text-github-dark-muted">Assigned Staff</span>
                                            </div>
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-3 py-1 rounded-full">
                                                {users.filter(u => u.shift_id === selectedShift.id).length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Validation Grid */}
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Validation Rules</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-github-dark-text">Check-In</p>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.policy_rules?.entry_requirements?.geofence ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.policy_rules?.entry_requirements?.geofence ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">GPS Req</span>
                                                </div>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.policy_rules?.entry_requirements?.selfie ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.policy_rules?.entry_requirements?.selfie ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">Selfie Req</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-github-dark-text">Check-Out</p>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.policy_rules?.exit_requirements?.geofence ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.policy_rules?.exit_requirements?.geofence ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">GPS Req</span>
                                                </div>
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${selectedShift.policy_rules?.exit_requirements?.selfie ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-github-dark-subtle dark:border-github-dark-border opacity-60'}`}>
                                                    <CheckCircle2 size={14} className={selectedShift.policy_rules?.exit_requirements?.selfie ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">Selfie Req</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                                    <button
                                        onClick={() => setIsViewModalOpen(false)}
                                        className="w-full py-4 bg-indigo-600 dark:bg-indigo-600 text-white text-sm font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Bottom Sheet: Create/Edit Shift */}
            {isAddModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAddModalOpen(false)}>
                    <div className="flex min-h-full items-end justify-center">
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-white dark:bg-dark-card w-full rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 border-t border-slate-200/50 dark:border-github-dark-border max-h-[92vh] flex flex-col"
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-2 shrink-0">
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pt-2 pb-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-github-dark-text tracking-tight">{isEditing ? 'Edit Shift' : 'Create Shift'}</h2>
                                        <p className="text-xs text-slate-500 font-medium">{isEditing ? 'Modify existing configuration' : 'Configure new work timings'}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="w-10 h-10 bg-slate-100 dark:bg-github-dark-subtle text-slate-500 dark:text-github-dark-muted rounded-full flex items-center justify-center"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Name Input */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shift Name</label>
                                        <div className="relative group">
                                            <Settings2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="e.g. Regular Day Shift"
                                                value={newShiftName}
                                                onChange={(e) => setNewShiftName(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-github-dark-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Time Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                                            <div className="relative group">
                                                <Sun size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                                <input
                                                    type="time"
                                                    value={newStartTime}
                                                    onChange={(e) => setNewStartTime(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-black text-slate-800 dark:text-github-dark-text font-mono appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                                            <div className="relative group">
                                                <Moon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                <input
                                                    type="time"
                                                    value={newEndTime}
                                                    onChange={(e) => setNewEndTime(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-black text-slate-800 dark:text-github-dark-text font-mono appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Working Days selection (Mirrored from Web) */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Working Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                                const isSelected = newWorkingDays.includes(day);
                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewWorkingDays(prev => {
                                                                const newDays = isSelected 
                                                                    ? prev.filter(d => d !== day)
                                                                    : [...prev, day];
                                                                // Clean up rules for this day if we disable it
                                                                setNewWeekOffRules(rules => isSelected ? rules.filter(r => r.day !== day) : rules);
                                                                setNewHalfDayRules(rules => isSelected ? rules.filter(r => r.day !== day) : rules);
                                                                return newDays;
                                                            });
                                                        }}
                                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-slate-400'}`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Advanced Settings Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                        className="w-full py-4 flex items-center justify-center gap-2 text-sm font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-github-dark-subtle/50 hover:bg-slate-100 dark:hover:bg-github-dark-subtle rounded-2xl border border-slate-200 dark:border-github-dark-border transition-all"
                                    >
                                        <Settings2 size={18} />
                                        {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                                        {showAdvancedSettings ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>

                                    {/* Advanced Settings Section */}
                                    {showAdvancedSettings && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                            {/* Advanced Week Offs & Half Days (Mirrored from Web) */}
                                            {newWorkingDays.length < 7 && (
                                                <div className="space-y-6">
                                                    {/* Alternate Full Days Off */}
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                            <AlertTriangle size={14} /> Alternate Full Days Off
                                                        </p>
                                                        <div className="space-y-3">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                                                                .filter(day => !newWorkingDays.includes(day))
                                                                .map(day => (
                                                                <div key={day} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {[1, 2, 3, 4, 5].map(week => {
                                                                            const rule = newWeekOffRules.find(r => r.day === day) || { weeks: [] };
                                                                            const isOff = rule.weeks.includes(week);
                                                                            return (
                                                                                <button
                                                                                    key={week} type="button"
                                                                                    onClick={() => toggleRule(day, 'weekOffRules', week)}
                                                                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${isOff ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                                                                                >
                                                                                    {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Half Days */}
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                            <Clock size={14} /> Half Days
                                                        </p>
                                                        <div className="space-y-3">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                                                const rule = newHalfDayRules.find(r => r.day === day) || { weeks: [] };
                                                                const hasHalfDays = rule.weeks.length > 0;
                                                                return (
                                                                    <div key={day} className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl border border-slate-100 dark:border-github-dark-border">
                                                                        <div className="flex justify-between items-center">
                                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</p>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {[1, 2, 3, 4, 5].map(week => {
                                                                                    const isHalf = rule.weeks.includes(week);
                                                                                    return (
                                                                                        <button
                                                                                            key={week} type="button"
                                                                                            onClick={() => toggleRule(day, 'halfDayRules', week)}
                                                                                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${isHalf ? 'bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-900/50 dark:text-indigo-400' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                                                                                        >
                                                                                            {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {hasHalfDays && (
                                                                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                                                                <div className="flex-1">
                                                                                    <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1 ml-1">Start</label>
                                                                                    <input type="time" value={rule.timing?.start_time || newStartTime || "09:00"} 
                                                                                           onChange={e => setRuleTiming(day, 'halfDayRules', 'start_time', e.target.value)}
                                                                                           className="w-full px-2 py-2 text-[10px] font-black font-mono bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-xl focus:outline-none focus:border-indigo-500" />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1 ml-1">End</label>
                                                                                    <input type="time" value={rule.timing?.end_time || newEndTime || "13:00"} 
                                                                                           onChange={e => setRuleTiming(day, 'halfDayRules', 'end_time', e.target.value)}
                                                                                           className="w-full px-2 py-2 text-[10px] font-black font-mono bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-xl focus:outline-none focus:border-indigo-500" />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Grace Period & Correction Deadline Grid */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center mb-1 px-1">
                                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Late Grace</label>
                                                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{newGracePeriod}m</span>
                                                    </div>
                                                    <div className="relative group">
                                                        <Hourglass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input 
                                                            type="number" 
                                                            value={newGracePeriod}
                                                            onChange={(e) => setNewGracePeriod(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center mb-1 px-1">
                                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Corr. Deadline</label>
                                                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">{newCorrectionDeadline}d</span>
                                                    </div>
                                                    <div className="relative group">
                                                        <AlertTriangle size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input 
                                                            type="number" 
                                                            value={newCorrectionDeadline}
                                                            onChange={(e) => setNewCorrectionDeadline(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Toggles */}
                                            <div className="space-y-4">
                                                <div className="bg-slate-50 dark:bg-github-dark-subtle/50 rounded-2xl p-4 border border-slate-100 dark:border-github-dark-border flex justify-between items-center group active:bg-slate-100 dark:active:bg-github-dark-subtle transition-colors" onClick={() => setNewOvertime(!newOvertime)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl transition-colors ${newOvertime ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                                                            <Zap size={18} fill={newOvertime ? 'currentColor' : 'none'} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[13px] font-bold text-slate-800 dark:text-github-dark-text">Overtime Tracking</p>
                                                            <p className="text-[10px] text-slate-500 font-medium">Automate OT calculations</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${newOvertime ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${newOvertime ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                </div>

                                                {newOvertime && (
                                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Threshold</label>
                                                            <div className="relative group">
                                                                <Zap size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input 
                                                                    type="number" step="0.1"
                                                                    value={newOtThreshold}
                                                                    onChange={(e) => setNewOtThreshold(e.target.value)}
                                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-10 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Hrs</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Buffer</label>
                                                            <div className="relative group">
                                                                <Hourglass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input 
                                                                    type="number" step="0.1"
                                                                    value={newOtBuffer}
                                                                    onChange={(e) => setNewOtBuffer(e.target.value)}
                                                                    className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl pl-11 pr-10 py-3.5 text-sm font-bold text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Hrs</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Validation Section */}
                                            <div className="space-y-4 pt-2">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Validation Requirements</p>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Check-In Column */}
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-tight flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Check-In
                                                        </p>
                                                        <div className="space-y-2">
                                                            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckInGps ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                                    {newValCheckInGps && <CheckCircle2 size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={newValCheckInGps} onChange={() => setNewValCheckInGps(!newValCheckInGps)} />
                                                                <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">GPS</span>
                                                            </label>
                                                            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckInSelfie ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                                    {newValCheckInSelfie && <CheckCircle2 size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={newValCheckInSelfie} onChange={() => setNewValCheckInSelfie(!newValCheckInSelfie)} />
                                                                <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">Selfie</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* Check-Out Column */}
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-black text-slate-800 dark:text-github-dark-text uppercase tracking-tight flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Check-Out
                                                        </p>
                                                        <div className="space-y-2">
                                                            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckOutGps ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                                    {newValCheckOutGps && <CheckCircle2 size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={newValCheckOutGps} onChange={() => setNewValCheckOutGps(!newValCheckOutGps)} />
                                                                <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">GPS</span>
                                                            </label>
                                                            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-2xl cursor-pointer active:scale-95 transition-all">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newValCheckOutSelfie ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}>
                                                                    {newValCheckOutSelfie && <CheckCircle2 size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={newValCheckOutSelfie} onChange={() => setNewValCheckOutSelfie(!newValCheckOutSelfie)} />
                                                                <span className="text-[11px] font-bold text-slate-600 dark:text-github-dark-muted uppercase">Selfie</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-10 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                                    <button
                                        onClick={handleSaveShift}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={20} />
                                        {isEditing ? 'Update Shift Configuration' : 'Save New Shift'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default ShiftManagement;

