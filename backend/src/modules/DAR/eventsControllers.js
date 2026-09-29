import catchAsync from '../../utils/catchAsync.js';
import * as DarEventService from './eventsServices.js';
import { handleMentions } from '../collaboration/mentionService.js';

export const createEvent = catchAsync(async (req, res) => {
    const { title, description, event_date, start_time, end_time, location, type } = req.body;
    const { org_id, user_id } = req.user;

    // Required by comm_events_meetings; missing values used to surface as a 500
    // (MySQL ENUMs match case-insensitively, so 'Meeting' is accepted as before)
    if (!title || !event_date || !start_time || !end_time || !['EVENT', 'MEETING'].includes(String(type || '').toUpperCase())) {
        return res.status(400).json({ ok: false, message: "title, event_date, start_time, end_time and type (EVENT or MEETING) are required" });
    }

    const event_id = await DarEventService.createEvent({
        org_id, user_id, title, description,
        event_date, // Trust frontend YYYY-MM-DD, avoid timezone shifts from re-parsing
        start_time, end_time, location, type
    });

    const io = req.app.get('io');
    if (description && (type === 'MEETING' || type === 'EVENT')) {
        await handleMentions({
            org_id,
            sender_id: user_id,
            text: description,
            context_type: 'dar_meeting',
            context_id: event_id,
            io
        });
    }

    res.json({ ok: true, message: "Created successfully", event_id });
});

export const listEvents = catchAsync(async (req, res) => {
    const { date_from, date_to, type } = req.query;
    const { org_id, user_id } = req.user;

    const data = await DarEventService.listEvents({ org_id, user_id, date_from, date_to, type });
    res.json({ ok: true, data });
});

export const updateEvent = catchAsync(async (req, res) => {
    const event_id = req.params.id;
    const { org_id, user_id } = req.user;
    const updates = { ...req.body };

    const isStaff = ['admin', 'hr'].includes(req.user.user_type);
    await DarEventService.updateEvent({ event_id, org_id, user_id, isStaff, updates });

    const io = req.app.get('io');
    if (updates.description && (updates.type === 'MEETING' || updates.type === 'EVENT')) {
        await handleMentions({
            org_id,
            sender_id: user_id,
            text: updates.description,
            context_type: 'dar_meeting',
            context_id: event_id,
            io
        });
    }

    res.json({ ok: true, message: "Updated successfully" });
});

export const deleteEvent = catchAsync(async (req, res) => {
    const event_id = req.params.id;
    const { org_id, user_id } = req.user;
    const isStaff = ['admin', 'hr'].includes(req.user.user_type);

    await DarEventService.deleteEvent({ event_id, org_id, user_id, isStaff });
    res.json({ ok: true, message: "Deleted successfully" });
});

export const getAllEventsAdmin = catchAsync(async (req, res) => {
    const { org_id, user_type } = req.user;

    if (user_type !== 'admin' && user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: 'Access denied. Admins or HR only.' });
    }

    const { date_from, date_to } = req.query;
    const data = await DarEventService.getAllEventsAdmin({ org_id, date_from, date_to });

    res.json({ ok: true, data });
});