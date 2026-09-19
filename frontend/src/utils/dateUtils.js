/**
 * Date utility for safe local timezone date operations.
 * Avoids UTC shifting bugs caused by `.toISOString().split('T')[0]`.
 */

export const getLocalDateString = (date = new Date()) => {
    if (!date) return '';
    if (typeof date === 'string') {
        // If already in YYYY-MM-DD format (no time component), keep as-is
        const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            return match[0];
        }
    }
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isSameDay = (d1, d2) => {
    return getLocalDateString(d1) === getLocalDateString(d2);
};

/**
 * Format any date or time string into 12-hour AM/PM format (hh:mm A)
 * strictly preserving wall-clock time without UTC or timezone conversion.
 */
export const formatLocalTimeString = (timeVal) => {
    if (!timeVal) return '';
    try {
        const str = String(timeVal).trim().replace('Z', '');
        const parts = str.split(/[- :T.]/);
        if (parts.length >= 5) {
            let hour = parseInt(parts[3], 10);
            const minute = String(parts[4]).padStart(2, '0');
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(hour)}:${minute} ${ampm}`;
        }
        if (parts.length === 2 || parts.length === 3) {
            let hour = parseInt(parts[0], 10);
            if (!isNaN(hour)) {
                const minute = String(parts[1]).padStart(2, '0');
                const ampm = hour >= 12 ? 'PM' : 'AM';
                hour = hour % 12;
                if (hour === 0) hour = 12;
                const pad = (n) => String(n).padStart(2, '0');
                return `${pad(hour)}:${minute} ${ampm}`;
            }
        }
        return str;
    } catch (e) {
        return String(timeVal);
    }
};

/**
 * Checks whether a given time string (HH:MM) falls inside a shift's working hours [start_time, end_time].
 * Handles both normal daytime shifts (e.g. 09:00 - 18:00) and overnight shifts crossing midnight (e.g. 22:00 - 06:00).
 *
 * @param {string} checkTime - Time to check (e.g. "16:00")
 * @param {string} startTime - Shift start time (e.g. "09:00")
 * @param {string} endTime - Shift end time (e.g. "18:00")
 * @returns {boolean} True if checkTime falls within the shift working window
 */
export const isTimeInShiftRange = (checkTime, startTime, endTime) => {
    if (!checkTime || !startTime || !endTime) return false;
    const toMins = (t) => {
        if (!t || typeof t !== 'string') return null;
        const [h, m] = t.slice(0, 5).split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };
    const c = toMins(checkTime);
    const s = toMins(startTime);
    const e = toMins(endTime);
    if (c === null || s === null || e === null) return false;

    if (s < e) {
        // Daytime shift (e.g. 09:00 to 18:00)
        return c >= s && c <= e;
    } else if (s > e) {
        // Overnight shift crossing midnight (e.g. 22:00 to 06:00)
        return c >= s || c <= e;
    } else {
        // Exact same start and end (24h or single point)
        return c === s;
    }
};

/**
 * Calculates the total duration in minutes of a shift given start and end time strings.
 * Handles overnight shifts crossing midnight (e.g. 22:00 to 06:00 -> 480 mins).
 *
 * @param {string} startTime - e.g. "09:00"
 * @param {string} endTime - e.g. "18:00"
 * @returns {number} Duration in minutes
 */
export const getShiftDurationMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 480; // default 8 hours
    const toMins = (t) => {
        if (!t || typeof t !== 'string') return 0;
        const [h, m] = t.slice(0, 5).split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return 0;
        return h * 60 + m;
    };
    const s = toMins(startTime);
    const e = toMins(endTime);
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    return diff;
};


