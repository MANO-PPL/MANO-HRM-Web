import catchAsync from '../../utils/catchAsync.js';
import * as orgService from './orgService.js';

export const createOrganization = catchAsync(async (req, res, next) => {
    const result = await orgService.createOrganization(req.body);
    res.status(201).json({
        success: true,
        message: "Organization created successfully",
        org_id: result.org_id
    });
});

export const getOrganizations = catchAsync(async (req, res, next) => {
    const data = await orgService.getOrganizations();
    res.status(200).json({ success: true, data });
});

export const updateOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await orgService.updateOrganization(id, req.body);
    res.status(200).json({ success: true, message: "Organization updated successfully" });
});

export const getOrgAdmins = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const data = await orgService.getOrgAdmins(id);
    res.status(200).json({ success: true, data });
});

export const updateOrgAdmin = catchAsync(async (req, res, next) => {
    const { id, adminId } = req.params;
    await orgService.updateOrgAdmin(id, adminId, req.body);
    res.status(200).json({ success: true, message: "Admin user updated successfully" });
});

export const deleteOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const result = await orgService.deleteOrganization(id, req.user?.user_id);
    const dateStr = result.deletion_scheduled_at.toISOString().split('T')[0];

    res.status(200).json({
        success: true,
        message: `Organization marked for deletion. It will be permanently deleted on ${dateStr} (in ${result.deletion_grace_days} days).`,
        deletion_scheduled_at: result.deletion_scheduled_at
    });
});

export const cancelOrgDeletion = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await orgService.cancelOrgDeletion(id);
    res.status(200).json({ success: true, message: 'Organization deletion cancelled. Status restored to active.' });
});

export const getOrgAnalytics = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const data = await orgService.getOrgAnalytics(id);
    res.status(200).json({ success: true, data });
});

export const getOrgLogs = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const result = await orgService.getOrgLogs(id, req.query);
    res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination
    });
});

export const checkOrgCodeAvailability = catchAsync(async (req, res, next) => {
    const { code, excludeId } = req.query;
    const result = await orgService.checkOrgCodeAvailability(code, excludeId);
    res.status(200).json({
        success: true,
        ...result
    });
});
