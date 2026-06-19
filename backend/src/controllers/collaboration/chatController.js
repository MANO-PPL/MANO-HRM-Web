import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { handleMentions } from '../../services/collaboration/mentionService.js';
import { encryptText, decryptText } from '../../utils/encryption.js';
import { uploadFile, getFileUrl } from '../../services/s3/s3Service.js';
import EventBus from '../../utils/EventBus.js';

// Helper to sign chat attachments (extract key from URL if missing)
const getSignedAttachment = async (attachment) => {
    if (!attachment) return null;
    let key = attachment.key;
    if (!key && attachment.url) {
        try {
            const parsed = new URL(attachment.url);
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
                return { ...attachment, url: signedRes.url };
            }
        } catch (err) {
            console.error("Error signing S3 key:", key, err);
        }
    }
    return attachment;
};

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

// Helper to enrich a raw chat room with members info, last message, unread count, etc.
const enrichRoomDetails = async (room, userId) => {
    if (!room) return null;

    const orgId = room.org_id;

    // Fetch details of all room members
    const roomMembers = await attendanceDB('chat_conversation_members')
        .join('users', 'chat_conversation_members.user_id', 'users.user_id')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where({ 'chat_conversation_members.org_id': orgId, 'chat_conversation_members.conversation_id': room.id })
        .where('users.is_deleted', 0)
        .select(
            'chat_conversation_members.user_id',
            'chat_conversation_members.role',
            'chat_conversation_members.is_archived',
            'chat_conversation_members.updated_at',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    const cleanMembers = roomMembers.map(u => ({
        ...u,
        user_name: u.user_name ? u.user_name.trim() : ''
    }));

    // Check if current user is archived
    const currentMember = roomMembers.find(m => Number(m.user_id) === Number(userId));
    const isRemoved = currentMember ? !!currentMember.is_archived : false;
    const removedAt = isRemoved ? currentMember.updated_at : null;

    // Fetch the last message
    let lastMsg = null;
    if (room.last_message_id) {
        lastMsg = await attendanceDB('chat_messages')
            .where({ org_id: orgId, id: room.last_message_id })
            .first();
    }

    let lastMsgText = null;
    let lastMsgSenderName = 'Unknown Colleague';
    if (lastMsg) {
        lastMsgText = decryptText(lastMsg.content);
        const sender = cleanMembers.find(m => Number(m.user_id) === Number(lastMsg.sender_id));
        if (sender) {
            lastMsgSenderName = sender.user_name;
        }
    }

    // Calculate unread count
    let unreadCount = 0;
    if (!isRemoved && currentMember) {
        const lastReadId = currentMember.last_read_message_id || 0;
        const countQuery = await attendanceDB('chat_messages')
            .where({ org_id: orgId, conversation_id: room.id })
            .whereNot({ sender_id: userId })
            .where('id', '>', lastReadId)
            .count('id as cnt')
            .first();
        unreadCount = countQuery?.cnt || 0;
    }

    let customRoomName = decryptText(room.name) || room.name;
    let dmAvatar = room.avatar_url;

    if (room.type === 'dm') {
        const otherMember = cleanMembers.find(m => Number(m.user_id) !== Number(userId));
        if (otherMember) {
            customRoomName = otherMember.user_name;
            dmAvatar = otherMember.profile_image_url;
        }
    }

    return {
        room_id: room.id,
        org_id: room.org_id,
        room_type: room.type === 'dm' ? 'direct' : 'group',
        room_name: customRoomName,
        avatar_url: dmAvatar,
        created_by: room.created_by,
        members: cleanMembers,
        is_removed: isRemoved,
        removed_at: removedAt,
        last_message: lastMsg ? {
            text: lastMsgText,
            sender_id: lastMsg.sender_id,
            created_at: lastMsg.created_at,
            sender_name: lastMsgSenderName
        } : null,
        unread_count: unreadCount,
        created_at: room.created_at,
        updated_at: room.updated_at
    };
};

// GET sanitized coworkers inside same organization
export const getOrgUsers = catchAsync(async (req, res, next) => {
    const orgId = req.user.org_id;
    const currentUserId = req.user.user_id ?? req.user.id;
    const isSuperAdmin = req.user.user_type === 'super_admin';

    let query = attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where('users.is_deleted', 0)
        .where('users.is_active', 1)
        .whereNot('users.user_id', currentUserId);

    if (!isSuperAdmin && orgId !== null && orgId !== undefined) {
        query = query.where('users.org_id', orgId);
    }

    const users = await query
        .select(
            'users.user_id',
            'users.user_name',
            'users.email',
            'users.user_type',
            'users.profile_image_url',
            'departments.dept_name',
            'designations.desg_name'
        )
        .orderBy('users.user_name', 'asc');

    const cleanUsers = users.map(u => ({
        ...u,
        user_name: u.user_name ? u.user_name.trim() : ''
    }));

    res.json({
        success: true,
        data: cleanUsers
    });
});

// GET all rooms current user is a member of
export const getRooms = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id || 1;

    // Get memberships for the user
    const memberships = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, user_id: userId });

    if (memberships.length === 0) {
        return res.json({ success: true, data: [] });
    }

    const conversationIds = memberships.map(m => m.conversation_id);

    // Fetch conversations
    const conversations = await attendanceDB('chat_conversations')
        .where({ org_id: orgId })
        .whereIn('id', conversationIds);

    // Fetch all members of these conversations
    const allMembersList = await attendanceDB('chat_conversation_members')
        .join('users', 'chat_conversation_members.user_id', 'users.user_id')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where({ 'chat_conversation_members.org_id': orgId })
        .whereIn('chat_conversation_members.conversation_id', conversationIds)
        .where('users.is_deleted', 0)
        .select(
            'chat_conversation_members.conversation_id',
            'chat_conversation_members.role',
            'chat_conversation_members.is_archived',
            'chat_conversation_members.updated_at',
            'users.user_id',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    // Fetch the last messages
    const lastMessageIds = conversations.map(c => c.last_message_id).filter(Boolean);
    let lastMessages = [];
    if (lastMessageIds.length > 0) {
        lastMessages = await attendanceDB('chat_messages')
            .where({ org_id: orgId })
            .whereIn('id', lastMessageIds);
    }

    const enrichedRooms = [];

    for (const conv of conversations) {
        const membership = memberships.find(m => m.conversation_id === conv.id);
        const roomMembers = allMembersList.filter(m => m.conversation_id === conv.id);

        const isRemoved = membership ? !!membership.is_archived : false;
        const removedAt = isRemoved ? membership.updated_at : null;

        // Decrypt last message text
        const lastMsg = lastMessages.find(m => Number(m.id) === Number(conv.last_message_id));
        let lastMsgText = null;
        let lastMsgSenderName = 'Unknown Colleague';
        if (lastMsg) {
            lastMsgText = decryptText(lastMsg.content);
            const sender = roomMembers.find(m => Number(m.user_id) === Number(lastMsg.sender_id));
            if (sender) {
                lastMsgSenderName = sender.user_name;
            }
        }

        // Calculate unread count
        let unreadCount = 0;
        if (!isRemoved) {
            const lastReadId = membership?.last_read_message_id || 0;
            const countQuery = await attendanceDB('chat_messages')
                .where({ org_id: orgId, conversation_id: conv.id })
                .whereNot({ sender_id: userId })
                .where('id', '>', lastReadId)
                .count('id as cnt')
                .first();
            unreadCount = countQuery?.cnt || 0;
        }

        let customRoomName = decryptText(conv.name) || conv.name;
        let dmAvatar = conv.avatar_url;

        if (conv.type === 'dm') {
            const otherMember = roomMembers.find(m => Number(m.user_id) !== Number(userId));
            if (otherMember) {
                customRoomName = otherMember.user_name;
                dmAvatar = otherMember.profile_image_url;
            }
        }

        enrichedRooms.push({
            room_id: conv.id,
            org_id: conv.org_id,
            room_type: conv.type === 'dm' ? 'direct' : 'group',
            room_name: customRoomName,
            avatar_url: dmAvatar,
            created_by: conv.created_by,
            members: roomMembers,
            is_removed: isRemoved,
            removed_at: removedAt,
            last_message: lastMsg ? {
                text: lastMsgText,
                sender_id: lastMsg.sender_id,
                created_at: lastMsg.created_at,
                sender_name: lastMsgSenderName
            } : null,
            unread_count: unreadCount,
            created_at: conv.created_at,
            updated_at: conv.updated_at
        });
    }

    // Sort by last message time or creation time
    enrichedRooms.sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.created_at) : new Date(a.created_at);
        const timeB = b.last_message ? new Date(b.last_message.created_at) : new Date(b.created_at);
        return timeB - timeA;
    });

    res.json({
        success: true,
        data: enrichedRooms
    });
});

