/**
 * Centralized Date, Time & Sanitization Utility
 * Ensures compatibility with MySQL 8.0 strict mode (STRICT_TRANS_TABLES)
 * and supports multi-timezone conversions (e.g., India IST, Congo WAT, UTC).
 */

export const pad = (n) => String(n).padStart(2, '0');

/**
 * Converts any Date object, ISO string, timestamp, or datetime string into
 * a strict MySQL DATETIME format: 'YYYY-MM-DD HH:mm:ss'.
 * 
 * @param {Date|string|number} dateOrStr 
 * @returns {string|null} Formatted datetime string or null
 */
export function toMySQLDateTime(dateOrStr) {
    if (!dateOrStr) return null;
    
    // If already in 'YYYY-MM-DD HH:mm:ss' format, return directly
    if (typeof dateOrStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateOrStr)) {
        return dateOrStr;
    }

    try {
        if (dateOrStr instanceof Date) {
            if (isNaN(dateOrStr.getTime())) return null;
            return dateOrStr.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
        } else if (typeof dateOrStr === 'string') {
            const cleaned = dateOrStr.trim().replace('Z', '');
            if (cleaned.includes('T')) {
                const parts = cleaned.split('T');
                const datePart = parts[0];
                const timePart = parts[1].split('.')[0];
                return `${datePart} ${timePart.length === 5 ? timePart + ':00' : timePart}`;
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(cleaned)) {
                return cleaned.split('.')[0];
            }
        }

        const d = new Date(dateOrStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    } catch (e) {
        console.error('Error formatting MySQL datetime:', e);
        return null;
    }
}

/**
 * Converts any Date object or string to strict MySQL DATE format: 'YYYY-MM-DD'.
 * 
 * @param {Date|string|number} dateOrStr 
 * @returns {string|null} 'YYYY-MM-DD' or null
 */
export function toMySQLDate(dateOrStr) {
    if (!dateOrStr) return null;

    if (typeof dateOrStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)) {
        return dateOrStr;
    }

    try {
        if (dateOrStr instanceof Date) {
            if (isNaN(dateOrStr.getTime())) return null;
            return dateOrStr.toISOString().split('T')[0];
        }

        if (typeof dateOrStr === 'string') {
            return dateOrStr.trim().split('T')[0].split(' ')[0];
        }

        const d = new Date(dateOrStr);
        if (isNaN(d.getTime())) return null;

        return d.toISOString().split('T')[0];
    } catch (e) {
        console.error('Error formatting MySQL date:', e);
        return null;
    }
}

/**
 * Converts any Date object or string to strict MySQL TIME format: 'HH:mm:ss'.
 * 
 * @param {Date|string} dateOrStr 
 * @returns {string|null} 'HH:mm:ss' or null
 */
export function toMySQLTime(dateOrStr) {
    if (!dateOrStr) return null;

    if (dateOrStr instanceof Date) {
        if (isNaN(dateOrStr.getTime())) return null;
        return dateOrStr.toISOString().split('T')[1]?.split('.')[0] || null;
    }

    if (typeof dateOrStr === 'string') {
        const trimmed = dateOrStr.trim().replace('Z', '');
        if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
        if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
        if (trimmed.includes('T')) {
            const timePart = trimmed.split('T')[1]?.split('.')[0];
            if (timePart) return timePart.length === 5 ? `${timePart}:00` : timePart;
        }
        if (trimmed.includes(' ')) {
            const timePart = trimmed.split(' ')[1]?.split('.')[0];
            if (timePart) return timePart.length === 5 ? `${timePart}:00` : timePart;
        }
    }

    try {
        const d = new Date(dateOrStr);
        if (isNaN(d.getTime())) return null;

        return d.toISOString().split('T')[1]?.split('.')[0] || null;
    } catch (e) {
        return null;
    }
}


/**
 * Returns current date and time formatted in a given IANA timezone.
 * Returns both the Date object and MySQL formatted string.
 * 
 * @param {string} timezone - e.g., 'Asia/Kolkata', 'Africa/Kinshasa', 'UTC'
 * @returns {{ date: Date, isoStr: string, mysqlDateTime: string, dateStr: string, timeStr: string, timezone: string }}
 */
export function getZonedNow(timezone = 'UTC') {
    const now = new Date();
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        let hour = parts.find(p => p.type === 'hour').value;
        const minute = parts.find(p => p.type === 'minute').value;
        const second = parts.find(p => p.type === 'second').value;
        if (hour === '24') hour = '00';

        const mysqlDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
        const dateStr = `${year}-${month}-${day}`;
        const timeStr = `${hour}:${minute}:${second}`;

        return {
            date: new Date(isoStr),
            isoStr,
            mysqlDateTime,
            dateStr,
            timeStr,
            timezone
        };
    } catch (e) {
        const iso = now.toISOString();
        return {
            date: now,
            isoStr: iso,
            mysqlDateTime: toMySQLDateTime(now),
            dateStr: iso.split('T')[0],
            timeStr: iso.split('T')[1].split('.')[0],
            timezone: 'UTC'
        };
    }
}

