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
    async getAdminLeaves(params = {}) {
        try {
            const res = await api.get(`${API_BASE_URL}/admin/history`, { params });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch admin leave history");
        }
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
    },

    /* ==============================================
       Leave Policies & Rules
       ============================================== */
    async getLeavePolicies() {
        try {
            const res = await api.get(`${API_BASE_URL}/policies`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch leave policies");
        }
    },

    async createLeavePolicy(data) {
        try {
            const res = await api.post(`${API_BASE_URL}/policies`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create leave policy");
        }
    },

    async getLeavePolicyById(lp_id) {
        try {
            const res = await api.get(`${API_BASE_URL}/policies/${lp_id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch leave policy");
        }
    },

    async updateLeavePolicy(lp_id, data) {
        try {
            const res = await api.put(`${API_BASE_URL}/policies/${lp_id}`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update leave policy");
        }
    },

    async deleteLeavePolicy(lp_id) {
        try {
            const res = await api.delete(`${API_BASE_URL}/policies/${lp_id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete leave policy");
        }
    },

    async createLeavePolicyRule(lp_id, data) {
        try {
            const res = await api.post(`${API_BASE_URL}/policies/${lp_id}/rules`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create policy rule");
        }
    },

    async updateLeavePolicyRule(lp_id, rule_id, data) {
        try {
            const res = await api.put(`${API_BASE_URL}/policies/${lp_id}/rules/${rule_id}`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update policy rule");
        }
    },

    async deleteLeavePolicyRule(lp_id, rule_id) {
        try {
            const res = await api.delete(`${API_BASE_URL}/policies/${lp_id}/rules/${rule_id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete policy rule");
        }
    },

    /* ==============================================
       Leave Balances
       ============================================== */
    async getMyLeaveBalances(year) {
        try {
            const params = year ? { year } : {};
            const res = await api.get(`${API_BASE_URL}/balances`, { params });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch your leave balance");
        }
    },

    async getAllEmployeesLeaveBalances(year, rule_id) {
        try {
            const params = {};
            if (year) params.year = year;
            if (rule_id) params.rule_id = rule_id;
            const res = await api.get(`${API_BASE_URL}/balances/all`, { params });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch employees' leave balances");
        }
    },

    async getEmployeeLeaveBalance(user_id, year) {
        try {
            const params = year ? { year } : {};
            const res = await api.get(`${API_BASE_URL}/balances/${user_id}`, { params });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch employee's leave balance");
        }
    },

    async setLeaveBalance(data) {
        try {
            const res = await api.post(`${API_BASE_URL}/balances`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to set leave balance");
        }
    },

    async updateLeaveBalance(lb_id, data) {
        try {
            const res = await api.put(`${API_BASE_URL}/balances/${lb_id}`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update leave balance");
        }
    },

    async deleteLeaveBalance(lb_id) {
        try {
            const res = await api.delete(`${API_BASE_URL}/balances/${lb_id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete leave balance record");
        }
    },

    async assignPolicyToEmployees(lp_id, data) {
        try {
            const res = await api.post(`${API_BASE_URL}/policies/${lp_id}/assign`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to assign policy to employees");
        }
    }
};
export default leaveService;
