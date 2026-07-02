import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Save, Play, Plus, X, Settings, Clock, MapPin, Calendar, AlertTriangle,
    CheckCircle, Trash2, Move, FileText, Zap, Briefcase, Edit2, Layers,
    Search, Users, Check, ArrowRight, FileClock, ChevronDown, ChevronUp
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import { buildPolicy, parsePolicy } from '../../utils/weekOffPolicy';

const PAGE_KEY = 'admin_shifts';
const TOUR_STEPS = [
    {
        targetId: 'shift-mgmt-list',
        title: 'Shift Master Directory',
        description: 'View, search, and select from your organization\'s configured work shifts. You can see active shifts, assigned employees, and durational summaries at a glance.',
    },
    {
        targetId: 'shift-mgmt-add',
        title: 'Create a Shift',
        description: 'Click this button to define a new shift logic block, setting custom start and end times, overtime thresholds, and grace periods.',
    },
    {
        targetId: 'shift-detail-pane',
        title: 'Shift Details & Policies',
        description: 'This panel displays the comprehensive settings for the selected shift. Here you can review active work timings, grace buffers, lock/correction deadlines, weekly off-policies, and identity or location verification rules.',
    },
    {
        targetId: 'shift-mgmt-users',
        title: 'Employee Assignments',
        description: 'View and manage employee shift assignments. You can search for specific staff members and bulk-assign them to this shift or override schedules individually.',
    },
];


