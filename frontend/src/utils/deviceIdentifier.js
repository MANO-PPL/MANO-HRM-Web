/**
 * Persistent Device Identifier & Friendly Name Generator
 * Ensures unique tracking of physical devices across network changes (IP changes, Wi-Fi to cellular)
 */

const STORAGE_KEY = 'mano_device_id';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Returns a persistent device ID unique to this browser / machine instance
 */
export function getPersistentDeviceId() {
  if (typeof window === 'undefined') return 'server_side';

  try {
    // 1. Check LocalStorage
    let id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      // Sync cookie backup
      setCookie(STORAGE_KEY, id);
      return id;
    }

    // 2. Check Cookie backup
    id = getCookie(STORAGE_KEY);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      return id;
    }

    // 3. Generate new persistent ID
    id = `web_${generateUUID()}`;
    localStorage.setItem(STORAGE_KEY, id);
    setCookie(STORAGE_KEY, id);
    return id;
  } catch (_) {
    return `tmp_${generateUUID()}`;
  }
}

/**
 * Derives a human-friendly name for this browser & OS
 */
export function getFriendlyDeviceName() {
  if (typeof navigator === 'undefined') return 'Web Client';

  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  let browser = 'Browser';

  // OS
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'Mac';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android Device';
  else if (ua.includes('Linux')) os = 'Linux PC';

  // Browser
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  return `${browser} on ${os}`;
}
