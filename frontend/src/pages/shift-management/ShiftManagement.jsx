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
import ShiftDirectory from './components/ShiftDirectory';
import ShiftDetailsPanel from './components/ShiftDetailsPanel';
import ShiftStaffAssignment from './components/ShiftStaffAssignment';
import ShiftFormDrawer from './components/ShiftFormDrawer';
import DeleteShiftModal from './components/DeleteShiftModal';

const DEFAULT_MAX_OT_HOURS = 3;

const normalizeUiMaxOtHours = (value) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return DEFAULT_MAX_OT_HOURS;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_OT_HOURS;
};

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
        otThreshold: 9.0, otBuffer: 0.5, otMaxHours: DEFAULT_MAX_OT_HOURS, correctionDeadline: 2,
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
                    otMaxHours: normalizeUiMaxOtHours(s.policy_rules?.overtime?.max_overtime ?? s.policy_rules?.overtime?.maxOvertime),
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
                otMaxHours: normalizeUiMaxOtHours(editingShift.otMaxHours),
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
                name: '', start: '09:00', end: '18:00', grace: 0, otThreshold: 9.0, otBuffer: 0.5, otMaxHours: DEFAULT_MAX_OT_HOURS, correctionDeadline: 2,
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
        const maxOvertime = normalizeUiMaxOtHours(shiftForm.otMaxHours);
        const policies = {
            ...baseRules,
            is_active: shiftForm.is_active,
            shift_timing: { start_time: shiftForm.start, end_time: shiftForm.end },
            grace_period: { minutes: parseInt(shiftForm.grace) || 0 },
            overtime: { 
                enabled: isOtEnabled, 
                threshold: parseFloat(shiftForm.otThreshold) || 0, 
                buffer: parseFloat(shiftForm.otBuffer) || 0,
                max_overtime: maxOvertime
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
                <ShiftDirectory
                    shifts={shifts}
                    filteredShifts={filteredShifts}
                    selectedShift={selectedShift}
                    setSelectedShift={(shift) => { setSelectedShift(shift); setShowShiftForm(false); }}
                    isLoadingShifts={isLoadingShifts}
                    shiftSearch={shiftSearch}
                    setShiftSearch={setShiftSearch}
                    users={users}
                    selectedUserId={selectedUserId}
                    onOpenAddShift={() => { setEditingShift(null); setShowShiftForm(true); }}
                    calculateDuration={calculateDuration}
                />

                {/* CENTER: Shift Details / Edit Form */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col overflow-hidden">
                    {!selectedShift && !showShiftForm ? (
                        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
                            <Briefcase size={48} className="opacity-20" />
                            <p className="text-sm font-normal">Select a shift to view details</p>
                            <button
                                onClick={() => { setEditingShift(null); setShowShiftForm(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
                            >
                                <Plus size={16} /> New Shift
                            </button>
                        </div>
                    ) : showShiftForm ? (
                        <ShiftFormDrawer
                            editingShift={editingShift}
                            shiftForm={shiftForm}
                            setShiftForm={setShiftForm}
                            onSaveShift={handleSaveShift}
                            onClose={() => { setShowShiftForm(false); setEditingShift(null); }}
                            isOtEnabled={isOtEnabled}
                            setIsOtEnabled={setIsOtEnabled}
                            showAdvancedSettings={showAdvancedSettings}
                            setShowAdvancedSettings={setShowAdvancedSettings}
                            toggleRule={toggleRule}
                            setRuleTiming={setRuleTiming}
                            otThresholdHr={otThresholdHr}
                            otThresholdMin={otThresholdMin}
                            handleOtThresholdChange={handleOtThresholdChange}
                            otBufferHr={otBufferHr}
                            otBufferMin={otBufferMin}
                            handleOtBufferChange={handleOtBufferChange}
                            otMaxHoursHr={otMaxHoursHr}
                            otMaxHoursMin={otMaxHoursMin}
                            handleOtMaxHoursChange={handleOtMaxHoursChange}
                        />
                    ) : (
                        <ShiftDetailsPanel
                            selectedShift={selectedShift}
                            calculateDuration={calculateDuration}
                            loadShifts={loadShifts}
                            onEditShift={(shift) => { setEditingShift(shift); setShowShiftForm(true); }}
                            formatDecimalHours={formatDecimalHours}
                            DEFAULT_MAX_OT_HOURS={DEFAULT_MAX_OT_HOURS}
                        />
                    )}
                </div>

                {/* RIGHT: User Assignment */}
                <ShiftStaffAssignment
                    selectedShift={selectedShift}
                    users={users}
                    shifts={shifts}
                    loadingUsers={loadingUsers}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    selectedUserId={selectedUserId}
                    setSelectedUserId={setSelectedUserId}
                    avatarTimestamp={avatarTimestamp}
                    handleToggleUserShift={handleToggleUserShift}
                />
            </div>

            {/* --- DELETE CONFIRMATION MODAL --- */}
            <DeleteShiftModal
                isOpen={isDeleteModalOpen}
                shiftToDelete={shiftToDelete}
                onClose={() => { setIsDeleteModalOpen(false); setShiftToDelete(null); }}
                onConfirm={confirmDeleteShift}
            />
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
