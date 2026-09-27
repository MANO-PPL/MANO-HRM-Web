import { initNotificationDelivery } from '../modules/notifications/fcmService.js';
import { onShutdown } from '../lifecycle/shutdown.js';

/**
 * Registers the EventBus subscribers that need the Socket.IO server:
 * - notification_saved → socket push (web) + FCM push (mobile)
 *
 * The persistence listeners (API/activity/error logs, notification inserts)
 * are registered by utils/EventBus.js itself.
 */
export function initEventSubscribers({ io }) {
    const stopNotificationDelivery = initNotificationDelivery(io);
    onShutdown('event subscribers', stopNotificationDelivery, 'producers');
}
