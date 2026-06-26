import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    Search, 
    ChevronDown, 
    ChevronRight, 
    BookOpen, 
    Sparkles, 
    Clock, 
    ShieldAlert, 
    Building, 
    Code, 
    Users, 
    User, 
    TrendingUp, 
    Settings, 
    MapPin, 
    ClipboardList, 
    Calendar, 
    Briefcase, 
    FileText, 
    CreditCard, 
    MessageSquare, 
    ClipboardCheck, 
    LayoutDashboard, 
    HelpCircle, 
    Info, 
    X,
    Laptop,
    CheckCircle2
} from 'lucide-react';
import api from '../../services/api';

// Helper component to map routes to matching Lucide Icons
const getModuleIcon = (route) => {
    switch (route) {
        case '/dashboard':
            return <LayoutDashboard className="w-4 h-4" />;
        case '/attendance':
            return <Clock className="w-4 h-4" />;
        case '/holidays':
            return <Calendar className="w-4 h-4" />;
        case '/apply-leave':
            return <FileText className="w-4 h-4" />;
        case '/daily-activity':
            return <ClipboardList className="w-4 h-4" />;
        case '/attendance-monitoring':
            return <Laptop className="w-4 h-4" />;
        case '/geofencing':
            return <MapPin className="w-4 h-4" />;
        case '/shift-management':
            return <Settings className="w-4 h-4" />;
        case '/reports':
            return <TrendingUp className="w-4 h-4" />;
        case '/profile':
            return <User className="w-4 h-4" />;
        case '/employees':
            return <Users className="w-4 h-4" />;
        case '/organizations':
            return <Building className="w-4 h-4" />;
        case '/super-admin/alerts':
            return <ShieldAlert className="w-4 h-4" />;
        case '/super-admin/logs':
            return <Code className="w-4 h-4" />;
        case '/recruitment':
            return <Briefcase className="w-4 h-4" />;
        case '/documents':
            return <FileText className="w-4 h-4" />;
        case '/subscription':
            return <CreditCard className="w-4 h-4" />;
        case '/collaboration':
            return <MessageSquare className="w-4 h-4" />;
        case '/employee-master':
            return <ClipboardCheck className="w-4 h-4" />;
        default:
            return <BookOpen className="w-4 h-4" />;
    }
};

