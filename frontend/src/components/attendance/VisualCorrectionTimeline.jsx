import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertCircle, CheckSquare, Square, PlusCircle, Sparkles, RefreshCw, Clock } from 'lucide-react';
import TimePicker from '../TimePicker';

export default function VisualCorrectionTimeline({ requestData, editable = true, onSessionsChange, className = '' }) {
    if (!requestData) return null;

    // Detect if this session/shift is a Night Shift (crosses midnight or starts in evening)
    const isNightShift = useMemo(() => {
        const checkSession = (s) => {
            if (!s) return false;
            const tIn = s.time_in ? String(s.time_in).slice(0, 5) : null;
            const tOut = s.time_out ? String(s.time_out).slice(0, 5) : null;
            if (s.is_overnight) return true;
            if (tIn && tOut && tOut <= tIn) return true;
            if (tIn && parseInt(tIn.split(':')[0], 10) >= 19) return true;
            return false;
        };
        const origHasNight = Array.isArray(requestData?.original_data) && requestData.original_data.some(checkSession);
        const propHasNight = Array.isArray(requestData?.proposed_data) && requestData.proposed_data.some(checkSession);
        return origHasNight || propHasNight;
    }, [requestData]);

    // Timeline Configuration (Day: 06:00 AM - 10:00 PM | Night: 08:00 PM - 08:00 AM next day)
    const START_HOUR = isNightShift ? 20 : 6;
    const END_HOUR = isNightShift ? 32 : 22;
    const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
    const ticks = isNightShift
        ? [20, 22, 24, 26, 28, 30, 32]
        : [6, 8, 10, 12, 14, 16, 18, 20, 22];

    // Time conversion helpers
    const parseMinutes = useCallback((timeStr) => {
        if (!timeStr) return null;
        const clean = String(timeStr).trim();
        const timePart = clean.includes(' ') ? clean.split(' ')[1] : (clean.includes('T') ? clean.split('T')[1] : clean);
        const [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return null;
        let mins = h * 60 + (isNaN(m) ? 0 : m);
        if (isNightShift && h < 12) {
            mins += 1440; // Next-day early morning hours
        }
        return mins;
    }, [isNightShift]);

    const minutesToTimeStr = useCallback((totalMins) => {
        const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, totalMins));
        let h = Math.floor(clamped / 60);
        if (h >= 24) h = h - 24;
        const m = clamped % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }, [START_HOUR, END_HOUR]);

    const formatDisplayTime = useCallback((timeStr) => {
        if (!timeStr) return '--:--';
        const clean = String(timeStr).trim();
        const timePart = clean.includes(' ') ? clean.split(' ')[1] : (clean.includes('T') ? clean.split('T')[1] : clean);
        const [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return '--:--';
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return `${displayH}:${String(m || 0).padStart(2, '0')} ${period}`;
    }, []);

    const getPosPercent = useCallback((mins) => {
        if (mins === null || isNaN(mins)) return 0;
        const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, mins));
        return ((clamped - START_HOUR * 60) / TOTAL_MINUTES) * 100;
    }, [START_HOUR, TOTAL_MINUTES]);

    // Flatten original punches
    const originalPunches = useMemo(() => {
        if (!Array.isArray(requestData?.original_data)) return [];
        const times = [];
        requestData.original_data.forEach(s => {
            if (s.time_in) times.push({ time: s.time_in, type: s.punch_type === 'normal' ? 'normal' : 'in' });
            if (s.time_out) times.push({ time: s.time_out, type: 'out' });
        });
        const sorted = times.sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        return sorted.map((p, idx) => ({
            id: `orig-${idx}`,
            time: p.time,
            type: p.type || (idx % 2 === 0 ? 'in' : 'out'),
            pairIdx: Math.floor(idx / 2)
        }));
    }, [requestData, parseMinutes]);

    // Flatten initial proposed punches
    const initialProposedPunches = useMemo(() => {
        if (!Array.isArray(requestData?.proposed_data)) return [];
        const list = [];
        requestData.proposed_data.forEach((s) => {
            if (s.time_in) list.push({ time: s.time_in, type: s.punch_type === 'normal' ? 'normal' : 'in' });
            if (s.time_out) list.push({ time: s.time_out, type: 'out' });
        });
        const sorted = list.sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        return sorted.map((p, idx) => ({
            id: `p-${idx}-${p.time}`,
            time: p.time,
            type: p.type || (idx % 2 === 0 ? 'in' : 'out'),
            pairIdx: Math.floor(idx / 2)
        }));
    }, [requestData, parseMinutes]);

    const [punches, setPunches] = useState(initialProposedPunches);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [draggingPunchId, setDraggingPunchId] = useState(null);
    const [creatingRange, setCreatingRange] = useState(null);
    const [hoveredAuraPairIdx, setHoveredAuraPairIdx] = useState(null);
    const [hoveredPunchId, setHoveredPunchId] = useState(null);
    const [, setHoveredMins] = useState(null);
    const [warningMsg, setWarningMsg] = useState(null);
    const lastEmittedJsonRef = useRef('');
    const trackRef = useRef(null);

    // Sync from props only when changes originate from outside (not from self emit)
    useEffect(() => {
        const incomingJson = JSON.stringify(requestData?.proposed_data || []);
        if (incomingJson !== lastEmittedJsonRef.current && !creatingRange && !draggingPunchId) {
            setPunches(initialProposedPunches);
        }
    }, [initialProposedPunches, creatingRange, draggingPunchId, requestData?.proposed_data]);

    const getMinutesFromClientX = useCallback((clientX) => {
        if (!trackRef.current) return START_HOUR * 60;
        const rect = trackRef.current.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const pct = offsetX / rect.width;
        const rawMinutes = START_HOUR * 60 + pct * TOTAL_MINUTES;
        return Math.round(rawMinutes / 5) * 5;
    }, [START_HOUR, TOTAL_MINUTES]);

    // Resequence ONLY boundary punches (preserving normal punches strictly)
    const resequencePunches = (punchList) => {
        const sorted = [...punchList].sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        let boundaryIndex = 0;
        let currentPairIdx = 0;

        return sorted.map((p) => {
            if (p.type === 'normal') {
                return { ...p, type: 'normal', pairIdx: currentPairIdx };
            }
            const assignedType = boundaryIndex % 2 === 0 ? 'in' : 'out';
            const assignedPair = Math.floor(boundaryIndex / 2);
            if (assignedType === 'in') currentPairIdx = assignedPair;
            boundaryIndex++;
            return {
                ...p,
                type: assignedType,
                pairIdx: assignedPair
            };
        });
    };

    // Emit updated punches paired chronologically for parent / backend
    const emitChanges = (updatedPunches) => {
        const sequenced = resequencePunches(updatedPunches);
        const paired = [];
        let curIn = null;

        for (const p of sequenced) {
            if (p.type === 'normal') {
                paired.push({ id: `normal-${paired.length}`, time_in: p.time, time_out: '', punch_type: 'normal' });
            } else if (p.type === 'in') {
                if (curIn !== null) {
                    paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: '', punch_type: 'regular' });
                }
                curIn = p.time;
            } else if (p.type === 'out') {
                if (curIn !== null) {
                    paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: p.time, punch_type: 'regular' });
                    curIn = null;
                } else {
                    paired.push({ id: `sess-${paired.length}`, time_in: '', time_out: p.time, punch_type: 'regular' });
                }
            }
        }
        if (curIn !== null) {
            paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: '', punch_type: 'regular' });
        }

        lastEmittedJsonRef.current = JSON.stringify(paired);
        if (onSessionsChange) onSessionsChange(paired);
    };

    // Check if a minute sits inside an existing IN -> OUT session interval
    const findInsideSession = useCallback((minute) => {
        const boundary = punches
            .filter(p => p.type !== 'normal')
            .sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));

        for (let i = 0; i < boundary.length; i += 2) {
            const inP = boundary[i];
            const outP = boundary[i + 1];
            if (inP && outP && inP.type === 'in' && outP.type === 'out') {
                const inM = parseMinutes(inP.time);
                const outM = parseMinutes(outP.time);
                if (inM !== null && outM !== null && minute > inM + 2 && minute < outM - 2) {
                    return { inP, outP, pairIdx: Math.floor(i / 2) };
                }
            }
        }
        return null;
    }, [punches, parseMinutes]);

    // Pointer down on track
    const handleTrackPointerDown = (e) => {
        if (!editable || draggingPunchId) return;
        if (e.target.closest('.punch-handle') || e.target.closest('button') || e.target.closest('input')) return;

        const clickedMins = getMinutesFromClientX(e.clientX);

        // Check if user clicked inside an active session
        const insideSession = findInsideSession(clickedMins);

        // Disallow clicking too close to an existing punch
        const isTooClose = punches.some(p => {
            const pM = parseMinutes(p.time);
            return pM !== null && Math.abs(pM - clickedMins) < 5;
        });

        if (isTooClose) {
            setWarningMsg('Punch point is too close to an existing punch.');
            setTimeout(() => setWarningMsg(null), 2500);
            return;
        }

        setCreatingRange({
            startMins: clickedMins,
            currentMins: clickedMins,
            isDragging: false,
            isInsideSession: !!insideSession,
            sessionPairIdx: insideSession ? insideSession.pairIdx : null
        });
    };

    const handlePointerMove = useCallback((e) => {
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const currentMins = getMinutesFromClientX(clientX);
        setHoveredMins(currentMins);

        // 1. Dragging across track to create a punch pair (IN & OUT)
        if (creatingRange) {
            const diff = Math.abs(currentMins - creatingRange.startMins);
            setCreatingRange(prev => prev ? {
                ...prev,
                currentMins,
                isDragging: (!prev.isInsideSession && diff >= 10) || prev.isDragging
            } : null);
            return;
        }

        // 2. Dragging an existing punch dot with strict neighbor clamping
        if (draggingPunchId) {
            const sorted = [...punches].sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
            const currentIndex = sorted.findIndex(p => p.id === draggingPunchId);
            if (currentIndex === -1) return;

            const prevPunch = sorted[currentIndex - 1];
            const nextPunch = sorted[currentIndex + 1];

            const minMins = prevPunch ? (parseMinutes(prevPunch.time) + 5) : (START_HOUR * 60);
            const maxMins = nextPunch ? (parseMinutes(nextPunch.time) - 5) : (END_HOUR * 60);

            const clampedMins = Math.max(minMins, Math.min(maxMins, currentMins));

            const updated = punches.map(p => {
                if (p.id !== draggingPunchId) return p;
                return { ...p, time: minutesToTimeStr(clampedMins) };
            });

            setPunches(resequencePunches(updated));
        }
    }, [creatingRange, draggingPunchId, getMinutesFromClientX, punches, START_HOUR, END_HOUR, parseMinutes, minutesToTimeStr]);

    const handlePointerUp = useCallback(() => {
        if (creatingRange) {
            const rawStart = Math.min(creatingRange.startMins, creatingRange.currentMins);
            const rawEnd = Math.max(creatingRange.startMins, creatingRange.currentMins);
            const isRange = creatingRange.isDragging && (rawEnd - rawStart >= 15);

            if (isRange) {
                // Dragged to create an IN & OUT pair
                const collides = punches.some(p => {
                    const pM = parseMinutes(p.time);
                    return pM !== null && pM >= rawStart && pM <= rawEnd;
                });

                if (collides) {
                    setWarningMsg('Cannot span across existing punch points.');
                    setTimeout(() => setWarningMsg(null), 2500);
                } else {
                    const newIn = { id: `p-${Date.now()}-1`, time: minutesToTimeStr(rawStart), type: 'in' };
                    const newOut = { id: `p-${Date.now()}-2`, time: minutesToTimeStr(rawEnd), type: 'out' };
                    const next = resequencePunches([...punches, newIn, newOut]);
                    setPunches(next);
                    emitChanges(next);
                }
            } else if (creatingRange.isInsideSession) {
                // Clicked inside an active session -> CREATE A CHECKPOINT / NORMAL PUNCH
                const newNormalPunch = {
                    id: `p-chk-${Date.now()}`,
                    time: minutesToTimeStr(creatingRange.startMins),
                    type: 'normal',
                    pairIdx: creatingRange.sessionPairIdx
                };
                const next = resequencePunches([...punches, newNormalPunch]);
                setPunches(next);
                emitChanges(next);
                setHoveredPunchId(newNormalPunch.id);
            } else {
                // Clicked outside any session -> CREATE A REGULAR BOUNDARY PUNCH
                const newPunch = {
                    id: `p-${Date.now()}`,
                    time: minutesToTimeStr(creatingRange.startMins),
                    type: 'in'
                };
                const next = resequencePunches([...punches, newPunch]);
                setPunches(next);
                emitChanges(next);
            }
            setCreatingRange(null);
        }

        if (draggingPunchId) {
            setDraggingPunchId(null);
            emitChanges(punches);
        }
    }, [creatingRange, draggingPunchId, punches, parseMinutes, minutesToTimeStr]);

    // Global listeners for smooth dragging
    useEffect(() => {
        if (creatingRange || draggingPunchId) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            return () => {
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
            };
        }
    }, [creatingRange, draggingPunchId, handlePointerMove, handlePointerUp]);

    // Update punch time directly via typed input
    const handleTimeChange = (punchId, newTimeStr) => {
        if (!newTimeStr) return;
        const updated = punches.map(p => {
            if (p.id !== punchId) return p;
            return { ...p, time: newTimeStr };
        });
        const sequenced = resequencePunches(updated);
        setPunches(sequenced);
        emitChanges(sequenced);
    };

    // Add Checkpoint punch programmatically
    const handleAddCheckpointAtCurrent = () => {
        const boundary = punches
            .filter(p => p.type !== 'normal')
            .sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));

        for (let i = 0; i < boundary.length; i += 2) {
            const inP = boundary[i];
            const outP = boundary[i + 1];
            if (inP && outP && inP.type === 'in' && outP.type === 'out') {
                const inM = parseMinutes(inP.time);
                const outM = parseMinutes(outP.time);
                if (inM !== null && outM !== null && outM - inM >= 15) {
                    const midPoint = Math.round((inM + outM) / 2 / 5) * 5;
                    const newNormalPunch = {
                        id: `p-chk-${Date.now()}`,
                        time: minutesToTimeStr(midPoint),
                        type: 'normal',
                        pairIdx: Math.floor(i / 2)
                    };
                    const next = resequencePunches([...punches, newNormalPunch]);
                    setPunches(next);
                    emitChanges(next);
                    setHoveredPunchId(newNormalPunch.id);
                    return;
                }
            }
        }
        setWarningMsg('Add a Clock IN and Clock OUT pair first to add a checkpoint between them.');
        setTimeout(() => setWarningMsg(null), 2500);
    };

    // Toggle select a specific punch
    const handleToggleSelect = (punchId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(punchId)) next.delete(punchId);
            else next.add(punchId);
            return next;
        });
    };

    // Select all or Deselect all
    const handleToggleSelectAll = () => {
        if (selectedIds.size === punches.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(punches.map(p => p.id)));
        }
    };

    // Bulk Delete Selected Punches
    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        const filtered = punches.filter(p => !selectedIds.has(p.id));
        const sequenced = resequencePunches(filtered);
        setPunches(sequenced);
        setSelectedIds(new Set());
        emitChanges(sequenced);
    };

    // Clear All Punches
    const handleClearAll = () => {
        setPunches([]);
        setSelectedIds(new Set());
        emitChanges([]);
    };

    // Remove single punch
    const handleRemovePunch = (punchId) => {
        const filtered = punches.filter(p => p.id !== punchId);
        const sequenced = resequencePunches(filtered);
        setPunches(sequenced);
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(punchId);
            return next;
        });
        emitChanges(sequenced);
    };

    // Track auras for interval spans on track
    const trackAuras = useMemo(() => {
        const auras = [];
        const boundary = punches
            .filter(p => p.type !== 'normal')
            .sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));

        for (let i = 0; i < boundary.length; i += 2) {
            const inP = boundary[i];
            const outP = boundary[i + 1];
            if (inP && outP) {
                auras.push({ pairIdx: inP.pairIdx, inP, outP });
            }
        }
        return auras;
    }, [punches, parseMinutes]);

    const originalPunchPairs = useMemo(() => {
        const pairs = [];
        const boundary = originalPunches.filter(p => p.type !== 'normal');
        for (let i = 0; i < boundary.length; i += 2) {
            pairs.push({
                pairIdx: Math.floor(i / 2),
                inPunch: boundary[i],
                outPunch: boundary[i + 1] || null
            });
        }
        return pairs;
    }, [originalPunches]);

    // Calculate Summary Stats
    const totalWorkingMinutes = useMemo(() => {
        let total = 0;
        trackAuras.forEach(aura => {
            const inM = parseMinutes(aura.inP.time);
            const outM = parseMinutes(aura.outP.time);
            if (inM !== null && outM !== null && outM > inM) {
                total += (outM - inM);
            }
        });
        return total;
    }, [trackAuras, parseMinutes]);

    const formatDuration = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        return `${h}h ${m > 0 ? `${m}m` : ''}`;
    };

    const isSummaryOverride = (requestData?.correction_type || '').toLowerCase() === 'summary';
    const isAbsent = originalPunches.length === 0;

    return (
        <div className={`bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 sm:p-5 select-none space-y-5 shadow-2xs ${className}`}>
            {/* Header & Helper Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-github-dark-border/40 gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Clock size={15} className="text-indigo-500" />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Punch Timeline Visualizer
                        </h4>
                    </div>
                    <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                        {editable
                            ? 'Drag punch handles or click directly on the rail to add new session points'
                            : 'Comparison of originally recorded vs proposed punches'}
                    </p>
                </div>

                {warningMsg && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium"
                    >
                        <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{warningMsg}</span>
                    </motion.div>
                )}
            </div>

            {/* ─── ROW 1: ORIGINALLY RECORDED TIMELINE ─── */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Originally Recorded
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">
                            {isAbsent ? 'No punches logged' : `(${originalPunches.length} punch${originalPunches.length > 1 ? 'es' : ''})`}
                        </span>
                    </div>

                    {/* Legend */}
                    <div className="hidden sm:flex items-center gap-3 text-[11px] font-normal text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Clock In
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" /> Clock Out
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" /> Checkpoint
                        </span>
                    </div>
                </div>

                {/* Track Rail Container */}
                <div className="px-6 py-4 bg-slate-50/60 dark:bg-github-dark-bg/30 border border-slate-200/70 dark:border-github-dark-border/40 rounded-xl">
                    <div className="relative h-12 flex items-center">
                        {/* Background Rail */}
                        <div className="absolute inset-x-0 h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full" />

                        {/* Ticks and Labels */}
                        {ticks.map(h => {
                            const pct = getPosPercent(h * 60);
                            const normH = h >= 24 ? h - 24 : h;
                            const displayHour = normH === 0 || normH === 24 ? '12 AM' : normH === 12 ? '12 PM' : normH > 12 ? `${normH - 12} PM` : `${normH} AM`;
                            return (
                                <div
                                    key={h}
                                    className="absolute top-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                    style={{ left: `${pct}%` }}
                                >
                                    <div className="w-[1px] h-3 bg-slate-400/70 dark:bg-slate-500/70 rounded-full -translate-y-1/2" />
                                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 mt-2 font-mono whitespace-nowrap">
                                        {displayHour}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Original Soft Aura Glow between Paired Punches */}
                        {originalPunchPairs.map((pair) => {
                            if (!pair.inPunch || !pair.outPunch) return null;
                            const inPct = getPosPercent(parseMinutes(pair.inPunch.time));
                            const outPct = getPosPercent(parseMinutes(pair.outPunch.time));

                            return (
                                <div
                                    key={pair.pairIdx}
                                    className="absolute top-1/2 -translate-y-1/2 h-6 rounded-lg bg-slate-200/60 dark:bg-slate-700/40 border border-slate-300/70 dark:border-slate-600/40 pointer-events-none transition-all flex items-center justify-center"
                                    style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }}
                                />
                            );
                        })}

                        {/* Original Punch Dots */}
                        {originalPunches.map((p) => {
                            const mins = parseMinutes(p.time);
                            const pct = getPosPercent(mins);
                            const isHovered = hoveredPunchId === `orig-${p.id}`;
                            const isIn = p.type === 'in';
                            const isNormal = p.type === 'normal';

                            return (
                                <div
                                    key={p.id}
                                    className="punch-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-pointer"
                                    style={{ left: `${pct}%` }}
                                    onMouseEnter={() => setHoveredPunchId(`orig-${p.id}`)}
                                    onMouseLeave={() => setHoveredPunchId(null)}
                                >
                                    <AnimatePresence>
                                        {isHovered && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 2, scale: 0.95 }}
                                                animate={{ opacity: 1, y: -34, scale: 1 }}
                                                exit={{ opacity: 0, y: 2, scale: 0.95 }}
                                                className="absolute whitespace-nowrap bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white text-xs font-mono font-normal px-2.5 py-1 rounded-lg shadow-lg border border-slate-700/60 pointer-events-none z-30 flex items-center gap-1.5"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? 'bg-amber-400' : isIn ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                <span className={`font-medium ${isNormal ? 'text-amber-300' : isIn ? 'text-emerald-300' : 'text-rose-300'}`}>
                                                    {isNormal ? 'CHECK:' : isIn ? 'IN:' : 'OUT:'}
                                                </span>
                                                <span>{formatDisplayTime(p.time)}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className={`w-4 h-4 rounded-full shadow-xs border-2 border-white dark:border-dark-card flex items-center justify-center ${
                                        isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}>
                                        <div className="w-1 h-1 rounded-full bg-white opacity-80" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── ROW 2: PROPOSED CORRECTION TIMELINE ─── */}
            <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            Proposed Timeline
                        </span>
                        {totalWorkingMinutes > 0 && (
                            <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                {formatDuration(totalWorkingMinutes)} total
                            </span>
                        )}
                    </div>

                    {editable && (
                        <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            Drag handles or click rail to drop points
                        </span>
                    )}
                </div>

                {/* Interactive Track Rail Container */}
                <div className="px-6 py-4 bg-slate-50/80 dark:bg-github-dark-bg/40 border border-slate-200/80 dark:border-github-dark-border/60 rounded-xl transition-colors">
                    <div
                        ref={trackRef}
                        onPointerDown={handleTrackPointerDown}
                        className={`relative h-12 flex items-center select-none ${
                            editable ? 'cursor-crosshair' : 'cursor-default'
                        }`}
                    >
                        {/* Background Rail */}
                        <div className="absolute inset-x-0 h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full" />

                        {/* Ticks and Labels */}
                        {ticks.map(h => {
                            const pct = getPosPercent(h * 60);
                            const normH = h >= 24 ? h - 24 : h;
                            const displayHour = normH === 0 || normH === 24 ? '12 AM' : normH === 12 ? '12 PM' : normH > 12 ? `${normH - 12} PM` : `${normH} AM`;
                            return (
                                <div
                                    key={h}
                                    className="absolute top-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                    style={{ left: `${pct}%` }}
                                >
                                    <div className="w-[1px] h-3 bg-slate-400/70 dark:bg-slate-500/70 rounded-full -translate-y-1/2" />
                                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 mt-2 font-mono whitespace-nowrap">
                                        {displayHour}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Working Session Interval Spans (Between IN & OUT) */}
                        {trackAuras.map((aura) => {
                            const inPct = getPosPercent(parseMinutes(aura.inP.time));
                            const outPct = getPosPercent(parseMinutes(aura.outP.time));
                            const spanWidth = Math.max(0, outPct - inPct);
                            const durationMinutes = parseMinutes(aura.outP.time) - parseMinutes(aura.inP.time);
                            const isAuraHovered = editable && hoveredAuraPairIdx === aura.pairIdx;

                            return (
                                <div
                                    key={aura.pairIdx}
                                    onMouseEnter={() => {
                                        if (!editable) return;
                                        setHoveredAuraPairIdx(aura.pairIdx);
                                        setHoveredPunchId(null);
                                    }}
                                    onMouseLeave={() => {
                                        if (!editable) return;
                                        setHoveredAuraPairIdx(null);
                                    }}
                                    className={`group absolute top-1/2 -translate-y-1/2 h-7 rounded-xl transition-all flex items-center justify-center ${
                                        editable
                                            ? `cursor-pointer ${
                                                isAuraHovered
                                                    ? 'bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-indigo-500/25 border border-emerald-400 dark:border-emerald-400 shadow-xs ring-2 ring-emerald-400/20'
                                                    : 'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 border border-emerald-300/70 dark:border-emerald-500/40 hover:border-emerald-400'
                                            }`
                                            : 'bg-gradient-to-r from-emerald-500/15 to-indigo-500/15 border border-emerald-200 dark:border-emerald-800/40 pointer-events-none'
                                    }`}
                                    style={{ left: `${inPct}%`, width: `${spanWidth}%` }}
                                >
                                    {/* Centered duration pill if span is wide enough */}
                                    {spanWidth >= 12 && durationMinutes > 0 && (
                                        <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-dark-card/90 px-2 py-0.5 rounded-full shadow-2xs border border-emerald-300/50 dark:border-emerald-700/50 pointer-events-none">
                                            {formatDuration(durationMinutes)}
                                        </span>
                                    )}

                                    {/* Middle Hover Prompt to Drop Checkpoint */}
                                    {editable && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-10 whitespace-nowrap bg-slate-900 text-white text-[11px] font-medium px-2.5 py-0.5 rounded-lg shadow-md flex items-center gap-1 pointer-events-none z-30">
                                            <PlusCircle size={12} className="text-amber-400" />
                                            <span>Click to Add Checkpoint</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Live Drag Creation Aura Preview */}
                        {creatingRange && creatingRange.isDragging && (() => {
                            const sMin = Math.min(creatingRange.startMins, creatingRange.currentMins);
                            const eMin = Math.max(creatingRange.startMins, creatingRange.currentMins);
                            const sPct = getPosPercent(sMin);
                            const ePct = getPosPercent(eMin);

                            return (
                                <>
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-xl bg-gradient-to-r from-emerald-500/25 to-rose-500/25 border border-dashed border-emerald-400 shadow-md pointer-events-none"
                                        style={{ left: `${sPct}%`, width: `${Math.max(1, ePct - sPct)}%` }}
                                    />
                                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none" style={{ left: `${sPct}%` }}>
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-emerald-400/40 border-2 border-white shadow-md" />
                                    </div>
                                    {eMin > sMin && (
                                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none" style={{ left: `${ePct}%` }}>
                                            <div className="w-5 h-5 rounded-full bg-rose-500 ring-4 ring-rose-400/40 border-2 border-white shadow-md" />
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* Interactive Punch Dots */}
                        {punches.map((p) => {
                            const mins = parseMinutes(p.time);
                            const pct = getPosPercent(mins);
                            const isDragging = draggingPunchId === p.id;
                            const isThisDotHovered = hoveredPunchId === p.id;
                            const isAuraActive = hoveredAuraPairIdx === p.pairIdx;
                            const isIn = p.type === 'in';
                            const isNormal = p.type === 'normal';

                            return (
                                <div
                                    key={p.id}
                                    className={`punch-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 ${
                                        editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                    }`}
                                    style={{ left: `${pct}%` }}
                                    onPointerDown={(e) => {
                                        if (!editable) return;
                                        if (e.target.closest('input') || e.target.closest('button')) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDraggingPunchId(p.id);
                                    }}
                                    onMouseEnter={() => {
                                        setHoveredPunchId(p.id);
                                        setHoveredAuraPairIdx(null);
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredPunchId(null);
                                    }}
                                >
                                    {/* Floating Time Tooltip */}
                                    <AnimatePresence>
                                        {(isDragging || isThisDotHovered) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 2, scale: 0.95 }}
                                                animate={{ opacity: 1, y: -34, scale: 1 }}
                                                exit={{ opacity: 0, y: 2, scale: 0.95 }}
                                                className="absolute whitespace-nowrap bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white text-xs font-mono font-normal px-2.5 py-1 rounded-lg shadow-xl border border-slate-700/60 pointer-events-none z-40 flex items-center gap-1.5"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? 'bg-amber-400' : isIn ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                <span className={`font-medium ${isNormal ? 'text-amber-300' : isIn ? 'text-emerald-300' : 'text-rose-300'}`}>
                                                    {isNormal ? 'CHECK:' : isIn ? 'IN:' : 'OUT:'}
                                                </span>
                                                <span>{formatDisplayTime(p.time)}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Punch Handle Circular Badge */}
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 border-white dark:border-dark-card shadow-md flex items-center justify-center transition-transform ${
                                            isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'
                                        } ${
                                            isDragging
                                                ? 'scale-125 ring-4 ring-indigo-400/50'
                                                : isThisDotHovered
                                                    ? 'scale-125 ring-4 ring-indigo-400/40'
                                                    : isAuraActive
                                                        ? 'scale-110'
                                                        : 'hover:scale-120'
                                        }`}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── ROW 3: DETAILED PUNCH LIST & ACTIONS (EDITABLE MODE) ─── */}
            {editable && (
                <div className="space-y-2.5 pt-1">
                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-github-dark-border/40">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleToggleSelectAll}
                                className="text-xs font-normal text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                {selectedIds.size === punches.length && punches.length > 0 ? (
                                    <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <Square size={14} className="text-slate-400" />
                                )}
                                <span>Select All ({punches.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleAddCheckpointAtCurrent}
                                className="text-xs font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <PlusCircle size={13} className="text-amber-500" />
                                <span>Add Checkpoint</span>
                            </button>

                            {selectedIds.size > 0 && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="text-xs font-normal text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800/40 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete Selected ({selectedIds.size})</span>
                                </button>
                            )}
                        </div>

                        {punches.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-xs font-normal text-slate-400 hover:text-rose-500 transition-colors self-end sm:self-auto cursor-pointer"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Single Punch Rows */}
                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar pr-0.5">
                        {punches.map((p, idx) => {
                            const isChecked = selectedIds.has(p.id);
                            const isBlinkingAlone = hoveredPunchId === p.id;
                            const isBlinkingAsPair = hoveredAuraPairIdx !== null && hoveredAuraPairIdx === p.pairIdx;
                            const isIn = p.type === 'in';
                            const isNormal = p.type === 'normal';

                            return (
                                <div
                                    key={p.id || idx}
                                    onMouseEnter={() => {
                                        setHoveredPunchId(p.id);
                                        setHoveredAuraPairIdx(null);
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredPunchId(null);
                                    }}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                                        isBlinkingAlone
                                            ? (isNormal
                                                ? 'ring-2 ring-amber-400 bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 shadow-xs'
                                                : isIn
                                                    ? 'ring-2 ring-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 shadow-xs'
                                                    : 'ring-2 ring-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 shadow-xs')
                                            : isBlinkingAsPair
                                                ? 'ring-1 ring-emerald-400/80 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400/60 shadow-xs'
                                                : isChecked
                                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/40'
                                                    : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border shadow-2xs hover:border-slate-300'
                                    }`}
                                >
                                    {/* Checkbox + Punch Info with Pixel-Perfect Alignment */}
                                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelect(p.id);
                                            }}
                                            className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0 w-4 flex justify-center"
                                        >
                                            {isChecked ? (
                                                <CheckSquare size={15} className="text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <Square size={15} />
                                            )}
                                        </button>

                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 w-16 shrink-0">
                                            Punch #{idx + 1}
                                        </span>

                                        {/* Punch Type Badge - Consistent Width for Perfect Alignment */}
                                        <span className={`w-28 shrink-0 text-xs font-normal rounded-lg px-2 py-1 border inline-flex items-center justify-center gap-1.5 text-center ${
                                            isNormal
                                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                                                : isIn
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span>{isNormal ? 'Checkpoint' : isIn ? 'Clock IN' : 'Clock OUT'}</span>
                                        </span>

                                        {/* Editable Time Picker - Lets User Write Directly */}
                                        <div className="w-28 sm:w-32 shrink-0">
                                            <TimePicker
                                                value={p.time || ''}
                                                onChange={(newTime) => handleTimeChange(p.id, newTime)}
                                                compact={true}
                                                placeholder="--:--"
                                                align="left"
                                            />
                                        </div>

                                        {/* 12-Hour Formatted Preview */}
                                        <span className="font-mono text-xs font-normal text-slate-400 w-20 shrink-0 hidden sm:inline-block">
                                            ({formatDisplayTime(p.time)})
                                        </span>
                                    </div>

                                    {/* 1-Click Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePunch(p.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all flex items-center gap-1 text-xs font-normal cursor-pointer"
                                        title="Delete this punch"
                                    >
                                        <Trash2 size={14} />
                                        <span className="hidden sm:inline">Delete</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Case 8 Summary Override Banner */}
            {isSummaryOverride && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={14} className="text-amber-500 animate-spin-slow" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                            Summary Override (Direct Lateness / Hours Waiver)
                        </span>
                    </div>
                    <span className="font-mono font-normal text-amber-600 dark:text-amber-400">
                        Late Mins: {requestData?.proposed_data?.late_minutes ?? 0}m
                    </span>
                </div>
            )}
        </div>
    );
}
