import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
    Search, Filter, Plus, FileText, CheckCircle2, AlertTriangle, 
    ShieldAlert, Clock, RefreshCw, Upload, Eye, Trash2, CheckCircle, 
    XCircle, AlertCircle, Sparkles, Building, Briefcase, User, Users, Info, 
    Check, ChevronDown, ChevronUp, UserCheck, UserX, ArrowRight, 
    ShieldCheck, Download, Trash, ClipboardCheck, Calendar, MapPin, X, File, Award,
    Sliders, Edit2, RotateCcw
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getColumnPreferences, updateColumnPreferences } from '../../services/userService';
import EmployeeFormContent from '../../components/employees/EmployeeFormContent';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { KpiGoalSheets, ReviewsAndRatings, AiPerformanceAnalyzer } from '../performance/PerformanceViews';

// Document categories and checklist items redefined as templates
const DEFAULT_CHECKLIST_TEMPLATES = [
    {
        id: 'dev_onboarding',
        name: 'Developer Onboarding',
        items: [
            { key: 'personal_info', label: 'Personal Info Submission' },
            { key: 'laptop_assigned', label: 'Laptop Assignment' },
            { key: 'github_access', label: 'GitHub Repository Access' },
            { key: 'slack_aws_invites', label: 'Slack/AWS Invites' },
            { key: 'codebase_walkthrough', label: 'Codebase Walkthrough' },
            { key: 'dev_setup', label: 'Dev Environment Setup' }
        ]
    },
    {
        id: 'mgmt_onboarding',
        name: 'Management Onboarding',
        items: [
            { key: 'personal_info', label: 'Personal Info Submission' },
            { key: 'hr_policy', label: 'HR Policy Briefing' },
            { key: 'team_intro', label: 'Team Introductions' },
            { key: 'okr_alignment', label: 'OKR Alignment' },
            { key: 'dashboard_training', label: 'Dashboard Training' }
        ]
    },
    {
        id: 'support_onboarding',
        name: 'General Support',
        items: [
            { key: 'office_tour', label: 'Office Tour' },
            { key: 'id_card', label: 'ID Card Collection' },
            { key: 'uniform_handover', label: 'Uniform Handover' },
            { key: 'health_safety', label: 'Health & Safety Briefing' }
        ]
    }
];

const DEFAULT_DOCUMENT_TEMPLATES = [
    {
        id: 'dev_docs',
        name: 'Developer Profile Documents',
        categories: [
            {
                id: 'identity',
                name: 'Identity Documents',
                items: [
                    { key: 'aadhaar', name: 'Aadhaar Card', required: true },
                    { key: 'pan', name: 'PAN Card', required: true },
                    { key: 'passport', name: 'Passport', required: false }
                ]
            },
            {
                id: 'educational',
                name: 'Educational Documents',
                items: [
                    { key: 'ssc', name: 'SSC (10th Marksheet)', required: true },
                    { key: 'hsc', name: 'HSC (12th Marksheet)', required: true },
                    { key: 'degree', name: 'Degree Certificate', required: true },
                    { key: 'consolidated', name: 'Consolidated Marksheet', required: true }
                ]
            },
            {
                id: 'employment',
                name: 'Employment Documents',
                items: [
                    { key: 'experience_letter', name: 'Experience Letter', required: true },
                    { key: 'relieving_letter', name: 'Relieving Letter', required: true },
                    { key: 'salary_slips', name: 'Salary Slips (Last 3 Months)', required: true }
                ]
            },
            {
                id: 'banking',
                name: 'Banking Documents',
                items: [
                    { key: 'cheque', name: 'Cancelled Cheque', required: true },
                    { key: 'passbook', name: 'Passbook Copy', required: true }
                ]
            }
        ]
    },
    {
        id: 'mgmt_docs',
        name: 'Management Profile Documents',
        categories: [
            {
                id: 'identity',
                name: 'Identity Documents',
                items: [
                    { key: 'aadhaar', name: 'Aadhaar Card', required: true },
                    { key: 'pan', name: 'PAN Card', required: true }
                ]
            },
            {
                id: 'educational',
                name: 'Educational Documents',
                items: [
                    { key: 'mba_degree', name: 'MBA Degree Certificate', required: true },
                    { key: 'grad_degree', name: 'Graduation Degree', required: true }
                ]
            },
            {
                id: 'employment',
                name: 'Employment Documents',
                items: [
                    { key: 'relieving_letter', name: 'Relieving Letter', required: true },
                    { key: 'ref_contact', name: 'Reference Contact Letter', required: false }
                ]
            },
            {
                id: 'banking',
                name: 'Banking Documents',
                items: [
                    { key: 'cheque', name: 'Cancelled Cheque', required: true }
                ]
            }
        ]
    },
    {
        id: 'support_docs',
        name: 'Support Profile Documents',
        categories: [
            {
                id: 'identity',
                name: 'Identity Documents',
                items: [
                    { key: 'aadhaar', name: 'Aadhaar Card', required: true }
                ]
            },
            {
                id: 'banking',
                name: 'Banking Documents',
                items: [
                    { key: 'passbook', name: 'Passbook Copy', required: true }
                ]
            },
            {
                id: 'compliance',
                name: 'Compliance Documents',
                items: [
                    { key: 'pf', name: 'PF Details', required: false }
                ]
            }
        ]
    }
];

const DEFAULT_CYCLES = [
    { id: 'cycle-1', name: 'Q1 2026 Performance Cycle', type: 'Quarterly', status: 'Evaluating', startDate: '2026-01-01', endDate: '2026-03-31' },
    { id: 'cycle-2', name: 'Q2 2026 Performance Cycle', type: 'Quarterly', status: 'Active', startDate: '2026-04-01', endDate: '2026-06-30' },
    { id: 'cycle-3', name: 'Mid-Year 2026 Appraisal', type: 'Half Yearly', status: 'Closed', startDate: '2026-01-01', endDate: '2026-06-30' },
    { id: 'cycle-4', name: 'Annual Review 2026', type: 'Yearly', status: 'Closed', startDate: '2026-01-01', endDate: '2026-12-31' }
];

const MOCK_BACKUP_EMPLOYEES = [
    { id: 101, user_code: 'EMP-101', name: 'Sathish Kumar', email: 'sathish@mano.co.in', phone: '9876543210', department: 'Engineering', designation: 'Tech Lead', status: 'Active', joiningDate: '2024-05-10', profile_image_url: '' },
    { id: 102, user_code: 'EMP-102', name: 'Karthik Raja', email: 'karthik@mano.co.in', phone: '9876543211', department: 'Sales', designation: 'Sales Head', status: 'Active', joiningDate: '2025-02-15', profile_image_url: '' },
    { id: 103, user_code: 'EMP-103', name: 'Divya Bharathi', email: 'divya@mano.co.in', phone: '9876543212', department: 'HR & Admin', designation: 'HR Specialist', status: 'Active', joiningDate: '2026-01-10', profile_image_url: '' },
    { id: 104, user_code: 'EMP-104', name: 'Arjun Das', email: 'arjun@mano.co.in', phone: '9876543213', department: 'Marketing', designation: 'Content Lead', status: 'Inactive', joiningDate: '2025-08-20', profile_image_url: '' },
    { id: 105, user_code: 'EMP-105', name: 'Vijay Sethu', email: 'vijay@mano.co.in', phone: '9876543214', department: 'Engineering', designation: 'Software Engineer', status: 'Deleted', joiningDate: '2026-06-01', profile_image_url: '' }
];

