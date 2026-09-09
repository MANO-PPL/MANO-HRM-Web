import api from './api';
import { clearShiftPolicyCache } from './attendanceService';

const ADMIN_API_URL = "/admin";
const POLICY_API_URL = "/policies";

const notifyShiftPolicyUpdated = () => {
    try {
        clearShiftPolicyCache();
    } catch (e) {
        console.warn("Failed to clear shift policy cache:", e);
    }
    try {
        window.dispatchEvent(new CustomEvent('shift_policy_updated'));
    } catch (e) {}
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('mano_shifts_channel');
            bc.postMessage({ type: 'shift_policy_updated', timestamp: Date.now() });
            bc.close();
        } catch (e) {}
    }
};

// Client-side memory cache for lookup configurations
const cache = {
    departments: null,
    designations: null,
    shifts: null,
    shiftUsers: null,
    workLocations: null,
    users: new Map(),
    dashboardStats: new Map()
};

// Synchronous client-side cache for direct component consumption
export const adminCacheData = {
    departments: null,
    designations: null,
    shifts: null,
    shiftUsers: null,
    workLocations: null,
    users: {},
    dashboardStats: {}
};

const clearUserCache = () => {
    cache.users.clear();
    adminCacheData.users = {};
};

const clearCache = () => {
    cache.departments = null;
    cache.designations = null;
    cache.shifts = null;
    cache.shiftUsers = null;
    cache.workLocations = null;
    cache.dashboardStats.clear();
    clearUserCache();

    adminCacheData.departments = null;
    adminCacheData.designations = null;
    adminCacheData.shifts = null;
    adminCacheData.shiftUsers = null;
    adminCacheData.workLocations = null;
    adminCacheData.dashboardStats = {};
};

