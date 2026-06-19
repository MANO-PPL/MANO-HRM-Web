import { attendanceDB } from '../../config/database.js';
import { createNotification } from '../notifications/notificationService.js';
import { encryptText, decryptText } from '../../utils/encryption.js';
import EventBus from '../../utils/EventBus.js';

/**
 * Helper to get or create a direct chat room between two users (relational)
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
 * Parses and processes `@mentions` within chat texts or DAR descriptions.
 */
export const handleMentions = async ({ org_id, sender_id, text, context_type, context_id, explicit_user_ids = [], room_id, io }) => {
    try {
        if (!text || typeof text !== 'string') return [];

        const sender = await attendanceDB('users')
            .where({ user_id: sender_id })
            .select('user_name')
            .first();
        const senderName = sender?.user_name || 'Someone';

        const mentionedUserIds = new Set(explicit_user_ids);

        let allowedMemberIds = null;
        if (context_type === 'chat_message' && room_id) {
            const members = await attendanceDB('chat_conversation_members')
                .where({ org_id: org_id || 1, conversation_id: room_id })
                .select('user_id');
            allowedMemberIds = members.map(m => Number(m.user_id));
        }

        // Fetch active coworkers in the organization (optionally filtered by org_id)
        let orgUsersQuery = attendanceDB('users')
            .where({ 'users.is_deleted': 0, 'users.is_active': 1 })
            .whereNot({ 'users.user_id': sender_id });

        if (org_id !== null && org_id !== undefined) {
            orgUsersQuery = orgUsersQuery.where({ 'users.org_id': org_id });
        }

        if (allowedMemberIds) {
            orgUsersQuery = orgUsersQuery.whereIn('users.user_id', allowedMemberIds);
        }

        const orgUsers = await orgUsersQuery.select('users.user_id', 'users.user_name');

        // Regex to find mentions (e.g. @John Doe)
        const mentionRegex = /@([a-zA-Z0-9\s._-]+)/g;
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            const rawMention = match[1].trim().toLowerCase();
            
            // Look for matching user names (trim trailing/leading spaces from DB names)
            const matchedUser = orgUsers.find(u => {
                const name = (u.user_name || '').trim().toLowerCase();
                return name === rawMention || rawMention.startsWith(name);
            });

            if (matchedUser) {
                mentionedUserIds.add(matchedUser.user_id);
            }
        }

        const results = [];
        for (const userId of mentionedUserIds) {
            let title = 'New Mention';
            let message = `${senderName} mentioned you.`;

            if (context_type === 'chat_message') {
                title = 'Mentioned in Chat';
                message = `${senderName} mentioned you in a chat message.`;
            } else if (context_type === 'dar_activity') {
                title = 'Mentioned in DAR';
                message = `${senderName} tagged you in their Daily Activity Report task.`;
            } else if (context_type === 'dar_meeting') {
                title = 'Mentioned in Meeting';
                message = `${senderName} tagged you in a Daily Activity Report meeting.`;
            }

            // Emit notification via EventBus (saves to DB and pushes via Socket.IO & FCM)
            EventBus.emitNotification({
                org_id,
                user_id: userId,
                type: 'INFO',
                title,
                message,
                related_entity_type: context_type,
                related_entity_id: String(context_id)
            });

            // Instagram-like mention preview chat message creation (without emojis)
            if (context_type === 'dar_activity' || context_type === 'dar_meeting') {
                try {
                    const finalOrgId = org_id || 1;
                    const roomId = await getOrCreateDM(finalOrgId, sender_id, userId);

                    // 2. Fetch the task/meeting details
                    let mentionTitle = '';
                    let mentionDesc = '';

                    if (context_type === 'dar_activity') {
                        const activity = await attendanceDB('daily_activities')
                            .where({ activity_id: context_id })
                            .first();
                        if (activity) {
                            mentionTitle = activity.title || 'Untitled Task';
                            mentionDesc = activity.description || '';
                        }
                    } else if (context_type === 'dar_meeting') {
                        const event = await attendanceDB('events_meetings')
                            .where({ event_id: context_id })
                            .first();
                        if (event) {
                            mentionTitle = event.title || 'Untitled Meeting';
                            mentionDesc = event.description || '';
                        }
                    }

                    // 3. Format message cleanly without emojis
                    const displayTitle = mentionTitle ? `*${mentionTitle.toUpperCase()}*` : 'Untitled';
                    const displayDesc = mentionDesc ? `\n"${mentionDesc}"` : '';
                    const contextName = context_type === 'dar_activity' ? 'Daily Activity Task' : 'Daily Activity Meeting';
                    const chatMessageText = `Mentioned you in my ${contextName}:\n${displayTitle}${displayDesc}`;

                    // 4. Create and append the message
                    const messageId = Date.now() + Math.floor(Math.random() * 1000);
                    
                    await attendanceDB.transaction(async (trx) => {
                        await trx('chat_messages').insert({
                            id: messageId,
                            org_id: finalOrgId,
                            conversation_id: roomId,
                            sender_id: Number(sender_id),
                            type: 'text',
                            content: encryptText(chatMessageText),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                        await trx('chat_conversations')
                            .where({ org_id: finalOrgId, id: roomId })
                            .update({
                                last_message_id: messageId,
                                updated_at: trx.fn.now()
                            });
                    });

                    // 5. Emit real-time WebSocket update event
                    if (io) {
                        const sender = await attendanceDB('users')
                            .where({ user_id: sender_id })
                            .select('user_name', 'profile_image_url')
                            .first();

                        const formattedResponseMsg = {
                            message_id: messageId,
                            room_id: Number(roomId),
                            sender_id: Number(sender_id),
                            message_text: chatMessageText,
                            created_at: new Date().toISOString(),
                            user_name: sender ? sender.user_name : 'Unknown Colleague',
                            profile_image_url: sender ? sender.profile_image_url : null
                        };

                        io.to(`org_${finalOrgId}:conversation_${roomId}`).emit('message_received', formattedResponseMsg);
                        io.to(`user_${sender_id}`).emit('room_updated', { room_id: roomId });
                        io.to(`user_${userId}`).emit('room_updated', { room_id: roomId });
                    }
                } catch (chatErr) {
                    console.error('Error creating mention preview chat message:', chatErr);
                }
            }

            results.push({ user_id: userId, notification_id: null });
        }

        return results;
    } catch (err) {
        return [];
    }
};
