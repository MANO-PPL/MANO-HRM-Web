import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';


export const getNotifications = async (
    user_id,
    limit,
    unread_only
) => {
    let query = attendanceDB('notifications')
        .where({ user_id })
        .orderBy('created_at', 'desc')
        .limit(Math.min(parseInt(limit), 50));

    if (unread_only === 'true') {

        query = query.where({ is_read: 0 });
    }

    const notifications = await query;
    const unreadResult = await attendanceDB('notifications')
        .where({
            user_id,
            is_read: 0
        })
        .count('* as count')
        .first();

    return {

        notifications,

        unread_count:
            unreadResult?.count || 0

    };

};

export const markNotificationAsRead = async (
    user_id,
    notification_id
) => {
    const count = await attendanceDB('notifications')
        .where({
            notification_id,
            user_id
        })
        .update({
            is_read: 1
        });
    return count;
};

export const markAllNotificationsAsRead = async (user_id) => {

    const count = await attendanceDB('notifications')
        .where({
            user_id,
            is_read: 0
        })
        .update({
            is_read: 1
        });


    return count;

};

export const createNotification = async ({ org_id, user_id, type, title, message, related_entity_type, related_entity_id }) => {
    const [notification_id] = await attendanceDB('notifications').insert({
        org_id,
        user_id,
        type: type || 'INFO',
        title,
        message,
        is_read: 0,
        related_entity_type,
        related_entity_id,
        created_at: attendanceDB.fn.now()
    });
    return notification_id;
};


