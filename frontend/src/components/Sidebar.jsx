import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    TrendingUp,
    Calendar,
    CalendarDays,
    X,
    Clock,
    CreditCard,
    ClipboardList,
    Bug,
    Building,
    ShieldAlert,
    Shield,
    MessageSquare,
    Code,
    Hammer,
    HelpCircle,
    Terminal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import FeedbackModal from './FeedbackModal';

const SidebarItem = ({ icon, text, to }) => {
    const location = useLocation();
    const active = to ? (location.pathname === to || (to !== '/' && to !== '/dashboard' && location.pathname.startsWith(to + '/'))) : false;
    const isActive = active || (to === '/' && location.pathname === '/');

    const content = (
        <>
            <span className={`mr-2.5 transition-colors duration-200 shrink-0 ${isActive ? 'text-[#0969da] dark:text-github-dark-accent' : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                {icon}
            </span>
            <span className="truncate">{text}</span>
        </>
    );

    const className = `flex items-center px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 group ${isActive
        ? 'bg-[#f6f8fa] dark:bg-github-dark-border text-[#0969da] dark:text-github-dark-accent shadow-sm border border-slate-200/60 dark:border-github-dark-border/50 font-semibold'
        : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-github-dark-border/50 hover:text-slate-900 dark:hover:text-github-dark-text'
        }`;

    if (to) {
        return (
            <Link to={to} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <a href="#" className={className}>
            {content}
        </a>
    );
};

export const getNavItems = (userType) => {
    if (userType === 'super_admin') {
        return [
            { icon: <LayoutDashboard size={18} />, text: "Dashboard", to: "/dashboard" },
            { icon: <Building size={18} />, text: "Organizations", to: "/organizations" },
            { icon: <ShieldAlert size={18} />, text: "Security Alerts", to: "/super-admin/alerts" },
            { icon: <TrendingUp size={18} />, text: "API Analytics", to: "/super-admin/api-analytics" },
            { icon: <Code size={18} />, text: "System Logs", to: "/super-admin/logs" },
            { icon: <Terminal size={18} />, text: "Debug Console", to: "/super-admin/debug" },
            { icon: <MessageSquare size={18} />, text: "User Feedback", to: "/super-admin/feedback" },
        ];
    }

    if (userType === 'employee') {
        return [
            { icon: <LayoutDashboard size={18} />, text: "Dashboard", to: "/dashboard" },
            { icon: <Calendar size={18} />, text: "Attendance", to: "/attendance" },
            { icon: <CalendarDays size={18} />, text: "Holidays & Leaves", to: "/holidays" },
            { icon: <ClipboardList size={18} />, text: "Daily Activity Report", to: "/daily-activity" },
        ];
    }

    // Default for 'admin' and 'hr' - direct prioritized list without headings
    return [
        { icon: <LayoutDashboard size={18} />, text: "Dashboard", to: "/dashboard" },
        { icon: <Clock size={18} />, text: "Live Attendance", to: "/attendance-monitoring" },
        { icon: <Users size={18} />, text: "Employees", to: "/employees" },
        { icon: <Calendar size={18} />, text: "Attendance", to: "/attendance" },
        { icon: <CalendarDays size={18} />, text: "Holidays & Leaves", to: "/holidays" },
        { icon: <ClipboardList size={18} />, text: "Daily Activity Report", to: "/daily-activity" },
        { icon: <Hammer size={18} />, text: "Labour Management", to: "/labour-management" },
        { icon: <CreditCard size={18} />, text: "Payroll", to: "/payroll" },
        { icon: <TrendingUp size={18} />, text: "Reports", to: "/reports" },
        { icon: <Shield size={18} />, text: "Policies", to: "/policies" },
    ];
};

export const getNavSections = (userType) => [
    { label: null, items: getNavItems(userType) }
];

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const { user } = useAuth();
    const { startGlobalTour, tourEnabled } = useTour();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    // Default to 'employee' if user_type is not available yet
    const userType = user?.user_type || 'employee';

    const navItems = getNavItems(userType);

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-github-dark-subtle border-r border-slate-200 dark:border-github-dark-border transform transition-transform duration-300 ease-in-out md:translate-x-0 md:fixed md:top-0 md:h-screen md:flex md:flex-col shadow-xl md:shadow-sm shrink-0
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-github-dark-border shrink-0">
                    <div className="flex items-center gap-3 font-black text-xl text-[#0969da] dark:text-github-dark-accent tracking-tighter">
                        <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 object-contain" />
                        <span className="leading-none">MANO</span>
                        {tourEnabled && (
                            <button
                                onClick={() => startGlobalTour(true)}
                                title="Start site walkthrough tour"
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/25 transition-colors ml-1 cursor-pointer"
                                aria-label="Start site walkthrough tour"
                            >
                                <HelpCircle size={16} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                    <button
                        className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 pt-2 pb-4 px-3 overflow-y-auto no-scrollbar">
                    <div data-tour-id="sidebar-links" className="space-y-1">
                        {navItems.map((item) => (
                            <SidebarItem key={item.to} icon={item.icon} text={item.text} to={item.to} />
                        ))}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border space-y-2 shrink-0">
                    <button
                        onClick={() => setIsFeedbackOpen(true)}
                        data-tour-id="sidebar-bugs-feedback"
                        className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-slate-600 dark:text-github-dark-muted bg-slate-50 dark:bg-github-dark-border/30 hover:bg-slate-100 dark:hover:bg-github-dark-border hover:text-indigo-600 dark:hover:text-github-dark-accent rounded-lg transition-all cursor-pointer"
                    >
                        <Bug size={18} />
                        Bugs & Feedback
                    </button>

                    <div className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono pt-1">
                        v1.0.0
                    </div>
                </div>
            </aside>

            <FeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
            />
        </>
    );
};

export default Sidebar;
