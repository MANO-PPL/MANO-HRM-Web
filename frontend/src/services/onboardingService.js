import api from './api';

export const onboardingService = {
    // Checklist Templates
    async getChecklistTemplates() {
        const res = await api.get('/admin/checklist-templates');
        return res.data;
    },
    async createChecklistTemplate(data) {
        const res = await api.post('/admin/checklist-templates', data);
        return res.data;
    },
    async updateChecklistTemplate(id, data) {
        const res = await api.put(`/admin/checklist-templates/${id}`, data);
        return res.data;
    },
    async deleteChecklistTemplate(id) {
        const res = await api.delete(`/admin/checklist-templates/${id}`);
        return res.data;
    },

    // Document Templates
    async getDocumentTemplates() {
        const res = await api.get('/admin/document-templates');
        return res.data;
    },
    async createDocumentTemplate(data) {
        const res = await api.post('/admin/document-templates', data);
        return res.data;
    },
    async updateDocumentTemplate(id, data) {
        const res = await api.put(`/admin/document-templates/${id}`, data);
        return res.data;
    },
    async deleteDocumentTemplate(id) {
        const res = await api.delete(`/admin/document-templates/${id}`);
        return res.data;
    },

    // Performance Cycles
    async getPerformanceCycles() {
        const res = await api.get('/admin/performance-cycles');
        return res.data;
    },
    async createPerformanceCycle(data) {
        const res = await api.post('/admin/performance-cycles', data);
        return res.data;
    },
    async updatePerformanceCycle(id, data) {
        const res = await api.put(`/admin/performance-cycles/${id}`, data);
        return res.data;
    },
    async deletePerformanceCycle(id) {
        const res = await api.delete(`/admin/performance-cycles/${id}`);
        return res.data;
    },

    // Employee specific onboarding operations
    async getEmployeeOnboardingProgress(employeeId) {
        const res = await api.get(`/employee/onboarding/${employeeId}/progress`);
        return res.data;
    },
    async toggleChecklistItem(employeeId, taskKey, isCompleted) {
        const res = await api.post('/employee/onboarding/checklist/toggle', {
            employee_id: employeeId,
            task_key: taskKey,
            is_completed: isCompleted
        });
        return res.data;
    },
    async assignTemplates(employeeId, checklistTemplateId, documentTemplateId) {
        const res = await api.post('/employee/onboarding/assign-templates', {
            employee_id: employeeId,
            checklist_template_id: checklistTemplateId,
            document_template_id: documentTemplateId
        });
        return res.data;
    },
    async uploadDocument(formData) {
        const res = await api.post('/employee/onboarding/upload-document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },
    async verifyDocument(docId, status, comments) {
        const res = await api.put(`/employee/onboarding/document/${docId}/verify`, {
            status,
            comments
        });
        return res.data;
    },
    async getDocumentUrl(docId) {
        const res = await api.get(`/employee/onboarding/document-url/${docId}`);
        return res.data;
    },
    async getDocumentContent(docId) {
        const res = await api.get(`/employee/onboarding/document-content/${docId}`, {
            responseType: 'blob'
        });
        return res.data;
    },
    async deleteDocument(docId) {
        const res = await api.delete(`/employee/onboarding/document/${docId}`);
        return res.data;
    }
};