const EmployeeUnifiedMaster = () => {
    const navigate = useNavigate();
    const { avatarTimestamp, user: currentUser } = useAuth();

    // UI & Data States
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('All');
    
    // Filters States
    const [statusFilter, setStatusFilter] = useState('Active'); // Active | Inactive | Deleted (Trash)
    const [onboardingFilter, setOnboardingFilter] = useState('All'); // All | Completed | InProgress

    // Sidebar & Drawer states
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [drawerTab, setDrawerTab] = useState('profile'); // profile, checklist, documents, ai_verify, perf_goals, perf_reviews, perf_analyzer
    const [editMode, setEditMode] = useState(false); // switches unified profile tab to Edit Form

    // Performance Appraisals Cycle state
    const [selectedCycleId, setSelectedCycleId] = useState('cycle-2');
    const [cycles, setCycles] = useState(DEFAULT_CYCLES);

    // AI Document Auditor states
    const [activeOcrDoc, setActiveOcrDoc] = useState('');
    const [overrideReasonText, setOverrideReasonText] = useState('');
    const [overridingDiscrepancyId, setOverridingDiscrepancyId] = useState(null);

    const DEFAULT_COLUMNS = {
        employee: true,           // profile, name, email
        roleDept: true,           // role & department
        shift: true,              // shift
        geofences: true,          // geofences
        joiningDate: true,        // joining date
        onboardingProgress: true, // onboarding progress bar
        actions: true,            // operations

        // Optional extras (hidden by default):
        phone: false,
        employeeId: false,
        address: false,
        reportingManager: false,
        workLocation: false
    };

    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);

    // Update columns state from Database when currentUser.user_id changes
    useEffect(() => {
        const loadPreferences = async () => {
            if (!currentUser?.user_id) return;
            try {
                const res = await getColumnPreferences();
                if (res.ok && res.preferences) {
                    setVisibleColumns({
                        ...DEFAULT_COLUMNS,
                        ...res.preferences
                    });
                } else {
                    const localSaved = localStorage.getItem(`mano_unified_employee_columns_${currentUser.user_id}`);
                    if (localSaved) {
                        setVisibleColumns(JSON.parse(localSaved));
                    }
                }
            } catch (err) {
                console.warn("Could not load database preferences, falling back to local storage:", err);
                const localSaved = localStorage.getItem(`mano_unified_employee_columns_${currentUser.user_id}`);
                if (localSaved) {
                    try {
                        setVisibleColumns(JSON.parse(localSaved));
                    } catch (e) {}
                }
            }
        };

        loadPreferences();
    }, [currentUser?.user_id]);

    const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);

    // Document Modal State
    const [uploadModal, setUploadModal] = useState({
        isOpen: false,
        docKey: '',
        docName: '',
        category: ''
    });
    const [uploadForm, setUploadForm] = useState({
        fileName: '',
        expiryDate: '',
        nameOnDoc: '',
        isExpiredSim: false,
        isMismatchSim: false
    });
    const [isVerifying, setIsVerifying] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Template States
    const [checklistTemplates, setChecklistTemplates] = useState(() => {
        const stored = localStorage.getItem('mano_checklist_templates');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.setItem('mano_checklist_templates', JSON.stringify(DEFAULT_CHECKLIST_TEMPLATES));
        return DEFAULT_CHECKLIST_TEMPLATES;
    });

    const [documentTemplates, setDocumentTemplates] = useState(() => {
        const stored = localStorage.getItem('mano_document_templates');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.setItem('mano_document_templates', JSON.stringify(DEFAULT_DOCUMENT_TEMPLATES));
        return DEFAULT_DOCUMENT_TEMPLATES;
    });

    // Template Modals & Forms States
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [templatesModalTab, setTemplatesModalTab] = useState('checklist'); // 'checklist' | 'document'
    const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState('');
    const [selectedDocTemplateId, setSelectedDocTemplateId] = useState('');

    const [newChecklistItemText, setNewChecklistItemText] = useState('');
    const [newDocCatText, setNewDocCatText] = useState('');
    const [newDocItemNames, setNewDocItemNames] = useState({}); // catId -> text
    const [newDocItemRequired, setNewDocItemRequired] = useState({}); // catId -> bool

    useEffect(() => {
        if (checklistTemplates.length > 0 && !selectedChecklistTemplateId) {
            setSelectedChecklistTemplateId(checklistTemplates[0].id);
        }
    }, [checklistTemplates, selectedChecklistTemplateId]);

    useEffect(() => {
        if (documentTemplates.length > 0 && !selectedDocTemplateId) {
            setSelectedDocTemplateId(documentTemplates[0].id);
        }
    }, [documentTemplates, selectedDocTemplateId]);

    // Checklist Template Handler functions
    const handleAddChecklistTemplate = () => {
        const newId = `checklist_template_${Date.now()}`;
        const newTemplate = {
            id: newId,
            name: 'New Checklist Template',
            items: [
                { key: 'personal_info', label: 'Personal Info Submission' }
            ]
        };
        const updated = [...checklistTemplates, newTemplate];
        setChecklistTemplates(updated);
        localStorage.setItem('mano_checklist_templates', JSON.stringify(updated));
        setSelectedChecklistTemplateId(newId);
        toast.success('New checklist template created');
    };

    const handleUpdateChecklistTemplateName = (id, newName) => {
        const updated = checklistTemplates.map(t => {
            if (t.id === id) {
                return { ...t, name: newName };
            }
            return t;
        });
        setChecklistTemplates(updated);
        localStorage.setItem('mano_checklist_templates', JSON.stringify(updated));
    };

    const handleAddChecklistTemplateItem = (id, label) => {
        if (!label.trim()) return;
        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        const updated = checklistTemplates.map(t => {
            if (t.id === id) {
                let uniqueKey = key;
                let counter = 1;
                while (t.items.some(item => item.key === uniqueKey)) {
                    uniqueKey = `${key}_${counter}`;
                    counter++;
                }
                return {
                    ...t,
                    items: [...t.items, { key: uniqueKey, label: label.trim() }]
                };
            }
            return t;
        });
        setChecklistTemplates(updated);
        localStorage.setItem('mano_checklist_templates', JSON.stringify(updated));
        setNewChecklistItemText('');
        toast.success('Item added to template');
    };

    const handleDeleteChecklistTemplateItem = (templateId, itemKey) => {
        const updated = checklistTemplates.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    items: t.items.filter(item => item.key !== itemKey)
                };
            }
            return t;
        });
        setChecklistTemplates(updated);
        localStorage.setItem('mano_checklist_templates', JSON.stringify(updated));
        toast.success('Item removed from template');
    };

    const handleDeleteChecklistTemplate = (id) => {
        if (checklistTemplates.length <= 1) {
            toast.error('Cannot delete the last remaining template');
            return;
        }
        const updated = checklistTemplates.filter(t => t.id !== id);
        setChecklistTemplates(updated);
        localStorage.setItem('mano_checklist_templates', JSON.stringify(updated));
        setSelectedChecklistTemplateId(updated[0].id);
        toast.success('Checklist template deleted');
    };

    // Document Template Handler functions
    const handleAddDocTemplate = () => {
        const newId = `doc_template_${Date.now()}`;
        const newTemplate = {
            id: newId,
            name: 'New Document Template',
            categories: [
                {
                    id: 'identity',
                    name: 'Identity Documents',
                    items: [
                        { key: 'aadhaar', name: 'Aadhaar Card', required: true }
                    ]
                }
            ]
        };
        const updated = [...documentTemplates, newTemplate];
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        setSelectedDocTemplateId(newId);
        toast.success('New document template created');
    };

    const handleUpdateDocTemplateName = (id, newName) => {
        const updated = documentTemplates.map(t => {
            if (t.id === id) {
                return { ...t, name: newName };
            }
            return t;
        });
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
    };

    const handleAddDocTemplateCategory = (templateId, categoryName) => {
        if (!categoryName.trim()) return;
        const categoryId = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        const updated = documentTemplates.map(t => {
            if (t.id === templateId) {
                let uniqueId = categoryId;
                let counter = 1;
                while (t.categories.some(cat => cat.id === uniqueId)) {
                    uniqueId = `${categoryId}_${counter}`;
                    counter++;
                }
                return {
                    ...t,
                    categories: [...t.categories, { id: uniqueId, name: categoryName.trim(), items: [] }]
                };
            }
            return t;
        });
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        setNewDocCatText('');
        toast.success('Category added to template');
    };

    const handleDeleteDocTemplateCategory = (templateId, categoryId) => {
        const updated = documentTemplates.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.filter(cat => cat.id !== categoryId)
                };
            }
            return t;
        });
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        toast.success('Category deleted');
    };

    const handleAddDocTemplateItem = (templateId, categoryId, itemName, isRequired) => {
        if (!itemName.trim()) return;
        const itemKey = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        const updated = documentTemplates.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.map(cat => {
                        if (cat.id === categoryId) {
                            let uniqueKey = itemKey;
                            let counter = 1;
                            const allItems = t.categories.flatMap(c => c.items);
                            while (allItems.some(item => item.key === uniqueKey) || cat.items.some(item => item.key === uniqueKey)) {
                                uniqueKey = `${itemKey}_${counter}`;
                                counter++;
                            }
                            return {
                                ...cat,
                                items: [...cat.items, { key: uniqueKey, name: itemName.trim(), required: isRequired }]
                            };
                        }
                        return cat;
                    })
                };
            }
            return t;
        });
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        setNewDocItemNames(prev => ({ ...prev, [categoryId]: '' }));
        toast.success('Document item added');
    };

    const handleDeleteDocTemplateItem = (templateId, categoryId, itemKey) => {
        const updated = documentTemplates.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.map(cat => {
                        if (cat.id === categoryId) {
                            return {
                                ...cat,
                                items: cat.items.filter(item => item.key !== itemKey)
                            };
                        }
                        return cat;
                    })
                };
            }
            return t;
        });
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        toast.success('Document item removed');
    };

    const handleDeleteDocTemplate = (id) => {
        if (documentTemplates.length <= 1) {
            toast.error('Cannot delete the last remaining template');
            return;
        }
        const updated = documentTemplates.filter(t => t.id !== id);
        setDocumentTemplates(updated);
        localStorage.setItem('mano_document_templates', JSON.stringify(updated));
        setSelectedDocTemplateId(updated[0].id);
        toast.success('Document template deleted');
    };

    // Assigned Template Handlers
    const handleChecklistTemplateChange = (templateId) => {
        const updatedProfile = {
            ...selectedEmployee.profile,
            checklist_template_id: templateId
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
    };

    const handleDocumentTemplateChange = (templateId) => {
        const updatedProfile = {
            ...selectedEmployee.profile,
            document_template_id: templateId
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
    };

    // Employee-specific Exclusions Handlers
    const handleExcludeChecklistItem = (itemKey) => {
        const currentExclusions = selectedEmployee.profile.checklist_exclusions || [];
        const updatedExclusions = [...currentExclusions, itemKey];
        const updatedProfile = {
            ...selectedEmployee.profile,
            checklist_exclusions: updatedExclusions
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.info("Checklist task excluded for this employee");
    };

    const handleRestoreChecklistExclusions = () => {
        const updatedProfile = {
            ...selectedEmployee.profile,
            checklist_exclusions: []
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.success("All excluded checklist tasks restored");
    };

    const handleExcludeDocItem = (itemKey) => {
        const currentExclusions = selectedEmployee.profile.document_exclusions || [];
        const updatedExclusions = [...currentExclusions, itemKey];
        const updatedProfile = {
            ...selectedEmployee.profile,
            document_exclusions: updatedExclusions
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.info("Document field excluded for this employee");
    };

    const handleRestoreDocExclusions = () => {
        const updatedProfile = {
            ...selectedEmployee.profile,
            document_exclusions: []
        };
        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.success("All excluded document fields restored");
    };

    // Load columns toggle preference
    const saveColumnPreference = async (updatedPrefs) => {
        setVisibleColumns(updatedPrefs);
        const key = currentUser?.user_id ? `mano_unified_employee_columns_${currentUser.user_id}` : 'mano_unified_employee_columns';
        localStorage.setItem(key, JSON.stringify(updatedPrefs));
        
        if (currentUser?.user_id) {
            try {
                await updateColumnPreferences(updatedPrefs);
            } catch (err) {
                console.error("Failed to save column preferences to database:", err);
            }
        }
    };

    const toggleColumn = (colKey) => {
        const updated = { ...visibleColumns, [colKey]: !visibleColumns[colKey] };
        saveColumnPreference(updated);
    };

    const resetColumnsToDefault = () => {
        const defaults = {
            employee: true,
            roleDept: true,
            shift: true,
            geofences: true,
            joiningDate: true,
            onboardingProgress: true,
            actions: true,
            phone: false,
            employeeId: false,
            address: false,
            reportingManager: false,
            workLocation: false
        };
        saveColumnPreference(defaults);
    };

    // Load extra profile info from localStorage or seed mock defaults
    const getEmployeeProfile = (empId, empName) => {
        const localKey = `mano_empmaster_profile_${empId}`;
        const stored = localStorage.getItem(localKey);
        
        // Seed variations based on empId to give a realistic dashboard view out-of-the-box
        const variant = Number(empId) % 3;
        let defaultProfile = {};

        if (variant === 0) {
            // Case 0: Onboarding Completed (100%)
            defaultProfile = {
                checklist_template_id: 'dev_onboarding',
                document_template_id: 'dev_docs',
                dob: '1992-04-12',
                gender: 'Female',
                address: 'Flat 402, Sunshine Apartments, Indiranagar, Bangalore, Karnataka',
                joining_date: '2024-05-10',
                employment_type: 'Full-time',
                work_location: 'Headquarters',
                reporting_manager: 'Suresh Kumar (VP of Engineering)',
                documents: {
                    aadhaar: { uploaded: true, fileName: `Aadhaar_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2024-05-02', nameOnDoc: empName, status: 'Verified' },
                    pan: { uploaded: true, fileName: `PAN_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2024-05-02', nameOnDoc: empName, status: 'Verified' },
                    ssc: { uploaded: true, fileName: 'SSC_Marksheet.pdf', uploadedAt: '2024-05-03', nameOnDoc: empName, status: 'Verified' },
                    hsc: { uploaded: true, fileName: 'HSC_Marksheet.pdf', uploadedAt: '2024-05-03', nameOnDoc: empName, status: 'Verified' },
                    degree: { uploaded: true, fileName: 'Degree_Certificate.pdf', uploadedAt: '2024-05-03', nameOnDoc: empName, status: 'Verified' },
                    consolidated: { uploaded: true, fileName: 'Consolidated_Transcript.pdf', uploadedAt: '2024-05-03', nameOnDoc: empName, status: 'Verified' },
                    experience_letter: { uploaded: true, fileName: 'Experience_Certificate.pdf', uploadedAt: '2024-05-04', nameOnDoc: empName, status: 'Verified' },
                    relieving_letter: { uploaded: true, fileName: 'Relieving_Letter.pdf', uploadedAt: '2024-05-04', nameOnDoc: empName, status: 'Verified' },
                    salary_slips: { uploaded: true, fileName: 'Last_3_Months_PaySlips.pdf', uploadedAt: '2024-05-04', nameOnDoc: empName, status: 'Verified' },
                    cheque: { uploaded: true, fileName: 'Cancelled_Cheque.pdf', uploadedAt: '2024-05-05', nameOnDoc: empName, status: 'Verified' },
                    passbook: { uploaded: true, fileName: 'Bank_Passbook_Copy.pdf', uploadedAt: '2024-05-05', nameOnDoc: empName, status: 'Verified' }
                },
                onboarding_checklist: {
                    personal_info: true,
                    laptop_assigned: true,
                    github_access: true,
                    slack_aws_invites: true,
                    codebase_walkthrough: true,
                    dev_setup: true
                },
                ai_verification_results: {
                    missing_documents: [],
                    expired_documents: [],
                    mismatched_information: [],
                    auditScore: 85,
                    lastChecked: '2026-06-10 14:35:45',
                    extractedMetadata: {
                        aadhaar: [
                            { field: 'Extracted Name', value: empName, confidence: 99 },
                            { field: 'Aadhaar Number', value: 'XXXX-XXXX-8901', confidence: 99 },
                            { field: 'Date of Birth', value: '1992-04-12', confidence: 98 },
                            { field: 'Gender', value: 'Female', confidence: 99 },
                            { field: 'Address', value: 'Flat 402, Sunshine Apartments, Indiranagar, Bangalore...', confidence: 92 }
                        ],
                        pan: [
                            { field: 'Extracted Name', value: empName.toUpperCase(), confidence: 97 },
                            { field: 'PAN Number', value: 'ABCDE1234F', confidence: 99 },
                            { field: 'Date of Birth', value: '1992-04-12', confidence: 98 },
                            { field: 'Father\'s Name', value: 'K. Suresh', confidence: 90 }
                        ],
                        degree: [
                            { field: 'Extracted Name', value: empName.split(' ')[0] + ' V.', confidence: 94 },
                            { field: 'Degree Type', value: 'Bachelor of Technology', confidence: 98 },
                            { field: 'Major/Branch', value: 'Computer Science', confidence: 97 },
                            { field: 'University', value: 'Anna University', confidence: 95 },
                            { field: 'Passing Year', value: '2014', confidence: 99 }
                        ]
                    },
                    securityChecks: {
                        aadhaar: { hologram: 'Passed', blur: 0.08, metadata: 'Passed', editing: 'Passed' },
                        pan: { hologram: 'Passed', blur: 0.11, metadata: 'Passed', editing: 'Passed' },
                        degree: { hologram: 'N/A', blur: 0.14, metadata: 'Passed', editing: 'Flagged' }
                    },
                    discrepancies: [
                        {
                            id: 'name_degree_mismatch',
                            field: 'Name',
                            sourceA: 'HR Profile',
                            valueA: empName,
                            sourceB: 'Degree Certificate',
                            valueB: empName.split(' ')[0] + ' V.',
                            severity: 'High',
                            isOverridden: false,
                            overrideReason: '',
                            overriddenBy: '',
                            overriddenAt: ''
                        }
                    ]
                }
            };
        } else if (variant === 1) {
            // Case 1: In Progress Onboarding (~60% completed with warning flags)
            defaultProfile = {
                checklist_template_id: 'mgmt_onboarding',
                document_template_id: 'mgmt_docs',
                dob: '1998-11-23',
                gender: 'Male',
                address: 'H-90, Sector 15, HSR Layout, Bangalore, Karnataka',
                joining_date: '2026-05-01',
                employment_type: 'Full-time',
                work_location: 'Remote',
                reporting_manager: 'Ananya Sen (HR Specialist)',
                documents: {
                    aadhaar: { uploaded: true, fileName: `Aadhaar_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2026-05-02', nameOnDoc: empName, status: 'Verified' },
                    pan: { uploaded: true, fileName: `PAN_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2026-05-02', nameOnDoc: empName, status: 'Verified' },
                    grad_degree: { uploaded: true, fileName: 'Degree_Certificate.pdf', uploadedAt: '2026-05-03', nameOnDoc: empName, status: 'Verified' }
                },
                onboarding_checklist: {
                    personal_info: true,
                    hr_policy: true,
                    team_intro: true,
                    okr_alignment: false,
                    dashboard_training: false
                },
                ai_verification_results: {
                    missing_documents: ['MBA Degree Certificate', 'Relieving Letter', 'Reference Contact Letter', 'Cancelled Cheque'],
                    expired_documents: [],
                    mismatched_information: [],
                    auditScore: 70,
                    lastChecked: '2026-06-10 11:20:10',
                    extractedMetadata: {
                        aadhaar: [
                            { field: 'Extracted Name', value: empName, confidence: 99 },
                            { field: 'Aadhaar Number', value: 'XXXX-XXXX-1234', confidence: 98 },
                            { field: 'Date of Birth', value: '1998-11-23', confidence: 98 },
                            { field: 'Gender', value: 'Male', confidence: 99 }
                        ],
                        pan: [
                            { field: 'Extracted Name', value: empName.toUpperCase(), confidence: 97 },
                            { field: 'PAN Number', value: 'XYZPQ5678R', confidence: 99 },
                            { field: 'Date of Birth', value: '1998-11-23', confidence: 98 }
                        ]
                    },
                    securityChecks: {
                        aadhaar: { hologram: 'Passed', blur: 0.09, metadata: 'Passed', editing: 'Passed' },
                        pan: { hologram: 'Passed', blur: 0.13, metadata: 'Passed', editing: 'Passed' }
                    },
                    discrepancies: []
                }
            };
        } else {
            // Case 2: Onboarding Pending / Fresh (0% - 20%)
            defaultProfile = {
                checklist_template_id: 'support_onboarding',
                document_template_id: 'support_docs',
                dob: '2001-01-15',
                gender: 'Male',
                address: '32, MG Road, Trinity Junction, Bangalore, Karnataka',
                joining_date: '2026-06-01',
                employment_type: 'Intern',
                work_location: 'Headquarters',
                reporting_manager: 'Rohan Mehra (Tech Lead)',
                documents: {},
                onboarding_checklist: {
                    office_tour: false,
                    id_card: false,
                    uniform_handover: false,
                    health_safety: false
                },
                ai_verification_results: {
                    missing_documents: ['Aadhaar Card', 'Passbook Copy', 'PF Details'],
                    expired_documents: [],
                    mismatched_information: [],
                    auditScore: 0,
                    lastChecked: 'Never',
                    extractedMetadata: {},
                    securityChecks: {},
                    discrepancies: []
                }
            };
        }

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return {
                    checklist_template_id: defaultProfile.checklist_template_id,
                    document_template_id: defaultProfile.document_template_id,
                    ...defaultProfile,
                    ...parsed,
                    documents: { ...defaultProfile.documents, ...parsed.documents },
                    onboarding_checklist: { ...defaultProfile.onboarding_checklist, ...parsed.onboarding_checklist },
                    ai_verification_results: { ...defaultProfile.ai_verification_results, ...parsed.ai_verification_results }
                };
            } catch (e) {
                console.error(e);
            }
        }
        return defaultProfile;
    };

    const saveEmployeeProfile = (empId, updatedProfile) => {
        const localKey = `mano_empmaster_profile_${empId}`;
        localStorage.setItem(localKey, JSON.stringify(updatedProfile));
        
        if (selectedEmployee && selectedEmployee.id === empId) {
            setSelectedEmployee(prev => ({
                ...prev,
                profile: updatedProfile
            }));
        }
    };

    const getOnboardingProgress = (profileOrChecklist, templateId) => {
        if (!profileOrChecklist) return 0;
        
        let checklist = {};
        let exclusions = [];
        
        if (profileOrChecklist.onboarding_checklist) {
            checklist = profileOrChecklist.onboarding_checklist;
            exclusions = profileOrChecklist.checklist_exclusions || [];
        } else {
            checklist = profileOrChecklist;
        }

        const currentTemplates = checklistTemplates || DEFAULT_CHECKLIST_TEMPLATES;
        const activeId = templateId || (currentTemplates[0]?.id);
        const template = currentTemplates.find(t => t.id === activeId) || currentTemplates[0];
        if (!template || !template.items || template.items.length === 0) return 0;
        
        const activeItems = template.items.filter(item => !exclusions.includes(item.key));
        if (activeItems.length === 0) return 0;
        
        const total = activeItems.length;
        const checked = activeItems.filter(item => checklist[item.key]).length;
        return Math.round((checked / total) * 100);
    };

    // Load active directory employees
    const fetchEmployees = async (selectedIdToRefresh = null) => {
        try {
            setLoading(true);
            const res = await adminService.getAllUsers(true);
            let updatedList = [];
            if (res.success && res.users.length > 0) {
                updatedList = res.users.map(u => ({
                    id: u.user_id,
                    user_code: u.user_code || `EMP-${u.user_id}`,
                    name: u.user_name,
                    email: u.email,
                    phone: u.phone_no || '-',
                    department: u.dept_name || 'General',
                    designation: u.desg_name || u.user_type,
                    status: u.is_deleted ? 'Deleted' : (u.is_active ? 'Active' : 'Inactive'),
                    profile_image_url: u.profile_image_url,
                    is_active: u.is_active,
                    is_deleted: u.is_deleted,
                    shift: u.shift_name || 'General Shift',
                    workLocations: u.work_locations || []
                }));
                setEmployees(updatedList);
            } else {
                // Seed mock data if database is empty
                updatedList = MOCK_BACKUP_EMPLOYEES;
                setEmployees(MOCK_BACKUP_EMPLOYEES);
            }

            if (selectedIdToRefresh) {
                const freshEmp = updatedList.find(e => e.id === selectedIdToRefresh);
                if (freshEmp) {
                    const profile = getEmployeeProfile(freshEmp.id, freshEmp.name);
                    setSelectedEmployee({
                        ...freshEmp,
                        profile
                    });
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load employees from database. Rendering mock list.");
            setEmployees(MOCK_BACKUP_EMPLOYEES);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
        
        const storedCycles = localStorage.getItem('mano_performance_cycles');
        if (storedCycles) {
            try {
                setCycles(JSON.parse(storedCycles));
            } catch (e) {
                setCycles(DEFAULT_CYCLES);
            }
        }
    }, []);

    const departments = ['All', ...new Set(employees.map(e => e.department))];

    // Status / Card filter calculations
    const activeCount = employees.filter(e => e.status === 'Active').length;
    const inactiveCount = employees.filter(e => e.status === 'Inactive').length;
    const trashCount = employees.filter(e => e.status === 'Deleted').length;

    // Filter logic
    const filteredEmployees = employees.filter(emp => {
        // Fuzzy search filter
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              emp.user_code.toLowerCase().includes(searchTerm.toLowerCase());
                              
        // Department dropdown filter
        const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
        
        // Card 4 (Active/Inactive/Trash) filter
        const matchesStatus = emp.status === statusFilter;
        
        // Cards 2 & 3 Onboarding progress filter
        const profile = getEmployeeProfile(emp.id, emp.name);
        const progress = getOnboardingProgress(profile.onboarding_checklist, profile.checklist_template_id);
        let matchesOnboarding = true;
        
        if (onboardingFilter === 'Completed') {
            matchesOnboarding = progress === 100;
        } else if (onboardingFilter === 'InProgress') {
            matchesOnboarding = progress > 0 && progress < 100;
        }

        return matchesSearch && matchesDept && matchesStatus && matchesOnboarding;
    });

    const handleSelectEmployee = (emp) => {
        const profile = getEmployeeProfile(emp.id, emp.name);
        setSelectedEmployee({
            ...emp,
            profile
        });
        setDrawerTab('profile');
        setEditMode(false);
    };

    // Actions implementation
    const handleDelete = (e, id) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: "Move to Trash",
            message: "Are you sure you want to move this employee to trash? They will be inactive until restored.",
            type: 'warning',
            confirmText: "Move to Trash",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.deleteUser(id);
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

    const handleForceDelete = (e, id) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: "Permanent Delete",
            message: "WARNING: This will permanently remove all user data, attendance records, and images. This action cannot be undone.",
            type: 'danger',
            confirmText: "Delete Permanently",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.forceDeleteUser(id);
                    toast.success("User permanently deleted");
                    setEmployees(prev => prev.filter(emp => emp.id !== id));
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    toast.error(err.message || "Failed to delete user");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };

    const handleRestore = (e, id) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: "Restore Employee",
            message: "Restore this employee from trash? Their status will be set to Inactive.",
            type: 'info',
            confirmText: "Restore",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    await adminService.restoreUser(id);
                    toast.success("User restored (Status: Inactive)");
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

    const handleToggleStatus = (e, id, currentStatus) => {
        e.stopPropagation();
        const newStatus = !currentStatus;
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
                    await adminService.toggleUserStatus(id, newStatus);
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

    // Checklist toggles
    const handleChecklistToggle = (itemKey) => {
        const currentChecklist = selectedEmployee.profile.onboarding_checklist;
        const updatedChecklist = {
            ...currentChecklist,
            [itemKey]: !currentChecklist[itemKey]
        };

        const updatedProfile = {
            ...selectedEmployee.profile,
            onboarding_checklist: updatedChecklist
        };

        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
    };

    // Upload verified documents simulations
    const openUploadModal = (itemKey, itemName, categoryId) => {
        setUploadForm({
            fileName: `${itemName.replace(/\s+/g, '_')}_Scan.pdf`,
            expiryDate: '',
            nameOnDoc: selectedEmployee.name,
            isExpiredSim: false,
            isMismatchSim: false
        });
        setUploadModal({
            isOpen: true,
            docKey: itemKey,
            docName: itemName,
            category: categoryId
        });
    };

    const handleDocumentUploadSave = (e) => {
        e.preventDefault();
        
        const docRecord = {
            uploaded: true,
            fileName: uploadForm.fileName,
            uploadedAt: new Date().toLocaleDateString(),
            expiryDate: uploadForm.expiryDate || null,
            nameOnDoc: uploadForm.nameOnDoc,
            isExpiredSim: uploadForm.isExpiredSim,
            isMismatchSim: uploadForm.isMismatchSim,
            status: uploadForm.isExpiredSim ? 'Expired' : (uploadForm.isMismatchSim ? 'Mismatched' : 'Verified')
        };

        const updatedDocs = {
            ...selectedEmployee.profile.documents,
            [uploadModal.docKey]: docRecord
        };

        const hasAadhaar = updatedDocs['aadhaar']?.uploaded;
        const hasPan = updatedDocs['pan']?.uploaded;
        const autoCheckDocs = (hasAadhaar && hasPan);

        const updatedProfile = {
            ...selectedEmployee.profile,
            documents: updatedDocs,
            onboarding_checklist: {
                ...selectedEmployee.profile.onboarding_checklist,
                docs_submitted: autoCheckDocs ? true : selectedEmployee.profile.onboarding_checklist.docs_submitted
            }
        };

        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        setUploadModal(prev => ({ ...prev, isOpen: false }));
        toast.success(`Uploaded ${uploadModal.docName} successfully!`);
    };

    const handleDeleteDocument = (docKey, docName) => {
        const updatedDocs = { ...selectedEmployee.profile.documents };
        delete updatedDocs[docKey];

        const updatedProfile = {
            ...selectedEmployee.profile,
            documents: updatedDocs
        };

        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.info(`Removed ${docName}`);
    };

    // AI Auditor Scan Simulations
    const runAiVerification = () => {
        setIsVerifying(true);
        setTimeout(() => {
            const missing = [];
            const expired = [];
            const mismatched = [];

            const activeDocTemplateId = selectedEmployee.profile.document_template_id || (documentTemplates[0]?.id || '');
            const activeDocTemplate = documentTemplates.find(t => t.id === activeDocTemplateId) || documentTemplates[0];
            const categories = activeDocTemplate?.categories || [];
            
            const docExclusions = selectedEmployee.profile.document_exclusions || [];

            categories.forEach(category => {
                category.items?.forEach(item => {
                    if (docExclusions.includes(item.key)) return; // Skip excluded document fields

                    const doc = selectedEmployee.profile.documents[item.key];
                    if (item.required && (!doc || !doc.uploaded)) {
                        missing.push(item.name);
                    } else if (doc && doc.uploaded) {
                        if (doc.expiryDate && new Date(doc.expiryDate) < new Date()) {
                            expired.push(`${item.name} (Expired on ${doc.expiryDate})`);
                            doc.status = 'Expired';
                        }
                        if (doc.isExpiredSim) {
                            expired.push(`${item.name} (Simulated Expiration error)`);
                        }
                        if (doc.nameOnDoc && doc.nameOnDoc.trim().toLowerCase() !== selectedEmployee.name.trim().toLowerCase()) {
                            mismatched.push(`${item.name} lists name "${doc.nameOnDoc}" instead of "${selectedEmployee.name}"`);
                            doc.status = 'Mismatched';
                        }
                        if (doc.isMismatchSim) {
                            mismatched.push(`${item.name} lists name "${doc.nameOnDoc}" instead of "${selectedEmployee.name}"`);
                        }
                    }
                });
            });

            // OCR extracted metadata
            const extractedMetadata = {};
            const securityChecks = {};
            const discrepancies = [];

            const hrName = selectedEmployee.name;
            const hrDob = selectedEmployee.profile.dob || '1995-12-10';
            const hrGender = selectedEmployee.profile.gender || 'Male';
            const hrAddress = selectedEmployee.profile.address || 'Flat 402, Sunshine Apartments, Bangalore';

            // Loop through categories to populate OCR and Security logs for any uploaded document
            categories.forEach(category => {
                category.items?.forEach(item => {
                    if (docExclusions.includes(item.key)) return;
                    const doc = selectedEmployee.profile.documents[item.key];
                    if (doc && doc.uploaded) {
                        if (item.key === 'aadhaar') {
                            extractedMetadata.aadhaar = [
                                { field: 'Extracted Name', value: doc.nameOnDoc || hrName, confidence: 99 },
                                { field: 'Aadhaar Number', value: 'XXXX-XXXX-8901', confidence: 99 },
                                { field: 'Date of Birth', value: hrDob, confidence: 98 },
                                { field: 'Gender', value: hrGender, confidence: 99 },
                                { field: 'Address', value: hrAddress.substring(0, 30) + '...', confidence: 92 }
                            ];
                            securityChecks.aadhaar = { hologram: 'Passed', blur: 0.08, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'pan') {
                            extractedMetadata.pan = [
                                { field: 'Extracted Name', value: (doc.nameOnDoc || hrName).toUpperCase(), confidence: 97 },
                                { field: 'PAN Number', value: 'ABCDE1234F', confidence: 99 },
                                { field: 'Date of Birth', value: hrDob, confidence: 98 },
                                { field: 'Father\'s Name', value: 'K. Suresh', confidence: 90 }
                            ];
                            securityChecks.pan = { hologram: 'Passed', blur: 0.11, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'grad_degree' || item.key === 'degree') {
                            const degreeName = doc.nameOnDoc || (hrName.split(' ')[0] + ' V.');
                            extractedMetadata[item.key] = [
                                { field: 'Extracted Name', value: degreeName, confidence: 94 },
                                { field: 'Degree Type', value: 'Bachelor of Technology', confidence: 98 },
                                { field: 'Major/Branch', value: 'Computer Science', confidence: 97 },
                                { field: 'University', value: 'Anna University', confidence: 95 },
                                { field: 'Passing Year', value: '2014', confidence: 99 }
                            ];
                            securityChecks[item.key] = { hologram: 'N/A', blur: 0.14, metadata: 'Passed', editing: 'Flagged' };

                            const prevDiscrepancies = selectedEmployee.profile.ai_verification_results?.discrepancies || [];
                            const prevOverride = prevDiscrepancies.find(d => d.id === 'name_degree_mismatch');

                            discrepancies.push({
                                id: 'name_degree_mismatch',
                                field: 'Name',
                                sourceA: 'HR Profile',
                                valueA: hrName,
                                sourceB: 'Degree Certificate',
                                valueB: degreeName,
                                severity: 'High',
                                isOverridden: prevOverride ? prevOverride.isOverridden : false,
                                overrideReason: prevOverride ? prevOverride.overrideReason : '',
                                overriddenBy: prevOverride ? prevOverride.overriddenBy : '',
                                overriddenAt: prevOverride ? prevOverride.overriddenAt : ''
                            });
                        } else if (item.key === 'passport') {
                            extractedMetadata.passport = [
                                { field: 'Extracted Name', value: doc.nameOnDoc || hrName, confidence: 99 },
                                { field: 'Passport Number', value: 'Z9876543', confidence: 99 },
                                { field: 'Expiry Date', value: doc.expiryDate || '2030-05-15', confidence: 99 },
                                { field: 'Nationality', value: 'Indian', confidence: 99 }
                            ];
                            securityChecks.passport = { hologram: 'Passed', blur: 0.05, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'experience_letter') {
                            extractedMetadata.experience_letter = [
                                { field: 'Extracted Name', value: doc.nameOnDoc || hrName, confidence: 96 },
                                { field: 'Employer Name', value: 'PPL Solutions Pvt Ltd', confidence: 98 },
                                { field: 'Designation', value: 'Software Engineer', confidence: 95 },
                                { field: 'Tenure', value: '2 Years (2022 - 2024)', confidence: 92 }
                            ];
                            securityChecks.experience_letter = { hologram: 'N/A', blur: 0.12, metadata: 'Passed', editing: 'Passed' };
                        } else {
                            extractedMetadata[item.key] = [
                                { field: 'Extracted Name', value: doc.nameOnDoc || hrName, confidence: 95 },
                                { field: 'Document Status', value: 'Uploaded & Parsed', confidence: 90 }
                            ];
                            securityChecks[item.key] = { hologram: 'N/A', blur: 0.10, metadata: 'Passed', editing: 'Passed' };
                        }
                    }
                });
            });

            // Calculate overall compliance score:
            let score = 100;
            score -= (missing.length * 10);
            score -= (expired.length * 15);
            
            discrepancies.forEach(d => {
                if (!d.isOverridden) {
                    score -= 15;
                }
            });

            Object.values(securityChecks).forEach(checks => {
                if (checks.editing === 'Flagged') score -= 10;
                if (checks.hologram === 'Failed') score -= 10;
            });

            score = Math.max(0, Math.min(100, score));

            const updatedProfile = {
                ...selectedEmployee.profile,
                ai_verification_results: {
                    missing_documents: missing,
                    expired_documents: expired,
                    mismatched_information: mismatched,
                    extractedMetadata,
                    securityChecks,
                    discrepancies,
                    auditScore: score,
                    lastChecked: new Date().toLocaleString()
                }
            };

            saveEmployeeProfile(selectedEmployee.id, updatedProfile);
            setIsVerifying(false);
            toast.success("AI Document Audit complete!");
        }, 2000);
    };

    const handleOverrideDiscrepancy = (id, reason) => {
        if (!reason.trim()) {
            toast.warn("Please provide an override reason.");
            return;
        }

        const currentResults = selectedEmployee.profile.ai_verification_results || {};
        const discrepancies = currentResults.discrepancies || [];
        
        const updatedDiscrepancies = discrepancies.map(d => {
            if (d.id === id) {
                return {
                    ...d,
                    isOverridden: true,
                    overrideReason: reason,
                    overriddenBy: 'Admin (System)',
                    overriddenAt: new Date().toLocaleString()
                };
            }
            return d;
        });

        // Recalculate score
        let score = 100;
        score -= ((currentResults.missing_documents || []).length * 10);
        score -= ((currentResults.expired_documents || []).length * 15);
        
        updatedDiscrepancies.forEach(d => {
            if (!d.isOverridden) {
                score -= 15;
            }
        });

        const securityChecks = currentResults.securityChecks || {};
        Object.values(securityChecks).forEach(checks => {
            if (checks.editing === 'Flagged') score -= 10;
            if (checks.hologram === 'Failed') score -= 10;
        });

        score = Math.max(0, Math.min(100, score));

        const updatedProfile = {
            ...selectedEmployee.profile,
            ai_verification_results: {
                ...currentResults,
                discrepancies: updatedDiscrepancies,
                auditScore: score
            }
        };

        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        setOverridingDiscrepancyId(null);
        setOverrideReasonText('');
        toast.success("Discrepancy override saved successfully!");
    };

    const handleRevokeOverride = (id) => {
        const currentResults = selectedEmployee.profile.ai_verification_results || {};
        const discrepancies = currentResults.discrepancies || [];
        
        const updatedDiscrepancies = discrepancies.map(d => {
            if (d.id === id) {
                return {
                    ...d,
                    isOverridden: false,
                    overrideReason: '',
                    overriddenBy: '',
                    overriddenAt: ''
                };
            }
            return d;
        });

        // Recalculate score
        let score = 100;
        score -= ((currentResults.missing_documents || []).length * 10);
        score -= ((currentResults.expired_documents || []).length * 15);
        
        updatedDiscrepancies.forEach(d => {
            if (!d.isOverridden) {
                score -= 15;
            }
        });

        const securityChecks = currentResults.securityChecks || {};
        Object.values(securityChecks).forEach(checks => {
            if (checks.editing === 'Flagged') score -= 10;
            if (checks.hologram === 'Failed') score -= 10;
        });

        score = Math.max(0, Math.min(100, score));

        const updatedProfile = {
            ...selectedEmployee.profile,
            ai_verification_results: {
                ...currentResults,
                discrepancies: updatedDiscrepancies,
                auditScore: score
            }
        };

        saveEmployeeProfile(selectedEmployee.id, updatedProfile);
        toast.info("Override revoked.");
    };

    const handleFormSuccess = () => {
        fetchEmployees(selectedEmployee.id);
        setEditMode(false);
    };

    return (
        <DashboardLayout title="Employee Master Directory (Unified)">
            <div className="space-y-6">
                
                {/* 4 Top Metric & Status Filtering Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    {/* Card 1: Total Employees (Resets Onboarding Quick filters) */}
                    <div 
                        onClick={() => setOnboardingFilter('All')}
                        className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                            onboardingFilter === 'All'
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                                : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                        }`}
                    >
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Users size={20} />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Total registered</span>
                            <p className="text-xl font-bold mt-0.5">{employees.filter(e => e.status === statusFilter).length}</p>
                        </div>
                    </div>

                    {/* Card 2: Onboarding Completed Filter Card */}
                    <div 
                        onClick={() => setOnboardingFilter(onboardingFilter === 'Completed' ? 'All' : 'Completed')}
                        className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                            onboardingFilter === 'Completed'
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                                : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                        }`}
                    >
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Onboarding Completed</span>
                            <p className="text-xl font-bold mt-0.5">
                                {employees.filter(e => {
                                    if (e.status !== statusFilter) return false;
                                    const profile = getEmployeeProfile(e.id, e.name);
                                    return getOnboardingProgress(profile.onboarding_checklist, profile.checklist_template_id) === 100;
                                }).length}
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Onboarding In-Progress Filter Card */}
                    <div 
                        onClick={() => setOnboardingFilter(onboardingFilter === 'InProgress' ? 'All' : 'InProgress')}
                        className={`border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                            onboardingFilter === 'InProgress'
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                                : 'bg-white dark:bg-github-dark-subtle border-slate-200 dark:border-github-dark-border hover:shadow-sm'
                        }`}
                    >
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
                            <Clock size={20} />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Onboarding In-Progress</span>
                            <p className="text-xl font-bold mt-0.5">
                                {employees.filter(e => {
                                    if (e.status !== statusFilter) return false;
                                    const profile = getEmployeeProfile(e.id, e.name);
                                    const progress = getOnboardingProgress(profile.onboarding_checklist, profile.checklist_template_id);
                                    return progress > 0 && progress < 100;
                                }).length}
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Integrated Status Tab Filter Control */}
                    <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3 rounded-xl flex flex-col justify-between shadow-sm select-none">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-2 block">
                            Employee Status Filter
                        </span>
                        
                        {/* Segmented controls mirroring second image */}
                        <div className="flex bg-slate-100 dark:bg-github-dark-border/40 p-0.5 rounded-lg border border-slate-200 dark:border-github-dark-border/60">
                            {[
                                { id: 'Active', label: 'Active', icon: <UserCheck size={13} />, count: activeCount },
                                { id: 'Inactive', label: 'Inactive', icon: <UserX size={13} />, count: inactiveCount },
                                { id: 'Deleted', label: 'Trash', icon: <Trash2 size={13} />, count: trashCount }
                            ].map((tab) => {
                                const isSelected = statusFilter === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                                            isSelected
                                                ? 'bg-white dark:bg-[#1f2937] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-800'
                                                : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-350'
                                        }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                        <span className="text-[9px] opacity-65 font-mono">({tab.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Operations & Customizer Row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        
                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email, or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        {/* Department Dropdown */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border rounded-lg text-xs text-slate-700 dark:text-github-dark-text focus:outline-none cursor-pointer"
                            >
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>

                        {/* Customize Columns Trigger (Relative Popover Container) */}
                        <div className="relative w-full sm:w-auto">
                            <button
                                onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold w-full sm:w-auto transition-all ${
                                    showColumnCustomizer 
                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-400 text-indigo-600 dark:text-indigo-400' 
                                        : 'bg-slate-50 dark:bg-github-dark-subtle/50 border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-text hover:bg-slate-100'
                                }`}
                            >
                                <Sliders size={14} />
                                <span>Customize Columns</span>
                            </button>

                            {/* Column customizer popover box */}
                            {showColumnCustomizer && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowColumnCustomizer(false)} />
                                    <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl p-4 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-github-dark-border">
                                            <span className="font-bold text-xs text-slate-700 dark:text-github-dark-text">Toggle Columns</span>
                                            <button 
                                                onClick={resetColumnsToDefault}
                                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                Reset Default
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1">Default columns</span>
                                            {[
                                                { key: 'employee', label: 'Employee Profile' },
                                                { key: 'roleDept', label: 'Role & Dept' },
                                                { key: 'shift', label: 'Work Shift' },
                                                { key: 'geofences', label: 'Allowed Geofences' },
                                                { key: 'joiningDate', label: 'Joining Date' },
                                                { key: 'onboardingProgress', label: 'Onboarding Progress' },
                                                { key: 'actions', label: 'Row Actions' }
                                            ].map(col => (
                                                <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-slate-600 dark:text-github-dark-text">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={visibleColumns[col.key]} 
                                                        onChange={() => toggleColumn(col.key)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5"
                                                    />
                                                    <span>{col.label}</span>
                                                </label>
                                            ))}

                                            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400 mt-3 mb-1">Optional Extras</span>
                                            {[
                                                { key: 'employeeId', label: 'Employee ID' },
                                                { key: 'phone', label: 'Phone Number' },
                                                { key: 'reportingManager', label: 'Reporting Manager' },
                                                { key: 'workLocation', label: 'Work Location' },
                                                { key: 'address', label: 'Home Address' }
                                            ].map(col => (
                                                <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-slate-650 dark:text-github-dark-muted">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={visibleColumns[col.key]} 
                                                        onChange={() => toggleColumn(col.key)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5"
                                                    />
                                                    <span>{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Operational Buttons */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button 
                            onClick={() => setShowTemplatesModal(true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Sliders size={14} className="text-indigo-600 dark:text-indigo-400" />
                            <span>Manage Templates</span>
                        </button>
                        <Link 
                            to="/employees/bulk" 
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-github-dark-text bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Upload size={14} />
                            <span>Bulk Upload</span>
                        </Link>
                        <Link 
                            to="/employees/add" 
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                        >
                            <Plus size={14} />
                            <span>Add Employee</span>
                        </Link>
                    </div>
                </div>

                {/* Main Dynamic Columns Table */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm transition-colors duration-300">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 dark:bg-github-dark-subtle border-b border-slate-200 dark:border-github-dark-border">
                                <tr className="text-slate-500 dark:text-github-dark-muted font-bold text-xs uppercase tracking-wider">
                                    {visibleColumns.employeeId && <th className="px-6 py-4 font-bold">Emp ID</th>}
                                    {visibleColumns.employee && <th className="px-6 py-4 font-bold">Employee</th>}
                                    {visibleColumns.roleDept && <th className="px-6 py-4 font-bold">Role & Dept</th>}
                                    {visibleColumns.phone && <th className="px-6 py-4 font-bold">Phone</th>}
                                    {visibleColumns.shift && <th className="px-6 py-4 font-bold">Shift</th>}
                                    {visibleColumns.geofences && <th className="px-6 py-4 font-bold">Allowed Geofences</th>}
                                    {visibleColumns.joiningDate && <th className="px-6 py-4 font-bold">Joining Date</th>}
                                    {visibleColumns.reportingManager && <th className="px-6 py-4 font-bold">Reporting Manager</th>}
                                    {visibleColumns.workLocation && <th className="px-6 py-4 font-bold">Work Location</th>}
                                    {visibleColumns.address && <th className="px-6 py-4 font-bold">Address</th>}
                                    {visibleColumns.onboardingProgress && <th className="px-6 py-4 font-bold">Onboarding</th>}
                                    {visibleColumns.actions && <th className="px-6 py-4 font-bold text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="12" className="px-6 py-12 text-center text-slate-400 italic">
                                            Loading employee directory files...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp) => {
                                        const profile = getEmployeeProfile(emp.id, emp.name);
                                        const progress = getOnboardingProgress(profile.onboarding_checklist, profile.checklist_template_id);
                                        
                                        return (
                                            <tr
                                                key={emp.id}
                                                onClick={() => handleSelectEmployee(emp)}
                                                className="group hover:bg-indigo-50/35 dark:hover:bg-[#161b22]/30 cursor-pointer border-l-2 border-transparent hover:border-indigo-500 transition-all duration-200"
                                            >
                                                {/* 1. Employee ID */}
                                                {visibleColumns.employeeId && (
                                                    <td className="px-6 py-4 font-mono font-bold text-[#0969da] dark:text-github-dark-accent">
                                                        {emp.user_code}
                                                    </td>
                                                )}

                                                {/* 2. Employee Profile */}
                                                {visibleColumns.employee && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                                {emp.profile_image_url ? (
                                                                    <img src={`${emp.profile_image_url}?t=${avatarTimestamp}`} alt={emp.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    emp.name.charAt(0)
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-850 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                                                    {emp.name}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-medium">{emp.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 3. Role & Dept */}
                                                {visibleColumns.roleDept && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-750 dark:text-slate-350">{emp.designation}</span>
                                                            <span className="text-xs font-semibold text-slate-400">{emp.department}</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 4. Phone */}
                                                {visibleColumns.phone && (
                                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 font-mono">
                                                        {emp.phone}
                                                    </td>
                                                )}

                                                {/* 5. Shift */}
                                                {visibleColumns.shift && (
                                                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                                                        {emp.shift}
                                                    </td>
                                                )}

                                                {/* 6. Geofences */}
                                                {visibleColumns.geofences && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            {emp.workLocations && emp.workLocations.filter(l => l.is_active).length > 0 ? (
                                                                emp.workLocations.filter(l => l.is_active).map((loc, i) => (
                                                                    <span key={i} className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-github-dark-border text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-github-dark-border whitespace-nowrap">
                                                                        {loc.loc_name}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">Office Bound</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 7. Joining Date */}
                                                {visibleColumns.joiningDate && (
                                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono font-medium">
                                                        {profile.joining_date || emp.joiningDate || '-'}
                                                    </td>
                                                )}

                                                {/* 8. Reporting Manager */}
                                                {visibleColumns.reportingManager && (
                                                    <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">
                                                        {profile.reporting_manager}
                                                    </td>
                                                )}

                                                {/* 9. Work Location */}
                                                {visibleColumns.workLocation && (
                                                    <td className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">
                                                        {profile.work_location}
                                                    </td>
                                                )}

                                                {/* 10. Address */}
                                                {visibleColumns.address && (
                                                    <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 max-w-xs truncate" title={profile.address}>
                                                        {profile.address}
                                                    </td>
                                                )}

                                                {/* 11. Onboarding Progress */}
                                                {visibleColumns.onboardingProgress && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 min-w-[120px]">
                                                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        progress === 100 
                                                                            ? 'bg-emerald-500' 
                                                                            : progress > 50 
                                                                                ? 'bg-indigo-500' 
                                                                                : 'bg-amber-500'
                                                                    }`} 
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold font-mono text-[10px]">{progress}%</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 12. Actions */}
                                                {visibleColumns.actions && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                            {emp.status === 'Deleted' ? (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => handleRestore(e, emp.id)}
                                                                        title="Restore Employee"
                                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors"
                                                                    >
                                                                        <RotateCcw size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleForceDelete(e, emp.id)}
                                                                        title="Delete Permanently"
                                                                        className="p-1.5 text-red-500 hover:bg-red-55 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => handleToggleStatus(e, emp.id, emp.is_active)}
                                                                        title={emp.is_active ? "Deactivate" : "Activate"}
                                                                        disabled={emp.designation === 'admin'}
                                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                                            emp.designation === 'admin'
                                                                                ? 'opacity-40 cursor-not-allowed text-slate-400'
                                                                                : emp.is_active 
                                                                                    ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20' 
                                                                                    : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                                                        }`}
                                                                    >
                                                                        {emp.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                                                                    </button>
                                                                    
                                                                    <button
                                                                        onClick={(e) => {
                                                                            handleSelectEmployee(emp);
                                                                            setTimeout(() => setEditMode(true), 150);
                                                                        }}
                                                                        title="Edit Details"
                                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors"
                                                                    >
                                                                        <Edit2 size={15} />
                                                                    </button>
                                                                    
                                                                    <button
                                                                        onClick={(e) => handleDelete(e, emp.id)}
                                                                        title="Move to Trash"
                                                                        disabled={emp.designation === 'admin'}
                                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                                            emp.designation === 'admin'
                                                                                ? 'opacity-40 cursor-not-allowed text-slate-400'
                                                                                : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                                                                        }`}
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="12" className="px-6 py-12 text-center text-slate-500 dark:text-github-dark-muted font-medium">
                                            <div className="flex flex-col items-center gap-2">
                                                <Search size={32} className="text-slate-350 dark:text-slate-700" />
                                                <p>No employees found matching the filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* UNIFIED DETAILS & EDIT SIDEBAR DRAWER */}
            <AnimatePresence>
                {selectedEmployee && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedEmployee(null)}
                            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
                        />

                        {/* Slider Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed right-0 top-0 h-full w-full max-w-[950px] z-50 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-github-dark-border shadow-2xl flex flex-col overflow-hidden"
                        >
                            
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                        {selectedEmployee.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text leading-tight">
                                            {selectedEmployee.name}
                                        </h3>
                                        <p className="text-[10px] text-slate-400 dark:text-github-dark-muted font-mono">
                                            {selectedEmployee.user_code} • {selectedEmployee.designation}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {drawerTab === 'profile' && !editMode && (
                                        <button
                                            onClick={() => setEditMode(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-250 dark:border-github-dark-border bg-white dark:bg-github-dark-subtle hover:bg-slate-50 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400"
                                        >
                                            <Edit2 size={13} />
                                            <span>Edit Profile</span>
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => setSelectedEmployee(null)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Navigation Tabs (Merged HRM + List views) */}
                            <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none border-b border-slate-100 dark:border-github-dark-border text-xs bg-slate-50/50 dark:bg-github-dark-subtle/10 px-2">
                                {[
                                    { id: 'profile', label: 'Profile Information', icon: <User size={14} /> },
                                    { id: 'checklist', label: 'Onboarding Checklist', icon: <CheckCircle2 size={14} /> },
                                    { id: 'documents', label: 'Document Files', icon: <FileText size={14} /> },
                                    { id: 'ai_verify', label: 'AI Auditor', icon: <Sparkles size={14} /> },
                                    { id: 'perf_goals', label: 'KPI & Goals', icon: <Award size={14} /> },
                                    { id: 'perf_reviews', label: 'Reviews & Ratings', icon: <FileText size={14} /> },
                                    { id: 'perf_analyzer', label: 'AI Performance', icon: <Sparkles size={14} /> }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setDrawerTab(tab.id); setEditMode(false); }}
                                        className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-semibold transition-all shrink-0 ${
                                            drawerTab === tab.id
                                                ? 'border-[#0969da] text-[#0969da] dark:border-github-dark-accent dark:text-[#f0f6fc]'
                                                : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-github-dark-muted dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Drawer Body Container */}
                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar text-xs">
                                
                                {/* 1. Profile Information Tab */}
                                {drawerTab === 'profile' && (
                                    <div className="space-y-6">
                                        {editMode ? (
                                            /* Inline rendering of original Edit Form */
                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/10 p-4 rounded-xl border border-slate-100 dark:border-github-dark-border/60">
                                                <EmployeeFormContent
                                                    userId={selectedEmployee.id}
                                                    isSidebarMode={true}
                                                    onSuccess={handleFormSuccess}
                                                    onCancel={() => setEditMode(false)}
                                                />
                                            </div>
                                        ) : (
                                            /* Standard Read-Only Details view */
                                            <div className="space-y-6">
                                                <div className="flex flex-col items-center gap-3 text-center border-b border-slate-100 dark:border-github-dark-border pb-5">
                                                    <div className="relative w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-3xl overflow-hidden border border-slate-200 dark:border-github-dark-border shadow-sm">
                                                        {selectedEmployee.profile_image_url ? (
                                                            <img src={`${selectedEmployee.profile_image_url}?t=${avatarTimestamp}`} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            selectedEmployee.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-github-dark-text tracking-tight">
                                                            {selectedEmployee.name}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{selectedEmployee.email}</p>
                                                        
                                                        <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                            selectedEmployee.status === 'Active' 
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                                                        }`}>
                                                            {selectedEmployee.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Role Designation</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.designation}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Department Scope</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.department}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Mobile Contact</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350 font-mono">{selectedEmployee.phone}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Work Shift Schedule</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.shift}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Reporting Manager</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.profile.reporting_manager}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Joining Date</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350 font-mono">{selectedEmployee.profile.joining_date}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border space-y-3">
                                                    <div>
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Geofence Permissions</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedEmployee.workLocations && selectedEmployee.workLocations.filter(l => l.is_active).length > 0 ? (
                                                                selectedEmployee.workLocations.filter(l => l.is_active).map((loc, i) => (
                                                                    <span key={i} className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-lg">
                                                                        {loc.loc_name}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-slate-400 italic">No custom geofences assigned (bound to global settings)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Office Work Location</span>
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedEmployee.profile.work_location}</span>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Residential Address</span>
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedEmployee.profile.address}</span>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-100 dark:border-github-dark-border grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="block text-[9px] uppercase font-black text-slate-450 tracking-wider mb-1.5">Checklist Template</span>
                                                            <select
                                                                value={selectedEmployee.profile.checklist_template_id || (checklistTemplates[0]?.id || '')}
                                                                onChange={(e) => handleChecklistTemplateChange(e.target.value)}
                                                                className="w-full bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                            >
                                                                {checklistTemplates.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase font-black text-slate-450 tracking-wider mb-1.5">Document Template</span>
                                                            <select
                                                                value={selectedEmployee.profile.document_template_id || (documentTemplates[0]?.id || '')}
                                                                onChange={(e) => handleDocumentTemplateChange(e.target.value)}
                                                                className="w-full bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                            >
                                                                {documentTemplates.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 2. Onboarding Checklist Tab */}
                                {drawerTab === 'checklist' && (() => {
                                    const activeTemplateId = selectedEmployee.profile.checklist_template_id || (checklistTemplates[0]?.id || '');
                                    const activeTemplate = checklistTemplates.find(t => t.id === activeTemplateId) || checklistTemplates[0];
                                    const rawItems = activeTemplate?.items || [];
                                    const exclusions = selectedEmployee.profile.checklist_exclusions || [];
                                    const items = rawItems.filter(item => !exclusions.includes(item.key));
                                    
                                    return (
                                        <div className="space-y-4">
                                            {/* Template assignment & header */}
                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/25 border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <div>
                                                    <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-1">Checklist Template</span>
                                                    <select
                                                        value={activeTemplateId}
                                                        onChange={(e) => handleChecklistTemplateChange(e.target.value)}
                                                        className="bg-transparent border-none p-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer hover:underline"
                                                    >
                                                        {checklistTemplates.map(t => (
                                                            <option key={t.id} value={t.id} className="bg-white dark:bg-dark-card text-slate-800 dark:text-github-dark-text">{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-github-dark-muted block">Completion Rate</span>
                                                    <span className="text-xs font-extrabold text-slate-800 dark:text-github-dark-text mt-0.5">
                                                        {getOnboardingProgress(selectedEmployee.profile, activeTemplateId)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {exclusions.length > 0 && (
                                                <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl text-[10px] text-amber-600 dark:text-amber-400">
                                                    <span>{exclusions.length} task(s) excluded for this employee.</span>
                                                    <button 
                                                        onClick={handleRestoreChecklistExclusions}
                                                        className="font-bold underline uppercase hover:text-amber-700"
                                                    >
                                                        Restore All
                                                    </button>
                                                </div>
                                            )}

                                            <div className="space-y-2.5">
                                                {items.length === 0 ? (
                                                    <div className="text-center py-8 text-slate-400 italic bg-slate-50/20 dark:bg-[#161b22]/10 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                                        {rawItems.length === 0 ? "No checklist items configured for this template." : "All checklist tasks excluded for this employee."}
                                                    </div>
                                                ) : (
                                                    items.map((item) => {
                                                        const isDone = !!selectedEmployee.profile.onboarding_checklist[item.key];
                                                        return (
                                                            <div 
                                                                key={item.key} 
                                                                onClick={() => handleChecklistToggle(item.key)}
                                                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-100 dark:border-github-dark-border rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all select-none group/row"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <CheckCircle2 size={18} className={isDone ? "text-emerald-500" : "text-slate-300 dark:text-slate-750"} />
                                                                    <span className={`font-semibold text-xs ${isDone ? 'text-slate-400 line-through opacity-70' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                                        {item.label}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExcludeChecklistItem(item.key);
                                                                    }}
                                                                    className="opacity-0 group-hover/row:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded transition-all"
                                                                    title="Exclude task for this employee"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 3. Document Files Tab */}
                                {drawerTab === 'documents' && (() => {
                                    const activeDocTemplateId = selectedEmployee.profile.document_template_id || (documentTemplates[0]?.id || '');
                                    const activeDocTemplate = documentTemplates.find(t => t.id === activeDocTemplateId) || documentTemplates[0];
                                    const categories = activeDocTemplate?.categories || [];
                                    const exclusions = selectedEmployee.profile.document_exclusions || [];
                                    
                                    return (
                                        <div className="space-y-6">
                                            {/* Template assignment & header */}
                                            <div className="bg-slate-50 dark:bg-github-dark-subtle/25 border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex justify-between items-center gap-3">
                                                <div>
                                                    <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-1">Document Template</span>
                                                    <select
                                                        value={activeDocTemplateId}
                                                        onChange={(e) => handleDocumentTemplateChange(e.target.value)}
                                                        className="bg-transparent border-none p-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer hover:underline"
                                                    >
                                                        {documentTemplates.map(t => (
                                                            <option key={t.id} value={t.id} className="bg-white dark:bg-dark-card text-slate-800 dark:text-github-dark-text">{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {exclusions.length > 0 && (
                                                    <div className="text-right flex items-center gap-2">
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{exclusions.length} excluded</span>
                                                        <button 
                                                            onClick={handleRestoreDocExclusions}
                                                            className="text-[9px] font-bold underline uppercase text-amber-600 dark:text-amber-400 hover:text-amber-700"
                                                        >
                                                            Restore All
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-6">
                                                {categories.length === 0 ? (
                                                    <div className="text-center py-6 text-slate-400 italic">
                                                        No document categories configured for this template.
                                                    </div>
                                                ) : (
                                                    categories.map((cat) => {
                                                        const activeItems = cat.items?.filter(item => !exclusions.includes(item.key)) || [];
                                                        if (activeItems.length === 0 && (cat.items || []).length > 0) return null; // skip category if all items are excluded
                                                        return (
                                                            <div key={cat.id} className="space-y-2 bg-slate-50/50 dark:bg-[#161b22]/10 border border-slate-155/40 dark:border-github-dark-border p-4 rounded-xl">
                                                                <h5 className="font-bold text-[10px] uppercase text-indigo-500 tracking-wider mb-2">{cat.name}</h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {activeItems.length === 0 ? (
                                                                        <div className="text-slate-405 italic text-xs py-2 col-span-2">No files configured in this category.</div>
                                                                    ) : (
                                                                        activeItems.map((item) => {
                                                                            const doc = selectedEmployee.profile.documents[item.key];
                                                                            const isUploaded = !!doc?.uploaded;
                                                                            
                                                                            return (
                                                                                <div key={item.key} className="flex justify-between items-center p-3 bg-white dark:bg-[#161b22]/30 border border-slate-200/60 dark:border-github-dark-border rounded-lg shadow-sm group/docrow">
                                                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                                                        <FileText size={16} className={isUploaded ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                                                                                        <div className="truncate">
                                                                                            <p className="font-bold text-slate-800 dark:text-github-dark-text truncate">
                                                                                                {item.name} {item.required && <span className="text-red-500">*</span>}
                                                                                            </p>
                                                                                            {isUploaded ? (
                                                                                                <p className="text-[9px] text-slate-400 font-medium font-mono truncate">{doc.fileName}</p>
                                                                                            ) : (
                                                                                                <p className="text-[9px] text-slate-400 italic">Not submitted</p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        {isUploaded ? (
                                                                                            <>
                                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                                                                                    doc.status === 'Verified' ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/20' : 'bg-red-50 text-red-650 dark:bg-red-950/20'
                                                                                                }`}>
                                                                                                    {doc.status}
                                                                                                </span>
                                                                                                <button 
                                                                                                    onClick={() => handleDeleteDocument(item.key, item.name)}
                                                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded"
                                                                                                    title="Delete uploaded file"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </>
                                                                                        ) : (
                                                                                            <button 
                                                                                                onClick={() => openUploadModal(item.key, item.name, cat.id)}
                                                                                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded border border-slate-200 dark:border-github-dark-border"
                                                                                            >
                                                                                                <Upload size={10} />
                                                                                                <span>Upload</span>
                                                                                            </button>
                                                                                        )}
                                                                                        
                                                                                        {/* Exclude file field button */}
                                                                                        <button 
                                                                                            onClick={() => handleExcludeDocItem(item.key)}
                                                                                            className="opacity-0 group-hover/docrow:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-550 rounded"
                                                                                            title="Exclude document field for this employee"
                                                                                        >
                                                                                            <X size={13} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {/* 4. AI Auditor Tab */}
                                {drawerTab === 'ai_verify' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-github-dark-subtle/20 p-4 rounded-xl border border-slate-150/40 dark:border-github-dark-border">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                    <Sparkles size={16} className="text-indigo-500" />
                                                    AI Document Auditor Engine
                                                </h4>
                                                <p className="text-slate-400 text-[10px] mt-0.5">
                                                    Scan matching, expiry tags, and spelling anomalies across files.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={runAiVerification}
                                                disabled={isVerifying}
                                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                            >
                                                <RefreshCw size={13} className={isVerifying ? "animate-spin" : ""} />
                                                {isVerifying ? "Auditing Files..." : "Run AI Auditor"}
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-2">Audit Scan Log</span>
                                                <div className="p-3 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-xl font-mono text-[10px] text-slate-550 dark:text-slate-400">
                                                    Last checked: {selectedEmployee.profile.ai_verification_results.lastChecked || 'Never'}
                                                </div>
                                            </div>

                                            {/* Results listings */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                
                                                {/* Missing docs */}
                                                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                                                    <span className="font-bold text-[10px] uppercase text-slate-400 flex items-center gap-1.5 mb-2">
                                                        <AlertCircle size={14} className="text-slate-450" />
                                                        Missing Fields ({selectedEmployee.profile.ai_verification_results.missing_documents.length})
                                                    </span>
                                                    {selectedEmployee.profile.ai_verification_results.missing_documents.length > 0 ? (
                                                        <ul className="space-y-1 list-disc pl-4 text-slate-500">
                                                            {selectedEmployee.profile.ai_verification_results.missing_documents.map((d, i) => (
                                                                <li key={i}>{d}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-emerald-500 italic font-medium">All required files present.</p>
                                                    )}
                                                </div>

                                                {/* Expired docs */}
                                                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                                                    <span className="font-bold text-[10px] uppercase text-amber-500 flex items-center gap-1.5 mb-2">
                                                        <Clock size={14} />
                                                        Expired Alerts ({selectedEmployee.profile.ai_verification_results.expired_documents.length})
                                                    </span>
                                                    {selectedEmployee.profile.ai_verification_results.expired_documents.length > 0 ? (
                                                        <ul className="space-y-1 list-disc pl-4 text-red-500">
                                                            {selectedEmployee.profile.ai_verification_results.expired_documents.map((d, i) => (
                                                                <li key={i}>{d}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-emerald-500 italic font-medium">No expired records flagged.</p>
                                                    )}
                                                </div>

                                                {/* Name mismatch */}
                                                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                                                    <span className="font-bold text-[10px] uppercase text-red-500 flex items-center gap-1.5 mb-2">
                                                        <ShieldAlert size={14} />
                                                        Name Mismatch ({selectedEmployee.profile.ai_verification_results.mismatched_information.length})
                                                    </span>
                                                    {selectedEmployee.profile.ai_verification_results.mismatched_information.length > 0 ? (
                                                        <ul className="space-y-1 list-disc pl-4 text-red-550">
                                                            {selectedEmployee.profile.ai_verification_results.mismatched_information.map((d, i) => (
                                                                <li key={i}>{d}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-emerald-500 italic font-medium">Names match perfectly.</p>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 5. KPI & Goals Tab */}
                                {drawerTab === 'perf_goals' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                            <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                            <select 
                                                value={selectedCycleId} 
                                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                                className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none"
                                            >
                                                {cycles.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <KpiGoalSheets employeeId={selectedEmployee.id} cycleId={selectedCycleId} />
                                    </div>
                                )}

                                {/* 6. Reviews & Ratings Tab */}
                                {drawerTab === 'perf_reviews' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                            <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                            <select 
                                                value={selectedCycleId} 
                                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                                className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none"
                                            >
                                                {cycles.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <ReviewsAndRatings employeeId={selectedEmployee.id} cycleId={selectedCycleId} />
                                    </div>
                                )}

                                {/* 7. AI Performance Analyzer Tab */}
                                {drawerTab === 'perf_analyzer' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                            <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                            <select 
                                                value={selectedCycleId} 
                                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                                className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none"
                                            >
                                                {cycles.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <AiPerformanceAnalyzer employeeId={selectedEmployee.id} cycleId={selectedCycleId} employeeName={selectedEmployee.name} />
                                    </div>
                                )}

                            </div>
                            
                            {/* Drawer Footer Actions */}
                            <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex gap-3 text-xs">
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="flex-1 px-4 py-3 font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Dismiss Drawer
                                </button>
                            </div>

                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* DOCUMENT UPLOAD SIMULATION MODAL */}
            {uploadModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center p-4 border-b border-slate-155 dark:border-github-dark-border">
                            <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">Upload {uploadModal.docName}</h4>
                            <button onClick={() => setUploadModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleDocumentUploadSave} className="p-4 space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-450 font-semibold mb-1">File Name</label>
                                <input 
                                    type="text" 
                                    value={uploadForm.fileName}
                                    onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none focus:border-indigo-500" 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-slate-450 font-semibold mb-1">Name Printed On Document</label>
                                <input 
                                    type="text" 
                                    value={uploadForm.nameOnDoc}
                                    onChange={(e) => setUploadForm({ ...uploadForm, nameOnDoc: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-slate-450 font-semibold mb-1">Expiry Date (Optional)</label>
                                <input 
                                    type="date" 
                                    value={uploadForm.expiryDate}
                                    onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle/40 border border-slate-250 dark:border-github-dark-border rounded focus:outline-none" 
                                />
                            </div>

                            {/* Simulation error toggles */}
                            <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border space-y-2 bg-indigo-50/20 dark:bg-indigo-950/10 p-3 rounded-lg">
                                <span className="block font-bold text-[9px] uppercase tracking-wider text-indigo-500">AI auditor simulations</span>
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-github-dark-muted">
                                    <input 
                                        type="checkbox" 
                                        checked={uploadForm.isExpiredSim}
                                        onChange={(e) => setUploadForm({ ...uploadForm, isExpiredSim: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                                    />
                                    <span>Simulate Expired Document Warning</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-github-dark-muted">
                                    <input 
                                        type="checkbox" 
                                        checked={uploadForm.isMismatchSim}
                                        onChange={(e) => setUploadForm({ ...uploadForm, isMismatchSim: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                                    />
                                    <span>Simulate Spelling Name Mismatch warning</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setUploadModal(prev => ({ ...prev, isOpen: false }))}
                                    className="flex-1 px-4 py-2.5 font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-center"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-4 py-2.5 font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-center"
                                >
                                    Confirm Upload
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TEMPLATES CONFIGURATION MODAL */}
            {showTemplatesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10">
                            <div>
                                <h4 className="font-black text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                    <Sliders size={16} className="text-indigo-650 dark:text-indigo-400" />
                                    Global Templates Configurations Manager
                                </h4>
                                <p className="text-slate-450 dark:text-github-dark-muted text-[10px] mt-0.5">Configure onboarding and document lists assigned dynamically to employees.</p>
                            </div>
                            <button 
                                onClick={() => setShowTemplatesModal(false)} 
                                className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Segment Tab Toggle */}
                        <div className="flex border-b border-slate-100 dark:border-github-dark-border text-xs bg-slate-50 dark:bg-github-dark-subtle/20 px-4">
                            <button
                                onClick={() => setTemplatesModalTab('checklist')}
                                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                                    templatesModalTab === 'checklist'
                                        ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                                }`}
                            >
                                <CheckCircle2 size={14} />
                                <span>Onboarding Checklist Templates</span>
                            </button>
                            <button
                                onClick={() => setTemplatesModalTab('document')}
                                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                                    templatesModalTab === 'document'
                                        ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                                }`}
                            >
                                <FileText size={14} />
                                <span>Required Documents Templates</span>
                            </button>
                        </div>

                        {/* Main Layout: Split Screen */}
                        <div className="flex-1 flex overflow-hidden text-xs">
                            
                            {/* Left Pane: Templates List Sidebar */}
                            <div className="w-1/3 border-r border-slate-205 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#161b22]/10 p-4 flex flex-col justify-between overflow-y-auto">
                                <div className="space-y-2">
                                    <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-github-dark-muted mb-2">Available Templates</span>
                                    {templatesModalTab === 'checklist' ? (
                                        checklistTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setSelectedChecklistTemplateId(t.id)}
                                                className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex items-center justify-between ${
                                                    selectedChecklistTemplateId === t.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                        : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850/20'
                                                }`}
                                            >
                                                <span>{t.name}</span>
                                                <ArrowRight size={14} className={selectedChecklistTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                            </button>
                                        ))
                                    ) : (
                                        documentTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setSelectedDocTemplateId(t.id)}
                                                className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex items-center justify-between ${
                                                    selectedDocTemplateId === t.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                        : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850/20'
                                                }`}
                                            >
                                                <span>{t.name}</span>
                                                <ArrowRight size={14} className={selectedDocTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                            </button>
                                        ))
                                    )}
                                </div>

                                <button
                                    onClick={templatesModalTab === 'checklist' ? handleAddChecklistTemplate : handleAddDocTemplate}
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-605 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm mt-4 shrink-0"
                                >
                                    <Plus size={14} />
                                    <span>Create New Template</span>
                                </button>
                            </div>

                            {/* Right Pane: Template Details Editor */}
                            <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between">
                                
                                {templatesModalTab === 'checklist' ? (() => {
                                    const template = checklistTemplates.find(t => t.id === selectedChecklistTemplateId) || checklistTemplates[0];
                                    if (!template) return <div className="text-slate-400 italic p-6">No template selected</div>;
                                    return (
                                        <div className="space-y-6 flex-1 flex flex-col justify-between">
                                            <div className="space-y-5">
                                                {/* Template Header */}
                                                <div>
                                                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Template Name</label>
                                                    <input
                                                        type="text"
                                                        value={template.name}
                                                        onChange={(e) => handleUpdateChecklistTemplateName(template.id, e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                {/* Add Task Input */}
                                                <div className="pt-2">
                                                    <span className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5 font-bold">Add Onboarding Task</span>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Set up payroll dashboard, Assign company email"
                                                            value={newChecklistItemText}
                                                            onChange={(e) => setNewChecklistItemText(e.target.value)}
                                                            className="flex-1 bg-white dark:bg-github-dark-subtle/20 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddChecklistTemplateItem(template.id, newChecklistItemText);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handleAddChecklistTemplateItem(template.id, newChecklistItemText)}
                                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-250 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Add Task</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Items List */}
                                                <div className="space-y-2">
                                                    <span className="block text-[10px] uppercase font-black text-slate-450 tracking-wider font-bold">Checklist Tasks ({template.items?.length || 0})</span>
                                                    <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                                                        {template.items && template.items.length === 0 ? (
                                                            <div className="text-slate-400 italic py-4">No tasks in this template yet.</div>
                                                        ) : (
                                                            template.items?.map((item) => (
                                                                <div key={item.key} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#161b22]/30 border border-slate-100 dark:border-github-dark-border rounded-xl">
                                                                    <div className="flex items-center gap-2">
                                                                        <CheckCircle size={15} className="text-slate-400" />
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350">{item.label}</span>
                                                                        <span className="text-[9px] font-mono text-slate-400 opacity-60">({item.key})</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleDeleteChecklistTemplateItem(template.id, item.key)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                                    >
                                                                        <Trash size={13} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Delete Template */}
                                            <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                                                            handleDeleteChecklistTemplate(template.id);
                                                        }
                                                    }}
                                                    className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Delete Checklist Template</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })() : (() => {
                                    const template = documentTemplates.find(t => t.id === selectedDocTemplateId) || documentTemplates[0];
                                    if (!template) return <div className="text-slate-400 italic p-6">No template selected</div>;
                                    return (
                                        <div className="space-y-6 flex-1 flex flex-col justify-between">
                                            <div className="space-y-5">
                                                {/* Template Header */}
                                                <div>
                                                    <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Template Name</label>
                                                    <input
                                                        type="text"
                                                        value={template.name}
                                                        onChange={(e) => handleUpdateDocTemplateName(template.id, e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                {/* Add Category Section */}
                                                <div className="pt-2">
                                                    <span className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5 font-bold">Add Document Category</span>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Legal Documents, Experience Letters"
                                                            value={newDocCatText}
                                                            onChange={(e) => setNewDocCatText(e.target.value)}
                                                            className="flex-1 bg-white dark:bg-github-dark-subtle/20 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddDocTemplateCategory(template.id, newDocCatText);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handleAddDocTemplateCategory(template.id, newDocCatText)}
                                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-250 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Add Category</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Categories & Items Listing */}
                                                <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                                                    <span className="block text-[10px] uppercase font-black text-slate-450 tracking-wider font-bold">Configured Categories ({template.categories?.length || 0})</span>
                                                    {template.categories && template.categories.length === 0 ? (
                                                        <div className="text-slate-400 italic py-4">No categories configured yet.</div>
                                                    ) : (
                                                        template.categories?.map((cat) => (
                                                            <div key={cat.id} className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl space-y-3 bg-slate-50/20 dark:bg-[#161b22]/10">
                                                                <div className="flex justify-between items-center pb-2 border-b border-slate-150/60 dark:border-github-dark-border">
                                                                    <span className="font-bold text-indigo-650 dark:text-indigo-400 uppercase text-[10px] tracking-wider">{cat.name}</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm(`Delete category "${cat.name}"? This removes all file fields inside it.`)) {
                                                                                handleDeleteDocTemplateCategory(template.id, cat.id);
                                                                            }
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                                        title="Delete Category"
                                                                    >
                                                                        <Trash size={12} />
                                                                    </button>
                                                                </div>

                                                                {/* Category Items List */}
                                                                <div className="space-y-1">
                                                                    {cat.items && cat.items.length === 0 ? (
                                                                        <p className="text-[10px] text-slate-400 italic">No document fields in this category.</p>
                                                                    ) : (
                                                                        cat.items?.map((item) => (
                                                                            <div key={item.key} className="flex justify-between items-center py-1.5 px-2.5 bg-white dark:bg-dark-card border border-slate-100 dark:border-github-dark-border/60 rounded-lg">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <FileText size={12} className="text-slate-400" />
                                                                                    <span className="font-semibold">{item.name}</span>
                                                                                    {item.required && <span className="text-red-500 font-bold">* Required</span>}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleDeleteDocTemplateItem(template.id, cat.id, item.key)}
                                                                                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                                                >
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>

                                                                {/* Add Item Form inside Category */}
                                                                <div className="pt-2 border-t border-slate-100 dark:border-github-dark-border/40 grid grid-cols-12 gap-2 items-center">
                                                                    <div className="col-span-6">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="New field name (e.g. Passport Scan)"
                                                                            value={newDocItemNames[cat.id] || ''}
                                                                            onChange={(e) => setNewDocItemNames({ ...newDocItemNames, [cat.id]: e.target.value })}
                                                                            className="w-full bg-white dark:bg-github-dark-subtle/30 border border-slate-200 dark:border-github-dark-border px-2.5 py-1.5 rounded-lg text-xs"
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-3 flex items-center justify-center gap-1 bg-white dark:bg-github-dark-subtle/30 px-2 py-1.5 border border-slate-200 dark:border-github-dark-border rounded-lg">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`req_${cat.id}`}
                                                                            checked={!!newDocItemRequired[cat.id]}
                                                                            onChange={(e) => setNewDocItemRequired({ ...newDocItemRequired, [cat.id]: e.target.checked })}
                                                                            className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                                                        />
                                                                        <label htmlFor={`req_${cat.id}`} className="text-[10px] font-bold text-slate-500 select-none cursor-pointer">Required</label>
                                                                    </div>
                                                                    <div className="col-span-3">
                                                                        <button
                                                                            onClick={() => handleAddDocTemplateItem(template.id, cat.id, newDocItemNames[cat.id] || '', !!newDocItemRequired[cat.id])}
                                                                            className="w-full px-2 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg text-center"
                                                                        >
                                                                            Add Field
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Delete Template */}
                                            <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                                                            handleDeleteDocTemplate(template.id);
                                                        }
                                                    }}
                                                    className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Delete Document Template</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-205 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10 flex justify-end">
                            <button
                                onClick={() => setShowTemplatesModal(false)}
                                className="px-5 py-2.5 bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-705 dark:text-slate-200 font-bold rounded-xl transition-all"
                            >
                                Close Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION / ACTIONS MODALS */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <ConfirmationModal
                        {...confirmModal}
                        isSubmitting={isSubmitting}
                        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default EmployeeUnifiedMaster;
