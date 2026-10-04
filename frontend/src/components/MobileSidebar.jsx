import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HelpCircle,
    X,
    Bug
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
        `flex items-center px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all duration-200 group ${isActive(to)
            ? 'bg-[#f6f8fa] dark:bg-[#21262d] text-[#0969da] dark:text-[#58A6FF] shadow-sm border border-slate-200/60 dark:border-[#30363D] font-semibold'
            : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-[#21262d]/50 hover:text-slate-900 dark:hover:text-[#F0F6FC]'
        }`;

    const iconClass = (to) =>
        `mr-2.5 transition-colors shrink-0 ${isActive(to)
            ? 'text-[#0969da] dark:text-[#58A6FF]'
            : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`;

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0D1117] border-r border-slate-200 dark:border-[#30363D] transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header - matches desktop and Flutter app with iOS safe area top */}
                <div 
                    className="border-b border-slate-100 dark:border-[#30363D] shrink-0"
                    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    <div className="h-14 flex items-center justify-between px-5">
                        <div className="flex items-center gap-2.5 font-bold text-lg text-slate-800 dark:text-white tracking-tight">
                            <img src="/mano-logo.svg" alt="MANO" className="w-7 h-7 object-contain" />
                            <span className="font-poppins font-black text-indigo-600 dark:text-indigo-400">MANO</span>
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
                                    <HelpCircle size={15} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                        <button
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            onClick={onClose}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Nav - Clean prioritized list matching Flutter */}
                <nav className="flex-1 pt-2.5 pb-3 px-3 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
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

                {/* Footer - Fixed bottom item Bugs & Feedback + Version (matching Flutter sidebar) */}
                <div className="p-3 border-t border-slate-100 dark:border-[#30363D] space-y-2 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                    <Link
                        to="/feedback"
                        onClick={onClose}
                        className={`flex items-center px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                            location.pathname === '/feedback'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40'
                                : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-[#21262d] hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Bug size={16} className="mr-2.5 text-slate-400 dark:text-github-dark-muted shrink-0" />
                        <span>Bugs & Feedback</span>
                    </Link>
                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-mono">
                        v1.0.0
                    </div>
                </div>
            </aside>
        </>
    );
};

export default MobileSidebar;
