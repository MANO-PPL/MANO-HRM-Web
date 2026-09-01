/**
 * Centralized Date, Time & Sanitization Utility
 * Ensures compatibility with MySQL 8.0 strict mode (STRICT_TRANS_TABLES)
 * and supports multi-timezone conversions (e.g., India IST, Congo WAT, UTC).
 */

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
        let d;
        if (dateOrStr instanceof Date) {
            return dateOrStr.toISOString().replace('T', ' ').split('.')[0];
        } else if (typeof dateOrStr === 'string') {
            // Handle ISO strings with 'T' and optional 'Z' or offset
            const cleaned = dateOrStr.trim();
            // If it's an ISO string like '2026-08-31T20:43:54.000Z' or '2026-08-31T20:43:54'
            if (cleaned.includes('T')) {
                const parts = cleaned.replace('Z', '').split('T');
                const datePart = parts[0];
                const timePart = parts[1].split('.')[0]; // remove milliseconds
                return `${datePart} ${timePart.length === 5 ? timePart + ':00' : timePart}`;
            }
            d = new Date(cleaned);
        } else {
            d = new Date(dateOrStr);
        }

        if (isNaN(d.getTime())) return null;
        return d.toISOString().replace('T', ' ').split('.')[0];
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
            return dateOrStr.toISOString().split('T')[0];
        }

        if (typeof dateOrStr === 'string') {
            const trimmed = dateOrStr.trim();
            if (trimmed.includes('T')) {
                return trimmed.split('T')[0];
            }
            if (trimmed.includes(' ')) {
                return trimmed.split(' ')[0];
            }
        }

        const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
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
        return dateOrStr.toISOString().split('T')[1]?.split('.')[0] || null;
    }

    if (typeof dateOrStr === 'string') {
        const trimmed = dateOrStr.trim();
        if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
        if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
        if (trimmed.includes('T')) {
            const timePart = trimmed.split('T')[1]?.split('.')[0]?.replace('Z', '');
            if (timePart) return timePart.length === 5 ? `${timePart}:00` : timePart;
        }
        if (trimmed.includes(' ')) {
            const timePart = trimmed.split(' ')[1]?.split('.')[0];
            if (timePart) return timePart.length === 5 ? `${timePart}:00` : timePart;
        }
    }

    try {
        const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
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
