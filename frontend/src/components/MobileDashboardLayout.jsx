import React, { useState, useEffect } from 'react';
import { Menu, Bell, Moon, Sun, ArrowLeft, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileSidebar from './MobileSidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import InternalChatbotWidget from './InternalChatbotWidget';

const MobileDashboardLayout = ({ 
    children, 
    title = "Dashboard", 
    hideHeader = false, 
    headerAction, 
    showBackButton = false, 
    hideScrollbar = false,
    contentClassName
}) => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { unreadCount } = useNotification();
    const { user, avatarTimestamp } = useAuth();

    // Initialize theme from localStorage or system preference
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) return savedTheme;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const isDashboard = typeof title === 'string' && title.toLowerCase().includes('dashboard');
    const shouldHideScrollbar = hideScrollbar || isDashboard;

    useEffect(() => {
        if (shouldHideScrollbar) {
            document.documentElement.classList.add('no-scrollbar');
            document.body.classList.add('no-scrollbar');
            return () => {
                document.documentElement.classList.remove('no-scrollbar');
                document.body.classList.remove('no-scrollbar');
            };
        }
    }, [shouldHideScrollbar]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    const avatarUrl = user?.profile_image_url 
        ? `${user.profile_image_url}?t=${avatarTimestamp}`
        : null;

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-black font-poppins text-slate-900 dark:text-github-dark-text pb-6 md:pb-0 transition-colors duration-300 overflow-x-hidden ${shouldHideScrollbar ? 'no-scrollbar' : ''}`}>
            {/* Header - 56px height matching Flutter's CustomAppBar */}
            {!hideHeader && (
                <header className="fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-slate-200/80 dark:border-github-dark-border flex items-center justify-between px-3.5 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        {showBackButton ? (
                            <button
                                onClick={() => navigate(-1)}
                                className="p-1 text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                aria-label="Go Back"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-1 text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                aria-label="Open Navigation Menu"
                            >
                                <Menu size={20} strokeWidth={2.5} />
                            </button>
                        )}
                        <h1 className="text-base font-bold text-slate-800 dark:text-github-dark-text tracking-tight truncate max-w-[170px] sm:max-w-none">
                            {title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {headerAction}
                        <button
                            onClick={toggleTheme}
                            className="p-1 text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            aria-label="Toggle Theme"
                        >
                            {theme === 'dark' ? (
                                <Sun size={18} className="text-amber-400" />
                            ) : (
                                <Moon size={18} fill="currentColor" />
                            )}
                        </button>
                        <button
                            onClick={() => navigate('/collaboration')}
                            className="p-1 text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center"
                            title="Chat & Collaboration"
                            aria-label="Chat"
                        >
                            <MessageSquare size={18} />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => navigate('/notifications')}
                                className="p-1 relative text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center"
                                title="Notifications"
                                aria-label="Notifications"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-github-dark-subtle"></span>
                                )}
                            </button>
                        </div>
                        
                        {/* Profile Avatar */}
                        <button 
                            onClick={() => navigate('/profile')}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200 dark:border-github-dark-border overflow-hidden active:scale-95 transition-transform"
                            title="My Profile"
                            aria-label="Profile"
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase">
                                    {user?.user_name?.charAt(0) || 'U'}
                                </div>
                            )}
                        </button>
                    </div>
                </header>
            )}

            {/* Sidebar */}
            <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content */}
            <main className={`${hideHeader ? '' : 'pt-14'} ${contentClassName !== undefined ? contentClassName : 'pt-16 px-3.5 space-y-4 sm:space-y-6'}`}>
                {children}
            </main>
            <InternalChatbotWidget />
        </div>
    );
};

export default MobileDashboardLayout;
