import { attendanceDB } from '../../config/database.js';
import EventBus from '../../utils/EventBus.js';

/**
 * Fetch all active Admin, HR, and Super Admin users in the organization
 */
async function getAdminsAndHrs(orgId) {
    const finalOrgId = orgId || 1;
    return attendanceDB('core_users')
        .where({ org_id: finalOrgId, is_deleted: 0, is_active: 1 })
        .where(function() {
            this.whereRaw('LOWER(user_type) IN (?, ?, ?)', ['admin', 'hr', 'super_admin'])
                .orWhereIn('user_type', ['admin', 'hr', 'HR', 'Admin', 'super_admin', 'Super_Admin']);
        })
        .select('user_id', 'user_name', 'user_type');
}

const formatDateStr = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0];
    if (d instanceof Date) return d.toISOString().split('T')[0];
    return String(d);
};

/**
 * 1. Notify Admins and HRs that an employee has applied for leave (In-app bell notification)
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

        const startDateFormatted = formatDateStr(leave.start_date);
        const endDateFormatted = formatDateStr(leave.end_date);
        const leaveTypeLabel = leave.leave_type || 'Leave';

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(sender_id)) continue;

            // Send standard in-app bell notification strictly to this admin/HR account (no mobile push)
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: 'New Leave Application',
                message: `${employeeName} has applied for ${leaveTypeLabel} (${startDateFormatted} to ${endDateFormatted}).`,
                type: 'INFO',
                related_entity_type: 'LEAVE',
                related_entity_id: leave_id,
                send_push: false
            });
        }
    } catch (err) {
        console.error('Error in notifyLeaveApplied:', err);
    }
}

/**
 * 2. Notify an employee that their leave request has been Approved or Rejected (In-app bell notification)
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

        const startDateFormatted = formatDateStr(leave.start_date);
        const endDateFormatted = formatDateStr(leave.end_date);
        const leaveTypeLabel = leave.leave_type || 'Leave';
        const isApproved = leave.status?.toLowerCase() === 'approved';

        // Send standard in-app bell & push notification strictly to the requesting employee's account
        const statusMessage = isApproved
            ? `Your leave request for ${leaveTypeLabel} (${startDateFormatted} to ${endDateFormatted}) has been approved${leave.pay_type ? ` as ${leave.pay_type}` : ''} by ${reviewerName}.${leave.admin_comment ? ` Note: ${leave.admin_comment}` : ''}`
            : `Your leave request for ${leaveTypeLabel} (${startDateFormatted} to ${endDateFormatted}) has been rejected by ${reviewerName}.${leave.admin_comment ? ` Reason: ${leave.admin_comment}` : ''}`;

        EventBus.emitNotification({
            org_id,
            user_id: leave.user_id,
            title: isApproved ? 'Leave Request Approved' : 'Leave Request Rejected',
            message: statusMessage,
            type: isApproved ? 'SUCCESS' : 'ERROR',
            related_entity_type: 'LEAVE',
            related_entity_id: leave_id
        });
    } catch (err) {
        console.error('Error in notifyLeaveStatusUpdated:', err);
    }
}

/**
 * 3. Notify Admins and HRs that an employee has submitted an attendance correction (In-app bell notification)
 */
export async function notifyCorrectionApplied({ org_id, sender_id, acr_id, io }) {
    try {
        const correction = await attendanceDB('attn_corrections').where({ id: acr_id }).first();
        if (!correction) return;

        const employee = await attendanceDB('core_users').where({ user_id: sender_id }).select('user_name').first();
        const employeeName = employee?.user_name || 'An employee';

        const admins = await getAdminsAndHrs(org_id);
        const reqDateFormatted = formatDateStr(correction.request_date);

        for (const admin of admins) {
            if (Number(admin.user_id) === Number(sender_id)) continue;

            // Send standard in-app bell notification strictly to this admin/HR account (no mobile push)
            EventBus.emitNotification({
                org_id,
                user_id: admin.user_id,
                title: 'New Correction Request',
                message: `${employeeName} has submitted an attendance correction request for ${reqDateFormatted}.`,
                type: 'INFO',
                related_entity_type: 'CORRECTION',
                related_entity_id: acr_id,
                send_push: false
            });
        }
    } catch (err) {
        console.error('Error in notifyCorrectionApplied:', err);
    }
}

