import catchAsync from '../../utils/catchAsync.js';
import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import bcrypt from 'bcrypt';
import { deactivateExpiredOrganizations } from '../../cron/cleanupScheduler.js';

export const createOrganization = catchAsync(async (req, res, next) => {
    const {
        org_name, org_code, subscription_plan, subscription_expiry, grace_period_days, max_users,
        contact_name, contact_email, contact_phone,
        admin_name, admin_email, admin_phone, admin_password,
        gst_number, pan_number
    } = req.body;

    if (!org_name || !org_code) {
        throw new AppError("Organization name and code are required", 400);
    }

    if (!admin_email || !admin_password) {
        throw new AppError("Admin email and password are required to setup the organization", 400);
    }

    const cleanOrgCode = org_code.trim().toUpperCase();
    if (cleanOrgCode.length < 3 || cleanOrgCode.length > 10 || !/^[A-Z]+$/.test(cleanOrgCode)) {
        throw new AppError("Organization code must be 3-10 alphabetical characters (letters only) with no spaces.", 400);
    }

    // Check uniqueness
    const existingOrg = await attendanceDB('core_organizations').where('org_code', cleanOrgCode).first();
    if (existingOrg) {
        throw new AppError("Organization code is already registered.", 400);
    }

    const existingUser = await attendanceDB('core_users').where('email', admin_email.trim().toLowerCase()).first();
    if (existingUser) {
        throw new AppError("Administrator email is already registered.", 400);
    }

    if (admin_phone) {
        const existingPhone = await attendanceDB('core_users').where('phone_no', admin_phone.trim()).first();
        if (existingPhone) {
            throw new AppError("Administrator phone number is already registered.", 400);
        }
    }

    // Wrap in transaction to ensure both org and admin user are created or neither
    const insertedId = await attendanceDB.transaction(async (trx) => {
        const [orgId] = await trx('core_organizations').insert({
            org_name,
            org_code: cleanOrgCode,
            contact_name: contact_name || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            subscription_plan: subscription_plan || 'Trial',
            subscription_expiry: subscription_expiry || null,
            is_trial: (subscription_plan || 'Trial') === 'Trial' ? 1 : 0,
            status: 'active',
            max_users: max_users || 50,
            last_user_number: 1, // We're creating the first user right now
            gst_number: gst_number || null,
            pan_number: pan_number || null
        });

        // Create the admin user for this organization
        const hashedPassword = await bcrypt.hash(admin_password, 10);
        const userCode = `${cleanOrgCode}-001`;

        await trx('core_users').insert({
            org_id: orgId,
            user_code: userCode,
            user_name: admin_name || contact_name || 'Organization Admin',
            email: admin_email,
            phone_no: admin_phone || null,
            user_password: hashedPassword,
            user_type: 'admin',
            is_active: true,
            is_deleted: false
        });

        return orgId;
    });

    res.status(201).json({ success: true, message: "Organization created successfully", org_id: insertedId });
});

export const getOrganizations = catchAsync(async (req, res, next) => {
    // Sync expired organizations dynamically to keep database status up to date
    await deactivateExpiredOrganizations();

    // Left join users table to get counts
    const orgs = await attendanceDB('core_organizations as o')
        .leftJoin('core_users as u', 'o.org_id', 'u.org_id')
        .select(
            'o.*',
            attendanceDB.raw("COALESCE(SUM(CASE WHEN u.user_type != 'admin' AND u.is_deleted = 0 THEN 1 ELSE 0 END), 0) as total_users"),
            attendanceDB.raw("COALESCE(SUM(CASE WHEN u.user_type != 'admin' AND u.is_active = 1 AND u.is_deleted = 0 THEN 1 ELSE 0 END), 0) as active_users"),
            attendanceDB.raw("COALESCE(SUM(CASE WHEN u.user_type != 'admin' AND u.is_active = 0 AND u.is_deleted = 0 THEN 1 ELSE 0 END), 0) as inactive_users")
        )
        .groupBy('o.org_id')
        .orderBy('o.created_at', 'desc');

    res.status(200).json({ success: true, data: orgs });
});

