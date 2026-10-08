import api from './api';

const normalize = (data) => {
    if (data && typeof data === 'object') {
        if (data.ok && !data.status) data.status = 'success';
        if (data.status === 'success' && data.ok === undefined) data.ok = true;
    }
    return data;
};

const payrollService = {
    // ==========================================
    // 1. Settings & Setup
    // ==========================================

    // Check if payroll settings are configured for the organization
    getSetupStatus: async () => {
        const response = await api.get('/payroll/setup-status');
        return normalize(response.data);
    },

    // Get organization payroll settings
    getPayrollSettings: async () => {
        const response = await api.get('/payroll/settings');
        return normalize(response.data);
    },

    // Save/Update payroll settings
    updatePayrollSettings: async (settingsData) => {
        const response = await api.put('/payroll/settings', settingsData);
        return normalize(response.data);
    },

    // ==========================================
    // 2. Salary Packages & Components
    // ==========================================

    // List all salary packages
    getPackages: async () => {
        const response = await api.get('/payroll/packages');
        return normalize(response.data);
    },

    // Get single package details with components
    getPackageById: async (packageId) => {
        const response = await api.get(`/payroll/packages/${packageId}`);
        return normalize(response.data);
    },

    // Create a new salary package
    createPackage: async (packageData) => {
        const response = await api.post('/payroll/packages', packageData);
        return normalize(response.data);
    },

    // Update package info / rules
    updatePackage: async (packageId, packageData) => {
        const response = await api.put(`/payroll/packages/${packageId}`, packageData);
        return normalize(response.data);
    },

    // Delete (deactivate) a package
    deletePackage: async (packageId) => {
        const response = await api.delete(`/payroll/packages/${packageId}`);
        return normalize(response.data);
    },

    // Add component to package
    addPackageComponent: async (packageId, componentData) => {
        const response = await api.post(`/payroll/packages/${packageId}/components`, componentData);
        return normalize(response.data);
    },

    // Update component
    updatePackageComponent: async (packageId, componentId, componentData) => {
        const response = await api.put(`/payroll/packages/${packageId}/components/${componentId}`, componentData);
        return normalize(response.data);
    },

    // Delete component
    deletePackageComponent: async (packageId, componentId) => {
        const response = await api.delete(`/payroll/packages/${packageId}/components/${componentId}`);
        return normalize(response.data);
    },

    // ==========================================
    // 3. Employee Assignments
    // ==========================================

    // List all employee package assignments
    getAssignments: async () => {
        const response = await api.get('/payroll/assignments');
        return normalize(response.data);
    },

    // Get active package for a specific employee
    getEmployeePackage: async (employeeId) => {
        const response = await api.get(`/payroll/employees/${employeeId}/package`);
        return normalize(response.data);
    },

    getEmployeeSalary: async (employeeId) => {
        const response = await api.get(`/payroll/employees/${employeeId}/package`);
        return normalize(response.data);
    },

    // Assign salary package to employee
    assignPackageToEmployee: async (employeeId, packageId, effectiveFrom, effectiveTo = null) => {
        const payload = typeof packageId === 'object' ? packageId : {
            package_id: packageId,
            effective_from: effectiveFrom,
            effective_to: effectiveTo
        };
        const response = await api.post(`/payroll/employees/${employeeId}/assign-package`, payload);
        return normalize(response.data);
    },

    // Unassign package from employee
    unassignPackageFromEmployee: async (employeeId, data = {}) => {
        const response = await api.post(`/payroll/employees/${employeeId}/unassign-package`, data);
        return normalize(response.data);
    },

    // ==========================================
    // 4. Payroll Runs & Payslips
    // ==========================================

    // Trigger payroll run (Batch or Individual)
    triggerPayrollRun: async (runPayload) => {
        const response = await api.post('/payroll/runs', runPayload);
        return normalize(response.data);
    },

    // List all payroll runs
    getPayrollRuns: async (params = {}) => {
        const response = await api.get('/payroll/runs', { params });
        return normalize(response.data);
    },

    // Get details of a single payroll run (summary, employee payslips)
    getPayrollRunDetails: async (runId) => {
        const response = await api.get(`/payroll/runs/${runId}`);
        return normalize(response.data);
    },

    // Update run status, rename, or trigger rerun
    updatePayrollRun: async (runId, updateData) => {
        const response = await api.patch(`/payroll/runs/${runId}`, updateData);
        return normalize(response.data);
    },

    // Re-run draft run in-place
    rerunPayrollRun: async (runId) => {
        const response = await api.patch(`/payroll/runs/${runId}`, { action: 'rerun' });
        return normalize(response.data);
    },

    // Approve payroll run
    approvePayrollRun: async (runId) => {
        const response = await api.patch(`/payroll/runs/${runId}`, { status: 'approved' });
        return normalize(response.data);
    },

    // Mark payroll run as paid
    markRunAsPaid: async (runId, paid_at = null) => {
        const payload = { status: 'paid' };
        if (paid_at) payload.paid_at = paid_at;
        const response = await api.patch(`/payroll/runs/${runId}`, payload);
        return normalize(response.data);
    },

    // Get single employee itemized payslip
    getEmployeePayslip: async (runId, employeeId) => {
        const response = await api.get(`/payroll/runs/${runId}/employees/${employeeId}/payslip`);
        return normalize(response.data);
    },

    // Real-time projection calculation for an employee prior to creating run
    getEmployeeProjection: async (employeeId, period_start, period_end) => {
        const response = await api.get(`/payroll/employees/${employeeId}/projection`, {
            params: { period_start, period_end }
        });
        return normalize(response.data);
    }
};

export default payrollService;