// Step-by-step checklists for all modules
const moduleSteps = {
    '/dashboard': [
        'Log in to the MANO platform using your authorized department credentials.',
        'View live statistical cards showing organization attendance summary (Present, Absent, Late, On Leave).',
        'Review the Live Active Feed ticker to monitor employee check-ins and system logs as they happen in real time.',
        'Utilize the Quick Actions panel in the header to execute core features like adding employees, scheduling shifts, or exporting reports.'
    ],
    '/attendance': [
        'Navigate to the Attendance module and select Clock In or Clock Out.',
        'Grant GPS location and webcam permissions when prompted by your web browser.',
        'Align your face inside the webcam frame for facial scan recognition.',
        'Submit punch. The system records your GPS coordinates, IP, and webcam picture to cross-check compliance.',
        'To submit corrections for missed punches: click Apply Correction, choose Add Session or Full Day Reset, select a date, input timestamps, input a reason, and submit for Admin approval.'
    ],
    '/holidays': [
        'Navigate to Holidays and Leave to inspect active personal balances (Casual, Sick, Earned Leave).',
        'Review the company calendar listing upcoming regional public holidays.',
        'To submit a new leave application: click Apply Leave, select the leave category, set dates, add an explanation, and click Submit.',
        'HR and managers will audit the leave request to approve or reject the days from your balance.'
    ],
    '/apply-leave': [
        'Click the Apply Leave action or navigate to the form direct route.',
        'Select the target leave category: Casual Leave, Sick Leave, or Earned Leave.',
        'Configure the calendar date range (Start Date and End Date).',
        'Provide a descriptive reason for the leave to support manager audits, then click Submit.'
    ],
    '/daily-activity': [
        'Open the Daily Activity page at the end of your shift.',
        'Click Add Task or Add Meeting to log your work sessions.',
        'Fill in the Project Name, duration spent in hours, and a clear description of the tasks completed.',
        'Save the logs. The page displays daily metrics and flags gaps relative to standard work hours.',
        'Admins can run the AI DAR insights panel to automatically synthesize weekly activity themes and flag vague logs.'
    ],
    '/attendance-monitoring': [
        'Access the Live Monitoring Command Center (Admins/HR only).',
        'Review the active count of currently clocked-in personnel.',
        'View the geographical map showing GPS check-in logs plotted as interactive compliance indicators.',
        'Filter active records by department or check for geofence compliance alerts.'
    ],
    '/geofencing': [
        'Go to Geofencing Management and click Add Location.',
        'Use the search bar to find an address, or click directly on the Google Map to lock the coordinates.',
        'Configure the zone radius in meters (e.g. 50m, 100m) around the center coordinate.',
        'Toggle Strict Location Locking compliance rules to specify if check-ins outside the zone are blocked.',
        'Save the location to assign it as a compliance rule for shift attendance.'
    ],
    '/shift-management': [
        'Access Shift Management and click Create Shift.',
        'Name the shift and configure the standard Check-In and Check-Out times.',
        'Set the Grace Period in minutes (e.g., 10 minutes) during which check-ins are not flagged late.',
        'Configure the Late Mark threshold to assign automatic half-day leave penalties or warnings.',
        'Assign shift schedules to employees in the roster panel.'
    ],
    '/reports': [
        'Open the Reports & Analytics dashboard.',
        'Select a report category: Monthly Attendance Matrix, Lateness Summary, Overtime Roster, or Daily Activity logs.',
        'Select the target date range and filter by department or employee list.',
        'Click Generate to preview the matrix grid, then click Export to download as Microsoft Excel (.xlsx) or PDF.'
    ],
    '/profile': [
        'Navigate to User Profile and click your avatar picture to upload a new profile image.',
        'Inspect system-assigned parameters such as designation, department, and role access privileges.',
        'To update credentials: click Change Password, provide your existing password, write a new secure code, and click Save.'
    ],
    '/employees': [
        'Access the Employees directory list.',
        'Click Add Employee to add a single employee: enter their name, designation, department, email, and choose their role.',
        'To bulk onboard: click Bulk Upload, download the sample template, fill in employee rows, and drag & drop the completed Excel sheet to upload.'
    ],
    '/organizations': [
        'Open the Organizations Directory (Super Admin only).',
        'Review the list of corporate client tenants on the platform.',
        'Click Edit to modify organization settings or suspend/activate subscriptions and client database allocations.'
    ],
    '/super-admin/alerts': [
        'Go to the Security Alerts tracker (Super Admin only).',
        'Review the active feed listing failed login notifications, password locks, and potential geofence bypass attempts.',
        'Trace alerts by IP address and timestamp to resolve security violations.'
    ],
    '/super-admin/logs': [
        'Navigate to the System Logs Console.',
        'Select a process or log file (e.g. PM2 API logs, background workers).',
        'Filter logs by date range or key search queries to inspect stack traces and troubleshoot system issues.'
    ],
    '/recruitment': [
        'Access the Careers & Recruitment dashboard.',
        'Click Create Opening, specify job details, or use the AI Job Description Generator to auto-fill description templates.',
        'Publish the job to generate a public application link.',
        'Review applicant CV uploads. The AI Candidate Auditor ranks profiles out of 100 based on experience, skills, and fit.'
    ],
    '/documents': [
        'Access the HR Document Studio dashboard.',
        'Select a corporate template: Offer Letter, Appraisal Letter, Relieving Certificate, or Policy Document.',
        'Use Quick Populate to fetch employee profile data (designation, CTC) directly from the directory.',
        'Inspect the automatically generated salary breakdown (Basic, HRA, PF, Special Allowance) and click Print or PDF to output.'
    ],
    '/subscription': [
        'Go to Subscription Billing.',
        'Slide the slider to select your required number of employee seats (1 to 1000+).',
        'Toggle between Monthly and Annual billing cycles (annual billing includes a 20% discount).',
        'Click Purchase and finalize secure transactions via Razorpay.'
    ],
    '/collaboration': [
        'Open the Chat & Collaboration sidebar.',
        'Start a direct message thread by selecting a teammate, or create a group room.',
        'Share documents, send messages, use @mentions to notify teammates, or click the Pin button to bookmark active rooms to the top of your sidebar.'
    ],
    '/employee-master': [
        'Go to Employee Master and Onboarding checklist dashboard.',
        'Review checklists for new hires (e.g. laptop provisioning, training, ID card setup).',
        'Manage official document storage folders: Identity, Educational, Banking, Compliance, and Employment.',
        'Upload scans and click AI Document Auditor to automatically scan for name mismatches and check document validity.'
    ]
};

