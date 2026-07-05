import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance
const api = axios.create({
    baseURL: '/api', // Proxy in vite config handles /api -> http://localhost:5001/api
    withCredentials: true, // Send cookies with every request
    headers: {
        'Content-Type': 'application/json',
    },
});

const CACHE_KEY = 'attendance_api_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const getCache = () => {
    try {
        const cache = sessionStorage.getItem(CACHE_KEY);
        return cache ? JSON.parse(cache) : {};
    } catch {
        return {};
    }
};

const saveCache = (cache) => {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to write to sessionStorage cache:', e);
    }
};

const cleanExpiredCache = (cache) => {
    const now = Date.now();
    const cleaned = {};
    Object.keys(cache).forEach(key => {
        if (now - cache[key].timestamp < CACHE_TTL) {
            cleaned[key] = cache[key];
        }
    });
    return cleaned;
};

export const clearApiCache = () => {
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {
        console.warn('Failed to clear cache:', e);
    }
};

const originalAdapter = api.defaults.adapter || axios.defaults.adapter;

api.defaults.adapter = async (config) => {
    const isGet = config.method?.toLowerCase() === 'get';
    const excludeUrls = ['/auth/me', '/auth/refresh', '/auth/logout'];
    const shouldCache = isGet && !excludeUrls.some(url => config.url?.includes(url));

    const getResolvedAdapter = () => {
        const targetAdapter = (config.adapter && config.adapter !== api.defaults.adapter)
            ? config.adapter
            : originalAdapter;
        if (typeof axios.getAdapter === 'function') {
            return axios.getAdapter(targetAdapter);
        }
        return targetAdapter;
    };

    if (shouldCache) {
        const cacheKey = `${config.url || ''}?${JSON.stringify(config.params || {})}`;
        const cache = getCache();
        const cachedItem = cache[cacheKey];
        const now = Date.now();

        if (cachedItem && (now - cachedItem.timestamp < CACHE_TTL)) {
            return {
                ...cachedItem.response,
                config,
            };
        }

        const defaultAdapter = getResolvedAdapter();
        const response = await defaultAdapter(config);

        const newCache = getCache();
        newCache[cacheKey] = {
            timestamp: Date.now(),
            response: {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            }
        };
        saveCache(cleanExpiredCache(newCache));
        return response;
    }

    if (config.method && config.method.toLowerCase() !== 'get') {
        clearApiCache();
    }

    const defaultAdapter = getResolvedAdapter();
    return defaultAdapter(config);
};

// Request Interceptor
let accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

export const setAccessToken = (token) => {
    accessToken = token;
    if (typeof window !== 'undefined') {
        if (token) {
            localStorage.setItem('accessToken', token);
        } else {
            localStorage.removeItem('accessToken');
        }
    }
};

export const getAccessToken = () => accessToken;

api.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {

            // Prevent infinite loops if refresh itself fails
            if (originalRequest.url.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            // Don't try to refresh if the login attempt itself failed
            if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/super-admin/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await api.post('/auth/refresh');
                if (res.status === 200) {
                    const newAccessToken = res.data.accessToken;
                    setAccessToken(newAccessToken);
                    processQueue(null, newAccessToken);

                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                
                // Only force logout if the backend explicitly rejected the refresh token (401/403)
                // If it's a 500 error or network timeout, keep the session state intact
                if (refreshError.response && (refreshError.response.status === 401 || refreshError.response.status === 403)) {
                    setAccessToken(null);

                    // Clear browser caches (preserving themes)
                    const theme = localStorage.getItem("theme");
                    const showcaseTheme = localStorage.getItem("showcase-theme");
                    localStorage.clear();
                    sessionStorage.clear();
                    if (theme) localStorage.setItem("theme", theme);
                    if (showcaseTheme) localStorage.setItem("showcase-theme", showcaseTheme);

                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response && error.response.status >= 500) {
            console.error("Server Error:", error.response.data);
        }

        return Promise.reject(error);
    }
);

export default api;
