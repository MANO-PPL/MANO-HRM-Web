import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { MessageSquare } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { requestAllPlatformPermissions, requestAndRegisterFCMToken, onForegroundMessage } from '../services/fcm';

const MacOSNotification = ({ title, message, type, avatarUrl, relatedEntityType }) => {
    // If it's a chat notification, let's parse sender and subtitle
    let sender = title || 'New Notification';
    let subtitle = 'Mano Portal'; // default
    const isChat = type === 'CHAT' || type === 'CHAT_MESSAGE' || relatedEntityType === 'CHAT_MESSAGE';
    
    if (isChat) {
        subtitle = '';
        if (title && title.includes(' in ')) {
            const parts = title.split(' in ');
            sender = parts[0];
        }
    } else {
        // For other notifications, e.g. system alerts, request approvals etc.
        if (title && title.includes(':')) {
            const parts = title.split(':');
            sender = parts[0];
            subtitle = parts.slice(1).join(':').trim();
        }
    }

    // Determine the icon to show on the left
    let iconElement = null;
    if (isChat) {
        iconElement = (
            <div className="relative">
                {avatarUrl && (
                    <img 
                        src={avatarUrl} 
                        alt={sender} 
                        className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200/20 dark:border-white/10"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                )}
                <div 
                    className="chat-fallback-icon w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-400/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/20 dark:border-white/10"
                    style={{ display: avatarUrl ? 'none' : 'flex' }}
                >
                    <MessageSquare size={18} className="stroke-[2.5]" />
                </div>
            </div>
        );
    } else {
        // System / generic notifications: show Mano logo
        iconElement = (
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 dark:bg-indigo-400/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20 dark:border-white/10">
                <img 
                    src="/mano-logo.svg" 
                    alt="Mano" 
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                    }}
                />
                <span className="hidden text-[10px] font-bold">M</span>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 w-full font-sans select-none p-3 rounded-2xl bg-white/[0.04] dark:bg-black/[0.1] backdrop-blur-2xl border border-slate-200/20 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] min-h-[64px] transition-all">
            {/* Left Side: Circular Icon */}
            <div className="flex-shrink-0">
                {iconElement}
            </div>
            
            {/* Right Side: 3 Lines */}
            <div className="flex flex-col flex-1 min-w-0 text-left justify-center py-0.5">
                {/* Line 1: Sender / Title */}
                <span className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight truncate">
                    {sender}
                </span>
                
                {/* Line 2: Subtitle / App / Context */}
                {subtitle && subtitle !== 'Mano Portal' && !isChat && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal tracking-wide uppercase truncate mt-0.5">
                        {subtitle}
                    </span>
                )}
                
                {/* Line 3: Message Body */}
                <span className="text-[12px] text-slate-700 dark:text-slate-350 leading-snug font-medium mt-1 break-words">
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
    markAllAsRead: () => {}
});

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const toastedRef = useRef(new Set());
    const receivedSocketNotifIds = useRef(new Set());

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        
        try {
            // Fetch unread notifications + some history
            const response = await notificationService.getAll(20, false);
            if (response.ok) {
                setNotifications(response.data);
                setUnreadCount(response.unread_count);
            }
        } catch (error) {
            // If 403 Forbidden, it means the user isn't authorized for notifications (e.g., certain admin roles)
            if (error.message.includes("403") || error.message.includes("Forbidden")) {
                console.warn("Notifications are not enabled for this account type.");
            } else {
                console.error("Failed to fetch notifications:", error);
            }
        }
    }, [user]);

    const markAsRead = async (id) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => 
                n.notification_id === id ? { ...n, is_read: 1 } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await notificationService.markAsRead(id);
        } catch (error) {
            console.error("Failed to mark notification as read", error);
            // Revert on error would be ideal, but simple logging for now
            fetchNotifications(); 
        }
    };

    const markAllAsRead = async () => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);

            await notificationService.markAllAsRead();
        } catch (error) {
            console.error("Failed to mark all notifications as read", error);
            fetchNotifications();
        }
    };

    const socket = useSocket();

    // Listen to real-time notifications via WebSocket connection
    useEffect(() => {
        if (user && socket) {
            const handleNewNotification = (notif) => {
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

                // Show toast banner immediately for chat notifications
                const isChat = notif.type === 'CHAT' || notif.type === 'CHAT_MESSAGE' || notif.related_entity_type === 'CHAT_MESSAGE';
                if (isChat && notifId) {
                    const stringId = String(notifId);
                    toastedRef.current.add(stringId);
                    if (toastedRef.current.size > 100) {
                        const firstKey = toastedRef.current.values().next().value;
                        toastedRef.current.delete(firstKey);
                    }

                    toast.info(
                        <MacOSNotification 
                            title={notif.title} 
                            message={notif.message} 
                            type={notif.type}
                            avatarUrl={notif.sender_avatar}
                            relatedEntityType={notif.related_entity_type}
                        />,
                        {
                            containerId: "macOSNotifications",
                            position: "top-right",
                            autoClose: 3000,
                            hideProgressBar: true,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            icon: false,
                            className: "!bg-transparent !border-none !shadow-none !p-0 !mx-4 md:!mx-0 !my-2",
                            bodyClassName: "!p-0 !m-0",
                            closeButton: false,
                        }
                    );
                }
            };

            socket.on('new_notification', handleNewNotification);
            socket.on('new-notification', handleNewNotification);
            return () => {
                socket.off('new_notification', handleNewNotification);
                socket.off('new-notification', handleNewNotification);
            };
        }
    }, [user, socket]);

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
                const notifId = payload.data?.notification_id || payload.messageId || (payload.notification?.title + payload.notification?.body);
                const notifType = payload.data?.type;
                const relatedEntityType = payload.data?.related_entity_type;
                const isChat = notifType === 'CHAT' || notifType === 'CHAT_MESSAGE' || relatedEntityType === 'CHAT_MESSAGE';

                if (isChat) {
                    if (notifId) {
                        const stringId = String(notifId);
                        if (toastedRef.current.has(stringId)) {
                            return;
                        }
                        toastedRef.current.add(stringId);
                        if (toastedRef.current.size > 100) {
                            const firstKey = toastedRef.current.values().next().value;
                            toastedRef.current.delete(firstKey);
                        }
                    }

                    toast.info(
                        <MacOSNotification 
                            title={payload.notification?.title || 'New Notification'} 
                            message={payload.notification?.body || ''} 
                            type={payload.data?.type}
                            avatarUrl={payload.data?.sender_avatar}
                            relatedEntityType={payload.data?.related_entity_type}
                        />,
                        {
                            containerId: "macOSNotifications",
                            position: "top-right",
                            autoClose: 3000,
                            hideProgressBar: true,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            icon: false,
                            className: "!bg-transparent !border-none !shadow-none !p-0 !mx-4 md:!mx-0 !my-2",
                            bodyClassName: "!p-0 !m-0",
                            closeButton: false,
                        }
                    );
                }
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
    }, [user, fetchNotifications, socket]);

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            fetchNotifications, 
            markAsRead, 
            markAllAsRead 
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
