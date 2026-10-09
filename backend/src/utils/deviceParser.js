import crypto from 'crypto';

/**
 * Device and User Agent parser for Session Management & Security Diagnostics
 */

/**
 * Packs raw User-Agent with structured device metadata
 * Format: rawUserAgent|||{"device_id":"...","device_name":"...","last_active_at":"..."}
 */
export function packUserAgent(rawUserAgent = '', metadata = {}) {
    const ua = (rawUserAgent || '').trim();
    if (!metadata || Object.keys(metadata).length === 0) return ua;
    try {
        return `${ua}|||${JSON.stringify(metadata)}`;
    } catch (_) {
        return ua;
    }
}

/**
 * Unpacks stored User-Agent and extracts raw UA and metadata
 */
export function unpackUserAgent(storedUserAgent = '') {
    if (!storedUserAgent || typeof storedUserAgent !== 'string') {
        return { rawUa: '', metadata: {} };
    }

    if (storedUserAgent.includes('|||')) {
        const parts = storedUserAgent.split('|||');
        const rawUa = parts[0];
        try {
            const metadata = JSON.parse(parts.slice(1).join('|||'));
            return { rawUa, metadata: metadata || {} };
        } catch (_) {
            return { rawUa, metadata: {} };
        }
    }

    // Check if entire string is JSON
    if (storedUserAgent.startsWith('{') && storedUserAgent.endsWith('}')) {
        try {
            const parsed = JSON.parse(storedUserAgent);
            return { rawUa: parsed.ua || parsed.raw || '', metadata: parsed };
        } catch (_) {}
    }

    return { rawUa: storedUserAgent, metadata: {} };
}

/**
 * Generates a stable, deterministic fallback device ID when client doesn't provide one
 */