export const updateOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const {
        org_name, org_code, status, subscription_plan, subscription_expiry, grace_period_days, max_users,
        contact_name, contact_email, contact_phone,
        gst_number, pan_number
    } = req.body;

    const org = await attendanceDB('core_organizations').where('org_id', id).first();
    if (!org) throw new AppError("Organization not found", 404);

    const updates = {};
    if (org_name !== undefined) updates.org_name = org_name;
    if (status !== undefined) updates.status = status;
    if (subscription_plan !== undefined) updates.subscription_plan = subscription_plan;
    if (subscription_expiry !== undefined) updates.subscription_expiry = subscription_expiry;
    if (grace_period_days !== undefined) updates.grace_period_days = grace_period_days;
    if (max_users !== undefined) updates.max_users = max_users;
    if (contact_name !== undefined) updates.contact_name = contact_name;
    if (contact_email !== undefined) updates.contact_email = contact_email;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;
    if (gst_number !== undefined) updates.gst_number = gst_number;
    if (pan_number !== undefined) updates.pan_number = pan_number;

    if (org_code !== undefined) {
        const cleanOrgCode = org_code.trim().toUpperCase();
        if (cleanOrgCode.length < 3 || cleanOrgCode.length > 10 || !/^[A-Z]+$/.test(cleanOrgCode)) {
            throw new AppError("Organization code must be 3-10 alphabetical characters (letters only) with no spaces.", 400);
        }
        if (cleanOrgCode !== org.org_code) {
            // Check uniqueness of the new code
            const existingOrg = await attendanceDB('core_organizations').where('org_code', cleanOrgCode).first();
            if (existingOrg) {
                throw new AppError("Organization code is already registered.", 400);
            }
            updates.org_code = cleanOrgCode;
        }
    }

    if (Object.keys(updates).length > 0) {
        await attendanceDB.transaction(async (trx) => {
            if (updates.org_code) {
                const oldPrefix = org.org_code;
                const newPrefix = updates.org_code;
                const users = await trx('core_users').where('org_id', id);
                for (const user of users) {
                    if (user.user_code) {
                        let newUserCode = '';
                        if (user.user_code.startsWith(oldPrefix + "-")) {
                            const suffix = user.user_code.substring(oldPrefix.length);
                            newUserCode = `${newPrefix}${suffix}`;
                        } else if (user.user_code.startsWith(oldPrefix)) {
                            const suffix = user.user_code.substring(oldPrefix.length);
                            newUserCode = `${newPrefix}${suffix}`;
                        } else {
                            // Robust Fallback: Handles codes not matching oldPrefix
                            let suffix = '';
                            const hyphenIndex = user.user_code.lastIndexOf('-');
                            if (hyphenIndex !== -1) {
                                suffix = user.user_code.substring(hyphenIndex);
                                newUserCode = `${newPrefix}${suffix}`;
                            } else {
                                const match = user.user_code.match(/\d+$/);
                                if (match) {
                                    suffix = match[0];
                                    newUserCode = `${newPrefix}-${suffix.padStart(3, '0')}`;
                                } else {
                                    newUserCode = `${newPrefix}-${String(user.user_id).padStart(3, '0')}`;
                                }
                            }
                        }

                        // Ensure global uniqueness to prevent duplicate key constraint violations (e.g. from deleted users or collisions)
                        let finalUserCode = newUserCode;
                        let isUnique = false;
                        let attempt = 0;
                        while (!isUnique) {
                            const conflict = await trx('core_users')
                                .where('user_code', finalUserCode)
                                .whereNot('user_id', user.user_id)
                                .first();
                            if (!conflict) {
                                isUnique = true;
                            } else {
                                attempt++;
                                finalUserCode = `${newUserCode}-${user.user_id}${attempt > 1 ? `-${attempt}` : ''}`;
                            }
                        }

                        await trx('core_users').where('user_id', user.user_id).update({ user_code: finalUserCode });
                    }
                }
            }
            await trx('core_organizations').where('org_id', id).update(updates);
        });

        // Immediately sync database status in case expiry date was set to a past date
        await deactivateExpiredOrganizations();
    }

    res.status(200).json({ success: true, message: "Organization updated successfully" });
});

