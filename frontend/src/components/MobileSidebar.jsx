import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HelpCircle,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { getNavItems } from './Sidebar';

const MobileSidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { startGlobalTour, tourEnabled } = useTour();
    const { user } = useAuth();
    const userType = user?.user_type || 'employee';

    // Handle physical back button to close sidebar
    React.useEffect(() => {
        const handlePopState = () => {
            if (isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            window.history.pushState({ sidebarOpen: true }, '');
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isOpen, onClose]);

    const navItems = getNavItems(userType);

    const isActive = (to) =>
        location.pathname === to || (to !== '/' && to !== '/dashboard' && location.pathname.startsWith(to + '/')) || (to === '/' && location.pathname === '/');

    const linkClass = (to) =>
        `flex items-center px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 group ${isActive(to)
            ? 'bg-[#f6f8fa] dark:bg-github-dark-border text-[#0969da] dark:text-github-dark-accent shadow-sm border border-slate-200/60 dark:border-github-dark-border/50 font-semibold'
            : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-github-dark-border/50 hover:text-slate-900 dark:hover:text-github-dark-text'
        }`;

    const iconClass = (to) =>
        `mr-2.5 transition-colors shrink-0 ${isActive(to)
            ? 'text-[#0969da] dark:text-github-dark-accent'
            : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`;

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-3/5 sm:w-64 bg-white dark:bg-github-dark-subtle border-r border-slate-200 dark:border-github-dark-border transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header - matches desktop exactly */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-github-dark-border shrink-0">
                    <div className="flex items-center gap-3 font-black text-xl text-[#0969da] dark:text-github-dark-accent tracking-tighter">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 object-contain" />
                        <span className="leading-none">MANO</span>
                        {tourEnabled && (
                            <button
                                onClick={() => {
                                    onClose();
                                    startGlobalTour(true);
                                }}
                                title="Start site walkthrough tour"
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/25 transition-colors ml-1 cursor-pointer"
                                aria-label="Start site walkthrough tour"
                            >
                                <HelpCircle size={16} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                    <button
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav - matches desktop directly without headings */}
                <nav className="flex-1 pt-2 pb-4 px-3 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
                    <div data-tour-id="sidebar-links" className="space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={linkClass(item.to)}
                            >
                                <span className={iconClass(item.to)}>{item.icon}</span>
                                <span className="truncate">{item.text}</span>
                            </Link>
                        ))}
                    </div>
                </nav>

                {/* Footer - matches desktop exactly */}
                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border space-y-2 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono pt-2">
                        v1.0.0
                    </div>
                </div>
            </aside>
        </>
    );
};

export default MobileSidebar;
