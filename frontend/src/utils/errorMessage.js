/**
 * Utility function to parse API errors, HTTP statuses, and network failures
 * into clean, user-friendly messages for toaster notifications.
 *
 * @param {any} error - The caught error object, string, or HTTP response.
 * @param {string} [fallbackMessage="An unexpected error occurred. Please try again."] - Default fallback message.
 * @returns {string} Human-readable error message.
 */
export function getErrorMessage(
    error,
    fallbackMessage = "An unexpected error occurred. Please try again."
) {
    if (!error) return fallbackMessage;

    // Handle plain string error
    if (typeof error === 'string') {
        const trimmed = error.trim();
        if (trimmed.startsWith('<')) {
            return fallbackMessage; // Strips HTML tags
        }
        return trimmed;
    }

    // Check pre-parsed custom user message attached by Axios interceptor
    if (error.userMessage) {
        return error.userMessage;
    }

    // Handle Error instance without response (e.g. Network Error, Timeout)
    if (!error.response) {
        if (error.message === 'Network Error') {
            return 'Unable to connect to the server. Please check your internet connection.';
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return 'Request timed out. Please check your connection and try again.';
        }
        if (error.message && typeof error.message === 'string' && !error.message.startsWith('<')) {
            return error.message;
        }
        return fallbackMessage;
    }

    const { status, data } = error.response;

    // HTTP Status 413: Payload / File Too Large
    if (status === 413) {
        return 'The uploaded file or image size is too large for the server. Please select a smaller file (under 5MB).';
    }

    // HTTP Status 414: URI Too Long
    if (status === 414) {
        return 'The request URL is too long.';
    }

    // HTTP Status 429: Rate Limit
    if (status === 429) {
        return 'Too many requests. Please wait a moment before trying again.';
    }

    // HTTP Status 403: Forbidden
    if (status === 403) {
        if (data && typeof data === 'object' && data.message && typeof data.message === 'string') {
            return data.message;
        }
        return 'You do not have permission to perform this action.';
    }

    // HTTP Status 401: Unauthorized
    if (status === 401) {
        if (data && typeof data === 'object' && data.message && typeof data.message === 'string') {
            return data.message;
        }
        return 'Session expired or unauthorized. Please log in again.';
    }

    // HTTP Status 404: Not Found
    if (status === 404) {
        if (data && typeof data === 'object' && data.message && typeof data.message === 'string') {
            return data.message;
        }
        return 'The requested resource could not be found.';
    }

    // Check JSON response payload for message or errors array
    if (data && typeof data === 'object') {
        if (data.message && typeof data.message === 'string' && !data.message.trim().startsWith('<')) {
            return data.message;
        }
        if (data.error && typeof data.error === 'string' && !data.error.trim().startsWith('<')) {
            return data.error;
        }
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            const parsed = data.errors
                .map(err => (typeof err === 'string' ? err : err.msg || err.message))
                .filter(msg => msg && typeof msg === 'string' && !msg.startsWith('<'))
                .join(', ');
            if (parsed) return parsed;
        }
    }

    // Handle HTML error response strings (e.g. 502/504 Bad Gateway from reverse proxy)
    if (typeof data === 'string' && data.trim().startsWith('<')) {
        if (status >= 500) {
            return 'Server error encountered. Please try again later.';
        }
        return fallbackMessage;
    }

    // HTTP 5xx Server Errors
    if (status >= 500) {
        return 'Server error encountered. Please try again later or contact support.';
    }

    return fallbackMessage;
}
