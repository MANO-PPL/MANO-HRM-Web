import api from './api';
import { getLocalDateString } from '../utils/dateUtils';
import correctionsService, { correctionsCacheData, clearCorrectionsCache } from './correctionsService';

const API_BASE_URL = "/attendance";

// Client-side memory cache for attendance data
const cache = {
    holidays: null,
    shiftPolicy: null,
    records: new Map(),
    dailySummaryAdmin: new Map(),
    dailySummary: new Map(),
    realTimeAttendance: new Map(),
    myStats: new Map(),
    todayStatus: new Map(),
    recentActivity: new Map()
};

// Tracks retrieval timestamps for live attendance caches
const cacheTimestamps = {
    dailySummaryAdmin: new Map(),
    realTimeAttendance: new Map()
};

// Synchronous client-side cache for direct component consumption
export const attendanceCacheData = {
    holidays: null,
    shiftPolicy: null,
    records: {},
    correctionRequests: correctionsCacheData.correctionRequests,
    correctionDetails: correctionsCacheData.correctionDetails,
    dailySummaryAdmin: {},
    dailySummary: {},
    realTimeAttendance: {},
    myStats: {},
    todayStatus: {},
    recentActivity: {}
};

// Clear shift policy cache specifically
export const clearShiftPolicyCache = () => {
    cache.shiftPolicy = null;
    attendanceCacheData.shiftPolicy = null;
};

// Clear the cache when data changes
const clearCache = () => {
    cache.holidays = null;
    cache.shiftPolicy = null;
    cache.records.clear();
    cache.dailySummaryAdmin.clear();
    cache.dailySummary.clear();
    cache.realTimeAttendance.clear();
    cache.myStats.clear();
    cache.todayStatus.clear();
    cache.recentActivity.clear();

    cacheTimestamps.dailySummaryAdmin.clear();
    cacheTimestamps.realTimeAttendance.clear();

    clearCorrectionsCache();

    attendanceCacheData.holidays = null;
    attendanceCacheData.shiftPolicy = null;
    attendanceCacheData.records = {};
    attendanceCacheData.dailySummaryAdmin = {};
    attendanceCacheData.dailySummary = {};
    attendanceCacheData.realTimeAttendance = {};
    attendanceCacheData.myStats = {};
    attendanceCacheData.todayStatus = {};
    attendanceCacheData.recentActivity = {};
};

