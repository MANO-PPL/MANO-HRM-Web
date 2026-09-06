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