// CREATE DM or Group room
export const createRoom = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id || 1;
    const { room_type = 'direct', room_name, member_ids = [] } = req.body;

    const allMemberIds = Array.from(new Set([userId, ...member_ids])).map(Number);

    if (room_type === 'direct') {
        if (allMemberIds.length !== 2) {
            throw new AppError('Direct messaging rooms must have exactly 2 members', 400);
        }

        const targetMemberId = allMemberIds.find(id => id !== userId);

        // Check if DM room already exists between these 2 users in this organization
        const userConversations = await attendanceDB('chat_conversation_members')
            .where({ org_id: orgId, user_id: userId })
            .select('conversation_id');

        const userConvIds = userConversations.map(c => c.conversation_id);

        if (userConvIds.length > 0) {
            const existingDM = await attendanceDB('chat_conversations')
                .join('chat_conversation_members', 'chat_conversations.id', 'chat_conversation_members.conversation_id')
                .where({
                    'chat_conversations.org_id': orgId,
                    'chat_conversations.type': 'dm',
                    'chat_conversation_members.user_id': targetMemberId
                })
                .whereIn('chat_conversations.id', userConvIds)
                .select('chat_conversations.*')
                .first();

            if (existingDM) {
                const enriched = await enrichRoomDetails(existingDM, userId);
                return res.json({
                    success: true,
                    message: 'DM room already exists',
                    data: enriched
                });
            }
        }
    }

    // Create a new conversation and member list
    let newRoomId = null;

    await attendanceDB.transaction(async (trx) => {
        const [insertedId] = await trx('chat_conversations').insert({
            org_id: orgId,
            type: room_type === 'group' ? 'group' : 'dm',
            name: room_type === 'group' ? encryptText(room_name || 'Group Chat') : null,
            created_by: userId,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now()
        });

        newRoomId = insertedId;

        // Insert members
        const memberRows = allMemberIds.map(mId => ({
            org_id: orgId,
            conversation_id: insertedId,
            user_id: mId,
            role: Number(mId) === Number(userId) ? 'owner' : 'member',
            joined_at: trx.fn.now()
        }));

        await trx('chat_conversation_members').insert(memberRows);
    });

    const newConversation = await attendanceDB('chat_conversations')
        .where({ id: newRoomId })
        .first();

    const enrichedRoom = await enrichRoomDetails(newConversation, userId);

    const io = req.app.get('io');
    if (io) {
        allMemberIds.forEach(mId => {
            io.to(`user_${mId}`).emit('room_created', enrichedRoom);
        });
    }

    res.status(201).json({
        success: true,
        data: enrichedRoom
    });
});

