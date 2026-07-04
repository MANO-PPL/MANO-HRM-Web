import { attendanceDB } from '../../config/database.js';
import EventBus from '../../utils/EventBus.js';

export async function upsertRequest({ org_id, user_id, request_date, original_data, proposed_data, reason }) {
    const existingRequest = await attendanceDB("attn_dar_requests")
        .where({ user_id, request_date, status: 'PENDING' })
        .first();

    let request_id;
    const isUpdate = !!existingRequest;

    if (existingRequest) {
        await attendanceDB("attn_dar_requests")
            .where({ request_id: existingRequest.request_id })
            .update({
                proposed_data: JSON.stringify(proposed_data),
                reason: reason || null,
                updated_at: attendanceDB.fn.now()
            });
        request_id = existingRequest.request_id;
    } else {
        const [id] = await attendanceDB("attn_dar_requests").insert({
            org_id,
            user_id,
            request_date,
            original_data: JSON.stringify(original_data || []),
            proposed_data: JSON.stringify(proposed_data),
            reason: reason || null,
            status: 'PENDING',
            created_at: attendanceDB.fn.now()
        });
        request_id = id;
    }

    // Trigger Admin/HR notifications
    try {
        const employee = await attendanceDB('core_users').where({ user_id }).select('user_name').first();
        const employeeName = employee?.user_name || 'An employee';

        const admins = await attendanceDB('core_users')
            .where({ org_id, is_deleted: 0, is_active: 1 })
            .whereIn('user_type', ['admin', 'hr'])
            .select('user_id');

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(user_id)) continue;
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: isUpdate ? 'DAR Request Updated' : 'New DAR Request',
                message: `${employeeName} has submitted a DAR revision request for ${request_date}.`,
                type: 'INFO',
                related_entity_type: 'DAR',
                related_entity_id: request_id
            });
        }
    } catch (err) {
        console.error('Error sending DAR request notifications:', err);
    }

    return { request_id, isUpdate };
}

export async function getPendingRequests({ org_id }) {
    const requests = await attendanceDB("attn_dar_requests")
        .join("core_users", "attn_dar_requests.user_id", "core_users.user_id")
        .leftJoin("org_departments as dep", "core_users.dept_id", "dep.dept_id")
        .select(
            "attn_dar_requests.*",
            "core_users.user_name as user_name",
            "core_users.email as user_email",
            "core_users.user_type as user_role",
            "dep.dept_name as user_dept",
            attendanceDB.raw("DATE_FORMAT(dar_requests.request_date, '%Y-%m-%d') as request_date_str")
        )
        .where("attn_dar_requests.org_id", org_id)
        .where("attn_dar_requests.status", 'PENDING')
        .orderBy("attn_dar_requests.created_at", "desc");

    return requests.map(r => ({
        ...r,
        request_date: r.request_date_str,
        original_data: typeof r.original_data === 'string' ? JSON.parse(r.original_data) : r.original_data,
        proposed_data: typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data) : r.proposed_data
    }));
}

export async function approveRequest({ id, org_id }) {
    const request = await attendanceDB("attn_dar_requests")
        .select("*", attendanceDB.raw("DATE_FORMAT(request_date, '%Y-%m-%d') as request_date_str"))
        .where({ request_id: id, org_id })
        .first();

    if (!request) throw { status: 404, message: "Request not found" };
    if (request.status !== 'PENDING') throw { status: 400, message: "Request already processed" };

    const proposedTasks = typeof request.proposed_data === 'string' ? JSON.parse(request.proposed_data) : request.proposed_data;
    const targetDate = request.request_date_str;

    await attendanceDB.transaction(async (trx) => {
        await trx("attn_daily_activities")
            .where({ user_id: request.user_id, org_id })
            .whereRaw("DATE(activity_date) = ?", [targetDate])
            .del();

        if (proposedTasks.length > 0) {
            const inserts = proposedTasks.map(t => ({
                org_id,
                user_id: request.user_id,
                activity_date: targetDate,
                start_time: t.start_time,
                end_time: t.end_time,
                title: t.title,
                description: t.description,
                activity_type: t.activity_type || 'TASK',
                status: 'COMPLETED',
                created_at: attendanceDB.fn.now()
            }));
            await trx("attn_daily_activities").insert(inserts);
        }

        await trx("attn_dar_requests")
            .where({ request_id: id })
            .update({ status: 'APPROVED', updated_at: attendanceDB.fn.now() });
    });

    try {
        EventBus.emitNotification({
            org_id,
            user_id: request.user_id,
            title: 'DAR Request Approved',
            message: `Your DAR revision request for ${targetDate} has been approved.`,
            type: 'SUCCESS',
            related_entity_type: 'DAR',
            related_entity_id: id
        });
    } catch (err) {
        console.error('Error sending DAR approval notification:', err);
    }
}

export async function rejectRequest({ id, org_id, comment }) {
    const request = await attendanceDB("attn_dar_requests")
        .select("*", attendanceDB.raw("DATE_FORMAT(request_date, '%Y-%m-%d') as request_date_str"))
        .where({ request_id: id, org_id })
        .first();

    if (!request) throw { status: 404, message: "Request not found" };
    if (request.status !== 'PENDING') throw { status: 400, message: "Request already processed" };

    await attendanceDB("attn_dar_requests")
        .where({ request_id: id, org_id })
        .update({
            status: 'REJECTED',
            admin_comment: comment,
            updated_at: attendanceDB.fn.now()
        });

    const targetDate = request.request_date_str;

    try {
        EventBus.emitNotification({
            org_id,
            user_id: request.user_id,
            title: 'DAR Request Rejected',
            message: `Your DAR revision request for ${targetDate} has been rejected.${comment ? ` Reason: ${comment}` : ''}`,
            type: 'ERROR',
            related_entity_type: 'DAR',
            related_entity_id: id
        });
    } catch (err) {
        console.error('Error sending DAR rejection notification:', err);
    }
}