import { attendanceDB } from '../../config/database.js';
import { encryptText, decryptText } from '../../utils/encryption.js';
import EventBus from '../../utils/EventBus.js';
import { getFileUrl } from '../s3/s3Service.js';

// Helper to parse system card and sign its attachments
const signSystemCardAttachments = async (messageText) => {
    if (!messageText || !messageText.startsWith("[SYSTEM_CARD:")) return messageText;
    const closeBracketIdx = messageText.indexOf("]");
    if (closeBracketIdx === -1) return messageText;

    const header = messageText.substring(0, closeBracketIdx + 1);
    const body = messageText.substring(closeBracketIdx + 1).trim();
    try {
        const payload = JSON.parse(body);
        if (payload && Array.isArray(payload.attachments)) {
            const signedAttachments = [];
            for (const att of payload.attachments) {
                let key = null;
                if (att.url) {
                    try {
                        const parsed = new URL(att.url);
                        if (parsed.hostname.includes('s3.amazonaws.com') || parsed.hostname.includes('.s3.')) {
                            key = decodeURIComponent(parsed.pathname.substring(1));
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
                if (key) {
                    try {
                        const signedRes = await getFileUrl({ key });
                        if (signedRes.success) {
                            signedAttachments.push({ ...att, url: signedRes.url });
                            continue;
                        }
                    } catch (err) {
                        console.error("Error signing S3 key for system card:", key, err);
                    }
                }
                signedAttachments.push(att);
            }
            payload.attachments = signedAttachments;
            return `${header} ${JSON.stringify(payload)}`;
        }
    } catch (e) {
        // Ignore JSON parsing errors for legacy text fallback
    }
    return messageText;
};

/**
 * Helper to get or create a direct chat room between two users
 */
async function getOrCreateDM(orgId, userA, userB) {
    const finalOrgId = orgId || 1;

    // Find if a DM conversation exists
    const userAConversations = await attendanceDB('chat_conversation_members')
        .where({ org_id: finalOrgId, user_id: userA })
        .select('conversation_id');

    const userAConvIds = userAConversations.map(c => c.conversation_id);

    if (userAConvIds.length > 0) {
        const existingDM = await attendanceDB('chat_conversations')
            .join('chat_conversation_members', 'chat_conversations.id', 'chat_conversation_members.conversation_id')
            .where({
                'chat_conversations.org_id': finalOrgId,
                'chat_conversations.type': 'dm',
                'chat_conversation_members.user_id': userB
            })
            .whereIn('chat_conversations.id', userAConvIds)
            .select('chat_conversations.id')
            .first();

        if (existingDM) {
            return existingDM.id;
        }
    }

    // Create a new direct chat room between the two users
    let newRoomId = null;

    await attendanceDB.transaction(async (trx) => {
        const [insertedId] = await trx('chat_conversations').insert({
            org_id: finalOrgId,
            type: 'dm',
            name: null,
            created_by: userA,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now()
        });

        newRoomId = insertedId;

        // Add both users as members
        const memberRows = [
            { org_id: finalOrgId, conversation_id: insertedId, user_id: Number(userA), role: 'owner', joined_at: trx.fn.now() },
            { org_id: finalOrgId, conversation_id: insertedId, user_id: Number(userB), role: 'member', joined_at: trx.fn.now() }
        ];

        await trx('chat_conversation_members').insert(memberRows);
    });

    return newRoomId;
}

/**
 * Unified helper to send a system alert card in a DM chat room
 */
export async function sendSystemAlert({ org_id, sender_id, recipient_id, card_type, entity_id, status, payload, io }) {
    try {
        const finalOrgId = org_id || 1;
        const roomId = await getOrCreateDM(finalOrgId, sender_id, recipient_id);

        // Format system payload message as JSON
        const messageText = `[SYSTEM_CARD:${card_type}:${entity_id}:${status}] ${JSON.stringify(payload)}`;

        const messageId = Date.now() + Math.floor(Math.random() * 1000);

        // Insert message
        await attendanceDB('chat_messages').insert({
            id: messageId,
            org_id: finalOrgId,
            conversation_id: roomId,
            sender_id: Number(sender_id),
            type: 'workflow_card',
            content: encryptText(messageText),
            metadata_json: JSON.stringify({
                card_type,
                entity_id,
                status,
                ...payload
            }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // Update conversation last_message_id
        await attendanceDB('chat_conversations')
            .where({ org_id: finalOrgId, id: roomId })
            .update({
                last_message_id: messageId,
                updated_at: attendanceDB.fn.now()
            });

        // Emit real-time WebSocket update event
        if (io) {
            const sender = await attendanceDB('core_users')
                .where({ user_id: sender_id })
                .select('user_name', 'profile_image_url')
                .first();

            const signedMessageText = await signSystemCardAttachments(messageText);

            const formattedResponseMsg = {
                message_id: messageId,
                room_id: Number(roomId),
                sender_id: Number(sender_id),
                message_text: signedMessageText,
                created_at: new Date().toISOString(),
                user_name: sender ? sender.user_name : 'System Alert',
                profile_image_url: sender ? sender.profile_image_url : null
            };

            // Emit to namespaced room channel
            io.to(`org_${finalOrgId}:conversation_${roomId}`).emit('message_received', formattedResponseMsg);

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
    return attendanceDB('core_users')
        .where({ org_id: orgId, is_deleted: 0, is_active: 1 })
        .whereIn('user_type', ['admin', 'hr'])
        .select('user_id');
}

/**
 * 1. Notify Admins and HRs that an employee has applied for leave
 */
export async function notifyLeaveApplied({ org_id, sender_id, leave_id, attachments = [], io }) {
    try {
        const leave = await attendanceDB('leave_request as lr')
            .leftJoin('leave_policies_rules as lpr', 'lr.rule_id', 'lpr.rule_id')
            .select('lr.*', 'lpr.name as leave_type')
            .where({ 'lr.lr_id': leave_id })
            .first();
        if (!leave) return;

        const employee = await attendanceDB('core_users').where({ user_id: sender_id }).select('user_name').first();
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

            // Send standard browser / FCM notification
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: 'New Leave Application',
                message: `${employeeName} has applied for ${leave.leave_type} (${leave.start_date} to ${leave.end_date}).`,
                type: 'INFO',
                related_entity_type: 'LEAVE',
                related_entity_id: leave_id
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
        const leave = await attendanceDB('leave_request as lr')
            .leftJoin('leave_policies_rules as lpr', 'lr.rule_id', 'lpr.rule_id')
            .select('lr.*', 'lpr.name as leave_type')
            .where({ 'lr.lr_id': leave_id })
            .first();
        if (!leave) return;

        const reviewer = await attendanceDB('core_users').where({ user_id: reviewer_id }).select('user_name').first();
        const reviewerName = reviewer?.user_name || 'Supervisor';

        // Load attachments if any
        const atts = typeof leave.attachments === 'string' ? JSON.parse(leave.attachments) : (leave.attachments || []);
        const formatAttachments = (atts || []).map(a => ({
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
            pay_type: leave.pay_type,
            pay_percentage: leave.pay_percentage,
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

        // Send standard browser / FCM notification
        EventBus.emitNotification({
            org_id,
            user_id: leave.user_id,
            title: `Leave Request ${leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1) : ''}`,
            message: `Your leave request for ${leave.leave_type} has been ${leave.status ? leave.status.toLowerCase() : ''}${leave.status?.toLowerCase() === 'approved' && leave.pay_type ? ` as ${leave.pay_type}` : ''} by ${reviewerName}.`,
            type: leave.status?.toLowerCase() === 'approved' ? 'SUCCESS' : 'ERROR',
            related_entity_type: 'LEAVE',
            related_entity_id: leave_id
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
        const correction = await attendanceDB('attn_correction_requests').where({ acr_id }).first();
        if (!correction) return;

        const employee = await attendanceDB('core_users').where({ user_id: sender_id }).select('user_name').first();
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

            // Send standard browser / FCM notification
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: 'New Correction Request',
                message: `${employeeName} has submitted an attendance correction request for ${correction.request_date}.`,
                type: 'INFO',
                related_entity_type: 'CORRECTION',
                related_entity_id: acr_id
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
        const correction = await attendanceDB('attn_correction_requests').where({ acr_id }).first();
        if (!correction) return;

        const reviewer = await attendanceDB('core_users').where({ user_id: reviewer_id }).select('user_name').first();
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

        // Send standard browser / FCM notification
        EventBus.emitNotification({
            org_id,
            user_id: correction.user_id,
            title: `Correction Request ${correction.status.charAt(0).toUpperCase() + correction.status.slice(1)}`,
            message: `Your attendance correction request for ${correction.request_date} has been ${correction.status.toLowerCase()} by ${reviewerName}.`,
            type: correction.status === 'approved' ? 'SUCCESS' : 'ERROR',
            related_entity_type: 'CORRECTION',
            related_entity_id: acr_id
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
        const shift = await attendanceDB('org_shifts').where({ shift_id }).first();
        if (!shift) return;

        const rules = typeof shift.policy_rules === 'string' ? JSON.parse(shift.policy_rules) : (shift.policy_rules || {});
        const startTime = rules.shift_timing?.start_time || null;
        const endTime = rules.shift_timing?.end_time || null;
        const graceMins = rules.grace_period?.minutes || 0;

        const admin = await attendanceDB('core_users').where({ user_id: admin_id }).select('user_name').first();
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

        // Send standard browser / FCM notification
        EventBus.emitNotification({
            org_id,
            user_id: recipient_id,
            title: 'New Shift Assigned',
            message: `You have been assigned to shift "${shift.shift_name}" (${startTime} - ${endTime}) by ${adminName}.`,
            type: 'INFO',
            related_entity_type: 'SHIFT',
            related_entity_id: shift_id
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
        const location = await attendanceDB('org_work_locations').where({ location_id }).first();
        if (!location) return;

        const admin = await attendanceDB('core_users').where({ user_id: admin_id }).select('user_name').first();
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

        // Send standard browser / FCM notification
        EventBus.emitNotification({
            org_id,
            user_id: recipient_id,
            title: 'Work Location Assigned',
            message: `You have been assigned to work location "${location.location_name}" by ${adminName}.`,
            type: 'INFO',
            related_entity_type: 'LOCATION',
            related_entity_id: location_id
        });
    } catch (err) {
        console.error('Error in notifyGeofenceAssigned:', err);
    }
}
