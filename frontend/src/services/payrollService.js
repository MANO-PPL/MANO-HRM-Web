import api from './api';

const payrollService = {
    // Get active salary for employee
    getEmployeeSalary: async (employeeId) => {
        const response = await api.get(`/payroll/employees/${employeeId}/salary`);
        return response.data;
    },

    // Update/Revision salary for employee
    updateEmployeeSalary: async (employeeId, data) => {
        const response = await api.post(`/payroll/employees/${employeeId}/salary`, data);
        return response.data;
    },

    // Get salary history for employee
    getEmployeeSalaryHistory: async (employeeId) => {
        const response = await api.get(`/payroll/employees/${employeeId}/salary/history`);
        return response.data;
    },

    // Get payroll dashboard (realtime projected or finalized entries)
    getPayrollDashboard: async (month) => {
        const response = await api.get('/payroll/dashboard', { params: { month } });
        return response.data;
    },

    // Get single employee detailed projection / snapshot
    getEmployeeProjectedDetails: async (employeeId, month) => {
        const response = await api.get(`/payroll/dashboard/${employeeId}`, { params: { month } });
        return response.data;
    },

    // Finalize payroll for month (creates a payroll run and freezes values)
    finalizePayroll: async (month) => {
        const response = await api.post('/payroll/finalize', { month });
        return response.data;
    },

    // Get all historical payroll runs
    getPayrollRuns: async () => {
        const response = await api.get('/payroll/runs');
        return response.data;
    },

    // Get run entries details
    getPayrollRunDetails: async (runId) => {
        const response = await api.get(`/payroll/runs/${runId}`);
        return response.data;
    },

    // Record run as paid
    markRunAsPaid: async (runId) => {
        const response = await api.post(`/payroll/runs/${runId}/mark-paid`);
        return response.data;
    },

    // Download payslip utility
    downloadPayslip: async (entryId, employeeName, monthName, year) => {
        const response = await api.get(`/payroll/entries/${entryId}/payslip`, {
            responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Payslip_${employeeName.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    // Finalize payroll for a single employee
    finalizeEmployee: async (employeeId, month) => {
        const response = await api.post(`/payroll/employees/${employeeId}/finalize`, { month });
        return response.data;
    },

    // Pay payroll for a single employee
    payEmployee: async (employeeId, month) => {
        const response = await api.post(`/payroll/employees/${employeeId}/pay`, { month });
        return response.data;
    },

    // Update adjustments list for a payroll entry
    updateAdjustments: async (entryId, adjustments) => {
        const response = await api.put(`/payroll/entries/${entryId}/adjustments`, { adjustments });
        return response.data;
    },

    // Package APIs
    getPackageGroups: async () => {
        const response = await api.get('/payroll/packages');
        return response.data;
    },

    createPackageGroup: async (data) => {
        const response = await api.post('/payroll/packages', data);
        return response.data;
    },

    getPackageRevisions: async (packageGroupId) => {
        const response = await api.get(`/payroll/packages/${packageGroupId}/revisions`);
        return response.data;
    },

    createPackageRevision: async (packageGroupId, data) => {
        const response = await api.post(`/payroll/packages/${packageGroupId}/revisions`, data);
        return response.data;
    },

    updatePackageGroup: async (packageGroupId, data) => {
        const response = await api.put(`/payroll/packages/${packageGroupId}`, data);
        return response.data;
    },

    deletePackageGroup: async (packageGroupId) => {
        const response = await api.delete(`/payroll/packages/${packageGroupId}`);
        return response.data;
    },

    // Package Assignment APIs
    getEmployeesWithPackages: async () => {
        const response = await api.get('/payroll/employees/packages');
        return response.data;
    },

    assignPackageToEmployee: async (employeeId, packageGroupId, effectiveFrom) => {
        const response = await api.post(`/payroll/employees/${employeeId}/assign-package`, { packageGroupId, effectiveFrom });
        return response.data;
    },

    unassignPackageFromEmployee: async (employeeId, data) => {
        const response = await api.post(`/payroll/employees/${employeeId}/unassign-package`, data);
        return response.data;
    },

    // Payroll Settings APIs
    getPayrollSettings: async () => {
        const response = await api.get('/payroll/settings');
        return response.data;
    },

    updatePayrollSettings: async (data) => {
        const response = await api.put('/payroll/settings', data);
        return response.data;
    }
};

export default payrollService;