export function getDeterministicDeviceId(userId, rawUserAgent = '') {
    const seed = `${userId || 'anon'}_${rawUserAgent || 'legacy'}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 24);
    return `dvc_${hash}`;
}

/**
 * Extracts and normalizes device info from Express request
 */
export function extractDeviceInfo(req, userId = null) {
    const rawUa = req?.get ? (req.get('User-Agent') || '') : (req?.headers?.['user-agent'] || '');
    const clientIp = req?.clientIp || req?.ip || '';

    // 1. Unique Device ID (from header, body, or cookie)
    let deviceId = req?.headers?.['x-device-id'] || 
                   req?.headers?.['x-client-device-id'] || 
                   req?.body?.deviceId || 
                   req?.body?.device_id || 
                   req?.cookies?.mano_device_id || 
                   '';

    if (deviceId && typeof deviceId === 'string') {
        deviceId = deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 128);
    }

    // Fallback if not provided by client
    if (!deviceId) {
        deviceId = getDeterministicDeviceId(userId, rawUa);
    }

    // 2. Parse basic UA
    const parsed = parseUserAgent(rawUa);

    // 3. Device Name (from header or derived)
    let deviceName = req?.headers?.['x-device-name'] || 
                     req?.body?.deviceName || 
                     req?.body?.device_name || 
                     '';

    if (deviceName && typeof deviceName === 'string') {
        deviceName = deviceName.trim().substring(0, 150);
    } else {
        deviceName = parsed.device_label || 'Unknown Device';
    }

    const metadata = {
        device_id: deviceId,
        device_name: deviceName,
        device_type: parsed.device_type,
        os: parsed.os,
        browser: parsed.browser,
        last_active_at: new Date().toISOString(),
        client_ip: clientIp
    };

    return {
        rawUa,
        deviceId,
        deviceName,
        clientIp,
        metadata,
        packedUa: packUserAgent(rawUa, metadata),
        parsed
    };
}

/**
 * Parse User Agent string into device, OS, browser attributes
 */
export function parseUserAgent(storedUserAgent = '') {
    const { rawUa, metadata } = unpackUserAgent(storedUserAgent);

    if (!rawUa || typeof rawUa !== 'string') {
        return {
            raw: rawUa || '',
            device_id: metadata?.device_id || '',
            device_name: metadata?.device_name || 'Unknown Device',
            last_active_at: metadata?.last_active_at || null,
            device_type: 'unknown',
            device_label: 'Unknown Device',
            os: 'Unknown',
            os_version: '',
            browser: 'Unknown',
            browser_version: '',
            is_mobile: false,
            is_tablet: false,
            is_desktop: false,
            is_api: false
        };
    }

    const ua = rawUa.trim();
    const uaLower = ua.toLowerCase();

    let device_type = 'desktop';
    let os = 'Unknown OS';
    let os_version = '';
    let browser = 'Unknown Browser';
    let browser_version = '';

    // 1. Detect OS
    if (uaLower.includes('windows nt 10.0')) {
        os = 'Windows';
        os_version = '10/11';
    } else if (uaLower.includes('windows nt 6.3')) {
        os = 'Windows';
        os_version = '8.1';
    } else if (uaLower.includes('windows nt 6.1')) {
        os = 'Windows';
        os_version = '7';
    } else if (uaLower.includes('windows')) {
        os = 'Windows';
    } else if (uaLower.includes('android')) {
        os = 'Android';
        const match = ua.match(/Android\s+([\d.]+)/i);
        if (match) os_version = match[1];
    } else if (uaLower.includes('iphone')) {
        os = 'iOS';
        const match = ua.match(/OS\s+([\d_]+)/i);
        if (match) os_version = match[1].replace(/_/g, '.');
    } else if (uaLower.includes('ipad')) {
        os = 'iPadOS';
        const match = ua.match(/OS\s+([\d_]+)/i);
        if (match) os_version = match[1].replace(/_/g, '.');
    } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
        os = 'macOS';
        const match = ua.match(/Mac OS X\s+([\d_]+)/i);
        if (match) os_version = match[1].replace(/_/g, '.');
    } else if (uaLower.includes('cros')) {
        os = 'ChromeOS';
    } else if (uaLower.includes('linux')) {
        os = 'Linux';
    }

    // 2. Detect Device Type
    if (uaLower.includes('ipad') || uaLower.includes('tablet')) {
        device_type = 'tablet';
    } else if (
        uaLower.includes('mobile') ||
        uaLower.includes('iphone') ||
        uaLower.includes('ipod') ||
        uaLower.includes('dart') ||
        (uaLower.includes('android') && !uaLower.includes('tablet'))
    ) {
        device_type = 'mobile';
    } else if (
        uaLower.includes('bot') ||
        uaLower.includes('crawler') ||
        uaLower.includes('spider') ||
        uaLower.includes('hoppscotch') ||
        uaLower.includes('postman') ||
        uaLower.includes('curl') ||
        uaLower.includes('axios')
    ) {
        device_type = 'api_client';
    } else {
        device_type = 'desktop';
    }

    // 3. Detect Browser / Client
    if (uaLower.includes('dart/')) {
        browser = 'Mobile App (Flutter)';
        const match = ua.match(/Dart\/([\d.]+)/i);
        if (match) browser_version = match[1];
        if (os === 'Unknown OS') os = 'Android / iOS';
        device_type = 'mobile';
    } else if (uaLower.includes('edg/')) {
        browser = 'Microsoft Edge';
        const match = ua.match(/Edg\/([\d.]+)/i);
        if (match) browser_version = match[1].split('.')[0];
    } else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
        browser = 'Opera';
        const match = ua.match(/(?:OPR|Opera)\/([\d.]+)/i);
        if (match) browser_version = match[1].split('.')[0];
    } else if (uaLower.includes('chrome/') && !uaLower.includes('chromium')) {
        browser = 'Google Chrome';
        const match = ua.match(/Chrome\/([\d.]+)/i);
        if (match) browser_version = match[1].split('.')[0];
    } else if (uaLower.includes('firefox/')) {
        browser = 'Mozilla Firefox';
        const match = ua.match(/Firefox\/([\d.]+)/i);
        if (match) browser_version = match[1].split('.')[0];
    } else if (uaLower.includes('version/') && uaLower.includes('safari')) {
        browser = 'Apple Safari';
        const match = ua.match(/Version\/([\d.]+)/i);
        if (match) browser_version = match[1].split('.')[0];
    } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
        browser = 'Apple Safari';
    } else if (uaLower.includes('hoppscotch')) {
        browser = 'Hoppscotch';
        const match = ua.match(/HoppscotchKernel\/([\d.]+)/i);
        if (match) browser_version = match[1];
        device_type = 'api_client';
    } else if (uaLower.includes('postman')) {
        browser = 'Postman';
        device_type = 'api_client';
    } else if (uaLower.includes('curl')) {
        browser = 'cURL';
        device_type = 'api_client';
    }

    const device_label = metadata?.device_name || `${os}${os_version ? ' ' + os_version : ''} · ${browser}${browser_version ? ' ' + browser_version : ''}`;

    return {
        raw: ua,
        device_id: metadata?.device_id || '',
        device_name: metadata?.device_name || device_label,
        last_active_at: metadata?.last_active_at || null,
        device_type: metadata?.device_type || device_type,
        device_label,
        os,
        os_version,
        browser,
        browser_version,
        is_mobile: (metadata?.device_type || device_type) === 'mobile',
        is_tablet: (metadata?.device_type || device_type) === 'tablet',
        is_desktop: (metadata?.device_type || device_type) === 'desktop',
        is_api: (metadata?.device_type || device_type) === 'api_client'
    };
}
