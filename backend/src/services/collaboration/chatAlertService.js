import { attendanceDB } from '../../config/database.js';
import { encryptText, decryptText } from '../../utils/encryption.js';

/**
 * Helper to get or create a direct chat room between two users
 */
async function getOrCreateDM(orgId, userA, userB) {
    const finalOrgId = orgId || 1;
    const allRooms = await attendanceDB('chat_rooms')
        .where({ room_type: 'direct', org_id: finalOrgId });

    let room = allRooms.find(r => {
        try {
            const ids = typeof r.member_ids === 'string' ? JSON.parse(r.member_ids) : r.member_ids;
            return Array.isArray(ids) &&
                   ids.map(Number).includes(Number(userA)) &&
                   ids.map(Number).includes(Number(userB));
        } catch (e) {
            return false;
        }
    });

    if (room) {
        let existingMessages = [];
        try {
            const decrypted = decryptText(room.messages);
            existingMessages = typeof decrypted === 'string' ? JSON.parse(decrypted || '[]') : (decrypted || []);
        } catch (e) {
            existingMessages = [];
        }
        return { roomId: room.room_id, existingMessages };
    }

    // Create a new direct chat room between the two users
    const memberIds = [Number(userA), Number(userB)].sort((a, b) => a - b);
    const [insertedId] = await attendanceDB('chat_rooms').insert({
        org_id: finalOrgId,
        room_name: null,
        room_type: 'direct',
        created_by: userA,
        member_ids: JSON.stringify(memberIds),
        messages: encryptText(JSON.stringify([])),
        last_read_times: JSON.stringify({}),
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });

    return { roomId: insertedId, existingMessages: [] };
}

/**
 * Unified helper to send a system alert card in a DM chat room
 */
export async function sendSystemAlert({ org_id, sender_id, recipient_id, card_type, entity_id, status, payload, io }) {
    try {
        const finalOrgId = org_id || 1;
        const { roomId, existingMessages } = await getOrCreateDM(finalOrgId, sender_id, recipient_id);

        // Format system payload message as JSON
        const messageText = `[SYSTEM_CARD:${card_type}:${entity_id}:${status}] ${JSON.stringify(payload)}`;

        const messageId = Date.now() + Math.floor(Math.random() * 1000);
        const newMsg = {
            message_id: messageId,
            sender_id: Number(sender_id),
            message_text: messageText,
            created_at: new Date().toISOString()
        };

        const updatedMessages = [...existingMessages, newMsg];
        await attendanceDB('chat_rooms')
            .where({ room_id: roomId })
            .update({
                messages: encryptText(JSON.stringify(updatedMessages)),
                updated_at: attendanceDB.fn.now()
            });

        // Emit real-time WebSocket update event
        if (io) {
            const sender = await attendanceDB('users')
                .where({ user_id: sender_id })
                .select('user_name', 'profile_image_url')
                .first();

            const formattedResponseMsg = {
                message_id: messageId,
                room_id: Number(roomId),
                sender_id: Number(sender_id),
                message_text: messageText,
                created_at: newMsg.created_at,
                user_name: sender ? sender.user_name : 'System Alert',
                profile_image_url: sender ? sender.profile_image_url : null
            };

            io.to(`room_${roomId}`).emit('message_received', formattedResponseMsg);
            io.to(`user_${sender_id}`).emit('room_updated', { room_id: roomId });
            io.to(`user_${recipient_id}`).emit('room_updated', { room_id: roomId });
        }
        return true;
    } catch (err) {
        console.error('Error sending system alert card:', err);
        return false;
    }
}

/**
 * Fetch all active Admin & HR users in the organization
 */
async function getAdminsAndHrs(orgId) {
    return attendanceDB('users')
        .where({ org_id: orgId, is_deleted: 0, is_active: 1 })
        .whereIn('user_type', ['admin', 'hr'])
        .select('user_id');
}

/**
 * 1. Notify Admins and HRs that an employee has applied for leave
 */
export async function notifyLeaveApplied({ org_id, sender_id, leave_id, attachments = [], io }) {
    try {
        const leave = await attendanceDB('leave_requests').where({ lr_id: leave_id }).first();
        if (!leave) return;

        const employee = await attendanceDB('users').where({ user_id: sender_id }).select('user_name').first();
        const employeeName = employee?.user_name || 'An employee';

        const admins = await getAdminsAndHrs(org_id);
        
        // Structured detailed payload
        const payload = {
            employee_name: employeeName,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            reason: leave.reason || 'None',
            local_time: new Date().toISOString(),
            attachments: attachments.map(a => ({
                name: a.file_key.split('/').pop() || 'Attachment',
                url: a.file_url
            }))
        };

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(sender_id)) continue;

            await sendSystemAlert({
                org_id,
                sender_id,
                recipient_id: admin.user_id,
                card_type: 'leave_request',
                entity_id: leave_id,
                status: 'Pending',
                payload,
                io
            });
        }
    } catch (err) {
        console.error('Error in notifyLeaveApplied:', err);
    }
}

/**
 * 2. Notify an employee that their leave request has been Approved or Rejected
 */
