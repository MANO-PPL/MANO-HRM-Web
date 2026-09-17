/**
 * Attendance Status Utility
 * Central place to manage all attendance status display logic.
 */

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  ABSENT: 'ABSENT',
  OVERTIME: 'OVERTIME',
  MISSED_PUNCH: 'MISSED_PUNCH',
  ON_LEAVE: 'ON_LEAVE',
  WEEK_OFF: 'WEEK_OFF',
  HOLIDAY: 'HOLIDAY',
};

/**
 * Returns Tailwind CSS classes for a status badge.
 * @param {string} status - The attendance status string.
 * @returns {{ bg: string, text: string, dot: string, label: string }}
 */
export function getStatusStyle(status) {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'OPEN':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/50',
        text: 'text-emerald-700 dark:text-emerald-400 font-bold',
        dot: 'bg-emerald-500 animate-pulse',
        label: 'ACTIVE',
      };
    case 'CLOSED':
      return {
        bg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/40',
        text: 'text-slate-600 dark:text-slate-300 font-bold',
        dot: 'bg-slate-400',
        label: 'CLOSED',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/40',
        text: 'text-slate-600 dark:text-slate-300 font-bold',
        dot: 'bg-slate-400',
        label: 'COMPLETED',
      };
    case 'PRESENT':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'PRESENT',
      };
    case 'LATE':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/40',
        text: 'text-orange-700 dark:text-orange-400',
        dot: 'bg-orange-500',
        label: 'LATE',
      };
    case 'HALF_DAY':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-400',
        dot: 'bg-orange-500',
        label: 'HALF DAY',
      };
    case 'ABSENT':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
        label: 'ABSENT',
      };
    case 'OVERTIME':
      return {
        bg: 'bg-violet-100 dark:bg-violet-900/30',
        text: 'text-violet-700 dark:text-violet-400',
        dot: 'bg-violet-500',
        label: 'OVERTIME',
      };
    case 'MISSED_PUNCH':
      return {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        text: 'text-rose-700 dark:text-rose-400',
        dot: 'bg-rose-500',
        label: 'MISSED PUNCH',
      };
    case 'ON_LEAVE':
    case 'LEAVE':
      return {
        bg: 'bg-teal-100 dark:bg-teal-900/30',
        text: 'text-teal-700 dark:text-teal-400',
        dot: 'bg-teal-500',
        label: 'ON LEAVE',
      };
    case 'WEEK_OFF':
      return {
        bg: 'bg-slate-200 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        dot: 'bg-slate-400',
        label: 'WEEK OFF',
      };
    case 'HOLIDAY':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/40',
        text: 'text-yellow-700 dark:text-yellow-400',
        dot: 'bg-yellow-500',
        label: 'HOLIDAY',
      };
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-700',
        text: 'text-slate-600 dark:text-slate-300',
        dot: 'bg-slate-400',
        label: (status || 'UNKNOWN').toUpperCase(),
      };
  }
}

/**
 * Returns a full badge JSX string (for use as className string only).
 * Use getStatusStyle() directly in JSX for full control.
 */
export function getStatusBadgeClass(status) {
  const { bg, text } = getStatusStyle(status);
  return `${bg} ${text} text-[10px] font-bold uppercase px-2 py-0.5 rounded-full`;
}

/**
 * Returns only the color classes (bg and text).
 */
export function getStatusColorClasses(status) {
  const { bg, text } = getStatusStyle(status);
  return `${bg} ${text}`;
}

/**
 * Parses correction category and cleaned reason from a correction request.
 * E.g., extracts "[Missed Punch] Forgot to punch out" into:
 *   category: "Missed Punch"
 *   cleanReason: "Forgot to punch out"
 */
