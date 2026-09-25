import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertCircle, CheckSquare, Square, PlusCircle, Clock, RefreshCw, X, ChevronLeft, ChevronRight} from 'lucide-react';
import { toast } from 'react-toastify';

function DirectTimeInput({ value, onChange }) {
    const [text, setText] = useState(value || '');
    const inputRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const lastCommittedRef = useRef(value || '');

    // Sync from prop ONLY when input is not actively focused by user
    useEffect(() => {
        if (document.activeElement !== inputRef.current) {
            setText(value || '');
            lastCommittedRef.current = value || '';
        }
    }, [value]);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    const commitChange = useCallback((valToCommit) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (valToCommit && valToCommit !== lastCommittedRef.current) {
            lastCommittedRef.current = valToCommit;
            onChange(valToCommit);
        }
    }, [onChange]);

    const scheduleCommit = (valToCommit) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            commitChange(valToCommit);
        }, 180);
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setText(val);
        if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
            scheduleCommit(val);
        }
    };

    const handleBlur = () => {
        const clean = text.trim();
        if (!clean) {
            setText(lastCommittedRef.current || value || '');
            return;
        }

        let h = NaN;
        let m = NaN;
        if (clean.includes(':')) {
            const parts = clean.split(':');
            h = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        } else if (clean.length === 3) {
            h = parseInt(clean.slice(0, 1), 10);
            m = parseInt(clean.slice(1), 10);
        } else if (clean.length === 4) {
            h = parseInt(clean.slice(0, 2), 10);
            m = parseInt(clean.slice(2), 10);
        } else if (clean.length === 1 || clean.length === 2) {
            h = parseInt(clean, 10);
            m = 0;
        }

        if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            setText(normalized);
            commitChange(normalized);
        } else {
            setText(lastCommittedRef.current || value || '');
        }
    };

    const stepTime = (isDown, isShift = false) => {
        let clean = text.trim();
        let h = 0;
        let m = 0;
        if (clean.includes(':')) {
            const parts = clean.split(':');
            h = parseInt(parts[0], 10) || 0;
            m = parseInt(parts[1], 10) || 0;
        } else if (clean.length === 4) {
            h = parseInt(clean.slice(0, 2), 10) || 0;
            m = parseInt(clean.slice(2), 10) || 0;
        } else {
            h = parseInt(clean, 10) || 0;
        }

        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));

        const el = inputRef.current;
        const selStart = el?.selectionStart ?? 3;
        const selEnd = el?.selectionEnd ?? 5;

        // Is targeting Hours or Minutes?
        // If selection is whole string [0, 5], default to minutes.
        // If cursor/selection is <= 2 (before or on ':'), target hours.
        const isWholeSelected = selStart === 0 && selEnd >= 4;
        const isHour = !isWholeSelected && selStart <= 2 && selEnd <= 2;

        let nextSelStart = selStart;
        let nextSelEnd = selEnd;

        if (isHour) {
            const step = isShift ? 5 : 1;
            h = isDown ? (h - step + 24) % 24 : (h + step) % 24;
            if (selStart !== selEnd) {
                nextSelStart = 0;
                nextSelEnd = 2;
            } else {
                nextSelStart = Math.min(2, selStart);
                nextSelEnd = nextSelStart;
            }
        } else {
            const step = isShift ? 15 : 1;
            m = isDown ? (m - step + 60) % 60 : (m + step) % 60;
            if (isWholeSelected || selStart !== selEnd) {
                nextSelStart = 3;
                nextSelEnd = 5;
            } else {
                nextSelStart = Math.max(3, selStart);
                nextSelEnd = nextSelStart;
            }
        }

        const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setText(normalized);

        // Schedule debounced commit for smooth, blazing fast repeat
        scheduleCommit(normalized);

        // Keep selection and focus strictly on this element immediately
        if (el) {
            el.setSelectionRange(nextSelStart, nextSelEnd);
        }
        requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.setSelectionRange(nextSelStart, nextSelEnd);
            }
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
            e.target.blur();
            return;
        }
        if (e.key === 'Escape') {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            setText(lastCommittedRef.current || value || '');
            e.target.blur();
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            stepTime(false, e.shiftKey);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            stepTime(true, e.shiftKey);
            return;
        }

        // Seamless segment navigation with Left / Right
        if (e.key === 'ArrowLeft' && e.target.selectionStart === 3 && e.target.selectionEnd === 5) {
            e.preventDefault();
            inputRef.current?.setSelectionRange(0, 2);
            return;
        }
        if (e.key === 'ArrowRight' && e.target.selectionStart === 0 && e.target.selectionEnd === 2) {
            e.preventDefault();
            inputRef.current?.setSelectionRange(3, 5);
            return;
        }
    };

    return (
        <div className="relative flex items-center w-full group/time">
            <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                    // Select minute digits by default for rapid arrow key incrementing
                    if (e.target.value.length === 5) {
                        e.target.setSelectionRange(3, 5);
                    } else {
                        e.target.select();
                    }
                }}
                placeholder="00:00"
                maxLength={5}
                title="Use ↑/↓ arrow keys to adjust time (Shift for ±15m / ±5h, ←/→ to switch HH:MM)"
                className="w-full px-2 py-1 text-xs font-mono font-medium text-center rounded-lg border border-slate-200 dark:border-github-dark-border bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all tracking-wider"
            />
            <div className="hidden group-hover/time:flex group-focus-within/time:flex flex-col absolute right-1 inset-y-1 justify-center z-10 bg-white/90 dark:bg-dark-card/90 rounded-r-md pl-0.5">
                <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                        // Prevent button click from taking focus away from input
                        e.preventDefault();
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        stepTime(false, e.shiftKey);
                    }}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer p-0.5 leading-none transition-colors"
                    title="Increment (Shift: +15m / +5h)"
                    aria-label="Increment"
                >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
                <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                        // Prevent button click from taking focus away from input
                        e.preventDefault();
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        stepTime(true, e.shiftKey);
                    }}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer p-0.5 leading-none transition-colors"
                    title="Decrement (Shift: -15m / -5h)"
                    aria-label="Decrement"
                >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default function VisualCorrectionTimeline({
    requestData,
    editable = true,
    onSessionsChange,
    onIncompleteChange,
    className = '',
    showOriginalOnly = false,
    shift = null,
    onRemoveOriginalPunch = null,
    frameless = false,
    hideHeader = false,
    scale = 1
}) {
    if (!requestData) return null;

    // Timeline Configuration: Full 24-Hour Timeline (00:00 - 24:00)
    const START_HOUR = 0;
    const END_HOUR = 24;
    const TOTAL_MINUTES = 24 * 60; // 1440 minutes

    // Hourly ticks: 0 to 24 (25 tick marks)
    const hourlyTicks = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

    // Checkpoint detection helper
    const isCheckpointPunch = useCallback((p) => {
        if (!p) return false;
        if (p.is_checkpoint === true) return true;
        const type = String(p.type || p.punch_type || '').toLowerCase().trim();
        return ['normal', 'checkpoint', 'normal_punch', 'checkpoint_punch'].includes(type);
    }, []);

    // Time conversion helpers
    const parseMinutes = useCallback((timeStr) => {
        if (!timeStr) return null;
        const clean = String(timeStr).trim();
        const timePart = clean.includes(' ') ? clean.split(' ')[1] : (clean.includes('T') ? clean.split('T')[1] : clean);
        const [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return null;
        return (h % 24) * 60 + (isNaN(m) ? 0 : m);
    }, []);

    const minutesToTimeStr = useCallback((totalMins) => {
        const clamped = Math.max(0, Math.min(1439, totalMins));
        let h = Math.floor(clamped / 60);
        if (h >= 24) h = 0;
        const m = clamped % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }, []);

    const formatDisplayTime = useCallback((timeStr) => {
        if (!timeStr) return '--:--';
        const clean = String(timeStr).trim();
        const timePart = clean.includes(' ') ? clean.split(' ')[1] : (clean.includes('T') ? clean.split('T')[1] : clean);
        const [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return '--:--';
        const period = h >= 12 && h < 24 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return `${displayH}:${String(m || 0).padStart(2, '0')} ${period}`;
    }, []);

    const getPosPercent = useCallback((mins) => {
        if (mins === null || isNaN(mins)) return 0;
        const clamped = Math.max(0, Math.min(1440, mins));
        return (clamped / 1440) * 100;
    }, []);

    // Helper to safely extract HH:MM string from time string or timestamp
    const extractTimeStr = useCallback((val) => {
        if (!val) return '';
        const mins = parseMinutes(val);
        if (mins === null) return '';
        return minutesToTimeStr(mins);
    }, [parseMinutes, minutesToTimeStr]);

    // Flatten original punches (Read-Only Reference)
    const originalPunches = useMemo(() => {
        if (!Array.isArray(requestData?.original_data)) return [];
        const times = [];
        requestData.original_data.forEach((s, sIdx) => {
            if (isCheckpointPunch(s)) {
                const t = extractTimeStr(s.time_in || s.time || s.punch_time);
                if (t) {
                    times.push({
                        id: s.id || `orig-chk-${sIdx}`,
                        time: t,
                        type: 'normal',
                        address: s.address || '',
                        raw: s
                    });
                }
            } else {
                if (s.time_in) {
                    const t = extractTimeStr(s.time_in);
                    if (t) times.push({ id: `orig-${sIdx}-in`, time: t, type: 'in', raw: s });
                }
                const chkList = Array.isArray(s.checkpoints) ? s.checkpoints : (Array.isArray(s.raw_checkpoints) ? s.raw_checkpoints : []);
                chkList.forEach((chk, cIdx) => {
                    const t = extractTimeStr(chk.punch_time || chk.time || chk.time_in);
                    if (t) {
                        times.push({
                            id: chk.id ? `orig-chk-${chk.id}` : `orig-${sIdx}-chk-${cIdx}`,
                            time: t,
                            type: 'normal',
                            address: chk.address || '',
                            raw: chk
                        });
                    }
                });
                if (s.time_out) {
                    const t = extractTimeStr(s.time_out);
                    if (t) times.push({ id: `orig-${sIdx}-out`, time: t, type: 'out', raw: s });
                }
            }
        });
        const sorted = times.sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        let boundaryIdx = 0;
        return sorted.map((p, idx) => {
            if (isCheckpointPunch(p) || p.type === 'normal') {
                return {
                    id: p.id || `orig-${idx}`,
                    time: p.time,
                    type: 'normal',
                    pairIdx: Math.floor(boundaryIdx / 2),
                    address: p.address,
                    raw: p.raw
                };
            }
            const assignedType = p.type || (boundaryIdx % 2 === 0 ? 'in' : 'out');
            const assignedPair = Math.floor(boundaryIdx / 2);
            boundaryIdx++;
            return {
                id: p.id || `orig-${idx}`,
                time: p.time,
                type: assignedType,
                pairIdx: assignedPair,
                address: p.address,
                raw: p.raw
            };
        });
    }, [requestData, parseMinutes, extractTimeStr, isCheckpointPunch]);

    // Resequence ONLY boundary punches (preserving normal checkpoints strictly)
    const resequencePunches = useCallback((punchList) => {
        const sorted = [...punchList].sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        let boundaryIndex = 0;
        let currentPairIdx = 0;

        return sorted.map((p) => {
            if (isCheckpointPunch(p) || p.type === 'normal') {
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
    }, [parseMinutes, isCheckpointPunch]);

    // Extract map of original recorded boundary punches: key -> { origKey, origTime, origType, pairIdx }
    const originalBoundaryPunches = useMemo(() => {
        const map = new Map();
        const boundary = originalPunches.filter(p => p.type !== 'normal');
        boundary.forEach((p, idx) => {
            const pairIdx = p.pairIdx ?? Math.floor(idx / 2);
            const type = p.type;
            const key = `orig-${pairIdx}-${type}`;
            map.set(key, {
                origKey: key,
                origTime: p.time,
                origType: type,
                pairIdx: pairIdx,
                id: p.id
            });
        });
        return map;
    }, [originalPunches]);

    // Helper: Find matching original boundary punch for a given punch
    const findOrigForPunch = useCallback((punch, punchList) => {
        if (!punch) return null;
        if (punch.origKey && originalBoundaryPunches.has(punch.origKey)) {
            return originalBoundaryPunches.get(punch.origKey);
        }
        for (const orig of originalBoundaryPunches.values()) {
            if (orig.origType === punch.type && (orig.pairIdx === punch.pairIdx || orig.origTime === punch.origTime || orig.origTime === punch.time)) {
                return orig;
            }
        }
        const nonNormals = (punchList || []).filter(p => p.type === punch.type);
        const idx = nonNormals.findIndex(p => p.id === punch.id);
        const origMatches = Array.from(originalBoundaryPunches.values()).filter(o => o.origType === punch.type);
        if (idx !== -1 && origMatches[idx]) {
            return origMatches[idx];
        }
        return null;
    }, [originalBoundaryPunches]);

    // Flatten initial proposed punches with STABLE IDs (never incorporating p.time!)
    const initialProposedPunches = useMemo(() => {
        let proposedList = Array.isArray(requestData?.proposed_data) ? requestData.proposed_data : [];
        if (proposedList.length === 0 && !editable && Array.isArray(requestData?.original_data) && requestData.original_data.length > 0) {
            // When user sent request without checking advanced option, show the starting punch originally recorded
            proposedList = requestData.original_data;
        }
        if (proposedList.length === 0) return [];
        const list = [];
        proposedList.forEach((s, sIdx) => {
            if (isCheckpointPunch(s)) {
                const t = extractTimeStr(s.time_in || s.time || s.punch_time);
                if (t) {
                    list.push({
                        id: s.inPunchId || (s.id ? `${s.id}` : `p-chk-${sIdx}`),
                        time: t,
                        type: 'normal',
                        address: s.address || '',
                        isConvertedFromOrig: Boolean(s.isConvertedFromOrig),
                        origKey: s.origKey || null,
                        origTime: s.origTime || null,
                        origType: s.origType || null,
                        raw: s
                    });
                }
            } else {
                if (s.time_in) {
                    const t = extractTimeStr(s.time_in);
                    if (t) {
                        const origIn = originalBoundaryPunches.get(`orig-${sIdx}-in`);
                        list.push({
                            id: s.inPunchId || (s.id ? `${s.id}-in` : `p-sess-${sIdx}-in`),
                            time: t,
                            type: 'in',
                            origKey: origIn?.origKey || `orig-${sIdx}-in`,
                            origTime: origIn?.origTime || t,
                            origType: 'in',
                            pairIdx: sIdx,
                            isAltered: origIn ? (t !== origIn.origTime) : false,
                            raw: s
                        });
                    }
                }
                const chkList = Array.isArray(s.checkpoints) ? s.checkpoints : (Array.isArray(s.raw_checkpoints) ? s.raw_checkpoints : []);
                chkList.forEach((chk, cIdx) => {
                    const t = extractTimeStr(chk.punch_time || chk.time || chk.time_in);
                    if (t) {
                        list.push({
                            id: chk.id ? `p-chk-${chk.id}` : (s.id ? `${s.id}-chk-${cIdx}` : `p-sess-${sIdx}-chk-${cIdx}`),
                            time: t,
                            type: 'normal',
                            address: chk.address || '',
                            isConvertedFromOrig: Boolean(chk.isConvertedFromOrig),
                            origKey: chk.origKey || null,
                            origTime: chk.origTime || null,
                            origType: chk.origType || null,
                            raw: chk
                        });
                    }
                });
                if (s.time_out) {
                    const t = extractTimeStr(s.time_out);
                    if (t) {
                        const origOut = originalBoundaryPunches.get(`orig-${sIdx}-out`);
                        list.push({
                            id: s.outPunchId || (s.id ? `${s.id}-out` : `p-sess-${sIdx}-out`),
                            time: t,
                            type: 'out',
                            origKey: origOut?.origKey || `orig-${sIdx}-out`,
                            origTime: origOut?.origTime || t,
                            origType: 'out',
                            pairIdx: sIdx,
                            isAltered: origOut ? (t !== origOut.origTime) : false,
                            raw: s
                        });
                    }
                }
            }
        });
        const sorted = list.sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        return resequencePunches(sorted);
    }, [requestData, parseMinutes, extractTimeStr, resequencePunches, isCheckpointPunch, editable, originalBoundaryPunches]);

    const [punches, setPunches] = useState(initialProposedPunches);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [draggingPunchId, setDraggingPunchId] = useState(null);
    const [creatingRange, setCreatingRange] = useState(null);
    const [hoveredSessionIdx, setHoveredSessionIdx] = useState(null);
    const [hoveredPunchId, setHoveredPunchId] = useState(null);
    const [hoveredMins, setHoveredMins] = useState(null);
    const [pendingSessionStart, setPendingSessionStart] = useState(null);
    const [warningMsg, setWarningMsg] = useState(null);
    const lastEmittedJsonRef = useRef('');
    const trackRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const lastClickRef = useRef({ id: null, time: 0 });
    const hasInitiallyScrolledRef = useRef(false);
    const prevDateRef = useRef(requestData?.request_date || requestData?.date || '');
    const dismissedCheckpointsRef = useRef(new Set());

    // Reset initial scroll flag and dismissed checkpoints if date changes
    useEffect(() => {
        const curDate = requestData?.request_date || requestData?.date || '';
        if (curDate && curDate !== prevDateRef.current) {
            prevDateRef.current = curDate;
            hasInitiallyScrolledRef.current = false;
            dismissedCheckpointsRef.current.clear();
        }
    }, [requestData?.request_date, requestData?.date]);

    // Cancel pending session creation on Escape key
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape' && pendingSessionStart !== null) {
                setPendingSessionStart(null);
                setWarningMsg('Session creation cancelled');
                setTimeout(() => setWarningMsg(null), 2000);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [pendingSessionStart]);

    // Sync from props only when changes originate from outside and user is not actively editing
    useEffect(() => {
        const incomingJson = JSON.stringify(requestData?.proposed_data || []);
        const isEditingInput = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (incomingJson !== lastEmittedJsonRef.current && !creatingRange && !draggingPunchId && !isEditingInput && pendingSessionStart === null) {
            setPunches(initialProposedPunches);
        }
    }, [initialProposedPunches, creatingRange, draggingPunchId, pendingSessionStart, requestData?.proposed_data]);

    // Smooth scroll to position 8:00 AM at the start of the visible viewport
    const scrollToTime = useCallback((startMins = 480) => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        if (scrollWidth > clientWidth) {
            // Position startMins (default 8:00 AM) right at the left edge of view
            const targetX = (startMins / 1440) * scrollWidth;
            container.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        }
    }, []);

    // Auto-scroll ONCE on mount (or date change) to start from 8:00 AM
    // Will not snap the user back while they are manually scrolling
    useEffect(() => {
        if (hasInitiallyScrolledRef.current) return;
        const timer = setTimeout(() => {
            if (!scrollContainerRef.current || hasInitiallyScrolledRef.current) return;
            hasInitiallyScrolledRef.current = true;
            let focusMins = 480; // Default 08:00 AM at left edge
            if (originalPunches.length > 0) {
                const pm = parseMinutes(originalPunches[0].time);
                if (pm !== null && pm < 480) {
                    focusMins = Math.max(0, Math.floor(pm / 60) * 60);
                }
            }
            scrollToTime(focusMins);
        }, 150);
        return () => clearTimeout(timer);
    }, [shift, originalPunches, scrollToTime, parseMinutes]);

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

    // Group proposed punches chronologically into sessions (IN -> [intermediate checkpoints] -> OUT)
    const proposedSessions = useMemo(() => {
        const sorted = [...punches].sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
        const result = [];
        let curIn = null;
        let curCheckpoints = [];

        sorted.forEach(p => {
            if (p.type === 'in') {
                if (curIn) {
                    result.push({
                        sessionIdx: result.length,
                        inP: curIn,
                        outP: null,
                        checkpoints: curCheckpoints,
                        punches: [curIn, ...curCheckpoints]
                    });
                } else if (curCheckpoints.length > 0) {
                    result.push({
                        sessionIdx: result.length,
                        inP: null,
                        outP: null,
                        isCheckpointOnly: true,
                        checkpoints: curCheckpoints,
                        punches: [...curCheckpoints]
                    });
                }
                curIn = p;
                curCheckpoints = [];
            } else if (isCheckpointPunch(p) || p.type === 'normal') {
                curCheckpoints.push(p);
            } else if (p.type === 'out') {
                if (curIn) {
                    result.push({
                        sessionIdx: result.length,
                        inP: curIn,
                        outP: p,
                        checkpoints: curCheckpoints,
                        punches: [curIn, ...curCheckpoints, p]
                    });
                    curIn = null;
                    curCheckpoints = [];
                } else {
                    result.push({
                        sessionIdx: result.length,
                        inP: null,
                        outP: p,
                        checkpoints: curCheckpoints,
                        punches: [...curCheckpoints, p]
                    });
                    curCheckpoints = [];
                }
            }
        });

        if (curIn) {
            result.push({
                sessionIdx: result.length,
                inP: curIn,
                outP: null,
                checkpoints: curCheckpoints,
                punches: [curIn, ...curCheckpoints]
            });
        } else if (curCheckpoints.length > 0) {
            result.push({
                sessionIdx: result.length,
                inP: null,
                outP: null,
                isCheckpointOnly: true,
                checkpoints: curCheckpoints,
                punches: [...curCheckpoints]
            });
        }

        return result;
    }, [punches, parseMinutes, isCheckpointPunch]);

    // Map each punch ID to its session index so all punches in a session can be linked
    const punchSessionMap = useMemo(() => {
        const map = new Map();
        proposedSessions.forEach(s => {
            s.punches.forEach(p => {
                map.set(p.id, s.sessionIdx);
            });
        });
        return map;
    }, [proposedSessions]);

    // Track auras for interval spans on track (closed IN -> OUT sessions)
    const trackAuras = useMemo(() => {
        return proposedSessions
            .filter(s => s.inP && s.outP)
            .map(s => ({
                sessionIdx: s.sessionIdx,
                pairIdx: s.sessionIdx,
                inP: s.inP,
                outP: s.outP,
                punches: s.punches,
                checkpoints: s.checkpoints
            }));
    }, [proposedSessions]);

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

    const formatDuration = useCallback((mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        return `${h}h ${m > 0 ? `${m}m` : ''}`;
    }, []);

    // Check if a session was newly created (not matching any organic punch pair from original_data)
    const isNewlyCreatedSession = useCallback((session) => {
        if (!session) return false;
        return !originalPunchPairs.some(pair => {
            const matchesIn = pair.inPunch && session.inP && parseMinutes(pair.inPunch.time) === parseMinutes(session.inP.time);
            const matchesOut = pair.outPunch && session.outP && parseMinutes(pair.outPunch.time) === parseMinutes(session.outP.time);
            return Boolean(matchesIn || matchesOut);
        });
    }, [originalPunchPairs, parseMinutes]);

    // Check if there is an incomplete session in the proposed punches (missing OUT or missing IN)
    const incompleteSession = useMemo(() => {
        return proposedSessions.find(s => !s.isCheckpointOnly && ((s.inP && !s.outP) || (!s.inP && s.outP))) || null;
    }, [proposedSessions]);

    // Notify parent whenever incomplete status changes (incomplete session or pending 2-click creation)
    const isIncomplete = Boolean(incompleteSession || pendingSessionStart !== null);
    useEffect(() => {
        if (onIncompleteChange) {
            onIncompleteChange(isIncomplete);
        }
    }, [isIncomplete, onIncompleteChange]);

    const getMinutesFromClientX = useCallback((clientX) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const pct = offsetX / rect.width;
        const rawMinutes = pct * TOTAL_MINUTES;
        return Math.round(rawMinutes / 5) * 5;
    }, [TOTAL_MINUTES]);


    // Emit updated punches paired chronologically for parent / backend
    const emitChanges = (updatedPunches) => {
        const sequenced = resequencePunches(updatedPunches);
        const paired = [];
        let curIn = null;
        let curInPunchId = null;

        for (const p of sequenced) {
            if (isCheckpointPunch(p) || p.type === 'normal') {
                paired.push({ id: `normal-${paired.length}`, time_in: p.time, time_out: '', punch_type: 'normal', inPunchId: p.id, address: p.address || '' });
            } else if (p.type === 'in') {
                if (curIn !== null) {
                    paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: '', punch_type: 'regular', inPunchId: curInPunchId });
                }
                curIn = p.time;
                curInPunchId = p.id;
            } else if (p.type === 'out') {
                if (curIn !== null) {
                    paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: p.time, punch_type: 'regular', inPunchId: curInPunchId, outPunchId: p.id });
                    curIn = null;
                    curInPunchId = null;
                } else {
                    paired.push({ id: `sess-${paired.length}`, time_in: '', time_out: p.time, punch_type: 'regular', outPunchId: p.id });
                }
            }
        }
        if (curIn !== null) {
            paired.push({ id: `sess-${paired.length}`, time_in: curIn, time_out: '', punch_type: 'regular', inPunchId: curInPunchId });
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

    // Check if a proposed interval [startM, endM] collides with existing punches or sessions
    const checkSpanCollision = useCallback((startM, endM) => {
        // 1. Any punch strictly inside span or coincides with endpoints
        const collidesPunch = punches.some(p => {
            const pM = parseMinutes(p.time);
            return pM !== null && ((pM > startM && pM < endM) || Math.abs(pM - startM) < 5 || Math.abs(pM - endM) < 5);
        });
        if (collidesPunch) return true;

        // 2. Any existing IN -> OUT session interval overlapping with [startM, endM]
        const boundary = punches
            .filter(p => p.type !== 'normal')
            .sort((a, b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));

        for (let i = 0; i < boundary.length; i += 2) {
            const inP = boundary[i];
            const outP = boundary[i + 1];
            if (inP && outP && inP.type === 'in' && outP.type === 'out') {
                const inM = parseMinutes(inP.time);
                const outM = parseMinutes(outP.time);
                if (inM !== null && outM !== null && startM < outM && endM > inM) {
                    return true;
                }
            }
        }
        return false;
    }, [punches, parseMinutes]);

    // Helper: Check if a clicked minute can complete an incomplete session's missing OUT punch
    const canCompleteIncompleteOut = useCallback((clickedMins) => {
        if (!incompleteSession || !incompleteSession.inP || incompleteSession.outP) return false;
        const inM = parseMinutes(incompleteSession.inP.time);
        if (inM === null || clickedMins <= inM + 5) return false;

        // Must not be too close to an existing punch
        const isTooClose = punches.some(p => {
            const pM = parseMinutes(p.time);
            return pM !== null && Math.abs(pM - clickedMins) < 5;
        });
        if (isTooClose) return false;

        // No boundary punches (in/out) between inM and clickedMins
        const hasBoundaryInside = punches.some(p => {
            if (p.type === 'normal') return false;
            const pM = parseMinutes(p.time);
            return pM !== null && pM > inM && pM <= clickedMins;
        });
        if (hasBoundaryInside) return false;

        // No other closed sessions overlap [inM, clickedMins]
        for (const session of proposedSessions) {
            if (session.inP && session.outP && session !== incompleteSession) {
                const sIn = parseMinutes(session.inP.time);
                const sOut = parseMinutes(session.outP.time);
                if (sIn !== null && sOut !== null && inM < sOut && clickedMins > sIn) {
                    return false;
                }
            }
        }

        return true;
    }, [incompleteSession, punches, parseMinutes, proposedSessions]);

    // Helper: Check if a clicked minute can complete an incomplete session's missing IN punch
    const canCompleteIncompleteIn = useCallback((clickedMins) => {
        if (!incompleteSession || incompleteSession.inP || !incompleteSession.outP) return false;
        const outM = parseMinutes(incompleteSession.outP.time);
        if (outM === null || clickedMins >= outM - 5) return false;

        const isTooClose = punches.some(p => {
            const pM = parseMinutes(p.time);
            return pM !== null && Math.abs(pM - clickedMins) < 5;
        });
        if (isTooClose) return false;

        const hasBoundaryInside = punches.some(p => {
            if (p.type === 'normal') return false;
            const pM = parseMinutes(p.time);
            return pM !== null && pM >= clickedMins && pM < outM;
        });
        if (hasBoundaryInside) return false;

        for (const session of proposedSessions) {
            if (session.inP && session.outP && session !== incompleteSession) {
                const sIn = parseMinutes(session.inP.time);
                const sOut = parseMinutes(session.outP.time);
                if (sIn !== null && sOut !== null && clickedMins < sOut && outM > sIn) {
                    return false;
                }
            }
        }

        return true;
    }, [incompleteSession, punches, parseMinutes, proposedSessions]);

    // Pointer down on track
    const handleTrackPointerDown = (e) => {
        if (!editable || draggingPunchId) return;
        if (e.target.closest('.punch-handle') || e.target.closest('button') || e.target.closest('input')) return;

        const clickedMins = getMinutesFromClientX(e.clientX);

        // If user clicked on/near the pending session start marker -> Cancel
        if (pendingSessionStart !== null && Math.abs(clickedMins - pendingSessionStart) < 10) {
            setPendingSessionStart(null);
            setWarningMsg('Cancelled session creation');
            setTimeout(() => setWarningMsg(null), 2000);
            return;
        }

        // Check if user clicked inside an active session
        const insideSession = findInsideSession(clickedMins);

        if (pendingSessionStart !== null && insideSession) {
            setWarningMsg('Cannot set session boundary inside an existing session.');
            setTimeout(() => setWarningMsg(null), 2500);
            return;
        }

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

        const completesIncompleteOut = pendingSessionStart === null && !insideSession && canCompleteIncompleteOut(clickedMins);
        const completesIncompleteIn = pendingSessionStart === null && !insideSession && canCompleteIncompleteIn(clickedMins);

        setCreatingRange({
            startMins: clickedMins,
            currentMins: clickedMins,
            isDragging: false,
            isInsideSession: !!insideSession,
            sessionPairIdx: insideSession ? insideSession.pairIdx : null,
            completesIncompleteOut,
            completesIncompleteIn
        });
    };

    // Helper: When adjusting start time or end time, convert original recorded time into a checkpoint,
    // or if adjusted back to original time, remove the duplicate converted checkpoint
    const applyOriginalCheckpointConversion = useCallback((basePunches, targetPunchId, newTimeStr) => {
        const targetPunch = basePunches.find(p => p.id === targetPunchId);
        if (!targetPunch || targetPunch.type === 'normal') {
            return basePunches.map(p => p.id === targetPunchId ? { ...p, time: newTimeStr } : p);
        }

        const origInfo = findOrigForPunch(targetPunch, basePunches);
        let updated = basePunches.map(p => {
            if (p.id !== targetPunchId) return p;
            return {
                ...p,
                time: newTimeStr,
                origKey: origInfo?.origKey || p.origKey,
                origTime: origInfo?.origTime || p.origTime,
                origType: origInfo?.origType || p.type,
                isAltered: origInfo ? (newTimeStr !== origInfo.origTime) : false
            };
        });

        if (origInfo) {
            const { origKey, origTime, origType, pairIdx } = origInfo;
            const isTimeAltered = (newTimeStr !== origTime);

            if (isTimeAltered) {
                const checkpointExists = updated.some(p =>
                    (p.origKey === origKey && p.type === 'normal') ||
                    (p.time === origTime && p.type === 'normal')
                );

                if (!checkpointExists && !dismissedCheckpointsRef.current.has(origKey)) {
                    const convertedCheckpoint = {
                        id: `chk-conv-${origKey}`,
                        time: origTime,
                        type: 'normal',
                        isConvertedFromOrig: true,
                        origKey: origKey,
                        origTime: origTime,
                        origType: origType,
                        pairIdx: pairIdx ?? targetPunch.pairIdx,
                        address: targetPunch.address || ''
                    };
                    updated.push(convertedCheckpoint);
                    if (typeof toast !== 'undefined') {
                        toast.info(`Converted original ${origType === 'in' ? 'Clock IN' : 'Clock OUT'} (${formatDisplayTime(origTime)}) to a Checkpoint`, { autoClose: 2500 });
                    }
                }
            } else {
                updated = updated.filter(p => !(p.origKey === origKey && p.type === 'normal' && p.isConvertedFromOrig));
                dismissedCheckpointsRef.current.delete(origKey);
            }
        }

        return updated;
    }, [findOrigForPunch, formatDisplayTime]);

    const handlePointerMove = useCallback((e) => {
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const currentMins = getMinutesFromClientX(clientX);
        setHoveredMins(currentMins);

        // Auto-scroll when dragging near viewport edges
        if (scrollContainerRef.current && (draggingPunchId || creatingRange)) {
            const cRect = scrollContainerRef.current.getBoundingClientRect();
            const edgeThreshold = 45;
            if (clientX < cRect.left + edgeThreshold) {
                scrollContainerRef.current.scrollLeft -= 14;
            } else if (clientX > cRect.right - edgeThreshold) {
                scrollContainerRef.current.scrollLeft += 14;
            }
        }

        // 1. Dragging across track to create a punch pair (IN & OUT)
        if (creatingRange) {
            const diff = Math.abs(currentMins - creatingRange.startMins);
            const willDrag = (!creatingRange.isInsideSession && diff >= 10) || creatingRange.isDragging;
            if (willDrag && pendingSessionStart !== null) {
                setPendingSessionStart(null);
            }
            setCreatingRange(prev => prev ? {
                ...prev,
                currentMins,
                isDragging: willDrag
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

            const minMins = prevPunch ? (parseMinutes(prevPunch.time) + 5) : 0;
            const maxMins = nextPunch ? (parseMinutes(nextPunch.time) - 5) : 1435;

            const clampedMins = Math.max(minMins, Math.min(maxMins, currentMins));

            const updated = punches.map(p => {
                if (p.id !== draggingPunchId) return p;
                return { ...p, time: minutesToTimeStr(clampedMins) };
            });

            setPunches(resequencePunches(updated));
        }
    }, [creatingRange, draggingPunchId, getMinutesFromClientX, punches, parseMinutes, minutesToTimeStr, pendingSessionStart, resequencePunches]);

    const handlePointerUp = useCallback(() => {
        if (creatingRange) {
            const rawStart = Math.min(creatingRange.startMins, creatingRange.currentMins);
            const rawEnd = Math.max(creatingRange.startMins, creatingRange.currentMins);
            const isRange = creatingRange.isDragging && (rawEnd - rawStart >= 15);

            if (isRange) {
                // Dragged to create an IN & OUT pair
                if (pendingSessionStart !== null) {
                    setPendingSessionStart(null);
                }
                const collides = checkSpanCollision(rawStart, rawEnd);

                if (collides) {
                    setWarningMsg('Cannot span across or overlap existing sessions/punches.');
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
                if (pendingSessionStart !== null) {
                    setPendingSessionStart(null);
                }
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
            } else if (creatingRange.completesIncompleteOut && incompleteSession?.inP) {
                // Single click to complete missing Clock OUT for missed punch session!
                if (pendingSessionStart !== null) {
                    setPendingSessionStart(null);
                }
                const newOut = {
                    id: `p-${Date.now()}-out`,
                    time: minutesToTimeStr(creatingRange.startMins),
                    type: 'out'
                };
                const next = resequencePunches([...punches, newOut]);
                setPunches(next);
                emitChanges(next);
                setHoveredPunchId(newOut.id);
                if (typeof toast !== 'undefined') {
                    toast.success(`Completed session: ${formatDisplayTime(incompleteSession.inP.time)} – ${formatDisplayTime(newOut.time)}`, { autoClose: 2500 });
                }
            } else if (creatingRange.completesIncompleteIn && incompleteSession?.outP) {
                // Single click to complete missing Clock IN!
                if (pendingSessionStart !== null) {
                    setPendingSessionStart(null);
                }
                const newIn = {
                    id: `p-${Date.now()}-in`,
                    time: minutesToTimeStr(creatingRange.startMins),
                    type: 'in'
                };
                const next = resequencePunches([...punches, newIn]);
                setPunches(next);
                emitChanges(next);
                setHoveredPunchId(newIn.id);
                if (typeof toast !== 'undefined') {
                    toast.success(`Completed session: ${formatDisplayTime(newIn.time)} – ${formatDisplayTime(incompleteSession.outP.time)}`, { autoClose: 2500 });
                }
            } else if (pendingSessionStart !== null) {
                // Second click of 2-click session creation!
                const startM = Math.min(pendingSessionStart, creatingRange.startMins);
                const endM = Math.max(pendingSessionStart, creatingRange.startMins);

                if (endM - startM < 10) {
                    setWarningMsg('Session duration must be at least 10 minutes.');
                    setTimeout(() => setWarningMsg(null), 2500);
                    setCreatingRange(null);
                    return;
                }

                const collides = checkSpanCollision(startM, endM);

                if (collides) {
                    setWarningMsg('Cannot span across or overlap existing sessions/punches.');
                    setTimeout(() => setWarningMsg(null), 2500);
                } else {
                    const newIn = { id: `p-${Date.now()}-1`, time: minutesToTimeStr(startM), type: 'in' };
                    const newOut = { id: `p-${Date.now()}-2`, time: minutesToTimeStr(endM), type: 'out' };
                    const next = resequencePunches([...punches, newIn, newOut]);
                    setPunches(next);
                    emitChanges(next);
                    setPendingSessionStart(null);
                    if (typeof toast !== 'undefined') {
                        toast.success(`Created session: ${formatDisplayTime(newIn.time)} – ${formatDisplayTime(newOut.time)}`, { autoClose: 2500 });
                    }
                }
            } else {
                // First click of 2-click session creation!
                setPendingSessionStart(creatingRange.startMins);
            }
            setCreatingRange(null);
        }

        if (draggingPunchId) {
            const draggedPunch = punches.find(p => p.id === draggingPunchId);
            let nextPunches = punches;
            if (draggedPunch && draggedPunch.type !== 'normal') {
                nextPunches = applyOriginalCheckpointConversion(punches, draggingPunchId, draggedPunch.time);
            }
            setDraggingPunchId(null);
            const sequenced = resequencePunches(nextPunches);
            setPunches(sequenced);
            emitChanges(sequenced);
        }
    }, [creatingRange, draggingPunchId, punches, parseMinutes, minutesToTimeStr, pendingSessionStart, checkSpanCollision, formatDisplayTime, resequencePunches, incompleteSession, applyOriginalCheckpointConversion]);

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

    // Update punch time directly via typed input or spin buttons
    const handleTimeChange = (punchId, newTimeStr) => {
        if (!newTimeStr) return;
        const updated = applyOriginalCheckpointConversion(punches, punchId, newTimeStr);
        const sequenced = resequencePunches(updated);
        setPunches(sequenced);
        emitChanges(sequenced);
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
        setPendingSessionStart(null);

        let nextPunches = [...punches];
        const idsToDelete = new Set(selectedIds);

        // Check if any selected punch is an altered punch whose converted checkpoint is NOT selected
        selectedIds.forEach(id => {
            const p = punches.find(item => item.id === id);
            if (p && (p.type === 'in' || p.type === 'out')) {
                const origInfo = findOrigForPunch(p, punches);
                const origKey = p.origKey || origInfo?.origKey;
                if (origKey) {
                    const convertedCheckpoint = punches.find(item =>
                        item.type === 'normal' &&
                        !selectedIds.has(item.id) &&
                        (item.origKey === origKey || (item.isConvertedFromOrig && item.origTime === origInfo?.origTime))
                    );
                    if (convertedCheckpoint) {
                        // Turn checkpoint back into 'in' or 'out'
                        nextPunches = nextPunches.map(item => {
                            if (item.id === convertedCheckpoint.id) {
                                return {
                                    ...item,
                                    type: p.type,
                                    isConvertedFromOrig: false,
                                    isAltered: false
                                };
                            }
                            return item;
                        });
                        dismissedCheckpointsRef.current.delete(origKey);
                    }
                }
            } else if (p && p.type === 'normal' && p.origKey) {
                dismissedCheckpointsRef.current.add(p.origKey);
            }
        });

        // Expand session deletion for whole session pairs only when both boundary punches are not preserved
        proposedSessions.forEach(session => {
            const hasSelectedPunch = session.punches.some(p => selectedIds.has(p.id));
            if (hasSelectedPunch) {
                session.punches.forEach(p => {
                    const isPreserved = nextPunches.some(np => np.id === p.id && np.type !== 'normal');
                    if (!isPreserved && selectedIds.has(p.id)) {
                        idsToDelete.add(p.id);
                    }
                });
            }
        });

        const filtered = nextPunches.filter(p => !idsToDelete.has(p.id));
        const sequenced = resequencePunches(filtered);
        setPunches(sequenced);
        setSelectedIds(new Set());
        emitChanges(sequenced);
    };

    // Clear All Punches
    const handleClearAll = () => {
        setPendingSessionStart(null);
        setPunches([]);
        setSelectedIds(new Set());
        emitChanges([]);
    };

    // Remove single punch or session from proposed punches
    const handleRemovePunch = (punchId) => {
        setPendingSessionStart(null);
        const targetPunch = punches.find(p => p.id === punchId);
        if (!targetPunch) return;

        // 1. Checkpoint: only remove this single normal punch
        if (targetPunch.type === 'normal') {
            if (targetPunch.origKey) {
                dismissedCheckpointsRef.current.add(targetPunch.origKey);
            }
            const filtered = punches.filter(p => p.id !== punchId);
            const sequenced = resequencePunches(filtered);
            setPunches(sequenced);
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(punchId);
                return next;
            });
            emitChanges(sequenced);
            setHoveredPunchId(null);
            setDraggingPunchId(null);
            if (typeof toast !== 'undefined') {
                toast.info(`Removed Checkpoint (${formatDisplayTime(targetPunch.time)})`, { autoClose: 2000 });
            }
            return;
        }

        // 2. Boundary punch (IN or OUT):
        // If this punch is an altered time and has a corresponding converted checkpoint in proposed punches,
        // removing the altered time restores the converted checkpoint back to time in / time out!
        const origInfo = findOrigForPunch(targetPunch, punches);
        const origKey = targetPunch.origKey || origInfo?.origKey;
        const convertedCheckpoint = origKey
            ? punches.find(p => p.type === 'normal' && (p.origKey === origKey || (p.isConvertedFromOrig && p.origTime === origInfo?.origTime)))
            : null;

        if (convertedCheckpoint) {
            const targetType = targetPunch.type; // 'in' or 'out'
            const updated = punches
                .filter(p => p.id !== punchId) // remove altered punch
                .map(p => {
                    if (p.id === convertedCheckpoint.id) {
                        return {
                            ...p,
                            type: targetType,
                            isConvertedFromOrig: false,
                            isAltered: false
                        };
                    }
                    return p;
                });

            if (origKey) dismissedCheckpointsRef.current.delete(origKey);

            const sequenced = resequencePunches(updated);
            setPunches(sequenced);
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(punchId);
                return next;
            });
            emitChanges(sequenced);
            setHoveredPunchId(null);
            setDraggingPunchId(null);
            if (typeof toast !== 'undefined') {
                const label = targetType === 'in' ? 'Clock IN' : 'Clock OUT';
                toast.success(`Restored original ${label} at ${formatDisplayTime(convertedCheckpoint.time)}`, { autoClose: 2500 });
            }
            return;
        }

        // 3. Find the session this boundary punch belongs to
        const session = proposedSessions.find(s => s.inP?.id === punchId || s.outP?.id === punchId);
        if (!session) {
            const filtered = punches.filter(p => p.id !== punchId);
            const sequenced = resequencePunches(filtered);
            setPunches(sequenced);
            emitChanges(sequenced);
            return;
        }

        // Check if matching an original organic punch pair
        const matchingOrigPair = originalPunchPairs.find(pair => {
            const matchesIn = pair.inPunch && session.inP && parseMinutes(pair.inPunch.time) === parseMinutes(session.inP.time);
            const matchesOut = pair.outPunch && session.outP && parseMinutes(pair.outPunch.time) === parseMinutes(session.outP.time);
            return Boolean(matchesIn || matchesOut);
        });

        const isOrganicSession = Boolean(matchingOrigPair);
        const isOrganicMissedPunch = Boolean(matchingOrigPair && (!matchingOrigPair.inPunch || !matchingOrigPair.outPunch));

        // Case A: Organic missed punch where only one boundary was added by user
        if (isOrganicMissedPunch) {
            const isAddedMissedPunch = (
                (matchingOrigPair.inPunch && !matchingOrigPair.outPunch && session.outP?.id === punchId) ||
                (!matchingOrigPair.inPunch && matchingOrigPair.outPunch && session.inP?.id === punchId)
            );
            if (isAddedMissedPunch) {
                const filtered = punches.filter(p => p.id !== punchId);
                const sequenced = resequencePunches(filtered);
                setPunches(sequenced);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(punchId);
                    return next;
                });
                emitChanges(sequenced);
                setHoveredPunchId(null);
                setDraggingPunchId(null);
                if (typeof toast !== 'undefined') {
                    const label = targetPunch.type === 'in' ? 'added Clock IN' : 'added Clock OUT';
                    toast.info(`Removed ${label} (${formatDisplayTime(targetPunch.time)})`, { autoClose: 2000 });
                }
                return;
            }
        }

        // Case B: Session pair (both organic recorded session or newly created session)
        // Deleting either time_in or time_out deletes the ENTIRE session pair!
        const idsToRemove = new Set(session.punches.map(p => p.id));
        const filtered = punches.filter(p => !idsToRemove.has(p.id));
        const sequenced = resequencePunches(filtered);
        setPunches(sequenced);
        setSelectedIds(prev => {
            const next = new Set(prev);
            idsToRemove.forEach(id => next.delete(id));
            return next;
        });
        emitChanges(sequenced);
        setHoveredPunchId(null);
        setDraggingPunchId(null);
        if (typeof toast !== 'undefined') {
            const inTimeStr = session.inP ? formatDisplayTime(session.inP.time) : '';
            const outTimeStr = session.outP ? formatDisplayTime(session.outP.time) : '';
            toast.info(`Removed session (${inTimeStr} – ${outTimeStr})`, { autoClose: 2000 });
        }
    };

    const isSummaryOverride = (requestData?.correction_type || '').toLowerCase() === 'summary';
    const isAbsent = originalPunches.length === 0;

    const shiftStartMins = shift?.start_time ? parseMinutes(shift.start_time) : null;
    const shiftEndMins = shift?.end_time ? parseMinutes(shift.end_time) : null;
    const shiftLeft = (shiftStartMins !== null && shiftEndMins !== null) ? getPosPercent(shiftStartMins) : null;
    const shiftWidth = (shiftLeft !== null && shiftEndMins !== null) ? Math.max(2, getPosPercent(shiftEndMins) - shiftLeft) : null;

    // ==========================================
    // VIEW MODE: SHOW ORIGINAL ONLY (READ-ONLY)
    // ==========================================
    if (showOriginalOnly) {
        return (
            <div className={`space-y-2.5 select-none ${className}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Timeline Visualization
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">
                            {isAbsent ? 'No punches logged' : `(${originalPunches.length} punch${originalPunches.length > 1 ? 'es' : ''})`}
                        </span>
                        {shift?.start_time && shift?.end_time && (
                            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                Shift: {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                            </span>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[11px] font-normal text-slate-400">
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

                {/* Horizontally Scrollable 24-Hour Rail Container */}
                <div
                    ref={scrollContainerRef}
                    className="overflow-x-auto overflow-y-hidden pb-2.5 pt-1 timeline-scrollbar border border-slate-200/70 dark:border-github-dark-border/60 rounded-xl bg-white dark:bg-github-dark-subtle/70"
                >
                    <div className="min-w-[1150px] px-6 py-4">
                        <div className="relative h-12 flex items-center">
                            {/* Shift Zone */}
                            {shiftLeft !== null && (
                                <div
                                    style={{ left: `${shiftLeft}%`, width: `${shiftWidth}%` }}
                                    className="absolute inset-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 border-x border-indigo-200/40 dark:border-indigo-800/30 rounded-xs pointer-events-none"
                                    title={`Scheduled Shift: ${shift?.start_time ? shift.start_time.slice(0, 5) : '09:00'} - ${shift?.end_time ? shift.end_time.slice(0, 5) : '18:00'}`}
                                />
                            )}

                            {/* Background Rail */}
                            <div className="absolute inset-x-0 h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full" />

                            {/* 24-Hour Ticks and Labels */}
                            {hourlyTicks.map(h => {
                                const pct = getPosPercent(h * 60);
                                const isMajor = h % 2 === 0;
                                const displayHour = h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
                                return (
                                    <div
                                        key={h}
                                        className="absolute top-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                        style={{ left: `${pct}%` }}
                                    >
                                        <div
                                            className={`rounded-full -translate-y-1/2 ${isMajor
                                                    ? 'w-[1.5px] h-3.5 bg-slate-500/80 dark:bg-slate-400/80'
                                                    : 'w-[1px] h-2 bg-slate-300 dark:bg-slate-600'
                                                }`}
                                        />
                                        {isMajor ? (
                                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2 font-mono whitespace-nowrap">
                                                {displayHour}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-normal text-slate-400/80 dark:text-slate-500 mt-2.5 font-mono whitespace-nowrap">
                                                {h > 12 ? `${h - 12}` : `${h}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Original Soft Aura Glow between Paired Punches */}
                            {originalPunchPairs.map((pair) => {
                                if (!pair.inPunch || !pair.outPunch) return null;
                                const inPct = getPosPercent(parseMinutes(pair.inPunch.time));
                                const outPct = getPosPercent(parseMinutes(pair.outPunch.time));
                                const spanW = Math.max(0, outPct - inPct);
                                const durMins = (parseMinutes(pair.outPunch.time) ?? 0) - (parseMinutes(pair.inPunch.time) ?? 0);

                                return (
                                    <div
                                        key={pair.pairIdx}
                                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 border border-emerald-300/70 dark:border-emerald-500/40 pointer-events-none transition-all flex items-center justify-center"
                                        style={{ left: `${inPct}%`, width: `${spanW}%` }}
                                    >
                                        {spanW >= 8 && durMins > 0 && (
                                            <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-dark-card/90 px-2 py-0.5 rounded-full shadow-2xs border border-emerald-300/50 dark:border-emerald-700/50 pointer-events-none">
                                                {formatDuration(durMins)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Incomplete Punch Indicator if punch out missing */}
                            {originalPunchPairs.map((pair) => {
                                if (pair.inPunch && !pair.outPunch) {
                                    const inPct = getPosPercent(parseMinutes(pair.inPunch.time));
                                    return (
                                        <div
                                            key={`missing-${pair.pairIdx}`}
                                            className="absolute top-1/2 -translate-y-1/2 h-7 rounded-xl bg-gradient-to-r from-amber-500/20 to-transparent border-y border-l border-dashed border-amber-400 pointer-events-none transition-all flex items-center pl-2"
                                            style={{ left: `${inPct}%`, width: `${Math.min(100 - inPct, 15)}%` }}
                                        >
                                            <span className="text-[9px] font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                                                Missing Out
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })}

                            {/* Original Punch Dots (Read-Only: No Removal Handlers) */}
                            {originalPunches.length > 0 ? (
                                originalPunches.map((p) => {
                                    const mins = parseMinutes(p.time);
                                    const pct = getPosPercent(mins);
                                    const isHovered = hoveredPunchId === `orig-${p.id}`;
                                    const isIn = p.type === 'in';
                                    const isNormal = p.type === 'normal';

                                    return (
                                        <div
                                            key={p.id}
                                            className="punch-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-default select-none"
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
                                                        <span className="text-[10px] text-slate-400 font-sans border-l border-white/20 pl-1.5 ml-0.5">
                                                            Originally Recorded
                                                        </span>
                                                        {isNormal && p.address && (
                                                            <span className="text-[10px] text-amber-300/90 font-sans border-l border-white/20 pl-1.5 ml-0.5 truncate max-w-[130px]">
                                                                {p.address}
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className={`w-4 h-4 rounded-full shadow-xs border-2 border-white dark:border-dark-card flex items-center justify-center transition-transform hover:scale-125 ${isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'
                                                }`}>
                                                <div className="w-1 h-1 rounded-full bg-white opacity-80" />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-normal italic pointer-events-none">
                                    No punch activity recorded across timeline
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================================
    // MAIN COMPARISON & EDITABLE VIEW (SYNCHRONIZED 24HR RAILS)
    // ==========================================================
    return (
        <div className={`select-none space-y-4 ${frameless ? '' : 'bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl p-4 sm:p-5 shadow-2xs'} ${className}`}>
            {/* Header & Helper Banner */}
            {!hideHeader ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 dark:border-github-dark-border/40 gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <Clock size={15} className="text-indigo-500" />
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Punch Timeline Visualizer
                            </h4>
                        </div>
                        <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                            {editable
                                ? 'Original punches are fixed reference. Drag or click on Proposed Timeline to build your adjustment'
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
            ) : (
                warningMsg && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium"
                    >
                        <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{warningMsg}</span>
                    </motion.div>
                )
            )}
            {/* TIMELINE CARD CONTAINER (STATIONARY - NEVER SCROLLS HORIZONTALLY) */}
            <div className="border border-slate-200/80 dark:border-github-dark-border/60 rounded-xl bg-slate-50/50 dark:bg-github-dark-bg/30 p-3.5 sm:p-4 space-y-3">
                {/* Stationary Header & Legend */}
                <div className="flex items-center justify-end gap-2 pb-2 border-b border-slate-200/60 dark:border-github-dark-border/40">
                    {/* Legend (Stationary & Always in sight) */}
                    <div className="ml-auto flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
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

                {/* ONLY THE TIMELINE TRACKS ARE SCROLLABLE */}
                <div
                    ref={scrollContainerRef}
                    className="overflow-x-scroll overflow-y-hidden pb-6 pt-1 table-scrollbar rounded-lg"
                >
                    <div className="space-y-5 px-1 pb-2" style={{ minWidth: `${Math.round(1550 * (scale || 1))}px` }}>

                        {/* ─── ROW 1: ORIGINALLY RECORDED TIMELINE (STRICTLY READ-ONLY) ─── */}
                        <div className="space-y-1.5">
                            <div className="sticky left-1 z-10 inline-flex items-center gap-2 px-1">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Originally Recorded
                                </span>
                                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-github-dark-bg text-slate-600 dark:text-slate-400">
                                    Read-Only Reference
                                </span>
                            </div>

                            {/* Track Rail */}
                            <div className="relative h-14 flex items-center bg-white/70 dark:bg-github-dark-subtle/50 rounded-xl px-2 border border-slate-200/60 dark:border-github-dark-border/40">
                                {/* Scheduled Shift Zone */}
                                {shiftLeft !== null && (
                                    <div
                                        style={{ left: `${shiftLeft}%`, width: `${shiftWidth}%` }}
                                        className="absolute inset-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 border-x border-indigo-200/40 dark:border-indigo-800/30 rounded-xs pointer-events-none"
                                        title={`Scheduled Shift: ${shift?.start_time ? shift.start_time.slice(0, 5) : '09:00'} - ${shift?.end_time ? shift.end_time.slice(0, 5) : '18:00'}`}
                                    />
                                )}

                                {/* Background Rail */}
                                <div className="absolute inset-x-0 h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full" />

                                {/* Ticks and Labels */}
                                {hourlyTicks.map(h => {
                                    const pct = getPosPercent(h * 60);
                                    const isMajor = h % 2 === 0;
                                    const isFirst = h === 0;
                                    const isLast = h === 24;
                                    const displayHour = h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
                                    return (
                                        <div
                                            key={h}
                                            className={`absolute top-1/2 flex flex-col pointer-events-none ${
                                                isFirst
                                                    ? 'items-start translate-x-0'
                                                    : isLast
                                                        ? 'items-end -translate-x-full'
                                                        : 'items-center -translate-x-1/2'
                                            }`}
                                            style={{ left: `${pct}%` }}
                                        >
                                            <div
                                                className={`rounded-full -translate-y-1/2 ${
                                                    isFirst ? 'translate-x-1' : isLast ? '-translate-x-1' : ''
                                                } ${
                                                    isMajor
                                                        ? 'w-[1.5px] h-3.5 bg-slate-500/80 dark:bg-slate-400/80'
                                                        : 'w-[1px] h-2 bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            />
                                            {isMajor ? (
                                                <span className={`text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2 font-mono whitespace-nowrap ${
                                                    isFirst ? 'pl-0.5' : isLast ? 'pr-0.5' : ''
                                                }`}>
                                                    {displayHour}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-normal text-slate-400/80 dark:text-slate-500 mt-2.5 font-mono whitespace-nowrap">
                                                    {h > 12 ? `${h - 12}` : `${h}`}
                                                </span>
                                            )}
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

                                {/* Original Punch Dots (Read-Only: No Removal) */}
                                {originalPunches.map((p) => {
                                    const mins = parseMinutes(p.time);
                                    const pct = getPosPercent(mins);
                                    const isHovered = hoveredPunchId === `orig-${p.id}`;
                                    const isIn = p.type === 'in';
                                    const isNormal = p.type === 'normal';

                                    return (
                                        <div
                                            key={p.id}
                                            className="punch-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-default select-none"
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
                                                        <span className="text-xs text-slate-400 font-sans border-l border-white/20 pl-1.5 ml-0.5">
                                                            Originally Recorded
                                                        </span>
                                                        {isNormal && p.address && (
                                                            <span className="text-xs text-amber-300/90 font-sans border-l border-white/20 pl-1.5 ml-0.5 truncate max-w-[130px]">
                                                                {p.address}
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className={`w-4 h-4 rounded-full shadow-xs border-2 border-white dark:border-dark-card flex items-center justify-center transition-transform hover:scale-125 ${isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'
                                                }`}>
                                                <div className="w-1 h-1 rounded-full bg-white opacity-80" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ─── ROW 2: PROPOSED CORRECTION TIMELINE (INTERACTIVE) ─── */}
                        <div className="space-y-1.5 pt-1">
                            <div className="sticky left-1 z-10 flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                        Proposed Timeline
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        ({punches.length} punch{punches.length > 1 ? 'es' : ''})
                                    </span>
                                </div>

                                {editable && pendingSessionStart !== null ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Start: {formatDisplayTime(minutesToTimeStr(pendingSessionStart))} — Click 2nd point to set Clock Out
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingSessionStart(null);
                                                setWarningMsg(null);
                                            }}
                                            className="text-xs font-medium text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer"
                                        >
                                            ✕ Cancel (Esc)
                                        </button>
                                    </div>
                                ) : editable && incompleteSession?.inP && !incompleteSession?.outP ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            Missed Punch: Clock IN at {formatDisplayTime(incompleteSession.inP.time)} — Click timeline (e.g. 6 PM) to set Clock OUT
                                        </span>
                                    </div>
                                ) : editable && !incompleteSession?.inP && incompleteSession?.outP ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            Missed Punch: Clock OUT at {formatDisplayTime(incompleteSession.outP.time)} — Click timeline to set Clock IN
                                        </span>
                                    </div>
                                ) : editable ? (
                                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                        Click 2 points or drag to create session • Click inside session to add checkpoint • Double-click dot to remove
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Interactive Track Rail */}
                        <div
                            ref={trackRef}
                            onPointerDown={handleTrackPointerDown}
                            onMouseLeave={() => setHoveredMins(null)}
                            className={`relative h-14 flex items-center bg-white/90 dark:bg-dark-card rounded-xl px-2 border border-slate-200 dark:border-github-dark-border shadow-xs select-none mb-2 ${editable ? 'cursor-crosshair' : 'cursor-default'
                                }`}
                        >
                            {/* Scheduled Shift Zone */}
                            {shiftLeft !== null && (
                                <div
                                    style={{ left: `${shiftLeft}%`, width: `${shiftWidth}%` }}
                                    className="absolute inset-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 border-x border-indigo-200/40 dark:border-indigo-800/30 rounded-xs pointer-events-none"
                                    title={`Scheduled Shift: ${shift?.start_time ? shift.start_time.slice(0, 5) : '09:00'} - ${shift?.end_time ? shift.end_time.slice(0, 5) : '18:00'}`}
                                />
                            )}

                            {/* Background Rail */}
                            <div className="absolute inset-x-0 h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full" />

                            {/* Ticks and Labels */}
                            {hourlyTicks.map(h => {
                                const pct = getPosPercent(h * 60);
                                const isMajor = h % 2 === 0;
                                const isFirst = h === 0;
                                const isLast = h === 24;
                                const displayHour = h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
                                return (
                                    <div
                                        key={h}
                                        className={`absolute top-1/2 flex flex-col pointer-events-none ${
                                            isFirst
                                                ? 'items-start translate-x-0'
                                                : isLast
                                                    ? 'items-end -translate-x-full'
                                                    : 'items-center -translate-x-1/2'
                                        }`}
                                        style={{ left: `${pct}%` }}
                                    >
                                        <div
                                            className={`rounded-full -translate-y-1/2 ${
                                                isFirst ? 'translate-x-1' : isLast ? '-translate-x-1' : ''
                                            } ${
                                                isMajor
                                                    ? 'w-[1.5px] h-3.5 bg-slate-500/80 dark:bg-slate-400/80'
                                                    : 'w-[1px] h-2 bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        />
                                        {isMajor ? (
                                            <span className={`text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2 font-mono whitespace-nowrap ${
                                                isFirst ? 'pl-0.5' : isLast ? 'pr-0.5' : ''
                                            }`}>
                                                {displayHour}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-normal text-slate-400/80 dark:text-slate-500 mt-2.5 font-mono whitespace-nowrap">
                                                {h > 12 ? `${h - 12}` : `${h}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Working Session Interval Spans (Between IN & OUT) */}
                            {trackAuras.map((aura) => {
                                const inPct = getPosPercent(parseMinutes(aura.inP.time));
                                const outPct = getPosPercent(parseMinutes(aura.outP.time));
                                const spanWidth = Math.max(0, outPct - inPct);
                                const isAuraHovered = editable && hoveredSessionIdx === aura.sessionIdx;

                                return (
                                    <div
                                        key={`aura-${aura.sessionIdx}`}
                                        onMouseEnter={() => {
                                            if (!editable) return;
                                            setHoveredSessionIdx(aura.sessionIdx);
                                            setHoveredPunchId(null);
                                        }}
                                        onMouseLeave={() => {
                                            if (!editable) return;
                                            setHoveredSessionIdx(null);
                                        }}
                                        className={`group absolute top-1/2 -translate-y-1/2 h-7 rounded-xl transition-all flex items-center justify-center ${editable
                                                ? `cursor-pointer ${isAuraHovered
                                                    ? 'bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-indigo-500/25 border border-emerald-400 dark:border-emerald-400 shadow-xs ring-2 ring-emerald-400/20'
                                                    : 'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 border border-emerald-300/70 dark:border-emerald-500/40 hover:border-emerald-400'
                                                }`
                                                : 'bg-gradient-to-r from-emerald-500/15 to-indigo-500/15 border border-emerald-200 dark:border-emerald-800/40 pointer-events-none'
                                            }`}
                                        style={{ left: `${inPct}%`, width: `${spanWidth}%` }}
                                    >
                                        {/* Middle Hover Prompt to Drop Checkpoint */}
                                        {editable && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-10 whitespace-nowrap bg-slate-900 text-white text-xs font-medium px-2.5 py-0.5 rounded-lg shadow-md flex items-center gap-1 pointer-events-none z-30">
                                                <PlusCircle size={12} className="text-amber-400" />
                                                <span>Click to Add Checkpoint</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Incomplete Missed Punch: Dashed Open Trail */}
                            {incompleteSession && incompleteSession.inP && !incompleteSession.outP && (() => {
                                const inM = parseMinutes(incompleteSession.inP.time);
                                if (inM === null) return null;
                                const inPct = getPosPercent(inM);
                                const targetEndM = shiftEndMins && shiftEndMins > inM ? shiftEndMins : 1080;
                                const endPct = getPosPercent(targetEndM);
                                const widthPct = Math.max(0, endPct - inPct);

                                return (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 h-6 rounded-lg bg-amber-500/10 border border-dashed border-amber-400/40 pointer-events-none transition-all flex items-center justify-end pr-2 z-10"
                                        style={{ left: `${inPct}%`, width: `${widthPct}%` }}
                                    >
                                        <span className="text-xs font-medium text-amber-500 dark:text-amber-400 opacity-75 whitespace-nowrap hidden sm:inline">
                                            Awaiting Clock OUT
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* Incomplete Missed Punch: Hover Preview to set missing Clock OUT */}
                            {editable && pendingSessionStart === null && incompleteSession && incompleteSession.inP && !incompleteSession.outP && hoveredMins !== null && canCompleteIncompleteOut(hoveredMins) && (() => {
                                const inM = parseMinutes(incompleteSession.inP.time);
                                const inPct = getPosPercent(inM);
                                const hoverPct = getPosPercent(hoveredMins);
                                const spanWidth = Math.max(0.5, hoverPct - inPct);
                                const durMins = hoveredMins - inM;

                                return (
                                    <>
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-7 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-rose-500/20 border border-dashed border-rose-400 shadow-xs pointer-events-none transition-all z-10"
                                            style={{ left: `${inPct}%`, width: `${spanWidth}%` }}
                                        >
                                            {spanWidth >= 5 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded shadow-xs bg-slate-900/90 text-rose-300 border border-rose-500/40 whitespace-nowrap">
                                                        {formatDuration(durMins)} • Click to set Clock OUT ({formatDisplayTime(minutesToTimeStr(hoveredMins))})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Ghost OUT dot at hover position */}
                                        <div
                                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                            style={{ left: `${hoverPct}%` }}
                                        >
                                            <div className="w-4 h-4 rounded-full border-2 border-white shadow-xs ring-4 ring-rose-400/50 bg-rose-500 animate-pulse" />
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Incomplete Missed Punch: Hover Preview to set missing Clock IN */}
                            {editable && pendingSessionStart === null && incompleteSession && !incompleteSession.inP && incompleteSession.outP && hoveredMins !== null && canCompleteIncompleteIn(hoveredMins) && (() => {
                                const outM = parseMinutes(incompleteSession.outP.time);
                                const outPct = getPosPercent(outM);
                                const hoverPct = getPosPercent(hoveredMins);
                                const spanWidth = Math.max(0.5, outPct - hoverPct);
                                const durMins = outM - hoveredMins;

                                return (
                                    <>
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-7 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 border border-dashed border-emerald-400 shadow-xs pointer-events-none transition-all z-10"
                                            style={{ left: `${hoverPct}%`, width: `${spanWidth}%` }}
                                        >
                                            {spanWidth >= 5 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded shadow-xs bg-slate-900/90 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                                                        {formatDuration(durMins)} • Click to set Clock IN ({formatDisplayTime(minutesToTimeStr(hoveredMins))})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Ghost IN dot at hover position */}
                                        <div
                                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                            style={{ left: `${hoverPct}%` }}
                                        >
                                            <div className="w-4 h-4 rounded-full border-2 border-white shadow-xs ring-4 ring-emerald-400/50 bg-emerald-500 animate-pulse" />
                                        </div>
                                    </>
                                );
                            })()}

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

                            {/* Pending 2-Click Session Creation: Dynamic Hover Preview Span */}
                            {editable && pendingSessionStart !== null && hoveredMins !== null && hoveredMins !== pendingSessionStart && (() => {
                                const sMin = Math.min(pendingSessionStart, hoveredMins);
                                const eMin = Math.max(pendingSessionStart, hoveredMins);
                                const sPct = getPosPercent(sMin);
                                const ePct = getPosPercent(eMin);
                                const spanWidth = Math.max(0.5, ePct - sPct);
                                const durMins = eMin - sMin;
                                const collides = checkSpanCollision(sMin, eMin);

                                return (
                                    <>
                                        <div
                                            className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-xl border border-dashed pointer-events-none transition-all ${collides
                                                    ? 'bg-rose-500/20 border-rose-400 shadow-xs'
                                                    : 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 border-emerald-400 shadow-xs'
                                                }`}
                                            style={{ left: `${sPct}%`, width: `${spanWidth}%` }}
                                        >
                                            {spanWidth >= 5 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded shadow-xs ${collides
                                                            ? 'bg-rose-900 text-rose-100 border border-rose-700'
                                                            : 'bg-slate-900/90 text-emerald-300 border border-emerald-500/40'
                                                        }`}>
                                                        {collides ? 'Cannot overlap existing session' : `${formatDuration(durMins)} • Click to set ${hoveredMins > pendingSessionStart ? 'OUT' : 'IN'}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Dot at hover position */}
                                        <div
                                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                            style={{ left: `${getPosPercent(hoveredMins)}%` }}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-xs ring-2 ${collides
                                                    ? 'bg-rose-500 ring-rose-400/40'
                                                    : hoveredMins > pendingSessionStart
                                                        ? 'bg-rose-500 ring-rose-400/40'
                                                        : 'bg-emerald-500 ring-emerald-400/40'
                                                }`} />
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Pending 2-Click Session Creation: Start Dot Marker */}
                            {editable && pendingSessionStart !== null && (
                                <div
                                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer select-none group/pending"
                                    style={{ left: `${getPosPercent(pendingSessionStart)}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingSessionStart(null);
                                        setWarningMsg('Cancelled session creation');
                                        setTimeout(() => setWarningMsg(null), 2000);
                                    }}
                                    title="Click to cancel start time selection"
                                >
                                    <div className="relative flex items-center justify-center">
                                        <div className="absolute w-7 h-7 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-emerald-400/50 border-2 border-white dark:border-dark-card shadow-lg flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        </div>
                                    </div>
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-xs font-mono font-medium px-2 py-0.5 rounded shadow-sm pointer-events-none z-40">
                                        Start: {formatDisplayTime(minutesToTimeStr(pendingSessionStart))}
                                    </div>
                                </div>
                            )}

                            {/* Empty Proposed Timeline Placeholder Prompt */}
                            {punches.length === 0 && !creatingRange && pendingSessionStart === null && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500 bg-white/90 dark:bg-dark-card/90 px-3 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700/60 shadow-2xs">
                                        No punches proposed yet
                                    </span>
                                </div>
                            )}

                            {/* Interactive Punch Dots (Editable: Double Click or Delete Button to Remove) */}
                            {punches.map((p) => {
                                const mins = parseMinutes(p.time);
                                const pct = getPosPercent(mins);
                                const isDragging = draggingPunchId === p.id;
                                const isThisDotHovered = hoveredPunchId === p.id;
                                const punchSessionIdx = punchSessionMap.get(p.id);
                                const session = proposedSessions.find(s => s.sessionIdx === punchSessionIdx);
                                const isNewSession = isNewlyCreatedSession(session);
                                const isSessionActive = hoveredSessionIdx !== null && punchSessionIdx !== undefined && hoveredSessionIdx === punchSessionIdx;
                                const isIn = p.type === 'in';
                                const isNormal = p.type === 'normal';

                                return (
                                    <div
                                        key={p.id}
                                        className={`punch-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 select-none ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                            }`}
                                        style={{ left: `${pct}%` }}
                                        title={editable ? (isNormal ? "Double-click to remove checkpoint, or drag along rail to adjust" : "Double-click to remove session, or drag along rail to adjust") : undefined}
                                        onPointerDown={(e) => {
                                            if (!editable) return;
                                            if (e.target.closest('input') || e.target.closest('button')) return;
                                            const now = Date.now();
                                            if (e.detail === 2 || (lastClickRef.current.id === p.id && now - lastClickRef.current.time < 350)) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDraggingPunchId(null);
                                                lastClickRef.current = { id: null, time: 0 };
                                                handleRemovePunch(p.id);
                                                return;
                                            }
                                            lastClickRef.current = { id: p.id, time: now };
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDraggingPunchId(p.id);
                                        }}
                                        onDoubleClick={(e) => {
                                            if (!editable) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDraggingPunchId(null);
                                            lastClickRef.current = { id: null, time: 0 };
                                            handleRemovePunch(p.id);
                                        }}
                                        onMouseEnter={() => {
                                            setHoveredPunchId(p.id);
                                            if (punchSessionIdx !== undefined) {
                                                setHoveredSessionIdx(punchSessionIdx);
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredPunchId(null);
                                            setHoveredSessionIdx(null);
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
                                                    {p.isConvertedFromOrig ? (
                                                        <span className="text-xs text-amber-300 font-sans border-l border-white/20 pl-1.5 ml-0.5">
                                                            Original {p.origType === 'in' ? 'Clock IN' : 'Clock OUT'} (Converted Checkpoint)
                                                        </span>
                                                    ) : p.isAltered && p.origTime ? (
                                                        <span className="text-xs text-indigo-300 font-sans border-l border-white/20 pl-1.5 ml-0.5">
                                                            Altered from {formatDisplayTime(p.origTime)}
                                                        </span>
                                                    ) : null}
                                                    {editable && (
                                                        <span className="text-xs text-slate-400 font-sans border-l border-white/20 pl-1.5 ml-0.5">
                                                            {p.isConvertedFromOrig
                                                                ? 'Double-click to remove checkpoint'
                                                                : isNormal
                                                                    ? 'Double-click to remove checkpoint'
                                                                    : punches.some(chk => chk.type === 'normal' && (chk.origKey === p.origKey || (chk.isConvertedFromOrig && chk.origType === p.type && chk.origTime === p.origTime)))
                                                                        ? 'Double-click to restore original checkpoint'
                                                                        : isNewSession
                                                                            ? 'Double-click to remove session pair'
                                                                            : 'Double-click to remove'}
                                                        </span>
                                                    )}
                                                    {isNormal && p.address && (
                                                        <span className="text-xs text-amber-300/90 font-sans border-l border-white/20 pl-1.5 ml-0.5 truncate max-w-[130px]">
                                                            {p.address}
                                                        </span>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Punch Handle Circular Badge */}
                                        <div
                                            className={`w-5 h-5 rounded-full border-2 border-white dark:border-dark-card shadow-md flex items-center justify-center transition-transform ${isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'
                                                } ${isDragging
                                                    ? 'scale-125 ring-4 ring-indigo-400/50'
                                                    : isThisDotHovered
                                                        ? 'scale-125 ring-4 ring-indigo-400/40'
                                                        : isSessionActive
                                                            ? 'scale-110 ring-2 ring-emerald-400/50'
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
            </div>

            {/* ─── ROW 3: DETAILED PUNCH LIST & ACTIONS (EDITABLE MODE) ─── */}
            {editable && punches.length > 0 && (
                <div className="space-y-2.5 pt-1">
                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-github-dark-border/40">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleToggleSelectAll}
                                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                {selectedIds.size === punches.length ? (
                                    <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <Square size={14} className="text-slate-400" />
                                )}
                                <span>Select All ({punches.length})</span>
                            </button>

                            {selectedIds.size > 0 && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800/40 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete Selected ({selectedIds.size})</span>
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs font-medium text-slate-400 hover:text-rose-500 transition-colors self-end sm:self-auto cursor-pointer"
                        >
                            Clear All Proposed
                        </button>
                    </div>

                    {/* Single Punch Rows */}
                    <div className="space-y-2">
                        {punches.map((p, idx) => {
                            const isChecked = selectedIds.has(p.id);
                            const punchSessionIdx = punchSessionMap.get(p.id);
                            const session = proposedSessions.find(s => s.sessionIdx === punchSessionIdx);
                            const isNewSession = isNewlyCreatedSession(session);
                            const isSessionActive = hoveredSessionIdx !== null && punchSessionIdx !== undefined && hoveredSessionIdx === punchSessionIdx;
                            const isDirectlyHovered = hoveredPunchId === p.id;
                            const isIn = p.type === 'in';
                            const isNormal = p.type === 'normal';

                            return (
                                <div
                                    key={p.id || idx}
                                    onMouseEnter={() => {
                                        setHoveredPunchId(p.id);
                                        if (punchSessionIdx !== undefined) {
                                            setHoveredSessionIdx(punchSessionIdx);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredPunchId(null);
                                        setHoveredSessionIdx(null);
                                    }}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all border select-none ${isChecked
                                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-400/30 shadow-xs'
                                            : isDirectlyHovered
                                                ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-400/40 shadow-xs'
                                                : isSessionActive
                                                    ? 'border-emerald-400/70 dark:border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-400/20 shadow-2xs'
                                                    : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border shadow-2xs hover:border-slate-300 dark:hover:border-github-dark-border/80'
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
                                            title="Click to select"
                                            className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0 w-4 flex justify-center"
                                        >
                                            {isChecked ? (
                                                <CheckSquare size={15} className="text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <Square size={15} />
                                            )}
                                        </button>

                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-16 shrink-0">
                                            Punch #{idx + 1}
                                        </span>

                                        {/* Punch Type Badge - Consistent Width for Perfect Alignment */}
                                        <span
                                            title={isNormal ? (p.isConvertedFromOrig ? "Original recorded punch converted to checkpoint" : "Checkpoint") : (p.isAltered ? "Altered punch time" : (isIn ? "Clock IN" : "Clock OUT"))}
                                            className={`w-28 shrink-0 text-xs font-medium rounded-lg px-2 py-1 border inline-flex items-center justify-center gap-1.5 text-center ${isNormal
                                                    ? (p.isConvertedFromOrig
                                                        ? 'bg-amber-100/70 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/30'
                                                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40')
                                                    : isIn
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNormal ? 'bg-amber-500' : isIn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span>{isNormal ? (p.isConvertedFromOrig ? (p.origType === 'in' ? 'Orig IN Chk' : 'Orig OUT Chk') : 'Checkpoint') : isIn ? 'Clock IN' : 'Clock OUT'}</span>
                                        </span>

                                        {/* Direct Editable Time Input - Lets User Type Directly Without Dropdowns */}
                                        <div className="w-20 sm:w-24 shrink-0">
                                            <DirectTimeInput
                                                value={p.time || ''}
                                                onChange={(newTime) => handleTimeChange(p.id, newTime)}
                                            />
                                        </div>

                                        {/* Location / address snippet for checkpoints if available */}
                                        {isNormal && p.address && (
                                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[130px] sm:max-w-[180px] hidden sm:inline" title={p.address}>
                                                • {p.address}
                                            </span>
                                        )}
                                    </div>

                                    {/* 1-Click Cross Button to Delete */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePunch(p.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all flex items-center justify-center cursor-pointer shrink-0"
                                        title={
                                            p.isConvertedFromOrig
                                                ? "Remove converted checkpoint"
                                                : isNormal
                                                    ? "Delete checkpoint"
                                                    : punches.some(chk => chk.type === 'normal' && (chk.origKey === p.origKey || (chk.isConvertedFromOrig && chk.origType === p.type && chk.origTime === p.origTime)))
                                                        ? "Remove altered time (restores original checkpoint)"
                                                        : isNewSession
                                                            ? "Delete session pair"
                                                            : "Delete punch"
                                        }
                                        aria-label={
                                            p.isConvertedFromOrig
                                                ? "Delete converted checkpoint"
                                                : isNormal
                                                    ? "Delete checkpoint"
                                                    : isNewSession
                                                        ? "Delete session pair"
                                                        : "Delete punch"
                                        }
                                    >
                                        <X size={15} />
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
                    <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                        Late Mins: {requestData?.proposed_data?.late_minutes ?? 0}m
                    </span>
                </div>
            )}
        </div>
    );
}