/**
 * 4. Notify an employee that their correction request has been approved or rejected (In-app bell notification)
 */
export async function notifyCorrectionStatusUpdated({ org_id, reviewer_id, acr_id, io }) {
    try {
        const correction = await attendanceDB('attn_corrections').where({ id: acr_id }).first();
        if (!correction) return;

        const reviewer = await attendanceDB('core_users').where({ user_id: reviewer_id }).select('user_name').first();
        const reviewerName = reviewer?.user_name || 'Supervisor';
        const reqDateFormatted = formatDateStr(correction.request_date);
        const isApproved = correction.status?.toLowerCase() === 'approved';

        // Send standard in-app bell & push notification strictly to the employee's account
        const statusMessage = isApproved
            ? `Your attendance correction request for ${reqDateFormatted} has been approved by ${reviewerName}.${correction.review_comments ? ` Note: ${correction.review_comments}` : ''}`
            : `Your attendance correction request for ${reqDateFormatted} has been rejected by ${reviewerName}.${correction.review_comments ? ` Reason: ${correction.review_comments}` : ''}`;

        EventBus.emitNotification({
            org_id,
            user_id: correction.user_id,
            title: `Correction Request ${correction.status ? correction.status.charAt(0).toUpperCase() + correction.status.slice(1) : ''}`,
            message: statusMessage,
            type: isApproved ? 'SUCCESS' : 'ERROR',
            related_entity_type: 'CORRECTION',
            related_entity_id: acr_id
        });
    } catch (err) {
        console.error('Error in notifyCorrectionStatusUpdated:', err);
    }
}

/**
 * 5. Notify an employee that they have been assigned a shift (In-app bell notification)
 */
export async function notifyShiftAssigned({ org_id, admin_id, recipient_id, shift_id, io }) {
    try {
        const shift = await attendanceDB('org_shifts').where({ shift_id }).first();
        if (!shift) return;

        const rules = typeof shift.policy_rules === 'string' ? JSON.parse(shift.policy_rules) : (shift.policy_rules || {});
        const startTime = rules.shift_timing?.start_time || 'N/A';
        const endTime = rules.shift_timing?.end_time || 'N/A';

        const admin = await attendanceDB('core_users').where({ user_id: admin_id }).select('user_name').first();
        const adminName = admin?.user_name || 'Administrator';

        // Send in-app bell notification
        EventBus.emitNotification({
            org_id,
            user_id: recipient_id,
            title: 'New Shift Assigned',
            message: `You have been assigned to shift "${shift.shift_name}" (${startTime} - ${endTime}) by ${adminName}.`,
            type: 'INFO',
            related_entity_type: 'SHIFT',
            related_entity_id: shift_id,
            send_push: false
        });
    } catch (err) {
        console.error('Error in notifyShiftAssigned:', err);
    }
}

/**
 * 6. Notify an employee that they have been assigned a geofence location (In-app bell notification)
 */
export async function notifyGeofenceAssigned({ org_id, admin_id, recipient_id, location_id, io }) {
    try {
        const location = await attendanceDB('org_work_locations').where({ location_id }).first();
        if (!location) return;

        const admin = await attendanceDB('core_users').where({ user_id: admin_id }).select('user_name').first();
        const adminName = admin?.user_name || 'Administrator';

        // Send in-app bell notification
        EventBus.emitNotification({
            org_id,
            user_id: recipient_id,
            title: 'Work Location Assigned',
            message: `You have been assigned to work location "${location.location_name}" by ${adminName}.`,
            type: 'INFO',
            related_entity_type: 'LOCATION',
            related_entity_id: location_id,
            send_push: false
        });
    } catch (err) {
        console.error('Error in notifyGeofenceAssigned:', err);
    }
}
