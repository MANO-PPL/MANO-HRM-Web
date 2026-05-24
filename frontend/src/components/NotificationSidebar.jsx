import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    X, 
    Clock, 
    AlertTriangle, 
    Info, 
    CheckCircle, 
    XCircle,
    Check
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationSidebar = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
    const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'

    const filteredNotifications = activeTab === 'unread' 
        ? notifications.filter(n => !n.is_read)
        : notifications;

    const getIcon = (type) => {
        switch (type) {
            case 'WARNING': return <AlertTriangle size={18} className="text-amber-500" />;
            case 'SUCCESS': return <CheckCircle size={18} className="text-emerald-500" />;
            case 'ERROR': return <XCircle size={18} className="text-red-500" />;
            case 'INFO':
            default: return <Info size={18} className="text-blue-500" />;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                    />
                    
                    {/* Sidebar */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-dark-card shadow-2xl z-[101] flex flex-col border-l border-slate-100 dark:border-github-dark-border"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <Bell size={20} />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Notifications</h2>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="px-6 py-4">
                            <div className="bg-slate-100 dark:bg-github-dark-subtle/50 p-1 flex rounded-xl">
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                                        activeTab === 'all' 
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Bell size={14} className={activeTab === 'all' ? 'text-indigo-500' : 'text-slate-400'} />
                                    <span>All Notifications</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('unread')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all relative ${
                                        activeTab === 'unread' 
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Info size={14} className={activeTab === 'unread' ? 'text-indigo-500' : 'text-slate-400'} />
                                    <span>Unread</span>
                                    {unreadCount > 0 && (
                                        <span className="ml-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Mark all as read */}
                        {unreadCount > 0 && (
                            <div className="px-6 pb-2">
                                <button 
                                    onClick={markAllAsRead}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all border border-indigo-100 dark:border-indigo-500/20"
                                >
                                    <Check size={14} />
                                    Mark all as read
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="flex-1 overflow-y-auto px-2 no-scrollbar">
                            {filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <Bell size={24} className="text-slate-300" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">All caught up!</h3>
                                    <p className="text-xs text-slate-400">No {activeTab === 'unread' ? 'unread' : ''} notifications at the moment.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-github-dark-border/50">
                                    {filteredNotifications.map((notification) => (
                                        <div 
                                            key={notification.notification_id}
                                            className={`p-4 hover:bg-slate-50 dark:hover:bg-indigo-500/5 transition-all cursor-pointer rounded-xl my-1 group relative ${notification.is_read ? 'opacity-60' : 'bg-indigo-50/20 dark:bg-indigo-500/5'}`}
                                            onClick={() => !notification.is_read && markAsRead(notification.notification_id)}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`mt-1 p-2 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 border border-white dark:border-github-dark-border shadow-sm ${
                                                    notification.type === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/10' :
                                                    notification.type === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-900/10' :
                                                    notification.type === 'ERROR' ? 'bg-red-50 dark:bg-red-900/10' :
                                                    'bg-indigo-50 dark:bg-indigo-900/10'
                                                }`}>
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className={`text-sm truncate ${notification.is_read ? 'font-medium text-slate-600 dark:text-slate-400' : 'font-bold text-slate-900 dark:text-white'}`}>
                                                            {notification.title}
                                                        </p>
                                                        {!notification.is_read && (
                                                            <div className="h-2 w-2 bg-indigo-500 rounded-full shrink-0"></div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-github-dark-muted line-clamp-2 leading-relaxed">
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">
                                                        <Clock size={10} />
                                                        <span>{formatTime(notification.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NotificationSidebar;