export const getOrgAdmins = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const admins = await attendanceDB('core_users')
        .where({ org_id: id, user_type: 'admin' })
        .select('user_id', 'user_code', 'user_name', 'email', 'phone_no', 'is_active')
        .orderBy('created_at', 'asc');

    res.status(200).json({ success: true, data: admins });
});

export const updateOrgAdmin = catchAsync(async (req, res, next) => {
    const { id, adminId } = req.params;
    const { user_name, email, phone_no, is_active, password } = req.body;

    const admin = await attendanceDB('core_users').where({ user_id: adminId, org_id: id, user_type: 'admin' }).first();
    if (!admin) throw new AppError("Admin user not found", 404);

    const updates = {};
    if (user_name !== undefined) updates.user_name = user_name;
    if (email !== undefined) updates.email = email;
    if (phone_no !== undefined) updates.phone_no = phone_no;
    if (is_active !== undefined) updates.is_active = is_active;

    if (password) {
        updates.user_password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length > 0) {
        await attendanceDB('core_users').where('user_id', adminId).update(updates);
    }

    res.status(200).json({ success: true, message: "Admin user updated successfully" });
});

/**
 * DELETE /organizations/:id
 * Marks an organization for deletion. The org and all its data will be permanently
 * purged by the cleanup scheduler after DELETION_GRACE_DAYS (~2–3 months).
 */
const DELETION_GRACE_DAYS = 75; // ~2.5 months
 
export const deleteOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const org = await attendanceDB('core_organizations').where('org_id', id).first();
    if (!org) throw new AppError('Organization not found', 404);

    if (org.status === 'pending_deletion') {
        throw new AppError('Organization is already scheduled for deletion', 409);
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_DAYS);

    await attendanceDB('core_organizations').where('org_id', id).update({
        status: 'pending_deletion',
        deletion_requested_at: attendanceDB.fn.now(),
        deletion_scheduled_at: deletionDate,
        deletion_requested_by: req.user?.user_id || null
    });

    res.status(200).json({
        success: true,
        message: `Organization marked for deletion. It will be permanently deleted on ${deletionDate.toISOString().split('T')[0]} (in ${DELETION_GRACE_DAYS} days).`,
        deletion_scheduled_at: deletionDate
    });
});

/**
 * POST /organizations/:id/cancel-deletion
 * Cancels a pending deletion, restoring the organization to active status.
 */
export const cancelOrgDeletion = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const org = await attendanceDB('core_organizations').where('org_id', id).first();
    if (!org) throw new AppError('Organization not found', 404);

    if (org.status !== 'pending_deletion') {
        throw new AppError('Organization is not scheduled for deletion', 400);
    }

    await attendanceDB('core_organizations').where('org_id', id).update({
        status: 'active',
        deletion_requested_at: null,
        deletion_scheduled_at: null,
        deletion_requested_by: null
    });

    res.status(200).json({ success: true, message: 'Organization deletion cancelled. Status restored to active.' });
});

