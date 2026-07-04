import { EventEmitter } from 'events';
import { attendanceDB } from '../config/database.js';

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
                    request_path: payload.request_path || '/',
                    route_pattern: payload.route_pattern || null,
                    method: payload.method || 'GET',
                    status_code: Number(payload.status_code) || 200,
                    duration_ms: Number(payload.duration_ms) || 0,
                    is_success: payload.is_success ? 1 : 0,
                    event_source: payload.event_source || 'API',
                    module_name: payload.module_name || 'General',
                    client_os: payload.client_os || null,
                    client_type: payload.client_type || null,
                    device_type: payload.device_type || null,
                    request_ip: payload.request_ip || null,
                    user_agent: payload.user_agent ? (payload.user_agent.length > 255 ? payload.user_agent.substring(0, 255) : payload.user_agent) : null,
                    payload_details: payload.payload_details ? (typeof payload.payload_details === 'object' ? JSON.stringify(payload.payload_details) : payload.payload_details) : null,
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
                    event_type: payload.event_type || 'ACTIVITY',
                    event_source: payload.event_source || 'API',
                    object_type: payload.object_type || null,
                    object_id: payload.object_id || null,
                    request_ip: payload.request_ip || null,
                    user_agent: payload.user_agent || null,
                    location: payload.location || null,
                    description: payload.description || '',
                    metadata: payload.metadata ? (typeof payload.metadata === 'object' ? JSON.stringify(payload.metadata) : payload.metadata) : null,
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
                    level: payload.level || 'ERROR',
                    service_name: payload.service_name || 'backend-api',
                    environment: payload.environment || process.env.NODE_ENV || 'production',
                    user_id: payload.user_id || null,
                    org_id: payload.org_id || null,
                    error_code: payload.error_code || null,
                    error_message: payload.error_message || '',
                    stack_trace: payload.stack_trace || null,
                    request_method: payload.request_method || null,
                    request_path: payload.request_path || null,
                    request_id: payload.request_id || null,
                    client_ip: payload.client_ip || null,
                    extra_context: payload.extra_context ? (typeof payload.extra_context === 'object' ? JSON.stringify(payload.extra_context) : payload.extra_context) : null,
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
                    org_id: payload.org_id || null,
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
