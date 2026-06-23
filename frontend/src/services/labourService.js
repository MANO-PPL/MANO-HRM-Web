import api from './api';

export const labourService = {
    // ==========================================
    // 1. SITE SERVICES
    // ==========================================
    async getAllSites() {
        try {
            const res = await api.get('/labour/sites');
            return res.data.sites || [];
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch sites');
        }
    },

    async createSite(siteData) {
        try {
            const res = await api.post('/labour/sites', siteData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to create site');
        }
    },

    async updateSite(id, siteData) {
        try {
            const res = await api.put(`/labour/sites/${id}`, siteData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to update site');
        }
    },

    async deleteSite(id) {
        try {
            const res = await api.delete(`/labour/sites/${id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to delete site');
        }
    },

    // ==========================================
    // 2. LABOUR SERVICES
    // ==========================================
    async getAllLabours() {
        try {
            const res = await api.get('/labour/labours');
            return res.data.labours || [];
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch labours');
        }
    },

    async createLabour(labourData) {
        try {
            const res = await api.post('/labour/labours', labourData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to create labour');
        }
    },

    async updateLabour(id, labourData) {
        try {
            const res = await api.put(`/labour/labours/${id}`, labourData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to update labour');
        }
    },

    async deleteLabour(id) {
        try {
            const res = await api.delete(`/labour/labours/${id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to delete labour');
        }
    },

    async bulkCreateLabours(labours) {
        try {
            const res = await api.post('/labour/labours/bulk', { labours });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to bulk create labours');
        }
    },

    // ==========================================
    // 3. ATTENDANCE SERVICES
    // ==========================================
    async getSiteAttendance(siteId, date) {
        try {
            const res = await api.get(`/labour/attendance?site_id=${siteId}&date=${date}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch site attendance');
        }
    },

    async saveSiteAttendance(siteId, date, roster) {
        try {
            const res = await api.post('/labour/attendance', { site_id: siteId, date, roster });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to save site attendance');
        }
    },

    async getMonthlyGridAttendance(siteId, month, showAllSites = false) {
        try {
            const res = await api.get(`/labour/attendance/monthly-summary?site_id=${siteId}&month=${month}&show_all_sites=${showAllSites}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch monthly attendance summary');
        }
    },

    async bulkTransferLabours(transferData) {
        try {
            const res = await api.post('/labour/labours/bulk-transfer', transferData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to bulk transfer workers');
        }
    },

    async getLabourWorkHistory(labourId) {
        try {
            const res = await api.get(`/labour/labours/${labourId}/history`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch worker history');
        }
    },

    // ==========================================
    // 4. FINANCIAL SERVICES
    // ==========================================
    async getFinancesSummary(date = '') {
        try {
            const res = await api.get(`/labour/finances/summary${date ? `?date=${date}` : ''}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch finances summary');
        }
    },

    async logLabourAdvance(advanceData) {
        try {
            const res = await api.post('/labour/finances/advance', advanceData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to log labour advance');
        }
    },

    async logLabourPayout(payoutData) {
        try {
            const res = await api.post('/labour/finances/payout', payoutData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to log labour payout');
        }
    }
};
