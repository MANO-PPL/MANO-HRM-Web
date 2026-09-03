import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import { holidayService, parseLocalDate } from '../../services/holidayService';
import { toast } from 'react-toastify';
import {
    Calendar,
    Upload,
    Plus,
    Trash2,
    Search,
    X,
    FileText,
    Pencil,
    AlertTriangle,
    ChevronDown,
    Check,
    Users,
    Settings,
    Layers
} from 'lucide-react';
import LeaveApplication from './LeaveApplication';
import LeavePolicies from '../leaves/LeavePolicies';
import HolidaysTab from './tabs/HolidaysTab';
import AddHolidayModal from './components/AddHolidayModal';
import EditHolidayModal from './components/EditHolidayModal';
import HolidayCalendarView from '../../components/HolidayCalendarView';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from '../../components/DatePicker';

const PAGE_KEY = 'emp_holidays';

const HolidayManagement = () => {
    const navigate = useNavigate();
    const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();


    const { user } = useAuth();
    const [holidays, setHolidays] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [activeRange, setActiveRange] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'holidays';
        if (tab === 'leave_policies' || tab === 'policies') {
            return 'policies';
        }
        if (['leave_application', 'leave_balances', 'leaves'].includes(tab)) {
            return 'leaves';
        }
        return 'holidays';
    });
    const [leaveSubTab, setLeaveSubTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'leave_balances') return 'balances';
        return 'requests';
    });

    // Memoize role-aware tour steps with actions to switch tabs automatically
    const tourSteps = React.useMemo(() => {
        const isAdmin = ['admin', 'hr'].includes(user?.user_type);
        if (isAdmin) {
            return [
                {
                    targetId: 'holidays-tab-holidays',
                    title: 'Holidays List',
                    description: 'View the organization\'s public holidays. These are automatically factored into your attendance and pay.',
                    action: () => setActiveTab('holidays'),
                },
                {
                    targetId: 'holiday-admin-add',
                    title: 'Holiday Creation & Import',
                    description: 'As an administrator, you can add individual public holidays or bulk import an entire calendar year to keep scheduling accurate.',
                    action: () => setActiveTab('holidays'),
                },
                {
                    targetId: 'holidays-tab-leaves',
                    title: 'Leave Approval Center',
                    description: 'Switch to this tab to view and manage leave applications submitted by employees across the entire organization.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
                {
                    targetId: 'leave-admin-list',
                    title: 'Leave Requests Queue',
                    description: 'This queue displays all pending, approved, and rejected employee leave requests. Search by employee name or filter by request status to find specific cases.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
                {
                    targetId: 'leave-admin-details',
                    title: 'Review Details & Attachments',
                    description: 'Examine the leave type, exact start/end dates, duration, and employee reason. You can also expand the attachments section to inspect medical certificates or other supporting documents.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
                {
                    targetId: 'leave-admin-actions',
                    title: 'Decision Panel',
                    description: 'Approve or reject the request. If rejecting, you must provide feedback remarks so the employee understands the decision.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
                {
                    targetId: 'holidays-calendar-view',
                    title: 'Calendar Overview',
                    description: 'The high-level calendar highlights company holidays in purple and the selected employee\'s leave dates in blue/amber to help you check for overlap.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
            ];
        } else {
            return [
                {
                    targetId: 'holidays-tab-holidays',
                    title: 'Holidays List',
                    description: 'View the organization\'s public holidays. These are automatically factored into your attendance and pay.',
                    action: () => setActiveTab('holidays'),
                },
                {
                    targetId: 'holidays-tab-leaves',
                    title: 'Leave Application',
                    description: 'Switch to this tab to submit new leave requests or track the approval status of your past requests.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
                {
                    targetId: 'holidays-calendar-view',
                    title: 'Calendar View',
                    description: 'This mini-calendar highlights holidays in purple and your leaves in blue/amber. It gives you a quick snapshot of the month.',
                    action: () => { setActiveTab('leaves'); setLeaveSubTab('requests'); },
                },
            ];
        }
    }, [user?.user_type, setActiveTab]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            if (tab === 'leave_policies' || tab === 'policies') {
                setActiveTab('policies');
            } else if (['leave_application', 'leaves'].includes(tab)) {
                setActiveTab('leaves');
                setLeaveSubTab('requests');
            } else if (tab === 'leave_balances') {
                setActiveTab('leaves');
                setLeaveSubTab('balances');
            } else {
                setActiveTab(tab);
            }
        }
    }, [window.location.search, navigate]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mano-active-tab', {
            detail: { tab: activeTab }
        }));
    }, [activeTab]);



    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: '',
        date: '',
        type: 'Public',
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', date: '', type: 'Public' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { },
        confirmText: 'Confirm'
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch Initial Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const holidayRes = await holidayService.getHolidays();

            if (holidayRes.ok) {
                const parsedHolidays = holidayRes.holidays.map(h => ({
                    id: h.holiday_id,
                    name: h.holiday_name,
                    date: h.holiday_date,
                    type: h.holiday_type
                }));
                setHolidays(parsedHolidays);
            }
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Failed to load holidays");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                holiday_name: newHoliday.name,
                holiday_date: newHoliday.date,
                holiday_type: newHoliday.type,
                // Defaulting to "All Locations" for DB consistency, though UI ignores it
                applicable_json: ['All Locations']
            };

            await holidayService.addHoliday(payload);
            toast.success("Holiday added successfully");
            setIsAddModalOpen(false);
            setNewHoliday({ name: '', date: '', type: 'Public' });
            loadData(); // Reload list
        } catch (error) {
            console.error("Add holiday error", error);
            toast.error(error.message);
        }
    };

    const handleDeleteClick = (holiday) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Holiday?",
            message: `Are you sure you want to remove "${holiday.name}" from the schedule? This action cannot be undone.`,
            type: 'danger',
            confirmText: "Delete",
            onConfirm: async () => {
                try {
                    setIsDeleting(true);
                    await holidayService.deleteHolidays([holiday.id]);
                    toast.success("Holiday deleted successfully");
                    setHolidays(prev => prev.filter(h => h.id !== holiday.id));
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error("Delete error", error);
                    toast.error("Failed to delete holiday");
                } finally {
                    setIsDeleting(false);
                }
            }
        });
    };

    const handleEdit = (holiday) => {
        setEditingHoliday(holiday);
        setEditForm({ name: holiday.name, date: holiday.date, type: holiday.type });
        setIsEditModalOpen(true);
    };

    const handleUpdateHoliday = async (e) => {
        e.preventDefault();
        try {
            await holidayService.updateHoliday(editingHoliday.id, {
                holiday_name: editForm.name,
                holiday_date: editForm.date,
                holiday_type: editForm.type,
                applicable_json: ['All Locations']
            });
            toast.success("Holiday updated successfully");
            setIsEditModalOpen(false);
            setEditingHoliday(null);
            loadData();
        } catch (error) {
            console.error("Update holiday error", error);
            toast.error(error.message);
        }
    };

    // Filter holidays based on search term
    const filteredHolidays = holidays.filter(holiday =>
        holiday.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedLeave, setSelectedLeave] = useState(null);

    // Reset selected leave when tab changes to holidays
    useEffect(() => {
        if (activeTab === 'holidays') {
            setSelectedLeave(null);
        }
    }, [activeTab]);

    const handleSelectLeave = (leave) => {
        setSelectedLeave(leave);
        if (leave && leave.start_date) {
            const startDate = new Date(leave.start_date);
            if (startDate.getMonth() !== calendarDate.getMonth() || startDate.getFullYear() !== calendarDate.getFullYear()) {
                setCalendarDate(startDate);
            }
        }
    };

    // Derived lists based on calendar selection
    const selectedMonthHolidays = filteredHolidays.filter(h => {
        const d = new Date(h.date);
        return d.getMonth() === calendarDate.getMonth() && d.getFullYear() === calendarDate.getFullYear();
    });

    const upcomingHolidays = filteredHolidays.filter(h => {
        const d = new Date(h.date);
        const viewEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
        return d > viewEnd;
    });



    const handleTabChange = (tab) => {
        setActiveTab(tab);
        navigate(`/holidays?tab=${tab}`);
    };

    return (
        <DashboardLayout title="Holiday Management" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={tourSteps}>
            <div className="h-[calc(100vh-64px)] px-2.5 pt-2 pb-2 space-y-2 overflow-hidden flex flex-col">

                {/* Tabs */}
                <div className="flex w-fit items-center gap-1.5 p-1 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl shrink-0">
                    <button
                        onClick={() => handleTabChange('holidays')}
                        data-tour-id="holidays-tab-holidays"
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${activeTab === 'holidays'
                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                    >
                        <Calendar size={14} className={`${activeTab === 'holidays' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'} -mt-[1px]`} />
                        <span className="leading-none">Holidays List</span>
                    </button>
                    <button
                        onClick={() => { handleTabChange('leaves'); setLeaveSubTab('requests'); }}
                        data-tour-id="holidays-tab-leaves"
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${activeTab === 'leaves'
                            ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                            }`}
                    >
                        <FileText size={14} className={`${activeTab === 'leaves' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-455'} -mt-[1px]`} />
                        <span className="leading-none">{['admin', 'hr'].includes(user?.user_type) ? 'Leave Requests' : 'Leave'}</span>
                    </button>
                    {['admin', 'hr'].includes(user?.user_type) && (
                        <button
                            onClick={() => handleTabChange('policies')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer ${activeTab === 'policies'
                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] font-medium shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
                                }`}
                        >
                            <Settings size={14} className={`${activeTab === 'policies' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-450'} -mt-[1px]`} />
                            <span className="leading-none">Policies & Balances</span>
                        </button>
                    )}
                </div>

                <div className="flex flex-col xl:flex-row gap-3 flex-1 min-h-0">

                    {/* Left Content Area (Shared) */}
                    <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            {activeTab === 'holidays' && (
                                <HolidaysTab
                                    holidays={holidays}
                                    isLoading={isLoading}
                                    searchTerm={searchTerm}
                                    setSearchTerm={setSearchTerm}
                                    calendarDate={calendarDate}
                                    user={user}
                                    navigate={navigate}
                                    onOpenAddModal={() => setIsAddModalOpen(true)}
                                    onEditHoliday={handleEdit}
                                    onDeleteHoliday={handleDeleteClick}
                                />
                            )}
                            {activeTab === 'leaves' && (
                                <div className="h-full">
                                    <LeaveApplication
                                        onSelectLeave={handleSelectLeave}
                                        onLeavesChange={setLeaves}
                                        onActiveRangeChange={setActiveRange}
                                    />
                                </div>
                            )}
                            {activeTab === 'policies' && (
                                <div className="h-full overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <LeavePolicies />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Calendar Sidebar */}
                    {(activeTab === 'holidays' || (activeTab === 'leaves' && leaveSubTab === 'requests')) && (
                        <div data-tour-id="holidays-calendar-view" className="w-full xl:w-[350px] shrink-0 overflow-hidden animate-in fade-in slide-in-from-right-10 duration-500">
                            <HolidayCalendarView
                                holidays={holidays}
                                leaves={activeTab === 'leaves' ? leaves : []}
                                selectedLeave={activeTab === 'leaves' ? (selectedLeave || activeRange) : null}
                                onDelete={handleDeleteClick}
                                isAdmin={['admin', 'hr'].includes(user?.user_type)}
                                currentDate={calendarDate}
                                onDateChange={setCalendarDate}
                            />
                        </div>
                    )}
                </div>
            </div>

            <AddHolidayModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    newHoliday={newHoliday}
                    setNewHoliday={setNewHoliday}
                    onAddHoliday={handleAddHoliday}
                />

                <EditHolidayModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onUpdateHoliday={handleUpdateHoliday}
                />

                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isDeleting}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
        </DashboardLayout >
    );
};

export default HolidayManagement;
