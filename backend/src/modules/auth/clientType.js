/**
 * Client Type detection and Auth Transport instrumentation.
 *
 * Implements the EXPAND phase helper:
 * - X-Client-Type: mobile selects the new body-based mobile transport.
 * - Missing or any other value selects the existing transport (cookie/header).
 */

/**
 * Reads the X-Client-Type header from the request.
 * @param {import('express').Request} req
 * @returns {'mobile' | 'other'}
 */
export function getClientType(req) {
    const raw = req?.get ? req.get('x-client-type') : req?.headers?.['x-client-type'];
    if (typeof raw === 'string' && raw.trim().toLowerCase() === 'mobile') {
        return 'mobile';
    }
    return 'other';
}

/**
 * Helper to check if the caller is the new mobile transport.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isMobileClient(req) {
    return getClientType(req) === 'mobile';
}

/**
 * Emits a structured log line tagged [AUTH_TRANSPORT].
 * Token values are NEVER logged.
 *
 * @param {object} params
 * @param {string} params.endpoint - e.g. '/auth/login', '/auth/refresh', '/auth/logout'
 * @param {import('express').Request} params.req - Express request object
 * @param {'body' | 'cookie' | 'header'} params.transport - Token transport used
 * @param {number | string | null} [params.sessionId] - Session ID if available, otherwise 'none'
 */
export function logAuthTransport({ endpoint, req, transport, sessionId = null }) {
    const clientType = getClientType(req);
    const rawVersion = req?.get ? req.get('x-app-version') : req?.headers?.['x-app-version'];
    const appVersion = (typeof rawVersion === 'string' && rawVersion.trim()) ? rawVersion.trim() : 'none';
    const sid = (sessionId !== null && sessionId !== undefined && sessionId !== '') ? sessionId : 'none';

    console.info(`[AUTH_TRANSPORT] endpoint=${endpoint} clientType=${clientType} transport=${transport} appVersion=${appVersion} sessionId=${sid}`);
}