const ShiftManagement = ({ embedded = false }) => {
    const location = useLocation();
    const { avatarTimestamp } = useAuth();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();

    // ── SHIFT STATE ─────────────────────────────────────────────────────────
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState(null);
    const [isLoadingShifts, setIsLoadingShifts] = useState(false);
    const [shiftSearch, setShiftSearch] = useState('');

    const [showShiftForm, setShowShiftForm] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [isOtEnabled, setIsOtEnabled] = useState(false);
    const [shiftForm, setShiftForm] = useState({
        name: '', start: '09:00', end: '18:00', grace: 0,
        otThreshold: 9.0, otBuffer: 0.5, correctionDeadline: 2,
        reqEntrySelfie: true, reqEntryGeofence: true,
        reqExitSelfie: false, reqExitGeofence: true,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        weekOffRules: [],
        halfDayRules: [],
        is_active: true
    });
    const [activeRuleDay, setActiveRuleDay] = useState(null);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [shiftToDelete, setShiftToDelete] = useState(null);

    // ── USER STATE ───────────────────────────────────────────────────────────
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);

    // ── HELPERS ─────────────────────────────────────────────────────────────
    const calculateDuration = (start, end) => {
        if (!start || !end) return '0h 00m';
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m`;
    };


    // ── LOAD DATA ────────────────────────────────────────────────────────────
    const loadShifts = useCallback(async () => {
        setIsLoadingShifts(true);
        try {
            const res = await adminService.getShifts();
            if (res.shifts) {
                const mapped = res.shifts.map((s, idx) => ({
                    id: s.shift_id, name: s.shift_name,
                    start: (s.start_time || '09:00').substring(0, 5),
                    end: (s.end_time || '18:00').substring(0, 5),
                    grace: s.grace_period_mins,
                    overtime: !!s.is_overtime_enabled,
                    otThreshold: parseFloat(s.overtime_threshold_hours),
                    otBuffer: parseFloat(s.overtime_buffer_hours ?? s.policy_rules?.overtime?.buffer ?? 0.5),
                    otMaxHours: parseFloat(s.policy_rules?.overtime?.max_overtime ?? s.policy_rules?.overtime?.maxOvertime ?? 0),
                    correctionDeadline: parseInt(s.policy_rules?.correction_deadline ?? 2),
                    policy_rules: s.policy_rules || {},
                    is_active: s.is_active !== 0
                }));
                setShifts(mapped);
                if (!selectedShift) setSelectedShift(mapped[0] || null);
                else setSelectedShift(prev => mapped.find(s => s.id === prev?.id) || mapped[0] || null);
            }
        } catch (e) { toast.error('Failed to load shifts'); }
        finally { setIsLoadingShifts(false); }
    }, []);

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await adminService.getShiftUsers();
            if (res.ok) setUsers(res.users);
        } catch (e) { toast.error('Failed to load users'); }
        finally { setLoadingUsers(false); }
    }, []);

    useEffect(() => {
        loadShifts();
        loadUsers();
    }, [loadShifts, loadUsers]);



    // Auto-calc OT threshold
    useEffect(() => {
        if (!showShiftForm) return;
        if (editingShift && editingShift.start?.substring(0, 5) === shiftForm.start?.substring(0, 5) && editingShift.end?.substring(0, 5) === shiftForm.end?.substring(0, 5)) return;
        const { start, end } = shiftForm;
        if (!start || !end) return;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let d = (eh * 60 + em) - (sh * 60 + sm);
        if (d < 0) d += 24 * 60;
        const h = parseFloat((d / 60).toFixed(2));
        setShiftForm(prev => prev.otThreshold === h ? prev : { ...prev, otThreshold: h });
    }, [shiftForm.start, shiftForm.end, showShiftForm]);

    // Populate form when editing
    useEffect(() => {
        if (showShiftForm && editingShift) {
            const rules = editingShift.policy_rules || {};
            const parsed = parsePolicy(rules.week_off_policy || rules.week_off || []);
            setShiftForm({
                name: editingShift.name, start: editingShift.start, end: editingShift.end,
                grace: editingShift.grace, otThreshold: editingShift.otThreshold || 8.0,
                otBuffer: editingShift.otBuffer ?? 0.5,
                otMaxHours: editingShift.otMaxHours ?? 0,
                correctionDeadline: editingShift.correctionDeadline ?? 2,
                reqEntrySelfie: !!rules.entry_requirements?.selfie,
                reqEntryGeofence: true, // GPS is mandatory
                reqExitSelfie: !!rules.exit_requirements?.selfie,
                reqExitGeofence: true, // GPS is mandatory
                workingDays: parsed.workingDays.length > 0 ? parsed.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                weekOffRules: parsed.weekOffRules,
                halfDayRules: parsed.halfDayRules,
                is_active: !!editingShift.is_active
            });
            setIsOtEnabled(!!editingShift.overtime);
            setActiveRuleDay(null);
            setShowAdvancedSettings(false);
        } else if (showShiftForm && !editingShift) {
            setShiftForm({ 
                name: '', start: '09:00', end: '18:00', grace: 0, otThreshold: 9.0, otBuffer: 0.5, otMaxHours: 0, correctionDeadline: 2,
                reqEntrySelfie: true, reqEntryGeofence: true, reqExitSelfie: false, reqExitGeofence: true, // GPS is mandatory
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], weekOffRules: [], halfDayRules: [],
                is_active: true
            });
            setIsOtEnabled(false);
            setActiveRuleDay(null);
            setShowAdvancedSettings(false);
        }
    }, [showShiftForm, editingShift]);

    // ── HANDLERS ─────────────────────────────────────────────────────────────
    const handleSaveShift = async (e) => {
        e.preventDefault();
        const baseRules = editingShift ? (editingShift.policy_rules || {}) : {};
        const week_off_policy = buildPolicy(shiftForm.workingDays, shiftForm.weekOffRules, shiftForm.halfDayRules);
        const policies = {
            ...baseRules,
            is_active: shiftForm.is_active,
            shift_timing: { start_time: shiftForm.start, end_time: shiftForm.end },
            grace_period: { minutes: parseInt(shiftForm.grace) || 0 },
            overtime: { 
                enabled: isOtEnabled, 
                threshold: parseFloat(shiftForm.otThreshold) || 0, 
                buffer: parseFloat(shiftForm.otBuffer) || 0,
                max_overtime: parseFloat(shiftForm.otMaxHours) > 0 ? parseFloat(shiftForm.otMaxHours) : null
            },
            correction_deadline: parseInt(shiftForm.correctionDeadline) || 2,
            entry_requirements: { selfie: shiftForm.reqEntrySelfie, geofence: true }, // GPS is mandatory
            exit_requirements: { selfie: shiftForm.reqExitSelfie, geofence: true }, // GPS is mandatory
            week_off_policy
        };
        // Cleanup old fields if updating an old shift
        delete policies.working_days;
        delete policies.alternate_saturdays;
        try {
            if (editingShift) {
                await adminService.updateShift(editingShift.id, { shift_name: shiftForm.name, is_active: shiftForm.is_active, policy_rules: policies });
                toast.success('Shift updated');
            } else {
                await adminService.createShift({ shift_name: shiftForm.name, is_active: shiftForm.is_active, policy_rules: policies });
                toast.success('Shift created');
            }
            setShowShiftForm(false); setEditingShift(null);
            loadShifts();
        } catch (err) { toast.error(err.message || 'Failed to save shift'); }
    };

    const handleDeleteShiftClick = (shift) => {
        setShiftToDelete(shift);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteShift = async () => {
        if (!shiftToDelete) return;
        try {
            await adminService.deleteShift(shiftToDelete.id);
            toast.success('Shift deleted successfully');
            if (selectedShift?.id === shiftToDelete.id) setSelectedShift(null);
            setIsDeleteModalOpen(false);
            setShiftToDelete(null);
            loadShifts();
        } catch (err) { toast.error(err.message || 'Failed to delete shift'); }
    };

    const handleToggleUserShift = async (userId, isAssigned) => {
        if (!selectedShift) return;
        const newShiftId = isAssigned ? null : selectedShift.id;
        // Optimistic update
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, shift_id: newShiftId } : u));
        try {
            await adminService.assignUserShift(userId, newShiftId);
            toast.success("Staff shift assignment updated successfully!");
        } catch (err) {
            toast.error(err.message || 'Failed to update assignment');
            loadUsers(); // rollback
        }
    };

    const filteredShifts = shifts.filter(s => s.name.toLowerCase().includes(shiftSearch.toLowerCase()));
    const filteredUsers = users.filter(u =>
        u.user_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.desg_name?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const formatDecimalHours = (val) => {
        const totalMinutes = Math.round((parseFloat(val) || 0) * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : '00m'}` : `${mins}m`;
    };

    const otThresholdVal = parseFloat(shiftForm.otThreshold) || 0;
    const otThresholdMins = Math.round(otThresholdVal * 60);
    const otThresholdHr = Math.floor(otThresholdMins / 60);
    const otThresholdMin = otThresholdMins % 60;

    const handleOtThresholdChange = (hr, min) => {
        const totalMinutes = (parseInt(hr) || 0) * 60 + (parseInt(min) || 0);
        const decimal = parseFloat((totalMinutes / 60).toFixed(2));
        setShiftForm(prev => ({ ...prev, otThreshold: decimal }));
    };

    const otBufferVal = parseFloat(shiftForm.otBuffer) || 0;
    const otBufferMins = Math.round(otBufferVal * 60);
    const otBufferHr = Math.floor(otBufferMins / 60);
    const otBufferMin = otBufferMins % 60;

    const handleOtBufferChange = (hr, min) => {
        const totalMinutes = (parseInt(hr) || 0) * 60 + (parseInt(min) || 0);
        const decimal = parseFloat((totalMinutes / 60).toFixed(2));
        setShiftForm(prev => ({ ...prev, otBuffer: decimal }));
    };

    const otMaxHoursVal = parseFloat(shiftForm.otMaxHours) || 0;
    const otMaxHoursMins = Math.round(otMaxHoursVal * 60);
    const otMaxHoursHr = Math.floor(otMaxHoursMins / 60);
    const otMaxHoursMin = otMaxHoursMins % 60;

    const handleOtMaxHoursChange = (hr, min) => {
        const totalMinutes = (parseInt(hr) || 0) * 60 + (parseInt(min) || 0);
        const decimal = parseFloat((totalMinutes / 60).toFixed(2));
        setShiftForm(prev => ({ ...prev, otMaxHours: decimal }));
    };

    const Toggle = ({ label, subLabel, checked, onChange }) => (
        <div className="flex items-center justify-between py-2">
            <div>
                <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text">{label}</p>
                {subLabel && <p className="text-[11px] text-slate-500">{subLabel}</p>}
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
            <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
        </label>
    );

    const toggleRule = (day, ruleType, week) => {
        setShiftForm(prev => {
            const rules = [...prev[ruleType]];
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
            return { ...prev, [ruleType]: rules };
        });
    };

    const setRuleTiming = (day, ruleType, field, value) => {
        setShiftForm(prev => {
            const rules = [...prev[ruleType]];
            const existingIdx = rules.findIndex(r => r.day === day);
            if (existingIdx >= 0) {
                const rule = rules[existingIdx];
                rules[existingIdx] = {
                    ...rule,
                    timing: {
                        ...(rule.timing || { start_time: prev.start, end_time: prev.end }),
                        [field]: value
                    }
                };
            }
            return { ...prev, [ruleType]: rules };
        });
    };

    const content = (
        <>
            <div className={`flex ${embedded ? 'h-full p-0' : 'h-[calc(100vh-64px)] p-3'} gap-3 animate-in fade-in duration-300`}>

                {/* LEFT: Shift List */}
                <div data-tour-id="shift-mgmt-list" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">Shifts</h3>
                            <button
                                data-tour-id="shift-mgmt-add"
                                onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                title="Create new shift"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search shifts..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                value={shiftSearch}
                                onChange={e => setShiftSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                        {isLoadingShifts && (
                            <div className="py-10 text-center text-slate-400 text-sm">Loading shifts...</div>
                        )}
                        {!isLoadingShifts && filteredShifts.length === 0 && (
                            <div className="py-10 text-center space-y-2">
                                <Briefcase size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400">No shifts found</p>
                                <button
                                    onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                >+ Create first shift</button>
                            </div>
                        )}
                        {filteredShifts.map((shift, idx) => {
                            const selectedUser = selectedUserId ? users.find(u => u.user_id === selectedUserId) : null;
                            const isUserAssignedShift = selectedUser && selectedUser.shift_id === shift.id;
                            return (
                                <div
                                    key={shift.id}
                                    data-tour-id={idx === 0 ? "shift-management-card" : undefined}
                                    onClick={() => { setSelectedShift(shift); setShowShiftForm(false); }}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer group ${selectedShift?.id === shift.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                                        : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        } ${isUserAssignedShift
                                            ? 'ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5'
                                            : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${isUserAssignedShift ? 'bg-emerald-500 animate-pulse' : shift.is_active ? 'bg-indigo-500' : 'bg-slate-350 dark:bg-slate-600'}`} />
                                            <h4 className={`font-semibold text-sm ${selectedShift?.id === shift.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                {shift.name}
                                            </h4>
                                        </div>
                                        <div className="flex gap-1.5 items-center">
                                            {!shift.is_active && (
                                                <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">
                                                    Inactive
                                                </span>
                                            )}
                                            {isUserAssignedShift && (
                                                <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                    Assigned
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted font-mono mb-2">
                                        {shift.start} → {shift.end}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-github-dark-muted">
                                        <span className="flex items-center gap-1"><Clock size={10} />{calculateDuration(shift.start, shift.end)}</span>
                                        <span className="flex items-center gap-1"><Users size={10} />{users.filter(u => u.shift_id === shift.id).length} Staff</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CENTER: Shift Details / Edit Form */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    {!selectedShift && !showShiftForm ? (
                        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
                            <Briefcase size={48} className="opacity-20" />
                            <p className="text-sm">Select a shift to view details</p>
                            <button
                                onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={16} /> New Shift
                            </button>
                        </div>
                    ) : showShiftForm ? (
                        /* ── Shift Form ── */
                        <>
                            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-github-dark-border">
                                <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">
                                    {editingShift ? 'Edit Shift' : 'Create New Shift'}
                                </h3>
                                <button onClick={() => { setShowShiftForm(false); setEditingShift(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveShift} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Shift Name</label>
                                    <input
                                        type="text" required value={shiftForm.name}
                                        onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                                        placeholder="e.g. Morning Shift A"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                    />
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-github-dark-text">Shift Status</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Toggle active/inactive status in directory</p>
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
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
                                        <input type="time" required value={shiftForm.start}
                                            onChange={e => setShiftForm({ ...shiftForm, start: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time</label>
                                        <input type="time" required value={shiftForm.end}
                                            onChange={e => setShiftForm({ ...shiftForm, end: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                        />
                                    </div>
                                </div>

                                    {/* Working Days (Moved to basic section) */}
                                    <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-4">
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text mb-3 flex items-center gap-2">
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
                                                            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${buttonClass}`}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Color Legends */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-150 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 select-none">
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
                                        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border transition-colors"
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
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Grace Period</label>
                                                    <div className="relative">
                                                        <input type="number" required min="0" value={shiftForm.grace}
                                                            onChange={e => setShiftForm({ ...shiftForm, grace: e.target.value })}
                                                            className="w-full pl-3 pr-14 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">minutes</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-1">Allowed lateness buffer.</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Correction Deadline</label>
                                                    <div className="relative">
                                                        <input type="number" required min="1" value={shiftForm.correctionDeadline}
                                                            onChange={e => setShiftForm({ ...shiftForm, correctionDeadline: e.target.value })}
                                                            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">days</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-1">Days to correct missed punches.</p>
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
                                                                            className="w-full pl-3 pr-8 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">hr</span>
                                                                    </div>
                                                                    <div className="relative flex-1">
                                                                        <input type="number" min="0" max="59" placeholder="0" value={otThresholdMin || ''}
                                                                            onChange={e => handleOtThresholdChange(otThresholdHr, e.target.value)}
                                                                            className="w-full pl-3 pr-9 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">min</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Buffer Time</label>
                                                                <div className="flex gap-2">
                                                                    <div className="relative flex-1">
                                                                        <input type="number" min="0" placeholder="0" value={otBufferHr || ''}
                                                                            onChange={e => handleOtBufferChange(e.target.value, otBufferMin)}
                                                                            className="w-full pl-3 pr-8 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">hr</span>
                                                                    </div>
                                                                    <div className="relative flex-1">
                                                                        <input type="number" min="0" max="59" placeholder="0" value={otBufferMin || ''}
                                                                            onChange={e => handleOtBufferChange(otBufferHr, e.target.value)}
                                                                            className="w-full pl-3 pr-9 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">min</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Maximum Overtime Allowed</label>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <input type="number" min="0" placeholder="0" value={otMaxHoursHr || ''}
                                                                        onChange={e => handleOtMaxHoursChange(e.target.value, otMaxHoursMin)}
                                                                        className="w-full pl-3 pr-8 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">hr</span>
                                                                </div>
                                                                <div className="relative flex-1">
                                                                    <input type="number" min="0" max="59" placeholder="0" value={otMaxHoursMin || ''}
                                                                        onChange={e => handleOtMaxHoursChange(otMaxHoursHr, e.target.value)}
                                                                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">min</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Leave 0 or empty for unlimited overtime.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Advanced Week Offs & Half Days */}
                                            {shiftForm.workingDays.length < 7 && (
                                                <div className="p-4 bg-slate-50 dark:bg-github-dark-subtle/50 rounded-xl border border-slate-200 dark:border-github-dark-border space-y-4">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-2">
                                                            <AlertTriangle size={15} /> Alternate Full Days Off
                                                        </h4>
                                                        <div className="space-y-3">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                                                                .filter(day => !shiftForm.workingDays.includes(day))
                                                                .map(day => (
                                                                <div key={day} className="flex items-center gap-4">
                                                                    <div className="w-16 text-xs font-bold text-slate-500 dark:text-slate-400">{day}</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {[1, 2, 3, 4, 5].map(week => {
                                                                            const rule = shiftForm.weekOffRules.find(r => r.day === day) || { weeks: [] };
                                                                            const isOff = rule.weeks.includes(week);
                                                                            return (
                                                                                <button
                                                                                    key={week} type="button"
                                                                                    onClick={() => toggleRule(day, 'weekOffRules', week)}
                                                                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${isOff ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
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

                                                    <div className="pt-5 border-t border-slate-200 dark:border-slate-700/50">
                                                        <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-500 mb-4 flex items-center gap-2">
                                                            <Clock size={15} /> Half Days
                                                        </h4>
                                                        <div className="space-y-5">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                                                const rule = shiftForm.halfDayRules.find(r => r.day === day) || { weeks: [] };
                                                                const hasHalfDays = rule.weeks.length > 0;
                                                                return (
                                                                    <div key={day} className="flex flex-col gap-2">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-16 text-xs font-bold text-slate-500 dark:text-slate-400">{day}</div>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {[1, 2, 3, 4, 5].map(week => {
                                                                                    const isHalf = rule.weeks.includes(week);
                                                                                    return (
                                                                                        <button
                                                                                            key={week} type="button"
                                                                                            onClick={() => toggleRule(day, 'halfDayRules', week)}
                                                                                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${isHalf ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/50 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                                                                                        >
                                                                                            {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {hasHalfDays && (
                                                                            <div className="ml-20 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 flex gap-3 animate-in fade-in zoom-in-95">
                                                                                <div className="flex-1">
                                                                                    <label className="block text-[10px] font-semibold text-blue-700 dark:text-blue-400 mb-1">Half Day Start</label>
                                                                                    <input type="time" value={rule.timing?.start_time || shiftForm.start || "09:00"} onChange={e => setRuleTiming(day, 'halfDayRules', 'start_time', e.target.value)}
                                                                                           className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-700 dark:text-slate-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <label className="block text-[10px] font-semibold text-blue-700 dark:text-blue-400 mb-1">Half Day End</label>
                                                                                    <input type="time" value={rule.timing?.end_time || shiftForm.end || "13:00"} onChange={e => setRuleTiming(day, 'halfDayRules', 'end_time', e.target.value)}
                                                                                           className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-700 dark:text-slate-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
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

                                            <div className="p-4 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl">
                                                <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text mb-3 flex items-center gap-2">
                                                    <MapPin size={15} className="text-slate-400" /> Attendance Validation
                                                </h4>
                                                <div className="grid grid-cols-2 gap-x-6">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check-In</p>
                                                        <Checkbox label="Selfie Required" checked={shiftForm.reqEntrySelfie} onChange={() => setShiftForm(p => ({ ...p, reqEntrySelfie: !p.reqEntrySelfie }))} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</p>
                                                        <Checkbox label="Selfie Required" checked={shiftForm.reqExitSelfie} onChange={() => setShiftForm(p => ({ ...p, reqExitSelfie: !p.reqExitSelfie }))} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { setShowShiftForm(false); setEditingShift(null); }}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit"
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center gap-2">
                                        <Save size={15} /> Save Shift
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        /* ── Shift Detail View ── */
                        <div data-tour-id="shift-detail-pane" className="flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg text-slate-900 dark:text-github-dark-text">{selectedShift.name}</h2>
                                        <p className="text-xs text-slate-500 font-mono">{selectedShift.start} → {selectedShift.end} • {calculateDuration(selectedShift.start, selectedShift.end)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Inline Status Toggle */}
                                    <div className="flex items-center gap-2 border border-slate-200 dark:border-github-dark-border rounded-xl px-3 py-1.5 bg-slate-50 dark:bg-slate-800/30 text-xs font-bold select-none">
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
                                        onClick={() => { setEditingShift(selectedShift); setShowShiftForm(true); }}
                                        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                                    ><Edit2 size={15} /> Edit</button>
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
                                                    label: 'text-indigo-600 dark:text-indigo-400 font-extrabold',
                                                },
                                                amber: {
                                                    bg: 'from-amber-50/40 to-white dark:from-amber-950/15 dark:to-github-dark-card border-amber-100/80 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-amber-500/5',
                                                    iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/20',
                                                    label: 'text-amber-700 dark:text-amber-400 font-extrabold',
                                                },
                                                rose: {
                                                    bg: 'from-rose-50/40 to-white dark:from-rose-950/15 dark:to-github-dark-card border-rose-100/80 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-rose-500/5',
                                                    iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/20',
                                                    label: 'text-rose-600 dark:text-rose-400 font-extrabold',
                                                },
                                                teal: {
                                                    bg: 'from-teal-50/40 to-white dark:from-teal-950/15 dark:to-github-dark-card border-teal-100/80 dark:border-teal-900/30 hover:border-teal-300 dark:hover:border-teal-800 hover:shadow-teal-500/5',
                                                    iconBg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/20',
                                                    label: 'text-teal-600 dark:text-teal-400 font-extrabold',
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
                                                            <p className="text-base font-black text-slate-800 dark:text-github-dark-text font-mono mt-0.5 leading-tight truncate">{card.value}</p>
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
                                                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Weekly Schedule & Holidays</h4>
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
                                                                    <span className="text-xs font-bold">{d}</span>
                                                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1">
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
                                                                <p className="text-xs text-slate-600 dark:text-github-dark-muted font-medium">
                                                                    Custom Week Offs: {parsedRules.weekOffRules.map(r => `${r.weeks.map(w => w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : w === 4 ? '4th' : '5th').join('/')} ${r.day}s`).join(', ')}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {parsedRules.halfDayRules.length > 0 && (
                                                            <div className="bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border rounded-xl p-3 flex flex-col gap-2">
                                                                <div className="flex gap-2 items-center">
                                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                                    <p className="text-xs font-bold text-slate-600 dark:text-github-dark-muted">
                                                                        Half Day Schedules & Timings:
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-col gap-1.5 mt-1">
                                                                    {parsedRules.halfDayRules.map((rule, idx) => {
                                                                        const weeksStr = rule.weeks.map(w => w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : w === 4 ? '4th' : '5th').join('/');
                                                                        const start = rule.timing?.start_time ? rule.timing.start_time.substring(0, 5) : (selectedShift.start ? selectedShift.start.substring(0, 5) : '09:00');
                                                                        const end = rule.timing?.end_time ? rule.timing.end_time.substring(0, 5) : (selectedShift.end ? selectedShift.end.substring(0, 5) : '13:00');
                                                                        return (
                                                                            <div key={idx} className="flex items-center justify-between text-xs text-slate-600 dark:text-github-dark-muted">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-2 flex justify-center">
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                                                                    </div>
                                                                                    <span>{rule.day} ({weeksStr} Week)</span>
                                                                                </div>
                                                                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
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
                                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Punch In Rules</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {[
                                                    { label: 'Selfie Required', val: selectedShift.policy_rules?.entry_requirements?.selfie },
                                                ].map(r => (
                                                    <div key={r.label} className="flex items-center gap-2 py-1">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                            {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-sm text-slate-600 dark:text-github-dark-muted">{r.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-xl p-5 space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MapPin size={16} className="text-indigo-500" />
                                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Punch Out Rules</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {[
                                                    { label: 'Selfie Required', val: selectedShift.policy_rules?.exit_requirements?.selfie },
                                                ].map(r => (
                                                    <div key={r.label} className="flex items-center gap-2 py-1">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${r.val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                            {r.val ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-sm text-slate-600 dark:text-github-dark-muted">{r.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {selectedShift.overtime && (
                                        <div className="p-4 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400"><Zap size={16} /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-bold">Overtime enabled after {formatDecimalHours(selectedShift.otThreshold)}</span>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    {selectedShift.otBuffer > 0 && (
                                                        <span className="text-[10px] text-slate-500">Buffer grace period: {formatDecimalHours(selectedShift.otBuffer)}</span>
                                                    )}
                                                    {selectedShift.otMaxHours > 0 && (
                                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Max Overtime limit: {formatDecimalHours(selectedShift.otMaxHours)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                        </div>
                        )}
                    </div>

                {/* RIGHT: User Assignment */}
                <div data-tour-id="shift-mgmt-users" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-slate-500" />
                            <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">Assigned Staff</h3>
                            {selectedShift && (
                                <span className="ml-auto text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                    {users.filter(u => u.shift_id === selectedShift.id).length}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text" placeholder="Search staff..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-4">
                        {loadingUsers && <p className="text-sm text-slate-400 px-3 py-4 text-center">Loading users...</p>}
                        {!loadingUsers && (() => {
                            const assignedUsers = filteredUsers.filter(user => selectedShift && user.shift_id === selectedShift.id);
                            const unassignedUsers = filteredUsers.filter(user => !selectedShift || user.shift_id !== selectedShift.id);
                            
                            const renderUserCard = (user) => {
                                const isAssigned = selectedShift && user.shift_id === selectedShift.id;
                                const userShift = shifts.find(s => s.id === user.shift_id);
                                const isSelected = selectedUserId === user.user_id;
                                return (
                                    <div
                                        key={user.user_id}
                                        onClick={() => setSelectedUserId(prev => prev === user.user_id ? null : user.user_id)}
                                        className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer group ${
                                            isSelected
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/10'
                                                : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                                                {user.profile_image_url ? (
                                                    <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.user_name} className="w-full h-full object-cover" />
                                                ) : user.user_name?.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text truncate">{user.user_name}</p>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <p className="text-[11px] text-slate-400 truncate">{user.desg_name}</p>
                                                    {userShift ? (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/20 flex items-center gap-1 w-max">
                                                            <Clock size={8} /> {userShift.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1 w-max">
                                                            No Shift
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (selectedShift) {
                                                    handleToggleUserShift(user.user_id, isAssigned);
                                                }
                                            }}
                                            disabled={!selectedShift}
                                            title={!selectedShift ? 'Select a shift first' : isAssigned ? 'Remove from shift' : 'Assign to shift'}
                                            className={`p-1.5 rounded-md transition-all flex-shrink-0 ${!selectedShift ? 'cursor-not-allowed opacity-30' : isAssigned
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600'
                                                }`}
                                        >
                                            {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                                        </button>
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-4">
                                    {assignedUsers.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-2">Assigned Staff ({assignedUsers.length})</p>
                                            {assignedUsers.map(renderUserCard)}
                                        </div>
                                    )}
                                    {unassignedUsers.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                                                {assignedUsers.length > 0 ? "Available Staff" : "All Staff"} ({unassignedUsers.length})
                                            </p>
                                            {unassignedUsers.map(renderUserCard)}
                                        </div>
                                    )}
                                    {assignedUsers.length === 0 && unassignedUsers.length === 0 && (
                                        <p className="text-sm text-slate-400 px-3 text-center py-4">No staff matched search query</p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all duration-200 animate-in fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-lg bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 mx-auto">
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                                    <AlertTriangle size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-github-dark-text mb-3">Delete Shift?</h3>
                                <p className="text-slate-500 dark:text-github-dark-muted mb-10 leading-relaxed">
                                    Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-github-dark-text">"{shiftToDelete?.name}"</span>?<br />This action will unassign all staff currently on this shift.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => { setIsDeleteModalOpen(false); setShiftToDelete(null); }}
                                        className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-github-dark-subtle/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-github-dark-text font-bold transition-all"
                                    >
                                        Keep it
                                    </button>
                                    <button
                                        onClick={confirmDeleteShift}
                                        className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    if (embedded) return content;
    return (
        <DashboardLayout title="Shift Management" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={TOUR_STEPS}>
            {content}
        </DashboardLayout>
    );
};

export default ShiftManagement;