// GET messages within a room
export const getRoomMessages = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id || 1;
    const { roomId } = req.params;
    const { before } = req.query; // message ID cursor

    // Verify user membership in this conversation
    const membership = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
        .first();

    if (!membership) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    // Fetch messages (with pagination limit)
    let query = attendanceDB('chat_messages')
        .where({ org_id: orgId, conversation_id: roomId });

    if (before) {
        query = query.where('id', '<', before);
    }

    // If user is removed/archived, filter messages up to the point they left
    if (membership.is_archived) {
        query = query.where('created_at', '<=', membership.updated_at);
    }

    const msgs = await query
        .orderBy('id', 'desc')
        .limit(50); // Default pagination chunk size

    // Reverse to chronological order
    msgs.reverse();

    // Resolve user details for senders
    const senderIds = Array.from(new Set(msgs.map(m => m.sender_id)));
    let senders = [];
    if (senderIds.length > 0) {
        senders = await attendanceDB('users')
            .whereIn('user_id', senderIds)
            .select('user_id', 'user_name', 'profile_image_url');
    }

    // Resolve attachments
    const messageIds = msgs.map(m => m.id);
    let attachments = [];
    if (messageIds.length > 0) {
        attachments = await attendanceDB('chat_message_attachments')
            .where({ org_id: orgId })
            .whereIn('message_id', messageIds);
    }

    // Enrich message objects
    const enriched = await Promise.all(msgs.map(async msg => {
        const sender = senders.find(s => Number(s.user_id) === Number(msg.sender_id));
        
        let attachment = attachments.find(a => Number(a.message_id) === Number(msg.id));
        let formattedAttachment = null;
        if (attachment) {
            formattedAttachment = await getSignedAttachment({
                key: attachment.storage_key,
                url: attachment.public_url,
                name: attachment.file_name,
                size: attachment.size_bytes,
                type: attachment.type
            });
        }

        let contentText = decryptText(msg.content);
        
        // Re-sign S3 URL in system cards
        if (msg.type === 'workflow_card' && contentText && contentText.startsWith("[SYSTEM_CARD:")) {
            contentText = await signSystemCardAttachments(contentText);
        }

        return {
            message_id: msg.id,
            room_id: Number(roomId),
            sender_id: Number(msg.sender_id),
            message_text: contentText,
            attachment: formattedAttachment,
            created_at: msg.created_at,
            user_name: sender ? sender.user_name : (msg.sender_id === 0 ? 'System' : 'Unknown Colleague'),
            profile_image_url: sender ? sender.profile_image_url : null
        };
    }));

    res.json({
        success: true,
        data: enriched
    });
});