// Beautiful Apple Support Style Callout Box
const Callout = ({ type = 'note', title, children }) => {
    const configs = {
        note: {
            bg: 'bg-blue-50/60 dark:bg-blue-950/20',
            border: 'border-blue-200 dark:border-blue-900/60',
            text: 'text-blue-800 dark:text-blue-300',
            titleText: 'text-blue-900 dark:text-blue-200',
            icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        },
        tip: {
            bg: 'bg-amber-50/60 dark:bg-amber-950/20',
            border: 'border-amber-200 dark:border-amber-900/60',
            text: 'text-amber-800 dark:text-amber-300',
            titleText: 'text-amber-900 dark:text-amber-200',
            icon: <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        },
        important: {
            bg: 'bg-rose-50/60 dark:bg-rose-950/20',
            border: 'border-rose-200 dark:border-rose-900/60',
            text: 'text-rose-800 dark:text-rose-300',
            titleText: 'text-rose-900 dark:text-rose-200',
            icon: <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
        }
    };

    const config = configs[type] || configs.note;

    return (
        <div className={`flex gap-3.5 p-4 rounded-xl border ${config.bg} ${config.border} ${config.text} text-sm transition-all duration-200 leading-relaxed shadow-sm`}>
            {config.icon}
            <div>
                {title && <h5 className={`font-semibold mb-1 ${config.titleText}`}>{title}</h5>}
                <div className="font-normal">{children}</div>
            </div>
        </div>
    );
};

