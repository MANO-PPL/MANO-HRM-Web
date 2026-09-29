import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

// Only the event's owner, or admin/HR of the same org, may change an event
async function assertCanModifyEvent({ event_id, org_id, user_id, isStaff }) {
    const event = await attendanceDB("comm_events_meetings as em")
        .join("core_users as u", "u.user_id", "em.user_id")
        .where({ "em.event_id": event_id, "u.org_id": org_id })
        .first("em.user_id");
    if (!event) throw new AppError("Event not found", 404);
    if (!isStaff && Number(event.user_id) !== Number(user_id)) {
        throw new AppError("You can only change your own events", 403);
    }
}

export async function createEvent({ org_id, user_id, title, description, event_date, start_time, end_time, location, type }) {
    const [event_id] = await attendanceDB("comm_events_meetings").insert({
        user_id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        type,
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });
    return event_id;
}

export async function listEvents({ org_id, user_id, date_from, date_to, type }) {
    let query = attendanceDB("comm_events_meetings")
        .select(
            "*",
            attendanceDB.raw("DATE_FORMAT(event_date, '%Y-%m-%d') as event_date")
        )
        .where("user_id", user_id);

    if (date_from) query.where("event_date", ">=", date_from);
    if (date_to) query.where("event_date", "<=", date_to);
    if (type) query.where("type", type);

    return query.orderBy("event_date", "asc").orderBy("start_time", "asc");
}

export async function updateEvent({ event_id, org_id, user_id, isStaff, updates }) {
    await assertCanModifyEvent({ event_id, org_id, user_id, isStaff });

    delete updates.event_id;
    delete updates.org_id;
    delete updates.user_id;
    delete updates.created_at;

    updates.updated_at = attendanceDB.fn.now();

    await attendanceDB("comm_events_meetings")
        .where({ event_id })
        .update(updates);
}

export async function deleteEvent({ event_id, org_id, user_id, isStaff }) {
    await assertCanModifyEvent({ event_id, org_id, user_id, isStaff });
    await attendanceDB("comm_events_meetings")
        .where({ event_id })
        .del();
}

export async function getAllEventsAdmin({ org_id, date_from, date_to }) {
    let query = attendanceDB("comm_events_meetings as em")
        .join("core_users as u", "em.user_id", "u.user_id")
        .select(
            "em.*",
            attendanceDB.raw("DATE_FORMAT(em.event_date, '%Y-%m-%d') as event_date")
        )
        .where("u.org_id", org_id);

    if (date_from) query.where("em.event_date", ">=", date_from);
    if (date_to) query.where("em.event_date", "<=", date_to);

    return query.orderBy("em.event_date", "asc").orderBy("em.start_time", "asc");
}