export const getOrgAnalytics = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const org = await attendanceDB('core_organizations').where('org_id', id).first();
    if (!org) throw new AppError('Organization not found', 404);

    // Parallel fetch basic counts
    const [
        totalApiCountRes,
        totalErrorsRes,
        activeUsersRes,
        moduleDistribution,
        platformDistribution,
        recentLogs
    ] = await Promise.all([
        attendanceDB('sys_api_logs').where({ org_id: id }).count('* as count').first(),
        attendanceDB('sys_error_logs').where({ org_id: id }).count('error_id as count').first(),
        attendanceDB('core_users').where({ org_id: id, is_active: 1, is_deleted: 0 }).count('user_id as count').first(),
        attendanceDB('sys_api_logs').where({ org_id: id }).select('module_name as module').count('* as count').groupBy('module_name'),
        attendanceDB('sys_api_logs').where({ org_id: id }).select('event_source as platform').count('* as count').groupBy('event_source'),
        attendanceDB('sys_api_logs').where({ org_id: id }).select('duration_ms', 'status_code', 'is_success').orderBy('occurred_at', 'desc').limit(200)
    ]);

    // Parse recent logs to compute average latency and success rate
    let totalLatency = 0;
    let successfulCalls = 0;
    let callsWithLatency = 0;

    recentLogs.forEach(log => {
        if (log.duration_ms !== null && log.duration_ms !== undefined) {
            totalLatency += Number(log.duration_ms);
            callsWithLatency++;
        }
        if (log.is_success && log.status_code < 400) {
            successfulCalls++;
        }
    });

    const totalApiCount = Number(totalApiCountRes?.count) || 0;
    const avgLatency = callsWithLatency > 0 ? Math.round(totalLatency / callsWithLatency) : 0;
    const calculatedSuccessRate = recentLogs.length > 0 ? Math.round((successfulCalls / recentLogs.length) * 100) : 100;

    // Clean and group module distribution for backward compatibility
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

    // Clean and group platform distribution for client analysis (Web vs App)
    const cleanedPlatformDistribution = (platformDistribution || [])
        .map(item => {
            let name = item.platform || 'UNKNOWN';
            if (name === 'API') name = 'API_CLIENT';
            // If historical logs had a module name in event_source, map it to API_CLIENT
            if (name !== 'WEB' && name !== 'MOBILE_APP' && name !== 'API_CLIENT' && name !== 'UNKNOWN') {
                name = 'WEB'; // Assume WEB or API_CLIENT for fallback
            }
            return {
                platform: name,
                count: Number(item.count) || 0
            };
        })
        .reduce((acc, curr) => {
            const existing = acc.find(item => item.platform === curr.platform);
            if (existing) {
                existing.count += curr.count;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

    res.status(200).json({
        success: true,
        data: {
            total_api_calls: totalApiCount,
            total_errors: Number(totalErrorsRes?.count) || 0,
            active_users: Number(activeUsersRes?.count) || 0,
            avg_latency_ms: avgLatency,
            success_rate: calculatedSuccessRate,
            module_distribution: cleanedModuleDistribution,
            platform_distribution: cleanedPlatformDistribution,
            status: org.status,
            subscription_plan: org.subscription_plan
        }
    });
});

export const getOrgLogs = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { type = 'activity', module, platform, search, limit = 200, page = 1 } = req.query;

    const parsedLimit = Math.min(parseInt(limit), 500); // Allow up to 500 for massive terminal scrolling
    const parsedPage = Math.max(parseInt(page), 1);
    const offset = (parsedPage - 1) * parsedLimit;

    let query;
    let countQuery;

    if (type === 'errors') {
        query = attendanceDB('sys_error_logs as el')
            .leftJoin('core_users as u', 'el.user_id', 'u.user_id')
            .select('el.*', 'u.user_name', 'u.email')
            .where('el.org_id', id)
            .orderBy('el.occurred_at', 'desc');

        countQuery = attendanceDB('sys_error_logs').where('org_id', id);

        if (platform) {
            // Error logs store platform in extra_context
            const searchPlatform = `%"platform":"${platform}"%`;
            query = query.andWhere('el.extra_context', 'like', searchPlatform);
            countQuery = countQuery.andWhere('extra_context', 'like', searchPlatform);
        }

        if (search) {
            const searchQuery = `%${search}%`;
            query = query.andWhere(function() {
                this.where('el.error_message', 'like', searchQuery)
                    .orWhere('el.request_path', 'like', searchQuery)
                    .orWhere('u.user_name', 'like', searchQuery);
            });
            countQuery = countQuery.andWhere(function() {
                this.where('error_message', 'like', searchQuery)
                    .orWhere('request_path', 'like', searchQuery);
            });
        }
    } else if (type === 'api') {
        query = attendanceDB('sys_api_logs as ar')
            .leftJoin('core_users as u', 'ar.user_id', 'u.user_id')
            .select('ar.*', 'u.user_name', 'u.email')
            .where('ar.org_id', id)
            .orderBy('ar.occurred_at', 'desc');

        countQuery = attendanceDB('sys_api_logs').where('org_id', id);

        if (platform) {
            query = query.andWhere('ar.event_source', platform);
            countQuery = countQuery.andWhere('event_source', platform);
        }

        if (module) {
            query = query.andWhere('ar.module_name', module);
            countQuery = countQuery.andWhere('module_name', module);
        }

        if (search) {
            const searchQuery = `%${search}%`;
            query = query.andWhere(function() {
                this.where('ar.request_path', 'like', searchQuery)
                    .orWhere('ar.route_pattern', 'like', searchQuery)
                    .orWhere('u.user_name', 'like', searchQuery);
            });
            countQuery = countQuery.andWhere(function() {
                this.where('request_path', 'like', searchQuery)
                    .orWhere('route_pattern', 'like', searchQuery);
            });
        }
    } else {
        query = attendanceDB('sys_activity_logs as al')
            .leftJoin('core_users as u', 'al.user_id', 'u.user_id')
            .select('al.*', 'u.user_name', 'u.email')
            .where('al.org_id', id)
            .orderBy('al.occurred_at', 'desc');

        countQuery = attendanceDB('sys_activity_logs').where('org_id', id);

        if (platform) {
            query = query.andWhere('al.event_source', platform);
            countQuery = countQuery.andWhere('event_source', platform);
        }

        if (module) {
            // Intelligent module filter mapping for API_CALL and manual logs
            if (module === 'Attendance') {
                query = query.andWhere(function() {
                    this.where('al.object_type', 'Attendance')
                        .orWhere('al.object_type', 'ATTENDANCE')
                        .orWhere('al.event_type', 'like', 'ATTENDANCE%')
                        .orWhere('al.description', 'like', '%check in%')
                        .orWhere('al.description', 'like', '%checked in%')
                        .orWhere('al.description', 'like', '%check out%')
                        .orWhere('al.description', 'like', '%checked out%');
                });
                countQuery = countQuery.andWhere(function() {
                    this.where('object_type', 'Attendance')
                        .orWhere('object_type', 'ATTENDANCE')
                        .orWhere('event_type', 'like', 'ATTENDANCE%')
                        .orWhere('description', 'like', '%check in%')
                        .orWhere('description', 'like', '%checked in%')
                        .orWhere('description', 'like', '%check out%')
                        .orWhere('description', 'like', '%checked out%');
                });
            } else if (module === 'Authentication') {
                query = query.andWhere(function() {
                    this.where('al.object_type', 'Authentication')
                        .orWhere('al.event_type', 'LOGIN')
                        .orWhere('al.event_type', 'LOGOUT');
                });
                countQuery = countQuery.andWhere(function() {
                    this.where('object_type', 'Authentication')
                        .orWhere('event_type', 'LOGIN')
                        .orWhere('event_type', 'LOGOUT');
                });
            } else {
                query = query.andWhere(function() {
                    this.where('al.object_type', module)
                        .orWhere('al.event_type', 'like', `%${module}%`);
                });
                countQuery = countQuery.andWhere(function() {
                    this.where('object_type', module)
                        .orWhere('event_type', 'like', `%${module}%`);
                });
            }
        }

        if (search) {
            const searchQuery = `%${search}%`;
            query = query.andWhere(function() {
                this.where('al.description', 'like', searchQuery)
                    .orWhere('al.event_type', 'like', searchQuery)
                    .orWhere('u.user_name', 'like', searchQuery);
            });
            countQuery = countQuery.andWhere(function() {
                this.where('description', 'like', searchQuery)
                    .orWhere('event_type', 'like', searchQuery);
            });
        }
    }

    const [logs, totalCountRes] = await Promise.all([
        query.limit(parsedLimit).offset(offset),
        countQuery.count('* as count').first()
    ]);

    const totalCount = Number(totalCountRes?.count) || 0;

    // Normalize each log record with dedicated platform and module properties
    const normalizedLogs = logs.map(log => {
        let platform = 'UNKNOWN';
        let moduleName = 'General';

        if (type === 'errors') {
            try {
                let context = log.extra_context;
                if (typeof context === 'string') {
                    context = JSON.parse(context);
                }
                if (context && context.platform) {
                    platform = context.platform;
                }
            } catch (e) {}
            if (platform === 'UNKNOWN') {
                platform = 'WEB'; // default fallback for web endpoints
            }
            moduleName = 'System Error';
        } else if (type === 'api') {
            platform = log.event_source || 'UNKNOWN';
            moduleName = log.module_name || 'General';
        } else {
            // Manual log classification
            platform = log.event_source || 'UNKNOWN';
            if (platform !== 'WEB' && platform !== 'MOBILE_APP' && platform !== 'API_CLIENT') {
                // Fallback to check user_agent
                const ua = (log.user_agent || '').toLowerCase();
                if (ua.includes('dart') || ua.includes('flutter')) platform = 'MOBILE_APP';
                else platform = 'WEB';
            }

            // Map manual events to module names
            const lowerType = (log.event_type || '').toLowerCase();
            const lowerObj = (log.object_type || '').toLowerCase();
            const lowerDesc = (log.description || '').toLowerCase();

            if (lowerType === 'login' || lowerType === 'logout') {
                moduleName = 'Authentication';
            } else if (lowerType.startsWith('attendance') || lowerObj === 'attendance' || lowerDesc.includes('check in') || lowerDesc.includes('checked in') || lowerDesc.includes('check out') || lowerDesc.includes('checked out')) {
                moduleName = 'Attendance';
            } else if (lowerObj === 'leave' || lowerObj === 'leaves' || lowerType.includes('leave')) {
                moduleName = 'Leaves';
            } else if (lowerObj === 'holiday' || lowerType.includes('holiday')) {
                moduleName = 'Holidays';
            } else if (lowerObj === 'policy' || lowerObj === 'policies') {
                moduleName = 'Shift Policies';
            } else if (lowerObj === 'notification' || lowerType.includes('notification')) {
                moduleName = 'Notifications';
            } else if (lowerObj === 'dar' || lowerType.includes('dar')) {
                moduleName = 'DAR (Daily Activity)';
            } else if (lowerObj === 'employee' || lowerType.includes('employee')) {
                moduleName = 'Employees';
            } else if (lowerObj === 'organization' || lowerType.includes('organization')) {
                moduleName = 'Organizations';
            } else {
                moduleName = log.object_type || 'General';
            }
        }

        return {
            ...log,
            platform,
            module: moduleName
        };
    });

    res.status(200).json({
        success: true,
        data: normalizedLogs,
        pagination: {
            total: totalCount,
            page: parsedPage,
            limit: parsedLimit,
            pages: Math.ceil(totalCount / parsedLimit)
        }
    });
});

export const checkOrgCodeAvailability = catchAsync(async (req, res, next) => {
    const { code, excludeId } = req.query;
    if (!code) {
        throw new AppError("Code query parameter is required", 400);
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z]+$/.test(cleanCode)) {
        return res.status(200).json({
            success: true,
            available: false,
            message: "Invalid code format (letters only)"
        });
    }
    let query = attendanceDB('core_organizations').where('org_code', cleanCode);
    if (excludeId) {
        query = query.andWhereNot('org_id', excludeId);
    }
    const existingOrg = await query.first();
    res.status(200).json({
        success: true,
        available: !existingOrg
    });
});