export function parseCorrectionDetails(req) {
  if (!req) return { category: 'Punch Correction', cleanReason: '' };

  const rawReason = String(req.reason || '').trim();
  // Match prefix [Category] or ['Category'] or ["Category"]
  const match = rawReason.match(/^\[['"]?(.*?)['"]?\]\s*(.*)$/s);

  let category = '';
  let cleanReason = rawReason;

  if (match) {
    category = match[1].trim();
    cleanReason = match[2].trim();
  }

  if (!category) {
    if (req.correction_type === 'summary') {
      category = 'Summary Adjustment';
    } else if (/missed\s*punch/i.test(rawReason)) {
      category = 'Missed Punch';
    } else if (/missed\s*day/i.test(rawReason)) {
      category = 'Missed Day';
    } else if (/overtime/i.test(rawReason)) {
      category = 'Overtime';
    } else if (/biometric|finger|sensor|scanner/i.test(rawReason)) {
      category = 'Biometric Issue';
    } else if (/late|delay/i.test(rawReason)) {
      category = 'Late Arrival';
    } else if (/early/i.test(rawReason)) {
      category = 'Early Departure';
    } else if (req.correction_type === 'punch') {
      category = 'Missed Punch';
    } else {
      category = req.correction_type ? String(req.correction_type).replace(/_/g, ' ') : 'Punch Correction';
    }
  }

  // Capitalize neatly
  category = category.charAt(0).toUpperCase() + category.slice(1);

  return {
    category,
    cleanReason: cleanReason || rawReason
  };
}

/**
 * Determines whether a record or punch represents a mid-shift checkpoint.
 * Checks for known punch types ('normal', 'normal_punch', 'checkpoint', 'checkpoint_punch'),
 * explicit boolean flags (is_checkpoint), or punch nature/type indicators.
 *
 * @param {Object} item - An attendance record or punch object.
 * @returns {boolean}
 */
export function isCheckpointRecord(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.is_checkpoint === true) return true;
  const pType = String(item.punch_type || item.type || '').toLowerCase().trim();
  if (['normal', 'normal_punch', 'checkpoint', 'checkpoint_punch'].includes(pType)) {
    return true;
  }
  const noteStr = String(item.note || item.remarks || item.address || item.time_in_address || '').toLowerCase();
  if (noteStr.includes('checkpoint') || noteStr.includes('logged checkpoint')) {
    return true;
  }
  return false;
}

/**
 * Normalizes daily sessions and checkpoints for consistent frontend display.
 * 
 * When attendance is modified or passes through attendance correction, checkpoints
 * may appear as standalone records with a single punch time and no time_out.
 * This helper:
 * 1. Identifies bona fide work sessions (records with both time_in & time_out).
 * 2. Identifies checkpoints: explicit checkpoint records, as well as single-punch records
 *    that fall chronologically inside an existing closed work session (since an employee
 *    cannot start an overlapping work session mid-shift).
 * 3. Associates each checkpoint with its enclosing session (time_in <= checkpoint_time <= time_out)
 *    by nesting it into that session's `checkpoints` array.
 * 4. Deduplicates checkpoints by ID and punch time.
 * 5. Removes nested checkpoints from the top-level session list so they are never rendered
 *    as independent/incomplete/missed punch session cards.
 *
 * @param {Array} records - Raw records or sessions array.
 * @returns {Array} Normalized sessions with nested checkpoints.
 */
export function normalizeDailySessionsWithCheckpoints(records) {
  if (!Array.isArray(records) || records.length === 0) return [];

  const parseTimeToMs = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (s.includes('T') || s.includes('-') || s.includes('/')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      return (h * 3600 + m * 60 + sec) * 1000;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const closedSessions = [];
  const singlePunches = [];

  records.forEach((r) => {
    if (!r) return;
    const isExplicitChk = isCheckpointRecord(r);
    const hasOut = Boolean(r.time_out && String(r.time_out).trim());

    if (isExplicitChk) {
      singlePunches.push({ ...r, is_checkpoint: true });
    } else if (hasOut) {
      closedSessions.push({
        ...r,
        checkpoints: Array.isArray(r.checkpoints) ? [...r.checkpoints] : (Array.isArray(r.raw_checkpoints) ? [...r.raw_checkpoints] : [])
      });
    } else {
      singlePunches.push(r);
    }
  });

  // Sort closed sessions chronologically
  closedSessions.sort((a, b) => {
    const tA = parseTimeToMs(a.time_in || a.check_in || a.time_in_ts) || 0;
    const tB = parseTimeToMs(b.time_in || b.check_in || b.time_in_ts) || 0;
    return tA - tB;
  });

  const remainingWorkSessions = [];
  const orphanedCheckpoints = [];

  singlePunches.forEach((sp) => {
    const spTimeMs = parseTimeToMs(sp.punch_time || sp.time_in || sp.time || sp.time_in_ts);
    const isExplicitChk = isCheckpointRecord(sp);

    // Check if sp falls inside any closed session
    let enclosingSession = null;
    if (spTimeMs !== null && closedSessions.length > 0) {
      for (const cs of closedSessions) {
        const inMs = parseTimeToMs(cs.time_in || cs.check_in || cs.time_in_ts);
        const outMs = parseTimeToMs(cs.time_out || cs.check_out || cs.time_out_ts);
        if (inMs !== null && outMs !== null) {
          // If strictly inside or within 2 minutes of session bounds
          if (spTimeMs >= inMs - 2 * 60 * 1000 && spTimeMs <= outMs + 2 * 60 * 1000) {
            enclosingSession = cs;
            break;
          }
        }
      }
    }

    if (enclosingSession) {
      // It is an enclosed checkpoint!
      const formattedChk = {
        id: sp.id || sp.attendance_id || `chk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        punch_time: sp.punch_time || sp.time_in || sp.time || sp.time_in_ts,
        address: sp.address || sp.time_in_address || (typeof sp.location === 'object' ? sp.location?.address : sp.location) || '',
        image_url: sp.image_url || sp.image || sp.time_in_image || sp.time_in_image_key || null,
        image: sp.image_url || sp.image || sp.time_in_image || sp.time_in_image_key || null,
        note: sp.note || sp.remarks || '',
        lat: sp.lat || sp.time_in_lat || null,
        lng: sp.lng || sp.time_in_lng || null,
        accuracy: sp.accuracy || null,
        punch_type: 'normal',
        is_checkpoint: true,
        ...sp
      };
      if (!Array.isArray(enclosingSession.checkpoints)) {
        enclosingSession.checkpoints = [];
      }
      const exists = enclosingSession.checkpoints.some(
        c => (c.id && c.id === formattedChk.id) ||
             (c.punch_time && formattedChk.punch_time && String(c.punch_time) === String(formattedChk.punch_time))
      );
      if (!exists) {
        enclosingSession.checkpoints.push(formattedChk);
      }
    } else if (isExplicitChk) {
      // An explicit checkpoint outside closed sessions
      if (closedSessions.length > 0) {
        // Associate with closest session
        let bestSession = closedSessions[0];
        let bestDiff = Infinity;
        closedSessions.forEach(cs => {
          const inMs = parseTimeToMs(cs.time_in || cs.check_in || cs.time_in_ts);
          if (inMs !== null && spTimeMs !== null) {
            const diff = Math.abs(spTimeMs - inMs);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestSession = cs;
            }
          }
        });
        bestSession.checkpoints.push({
          id: sp.id || sp.attendance_id || `chk-${Date.now()}`,
          punch_time: sp.punch_time || sp.time_in || sp.time,
          address: sp.address || sp.time_in_address || '',
          punch_type: 'normal',
          is_checkpoint: true,
          ...sp
        });
      } else {
        orphanedCheckpoints.push(sp);
      }
    } else {
      // Genuine open / missed punch session that does NOT fall inside any closed session
      remainingWorkSessions.push({
        ...sp,
        checkpoints: Array.isArray(sp.checkpoints) ? [...sp.checkpoints] : []
      });
    }
  });

  const allSessions = [...closedSessions, ...remainingWorkSessions];
  allSessions.sort((a, b) => {
    const tA = parseTimeToMs(a.time_in || a.check_in || a.time_in_ts) || 0;
    const tB = parseTimeToMs(b.time_in || b.check_in || b.time_in_ts) || 0;
    return tA - tB;
  });

  allSessions.forEach(session => {
    if (Array.isArray(session.checkpoints) && session.checkpoints.length > 1) {
      session.checkpoints.sort((a, b) => {
        const tA = parseTimeToMs(a.punch_time || a.time_in || a.time) || 0;
        const tB = parseTimeToMs(b.punch_time || b.time_in || b.time) || 0;
        return tA - tB;
      });
    }
  });

  return allSessions.length > 0 ? allSessions : orphanedCheckpoints;
}

