import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    CheckCheck, 
    Bell, 
    Clock, 
    Calendar, 
    Info, 
    User, 
    AlertCircle,
    ChevronRight
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const Notifications = () => {
    const navigate = useNavigate();
    const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotification();
    const { avatarTimestamp } = useAuth();
    const [localNotifications, setLocalNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'

    useEffect(() => {
        if (notifications && notifications.length > 0) {
            setLocalNotifications(notifications);
        } else {
            // Mock data for visual consistency if real data is missing
            setLocalNotifications([
                {
                    id: 1,
                    title: 'Attendance Checked In',
                    message: 'You have successfully checked in at 09:45 AM from Mumbai Office.',
                    created_at: new Date().toISOString(),
                    is_read: 0,
                    type: 'attendance'
                },
                {
                    id: 2,
                    title: 'Leave Approved',
                    message: 'Your leave request for Mar 15 - Mar 18 has been approved by HR.',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    is_read: 0,
                    type: 'leave'
                },
                {
                    id: 3,
                    title: 'New Policy Update',
                    message: 'A new Work From Home policy has been published. Please review it.',
                    created_at: new Date(Date.now() - 86400000).toISOString(),
                    is_read: 1,
                    type: 'policy'
                }
            ]);
        }
    }, [notifications]);

    const filteredNotifications = activeTab === 'unread' 
        ? localNotifications.filter(n => !n.is_read)
        : localNotifications;

    const getTimeAgo = (dateString) => {
        if (!dateString) return '';
        const past = new Date(dateString);
        if (isNaN(past.getTime())) return '';
        const now = new Date();
        const diffMs = now - past;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getIcon = (type) => {
        switch (type) {
            case 'attendance': return <Clock size={16} className="text-emerald-500" />;
            case 'leave': return <Calendar size={16} className="text-indigo-500" />;
            case 'policy': return <Info size={16} className="text-amber-500" />;
            default: return <Bell size={16} className="text-slate-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black font-poppins text-slate-900 dark:text-github-dark-text transition-colors duration-300">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-black border-b border-slate-100 dark:border-slate-800 flex items-center px-4 z-40">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft size={22} />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Notifications</h1>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="p-2 -mr-2 text-indigo-600 dark:text-indigo-400 hover:opacity-80"
                        title="Mark all as read"
                    >
                        <CheckCheck size={20} />
                    </button>
                )}
            </header>
            {/* Main Content Area */}
            <main className="pt-16">
                {/* Tab Bar — Pill Style — Standardized */}
                <div className="py-3 bg-white dark:bg-black px-4 sticky top-16 z-30 transition-all duration-300 border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-300 ${
                                activeTab === 'all' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]' 
                                : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <Bell size={14} className={activeTab === 'all' ? 'text-indigo-500' : 'text-slate-400'} />
                            <span>All</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('unread')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-300 relative ${
                                activeTab === 'unread' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]' 
                                : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <div className="relative">
                                <Info size={14} className={activeTab === 'unread' ? 'text-indigo-500' : 'text-slate-400'} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800" />
                                )}
                            </div>
                            <span>Unread</span>
                            {unreadCount > 0 && activeTab !== 'unread' && (
                                <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] px-1.5 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="pb-8">
                {filteredNotifications.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-github-dark-border">
                        {filteredNotifications.map((n, index) => {
                            const nid = n.notification_id || n.id || index;
                            return (
                                <div
                                    key={nid}
                                    onClick={() => !n.is_read && markAsRead(nid)}
                                    className={`p-4 flex gap-4 transition-colors active:bg-slate-100 dark:active:bg-github-dark-border ${
                                        !n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : 'bg-white dark:bg-github-dark-bg'
                                    }`}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-github-dark-subtle border border-slate-100 dark:border-github-dark-border shadow-sm flex items-center justify-center">
                                            {getIcon(n.type)}
                                        </div>
                                        {!n.is_read && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white dark:border-github-dark-bg" />
                                        )}
                                    </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className={`text-[13px] truncate ${!n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-github-dark-text'}`}>
                                            {n.title}
                                        </h3>
                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                                            {getTimeAgo(n.created_at)}
                                        </span>
                                    </div>
                                    <p className={`text-[12px] leading-relaxed line-clamp-2 ${!n.is_read ? 'text-slate-600 dark:text-github-dark-muted' : 'text-slate-500 dark:text-github-dark-muted/80'}`}>
                                        {n.message}
                                    </p>
                                </div>
                                <div className="shrink-0 self-center">
                                    <ChevronRight size={14} className="text-slate-300 dark:text-github-dark-border" />
                                </div>
                            </div>
                        );
                    })}
                    </div>
                ) : (
                    <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-github-dark-subtle rounded-full flex items-center justify-center mb-6">
                            <Bell size={32} className="text-slate-300 dark:text-github-dark-muted" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">All caught up!</h3>
                        <p className="text-sm text-slate-500 dark:text-github-dark-muted">
                            {activeTab === 'unread' ? "You don't have any unread notifications." : "Your notifications will appear here."}
                        </p>
                        {activeTab === 'unread' && (
                            <button 
                                onClick={() => setActiveTab('all')}
                                className="mt-6 text-indigo-600 dark:text-indigo-400 font-bold text-sm"
                            >
                                View all notifications
                            </button>
                        )}
                    </div>
                )}
                </div>
            </main>
        </div>
    );
};

export default Notifications;

