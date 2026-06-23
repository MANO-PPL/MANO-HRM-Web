import api from './api';

const API_BASE_URL = "/leaves";

// Client-side memory cache for leave requests data
const cache = {
    myHistory: null,
    adminHistory: null
};

// Synchronous client-side cache for direct component consumption
export const leaveCacheData = {
    myHistory: null,
    adminHistory: null
};

export const clearCache = () => {
    cache.myHistory = null;
    cache.adminHistory = null;
    leaveCacheData.myHistory = null;
    leaveCacheData.adminHistory = null;
};

export const leaveService = {
    // Get leave history for the current employee
    async getMyLeaves() {
        if (cache.myHistory) {
            return cache.myHistory;
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/my-history`);
                leaveCacheData.myHistory = res.data;
                return res.data;
            } catch (error) {
                cache.myHistory = null;
                throw new Error(error.response?.data?.message || "Failed to fetch your leave history");
            }
        })();

        cache.myHistory = promise;
        return promise;
    },

    // Get all leave history (Admin/HR)
    async getAdminLeaves() {
        if (cache.adminHistory) {
            return cache.adminHistory;
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/admin/history`);
                leaveCacheData.adminHistory = res.data;
                return res.data;
            } catch (error) {
                cache.adminHistory = null;
                throw new Error(error.response?.data?.message || "Failed to fetch admin leave history");
            }
        })();

        cache.adminHistory = promise;
        return promise;
    },

    // Apply for leave (FormData / attachments)
    async applyForLeave(formData) {
        try {
            const res = await api.post(`${API_BASE_URL}/request`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to apply for leave");
        }
    },

    // Withdraw a leave request (User)
    async withdrawLeave(leaveId) {
        try {
            const res = await api.delete(`${API_BASE_URL}/request/${leaveId}`);
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to withdraw leave request");
        }
    },

    // Update leave status (Admin/HR)
    async updateLeaveStatus(lr_id, payload) {
        try {
            const res = await api.put(`${API_BASE_URL}/admin/status/${lr_id}`, payload);
            clearCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update leave status");
        }
    }
};
