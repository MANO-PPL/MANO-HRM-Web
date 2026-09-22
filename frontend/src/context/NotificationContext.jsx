import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { MessageSquare, Bell, Calendar, CheckCircle2, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { requestAllPlatformPermissions, requestAndRegisterFCMToken, onForegroundMessage } from '../services/fcm';

let sharedAudioCtx = null;

// Automatically unlock AudioContext on first user interaction (click, keypress, touch)
if (typeof window !== 'undefined') {
    const unlockAudio = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                sharedAudioCtx = new AudioCtx();
            }
            if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
                sharedAudioCtx.resume();
            }
        } catch (_) {}
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
}

/**
 * Web Audio API based high-fidelity chime for real-time notifications
 */
export const playNotificationChime = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
            sharedAudioCtx = new AudioCtx();
        }
        if (sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
        }
        const ctx = sharedAudioCtx;
        const now = ctx.currentTime;

        // Tone 1: Gentle root tone (D5 - 587.33 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.09, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.32);

        // Tone 2: Harmonious chime up (A5 - 880.00 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, now + 0.08);
        gain2.gain.setValueAtTime(0.11, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.48);
    } catch (e) {
        console.warn('AudioContext notification sound error:', e);
    }
};

const MacOSNotification = ({ title, message, type, avatarUrl, relatedEntityType, onClick }) => {
    let sender = title || 'New Notification';
    let subtitle = 'Mano Portal';
    const isChat = type === 'CHAT' || type === 'CHAT_MESSAGE' || relatedEntityType === 'CHAT_MESSAGE';
    
    if (isChat) {
        subtitle = '';
        if (title && title.includes(' in ')) {
            const parts = title.split(' in ');
            sender = parts[0];
            subtitle = parts[1];
        }
    } else {
        if (title && title.includes(':')) {
            const parts = title.split(':');
            sender = parts[0];
            subtitle = parts.slice(1).join(':').trim();
        } else if (relatedEntityType) {
            subtitle = relatedEntityType.replace(/_/g, ' ');
        }
    }

    // Determine the icon to show on the left
    let iconElement = null;
    if (isChat) {
        iconElement = (
            <div className="relative">
                {avatarUrl ? (
                    <img 
                        src={avatarUrl} 
                        alt={sender} 
                        className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200/20 dark:border-white/10"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div 
                    className="chat-fallback-icon w-10 h-10 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/20 dark:border-white/10"
                    style={{ display: avatarUrl ? 'none' : 'flex' }}
                >
                    <MessageSquare size={18} className="stroke-[2.5]" />
                </div>
            </div>
        );
    } else if (type === 'SUCCESS') {
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20">
                <CheckCircle2 size={20} className="stroke-[2.5]" />
            </div>
        );
    } else if (type === 'WARNING' || type === 'ERROR') {
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-amber-500/15 dark:bg-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm border border-amber-500/20">
                <AlertTriangle size={18} className="stroke-[2.5]" />
            </div>
        );
    } else if (relatedEntityType === 'LEAVE' || relatedEntityType === 'HOLIDAY') {
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-blue-500/15 dark:bg-blue-400/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20">
                <Calendar size={18} className="stroke-[2.5]" />
            </div>
        );
    } else if (relatedEntityType === 'DAR' || relatedEntityType === 'REPORT') {
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-purple-500/15 dark:bg-purple-400/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm border border-purple-500/20">
                <FileText size={18} className="stroke-[2.5]" />
            </div>
        );
    } else {
        // System / generic notification
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-indigo-500/15 dark:bg-indigo-400/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20">
                <Bell size={18} className="stroke-[2.5]" />
            </div>
        );
    }

    return (
        <div 
            onClick={(e) => {
                if (onClick) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            className="flex items-start gap-3 w-full font-sans select-none p-3.5 rounded-2xl bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] min-h-[64px] transition-all hover:scale-[1.01] cursor-pointer"
        >
            {/* Left Side: Circular Icon */}
            <div className="flex-shrink-0 mt-0.5">
                {iconElement}
            </div>
            
            {/* Right Side: 3 Lines */}
            <div className="flex flex-col flex-1 min-w-0 text-left justify-center">
                {/* Line 1: Sender / Title */}
                <span className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight truncate">
                    {sender}
                </span>
                
                {/* Line 2: Subtitle / App / Context */}
                {subtitle && subtitle !== 'Mano Portal' && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal tracking-wide uppercase truncate mt-0.5">
                        {subtitle}
                    </span>
                )}
                
                {/* Line 3: Message Body */}
                <span className="text-[12px] text-slate-700 dark:text-slate-300 leading-snug font-normal mt-1 break-words line-clamp-2">
                    {message}
                </span>
            </div>
        </div>
    );
};

