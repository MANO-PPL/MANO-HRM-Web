import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Trash2, Plus, X, Clock, AlertCircle, CheckSquare, Square, PlusCircle, Sparkles, ChevronDown } from 'lucide-react';

export default function VisualCorrectionTimeline({ requestData, editable = true, onSessionsChange }) {
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

    // Timeline Configuration (Day: 06:00 AM - 08:00 PM | Night: 08:00 PM - 08:00 AM next day)
    const START_HOUR = isNightShift ? 20 : 6;
    const END_HOUR = isNightShift ? 32 : 20;
    const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
    const ticks = isNightShift ? [20, 22, 24, 26, 28, 30, 32] : [6, 8, 10, 12, 14, 16, 18, 20];

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
        if (!Array.isArray(requestData.original_data)) return [];
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
    }, [requestData]);

    // Flatten initial proposed punches
    const initialProposedPunches = useMemo(() => {
        if (!Array.isArray(requestData.proposed_data)) return [];
        const list = [];
        requestData.proposed_data.forEach((s, sIdx) => {
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
    }, [requestData]);

    const [punches, setPunches] = useState(initialProposedPunches);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [draggingPunchId, setDraggingPunchId] = useState(null);
    const [creatingRange, setCreatingRange] = useState(null);
    const [hoveredAuraPairIdx, setHoveredAuraPairIdx] = useState(null);
    const [hoveredPunchId, setHoveredPunchId] = useState(null);
    const [hoveredMins, setHoveredMins] = useState(null);
    const [warningMsg, setWarningMsg] = useState(null);
    const lastEmittedJsonRef = useRef('');
    const trackRef = useRef(null);

    // Sync from props only when changes originate from outside (not from self emit)
    useEffect(() => {
        const incomingJson = JSON.stringify(requestData.proposed_data || []);
        if (incomingJson !== lastEmittedJsonRef.current && !creatingRange && !draggingPunchId) {
            setPunches(initialProposedPunches);
        }
    }, [initialProposedPunches, creatingRange, draggingPunchId, requestData.proposed_data]);

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

    // Check if a minute sits inside an existing IN ➔ OUT session interval
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
    }, [punches]);

    // ─── POINTER DOWN ON TRACK ───
    const handleTrackPointerDown = (e) => {
        if (!editable || draggingPunchId) return;
        if (e.target.closest('.punch-handle') || e.target.closest('button') || e.target.closest('input')) return;

        const clickedMins = getMinutesFromClientX(e.clientX);

        // Check if user clicked inside an active IN ➔ OUT session
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
    }, [creatingRange, draggingPunchId, getMinutesFromClientX, punches, START_HOUR, END_HOUR]);

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
                // Clicked inside an active session -> CREATE A CHECKPOINT / NORMAL PUNCH!
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
    }, [creatingRange, draggingPunchId, punches]);

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

    // Update punch time directly via typed <input type="time" />
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

    // Toggle/change punch type directly (in / out / normal)
    const handlePunchTypeChange = (punchId, newType) => {
        const updated = punches.map(p => {
            if (p.id !== punchId) return p;
            return { ...p, type: newType };
        });
        const sequenced = resequencePunches(updated);
        setPunches(sequenced);
        emitChanges(sequenced);
    };

    // Add Checkpoint / Normal punch programmatically
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
        setWarningMsg('Drop a Clock IN and Clock OUT first to add a checkpoint between them.');
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
    }, [punches]);

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
    }, [trackAuras]);

    const formatDuration = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m} mins`;
        return `${h}h ${m > 0 ? `${m}m` : ''}`;
    };

    const inCount = punches.filter(p => p.type === 'in').length;
    const outCount = punches.filter(p => p.type === 'out').length;
    const normalCount = punches.filter(p => p.type === 'normal').length;

    const isSummaryOverride = (requestData.correction_type || '').toLowerCase() === 'summary';
    const isAbsent = originalPunches.length === 0;

    return (
        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border/60 rounded-xl p-4 sm:p-5 shadow-xs select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 mb-4 gap-2">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Attendance Correction
                    </h4>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-github-dark-muted mt-0.5">
                        {editable
                            ? 'Click track to drop punch dots, click between any session to add Checkpoints.'
                            : 'Comparison of recorded vs proposed punches'}
                    </p>
                </div>

                {warningMsg && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold"
                    >
                        <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>{warningMsg}</span>
                    </motion.div>
                )}
            </div>

            <div className="space-y-5">
                {/* ─── BEFORE TIMELINE (ROW 1: ORIGINAL RECORDED) ─── */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {isAbsent
                                ? 'Before — no punches recorded'
                                : `Before — ${originalPunches.length} recorded punch${originalPunches.length > 1 ? 'es' : ''}`}
                        </p>
                    </div>

                    <div className="relative pt-7 pb-6 px-4">
                        {/* Axis Line */}
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />

                        {/* Ticks and Labels */}
                        {ticks.map(h => {
                            const pct = getPosPercent(h * 60);
                            const normH = h >= 24 ? h - 24 : h;
                            const displayHour = normH === 0 || normH === 24 ? '12 AM' : normH === 12 ? '12 PM' : normH > 12 ? `${normH - 12} PM` : `${normH} AM`;
                            return (
                                <div key={h} className="absolute top-7 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: `${pct}%` }}>
                                    <div className="w-[1.5px] h-3 bg-slate-400/80 dark:bg-slate-600 -translate-y-1.5 rounded-full" />
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 font-mono">
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
                                    className="absolute top-7 h-6 -translate-y-1/2 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-800/40 pointer-events-none transition-all"
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
                                    className="punch-handle absolute top-7 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-pointer"
                                    style={{ left: `${pct}%` }}
                                    onMouseEnter={() => setHoveredPunchId(`orig-${p.id}`)}
                                    onMouseLeave={() => setHoveredPunchId(null)}
                                >
                                    <AnimatePresence>
                                        {isHovered && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 2, scale: 0.95 }}
                                                animate={{ opacity: 1, y: -32, scale: 1 }}
                                                exit={{ opacity: 0, y: 2, scale: 0.95 }}
                                                className="absolute whitespace-nowrap bg-slate-900 dark:bg-[#1c2128] text-white text-[11px] font-mono font-medium px-2 py-0.5 rounded-md shadow-md border border-slate-700 pointer-events-none z-30 flex items-center gap-1.5"
                                            >
                                                <span className={isNormal ? 'text-amber-400 font-bold' : isIn ? 'text-[#1D9E75] font-bold' : 'text-indigo-400 font-bold'}>
                                                    {isNormal ? 'CHECK:' : isIn ? 'IN:' : 'OUT:'}
                                                </span>
                                                <span>{formatDisplayTime(p.time)}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className={`w-4 h-4 rounded-full shadow-2xs border-2 border-white dark:border-[#161b22] ${isNormal ? 'bg-amber-500' : isIn ? 'bg-[#1D9E75]' : 'bg-indigo-600'
                                        }`} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── AFTER TIMELINE (ROW 2: PROPOSED PUNCHES) ─── */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {requestData.status === 'approved'
                                ? 'After — approved punches'
                                : editable
                                    ? 'After — proposed punches (click track to drop, click session for checkpoint)'
                                    : 'After — proposed punches'}
                        </p>

                        {editable && punches.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                {punches.length} punch{punches.length > 1 ? 'es' : ''}
                            </span>
                        )}
                    </div>

                    {/* Interactive Track Container */}
                    <div
                        ref={trackRef}
                        onPointerDown={handleTrackPointerDown}
                        onMouseMove={(e) => setHoveredMins(getMinutesFromClientX(e.clientX))}
                        onMouseLeave={() => setHoveredMins(null)}
                        className={`relative pt-7 pb-6 px-4 rounded-xl transition-colors ${editable
                            ? 'cursor-crosshair hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'
                            : 'cursor-default'
                            }`}
                    >
                        {/* Axis Line */}
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />

                        {/* Ticks and Labels */}
                        {ticks.map(h => {
                            const pct = getPosPercent(h * 60);
                            const normH = h >= 24 ? h - 24 : h;
                            const displayHour = normH === 0 || normH === 24 ? '12 AM' : normH === 12 ? '12 PM' : normH > 12 ? `${normH - 12} PM` : `${normH} AM`;
                            return (
                                <div key={h} className="absolute top-7 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: `${pct}%` }}>
                                    <div className="w-[1.5px] h-3 bg-slate-400/80 dark:bg-slate-600 -translate-y-1.5 rounded-full" />
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                        {displayHour}
                                    </span>
                                </div>
                            );
                        })}

                        {/* ─── SESSION INTERVAL BAR (AFTER TRACK) ─── */}
                        {trackAuras.map((aura) => {
                            const inPct = getPosPercent(parseMinutes(aura.inP.time));
                            const outPct = getPosPercent(parseMinutes(aura.outP.time));
                            const isMiddleAuraHovered = editable && hoveredAuraPairIdx === aura.pairIdx;

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
                                    className={`group absolute top-7 h-6 -translate-y-1/2 rounded-lg transition-all ${editable
                                        ? `pointer-events-auto cursor-pointer ${isMiddleAuraHovered
                                            ? 'bg-indigo-500/20 dark:bg-indigo-500/25 border border-indigo-400 dark:border-indigo-400 shadow-xs ring-2 ring-indigo-400/20'
                                            : 'bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-300/60 dark:border-indigo-600 hover:border-indigo-400'
                                            }`
                                        : 'bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-800/40 pointer-events-none'
                                        }`}
                                    style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }}
                                >
                                    {/* Middle Hover Prompt to Drop Checkpoint (Editable Only) */}
                                    {editable && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-10 whitespace-nowrap bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md flex items-center gap-1 pointer-events-none z-30">
                                            <PlusCircle size={10} className="text-amber-400" />
                                            <span>Click for Checkpoint</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* ─── LIVE CREATION DRAGGING AURA PREVIEW ─── */}
                        {creatingRange && creatingRange.isDragging && (() => {
                            const sMin = Math.min(creatingRange.startMins, creatingRange.currentMins);
                            const eMin = Math.max(creatingRange.startMins, creatingRange.currentMins);
                            const sPct = getPosPercent(sMin);
                            const ePct = getPosPercent(eMin);

                            return (
                                <>
                                    {/* Glowing Creation Aura */}
                                    <div
                                        className="absolute top-7 h-6 -translate-y-1/2 rounded-lg bg-gradient-to-r from-teal-500/30 to-indigo-500/30 border border-dashed border-teal-400 shadow-md pointer-events-none"
                                        style={{ left: `${sPct}%`, width: `${Math.max(1, ePct - sPct)}%` }}
                                    />

                                    {/* Start Dot (IN) */}
                                    <div className="absolute top-7 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none" style={{ left: `${sPct}%` }}>
                                        <div className="w-5 h-5 rounded-full bg-[#1D9E75] ring-4 ring-teal-400/50 border-2 border-white shadow-md" />
                                    </div>
                                    {/* End Dot (OUT) */}
                                    {eMin > sMin && (
                                        <div className="absolute top-7 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none" style={{ left: `${ePct}%` }}>
                                            <div className="w-5 h-5 rounded-full bg-indigo-600 ring-4 ring-indigo-400/50 border-2 border-white shadow-md" />
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* ─── PROPOSED PUNCH DOTS (INDIVIDUAL HOVER) ─── */}
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
                                    className={`punch-handle absolute top-7 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
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
                                    {/* Sleek Floating Time Badge */}
                                    <AnimatePresence>
                                        {(isDragging || isThisDotHovered) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 2, scale: 0.95 }}
                                                animate={{ opacity: 1, y: -32, scale: 1 }}
                                                exit={{ opacity: 0, y: 2, scale: 0.95 }}
                                                className="absolute whitespace-nowrap bg-slate-900 dark:bg-[#1c2128] text-white text-[11px] font-mono font-medium px-2 py-0.5 rounded-md shadow-md border border-slate-700 pointer-events-none z-40 flex items-center gap-1.5"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? 'bg-amber-400' : isIn ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                                                <span className={isNormal ? 'text-amber-400 font-bold' : isIn ? 'text-emerald-400 font-bold' : 'text-slate-300 font-bold'}>
                                                    {isNormal ? 'CHECK:' : isIn ? 'IN:' : 'OUT:'}
                                                </span>
                                                <span className="font-mono font-medium">{formatDisplayTime(p.time)}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Punch Dot */}
                                    <div className={`w-4 h-4 rounded-full border-2 border-white dark:border-[#161b22] shadow-2xs transition-transform ${isNormal ? 'bg-amber-500' : isIn ? 'bg-[#1D9E75]' : 'bg-indigo-600'
                                        } ${isDragging
                                            ? 'scale-130 ring-2 ring-indigo-400/50'
                                            : isThisDotHovered
                                                ? 'scale-125 ring-2 ring-indigo-400/40'
                                                : isAuraActive
                                                    ? 'scale-110'
                                                    : 'hover:scale-115'
                                        }`} />
                                </div>
                            );
                        })}
                    </div>

                    {/* ─── PURE INDIVIDUAL SINGLE PUNCHES VERTICAL LIST ─── */}
                    {editable && (
                        <div className="pt-2 space-y-2">
                            {/* Actions Toolbar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleToggleSelectAll}
                                        className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        {selectedIds.size === punches.length && punches.length > 0 ? (
                                            <CheckSquare size={13} className="text-teal-600 dark:text-teal-400" />
                                        ) : (
                                            <Square size={13} className="text-slate-400" />
                                        )}
                                        <span>Select All ({punches.length})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleAddCheckpointAtCurrent}
                                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-500/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <PlusCircle size={12} className="text-amber-500" />
                                        <span>Add Checkpoint</span>
                                    </button>

                                    {selectedIds.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleDeleteSelected}
                                            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-500/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Trash2 size={12} />
                                            <span>Delete Selected ({selectedIds.size})</span>
                                        </button>
                                    )}
                                </div>

                                {punches.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors self-end sm:self-auto"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {/* Single Punch Rows */}
                            <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar pr-1">
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
                                            className={`flex items-center justify-between p-2 sm:px-3 sm:py-1.5 rounded-xl transition-all border ${
                                                isBlinkingAlone
                                                    ? (isNormal
                                                        ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-400 shadow-xs'
                                                        : isIn
                                                            ? 'ring-2 ring-teal-400 bg-teal-50 dark:bg-teal-950/60 border-teal-400 shadow-xs'
                                                            : 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 shadow-xs')
                                                    : isBlinkingAsPair
                                                        ? 'ring-1 ring-teal-400/80 bg-teal-50/80 dark:bg-teal-950/50 border-teal-400 shadow-xs'
                                                        : isChecked
                                                            ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/40'
                                                            : 'bg-slate-50/60 dark:bg-[#161b22] border-slate-200/70 dark:border-github-dark-border shadow-2xs hover:border-slate-300'
                                                }`}
                                        >
                                            {/* Checkbox + Punch Info */}
                                            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleSelect(p.id);
                                                    }}
                                                    className="text-slate-400 hover:text-teal-600 transition-colors"
                                                >
                                                    {isChecked ? (
                                                        <CheckSquare size={14} className="text-teal-600 dark:text-teal-400" />
                                                    ) : (
                                                        <Square size={14} />
                                                    )}
                                                </button>

                                                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 w-14">
                                                    Punch #{idx + 1}
                                                </span>

                                                {/* Punch Type Badge */}
                                                <span className={`text-[10px] font-black uppercase tracking-wider rounded-lg px-2 py-0.5 border inline-flex items-center gap-1 ${isNormal
                                                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                    : isIn
                                                        ? 'bg-teal-50 dark:bg-teal-950/30 text-[#1D9E75] border-teal-500/30'
                                                        : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? 'bg-amber-500' : isIn ? 'bg-[#1D9E75]' : 'bg-indigo-600'}`} />
                                                    {isNormal ? 'Checkpoint' : isIn ? 'Clock IN' : 'Clock OUT'}
                                                </span>

                                                {/* Editable Time Input Field */}
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="time"
                                                        value={p.time || ''}
                                                        onChange={(e) => handleTimeChange(p.id, e.target.value)}
                                                        className="bg-white dark:bg-white/10 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-0.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-400 shadow-2xs"
                                                    />
                                                    <span className="font-mono text-[11px] font-bold text-slate-400">
                                                        ({formatDisplayTime(p.time)})
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 1-Click Delete Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePunch(p.id)}
                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all flex items-center gap-1 text-[11px] font-bold"
                                                title="Delete this punch"
                                            >
                                                <Trash2 size={13} />
                                                <span className="hidden sm:inline">Delete</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Case 8 Summary Override Banner */}
            {isSummaryOverride && (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={14} className="text-amber-500 animate-spin-slow" />
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                            Summary Override (Direct Lateness / Hours Waiver)
                        </span>
                    </div>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        Late Mins: {requestData.proposed_data?.late_minutes ?? 0}m
                    </span>
                </div>
            )}
        </div>
    );
}
