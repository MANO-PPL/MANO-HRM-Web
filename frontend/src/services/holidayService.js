import api from './api';

const API_BASE_URL = "/holiday";

// Client-side memory cache for holiday data
const cache = {
    holidays: null
};

// Synchronous client-side cache for direct component consumption
export const holidayCacheData = {
    holidays: null
};

const clearCache = () => {
    cache.holidays = null;
    holidayCacheData.holidays = null;
};

export const holidayService = {
    // Get all holidays
    async getHolidays() {
        if (cache.holidays) {
            return cache.holidays;
        }

        const promise = (async () => {
            try {
                const res = await api.get(API_BASE_URL);
                holidayCacheData.holidays = res.data;
                return res.data;
            } catch (error) {
                cache.holidays = null;
                throw new Error(error.response?.data?.message || "Failed to fetch holidays");
            }
        })();

        cache.holidays = promise;
        return promise;
    },

    // Add a new holiday
    async addHoliday(holidayData) {
        try {
            const res = await api.post(API_BASE_URL, holidayData);
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to add holiday");
        }
    },

    // Update a holiday
    async updateHoliday(id, holidayData) {
        try {
            const res = await api.put(`${API_BASE_URL}/${id}`, holidayData);
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update holiday");
        }
    },

    // Delete holidays (Supports bulk delete as per backend API)
    async deleteHolidays(ids) {
        try {
            const res = await api.delete(API_BASE_URL, { data: { ids } });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete holiday(s)");
        }
    },

    // Bulk validate holidays from parsed data
    async bulkValidateHolidays(holidaysData) {
        try {
            const res = await api.post(`${API_BASE_URL}/bulk-validate`, { holidays: holidaysData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to validate holidays");
        }
    },

    // Bulk create holidays from JSON (after preview)
    async bulkCreateHolidaysJson(holidaysData) {
        try {
            const res = await api.post(`${API_BASE_URL}/bulk-json`, { holidays: holidaysData });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create holidays");
        }
    },

    // Upload holidays from CSV/Excel file
    async bulkUploadHolidaysFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`${API_BASE_URL}/bulk`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to upload holidays file");
        }
    }
};

export const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    const cleanStr = dateStr.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
};
