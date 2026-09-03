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

    async downloadBulkTemplate() {
        try {
            const res = await api.get('/labour/labours/bulk/template', { responseType: 'blob' });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to download template');
        }
    },

    async parseBulkLabours(formData) {
        try {
            const res = await api.post('/labour/labours/bulk/parse', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data.parsed || [];
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to parse template');
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

    async getLabourSchedule(labourId, date) {
        try {
            const res = await api.get(`/labour/schedule?labour_id=${labourId}&date=${date}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch labour schedule');
        }
    },

    async saveLabourSchedule(scheduleData) {
        try {
            const res = await api.post('/labour/schedule', scheduleData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to save labour schedule');
        }
    },

    // ==========================================
    // 4. FINANCIAL SERVICES
    // ==========================================
    async getFinancesSummary(siteId, month = null) {
        try {
            let url = `/labour/finances/summary?site_id=${siteId}`;
            if (month) url += `&month=${month}`;
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch finances summary');
        }
    },

    async getDetailedMonthlyLedger(siteId, month = null, tillDate = null) {
        try {
            let url = `/labour/finances/detailed-ledger?site_id=${siteId}`;
            if (month) url += `&month=${month}`;
            if (tillDate) url += `&till_date=${tillDate}`;
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch detailed monthly ledger');
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

    async getLabourAdvances(labourId, month = null, siteId = null) {
        try {
            let url = `/labour/finances/advances?labour_id=${labourId}`;
            if (month) url += `&month=${month}`;
            if (siteId && siteId !== 'All') url += `&site_id=${siteId}`;
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch labour advances');
        }
    },

    async deleteLabourAdvance(advanceId) {
        try {
            const res = await api.delete(`/labour/finances/advance/${advanceId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to delete labour advance');
        }
    },

    async logLabourPayout(payoutData) {
        try {
            const res = await api.post('/labour/finances/payout', payoutData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to log labour payout');
        }
    },

    // ==========================================
    // 5. WAGE HISTORY SERVICES
    // ==========================================
    async getLabourWageHistory(labourId) {
        try {
            const res = await api.get(`/labour/labours/${labourId}/wage-history`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to fetch wage history');
        }
    },

    async addLabourWageRevision(labourId, revisionData) {
        try {
            const res = await api.post(`/labour/labours/${labourId}/wage-history`, revisionData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to add wage revision');
        }
    },

    async updateLabourWageRevision(revisionId, revisionData) {
        try {
            const res = await api.put(`/labour/wage-history/${revisionId}`, revisionData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to update wage revision');
        }
    },

    async deleteLabourWageRevision(revisionId) {
        try {
            const res = await api.delete(`/labour/wage-history/${revisionId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Failed to delete wage revision');
        }
    }
};