export async function notifyLeaveStatusUpdated({ org_id, reviewer_id, leave_id, io }) {
    try {
        const leave = await attendanceDB('leave_requests').where({ lr_id: leave_id }).first();
        if (!leave) return;

        const reviewer = await attendanceDB('users').where({ user_id: reviewer_id }).select('user_name').first();
        const reviewerName = reviewer?.user_name || 'Supervisor';

        // Load attachments if any
        const attRecords = await attendanceDB('leave_attachments').where({ leave_id });
        const formatAttachments = attRecords.map(a => ({
            name: a.file_key.split('/').pop() || 'Attachment',
            url: `https://${process.env.S3_BUCKET_NAME || 'mano-attendance'}.s3.amazonaws.com/${a.file_key}`
        }));

        const payload = {
            reviewer_name: reviewerName,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            reason: leave.reason || 'None',
            admin_comment: leave.admin_comment || 'None',
            status: leave.status,
            local_time: new Date().toISOString(),
            attachments: formatAttachments
        };

        await sendSystemAlert({
            org_id,
            sender_id: reviewer_id,
            recipient_id: leave.user_id,
            card_type: 'leave_request',
            entity_id: leave_id,
            status: leave.status,
            payload,
            io
        });
    } catch (err) {
        console.error('Error in notifyLeaveStatusUpdated:', err);
    }
}

/**
 * 3. Notify Admins and HRs that an employee has submitted an attendance correction
 */
export async function notifyCorrectionApplied({ org_id, sender_id, acr_id, io }) {
    try {
        const correction = await attendanceDB('attendance_correction_requests').where({ acr_id }).first();
        if (!correction) return;

        const employee = await attendanceDB('users').where({ user_id: sender_id }).select('user_name').first();
        const employeeName = employee?.user_name || 'An employee';

        const admins = await getAdminsAndHrs(org_id);
        
        const payload = {
            employee_name: employeeName,
            correction_type: correction.correction_type,
            request_date: correction.request_date,
            reason: correction.reason || 'None',
            local_time: new Date().toISOString(),
            proposed_data: typeof correction.proposed_data === 'string' ? JSON.parse(correction.proposed_data) : correction.proposed_data
        };

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(sender_id)) continue;

            await sendSystemAlert({
                org_id,
                sender_id,
                recipient_id: admin.user_id,
                card_type: 'correction_request',
                entity_id: acr_id,
                status: 'pending',
                payload,
                io
            });
        }
    } catch (err) {
        console.error('Error in notifyCorrectionApplied:', err);
    }
}

/**
 * 4. Notify an employee that their correction request has been approved or rejected
 */
export async function notifyCorrectionStatusUpdated({ org_id, reviewer_id, acr_id, io }) {
    try {
        const correction = await attendanceDB('attendance_correction_requests').where({ acr_id }).first();
        if (!correction) return;

        const reviewer = await attendanceDB('users').where({ user_id: reviewer_id }).select('user_name').first();
        const reviewerName = reviewer?.user_name || 'Supervisor';

        const payload = {
            reviewer_name: reviewerName,
            correction_type: correction.correction_type,
            request_date: correction.request_date,
            reason: correction.reason || 'None',
            review_comments: correction.review_comments || 'None',
            status: correction.status,
            local_time: new Date().toISOString()
        };

        await sendSystemAlert({
            org_id,
            sender_id: reviewer_id,
            recipient_id: correction.user_id,
            card_type: 'correction_request',
            entity_id: acr_id,
            status: correction.status,
            payload,
            io
        });
    } catch (err) {
        console.error('Error in notifyCorrectionStatusUpdated:', err);
    }
}

/**
 * 5. Notify an employee that they have been assigned a shift
 */
export async function notifyShiftAssigned({ org_id, admin_id, recipient_id, shift_id, io }) {
    try {
        const shift = await attendanceDB('shifts').where({ shift_id }).first();
        if (!shift) return;

        const rules = typeof shift.policy_rules === 'string' ? JSON.parse(shift.policy_rules) : (shift.policy_rules || {});
        const startTime = rules.shift_timing?.start_time || null;
        const endTime = rules.shift_timing?.end_time || null;
        const graceMins = rules.grace_period?.minutes || 0;

        const admin = await attendanceDB('users').where({ user_id: admin_id }).select('user_name').first();
        const adminName = admin?.user_name || 'Administrator';

        const payload = {
            admin_name: adminName,
            shift_name: shift.shift_name,
            start_time: startTime,
            end_time: endTime,
            grace_period_mins: graceMins,
            local_time: new Date().toISOString()
        };

        await sendSystemAlert({
            org_id,
            sender_id: admin_id,
            recipient_id,
            card_type: 'shift_assign',
            entity_id: shift_id,
            status: 'Active',
            payload,
            io
        });
    } catch (err) {
        console.error('Error in notifyShiftAssigned:', err);
    }
}

/**
 * 6. Notify an employee that they have been assigned a geofence location
 */
export async function notifyGeofenceAssigned({ org_id, admin_id, recipient_id, location_id, io }) {
    try {
        const location = await attendanceDB('work_locations').where({ location_id }).first();
        if (!location) return;

        const admin = await attendanceDB('users').where({ user_id: admin_id }).select('user_name').first();
        const adminName = admin?.user_name || 'Administrator';

        const payload = {
            admin_name: adminName,
            location_name: location.location_name,
            address: location.address || 'Standard assigned zone',
            radius: location.radius || 100,
            local_time: new Date().toISOString()
        };

        await sendSystemAlert({
            org_id,
            sender_id: admin_id,
            recipient_id,
            card_type: 'geofence_assign',
            entity_id: location_id,
            status: 'Active',
            payload,
            io
        });
    } catch (err) {
        console.error('Error in notifyGeofenceAssigned:', err);
    }
}