// POST message
export const sendMessage = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id || 1;
    const { roomId } = req.params;
    const { message_text, attachment } = req.body;

    if ((!message_text || message_text.trim() === '') && !attachment) {
        throw new AppError('Message body or attachment is required', 400);
    }

    // Verify user membership in this conversation and org_id match
    const membership = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
        .first();

    if (!membership) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    if (membership.is_archived) {
        throw new AppError('You cannot send messages to this group because you have been removed', 403);
    }

    const conversation = await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .first();

    if (!conversation) {
        throw new AppError('Chat room not found', 404);
    }

    // Perform message insert in a Transaction
    let insertedMsgId = null;
    let formattedResponseMsg = null;

    await attendanceDB.transaction(async (trx) => {
        const [msgId] = await trx('chat_messages').insert({
            org_id: orgId,
            conversation_id: roomId,
            sender_id: userId,
            type: 'text',
            content: encryptText(message_text ? message_text.trim() : ''),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        insertedMsgId = msgId;

        // Insert attachment details if present
        if (attachment) {
            await trx('chat_message_attachments').insert({
                org_id: orgId,
                message_id: msgId,
                type: attachment.type || 'file',
                file_name: attachment.name || 'Attachment',
                mime_type: attachment.type || null,
                size_bytes: attachment.size || null,
                storage_provider: 's3',
                storage_key: attachment.key || '',
                public_url: attachment.url || null,
                created_at: new Date().toISOString()
            });
        }

        // Update conversation last_message_id and updated_at
        await trx('chat_conversations')
            .where({ org_id: orgId, id: roomId })
            .update({
                last_message_id: msgId,
                updated_at: trx.fn.now()
            });
    });

    // Resolve user details for response
    const sender = await attendanceDB('users')
        .where({ user_id: userId })
        .select('user_name', 'profile_image_url')
        .first();

    let signedAttachment = attachment;
    if (signedAttachment) {
        signedAttachment = await getSignedAttachment(signedAttachment);
    }

    formattedResponseMsg = {
        message_id: insertedMsgId,
        room_id: Number(roomId),
        sender_id: Number(userId),
        message_text: message_text ? message_text.trim() : '',
        attachment: signedAttachment,
        created_at: new Date().toISOString(),
        user_name: sender ? sender.user_name : 'Unknown Colleague',
        profile_image_url: sender ? sender.profile_image_url : null
    };

    // Emit real-time Socket events
    const io = req.app.get('io');
    if (io) {
        // Broadcast to the conversation room channel (includes organization namespace)
        io.to(`org_${orgId}:conversation_${roomId}`).emit('message_received', formattedResponseMsg);
        
        // Also emit to user private channels for notification triggers
        const roomMembers = await attendanceDB('chat_conversation_members')
            .where({ org_id: orgId, conversation_id: roomId });

        roomMembers.forEach(member => {
            if (Number(member.user_id) !== Number(userId)) {
                io.to(`user_${member.user_id}`).emit('message_received', formattedResponseMsg);
            }
        });
    }

    // Send notifications via EventBus (handles push and notification save)
    const roomMembers = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId });

    const isGroup = conversation.type === 'group';
    const customRoomName = isGroup ? (decryptText(conversation.name) || conversation.name) : null;
    const senderName = sender ? sender.user_name : 'Someone';
    const displayTitle = isGroup 
        ? `${senderName} in ${customRoomName || 'Group'}`
        : senderName;
    const displayBody = message_text || 'Sent an attachment';

    for (const member of roomMembers) {
        if (Number(member.user_id) !== Number(userId)) {
            EventBus.emitNotification({
                org_id: orgId,
                user_id: member.user_id,
                title: displayTitle,
                message: displayBody,
                type: 'CHAT',
                related_entity_type: 'CHAT_MESSAGE',
                related_entity_id: String(roomId)
            });
        }
    }

    // Handle @mentions
    if (message_text) {
        await handleMentions({
            org_id: orgId,
            sender_id: userId,
            text: message_text,
            context_type: 'chat_message',
            context_id: insertedMsgId,
            room_id: roomId,
            io
        });
    }

    res.status(201).json({
        success: true,
        data: formattedResponseMsg
    });
});

