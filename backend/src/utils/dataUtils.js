/**
 * Centralized Data & Type Parsing Utilities
 */

/**
 * Safely parses any value into a boolean.
 * Handles booleans, numbers (1/0), and strings ('true', 'false', '1', '0', 'yes', 'no', 'on', 'off', 'active').
 * 
 * @param {any} val - The input value to parse
 * @param {boolean} defaultVal - Default fallback if value is null/undefined/empty
 * @returns {boolean}
 */
export function parseBool(val, defaultVal = false) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
        const s = val.toLowerCase().trim();
        if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'active') return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'inactive') return false;
    }
    return Boolean(val);
}

/**
 * Normalizes input to 1 or 0 for MySQL TINYINT columns.
 * 
 * @param {any} val - Input value
 * @param {number} defaultVal - Fallback 1 or 0
 * @returns {number} 1 or 0
 */
export function toDbFlag(val, defaultVal = 0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    return parseBool(val, defaultVal === 1) ? 1 : 0;
}

/**
 * Safely parses a JSON string into an object/array.
 * If already an object/array, returns as-is.
 * If invalid JSON or null, returns the fallback value.
 * 
 * @param {any} val - The raw value to parse
 * @param {any} fallback - Fallback returned on parse failure (default: {})
 * @returns {any}
 */
export function safeJsonParse(val, fallback = {}) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val !== 'string') return fallback;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}