export const attendanceService = {
    // Check In
    async timeIn(data) {
        const formData = new FormData();
        formData.append("latitude", data.latitude);
        formData.append("longitude", data.longitude);
        formData.append("accuracy", data.accuracy);
        const tz = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        formData.append("timezone", tz);
        if (data.address) {
            formData.append("address", data.address);
        }
        if (data.imageFile) {
            formData.append("image", data.imageFile, "selfie.jpg");
        }
        if (data.late_reason) {
            formData.append("late_reason", data.late_reason);
        }

        try {
            const res = await api.post(`${API_BASE_URL}/timein`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to check in");
        }
    },

    // Check Out
    async timeOut(data) {
        const formData = new FormData();
        formData.append("latitude", data.latitude);
        formData.append("longitude", data.longitude);
        formData.append("accuracy", data.accuracy);
        const tz = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        formData.append("timezone", tz);
        if (data.address) {
            formData.append("address", data.address);
        }
        if (data.imageFile) {
            formData.append("image", data.imageFile, "selfie.jpg");
        }

        try {
            const res = await api.post(`${API_BASE_URL}/timeout`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to check out");
        }
    },

    // Mark Checkpoint (Presence/Location Ping)
    async markCheckpoint(data) {
        try {
            const formData = new FormData();
            formData.append("latitude", data.latitude);
            formData.append("longitude", data.longitude);
            if (data.accuracy != null) formData.append("accuracy", data.accuracy);
            if (data.address) formData.append("address", data.address);
            if (data.note) formData.append("note", data.note);
            if (data.localTime) formData.append("local_time", data.localTime);
            formData.append("is_geofence_violation", Boolean(data.is_geofence_violation));
            if (data.imageFile) {
                formData.append("image", data.imageFile, "checkpoint_selfie.jpg");
            } else if (data.image && typeof data.image === 'string' && data.image.startsWith('data:')) {
                try {
                    const parts = data.image.split(',');
                    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const bstr = atob(parts[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    formData.append("image", blob, "checkpoint_selfie.jpg");
                } catch (bErr) {
                    console.warn("Failed to convert dataURL to Blob in markCheckpoint", bErr);
                }
            } else if (data.image) {
                formData.append("image", data.image, "checkpoint_selfie.jpg");
            }

            const res = await api.post(`${API_BASE_URL}/ping`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to mark checkpoint");
        }
    },

    // Get Records for a user
    async getMyRecords(dateFrom, dateTo, forceRefresh = false) {
        const cacheKey = `${dateFrom || ''}_${dateTo || ''}`;
        if (forceRefresh) {
            cache.records.delete(cacheKey);
            delete attendanceCacheData.records[cacheKey];
        } else if (cache.records.has(cacheKey)) {
            return cache.records.get(cacheKey);
        }

        const promise = (async () => {
            let url = `${API_BASE_URL}/records?limit=50`;
            if (dateFrom) url += `&date_from=${dateFrom}`;
            if (dateTo) url += `&date_to=${dateTo}`;

            try {
                const res = await api.get(url);
                attendanceCacheData.records[cacheKey] = res.data;
                // Auto-expire cache after 30 seconds so records don't stay stale indefinitely
                setTimeout(() => {
                    cache.records.delete(cacheKey);
                    delete attendanceCacheData.records[cacheKey];
                }, 30000);
                return res.data;
            } catch (error) {
                cache.records.delete(cacheKey);
                delete attendanceCacheData.records[cacheKey];
                throw new Error(error.response?.data?.message || "Failed to fetch records");
            }
        })();

        cache.records.set(cacheKey, promise);
        return promise;
    },


    // Get Real-time Attendance (Admin)
    async getRealTimeAttendance(date, forceRefresh = false) {
        // Defaults to today if no date provided
        const targetDate = date || getLocalDateString();
        
        const now = Date.now();
        const cachedTime = cacheTimestamps.realTimeAttendance.get(targetDate);
        if (!forceRefresh && cache.realTimeAttendance.has(targetDate)) {
            if (cachedTime && (now - cachedTime < 15 * 60 * 1000)) {
                return cache.realTimeAttendance.get(targetDate);
            } else {
                cache.realTimeAttendance.delete(targetDate);
                delete attendanceCacheData.realTimeAttendance[targetDate];
                cacheTimestamps.realTimeAttendance.delete(targetDate);
            }
        }

        const promise = (async () => {
            let url = `${API_BASE_URL}/records/admin?date_from=${targetDate}&date_to=${targetDate}&limit=200`;
            try {
                const res = await api.get(url);
                attendanceCacheData.realTimeAttendance[targetDate] = res.data;
                cacheTimestamps.realTimeAttendance.set(targetDate, Date.now());
                return res.data;
            } catch (error) {
                cache.realTimeAttendance.delete(targetDate);
                delete attendanceCacheData.realTimeAttendance[targetDate];
                cacheTimestamps.realTimeAttendance.delete(targetDate);
                throw new Error(error.response?.data?.message || "Failed to fetch live attendance");
            }
        })();

        cache.realTimeAttendance.set(targetDate, promise);
        return promise;
    },

    // Get Specific User's Daily Records (Admin Correction Context)
    async getUserDailyRecords(userId, date) {
        if (!userId || !date) return [];
        let url = `${API_BASE_URL}/records/admin?user_id=${userId}&date_from=${date}&date_to=${date}`;
        try {
            const res = await api.get(url);
            return res.data.data || []; // Helper to return just data array
        } catch (error) {
            console.error("Failed to fetch user records", error);
            return [];
        }
    },

    // Download My Monthly Report
    async downloadMyReport(month, format = "xlsx") {
        try {
            const url = `/attendance/reports/download?month=${month}&format=${format}&type=attendance_detailed`;
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to download your report");
        }
    },

    async getMyReportStatus(reportId) {
        try {
            const response = await api.get(`/attendance/reports/status/${reportId}`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch report status");
        }
    },

    // --- Correction Requests (Delegated to standalone correctionsService) ---
    submitCorrectionRequest(data) {
        return correctionsService.submitCorrectionRequest(data);
    },
    getCorrectionRequests(params = {}) {
        return correctionsService.getCorrectionRequests(params);
    },
    getCorrectionDetails(acr_id) {
        return correctionsService.getCorrectionDetails(acr_id);
    },
    updateCorrectionStatus(acr_id, status, review_comments, overrides = {}) {
        return correctionsService.updateCorrectionStatus(acr_id, status, review_comments, overrides);
    },

    // Get Holidays
    async getHolidays() {
        if (cache.holidays) {
            return cache.holidays;
        }

        const promise = (async () => {
            try {
                const res = await api.get('/holiday');
                attendanceCacheData.holidays = res.data;
                return res.data;
            } catch (error) {
                cache.holidays = null;
                throw new Error(error.response?.data?.message || "Failed to fetch holidays");
            }
        })();

        cache.holidays = promise;
        return promise;
    },

    // Employee Dashboard Stats
    async getMyStats(forceRefresh = false) {
        const today = new Date();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (!forceRefresh && cache.myStats.has(monthKey)) {
            return cache.myStats.get(monthKey);
        }

        const promise = (async () => {
            try {
                const startOfMonth = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
                const endOfMonth = getLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));

                const res = await this.getMyRecords(startOfMonth, endOfMonth);
                const records = res.data || [];

                let daysPresent = 0;
                let lateDays = 0;
                let totalHours = 0;

                records.forEach(record => {
                    if (record.time_in) daysPresent++;
                    if (record.status === 'LATE' || record.late_minutes > 0) lateDays++;
                    if (record.duration) {
                        const [hours, minutes] = record.duration.split(':').map(Number);
                        totalHours += hours + (minutes / 60);
                    }
                });

                const avgHours = daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) : 0;

                const result = {
                    success: true,
                    data: {
                        daysPresent,
                        daysAbsent: 0, // Mocked for simplicity without schedule logic
                        lateDays,
                        avgHours
                    }
                };
                attendanceCacheData.myStats[monthKey] = result;
                return result;
            } catch (error) {
                cache.myStats.delete(monthKey);
                return { success: false, data: { daysPresent: 0, daysAbsent: 0, lateDays: 0, avgHours: 0 } };
            }
        })();

        cache.myStats.set(monthKey, promise);
        return promise;
    },

    // Employee Today's Status
    async getTodayStatus(forceRefresh = false) {
        const today = getLocalDateString();
        if (!forceRefresh && cache.todayStatus.has(today)) {
            return cache.todayStatus.get(today);
        }

        const promise = (async () => {
            try {
                const res = await this.getDailySummary(today, today);
                const dayData = (res.data && res.data.length > 0) ? res.data[0] : null;
                const mappedData = dayData ? {
                    ...dayData,
                    time_in: dayData.first_in,
                    time_out: dayData.last_out,
                    duration: dayData.total_hours !== undefined ? `${dayData.total_hours}h` : null
                } : null;
                const result = {
                    success: true,
                    data: mappedData
                };
                attendanceCacheData.todayStatus[today] = result;
                return result;
            } catch (error) {
                cache.todayStatus.delete(today);
                return { success: false, data: null };
            }
        })();

        cache.todayStatus.set(today, promise);
        return promise;
    },

    // Upcoming Holidays
    async getUpcomingHolidays() {
        try {
            const res = await this.getHolidays();
            const holidays = res.holidays || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcoming = holidays
                .filter(holiday => {
                    if (!holiday.holiday_date) return false;
                    const dateParts = holiday.holiday_date.split('-');
                    if (dateParts.length !== 3) return false;
                    const hDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
                    return hDate >= today;
                })
                .sort((a, b) => {
                    const aParts = a.holiday_date.split('-');
                    const bParts = b.holiday_date.split('-');
                    const aDate = new Date(parseInt(aParts[0], 10), parseInt(aParts[1], 10) - 1, parseInt(aParts[2], 10));
                    const bDate = new Date(parseInt(bParts[0], 10), parseInt(bParts[1], 10) - 1, parseInt(bParts[2], 10));
                    return aDate - bDate;
                })
                .map(holiday => ({
                    id: holiday.holiday_id,
                    name: holiday.holiday_name,
                    date: holiday.holiday_date,
                    type: holiday.holiday_type
                }));

            return { success: true, data: upcoming };
        } catch (error) {
            console.error("getUpcomingHolidays error:", error);
            return { success: false, data: [] };
        }
    },

    // Safe Date parser helper to handle cross-browser parser variations
    safeParseDate(dateStr) {
        if (!dateStr) return new Date(NaN);
        if (dateStr instanceof Date) return dateStr;
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;

        if (typeof dateStr === 'string') {
            const cleaned = dateStr.replace(' ', 'T');
            d = new Date(cleaned);
            if (!isNaN(d.getTime())) return d;

            const parts = dateStr.split(/[- :T.]/);
            if (parts.length >= 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                const minute = parts[4] ? parseInt(parts[4], 10) : 0;
                const second = parts[5] ? parseInt(parts[5], 10) : 0;
                d = new Date(year, month, day, hour, minute, second);
                if (!isNaN(d.getTime())) return d;
            }
        }
        return new Date(NaN);
    },

    // Recent Activity Feed
    async getRecentActivity(forceRefresh = false) {
        const today = new Date();
        const todayStr = getLocalDateString(today);
        if (!forceRefresh && cache.recentActivity.has(todayStr)) {
            return cache.recentActivity.get(todayStr);
        }

        const promise = (async () => {
            try {
                const lastWeek = new Date(today);
                lastWeek.setDate(lastWeek.getDate() - 7);

                const res = await this.getMyRecords(getLocalDateString(lastWeek), todayStr);
                const records = res.data || [];

                const activities = [];
                records.forEach(record => {
                    const recId = record.attendance_id || record.acr_id || record.id || Math.random();
                    if (record.time_in) {
                        const directDate = this.safeParseDate(record.time_in);
                        activities.push({
                            id: `in-${recId}`,
                            type: 'check-in',
                            action: 'Checked In',
                            time: isNaN(directDate.getTime()) 
                                ? String(record.time_in) 
                                : directDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                            rawTime: isNaN(directDate.getTime()) ? new Date() : directDate,
                            status: record.status
                        });
                    }
                    if (record.time_out) {
                        const directDate = this.safeParseDate(record.time_out);
                        activities.push({
                            id: `out-${recId}`,
                            type: 'check-out',
                            action: 'Checked Out',
                            time: isNaN(directDate.getTime()) 
                                ? String(record.time_out) 
                                : directDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                            rawTime: isNaN(directDate.getTime()) ? new Date() : directDate,
                            status: record.status
                        });
                    }
                });

                // Sort descending by rawTime
                activities.sort((a, b) => b.rawTime - a.rawTime);

                const result = { success: true, data: activities };
                attendanceCacheData.recentActivity[todayStr] = result;
                return result;
            } catch (error) {
                cache.recentActivity.delete(todayStr);
                return { success: false, data: [] };
            }
        })();

        cache.recentActivity.set(todayStr, promise);
        return promise;
    },
    clearShiftPolicyCache,
    // Get My Shift Policy
    async getMyShiftPolicy(force = false) {
        if (!force && cache.shiftPolicy && !(cache.shiftPolicy instanceof Promise)) {
            return cache.shiftPolicy;
        }

        if (force) {
            cache.shiftPolicy = null;
            attendanceCacheData.shiftPolicy = null;
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/my-shift`);
                const responseData = res.data;
                attendanceCacheData.shiftPolicy = responseData;
                return responseData;
            } catch (error) {
                cache.shiftPolicy = null;
                attendanceCacheData.shiftPolicy = null;
                console.error("Failed to fetch shift policy", error);
                return { ok: false, shift: null };
            }
        })();

        cache.shiftPolicy = promise;
        return promise;
    },
// Get Daily Summary (User range)
    async getDailySummary(dateFrom, dateTo) {
        const cacheKey = `${dateFrom || ''}_${dateTo || ''}`;
        if (cache.dailySummary.has(cacheKey)) {
            return cache.dailySummary.get(cacheKey);
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/daily-summary?date_from=${dateFrom}&date_to=${dateTo}`);
                attendanceCacheData.dailySummary[cacheKey] = res.data;
                return res.data;
            } catch (error) {
                cache.dailySummary.delete(cacheKey);
                console.error("Failed to fetch daily summary", error);
                throw new Error(error.response?.data?.message || "Failed to fetch daily summary");
            }
        })();

        cache.dailySummary.set(cacheKey, promise);
        return promise;
    },
    // Get Daily Summary (Admin single date)
    async getDailySummaryAdmin(date, forceRefresh = false) {
        const cacheKey = date || getLocalDateString();
        
        const now = Date.now();
        const cachedTime = cacheTimestamps.dailySummaryAdmin.get(cacheKey);
        if (!forceRefresh && cache.dailySummaryAdmin.has(cacheKey)) {
            if (cachedTime && (now - cachedTime < 30 * 1000)) {
                return cache.dailySummaryAdmin.get(cacheKey);
            }
        }

        cache.dailySummaryAdmin.delete(cacheKey);
        delete attendanceCacheData.dailySummaryAdmin[cacheKey];
        cacheTimestamps.dailySummaryAdmin.delete(cacheKey);

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/daily-summary/admin?date=${cacheKey}&_t=${Date.now()}`);
                attendanceCacheData.dailySummaryAdmin[cacheKey] = res.data;
                cacheTimestamps.dailySummaryAdmin.set(cacheKey, Date.now());
                return res.data;
            } catch (error) {
                cache.dailySummaryAdmin.delete(cacheKey);
                delete attendanceCacheData.dailySummaryAdmin[cacheKey];
                cacheTimestamps.dailySummaryAdmin.delete(cacheKey);
                console.error("Failed to fetch admin daily summary", error);
                throw new Error(error.response?.data?.message || "Failed to fetch live daily summary");
            }
        })();

        cache.dailySummaryAdmin.set(cacheKey, promise);
        return promise;
    },
    // Get self-service report preview
    async getMyReportPreview(month, type, date = "", startDate = "", endDate = "", columns = "") {
        try {
            const res = await api.get(`${API_BASE_URL}/reports/preview?month=${month}&type=${type}&date=${date}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${columns ? `&columns=${encodeURIComponent(columns)}` : ""}&_t=${Date.now()}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch report preview");
        }
    },
    // Queue self-service report download
    async queueMyReport(month, type, format = "xlsx", date = "", startDate = "", endDate = "", columns = "") {
        try {
            const url = `${API_BASE_URL}/reports/download?month=${month}&type=${type}&format=${format}${date ? `&date=${date}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${columns ? `&columns=${encodeURIComponent(columns)}` : ""}&_t=${Date.now()}`;
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to queue report");
        }
    }
};

export { correctionsService };
export default attendanceService;