// POST upload attachment to S3 (max 50MB)
export const uploadAttachment = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id || 1;
    const { roomId } = req.params;

    if (!req.file) {
        throw new AppError('No file uploaded', 400);
    }

    const room = await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    // Check user membership and archiving state
    const membership = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
        .first();

    if (!membership || membership.is_archived) {
        throw new AppError('You cannot upload attachments to this room', 403);
    }

    const timestamp = Date.now();
    const directory = `chat-attachments/org_${orgId}/room_${roomId}`;
    const filename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${directory}/${timestamp}_${filename}`;

    const uploadResult = await uploadFile({
        fileBuffer: req.file.buffer,
        key,
        directory,
        contentType: req.file.mimetype
    });

    if (!uploadResult.success) {
        throw new AppError('Failed to upload file to storage', 500);
    }

    res.status(200).json({
        success: true,
        message: 'Attachment uploaded successfully',
        file: {
            url: uploadResult.url,
            key: uploadResult.key,
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype
        }
    });
});

// PUT mark room as read
export const markAsRead = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const { roomId } = req.params;
    const orgId = req.user.org_id || 1;

    // Get the latest message ID in this room to set as last_read_message_id
    const latestMsg = await attendanceDB('chat_messages')
        .where({ org_id: orgId, conversation_id: roomId })
        .orderBy('id', 'desc')
        .select('id')
        .first();

    if (latestMsg) {
        await attendanceDB('chat_conversation_members')
            .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
            .update({
                last_read_message_id: latestMsg.id,
                updated_at: attendanceDB.fn.now()
            });
    }

    res.json({
        success: true,
        message: 'Room messages marked as read'
    });
});

// DELETE chat room (deletes single row from database)
export const deleteRoom = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const { roomId } = req.params;
    const orgId = req.user.org_id || 1;

    const room = await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    // Verify user is member of room
    const membership = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
        .first();

    if (!membership) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    // Get all members for notifying
    const members = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId })
        .select('user_id');

    // Delete conversation (triggers CASCADE delete on conversation_members, messages, attachments, etc.)
    await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .del();

    const io = req.app.get('io');
    if (io) {
        members.forEach(m => {
            io.to(`user_${m.user_id}`).emit('room_deleted', { room_id: Number(roomId) });
        });
    }

    res.json({
        success: true,
        message: 'Chat room and all history deleted successfully'
    });
});

// PUT update room members
export const updateRoomMembers = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const { roomId } = req.params;
    const { member_ids } = req.body;
    const orgId = req.user.org_id || 1;

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
        throw new AppError('member_ids must be a non-empty array', 400);
    }

    const room = await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    if (room.type !== 'group') {
        throw new AppError('Members can only be updated for group chats', 400);
    }

    // Verify current user membership
    const currentUserMembership = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId, user_id: userId })
        .first();

    if (!currentUserMembership || currentUserMembership.is_archived) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    // Enforce multi-tenancy guard: confirm all new member_ids belong to the same organization
    const validUsers = await attendanceDB('users')
        .where({ org_id: orgId, is_deleted: 0 })
        .whereIn('user_id', member_ids)
        .select('user_id');

    const validUserIds = validUsers.map(u => Number(u.user_id));

    // Ensure we don't accidentally drop the current user if they aren't in the list
    const uniqueMemberIds = Array.from(new Set([Number(userId), ...validUserIds]));

    // Get current members (both active and archived)
    const currentMembers = await attendanceDB('chat_conversation_members')
        .where({ org_id: orgId, conversation_id: roomId });

    const currentMemberIds = currentMembers.filter(cm => !cm.is_archived).map(cm => Number(cm.user_id));

    const addedUserIds = uniqueMemberIds.filter(id => !currentMemberIds.includes(id));
    const removedUserIds = currentMemberIds.filter(id => !uniqueMemberIds.includes(id));

    // Perform database updates inside transaction
    await attendanceDB.transaction(async (trx) => {
        // For removed users, set is_archived = true (marks them as left/removed)
        if (removedUserIds.length > 0) {
            await trx('chat_conversation_members')
                .where({ org_id: orgId, conversation_id: roomId })
                .whereIn('user_id', removedUserIds)
                .update({
                    is_archived: true,
                    updated_at: trx.fn.now()
                });
        }

        // For added users: if they already existed as archived, restore them. Otherwise insert.
        for (const addId of addedUserIds) {
            const existing = currentMembers.find(cm => Number(cm.user_id) === addId);
            if (existing) {
                await trx('chat_conversation_members')
                    .where({ org_id: orgId, conversation_id: roomId, user_id: addId })
                    .update({
                        is_archived: false,
                        joined_at: trx.fn.now(),
                        updated_at: trx.fn.now()
                    });
            } else {
                await trx('chat_conversation_members').insert({
                    org_id: orgId,
                    conversation_id: roomId,
                    user_id: addId,
                    role: 'member',
                    is_archived: false,
                    joined_at: trx.fn.now()
                });
            }
        }
    });

    // Generate WhatsApp-style system text event
    const usersInfo = await attendanceDB('users')
        .whereIn('user_id', [Number(userId), ...addedUserIds, ...removedUserIds])
        .select('user_id', 'user_name');

    const actorName = usersInfo.find(u => Number(u.user_id) === Number(userId))?.user_name || 'Someone';
    const addedNames = addedUserIds.map(id => usersInfo.find(u => Number(u.user_id) === id)?.user_name || `User #${id}`);
    const removedNames = removedUserIds.map(id => usersInfo.find(u => Number(u.user_id) === id)?.user_name || `User #${id}`);

    let updateDescription = '';
    if (removedUserIds.length === 1 && removedUserIds[0] === Number(userId)) {
        updateDescription = `${actorName} left the group`;
    } else {
        const otherRemovedNames = removedNames.filter(name => name !== actorName);
        if (addedUserIds.length > 0 && otherRemovedNames.length > 0) {
            updateDescription = `${actorName} added ${addedNames.join(', ')} and removed ${otherRemovedNames.join(', ')}`;
        } else if (addedUserIds.length > 0) {
            updateDescription = `${actorName} added ${addedNames.join(', ')}`;
        } else if (otherRemovedNames.length > 0) {
            updateDescription = `${actorName} removed ${otherRemovedNames.join(', ')}`;
        } else {
            updateDescription = `${actorName} updated group details`;
        }
    }

    // Insert system message row
    const [systemMsgId] = await attendanceDB('chat_messages').insert({
        org_id: orgId,
        conversation_id: roomId,
        sender_id: 0,
        type: 'system',
        content: encryptText(`[SYSTEM_CARD:group_update:info] ${updateDescription}`),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    await attendanceDB('chat_conversations')
        .where({ org_id: orgId, id: roomId })
        .update({
            last_message_id: systemMsgId,
            updated_at: attendanceDB.fn.now()
        });

    const enrichedMembersList = await attendanceDB('chat_conversation_members')
        .join('users', 'chat_conversation_members.user_id', 'users.user_id')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where({ 'chat_conversation_members.org_id': orgId, 'chat_conversation_members.conversation_id': roomId })
        .where('chat_conversation_members.is_archived', false)
        .select(
            'chat_conversation_members.user_id',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    const formattedSystemMsgResponse = {
        message_id: systemMsgId,
        room_id: Number(roomId),
        sender_id: 0,
        message_text: `[SYSTEM_CARD:group_update:info] ${updateDescription}`,
        attachment: null,
        created_at: new Date().toISOString(),
        user_name: 'System',
        profile_image_url: null
    };

    const io = req.app.get('io');
    if (io) {
        // Emit to the conversation room channel (includes organization namespace)
        io.to(`org_${orgId}:conversation_${roomId}`).emit('group_updated', {
            room_id: Number(roomId),
            member_ids: uniqueMemberIds,
            members: enrichedMembersList
        });
        io.to(`org_${orgId}:conversation_${roomId}`).emit('message_received', formattedSystemMsgResponse);

        // Also emit updates to personal notification channels for current/removed users
        const allAffectedUserIds = Array.from(new Set([...uniqueMemberIds, ...removedUserIds]));
        allAffectedUserIds.forEach(mId => {
            io.to(`user_${mId}`).emit('group_updated', {
                room_id: Number(roomId),
                member_ids: uniqueMemberIds,
                members: enrichedMembersList
            });
            io.to(`user_${mId}`).emit('message_received', formattedSystemMsgResponse);
        });
    }

    res.json({
        success: true,
        message: 'Group members updated successfully',
        data: {
            room_id: Number(roomId),
            member_ids: uniqueMemberIds,
            members: enrichedMembersList
        }
    });
});