export default function Documentation() {
    const [guides, setGuides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Navigation and filtering states
    const [activeModule, setActiveModule] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all'); // all, employee, admin_hr, super_admin
    const [expandedFaqs, setExpandedFaqs] = useState({});
    const [activeTab, setActiveTab] = useState('general'); // general, employee, admin_hr, super_admin

    // Popular search options to query instantly
    const popularSearches = [
        'DAR', 'Geofencing', 'Grace Period', 'Leave Balance', 'AI Audit', 'Shift settings'
    ];

    // Fetch guides on mount
    useEffect(() => {
        const fetchGuides = async () => {
            try {
                const res = await api.get('/website-chatbot/guide');
                if (res.data?.ok && Array.isArray(res.data?.data)) {
                    setGuides(res.data.data);
                    if (res.data.data.length > 0) {
                        setActiveModule(res.data.data[0]);
                    }
                } else {
                    throw new Error('Malformed server response');
                }
            } catch (err) {
                console.error('Failed to fetch guide details:', err);
                setError(err.message || 'Unable to fetch user manual data');
            } finally {
                setLoading(false);
            }
        };

        fetchGuides();
    }, []);

    // Scroll to top of window when active module changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setExpandedFaqs({});
        setActiveTab('general');
    }, [activeModule]);

    // Handle FAQ toggling
    const toggleFaq = (index) => {
        setExpandedFaqs(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Filter guides based on search query and role selection
    const filteredGuides = guides.filter(g => {
        // Search filter
        const matchesSearch = searchQuery === '' || 
            g.moduleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (g.roleDetails && Object.values(g.roleDetails).some(detail => detail.toLowerCase().includes(searchQuery.toLowerCase()))) ||
            (g.faqs && g.faqs.some(faq => faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase())));

        // Role filter
        let matchesRole = true;
        if (selectedRoleFilter === 'employee') {
            matchesRole = g.roles.includes('employee');
        } else if (selectedRoleFilter === 'admin_hr') {
            matchesRole = g.roles.includes('admin') || g.roles.includes('hr');
        } else if (selectedRoleFilter === 'super_admin') {
            matchesRole = g.roles.includes('super_admin');
        }

        return matchesSearch && matchesRole;
    });

    // Handle suggestion clicks
    const handleSearchClick = (keyword) => {
        setSearchQuery(keyword);
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchQuery('');
    };

    // Auto-select first matching guide if current activeModule isn't in filtered list
    useEffect(() => {
        if (filteredGuides.length > 0 && (!activeModule || !filteredGuides.some(g => g.route === activeModule.route))) {
            setActiveModule(filteredGuides[0]);
        }
    }, [searchQuery, selectedRoleFilter, filteredGuides, activeModule]);

    // Render roles tags
    const renderRoleBadge = (role) => {
        const styles = {
            employee: 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-900/40',
            hr: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40',
            admin: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40',
            super_admin: 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40'
        };

        const displayNames = {
            employee: 'Employee',
            hr: 'HR Manager',
            admin: 'Administrator',
            super_admin: 'Super Admin'
        };

        return (
            <span key={role} className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[role] || 'bg-slate-100 text-slate-700'}`}>
                {displayNames[role] || role}
            </span>
        );
    };

    // Render warning boxes or special tips based on module selection
    const getModuleSpecificCallout = (route) => {
        switch (route) {
            case '/geofencing':
                return (
                    <Callout type="important" title="Strict Location Compliance">
                        If <strong>Strict Location Locking</strong> is enabled, clock-ins/outs submitted from outside your assigned geofenced coordinates will be blocked by the system. Ensure device location permissions are allowed on Chrome, Safari, or mobile apps.
                    </Callout>
                );
            case '/shift-management':
                return (
                    <Callout type="tip" title="Grace Period vs. Deductions">
                        Configure a grace period (e.g., 10 minutes) so users logging in slightly late are not marked late. Set the Late Mark Threshold to trigger automatic half-day leaves or point-based penalizations for repeated late clock-ins.
                    </Callout>
                );
            case '/attendance':
                return (
                    <Callout type="note" title="Attendance Correction Options">
                        Use <strong>Add Session</strong> for logging micro work-blocks (e.g. splitting standard daily tasks). Use <strong>Full Day Reset</strong> if you missed punching entirely and want to set a single block for the whole day. Correction requests always require Admin approval.
                    </Callout>
                );
            case '/daily-activity':
                return (
                    <Callout type="tip" title="AI Productivity Audits">
                        The platform includes AI-synthesized activity summaries. Avoid entering vague summaries (like &quot;worked on project&quot; or &quot;coding&quot;), as the automated AI auditor flags low-detail activities and rates logs on completeness.
                    </Callout>
                );
            case '/employee-master':
                return (
                    <Callout type="note" title="AI Document Auditor">
                        When employees upload credentials, the AI Auditor runs background compliance verification (checks name discrepancies on passports/Aadhaars and highlights soon-to-expire documents). Ensure clear scans are uploaded.
                    </Callout>
                );
            case '/collaboration':
                return (
                    <Callout type="note" title="Group Archival & History Access">
                        When a member is removed from a group room, they lose access to future communications but retain read-only permission for historical messages posted up to the exact timestamp of their removal.
                    </Callout>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-github-dark-bg text-slate-500 dark:text-github-dark-muted font-poppins">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium animate-pulse">Loading Platform Documentation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-github-dark-bg px-4 text-center font-poppins">
                <div className="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-github-dark-text mb-2">Failed to load manual</h3>
                <p className="text-sm text-slate-500 dark:text-github-dark-muted max-w-md mb-6">{error}</p>
                <Link 
                    to="/dashboard"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
                >
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    // Get current module steps
    const activeRouteSteps = activeModule ? moduleSteps[activeModule.route] : [];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg font-poppins text-slate-900 dark:text-github-dark-text transition-colors duration-300 flex flex-col">
            
            {/* Main Content Layout Container - Extended to span full edge-to-edge page width */}
            <main className="flex-grow w-full px-6 sm:px-12 py-8 flex flex-col gap-6">
                
                {/* Search Panel Box */}
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all duration-300">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-100/30 dark:bg-indigo-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-3xl">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-github-dark-text mb-2 font-poppins">
                            MANO Support Guide
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-github-dark-muted mb-6 max-w-xl">
                            Search how to configure shifts, register leaves, review geofence tracking, audit documents, or request attendance corrections on the platform.
                        </p>

                        {/* Search Input Bar */}
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-github-dark-muted w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search guide, features, roles, or FAQs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-github-dark-bg text-slate-800 dark:text-github-dark-text placeholder-slate-400 border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent text-sm transition-all shadow-inner"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={handleClearSearch}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Role filter dropdown */}
                            <select
                                value={selectedRoleFilter}
                                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                                className="px-4 py-3 bg-slate-50 dark:bg-github-dark-bg text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                            >
                                <option value="all">Filter: All Modules</option>
                                <option value="employee">Filter: Employee Modules</option>
                                <option value="admin_hr">Filter: HR & Admin Modules</option>
                                <option value="super_admin">Filter: Super Admin Modules</option>
                            </select>
                        </div>

                        {/* Quick suggestions */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium font-mono uppercase mr-1">Popular:</span>
                            {popularSearches.map((term) => (
                                <button
                                    key={term}
                                    onClick={() => handleSearchClick(term)}
                                    className="text-xs px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-github-dark-bg/60 dark:hover:bg-github-dark-border text-slate-600 dark:text-github-dark-muted hover:text-slate-900 dark:hover:text-github-dark-text border border-slate-200/60 dark:border-github-dark-border/60 rounded-full transition-all duration-200 font-medium cursor-pointer"
                                >
                                    {term}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky Left Navigation and Content panels layout */}
                <div className="flex-1 flex flex-col md:flex-row gap-6 items-start relative w-full">
                    
                    {/* Left Sticky Navigation Sidebar */}
                    <div className="w-full md:w-80 md:sticky md:top-6 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 flex flex-col shadow-sm max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar shrink-0 transition-all">
                        <div className="pb-3 border-b border-slate-100 dark:border-github-dark-border mb-3 flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-slate-400 dark:text-github-dark-muted tracking-wider uppercase font-mono">
                                Platforms & Modules ({filteredGuides.length})
                            </h3>
                            {searchQuery || selectedRoleFilter !== 'all' ? (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedRoleFilter('all');
                                    }}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                                >
                                    Reset
                                </button>
                            ) : null}
                        </div>
                        
                        <div className="space-y-1.5 custom-scrollbar pr-1">
                            {filteredGuides.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-xs font-medium">
                                    No matching modules.
                                </div>
                            ) : (
                                filteredGuides.map((g) => {
                                    const isActive = activeModule?.route === g.route;
                                    return (
                                        <button
                                            key={g.route}
                                            onClick={() => setActiveModule(g)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl text-left transition-all duration-200 group cursor-pointer ${
                                                isActive
                                                    ? 'bg-slate-100 dark:bg-github-dark-border text-indigo-600 dark:text-[#58a6ff] border border-transparent dark:border-github-dark-border/80 shadow-inner'
                                                    : 'text-slate-600 dark:text-github-dark-muted hover:bg-slate-50 dark:hover:bg-github-dark-border/30 hover:text-slate-900 dark:hover:text-github-dark-text border border-transparent'
                                            }`}
                                        >
                                            <span className={`shrink-0 transition-colors ${
                                                isActive ? 'text-indigo-600 dark:text-[#58a6ff]' : 'text-slate-400 dark:text-github-dark-muted group-hover:text-slate-600 dark:group-hover:text-slate-300'
                                            }`}>
                                                {getModuleIcon(g.route)}
                                            </span>
                                            <span className="truncate flex-1">{g.moduleName}</span>
                                            <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all ${
                                                isActive ? 'opacity-100 text-indigo-600 dark:text-[#58a6ff] translate-x-0.5' : 'text-slate-400'
                                            }`} />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Content Panel: Scrolls Naturally */}
                    <div 
                        id="guide-details-area"
                        className="flex-1 w-full bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 sm:p-8 flex flex-col shadow-sm transition-all"
                    >
                        {activeModule ? (
                            <div className="space-y-6">
                                
                                {/* Breadcrumbs */}
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-github-dark-muted font-medium font-mono uppercase tracking-wider">
                                    <span>Manual</span>
                                    <ChevronRight className="w-3 h-3" />
                                    <span className="text-indigo-600 dark:text-[#58a6ff]">{activeModule.moduleName}</span>
                                </div>

                                {/* Active Module Title & Description */}
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-github-dark-text mb-2 font-poppins">
                                        {activeModule.moduleName}
                                    </h1>
                                    <p className="text-sm sm:text-base text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal">
                                        {activeModule.description}
                                    </p>
                                </div>

                                {/* Access Roles indicators */}
                                <div className="flex flex-wrap items-center gap-2 py-3 border-y border-slate-100 dark:border-github-dark-border">
                                    <span className="text-xs font-semibold text-slate-400 dark:text-github-dark-muted uppercase font-mono mr-2">
                                        Module Access:
                                    </span>
                                    {activeModule.roles.map(role => renderRoleBadge(role))}
                                </div>

                                {/* Dynamic Step-by-Step Instructions list */}
                                {activeRouteSteps && activeRouteSteps.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-github-dark-border">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                            <CheckCircle2 className="w-4.5 h-4.5 text-green-600 dark:text-green-400 shrink-0" />
                                            Steps to Use this Module
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            {activeRouteSteps.map((step, sIdx) => (
                                                <div 
                                                    key={sIdx} 
                                                    className="flex gap-3.5 text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal bg-slate-50/50 dark:bg-github-dark-bg/30 p-3.5 rounded-xl border border-slate-200/40 dark:border-github-dark-border/40 hover:border-slate-300 dark:hover:border-github-dark-border transition-colors duration-200"
                                                >
                                                    <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-bold text-indigo-600 dark:text-[#58a6ff] shrink-0 font-mono">
                                                        {sIdx + 1}
                                                    </span>
                                                    <span className="flex-grow pt-0.5">{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Role-specific perspective tabs (Apple Style Switcher) */}
                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-github-dark-border">
                                    <div className="flex border-b border-slate-100 dark:border-github-dark-border gap-6 overflow-x-auto no-scrollbar">
                                        <button
                                            onClick={() => setActiveTab('general')}
                                            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all relative shrink-0 cursor-pointer ${
                                                activeTab === 'general'
                                                    ? 'border-indigo-600 text-indigo-600 dark:border-[#58a6ff] dark:text-[#58a6ff]'
                                                    : 'border-transparent text-slate-400 dark:text-github-dark-muted hover:text-slate-600 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            General Walkthrough
                                        </button>
                                        
                                        {/* Dynamic tabs based on module roles configuration */}
                                        {activeModule.roles.includes('employee') && (
                                            <button
                                                onClick={() => setActiveTab('employee')}
                                                className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all relative shrink-0 cursor-pointer ${
                                                    activeTab === 'employee'
                                                        ? 'border-indigo-600 text-indigo-600 dark:border-[#58a6ff] dark:text-[#58a6ff]'
                                                        : 'border-transparent text-slate-400 dark:text-github-dark-muted hover:text-slate-600 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                For Employees
                                            </button>
                                        )}

                                        {(activeModule.roles.includes('admin') || activeModule.roles.includes('hr')) && (
                                            <button
                                                onClick={() => setActiveTab('admin_hr')}
                                                className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all relative shrink-0 cursor-pointer ${
                                                    activeTab === 'admin_hr'
                                                        ? 'border-indigo-600 text-indigo-600 dark:border-[#58a6ff] dark:text-[#58a6ff]'
                                                        : 'border-transparent text-slate-400 dark:text-github-dark-muted hover:text-slate-600 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                For HR & Admins
                                            </button>
                                        )}

                                        {activeModule.roles.includes('super_admin') && (
                                            <button
                                                onClick={() => setActiveTab('super_admin')}
                                                className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 transition-all relative shrink-0 cursor-pointer ${
                                                    activeTab === 'super_admin'
                                                        ? 'border-indigo-600 text-indigo-600 dark:border-[#58a6ff] dark:text-[#58a6ff]'
                                                        : 'border-transparent text-slate-400 dark:text-github-dark-muted hover:text-slate-600 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                For Super Admin
                                            </button>
                                        )}
                                    </div>

                                    {/* Tab Contents */}
                                    <div className="bg-slate-50 dark:bg-github-dark-bg/40 border border-slate-200/50 dark:border-github-dark-border/40 rounded-2xl p-5 sm:p-6 transition-all duration-300">
                                        {activeTab === 'general' && (
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-[#58a6ff]" />
                                                    General Instructions
                                                </h3>
                                                <p className="text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal">
                                                    This module governs the {activeModule.moduleName} route. It is primarily accessible on path <code>{activeModule.route}</code>. Below are customized operational details depending on user access. Select a perspective above to see instructions matching your role.
                                                </p>
                                                {getModuleSpecificCallout(activeModule.route)}
                                            </div>
                                        )}

                                        {activeTab === 'employee' && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                    <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                    Employee Dashboard Guide
                                                </h3>
                                                <p className="text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal whitespace-pre-line">
                                                    {activeModule.roleDetails?.employee || "No role-specific directions defined."}
                                                </p>
                                            </div>
                                        )}

                                        {activeTab === 'admin_hr' && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    HR & Admin Operations
                                                </h3>
                                                <p className="text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal whitespace-pre-line">
                                                    {activeModule.roleDetails?.admin || activeModule.roleDetails?.hr || "No role-specific directions defined."}
                                                </p>
                                            </div>
                                        )}

                                        {activeTab === 'super_admin' && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    Super Administrator Controls
                                                </h3>
                                                <p className="text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal whitespace-pre-line">
                                                    {activeModule.roleDetails?.super_admin || "No role-specific directions defined."}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Accordion-based FAQs Section */}
                                {activeModule.faqs && activeModule.faqs.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-github-dark-border">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text flex items-center gap-2 mb-3">
                                            <HelpCircle className="w-4 h-4 text-slate-400 dark:text-github-dark-muted" />
                                            Frequently Asked Questions
                                        </h3>
                                        
                                        <div className="space-y-3">
                                            {activeModule.faqs.map((faq, fIdx) => {
                                                const isExpanded = !!expandedFaqs[fIdx];
                                                return (
                                                    <div 
                                                        key={fIdx} 
                                                        className="border border-slate-200/80 dark:border-github-dark-border/80 rounded-xl overflow-hidden bg-white dark:bg-github-dark-subtle hover:border-slate-300 dark:hover:border-github-dark-border transition-all duration-200"
                                                    >
                                                        <button
                                                            onClick={() => toggleFaq(fIdx)}
                                                            className="w-full flex items-center justify-between px-4 py-3.5 text-left text-xs font-semibold text-slate-700 dark:text-github-dark-text hover:text-indigo-600 dark:hover:text-[#58a6ff] transition-colors gap-3 cursor-pointer"
                                                        >
                                                            <span>{faq.question}</span>
                                                            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-github-dark-muted transition-transform duration-300 shrink-0 ${
                                                                isExpanded ? 'rotate-180 text-indigo-600 dark:text-[#58a6ff]' : ''
                                                            }`} />
                                                        </button>
                                                        
                                                        {/* Animated expanding faq description */}
                                                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                                            isExpanded ? 'max-h-80 border-t border-slate-100 dark:border-github-dark-border' : 'max-h-0'
                                                        }`}>
                                                            <p className="px-4 py-3.5 text-xs text-slate-600 dark:text-github-dark-muted leading-relaxed font-normal whitespace-pre-line bg-slate-50/50 dark:bg-github-dark-bg/20">
                                                                {faq.answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Suggestions & Helper Queries */}
                                {activeModule.suggestions && activeModule.suggestions.length > 0 && (
                                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-github-dark-border">
                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase font-mono tracking-wider">
                                            Suggested Assistant Queries
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {activeModule.suggestions.map((sug, sIdx) => (
                                                <button
                                                    key={sIdx}
                                                    onClick={() => handleSearchClick(sug)}
                                                    className="text-xs px-3.5 py-2.5 bg-slate-50 hover:bg-indigo-50/50 dark:bg-github-dark-bg/50 dark:hover:bg-indigo-950/20 text-slate-600 dark:text-github-dark-muted hover:text-indigo-600 dark:hover:text-[#58a6ff] border border-slate-200 dark:border-github-dark-border rounded-xl transition-all duration-150 text-left font-medium cursor-pointer"
                                                >
                                                    {sug}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-github-dark-muted">
                                <BookOpen className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
                                <p className="text-sm font-medium">Please select a module to view documentation.</p>
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
