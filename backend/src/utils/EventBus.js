import { EventEmitter } from 'events';
import { attendanceDB } from '../config/database.js';
import { safeTruncate } from './dateUtils.js';

class AppEventBus extends EventEmitter {
    constructor() {
        super();
        this.events = {
            NOTIFICATION: 'notification',
            ACTIVITY_LOG: 'activity_log',
            USER_CREATED: 'user_created',
            ATTENDANCE_LOGGED: 'attendance_logged',
            ERROR_LOG: 'error_log',
            API_REQUEST_LOG: 'api_request_log'
        };

        // Listen for API request logs and save to Database
        this.on(this.events.API_REQUEST_LOG, async (payload) => {
            try {
                const logData = {
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    request_path: safeTruncate(payload.request_path || '/', 255),
                    route_pattern: safeTruncate(payload.route_pattern, 255),
                    method: safeTruncate(payload.method || 'GET', 10),
                    status_code: Number(payload.status_code) || 200,
                    duration_ms: Number(payload.duration_ms) || 0,
                    is_success: payload.is_success ? 1 : 0,
                    event_source: safeTruncate(payload.event_source || 'API', 50),
                    module_name: safeTruncate(payload.module_name || 'General', 50),
                    client_os: safeTruncate(payload.client_os, 50),
                    client_type: safeTruncate(payload.client_type, 50),
                    device_type: safeTruncate(payload.device_type, 50),
                    request_ip: safeTruncate(payload.request_ip, 45),
                    user_agent: safeTruncate(payload.user_agent, 255),
                    payload_details: payload.payload_details ? (typeof payload.payload_details === 'object' ? JSON.stringify(payload.payload_details) : String(payload.payload_details)) : null,
                    occurred_at: attendanceDB.fn.now()
                };
                await attendanceDB('sys_api_logs').insert(logData);
            } catch (err) {
                console.error('[EventBus DB API Request Log Error]:', err);
            }
        });

        // Listen for activity logs and save to Database
        this.on(this.events.ACTIVITY_LOG, async (payload) => {
            try {
                const logData = {
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    event_type: safeTruncate(payload.event_type || 'ACTIVITY', 50),
                    event_source: safeTruncate(payload.event_source || 'API', 50),
                    object_type: safeTruncate(payload.object_type, 50),
                    object_id: payload.object_id || null,
                    request_ip: safeTruncate(payload.request_ip, 45),
                    user_agent: safeTruncate(payload.user_agent, 255),
                    location: safeTruncate(payload.location, 255),
                    description: safeTruncate(payload.description || '', 255),
                    metadata: payload.metadata ? (typeof payload.metadata === 'object' ? JSON.stringify(payload.metadata) : String(payload.metadata)) : null,
                    occurred_at: attendanceDB.fn.now()
                };
                await attendanceDB('sys_activity_logs').insert(logData);
            } catch (err) {
                console.error('[EventBus DB Activity Log Error]:', err);
            }
        });

        // Listen for error logs and save to Database
        this.on(this.events.ERROR_LOG, async (payload) => {
            try {
                const logData = {
                    level: safeTruncate(payload.level || 'ERROR', 20),
                    service_name: safeTruncate(payload.service_name || 'backend-api', 50),
                    environment: safeTruncate(payload.environment || process.env.NODE_ENV || 'production', 30),
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    error_code: safeTruncate(payload.error_code, 50),
                    error_message: safeTruncate(payload.error_message || '', 245),
                    stack_trace: payload.stack_trace || null,
                    request_method: safeTruncate(payload.request_method, 10),
                    request_path: safeTruncate(payload.request_path, 255),
                    request_id: safeTruncate(payload.request_id, 100),
                    client_ip: safeTruncate(payload.client_ip, 45),
                    extra_context: payload.extra_context ? (typeof payload.extra_context === 'object' ? JSON.stringify(payload.extra_context) : String(payload.extra_context)) : null,
                    occurred_at: attendanceDB.fn.now()
                };
                await attendanceDB('sys_error_logs').insert(logData);
            } catch (err) {
                console.error('[EventBus DB Error Log Error]:', err);
            }
        });

        // Listen for notifications and save to Database, then emit 'notification_saved' for Socket.IO
        this.on(this.events.NOTIFICATION, async (payload) => {
            try {
                let dbType = payload.type || 'INFO';
                if (dbType === 'CHAT' || dbType === 'CHAT_MESSAGE') {
                    dbType = 'INFO';
                }
                const notificationData = {
                    user_id: payload.user_id,
                    title: payload.title || '',
                    message: payload.message || '',
                    type: dbType,
                    related_entity_type: payload.related_entity_type || null,
                    related_entity_id: payload.related_entity_id || null,
                    is_read: 0,
                    created_at: attendanceDB.fn.now()
                };
                const [insertedId] = await attendanceDB('comm_notifications').insert(notificationData);
                
                // Fetch the fully inserted database row to get exact timestamps and auto-generated fields
                const savedNotification = await attendanceDB('comm_notifications')
                    .where({ notification_id: insertedId })
                    .first();

                if (savedNotification) {
                    this.emit('notification_saved', savedNotification);
                }
            } catch (err) {
                console.error('[EventBus DB Notification Error]:', err);
            }
        });
    }

    emitNotification(payload) {
        this.emit(this.events.NOTIFICATION, payload);
    }

    emitActivityLog(payload) {
        this.emit(this.events.ACTIVITY_LOG, payload);
    }

    emitApiRequest(payload) {
        this.emit(this.events.API_REQUEST_LOG, payload);
    }

    emitError(payload) {
        this.emit(this.events.ERROR_LOG, payload);
    }
}

const EventBus = new AppEventBus();
export default EventBus;