export const adminService = {
    // Get all users
    async getAllUsers(options = false) {
        const isLegacyBool = typeof options === 'boolean';
        const includeWorkLocation = isLegacyBool ? options : !!options?.includeWorkLocation;
        const { startDate, endDate, month, date, dept_id, desg_id, shift_id } = (!isLegacyBool && typeof options === 'object' && options !== null) ? options : {};

        const hasFilters = !!(startDate || endDate || month || date || dept_id || desg_id || shift_id);
        const cacheKey = hasFilters
            ? `filtered_${includeWorkLocation}_${startDate || ''}_${endDate || ''}_${month || ''}_${date || ''}_${dept_id || ''}_${desg_id || ''}_${shift_id || ''}`
            : String(includeWorkLocation);

        if (cache.users.has(cacheKey)) {
            return cache.users.get(cacheKey);
        }

        const promise = (async () => {
            try {
                const params = new URLSearchParams();
                if (includeWorkLocation) params.append('workLocation', 'true');
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);
                if (month) params.append('month', month);
                if (date) params.append('date', date);
                if (dept_id) params.append('dept_id', dept_id);
                if (desg_id) params.append('desg_id', desg_id);
                if (shift_id) params.append('shift_id', shift_id);

                const queryString = params.toString() ? `?${params.toString()}` : '';
                const res = await api.get(`${ADMIN_API_URL}/users${queryString}`);
                adminCacheData.users[cacheKey] = res.data;
                return res.data;
            } catch (error) {
                cache.users.delete(cacheKey);
                throw new Error(error.response?.data?.message || "Failed to fetch users");
            }
        })();

        cache.users.set(cacheKey, promise);
        return promise;
    },

    // Get single user
    async getUserById(userId) {
        try {
            const res = await api.get(`${ADMIN_API_URL}/user/${userId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch user");
        }
    },

    // Create user
    async createUser(userData, profileImageFile = null) {
        try {
            let res;
            if (profileImageFile) {
                const formData = new FormData();
                Object.entries(userData).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '') {
                        formData.append(key, value);
                    }
                });
                formData.append('profile_image', profileImageFile);
                res = await api.post(`${ADMIN_API_URL}/user`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.post(`${ADMIN_API_URL}/user`, userData);
            }
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create user");
        }
    },

    // Update user
    async updateUser(userId, userData, profileImageFile = null) {
        try {
            let res;
            if (profileImageFile) {
                const formData = new FormData();
                Object.entries(userData).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '') {
                        formData.append(key, value);
                    }
                });
                formData.append('profile_image', profileImageFile);
                res = await api.put(`${ADMIN_API_URL}/user/${userId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.put(`${ADMIN_API_URL}/user/${userId}`, userData);
            }
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update user");
        }
    },

    // Update user avatar
    async updateUserAvatar(userId, formData) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/user/${userId}/avatar`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update avatar");
        }
    },

    // Delete user
    async deleteUser(userId) {
        try {
            const res = await api.delete(`${ADMIN_API_URL}/user/${userId}`);
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete user");
        }
    },

    // Toggle Status
    async toggleUserStatus(userId, isActive) {
        try {
            const res = await api.put(`${ADMIN_API_URL}/user/${userId}/status`, { is_active: isActive });
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update status");
        }
    },

    // Restore User
    async restoreUser(userId) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/user/${userId}/restore`);
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to restore user");
        }
    },

    // Force Delete User
    async forceDeleteUser(userId) {
        try {
            const res = await api.delete(`${ADMIN_API_URL}/user/${userId}/force`);
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to permanently delete user");
        }
    },

    // Helpers
    async getDepartments() {
        if (cache.departments) return cache.departments;
        const promise = (async () => {
            try {
                const res = await api.get(`${ADMIN_API_URL}/departments`);
                adminCacheData.departments = res.data;
                return res.data;
            } catch (error) {
                cache.departments = null;
                throw error;
            }
        })();
        cache.departments = promise;
        return promise;
    },
    async bulkCreateUsersJson(usersData) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/users/bulk-json`, { users: usersData });
            clearUserCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to bulk create users");
        }
    },

    async bulkValidateUsers(usersData) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/users/bulk-validate`, { users: usersData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to validate users");
        }
    },

    async createDepartment(dept_name) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/departments`, { dept_name });
            cache.departments = null;
            adminCacheData.departments = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create department");
        }
    },

    async updateDepartment(dept_id, dept_name) {
        try {
            const res = await api.put(`${ADMIN_API_URL}/departments/${dept_id}`, { dept_name });
            cache.departments = null;
            adminCacheData.departments = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update department");
        }
    },

    async deleteDepartment(dept_id) {
        try {
            const res = await api.delete(`${ADMIN_API_URL}/departments/${dept_id}`);
            cache.departments = null;
            adminCacheData.departments = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete department");
        }
    },

    async createDesignation(desg_name) {
        try {
            const res = await api.post(`${ADMIN_API_URL}/designations`, { desg_name });
            cache.designations = null;
            adminCacheData.designations = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create designation");
        }
    },

    async updateDesignation(desg_id, desg_name) {
        try {
            const res = await api.put(`${ADMIN_API_URL}/designations/${desg_id}`, { desg_name });
            cache.designations = null;
            adminCacheData.designations = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update designation");
        }
    },

    async deleteDesignation(desg_id) {
        try {
            const res = await api.delete(`${ADMIN_API_URL}/designations/${desg_id}`);
            cache.designations = null;
            adminCacheData.designations = null;
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete designation");
        }
    },

    async getDesignations() {
        if (cache.designations) return cache.designations;
        const promise = (async () => {
            try {
                const res = await api.get(`${ADMIN_API_URL}/designations`);
                adminCacheData.designations = res.data;
                return res.data;
            } catch (error) {
                cache.designations = null;
                throw error;
            }
        })();
        cache.designations = promise;
        return promise;
    },
    async getShifts() {
        if (cache.shifts) return cache.shifts;
        const promise = (async () => {
            try {
                const res = await api.get(`${ADMIN_API_URL}/shifts`);
                adminCacheData.shifts = res.data;
                return res.data;
            } catch (error) {
                cache.shifts = null;
                throw error;
            }
        })();
        cache.shifts = promise;
        return promise;
    },
    async createShift(shiftData) {
        try {
            // Note: Original code used POLICY_API_URL for create/update/delete shift
            const res = await api.post(`${POLICY_API_URL}/shifts`, shiftData);
            cache.shifts = null;
            adminCacheData.shifts = null;
            cache.shiftUsers = null;
            adminCacheData.shiftUsers = null;
            notifyShiftPolicyUpdated();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create shift");
        }
    },
    async updateShift(shiftId, shiftData) {
        try {
            const res = await api.put(`${POLICY_API_URL}/shifts/${shiftId}`, shiftData);
            cache.shifts = null;
            adminCacheData.shifts = null;
            cache.shiftUsers = null;
            adminCacheData.shiftUsers = null;
            notifyShiftPolicyUpdated();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update shift");
        }
    },
    async deleteShift(shiftId) {
        try {
            const res = await api.delete(`${POLICY_API_URL}/shifts/${shiftId}`);
            cache.shifts = null;
            adminCacheData.shifts = null;
            cache.shiftUsers = null;
            adminCacheData.shiftUsers = null;
            notifyShiftPolicyUpdated();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete shift");
        }
    },
    async getShiftUsers() {
        if (cache.shiftUsers) return cache.shiftUsers;
        const promise = (async () => {
            try {
                const res = await api.get(`${POLICY_API_URL}/shift-users`);
                adminCacheData.shiftUsers = res.data;
                return res.data;
            } catch (error) {
                cache.shiftUsers = null;
                throw new Error(error.response?.data?.message || "Failed to fetch shift users");
            }
        })();
        cache.shiftUsers = promise;
        return promise;
    },
    async assignUserShift(userId, shiftId) {
        try {
            const res = await api.put(`${POLICY_API_URL}/users/${userId}/shift`, { shift_id: shiftId });
            clearUserCache();
            cache.shiftUsers = null;
            adminCacheData.shiftUsers = null;
            notifyShiftPolicyUpdated();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to assign shift");
        }
    },
    async getWorkLocations() {
        if (cache.workLocations) return cache.workLocations;
        const promise = (async () => {
            try {
                const res = await api.get(`/locations`); // Route in original was /api/locations, so since baseURL is /api, we use /locations
                adminCacheData.workLocations = res.data;
                return res.data;
            } catch (error) {
                cache.workLocations = null;
                throw error;
            }
        })();
        cache.workLocations = promise;
        return promise;
    },
    async getReportPreview(month, type, date = "", userId = "", startDate = "", endDate = "", columns = "", deptId = "", desgId = "", shiftId = "") {
        try {
            const res = await api.get(`${ADMIN_API_URL}/reports/preview?month=${month}&type=${type}&date=${date}${userId ? `&user_id=${userId}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${columns ? `&columns=${encodeURIComponent(columns)}` : ""}${deptId ? `&dept_id=${deptId}` : ""}${desgId ? `&desg_id=${desgId}` : ""}${shiftId ? `&shift_id=${shiftId}` : ""}&_t=${Date.now()}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch report preview");
        }
    },

    async downloadReport(month, type, format = "xlsx", userId = "", date = "", startDate = "", endDate = "", deptId = "", desgId = "", shiftId = "") {
        try {
            const url = `${ADMIN_API_URL}/reports/download?month=${month}&type=${type}&format=${format}${userId ? `&user_id=${userId}` : ""}${date ? `&date=${date}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${deptId ? `&dept_id=${deptId}` : ""}${desgId ? `&desg_id=${desgId}` : ""}${shiftId ? `&shift_id=${shiftId}` : ""}&_t=${Date.now()}`;
            const response = await api.get(url, { responseType: 'blob' });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to download report");
        }
    },

    async queueReport(month, type, format = "xlsx", userId = "", date = "", startDate = "", endDate = "", columns = "", deptId = "", desgId = "", shiftId = "") {
        try {
            const url = `${ADMIN_API_URL}/reports/download?month=${month}&type=${type}&format=${format}${userId ? `&user_id=${userId}` : ""}${date ? `&date=${date}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${columns ? `&columns=${encodeURIComponent(columns)}` : ""}${deptId ? `&dept_id=${deptId}` : ""}${desgId ? `&desg_id=${desgId}` : ""}${shiftId ? `&shift_id=${shiftId}` : ""}&_t=${Date.now()}`;
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to queue report");
        }
    },

    async getReportStatus(reportId) {
        try {
            const response = await api.get(`${ADMIN_API_URL}/reports/status/${reportId}`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch report status");
        }
    },

    async getDashboardStats(range = 'weekly', month = null, year = null, forceRefresh = false) {
        const cacheKey = `${range}_${month || 'null'}_${year || 'null'}`;
        if (!forceRefresh && cache.dashboardStats.has(cacheKey)) {
            return cache.dashboardStats.get(cacheKey);
        }

        const promise = (async () => {
            try {
                let url = `${ADMIN_API_URL}/dashboard-stats?range=${range}`;
                if (month && year) {
                    url += `&month=${month}&year=${year}`;
                }
                const res = await api.get(url);
                adminCacheData.dashboardStats[cacheKey] = res.data;
                return res.data;
            } catch (error) {
                cache.dashboardStats.delete(cacheKey);
                throw new Error(error.response?.data?.message || "Failed to fetch dashboard stats");
            }
        })();

        cache.dashboardStats.set(cacheKey, promise);
        return promise;
    }
};
