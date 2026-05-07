import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Search, 
    Plus, 
    Filter, 
    MoreVertical, 
    Edit2, 
    Trash2, 
    UserCheck, 
    UserX, 
    RotateCcw, 
    Mail, 
    Phone, 
    Briefcase, 
    X,
    ChevronRight,
    User,
    Shield,
    Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const EmployeeDetailModal = ({ employee, onClose, onAction, avatarTimestamp }) => {
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        const handlePopState = (e) => {
            e.preventDefault();
            onClose();
            window.history.pushState(null, '', window.location.pathname);
        };
        window.history.pushState(null, '', window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [onClose]);

    if (!employee) return null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
            case 'Inactive': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
            case 'Deleted': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
            default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative bg-white dark:bg-black w-full rounded-t-[2.5rem] p-6 shadow-2xl border-t border-slate-100 dark:border-slate-800"
            >
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-8" />

                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-all"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center">
                    {/* Premium Profile Section */}
                    <div className="relative mb-6">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => employee.profile_image_url && setShowPreview(true)}
                            className={`relative w-28 h-28 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-4xl font-black border-4 border-white dark:border-slate-900 shadow-xl overflow-hidden ${employee.profile_image_url ? 'cursor-pointer group' : ''}`}
                        >
                            {employee.profile_image_url ? (
                                <>
                                    <img src={`${employee.profile_image_url}?t=${avatarTimestamp}`} alt={employee.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Eye className="text-white" size={24} />
                                    </div>
                                </>
                            ) : (
                                employee.name.charAt(0)
                            )}
                        </motion.div>
                        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-4 border-white dark:border-black ${
                            employee.status === 'Active' ? 'bg-emerald-500' : 
                            employee.status === 'Inactive' ? 'bg-amber-500' : 'bg-rose-500'
                        } shadow-lg z-10`} />
                    </div>

                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{employee.name}</h3>
                        <p className="text-[11px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-[0.2em] mt-2 flex items-center justify-center gap-2">
                            <Mail size={12} className="text-indigo-500" />
                            {employee.email}
                        </p>
                    </div>

                    {/* High-Density Info Grid */}
                    <div className="w-full grid grid-cols-2 gap-4 mb-10">
                        {[
                            { label: 'Role', value: employee.role, icon: Briefcase },
                            { label: 'Department', value: employee.department, icon: User },
                            { label: 'Phone', value: employee.phone, icon: Phone },
                            { label: 'Shift', value: employee.shift, icon: RotateCcw }
                        ].map((item, idx) => (
                            <div key={idx} className="bg-slate-50 dark:bg-white/5 p-4 rounded-3xl border border-slate-100 dark:border-white/5 transition-all active:scale-[0.98]">
                                <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                    <item.icon size={12} className="text-indigo-500" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                                </div>
                                <span className="text-sm font-black text-slate-800 dark:text-white block truncate">{item.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Premium Quick Actions */}
                    <div className="w-full flex gap-3">
                        <button
                            onClick={() => onAction('edit', employee)}
                            className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2.5"
                        >
                            <Edit2 size={16} strokeWidth={3} />
                            Edit Profile
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-github-dark-muted rounded-xl font-black text-[11px] uppercase tracking-[0.15em] active:scale-95 transition-all flex items-center justify-center gap-2.5 border border-slate-200 dark:border-white/5"
                        >
                            <X size={16} strokeWidth={3} />
                            Dismiss
                        </button>
                    </div>
                </div>

                {/* Full Screen Image Preview Portal */}
                {showPreview && createPortal(
                    <div 
                        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setShowPreview(false)}
                    >
                        <button 
                            onClick={() => setShowPreview(false)}
                            className="absolute top-6 right-6 p-3 text-white/50 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>
                        
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative w-full max-w-lg aspect-square rounded-[3rem] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img 
                                src={`${employee.profile_image_url}?t=${avatarTimestamp}`} 
                                alt={employee.name} 
                                className="w-full h-full object-cover"
                            />
                            
                            {/* Overlay Info */}
                            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                <h4 className="text-2xl font-black text-white uppercase tracking-tight">{employee.name}</h4>
                                <p className="text-white/60 text-sm font-medium">{employee.role}</p>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}
            </motion.div>
        </div>
    );
};

const MobileEmployeesPage = () => {
    const navigate = useNavigate();
    const { avatarTimestamp } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [direction, setDirection] = useState(0); // 1 for next, -1 for prev

    const tabs = ['Active', 'Inactive', 'Deleted'];
    const currentIndex = tabs.indexOf(statusFilter);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAllUsers(true);
            if (data.success) {
                const formatted = data.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    email: u.email,
                    role: u.desg_name || u.user_type,
                    user_type: u.user_type,
                    department: u.dept_name || '-',
                    status: u.is_deleted ? 'Deleted' : (u.is_active ? 'Active' : 'Inactive'),
                    phone: u.phone_no || '-',
                    shift: u.shift_name || '-',
                    profile_image_url: u.profile_image_url,
                    is_active: u.is_active,
                    is_deleted: u.is_deleted
                }));
                setEmployees(formatted);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Failed to load employees");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = (employee) => {
        if (employee.user_type === 'admin') {
            toast.info("Admin status cannot be changed here");
            return;
        }
        const newStatus = !employee.is_active;
        const action = newStatus ? "activate" : "deactivate";
        
        setConfirmModal({
            isOpen: true,
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} Employee`,
            message: `Are you sure you want to ${action} this employee?`,
            type: newStatus ? 'info' : 'warning',
            confirmText: action.charAt(0).toUpperCase() + action.slice(1),
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.toggleUserStatus(employee.id, newStatus);
                    toast.success(`User ${action}d successfully`);
                    fetchEmployees();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    toast.error(err.message || `Failed to ${action} user`);
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };

    const handleDelete = (employee) => {
        if (employee.user_type === 'admin') {
            toast.info("Admins cannot be deleted");
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: "Move to Trash",
            message: "Move this user to trash? They will be inactive until restored.",
            type: 'warning',
            confirmText: "Move to Trash",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.deleteUser(employee.id);
                    toast.success("User moved to trash");
                    fetchEmployees();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    toast.error(err.message || "Failed to delete user");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };

    const handleRestore = (employee) => {
        setConfirmModal({
            isOpen: true,
            title: "Restore Employee",
            message: "Restore this employee from trash?",
            type: 'info',
            confirmText: "Restore",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.restoreUser(employee.id);
                    toast.success("User restored");
                    fetchEmployees();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    toast.error(err.message || "Failed to restore user");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };

    const handleAction = (type, employee) => {
        if (type === 'edit') {
            navigate(`/employees/edit/${employee.id}`);
        }
        setSelectedEmployee(null);
    };

    const handleTabChange = (newStatus) => {
        const newIndex = tabs.indexOf(newStatus);
        setDirection(newIndex > currentIndex ? 1 : -1);
        setStatusFilter(newStatus);
    };

    const handleSwipe = (swipeDir) => {
        if (swipeDir === 'left' && currentIndex < tabs.length - 1) {
            setDirection(1);
            setStatusFilter(tabs[currentIndex + 1]);
        } else if (swipeDir === 'right' && currentIndex > 0) {
            setDirection(-1);
            setStatusFilter(tabs[currentIndex - 1]);
        }
    };

    const filteredEmployees = employees
        .filter(emp => {
            const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 emp.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <MobileDashboardLayout title="Employees">
            <div className="space-y-4 pb-24">
                {/* Search & Tabs Header - Sticky */}
                <div className="sticky top-16 -mx-4 px-4 py-3 bg-slate-50 dark:bg-github-dark-bg z-20 transition-all duration-300">
                    <div className="space-y-4">
                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500/5 blur-xl group-focus-within:opacity-100 opacity-0 transition-opacity rounded-2xl" />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm text-sm text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                            />
                        </div>

                        {/* Status Tabs - Pill Style - Standardized */}
                        <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5">
                            {['Active', 'Inactive', 'Deleted'].map((status) => {
                                const icons = {
                                    Active: <UserCheck size={14} />,
                                    Inactive: <UserX size={14} />,
                                    Deleted: <Trash2 size={14} />
                                };
                                return (
                                    <button
                                        key={status}
                                        onClick={() => handleTabChange(status)}
                                        className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                            statusFilter === status
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transform scale-[1.02]'
                                                : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className={statusFilter === status ? 'text-indigo-500' : 'text-slate-400'}>
                                            {icons[status]}
                                        </div>
                                        {status === 'Deleted' ? 'Trash' : status}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Employees List with Smooth Swipe & Tab Transitions */}
                <div className="relative min-h-[60vh]">
                    <AnimatePresence mode="wait" initial={false} custom={direction}>
                        <motion.div
                            key={statusFilter}
                            custom={direction}
                            variants={{
                                enter: (direction) => ({
                                    x: direction > 0 ? 50 : -50,
                                    opacity: 0,
                                    scale: 0.98
                                }),
                                center: {
                                    zIndex: 1,
                                    x: 0,
                                    opacity: 1,
                                    scale: 1
                                },
                                exit: (direction) => ({
                                    zIndex: 0,
                                    x: direction < 0 ? 50 : -50,
                                    opacity: 0,
                                    scale: 0.98,
                                    position: 'absolute',
                                    width: '100%'
                                })
                            }}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 400, damping: 35 },
                                opacity: { duration: 0.2 }
                            }}
                            className="space-y-3"
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={(e, info) => {
                                const swipeThreshold = 80;
                                if (info.offset.x < -swipeThreshold) {
                                    handleSwipe('left');
                                } else if (info.offset.x > swipeThreshold) {
                                    handleSwipe('right');
                                }
                            }}
                        >
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                    <p className="text-sm font-medium text-slate-400 animate-pulse">Fetching workforce...</p>
                                </div>
                            ) : filteredEmployees.length > 0 ? (
                                <div className="grid gap-3 pb-10">
                                    {filteredEmployees.map((employee, idx) => (
                                        <motion.div
                                            key={employee.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            onClick={() => setSelectedEmployee(employee)}
                                            className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm active:scale-[0.98] transition-all flex items-center justify-between group relative overflow-hidden"
                                        >
                                            {/* Accent Blur */}
                                            <div className="absolute -right-4 -top-4 w-12 h-12 bg-indigo-500/5 blur-2xl rounded-full" />
                                            
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="relative shrink-0">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg overflow-hidden border border-indigo-100 dark:border-indigo-500/10">
                                                        {employee.profile_image_url ? (
                                                            <img src={`${employee.profile_image_url}?t=${avatarTimestamp}`} alt={employee.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            employee.name.charAt(0)
                                                        )}
                                                    </div>
                                                    {/* Status Indicator Dot */}
                                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-github-dark-subtle ${
                                                        employee.status === 'Active' ? 'bg-emerald-500' : 
                                                        employee.status === 'Inactive' ? 'bg-amber-500' : 'bg-red-500'
                                                    }`} />
                                                </div>
                                                
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-[13px] truncate">{employee.name}</h4>
                                                        {employee.user_type === 'admin' && <Shield size={12} className="text-indigo-500 shrink-0" />}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-github-dark-muted font-medium truncate">{employee.role}</p>
                                                    <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5 uppercase tracking-wide flex items-center gap-1.5">
                                                        <Briefcase size={10} />
                                                        {employee.department}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {employee.status === 'Deleted' ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRestore(employee); }}
                                                        className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-colors"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(employee); }}
                                                            className={`p-2.5 rounded-2xl transition-colors ${
                                                                employee.is_active 
                                                                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10' 
                                                                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                                            }`}
                                                        >
                                                            {employee.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/employees/edit/${employee.id}`); }}
                                                            className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-2xl transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); employee.status === 'Deleted' ? null : handleDelete(employee); }}
                                                    className={`p-2.5 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-colors ${employee.status === 'Deleted' ? 'opacity-0' : ''}`}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-24 h-24 bg-slate-100 dark:bg-github-dark-subtle rounded-[2.5rem] flex items-center justify-center mb-6 border border-slate-200/50 dark:border-white/5">
                                        <Search size={32} className="text-slate-300 dark:text-github-dark-muted" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">No members found</h3>
                                    <p className="text-sm text-slate-500 dark:text-github-dark-muted max-w-[200px]">
                                        Try adjusting your filters or search terms.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* FAB */}
                <Link
                    to="/employees/add"
                    className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] shadow-2xl shadow-indigo-500/40 flex items-center justify-center active:scale-90 active:rotate-90 transition-all z-30 group"
                >
                    <Plus size={28} className="group-hover:scale-110 transition-transform" />
                    <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-active:opacity-100 transition-opacity" />
                </Link>

                {/* Detail Modal */}
                <AnimatePresence>
                    {selectedEmployee && (
                        <EmployeeDetailModal
                            employee={selectedEmployee}
                            onClose={() => setSelectedEmployee(null)}
                            onAction={handleAction}
                            avatarTimestamp={avatarTimestamp}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {confirmModal.isOpen && (
                        <ConfirmationModal
                            {...confirmModal}
                            isSubmitting={isSubmitting}
                            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        />
                    )}
                </AnimatePresence>
            </div>
        </MobileDashboardLayout>
    );
};

export default MobileEmployeesPage;