const NotificationContext = createContext({
    notifications: [],
    unreadCount: 0,
    fetchNotifications: () => {},
    markAsRead: () => {},
    markAllAsRead: () => {},
    triggerMockNotification: () => {},
    playNotificationChime: () => {},
    navigateToNotification: () => {}
});

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const toastedRef = useRef(new Set());
    const receivedSocketNotifIds = useRef(new Set());

    const handleRedirectToChat = useCallback((roomId) => {
        const targetRoomId = roomId ? String(roomId) : '';
        if (targetRoomId) {
            localStorage.setItem('lastActiveChatRoomId', targetRoomId);
        }

        try {
            toast.dismiss();
        } catch (_) {}

        if (window.location.pathname.startsWith('/collaboration')) {
            if (targetRoomId) {
                window.dispatchEvent(new CustomEvent('switch_chat_room', { detail: { roomId: targetRoomId } }));
            }
        } else {
            navigate('/collaboration');
        }
    }, [navigate]);

    const isIgnoredNotification = useCallback((title) => {
        if (!title) return false;
        const lower = title.toLowerCase();
        return (
            lower.includes('new login detected') ||
            lower.includes('attendance checked in') ||
            lower.includes('attendance checked out') ||
            lower.includes('time in reminder') ||
            lower.includes('time out reminder') ||
            lower.includes('login detected')
        );
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        
        try {
            const response = await notificationService.getAll(30, false);
            if (response.ok) {
                // Filter out any unwanted notifications and exclude chat messages from in-app bell inbox
                const cleanNotifications = (response.data || []).filter(
                    n => !isIgnoredNotification(n.title) &&
                         n.related_entity_type !== 'CHAT_MESSAGE' &&
                         n.type !== 'CHAT'
                );
                setNotifications(cleanNotifications);
                setUnreadCount(cleanNotifications.filter(n => !n.is_read).length);
            }
        } catch (error) {
            if (error.message.includes("403") || error.message.includes("Forbidden")) {
                console.warn("Notifications are not enabled for this account type.");
            } else {
                console.error("Failed to fetch notifications:", error);
            }
        }
    }, [user, isIgnoredNotification]);

    const markAsRead = useCallback(async (id) => {
        try {
            setNotifications(prev => prev.map(n => 
                n.notification_id === id ? { ...n, is_read: 1 } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
            await notificationService.markAsRead(id);
        } catch (error) {
            console.error("Failed to mark notification as read", error);
            fetchNotifications(); 
        }
    }, [fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        try {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
            await notificationService.markAllAsRead();
        } catch (error) {
            console.error("Failed to mark all notifications as read", error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const navigateToNotification = useCallback((notification) => {
        if (!notification) return;

        // If it's a real backend notification with notification_id, mark as read on server
        if (notification.notification_id && !notification.is_read) {
            markAsRead(notification.notification_id);
        }

        const entityType = String(notification.related_entity_type || '').toUpperCase();
        const typeUpper = String(notification.type || '').toUpperCase();
        const titleLower = (notification.title || '').toLowerCase();
        const messageLower = (notification.message || '').toLowerCase();
        const isEmployee = user?.user_type === 'employee';

        // Extract related entity ID (e.g. acr_id for corrections, lr_id for leaves)
        let entityId = notification.related_entity_id ? String(notification.related_entity_id) : '';
        if (!entityId) {
            const matchId = (notification.message || '').match(/#(\d+)/) || (notification.title || '').match(/#(\d+)/);
            if (matchId) entityId = matchId[1];
        }

        // 1. Attendance correction requests & status updates
        if (
            entityType === 'CORRECTION' || 
            typeUpper === 'CORRECTION' || 
            titleLower.includes('correction') || 
            messageLower.includes('correction')
        ) {
            const query = entityId ? `&requestId=${entityId}` : '';
            if (isEmployee) {
                navigate(`/attendance?tab=my_attendance&subTab=correction${query}`);
            } else {
                navigate(`/attendance-monitoring?tab=requests${query}`);
            }
            return;
        }

        // 2. Leave requests & approvals
        if (
            entityType === 'LEAVE' || 
            typeUpper === 'LEAVE' || 
            titleLower.includes('leave') || 
            messageLower.includes('leave')
        ) {
            const query = entityId ? `&requestId=${entityId}` : '';
            navigate(`/holidays?tab=leaves${query}`);
            return;
        }

        // 3. Attendance alerts (missed punch, check in/out)
        if (
            entityType === 'ATTENDANCE' || 
            typeUpper === 'ATTENDANCE' || 
            titleLower.includes('missed') || 
            titleLower.includes('punch') || 
            titleLower.includes('attendance') ||
            messageLower.includes('missed punch')
        ) {
            if (isEmployee) {
                navigate('/attendance');
            } else {
                navigate('/attendance-monitoring?tab=live');
            }
            return;
        }

        // 4. DAR (Daily Activity Report) requests & revisions
        if (
            entityType === 'DAR' || 
            typeUpper === 'DAR' || 
            titleLower.includes('dar') || 
            titleLower.includes('daily activity') ||
            messageLower.includes('daily activity')
        ) {
            const query = entityId ? `&requestId=${entityId}` : '';
            const dateMatch = notification.message?.match(/\b(\d{4}-\d{2}-\d{2})\b/);
            const dateQuery = dateMatch ? `&date=${dateMatch[1]}` : '';
            if (isEmployee) {
                navigate(`/daily-activity?tab=daily_activity${query}${dateQuery}`);
            } else {
                navigate(`/daily-activity?tab=requests${query}`);
            }
            return;
        }

        // 5. Shift assigned / modified
        if (
            entityType === 'SHIFT' || 
            typeUpper === 'SHIFT' || 
            titleLower.includes('shift') || 
            messageLower.includes('shift')
        ) {
            navigate(isEmployee ? '/attendance' : '/policies?tab=shifts');
            return;
        }

        // 6. Geofence work location assigned
        if (
            entityType === 'LOCATION' || 
            typeUpper === 'LOCATION' || 
            titleLower.includes('location') || 
            titleLower.includes('geofence') || 
            messageLower.includes('work location') ||
            messageLower.includes('geofence')
        ) {
            navigate(isEmployee ? '/attendance' : '/policies?tab=geofencing');
            return;
        }

        // 7. Policy update
        if (
            entityType === 'POLICY' || 
            typeUpper === 'POLICY' || 
            titleLower.includes('policy') || 
            messageLower.includes('policy')
        ) {
            navigate(isEmployee ? '/holidays' : '/policies?tab=leave_policies');
            return;
        }

        // 8. Holidays declared
        if (
            entityType === 'HOLIDAY' || 
            typeUpper === 'HOLIDAY' || 
            titleLower.includes('holiday') || 
            messageLower.includes('holiday')
        ) {
            navigate('/holidays?tab=holidays');
            return;
        }

        // 9. Reports
        if (
            entityType === 'REPORT' || 
            typeUpper === 'REPORT' || 
            titleLower.includes('report') || 
            messageLower.includes('report')
        ) {
            navigate('/reports');
            return;
        }

        // 10. Chat messages
        if (
            entityType === 'CHAT_MESSAGE' || 
            entityType === 'CHAT' || 
            typeUpper === 'CHAT' || 
            typeUpper === 'CHAT_MESSAGE'
        ) {
            handleRedirectToChat(notification.related_entity_id);
            return;
        }

        // Fallback for notifications page
        if (entityType === 'NOTIFICATIONS_PAGE') {
            navigate('/notifications');
            return;
        }

        // Default fallback
        if (isEmployee) {
            navigate('/attendance');
        } else {
            navigate('/dashboard');
        }
    }, [handleRedirectToChat, markAsRead, navigate, user]);

    const showNotificationToast = useCallback((notif) => {
        if (!notif || isIgnoredNotification(notif.title)) return;

        // Strictly only show web toast banners for new chat messages
        const isChat = notif.type === 'CHAT' || notif.type === 'CHAT_MESSAGE' || notif.related_entity_type === 'CHAT_MESSAGE';
        if (!isChat) return;

        const notifId = notif.notification_id || `notif_${Date.now()}_${Math.random()}`;
        const stringId = String(notifId);

        if (toastedRef.current.has(stringId)) {
            return;
        }

        const roomId = notif.related_entity_id ? String(notif.related_entity_id) : '';

        toastedRef.current.add(stringId);
        if (toastedRef.current.size > 100) {
            const firstKey = toastedRef.current.values().next().value;
            toastedRef.current.delete(firstKey);
        }

        // 1. Play crystal sound chime
        playNotificationChime();

        // If user is actively viewing this specific chat room, chime plays, no need to block their view with a popup toast
        const activeRoomId = localStorage.getItem('lastActiveChatRoomId');
        const isCurrentActiveRoom = window.location.pathname.startsWith('/collaboration') &&
                                    roomId &&
                                    roomId === String(activeRoomId) &&
                                    document.hasFocus();

        if (isCurrentActiveRoom) {
            return;
        }

        const onToastClick = () => handleRedirectToChat(roomId);

        // 2. Native OS Desktop Notification if tab is hidden / minimized
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const desktopNotif = new Notification(notif.title || 'Mano Workforce', {
                    body: notif.message || 'You have a new message',
                    icon: notif.sender_avatar || '/mano-logo.svg',
                    tag: stringId
                });
                desktopNotif.onclick = () => {
                    window.focus();
                    desktopNotif.close();
                    onToastClick();
                };
            } catch (_) {}
        }

        // 3. Modern In-App Toast Banner
        toast.info(
            <MacOSNotification 
                title={notif.title} 
                message={notif.message} 
                type={notif.type}
                avatarUrl={notif.sender_avatar}
                relatedEntityType={notif.related_entity_type}
                onClick={onToastClick}
            />,
            {
                containerId: "macOSNotifications",
                position: "top-right",
                autoClose: 4000,
                hideProgressBar: true,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                icon: false,
                className: "!bg-transparent !border-none !shadow-none !p-0 !mx-4 md:!mx-0 !my-2 cursor-pointer",
                bodyClassName: "!p-0 !m-0",
                closeButton: false,
                onClick: onToastClick
            }
        );
    }, [handleRedirectToChat, isIgnoredNotification]);

    const triggerMockNotification = useCallback((custom = {}) => {
        const mock = {
            notification_id: `mock_${Date.now()}`,
            title: custom.title || 'New Message from Jayasurya',
            message: custom.message || 'Hey! Web notifications are now active with sound and desktop banners.',
            type: custom.type || 'CHAT',
            related_entity_type: custom.related_entity_type || 'CHAT_MESSAGE',
            created_at: new Date().toISOString()
        };

        // Trigger web toast & chime preview without polluting the in-app bell inbox
        showNotificationToast(mock);
    }, [showNotificationToast]);

    const socket = useSocket();

    // Listen to real-time notifications via WebSocket connection
    useEffect(() => {
        if (user && socket) {
            const handleNewNotification = (notif) => {
                if (!notif || isIgnoredNotification(notif.title)) {
                    return;
                }

                // Chat messages are NOT saved to the in-app bell notification inbox
                const isChat = notif.type === 'CHAT' || notif.type === 'CHAT_MESSAGE' || notif.related_entity_type === 'CHAT_MESSAGE';
                if (!isChat) {
                    const notifId = notif.notification_id;
                    if (notifId) {
                        const stringId = String(notifId);
                        if (receivedSocketNotifIds.current.has(stringId)) {
                            return;
                        }
                        receivedSocketNotifIds.current.add(stringId);
                        if (receivedSocketNotifIds.current.size > 100) {
                            const firstKey = receivedSocketNotifIds.current.values().next().value;
                            receivedSocketNotifIds.current.delete(firstKey);
                        }
                    }

                    setNotifications(prev => {
                        if (prev.some(n => n.notification_id === notifId)) {
                            return prev;
                        }
                        return [notif, ...prev];
                    });
                    setUnreadCount(prev => prev + 1);

                    // Play audio chime for in-app bell alerts without showing a popup toast
                    playNotificationChime();
                    return;
                }

                // Show floating toast & play sound for chat notifications
                showNotificationToast(notif);
            };

            socket.on('new_notification', handleNewNotification);
            return () => {
                socket.off('new_notification', handleNewNotification);
            };
        }
    }, [user, socket, showNotificationToast]);

    // Prompt for all permissions immediately when the platform is opened/mounted
    useEffect(() => {
        const timer = setTimeout(() => {
            requestAllPlatformPermissions();
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // Initial fetch and FCM Registration
    useEffect(() => {
        if (user) {
            fetchNotifications();

            // Register FCM Push Token after a short delay
            const timer = setTimeout(() => {
                requestAndRegisterFCMToken();
            }, 3000);

            // Listen to foreground FCM push messages to trigger the visual banner (slower fallback)
            const unsubscribeFCM = onForegroundMessage((payload) => {
                const title = payload.notification?.title || payload.data?.title || 'New Notification';
                if (isIgnoredNotification(title)) return;

                const notifId = payload.data?.notification_id || payload.messageId || (title + payload.notification?.body);
                showNotificationToast({
                    notification_id: notifId,
                    title: title,
                    message: payload.notification?.body || payload.data?.message || '',
                    type: payload.data?.type || 'INFO',
                    avatarUrl: payload.data?.sender_avatar,
                    related_entity_type: payload.data?.related_entity_type
                });
            });

            return () => {
                clearTimeout(timer);
                if (typeof unsubscribeFCM === 'function') {
                    unsubscribeFCM();
                }
            };
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user, fetchNotifications, socket, showNotificationToast]);

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            fetchNotifications, 
            markAsRead, 
            markAllAsRead,
            triggerMockNotification,
            playNotificationChime,
            navigateToNotification
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