/**
 * Safely truncates a string to avoid MySQL 'Data too long for column' errors.
 * 
 * @param {string|any} str 
 * @param {number} maxLength 
 * @returns {string|null}
 */
export function safeTruncate(str, maxLength = 250) {
    if (str === null || str === undefined) return null;
    const text = typeof str === 'string' ? str : String(str);
    return text.length > maxLength ? text.substring(0, maxLength) : text;
}

/**
 * Standard 3-letter day names from Sunday (0) to Saturday (6).
 */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns the occurrence of the weekday within its month (1 to 5).
 * e.g. 2nd Saturday returns 2.
 * 
 * @param {Date|string} date
 * @returns {number}
 */
export function getWeekdayOccurrence(date) {
    return Math.ceil(new Date(date).getDate() / 7);
}

/**
 * Converts 'HH:mm' or 'HH:mm:ss' to integer minutes from midnight.
 * 
 * @param {string} timeStr - e.g. '09:30' or '18:00:00'
 * @returns {number|null} Minutes from midnight or null if invalid/missing
 */
export function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const clean = String(timeStr).trim().replace('Z', '');
    const parts = clean.split(':').map(Number);
    if (Number.isNaN(parts[0])) return null;
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return (h * 60) + m;
}

/**
 * Converts integer minutes from midnight to a time string.
 * 
 * @param {number} totalMinutes - Minutes from midnight
 * @param {boolean} includeSeconds - Whether to append ':00' (default: true)
 * @returns {string} 'HH:mm:ss' or 'HH:mm'
 */
export function minutesToTime(totalMinutes, includeSeconds = true) {
    if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) {
        return includeSeconds ? '00:00:00' : '00:00';
    }
    const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    const hh = String(Math.min(23, h)).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return includeSeconds ? `${hh}:${mm}:00` : `${hh}:${mm}`;
}

/**
 * Calculates the difference in minutes between two 'HH:mm' or 'HH:mm:ss' times.
 * Handles overnight rollovers automatically (e.g. 22:00 to 06:00 -> 480 mins).
 * 
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {number} Difference in minutes
 */
export function diffTimesInMinutes(startTime, endTime) {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    if (startMins === null || endMins === null) return 0;

    let diff = endMins - startMins;
    if (diff < 0) diff += 24 * 60; // Overnight shift
    return diff;
}

/**
 * Calculates elapsed duration in hours between two timestamps or Date objects.
 * Formatted to 2 decimal places.
 * 
 * @param {string|Date} start - Start timestamp or Date
 * @param {string|Date} end - End timestamp or Date
 * @returns {number} Elapsed hours (e.g. 8.5)
 */
export function calculateDurationHours(start, end) {
    if (!start || !end) return 0;
    const parse = (v) => {
        if (!v) return 0;
        if (v instanceof Date) return v.getTime();
        const str = String(v).trim();
        if (!str.includes('Z') && !str.includes('+')) {
            const normalized = str.includes('T') ? `${str}Z` : `${str.replace(' ', 'T')}Z`;
            const d = new Date(normalized);
            if (!isNaN(d.getTime())) return d.getTime();
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const s = parse(start);
    const e = parse(end);
    if (!s || !e) return 0;
    const diff = e - s;
    if (diff < 0) return 0;
    return parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
}

/**
 * Checks whether a given time string (HH:MM or HH:MM:SS) falls inside a shift's working hours [start_time, end_time].
 * Handles both normal daytime shifts (e.g. 09:00 - 18:00) and overnight shifts crossing midnight (e.g. 22:00 - 06:00).
 *
 * @param {string} checkTime - Time to check (e.g. "16:00")
 * @param {string} startTime - Shift start time (e.g. "09:00")
 * @param {string} endTime - Shift end time (e.g. "18:00")
 * @returns {boolean} True if checkTime falls within the shift working window
 */
export function isTimeInShiftRange(checkTime, startTime, endTime) {
    if (!checkTime || !startTime || !endTime) return false;
    const c = timeToMinutes(checkTime);
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
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
}

/**
 * Calculates the total duration of a shift in minutes from start and end times (HH:MM or HH:MM:SS).
 * Handles overnight shifts crossing midnight seamlessly.
 *
 * @param {string} startTime - e.g. "09:00"
 * @param {string} endTime - e.g. "18:00"
 * @returns {number} Duration in minutes
 */
export function getShiftDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null) return 0;
    if (e >= s) {
        return e - s;
    } else {
        return (24 * 60 - s) + e;
    }
}
