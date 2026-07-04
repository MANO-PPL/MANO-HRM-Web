import { attendanceDB } from '../../config/database.js';

export const getDashboardStats = async () => {
    const [
        totalOrgsRes,
        totalUsersRes,
        pendingFeedbackRes,
        openAlertsRes,
        totalApiCountRes,
        totalErrorsRes,
        moduleDistribution,
        orgStatusDistribution
    ] = await Promise.all([
        attendanceDB('core_organizations').count('* as count').first(),
        attendanceDB('core_users').count('* as count').where('is_deleted', 0).first(),
        attendanceDB('feedback')
            .count('* as count')
            .whereIn('status', ['pending', 'open', 'OPEN', 'PENDING', ''])
            .orWhereNull('status')
            .first(),
        attendanceDB('sys_security_alerts')
            .count('* as count')
            .whereIn('status', ['open', 'unseen', 'OPEN', 'UNSEEN'])
            .first(),
        attendanceDB('sys_api_logs').count('* as count').first(),
        attendanceDB('sys_error_logs').count('error_id as count').first(),
        attendanceDB('sys_api_logs').select('module_name as module').count('* as count').groupBy('module_name'),
        attendanceDB('core_organizations').select('status').count('* as count').groupBy('status')
    ]);

    // Clean module distribution names
    const cleanedModuleDistribution = (moduleDistribution || [])
        .map(item => {
            let name = item.module || 'General';
            if (name === 'API_ENDPOINT' || name === 'API') name = 'General';
            return {
                module: name,
                count: Number(item.count) || 0
            };
        })
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.module === curr.module);
            if (existing) {
                existing.count += curr.count;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

    // Clean organization status names
    const cleanedOrgStatusDistribution = (orgStatusDistribution || [])
        .map(item => {
            let status = item.status || 'active';
            if (!status || status === '') status = 'active';
            return {
                status,
                count: Number(item.count) || 0
            };
        })
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.status === curr.status);
            if (existing) {
                existing.count += curr.count;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

    return {
        totalOrgs: Number(totalOrgsRes?.count) || 0,
        totalUsers: Number(totalUsersRes?.count) || 0,
        pendingFeedback: Number(pendingFeedbackRes?.count) || 0,
        openAlerts: Number(openAlertsRes?.count) || 0,
        totalApiCalls: Number(totalApiCountRes?.count) || 0,
        totalErrors: Number(totalErrorsRes?.count) || 0,
        moduleDistribution: cleanedModuleDistribution,
        orgStatusDistribution: cleanedOrgStatusDistribution
    };
};
