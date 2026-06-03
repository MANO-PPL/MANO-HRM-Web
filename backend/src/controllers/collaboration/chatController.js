import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { handleMentions } from '../../services/collaboration/mentionService.js';
import { encryptText, decryptText } from '../../utils/encryption.js';
import { uploadFile } from '../../services/s3/s3Service.js';

// Helper to enrich a raw chat room with members info, last message, unread count, etc.
const enrichRoomDetails = async (room, userId) => {
    if (!room) return null;

    let memberIds = [];
    try {
        memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
        if (!Array.isArray(memberIds)) memberIds = [];
    } catch (e) {}

    // Fetch details of all room members
    const membersList = await attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .whereIn('users.user_id', memberIds)
        .where('users.is_deleted', 0)
        .select(
            'users.user_id',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    const cleanMembers = membersList.map(u => ({
        ...u,
        user_name: u.user_name ? u.user_name.trim() : ''
    }));

    // Check if current user is removed from this room
    let isRemoved = false;
    let removedAt = null;
    if (room.removed_members) {
        try {
            const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
            if (Array.isArray(removedMembers)) {
                const found = removedMembers.find(rm => Number(rm.user_id) === Number(userId));
                if (found) {
                    isRemoved = true;
                    removedAt = found.removed_at;
                }
            } else if (removedMembers && typeof removedMembers === 'object') {
                if (removedMembers[userId]) {
                    isRemoved = true;
                    removedAt = removedMembers[userId].removed_at;
                }
            }
        } catch (e) {}
    }

    // Get user last read timestamp
    let lastReadAt = null;
    try {
        const readTimes = typeof room.last_read_times === 'string' ? JSON.parse(room.last_read_times || '{}') : (room.last_read_times || {});
        lastReadAt = readTimes[userId] ? new Date(readTimes[userId]) : null;
    } catch (e) {}

    let msgs = [];
    try {
        const decryptedMessages = decryptText(room.messages);
        msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
    } catch (e) {}

    // Filter messages for removed user
    if (isRemoved && removedAt) {
        const cutOff = new Date(removedAt);
        msgs = msgs.filter(m => new Date(m.created_at) <= cutOff);
    }

    // Calculate unread count
    const unreadCount = isRemoved ? 0 : msgs.filter(msg => 
        Number(msg.sender_id) !== Number(userId) && 
        (!lastReadAt || new Date(msg.created_at) > lastReadAt)
    ).length;

    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

    let customRoomName = decryptText(room.room_name) || room.room_name;
    let dmAvatar = null;

    if (room.room_type === 'direct') {
        const otherMember = cleanMembers.find(m => Number(m.user_id) !== Number(userId));
        if (otherMember) {
            customRoomName = otherMember.user_name;
            dmAvatar = otherMember.profile_image_url;
        }
    }

    let lastMsgSenderName = 'Unknown Colleague';
    if (lastMsg) {
        const sender = cleanMembers.find(m => Number(m.user_id) === Number(lastMsg.sender_id));
        if (sender) {
            lastMsgSenderName = sender.user_name;
        }
    }

    return {
        ...room,
        room_name: customRoomName,
        avatar_url: dmAvatar,
        members: cleanMembers,
        is_removed: isRemoved,
        removed_at: removedAt,
        last_message: lastMsg ? {
            text: lastMsg.message_text,
            sender_id: lastMsg.sender_id,
            created_at: lastMsg.created_at,
            sender_name: lastMsgSenderName
        } : null,
        unread_count: unreadCount
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

    // Trim user names to clean up leading/trailing whitespaces
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
    const orgId = req.user.org_id;
    const isSuperAdmin = req.user.user_type === 'super_admin';

    // Fetch rooms (bypass org_id filter if super admin)
    let query = attendanceDB('chat_rooms');
    if (!isSuperAdmin && orgId !== null && orgId !== undefined) {
        query = query.where({ org_id: orgId });
    }

    // Filter at SQL database level to avoid fetching all rooms into Node memory
    query = query.where(function() {
        this.whereRaw("JSON_CONTAINS(member_ids, ?)", [String(userId)])
            .orWhereRaw("JSON_CONTAINS(member_ids, ?)", [JSON.stringify(Number(userId))])
            .orWhereRaw("JSON_CONTAINS(JSON_KEYS(COALESCE(removed_members, '{}')), ?)", [JSON.stringify(String(userId))])
            .orWhereRaw("JSON_CONTAINS(JSON_KEYS(COALESCE(removed_members, '{}')), ?)", [JSON.stringify(Number(userId))]);
    });

    const allRooms = await query;

    // Filter in memory for rooms containing current user in member_ids JSON array OR removed_members JSON
    const userRooms = allRooms.filter(room => {
        try {
            const memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
            if (Array.isArray(memberIds) && memberIds.map(Number).includes(Number(userId))) {
                return true;
            }
            if (room.removed_members) {
                const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
                if (Array.isArray(removedMembers)) {
                    return removedMembers.some(rm => Number(rm.user_id) === Number(userId));
                } else if (removedMembers && typeof removedMembers === 'object') {
                    return Object.keys(removedMembers).map(Number).includes(Number(userId));
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    });

    if (userRooms.length === 0) {
        return res.json({ success: true, data: [] });
    }

    // Get all unique user IDs across all user rooms (active members, removed members, last message senders)
    const allUserIdsToQuery = new Set();
    userRooms.forEach(room => {
        try {
            const memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
            if (Array.isArray(memberIds)) {
                memberIds.forEach(id => allUserIdsToQuery.add(Number(id)));
            }
        } catch (e) {}

        try {
            if (room.removed_members) {
                const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
                if (Array.isArray(removedMembers)) {
                    removedMembers.forEach(rm => allUserIdsToQuery.add(Number(rm.user_id)));
                } else if (removedMembers && typeof removedMembers === 'object') {
                    Object.keys(removedMembers).forEach(id => allUserIdsToQuery.add(Number(id)));
                }
            }
        } catch (e) {}

        try {
            const decryptedMessages = decryptText(room.messages);
            const msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
            if (msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.sender_id) {
                    allUserIdsToQuery.add(Number(lastMsg.sender_id));
                }
            }
        } catch (e) {}
    });

    // Fetch details of all room members & senders in a single query
    const membersList = await attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .whereIn('users.user_id', Array.from(allUserIdsToQuery))
        .where('users.is_deleted', 0)
        .select(
            'users.user_id',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    const enrichedRooms = [];

    for (const room of userRooms) {
        let roomMembers = [];
        try {
            const memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
            roomMembers = membersList.filter(m => memberIds.map(Number).includes(Number(m.user_id)));
        } catch (e) {
            // Ignore
        }

        // Check if current user is removed from this room
        let isRemoved = false;
        let removedAt = null;
        if (room.removed_members) {
            try {
                const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
                if (Array.isArray(removedMembers)) {
                    const found = removedMembers.find(rm => Number(rm.user_id) === Number(userId));
                    if (found) {
                        isRemoved = true;
                        removedAt = found.removed_at;
                    }
                } else if (removedMembers && typeof removedMembers === 'object') {
                    if (removedMembers[userId]) {
                        isRemoved = true;
                        removedAt = removedMembers[userId].removed_at;
                    }
                }
            } catch (e) {}
        }

        // Get user last read timestamp
        let lastReadAt = null;
        try {
            const readTimes = typeof room.last_read_times === 'string' ? JSON.parse(room.last_read_times || '{}') : (room.last_read_times || {});
            lastReadAt = readTimes[userId] ? new Date(readTimes[userId]) : null;
        } catch (e) {
            // Ignore
        }

        // Retrieve messages JSON array
        let msgs = [];
        try {
            const decryptedMessages = decryptText(room.messages);
            msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
        } catch (e) {
            // Ignore
        }

        // Filter messages for removed user
        if (isRemoved && removedAt) {
            const cutOff = new Date(removedAt);
            msgs = msgs.filter(m => new Date(m.created_at) <= cutOff);
        }

        // Calculate unread count
        const unreadCount = isRemoved ? 0 : msgs.filter(msg => 
            Number(msg.sender_id) !== Number(userId) && 
            (!lastReadAt || new Date(msg.created_at) > lastReadAt)
        ).length;

        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

        let customRoomName = decryptText(room.room_name);
        let dmAvatar = null;

        if (room.room_type === 'direct') {
            const otherMember = roomMembers.find(m => Number(m.user_id) !== Number(userId));
            if (otherMember) {
                customRoomName = otherMember.user_name;
                dmAvatar = otherMember.profile_image_url;
            }
        }

        // Last message sender name resolution
        let lastMsgSenderName = 'Unknown Colleague';
        if (lastMsg) {
            const sender = membersList.find(m => Number(m.user_id) === Number(lastMsg.sender_id));
            if (sender) {
                lastMsgSenderName = sender.user_name;
            }
        }

        enrichedRooms.push({
            ...room,
            room_name: customRoomName,
            avatar_url: dmAvatar,
            members: roomMembers,
            is_removed: isRemoved,
            removed_at: removedAt,
            last_message: lastMsg ? {
                text: lastMsg.message_text,
                sender_id: lastMsg.sender_id,
                created_at: lastMsg.created_at,
                sender_name: lastMsgSenderName
            } : null,
            unread_count: unreadCount
        });
    }

    // Sort rooms by last message timestamp (or creation timestamp if empty)
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
    const orgId = req.user.org_id;
    const { room_type = 'direct', room_name, member_ids = [] } = req.body;

    const allMemberIds = Array.from(new Set([userId, ...member_ids])).map(Number);

    // Resolve room's orgId dynamically (required if creator is super admin and has null orgId)
    let finalOrgId = orgId;
    if (!finalOrgId) {
        const otherMembers = allMemberIds.filter(id => Number(id) !== Number(userId));
        if (otherMembers.length > 0) {
            const memberUser = await attendanceDB('users')
                .whereIn('user_id', otherMembers)
                .whereNotNull('org_id')
                .select('org_id')
                .first();
            if (memberUser) {
                finalOrgId = memberUser.org_id;
            }
        }
    }
    if (!finalOrgId) {
        finalOrgId = 1; // Fallback default
    }

    if (room_type === 'direct') {
        if (allMemberIds.length !== 2) {
            throw new AppError('Direct messaging rooms must have exactly 2 members', 400);
        }

        const targetMemberId = allMemberIds.find(id => id !== userId);

        // Check if DM room already exists between these 2 users
        const allRooms = await attendanceDB('chat_rooms')
            .where({ room_type: 'direct', org_id: finalOrgId });

        const existingDM = allRooms.find(room => {
            try {
                const ids = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
                return Array.isArray(ids) && 
                       ids.map(Number).includes(Number(userId)) && 
                       ids.map(Number).includes(Number(targetMemberId));
            } catch (e) {
                return false;
            }
        });

        if (existingDM) {
            existingDM.room_name = decryptText(existingDM.room_name);
            try {
                const decryptedMessages = decryptText(existingDM.messages);
                existingDM.messages = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
            } catch (e) {
                existingDM.messages = [];
            }
            
            const enrichedDM = await enrichRoomDetails(existingDM, userId);
            
            return res.json({
                success: true,
                message: 'DM room already exists',
                data: enrichedDM
            });
        }
    }

    const [roomId] = await attendanceDB('chat_rooms').insert({
        org_id: finalOrgId,
        room_name: room_type === 'group' ? encryptText(room_name || 'Group Chat') : null,
        room_type,
        created_by: userId,
        member_ids: JSON.stringify(allMemberIds),
        messages: encryptText(JSON.stringify([])),
        last_read_times: JSON.stringify({}),
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });

    let newRoom = await attendanceDB('chat_rooms').where({ room_id: roomId }).first();

    if (newRoom) {
        newRoom.room_name = decryptText(newRoom.room_name);
        try {
            const decryptedMessages = decryptText(newRoom.messages);
            newRoom.messages = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
        } catch (e) {
            newRoom.messages = [];
        }
    }

    const enrichedRoom = await enrichRoomDetails(newRoom, userId);

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
    const { roomId } = req.params;

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    let memberIds = [];
    try {
        memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
    } catch (e) {
        // Ignore
    }

    // Check if user is removed
    let isRemoved = false;
    let removedAt = null;
    if (room.removed_members) {
        try {
            const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
            if (Array.isArray(removedMembers)) {
                const found = removedMembers.find(rm => Number(rm.user_id) === Number(userId));
                if (found) {
                    isRemoved = true;
                    removedAt = found.removed_at;
                }
            } else if (removedMembers && typeof removedMembers === 'object') {
                if (removedMembers[userId]) {
                    isRemoved = true;
                    removedAt = removedMembers[userId].removed_at;
                }
            }
        } catch (e) {}
    }

    if (!isRemoved && (!Array.isArray(memberIds) || !memberIds.map(Number).includes(Number(userId)))) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    let msgs = [];
    try {
        const decryptedMessages = decryptText(room.messages);
        msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
    } catch (e) {
        // Ignore
    }

    // Filter messages for removed user
    if (isRemoved && removedAt) {
        const cutOffTime = new Date(removedAt);
        msgs = msgs.filter(msg => new Date(msg.created_at) <= cutOffTime);
    }

    // Resolve sender profiles for all senders in filtered messages
    const senderIds = msgs.map(m => Number(m.sender_id)).filter(id => id > 0);
    const allQueryIds = Array.from(new Set([...memberIds.map(Number), ...senderIds]));

    const members = await attendanceDB('users')
        .whereIn('user_id', allQueryIds)
        .select('user_id', 'user_name', 'profile_image_url');

    const enrichedMessages = msgs.map(msg => {
        const sender = members.find(m => Number(m.user_id) === Number(msg.sender_id));
        return {
            message_id: msg.message_id,
            room_id: Number(roomId),
            sender_id: Number(msg.sender_id),
            message_text: msg.message_text,
            attachment: msg.attachment || null,
            created_at: msg.created_at,
            user_name: sender ? sender.user_name : 'Unknown Colleague',
            profile_image_url: sender ? sender.profile_image_url : null
        };
    });

    res.json({
        success: true,
        data: enrichedMessages
    });
});

// POST message
export const sendMessage = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const orgId = req.user.org_id;
    const { roomId } = req.params;
    const { message_text, attachment } = req.body;

    if ((!message_text || message_text.trim() === '') && !attachment) {
        throw new AppError('Message body or attachment is required', 400);
    }

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    let memberIds = [];
    try {
        memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
    } catch (e) {
        // Ignore
    }

    // Check if user is removed
    let isRemoved = false;
    if (room.removed_members) {
        try {
            const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
            if (Array.isArray(removedMembers)) {
                isRemoved = removedMembers.some(rm => Number(rm.user_id) === Number(userId));
            } else if (removedMembers && typeof removedMembers === 'object') {
                isRemoved = Object.keys(removedMembers).map(Number).includes(Number(userId));
            }
        } catch (e) {}
    }

    if (isRemoved) {
        throw new AppError('You cannot send messages to this group because you have been removed', 403);
    }

    if (!Array.isArray(memberIds) || !memberIds.map(Number).includes(Number(userId))) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    let msgs = [];
    try {
        const decryptedMessages = decryptText(room.messages);
        msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
    } catch (e) {
        // Ignore
    }

    const messageId = Date.now();
    const newMsg = {
        message_id: messageId,
        sender_id: Number(userId),
        message_text: message_text ? message_text.trim() : '',
        attachment: attachment || null,
        created_at: new Date().toISOString()
    };

    const updatedMessages = [...msgs, newMsg];
    await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .update({
            messages: encryptText(JSON.stringify(updatedMessages)),
            updated_at: attendanceDB.fn.now()
        });

    const sender = await attendanceDB('users')
        .where({ user_id: userId })
        .select('user_name', 'profile_image_url')
        .first();

    const formattedResponseMsg = {
        message_id: messageId,
        room_id: Number(roomId),
        sender_id: Number(userId),
        message_text: newMsg.message_text,
        attachment: newMsg.attachment,
        created_at: newMsg.created_at,
        user_name: sender ? sender.user_name : 'Unknown Colleague',
        profile_image_url: sender ? sender.profile_image_url : null
    };

    const io = req.app.get('io');
    if (io) {
        io.to(`room_${roomId}`).emit('message_received', formattedResponseMsg);
        if (Array.isArray(memberIds)) {
            memberIds.forEach(mId => {
                if (Number(mId) !== Number(userId)) {
                    io.to(`user_${mId}`).emit('message_received', formattedResponseMsg);
                }
            });
        }
    }

    if (message_text) {
        await handleMentions({
            org_id: room.org_id,
            sender_id: userId,
            text: message_text,
            context_type: 'chat_message',
            context_id: messageId,
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

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    let memberIds = [];
    try {
        memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
    } catch (e) {
        // Ignore
    }

    // Check if user is removed
    let isRemoved = false;
    if (room.removed_members) {
        try {
            const removedMembers = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
            if (Array.isArray(removedMembers)) {
                isRemoved = removedMembers.some(rm => Number(rm.user_id) === Number(userId));
            } else if (removedMembers && typeof removedMembers === 'object') {
                isRemoved = Object.keys(removedMembers).map(Number).includes(Number(userId));
            }
        } catch (e) {}
    }

    if (isRemoved) {
        throw new AppError('You cannot upload attachments to this group because you have been removed', 403);
    }

    if (!Array.isArray(memberIds) || !memberIds.map(Number).includes(Number(userId))) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    const timestamp = Date.now();
    const directory = `chat-attachments/org_${orgId}/room_${roomId}`;
    const filename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${timestamp}_${filename}`;

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

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    let readTimes = {};
    try {
        readTimes = typeof room.last_read_times === 'string' ? JSON.parse(room.last_read_times || '{}') : (room.last_read_times || {});
    } catch (e) {
        // Ignore
    }

    readTimes[userId] = new Date().toISOString();

    await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .update({
            last_read_times: JSON.stringify(readTimes)
        });

    res.json({
        success: true,
        message: 'Room messages marked as read'
    });
});

// DELETE chat room (deletes single row from database)
export const deleteRoom = catchAsync(async (req, res, next) => {
    const userId = req.user.user_id ?? req.user.id;
    const { roomId } = req.params;

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    let memberIds = [];
    try {
        memberIds = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
    } catch (e) {
        // Ignore
    }

    if (!Array.isArray(memberIds) || !memberIds.map(Number).includes(Number(userId))) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    // Delete the single chat_rooms row
    await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .del();

    const io = req.app.get('io');
    if (io && Array.isArray(memberIds)) {
        memberIds.forEach(mId => {
            io.to(`user_${mId}`).emit('room_deleted', { room_id: Number(roomId) });
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

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
        throw new AppError('member_ids must be a non-empty array', 400);
    }

    const room = await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .first();

    if (!room) {
        throw new AppError('Chat room not found', 404);
    }

    if (room.room_type !== 'group') {
        throw new AppError('Members can only be updated for group chats', 400);
    }

    let currentMembers = [];
    try {
        currentMembers = typeof room.member_ids === 'string' ? JSON.parse(room.member_ids) : room.member_ids;
    } catch (e) {}

    if (!Array.isArray(currentMembers) || !currentMembers.map(Number).includes(Number(userId))) {
        throw new AppError('You are not a member of this chat room', 403);
    }

    const uniqueMemberIds = Array.from(new Set(member_ids.map(Number)));

    // Compute changes for WhatsApp-style updates
    const currentMemberIds = currentMembers.map(Number);
    const addedUserIds = uniqueMemberIds.filter(id => !currentMemberIds.includes(id));
    const removedUserIds = currentMemberIds.filter(id => !uniqueMemberIds.includes(id));

    // Update removed_members in DB
    let removedMembersMap = {};
    if (room.removed_members) {
        try {
            removedMembersMap = typeof room.removed_members === 'string' ? JSON.parse(room.removed_members) : room.removed_members;
            if (Array.isArray(removedMembersMap)) {
                const temp = {};
                removedMembersMap.forEach(rm => {
                    temp[rm.user_id] = { removed_at: rm.removed_at };
                });
                removedMembersMap = temp;
            }
        } catch (e) {
            removedMembersMap = {};
        }
    }

    const nowStr = new Date().toISOString();
    removedUserIds.forEach(id => {
        removedMembersMap[id] = { removed_at: nowStr };
    });

    addedUserIds.forEach(id => {
        delete removedMembersMap[id];
    });

    await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .update({
            member_ids: JSON.stringify(uniqueMemberIds),
            removed_members: JSON.stringify(removedMembersMap),
            updated_at: attendanceDB.fn.now()
        });

    const userIdsToQuery = Array.from(new Set([Number(userId), ...addedUserIds, ...removedUserIds]));
    const usersInfo = await attendanceDB('users')
        .whereIn('user_id', userIdsToQuery)
        .select('user_id', 'user_name');

    const actorName = usersInfo.find(u => Number(u.user_id) === Number(userId))?.user_name || 'Someone';
    const addedNames = addedUserIds.map(id => usersInfo.find(u => Number(u.user_id) === id)?.user_name || `User #${id}`);
    const removedNames = removedUserIds.map(id => usersInfo.find(u => Number(u.user_id) === id)?.user_name || `User #${id}`);

    let updateDescription = '';
    if (removedUserIds.length === 1 && removedUserIds[0] === Number(userId)) {
        updateDescription = `${actorName} left the group`;
    } else {
        const otherRemovedNames = removedNames.filter(name => name !== actorName);
        if (addedNames.length > 0 && otherRemovedNames.length > 0) {
            updateDescription = `${actorName} added ${addedNames.join(', ')} and removed ${otherRemovedNames.join(', ')}`;
        } else if (addedNames.length > 0) {
            updateDescription = `${actorName} added ${addedNames.join(', ')}`;
        } else if (otherRemovedNames.length > 0) {
            updateDescription = `${actorName} removed ${otherRemovedNames.join(', ')}`;
        } else if (removedUserIds.includes(Number(userId))) {
            updateDescription = `${actorName} left the group`;
        } else {
            updateDescription = `${actorName} updated group details`;
        }
    }

    let msgs = [];
    try {
        const decryptedMessages = decryptText(room.messages);
        msgs = typeof decryptedMessages === 'string' ? JSON.parse(decryptedMessages || '[]') : (decryptedMessages || []);
    } catch (e) {}

    const messageId = Date.now();
    const systemMsg = {
        message_id: messageId,
        sender_id: 0,
        message_text: `[SYSTEM_CARD:group_update:info] ${updateDescription}`,
        created_at: new Date().toISOString()
    };

    const updatedMessages = [...msgs, systemMsg];
    await attendanceDB('chat_rooms')
        .where({ room_id: roomId })
        .update({
            messages: encryptText(JSON.stringify(updatedMessages))
        });

    const enrichedMembersList = await attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .whereIn('users.user_id', uniqueMemberIds)
        .where('users.is_deleted', 0)
        .select(
            'users.user_id',
            'users.user_name',
            'users.profile_image_url',
            'users.email',
            'departments.dept_name',
            'designations.desg_name'
        );

    const formattedSystemMsgResponse = {
        message_id: messageId,
        room_id: Number(roomId),
        sender_id: 0,
        message_text: systemMsg.message_text,
        attachment: null,
        created_at: systemMsg.created_at,
        user_name: 'System',
        profile_image_url: null
    };

    const io = req.app.get('io');
    if (io) {
        // Emit to the active room channel
        io.to(`room_${roomId}`).emit('group_updated', {
            room_id: Number(roomId),
            member_ids: uniqueMemberIds,
            members: enrichedMembersList
        });
        io.to(`room_${roomId}`).emit('message_received', formattedSystemMsgResponse);

        // Also emit to personal channels of all current and removed members to force real-time updates
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
