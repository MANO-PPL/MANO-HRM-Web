import api from './api';

const API_BASE_URL = "/corrections";

// Client-side memory cache for corrections data
const cache = {
    correctionRequests: new Map(),
    correctionDetails: new Map()
};

// Synchronous client-side cache for direct component consumption
export const correctionsCacheData = {
    correctionRequests: {},
    correctionDetails: {}
};

// Clear the corrections cache when data changes
export const clearCorrectionsCache = () => {
    cache.correctionRequests.clear();
    cache.correctionDetails.clear();
    correctionsCacheData.correctionRequests = {};
    correctionsCacheData.correctionDetails = {};
};

export const correctionsService = {
    // Synchronous access to cached data
    cacheData: correctionsCacheData,

    // Clear cache helper
    clearCache: clearCorrectionsCache,

    /**
     * Submit or update a correction request (supports FormData for file attachments)
     */
    async submitCorrectionRequest(data) {
        try {
            let res;
            if (data instanceof FormData) {
                res = await api.post(`${API_BASE_URL}/request`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await api.post(`${API_BASE_URL}/request`, data);
            }
            clearCorrectionsCache();
            return res.data;
        } catch (error) {
            const err = new Error(error.response?.data?.error || error.response?.data?.message || "Failed to submit correction request");
            err.status = error.response?.status;
            err.code = error.response?.data?.code;
            throw err;
        }
    },

    /**
     * Get list of correction requests (Admin sees all, User sees own)
     */
    async getCorrectionRequests(params = {}) {
        const cacheKey = JSON.stringify(params);
        if (cache.correctionRequests.has(cacheKey)) {
            return cache.correctionRequests.get(cacheKey);
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/requests`, { params });
                correctionsCacheData.correctionRequests[cacheKey] = res.data;
                return res.data;
            } catch (error) {
                cache.correctionRequests.delete(cacheKey);
                throw new Error(error.response?.data?.message || error.response?.data?.error || "Failed to fetch correction requests");
            }
        })();

        cache.correctionRequests.set(cacheKey, promise);
        return promise;
    },

    /**
     * Get specific correction request details
     */
    async getCorrectionDetails(acr_id) {
        if (!acr_id) return null;
        if (cache.correctionDetails.has(acr_id)) {
            return cache.correctionDetails.get(acr_id);
        }

        const promise = (async () => {
            try {
                const res = await api.get(`${API_BASE_URL}/request/${acr_id}`);
                correctionsCacheData.correctionDetails[acr_id] = res.data;
                return res.data;
            } catch (error) {
                cache.correctionDetails.delete(acr_id);
                throw new Error(error.response?.data?.message || error.response?.data?.error || "Failed to fetch correction details");
            }
        })();

        cache.correctionDetails.set(acr_id, promise);
        return promise;
    },

    /**
     * Update correction status (Admin/HR approval or rejection)
     */
    async updateCorrectionStatus(acr_id, status, review_comments, overrides = {}) {
        try {
            const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;
            const res = await api.patch(`${API_BASE_URL}/request/${acr_id}`, {
                status: normalizedStatus,
                review_comments,
                ...overrides
            });
            clearCorrectionsCache();
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || error.response?.data?.error || "Failed to update correction status");
        }
    }
};

export default correctionsService;
