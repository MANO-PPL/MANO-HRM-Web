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
import { onboardingService } from '../../services/onboardingService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getColumnPreferences, updateColumnPreferences } from '../../services/userService';
import EmployeeFormContent from '../../components/employees/EmployeeFormContent';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { PerformanceHub, AiPerformanceAnalyzer } from '../performance/PerformanceViews';

// Loaded dynamically from configurations database

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
    const [cycles, setCycles] = useState([]);


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

    const [onboardingData, setOnboardingData] = useState({
        checklist_template_id: null,
        document_template_id: null,
        checklist_items: [],
        checklist_progress: [],
        required_documents: [],
        uploaded_documents: []
    });

    const loadEmployeeOnboarding = async (employeeId) => {
        if (!employeeId) return;
        try {
            const res = await onboardingService.getEmployeeOnboardingProgress(employeeId);
            if (res.success) {
                setOnboardingData(res);
            }
        } catch (error) {
            console.error("Error loading onboarding progress:", error);
        }
    };

    // Template States
    const [checklistTemplates, setChecklistTemplates] = useState([]);

    const [documentTemplates, setDocumentTemplates] = useState([]);

    // Template Modals & Forms States
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [templatesModalTab, setTemplatesModalTab] = useState('checklist'); // 'checklist' | 'document' | 'appraisal_cycles'
    const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState('');
    const [selectedDocTemplateId, setSelectedDocTemplateId] = useState('');
    const [selectedCyclesManagerId, setSelectedCyclesManagerId] = useState('');

    const [newChecklistItemText, setNewChecklistItemText] = useState('');
    const [newDocCatText, setNewDocCatText] = useState('');
    const [newDocItemNames, setNewDocItemNames] = useState({}); // catId -> text
    const [newDocItemRequired, setNewDocItemRequired] = useState({}); // catId -> bool
    const [editingCategoryNames, setEditingCategoryNames] = useState({}); // catId -> text
    const [tempChecklistName, setTempChecklistName] = useState('');
    const [tempChecklistId, setTempChecklistId] = useState('');
    const [tempDocName, setTempDocName] = useState('');
    const [tempDocId, setTempDocId] = useState('');
    const [tempCycleName, setTempCycleName] = useState('');
    const [tempCycleId, setTempCycleId] = useState('');
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempStartDateId, setTempStartDateId] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');
    const [tempEndDateId, setTempEndDateId] = useState('');
    const [bulkSelectMode, setBulkSelectMode] = useState(false);
    const [selectedDocIdsForZip, setSelectedDocIdsForZip] = useState([]);

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

    useEffect(() => {
        if (cycles.length > 0 && !selectedCyclesManagerId) {
            setSelectedCyclesManagerId(cycles[0].id);
        }
    }, [cycles, selectedCyclesManagerId]);

    const getLocalDateString = (date = new Date()) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const handleCreateNewCycleInManager = async () => {
        const newId = `cycle-${Date.now()}`;
        const newCycle = {
            id: newId,
            name: 'New Appraisal Cycle',
            type: 'Quarterly',
            status: 'Active',
            startDate: getLocalDateString(),
            endDate: getLocalDateString(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
            targetEmployeeType: 'All'
        };

        // Optimistically update UI
        setCycles(prev => [...prev, newCycle]);
        setSelectedCyclesManagerId(newId);

        try {
            await onboardingService.createPerformanceCycle({
                id: newCycle.id,
                name: newCycle.name,
                type: newCycle.type,
                status: newCycle.status,
                target_group: newCycle.targetEmployeeType,
                start_date: newCycle.startDate,
                end_date: newCycle.endDate
            });
            await refreshCycles();
            toast.success('New Appraisal Cycle created');
        } catch (err) {
            console.error(err);
            toast.error("Failed to create performance cycle");
            await refreshCycles(); // Revert
        }
    };

    const handleUpdateCycleField = async (id, field, value) => {
        const cycle = cycles.find(c => c.id === id);
        if (!cycle) return;

        const updatedCycle = { ...cycle, [field]: value };

        // Optimistically update UI
        setCycles(prev => prev.map(c => c.id === id ? updatedCycle : c));

        try {
            await onboardingService.updatePerformanceCycle(id, {
                name: updatedCycle.name,
                type: updatedCycle.type,
                status: updatedCycle.status,
                target_group: updatedCycle.targetEmployeeType,
                start_date: updatedCycle.startDate,
                end_date: updatedCycle.endDate
            });
            await refreshCycles();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update cycle");
            await refreshCycles(); // Revert
        }
    };

    const handleDeleteCycleFromManager = async (id) => {
        const updated = cycles.filter(c => c.id !== id);
        setCycles(updated);
        
        // Select next available or empty
        if (updated.length > 0) {
            setSelectedCyclesManagerId(updated[0].id);
            if (selectedCycleId === id) {
                setSelectedCycleId(updated[0].id);
            }
        } else {
            setSelectedCyclesManagerId('');
            if (selectedCycleId === id) {
                setSelectedCycleId('');
            }
        }

        try {
            await onboardingService.deletePerformanceCycle(id);
            await refreshCycles();
            toast.info('Performance cycle deleted');
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete performance cycle");
            await refreshCycles(); // Revert
        }
    };

    // Checklist Template Handler functions
    const refreshChecklistTemplates = async () => {
        try {
            const res = await onboardingService.getChecklistTemplates();
            if (res.success) {
                const mapped = res.data.map(t => ({
                    id: t.id,
                    name: t.template_name,
                    description: t.description,
                    items: (t.items || []).map(item => ({
                        key: item.task_key,
                        label: item.task_label,
                        sort_order: item.sort_order
                    }))
                }));
                setChecklistTemplates(mapped);
                if (mapped.length > 0 && !selectedChecklistTemplateId) {
                    setSelectedChecklistTemplateId(mapped[0].id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const refreshDocTemplates = async () => {
        try {
            const res = await onboardingService.getDocumentTemplates();
            if (res.success) {
                const mapped = res.data.map(t => {
                    const categoriesMap = {};
                    (t.items || []).forEach(item => {
                        if (!categoriesMap[item.category]) {
                            categoriesMap[item.category] = { id: item.category, name: item.category, items: [] };
                        }
                        categoriesMap[item.category].items.push({
                            key: item.doc_key,
                            name: item.doc_label,
                            required: !!item.is_mandatory
                        });
                    });
                    return {
                        id: t.id,
                        name: t.template_name,
                        description: t.description,
                        categories: Object.values(categoriesMap)
                    };
                });
                setDocumentTemplates(mapped);
                if (mapped.length > 0 && !selectedDocTemplateId) {
                    setSelectedDocTemplateId(mapped[0].id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const refreshCycles = async () => {
        try {
            const res = await onboardingService.getPerformanceCycles();
            if (res.success) {
                const mapped = res.data.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    status: c.status,
                    targetEmployeeType: c.target_group || 'All',
                    startDate: c.start_date ? c.start_date.split('T')[0] : '',
                    endDate: c.end_date ? c.end_date.split('T')[0] : ''
                }));
                setCycles(mapped);
                if (mapped.length > 0 && !selectedCyclesManagerId) {
                    setSelectedCyclesManagerId(mapped[0].id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddChecklistTemplate = async () => {
        try {
            const res = await onboardingService.createChecklistTemplate({
                template_name: 'New Checklist Template',
                description: '',
                items: [
                    { task_key: 'personal_info', task_label: 'Personal Info Submission', sort_order: 0 }
                ]
            });
            if (res.success) {
                await refreshChecklistTemplates();
                setSelectedChecklistTemplateId(res.data.id);
                toast.success('New checklist template created');
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to create checklist template");
        }
    };

    const handleUpdateChecklistTemplateName = async (id, newName) => {
        const template = checklistTemplates.find(t => t.id === id);
        if (!template) return;
        try {
            await onboardingService.updateChecklistTemplate(id, {
                template_name: newName,
                items: template.items.map(item => ({
                    task_key: item.key,
                    task_label: item.label,
                    sort_order: item.sort_order
                }))
            });
            await refreshChecklistTemplates();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddChecklistTemplateItem = async (id, label) => {
        if (!label.trim()) return;
        const template = checklistTemplates.find(t => t.id === id);
        if (!template) return;

        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        let uniqueKey = key;
        let counter = 1;
        while (template.items.some(item => item.key === uniqueKey)) {
            uniqueKey = `${key}_${counter}`;
            counter++;
        }

        const newItem = { key: uniqueKey, label: label.trim(), sort_order: template.items.length };

        // Optimistically update UI state
        setChecklistTemplates(prev => prev.map(t => {
            if (t.id === id) {
                return { ...t, items: [...t.items, newItem] };
            }
            return t;
        }));
        setNewChecklistItemText('');

        const updatedItems = [
            ...template.items.map(item => ({
                task_key: item.key,
                task_label: item.label,
                sort_order: item.sort_order
            })),
            { task_key: uniqueKey, task_label: label.trim(), sort_order: template.items.length }
        ];

        try {
            await onboardingService.updateChecklistTemplate(id, {
                template_name: template.name,
                items: updatedItems
            });
            await refreshChecklistTemplates();
            toast.success('Item added to template');
        } catch (err) {
            console.error(err);
            toast.error("Failed to add checklist item");
            await refreshChecklistTemplates();
        }
    };

    const handleDeleteChecklistTemplateItem = async (templateId, itemKey) => {
        const template = checklistTemplates.find(t => t.id === templateId);
        if (!template) return;

        // Optimistically update UI state
        setChecklistTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return { ...t, items: t.items.filter(item => item.key !== itemKey) };
            }
            return t;
        }));

        const updatedItems = template.items
            .filter(item => item.key !== itemKey)
            .map(item => ({
                task_key: item.key,
                task_label: item.label,
                sort_order: item.sort_order
            }));

        try {
            await onboardingService.updateChecklistTemplate(templateId, {
                template_name: template.name,
                items: updatedItems
            });
            await refreshChecklistTemplates();
            toast.success('Item removed from template');
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove checklist item");
            await refreshChecklistTemplates();
        }
    };

    const handleDeleteChecklistTemplate = async (id) => {
        if (checklistTemplates.length <= 1) {
            toast.error('Cannot delete the last remaining template');
            return;
        }
        try {
            await onboardingService.deleteChecklistTemplate(id);
            const remaining = checklistTemplates.filter(t => t.id !== id);
            await refreshChecklistTemplates();
            setSelectedChecklistTemplateId(remaining[0].id);
            toast.success('Checklist template deleted');
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete checklist template");
        }
    };

    const handleAddDocTemplate = async () => {
        try {
            const res = await onboardingService.createDocumentTemplate({
                template_name: 'New Document Template',
                description: '',
                items: [
                    { category: 'Identity Documents', doc_key: 'aadhaar', doc_label: 'Aadhaar Card', is_mandatory: true, sort_order: 0 }
                ]
            });
            if (res.success) {
                await refreshDocTemplates();
                setSelectedDocTemplateId(res.data.id);
                toast.success('New document template created');
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to create document template");
        }
    };

    const handleUpdateDocTemplateName = async (id, newName) => {
        const template = documentTemplates.find(t => t.id === id);
        if (!template) return;
        const flatItems = [];
        template.categories.forEach(cat => {
            cat.items.forEach((item, idx) => {
                flatItems.push({
                    category: cat.name,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });
        try {
            await onboardingService.updateDocumentTemplate(id, {
                template_name: newName,
                items: flatItems
            });
            await refreshDocTemplates();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddDocTemplateCategory = async (templateId, categoryName) => {
        if (!categoryName.trim()) return;
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;
        const categoryId = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        
        let uniqueId = categoryId;
        let counter = 1;
        while (template.categories.some(cat => cat.id === uniqueId)) {
            uniqueId = `${categoryId}_${counter}`;
            counter++;
        }

        const placeholderKey = `doc_${Date.now()}`;
        const newCategory = {
            id: uniqueId,
            name: categoryName.trim(),
            items: [{
                key: placeholderKey,
                name: 'New Document Field',
                required: true
            }]
        };

        // Optimistically update UI state
        setDocumentTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return { ...t, categories: [...t.categories, newCategory] };
            }
            return t;
        }));
        setNewDocCatText('');

        const flatItems = [];
        template.categories.forEach(cat => {
            cat.items.forEach((item, idx) => {
                flatItems.push({
                    category: cat.name,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });
        flatItems.push({
            category: categoryName.trim(),
            doc_key: placeholderKey,
            doc_label: 'New Document Field',
            is_mandatory: true,
            sort_order: 0
        });

        try {
            await onboardingService.updateDocumentTemplate(templateId, {
                template_name: template.name,
                items: flatItems
            });
            await refreshDocTemplates();
            toast.success('Category added to template');
        } catch (err) {
            console.error(err);
            toast.error("Failed to add category");
            await refreshDocTemplates();
        }
    };

    const handleRenameDocTemplateCategory = async (templateId, categoryId, newCategoryName) => {
        if (!newCategoryName || !newCategoryName.trim()) return;
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;
        
        const flatItems = [];
        template.categories.forEach(cat => {
            const currentCatName = (cat.id === categoryId) ? newCategoryName.trim() : cat.name;
            cat.items.forEach((item, idx) => {
                flatItems.push({
                    category: currentCatName,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });

        // Optimistically update UI state
        setDocumentTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.map(cat => {
                        if (cat.id === categoryId) {
                            return { ...cat, name: newCategoryName.trim() };
                        }
                        return cat;
                    })
                };
            }
            return t;
        }));

        try {
            await onboardingService.updateDocumentTemplate(templateId, {
                template_name: template.name,
                items: flatItems
            });
            await refreshDocTemplates();
            setEditingCategoryNames(prev => {
                const copy = { ...prev };
                delete copy[categoryId];
                return copy;
            });
            toast.success('Category renamed');
        } catch (err) {
            console.error(err);
            toast.error("Failed to rename category");
            await refreshDocTemplates();
        }
    };

    const handleDeleteDocTemplateCategory = async (templateId, categoryId) => {
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;

        // Optimistically update UI state
        setDocumentTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return { ...t, categories: t.categories.filter(cat => cat.id !== categoryId) };
            }
            return t;
        }));

        const flatItems = [];
        template.categories.forEach(cat => {
            if (cat.id === categoryId || cat.name === categoryId) return;
            cat.items.forEach((item, idx) => {
                flatItems.push({
                    category: cat.name,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });

        try {
            await onboardingService.updateDocumentTemplate(templateId, {
                template_name: template.name,
                items: flatItems
            });
            await refreshDocTemplates();
            toast.success('Category deleted');
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete category");
            await refreshDocTemplates();
        }
    };

    const handleAddDocTemplateItem = async (templateId, categoryId, itemName, isRequired) => {
        if (!itemName.trim()) return;
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;

        const itemKey = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
        const flatItems = [];
        template.categories.forEach(cat => {
            cat.items.forEach((item, idx) => {
                if (item.name === 'New Document Field' && cat.id === categoryId) return;
                flatItems.push({
                    category: cat.name,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });

        let uniqueKey = itemKey;
        let counter = 1;
        while (flatItems.some(i => i.doc_key === uniqueKey)) {
            uniqueKey = `${itemKey}_${counter}`;
            counter++;
        }

        const targetCat = template.categories.find(c => c.id === categoryId);
        const catName = targetCat ? targetCat.name : categoryId;

        const newItem = {
            key: uniqueKey,
            name: itemName.trim(),
            required: !!isRequired
        };

        // Optimistically update UI state
        setDocumentTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.map(cat => {
                        if (cat.id === categoryId) {
                            const filteredItems = cat.items.filter(item => item.name !== 'New Document Field');
                            return { ...cat, items: [...filteredItems, newItem] };
                        }
                        return cat;
                    })
                };
            }
            return t;
        }));
        setNewDocItemNames(prev => ({ ...prev, [categoryId]: '' }));

        flatItems.push({
            category: catName,
            doc_key: uniqueKey,
            doc_label: itemName.trim(),
            is_mandatory: !!isRequired,
            sort_order: flatItems.filter(i => i.category === catName).length
        });

        try {
            await onboardingService.updateDocumentTemplate(templateId, {
                template_name: template.name,
                items: flatItems
            });
            await refreshDocTemplates();
            toast.success('Document item added');
        } catch (err) {
            console.error(err);
            toast.error("Failed to add document item");
            await refreshDocTemplates();
        }
    };

    const handleDeleteDocTemplateItem = async (templateId, categoryId, itemKey) => {
        const template = documentTemplates.find(t => t.id === templateId);
        if (!template) return;

        // Optimistically update UI state
        setDocumentTemplates(prev => prev.map(t => {
            if (t.id === templateId) {
                return {
                    ...t,
                    categories: t.categories.map(cat => {
                        if (cat.id === categoryId) {
                            return { ...cat, items: cat.items.filter(item => item.key !== itemKey) };
                        }
                        return cat;
                    })
                };
            }
            return t;
        }));

        const flatItems = [];
        template.categories.forEach(cat => {
            cat.items.forEach((item, idx) => {
                if (item.key === itemKey) return;
                flatItems.push({
                    category: cat.name,
                    doc_key: item.key,
                    doc_label: item.name,
                    is_mandatory: !!item.required,
                    sort_order: idx
                });
            });
        });

        try {
            await onboardingService.updateDocumentTemplate(templateId, {
                template_name: template.name,
                items: flatItems
            });
            await refreshDocTemplates();
            toast.success('Document item removed');
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove document item");
            await refreshDocTemplates();
        }
    };

    const handleDeleteDocTemplate = async (id) => {
        if (documentTemplates.length <= 1) {
            toast.error('Cannot delete the last remaining template');
            return;
        }
        try {
            await onboardingService.deleteDocumentTemplate(id);
            const remaining = documentTemplates.filter(t => t.id !== id);
            await refreshDocTemplates();
            setSelectedDocTemplateId(remaining[0].id);
            toast.success('Document template deleted');
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete document template");
        }
    };

    const handleChecklistTemplateChange = (templateId) => {
        if (!selectedEmployee) return;

        const currentChecklistTemplateId = selectedEmployee.checklist_template_id || onboardingData?.checklist_template_id;
        if (templateId && currentChecklistTemplateId && String(templateId) === String(currentChecklistTemplateId)) {
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: "Change Checklist Template",
            message: "WARNING: Changing the checklist template will permanently delete all current checklist progress for this employee. All completed and in-progress tasks will be lost. This action cannot be undone. Do you want to proceed?",
            type: 'warning',
            confirmText: "Change Template",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    const currentDocTemplateId = selectedEmployee.document_template_id || onboardingData?.document_template_id;
                    await onboardingService.assignTemplates(
                        selectedEmployee.id,
                        templateId || null,
                        currentDocTemplateId || null
                    );
                    toast.success("Checklist template assigned successfully!");
                    // Refresh employee data so the list has the updated IDs
                    await fetchEmployees(selectedEmployee.id);
                    await loadEmployeeOnboarding(selectedEmployee.id);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to assign checklist template");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    };

    const handleDocumentTemplateChange = (templateId) => {
        if (!selectedEmployee) return;

        const currentDocTemplateId = selectedEmployee.document_template_id || onboardingData?.document_template_id;
        if (templateId && currentDocTemplateId && String(templateId) === String(currentDocTemplateId)) {
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: "Change Document Template",
            message: "WARNING: Changing the document template will permanently delete all currently uploaded and verified documents for this employee from both storage (S3) and the database. All previous progress will be lost. This action cannot be undone. Do you want to proceed?",
            type: 'danger',
            confirmText: "Change Template",
            onConfirm: async () => {
                try {
                    setIsSubmitting(true);
                    const currentChecklistTemplateId = selectedEmployee.checklist_template_id || onboardingData?.checklist_template_id;
                    await onboardingService.assignTemplates(
                        selectedEmployee.id,
                        currentChecklistTemplateId || null,
                        templateId || null
                    );
                    toast.success("Document template assigned successfully!");
                    // Refresh employee data so the list has the updated IDs
                    await fetchEmployees(selectedEmployee.id);
                    await loadEmployeeOnboarding(selectedEmployee.id);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to assign document template");
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
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
    const getEmployeeProfile = (empId, empName, checklistTemplateId = null, documentTemplateId = null) => {
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
            // Case 1: Onboarding In-Progress (50% - 70%)
            defaultProfile = {
                checklist_template_id: 'management_onboarding',
                document_template_id: 'management_docs',
                dob: '1995-11-23',
                gender: 'Male',
                address: 'Building 14, 5th Main, Koramangala, Bangalore, Karnataka',
                joining_date: '2025-10-01',
                employment_type: 'Full-time',
                work_location: 'Headquarters',
                reporting_manager: 'Aditi Rao (HR Director)',
                documents: {
                    aadhaar: { uploaded: true, fileName: `Aadhaar_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2025-09-28', nameOnDoc: empName, status: 'Verified' },
                    pan: { uploaded: true, fileName: `PAN_${empName.replace(/\s+/g, '_')}.pdf`, uploadedAt: '2025-09-28', nameOnDoc: empName, status: 'Verified' },
                    experience_letter: { uploaded: true, fileName: 'PrevCompany_Experience.pdf', uploadedAt: '2025-09-29', nameOnDoc: empName, status: 'Pending' },
                    salary_slips: { uploaded: true, fileName: 'PaySlip_August2025.pdf', uploadedAt: '2025-09-29', nameOnDoc: empName, status: 'Verified' }
                },
                onboarding_checklist: {
                    personal_info: true,
                    laptop_assigned: true,
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

        let merged = { ...defaultProfile };

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                merged = {
                    ...defaultProfile,
                    ...parsed,
                    checklist_template_id: checklistTemplateId !== null && checklistTemplateId !== undefined ? checklistTemplateId : (parsed.checklist_template_id || defaultProfile.checklist_template_id),
                    document_template_id: documentTemplateId !== null && documentTemplateId !== undefined ? documentTemplateId : (parsed.document_template_id || defaultProfile.document_template_id),
                    documents: { ...defaultProfile.documents, ...parsed.documents },
                    onboarding_checklist: { ...defaultProfile.onboarding_checklist, ...parsed.onboarding_checklist },
                    ai_verification_results: { ...defaultProfile.ai_verification_results, ...parsed.ai_verification_results }
                };
            } catch (e) {
                console.error(e);
            }
        } else {
            merged = {
                ...defaultProfile,
                checklist_template_id: checklistTemplateId !== null && checklistTemplateId !== undefined ? checklistTemplateId : defaultProfile.checklist_template_id,
                document_template_id: documentTemplateId !== null && documentTemplateId !== undefined ? documentTemplateId : defaultProfile.document_template_id
            };
        }

        // Overlay database properties if matching employee exists in state
        const dbEmp = employees?.find(e => e.id === empId);
        if (dbEmp) {
            if ('joining_date' in dbEmp) {
                merged.joining_date = dbEmp.joining_date || '-';
            }
            if ('reporting_manager' in dbEmp) {
                merged.reporting_manager = dbEmp.reporting_manager || '-';
            }
            if ('work_location' in dbEmp) {
                merged.work_location = dbEmp.work_location || '-';
            }
            if ('onboarding_progress' in dbEmp) {
                merged.onboarding_progress = dbEmp.onboarding_progress || 0;
            }
        }

        return merged;
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

        const currentTemplates = checklistTemplates;
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
                    workLocations: u.work_locations || [],
                    checklist_template_id: u.checklist_template_id,
                    document_template_id: u.document_template_id,
                    joining_date: u.joining_date ? u.joining_date.substring(0, 10) : null,
                    reporting_manager: u.reporting_manager || null,
                    work_location: u.work_location || null,
                    onboarding_progress: u.onboarding_progress || 0
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
                    const profile = getEmployeeProfile(
                        freshEmp.id, 
                        freshEmp.name, 
                        freshEmp.checklist_template_id, 
                        freshEmp.document_template_id
                    );
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
        refreshChecklistTemplates();
        refreshDocTemplates();
        refreshCycles();
    }, []);

    useEffect(() => {
        if (selectedEmployee?.id) {
            loadEmployeeOnboarding(selectedEmployee.id);
        }
    }, [selectedEmployee?.id]);

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
        const progress = emp.onboarding_progress || 0;
        let matchesOnboarding = true;
        
        if (onboardingFilter === 'Completed') {
            matchesOnboarding = progress === 100;
        } else if (onboardingFilter === 'InProgress') {
            matchesOnboarding = progress > 0 && progress < 100;
        }

        return matchesSearch && matchesDept && matchesStatus && matchesOnboarding;
    });

    const handleSelectEmployee = (emp) => {
        const profile = getEmployeeProfile(emp.id, emp.name, emp.checklist_template_id, emp.document_template_id);
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
    const handleChecklistToggle = async (itemKey) => {
        if (!selectedEmployee) return;
        const currentItem = onboardingData.checklist_progress.find(p => p.task_key === itemKey);
        const nextCompleted = currentItem ? !currentItem.is_completed : true;

        try {
            await onboardingService.toggleChecklistItem(selectedEmployee.id, itemKey, nextCompleted);
            await loadEmployeeOnboarding(selectedEmployee.id);
            await fetchEmployees(selectedEmployee.id);
            toast.success("Checklist task updated");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update checklist task status");
        }
    };

    // Upload verified documents
    const handleDirectDocumentUpload = (itemKey, itemName) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('employee_id', selectedEmployee.id);
            formData.append('doc_key', itemKey);
            formData.append('file', file);

            try {
                toast.loading(`Uploading ${itemName}...`, { id: 'upload_toast' });
                await onboardingService.uploadDocument(formData);
                await loadEmployeeOnboarding(selectedEmployee.id);
                await fetchEmployees(selectedEmployee.id);
                toast.success(`Uploaded ${itemName} successfully!`, { id: 'upload_toast' });
            } catch (error) {
                console.error(error);
                toast.error(error.message || `Failed to upload ${itemName}`, { id: 'upload_toast' });
            }
        };
        input.click();
    };

    const handleDeleteDocument = async (docId, docName) => {
        try {
            await onboardingService.deleteDocument(docId);
            await loadEmployeeOnboarding(selectedEmployee.id);
            await fetchEmployees(selectedEmployee.id);
            toast.info(`Removed ${docName}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete document");
        }
    };

    const handleViewDocument = async (docId) => {
        try {
            const res = await onboardingService.getDocumentUrl(docId);
            if (res.success && res.url) {
                window.open(res.url, '_blank');
            } else {
                toast.error("Failed to fetch pre-signed URL");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to retrieve document view link");
        }
    };

    const loadJSZip = async () => {
        if (window.JSZip) return window.JSZip;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = (e) => reject(new Error('Failed to load JSZip from CDN'));
            document.head.appendChild(script);
        });
    };

    const handleDownloadZip = async () => {
        if (selectedDocIdsForZip.length === 0) {
            toast.info("Please select at least one document to download.");
            return;
        }
        
        const toastId = toast.loading("Generating ZIP archive...");
        
        try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();
            
            for (const docId of selectedDocIdsForZip) {
                const doc = onboardingData.uploaded_documents.find(d => d.id === docId);
                if (!doc) continue;
                
                try {
                    const data = await onboardingService.getDocumentContent(docId);
                    zip.file(doc.file_name, data);
                } catch (fetchErr) {
                    console.error(`Error downloading ${doc.file_name}:`, fetchErr);
                    throw new Error(`Failed to fetch file ${doc.file_name}`);
                }
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${selectedEmployee.name.replace(/\s+/g, '_')}_onboarding_documents.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            toast.update(toastId, { render: "ZIP file downloaded successfully!", type: "success", isLoading: false, autoClose: 3000 });
            setSelectedDocIdsForZip([]);
            setBulkSelectMode(false);
        } catch (err) {
            console.error(err);
            toast.update(toastId, { render: "Failed to generate ZIP archive: " + err.message, type: "error", isLoading: false, autoClose: 4000 });
        }
    };

    const handleVerifyDocument = async (docId, status, comments = '') => {
        try {
            await onboardingService.verifyDocument(docId, status, comments);
            await loadEmployeeOnboarding(selectedEmployee.id);
            toast.success(`Document marked as ${status}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to update verification status");
        }
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

                    const uploadedDoc = onboardingData.uploaded_documents.find(d => d.doc_key === item.key);
                    const legacyDoc = selectedEmployee.profile.documents?.[item.key];
                    const hasDoc = uploadedDoc || legacyDoc?.uploaded;

                    if (item.required && !hasDoc) {
                        missing.push(item.name);
                    } else if (hasDoc) {
                        const expiryDate = legacyDoc?.expiryDate || (uploadedDoc ? '2030-05-15' : null);
                        const nameOnDoc = legacyDoc?.nameOnDoc || (uploadedDoc ? selectedEmployee.name : null);

                        if (expiryDate && new Date(expiryDate) < new Date()) {
                            expired.push(`${item.name} (Expired on ${expiryDate})`);
                            if (legacyDoc) legacyDoc.status = 'Expired';
                        }
                        if (legacyDoc?.isExpiredSim) {
                            expired.push(`${item.name} (Simulated Expiration error)`);
                        }
                        if (nameOnDoc && nameOnDoc.trim().toLowerCase() !== selectedEmployee.name.trim().toLowerCase()) {
                            mismatched.push(`${item.name} lists name "${nameOnDoc}" instead of "${selectedEmployee.name}"`);
                            if (legacyDoc) legacyDoc.status = 'Mismatched';
                        }
                        if (legacyDoc?.isMismatchSim) {
                            mismatched.push(`${item.name} lists name "${legacyDoc.nameOnDoc}" instead of "${selectedEmployee.name}"`);
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
                    const uploadedDoc = onboardingData.uploaded_documents.find(d => d.doc_key === item.key);
                    const legacyDoc = selectedEmployee.profile.documents?.[item.key];
                    const hasDoc = uploadedDoc || legacyDoc?.uploaded;

                    if (hasDoc) {
                        const expiryDate = legacyDoc?.expiryDate || (uploadedDoc ? '2030-05-15' : null);
                        const nameOnDoc = legacyDoc?.nameOnDoc || (uploadedDoc ? selectedEmployee.name : null);

                        if (item.key === 'aadhaar') {
                            extractedMetadata.aadhaar = [
                                { field: 'Extracted Name', value: nameOnDoc || hrName, confidence: 99 },
                                { field: 'Aadhaar Number', value: 'XXXX-XXXX-8901', confidence: 99 },
                                { field: 'Date of Birth', value: hrDob, confidence: 98 },
                                { field: 'Gender', value: hrGender, confidence: 99 },
                                { field: 'Address', value: hrAddress.substring(0, 30) + '...', confidence: 92 }
                            ];
                            securityChecks.aadhaar = { hologram: 'Passed', blur: 0.08, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'pan') {
                            extractedMetadata.pan = [
                                { field: 'Extracted Name', value: (nameOnDoc || hrName).toUpperCase(), confidence: 97 },
                                { field: 'PAN Number', value: 'ABCDE1234F', confidence: 99 },
                                { field: 'Date of Birth', value: hrDob, confidence: 98 },
                                { field: 'Father\'s Name', value: 'K. Suresh', confidence: 90 }
                            ];
                            securityChecks.pan = { hologram: 'Passed', blur: 0.11, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'grad_degree' || item.key === 'degree') {
                            const degreeName = nameOnDoc || (hrName.split(' ')[0] + ' V.');
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
                                { field: 'Extracted Name', value: nameOnDoc || hrName, confidence: 99 },
                                { field: 'Passport Number', value: 'Z9876543', confidence: 99 },
                                { field: 'Expiry Date', value: expiryDate || '2030-05-15', confidence: 99 },
                                { field: 'Nationality', value: 'Indian', confidence: 99 }
                            ];
                            securityChecks.passport = { hologram: 'Passed', blur: 0.05, metadata: 'Passed', editing: 'Passed' };
                        } else if (item.key === 'experience_letter') {
                            extractedMetadata.experience_letter = [
                                { field: 'Extracted Name', value: nameOnDoc || hrName, confidence: 96 },
                                { field: 'Employer Name', value: 'PPL Solutions Pvt Ltd', confidence: 98 },
                                { field: 'Designation', value: 'Software Engineer', confidence: 95 },
                                { field: 'Tenure', value: '2 Years (2022 - 2024)', confidence: 92 }
                            ];
                            securityChecks.experience_letter = { hologram: 'N/A', blur: 0.12, metadata: 'Passed', editing: 'Passed' };
                        } else {
                            extractedMetadata[item.key] = [
                                { field: 'Extracted Name', value: nameOnDoc || hrName, confidence: 95 },
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
        <DashboardLayout title="Employee Master Directory (Unified)" noPadding={true}>
            <div className="h-[calc(100vh-64px)] p-4 flex flex-col overflow-hidden space-y-4">
                
                {/* 4 Top Metric & Status Filtering Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                    
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
                                    return (e.onboarding_progress || 0) === 100;
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
                                    const progress = e.onboarding_progress || 0;
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
                        
                        {/* Segmented controls mirroring recruitment tab bar */}
                        <div className="flex gap-3 p-1.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl">
                            {[
                                { id: 'Active', label: 'Active', icon: UserCheck, count: activeCount },
                                { id: 'Inactive', label: 'Inactive', icon: UserX, count: inactiveCount },
                                { id: 'Deleted', label: 'Trash', icon: Trash2, count: trashCount }
                            ].map((tab) => {
                                const isSelected = statusFilter === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                            isSelected
                                                ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <tab.icon size={14} className={`${isSelected ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-455'} -mt-[1px]`} />
                                        <span>{tab.label}</span>
                                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-slate-100 dark:bg-slate-800 text-[#0969da] dark:text-[#f0f6fc]' : 'bg-slate-200 dark:bg-github-dark-border text-slate-500 dark:text-[#8b949e]'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Operations & Customizer Row */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border p-4 rounded-xl shadow-sm shrink-0">
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
                                                <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 text-xs text-slate-600 dark:text-github-dark-muted">
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
                <div className="flex-1 min-h-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden shadow-sm transition-colors duration-300 flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
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
                                        const progress = emp.onboarding_progress || 0;
                                        
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
                                                                <p className="text-sm font-semibold text-slate-800 dark:text-github-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
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
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-github-dark-border bg-white dark:bg-github-dark-subtle hover:bg-slate-50 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400"
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
                            <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none border-b border-slate-100 dark:border-github-dark-border text-xs bg-slate-50/50 dark:bg-github-dark-subtle/10 px-2">
                                {[
                                    { id: 'profile', label: 'Profile Information', icon: <User size={14} /> },
                                    { type: 'separator' },
                                    { id: 'checklist', label: 'Onboarding Checklist', icon: <CheckCircle2 size={14} /> },
                                    { id: 'documents', label: 'Document Files', icon: <FileText size={14} /> },
                                    { id: 'ai_verify', label: 'AI Auditor', icon: <Sparkles size={14} /> },
                                    { type: 'separator' },
                                    { id: 'perf_hub', label: 'Performance Hub', icon: <Award size={14} /> },
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
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Role Designation</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-355">{selectedEmployee.designation}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Department Scope</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.department}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Mobile Contact</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350 font-mono">{selectedEmployee.phone}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Work Shift Schedule</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-355">{selectedEmployee.shift}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Reporting Manager</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{selectedEmployee.profile.reporting_manager}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border">
                                                        <span className="block text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Joining Date</span>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-350 font-mono">{selectedEmployee.profile.joining_date}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50/50 dark:bg-github-dark-subtle/30 p-4 rounded-xl border border-slate-200/40 dark:border-github-dark-border space-y-3">
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
                                    const activeTemplateId = onboardingData.checklist_template_id || (checklistTemplates[0]?.id || '');
                                    const rawItems = onboardingData.checklist_items || [];
                                    const exclusions = selectedEmployee.profile.checklist_exclusions || [];
                                    const items = rawItems.filter(item => !exclusions.includes(item.task_key));
                                    
                                    const totalTasks = items.length;
                                    const completedTasks = onboardingData.checklist_progress.filter(
                                        p => p.is_completed && rawItems.some(item => item.task_key === p.task_key && !exclusions.includes(item.task_key))
                                    ).length;
                                    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
                                                        {rate}%
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
                                                        const progressLog = onboardingData.checklist_progress.find(p => p.task_key === item.task_key);
                                                        const isDone = !!progressLog?.is_completed;
                                                        return (
                                                            <div 
                                                                key={item.task_key} 
                                                                onClick={() => handleChecklistToggle(item.task_key)}
                                                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-100 dark:border-github-dark-border rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all select-none group/row"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <CheckCircle2 size={18} className={isDone ? "text-emerald-500" : "text-slate-300 dark:text-slate-750"} />
                                                                    <span className={`font-semibold text-xs ${isDone ? 'text-slate-400 line-through opacity-70' : 'text-slate-800 dark:text-github-dark-text'}`}>
                                                                        {item.task_label}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExcludeChecklistItem(item.task_key);
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
                                    const activeDocTemplateId = onboardingData.document_template_id || (documentTemplates[0]?.id || '');
                                    const exclusions = selectedEmployee.profile.document_exclusions || [];
                                    
                                    // Construct categories map from flat required documents list
                                    const categoriesMap = {};
                                    (onboardingData.required_documents || []).forEach(reqDoc => {
                                        if (!categoriesMap[reqDoc.category]) {
                                            categoriesMap[reqDoc.category] = { id: reqDoc.category, name: reqDoc.category, items: [] };
                                        }
                                        categoriesMap[reqDoc.category].items.push({
                                            key: reqDoc.doc_key,
                                            name: reqDoc.doc_label,
                                            required: !!reqDoc.is_mandatory
                                        });
                                    });
                                    const categories = Object.values(categoriesMap);
                                    const isAdminOrHr = currentUser?.user_type === 'admin' || currentUser?.user_type === 'hr';

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
                                                <div className="flex items-center gap-2.5">
                                                    {onboardingData.uploaded_documents?.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                setBulkSelectMode(!bulkSelectMode);
                                                                setSelectedDocIdsForZip([]);
                                                            }}
                                                            className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                                                bulkSelectMode 
                                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900" 
                                                                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50 dark:bg-github-dark-subtle dark:border-github-dark-border dark:text-slate-350"
                                                            }`}
                                                        >
                                                            <span>{bulkSelectMode ? "Exit Select" : "Select & Download"}</span>
                                                        </button>
                                                    )}
                                                    {exclusions.length > 0 && (
                                                        <div className="text-right flex items-center gap-2 border-l border-slate-200 dark:border-github-dark-border pl-2.5">
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
                                            </div>

                                            {bulkSelectMode && (
                                                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950/30 p-3.5 rounded-xl flex justify-between items-center gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedDocIdsForZip.length === onboardingData.uploaded_documents.length && onboardingData.uploaded_documents.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedDocIdsForZip(onboardingData.uploaded_documents.map(d => d.id));
                                                                } else {
                                                                    setSelectedDocIdsForZip([]);
                                                                }
                                                            }}
                                                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 dark:border-github-dark-border focus:ring-indigo-500"
                                                        />
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-github-dark-text">
                                                            {selectedDocIdsForZip.length} of {onboardingData.uploaded_documents.length} selected
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={handleDownloadZip}
                                                        disabled={selectedDocIdsForZip.length === 0}
                                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                                                    >
                                                        <Download size={12} />
                                                        <span>Download ZIP</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                                {categories.length === 0 ? (
                                                    <div className="text-center py-6 text-slate-400 italic">
                                                        No document categories configured for this template.
                                                    </div>
                                                ) : (
                                                    categories.map((cat) => {
                                                        const activeItems = cat.items?.filter(item => !exclusions.includes(item.key)) || [];
                                                        if (activeItems.length === 0 && (cat.items || []).length > 0) return null;
                                                        return (
                                                            <div key={cat.id} className="space-y-2 bg-slate-50/50 dark:bg-[#161b22]/10 border border-slate-155/40 dark:border-github-dark-border p-4 rounded-xl">
                                                                <h5 className="font-bold text-[10px] uppercase text-indigo-500 tracking-wider mb-2">{cat.name}</h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {activeItems.length === 0 ? (
                                                                        <div className="text-slate-405 italic text-xs py-2 col-span-2">No files configured in this category.</div>
                                                                    ) : (
                                                                        activeItems.map((item) => {
                                                                            const doc = onboardingData.uploaded_documents.find(d => d.doc_key === item.key);
                                                                            const isUploaded = !!doc;
                                                                            
                                                                            return (
                                                                                <div key={item.key} className="flex justify-between items-center p-3 bg-white dark:bg-[#161b22]/30 border border-slate-200/60 dark:border-github-dark-border rounded-lg shadow-sm group/docrow">
                                                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                                                        {bulkSelectMode && isUploaded ? (
                                                                                            <input 
                                                                                                type="checkbox"
                                                                                                checked={selectedDocIdsForZip.includes(doc.id)}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.checked) {
                                                                                                        setSelectedDocIdsForZip(prev => [...prev, doc.id]);
                                                                                                    } else {
                                                                                                        setSelectedDocIdsForZip(prev => prev.filter(id => id !== doc.id));
                                                                                                    }
                                                                                                }}
                                                                                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 dark:border-github-dark-border focus:ring-indigo-500 mr-1 shrink-0"
                                                                                            />
                                                                                        ) : (
                                                                                            <FileText size={16} className={isUploaded ? "text-indigo-500" : "text-slate-300 dark:text-slate-700"} />
                                                                                        )}
                                                                                        <div className="truncate">
                                                                                            <p className="font-bold text-slate-800 dark:text-github-dark-text truncate">
                                                                                                {item.name} {item.required && <span className="text-red-500">*</span>}
                                                                                            </p>
                                                                                            {isUploaded ? (
                                                                                                <>
                                                                                                    <p className="text-[9px] text-slate-400 font-medium font-mono truncate">{doc.file_name}</p>
                                                                                                    {doc.verification_comments && (
                                                                                                        <p className="text-[9px] text-red-500 italic mt-0.5">Reason: {doc.verification_comments}</p>
                                                                                                    )}
                                                                                                </>
                                                                                            ) : (
                                                                                                <p className="text-[9px] text-slate-400 italic">Not submitted</p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        {isUploaded ? (
                                                                                            <>
                                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                                                                                    doc.verified_status === 'Verified' ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/20' : 
                                                                                                    doc.verified_status === 'Rejected' ? 'bg-red-50 text-red-650 dark:bg-red-950/20' :
                                                                                                    'bg-amber-50 text-amber-650 dark:bg-amber-950/20'
                                                                                                }`}>
                                                                                                    {doc.verified_status}
                                                                                                </span>
                                                                                                <button 
                                                                                                    onClick={() => handleViewDocument(doc.id)}
                                                                                                    className="p-1 hover:bg-slate-105 text-slate-400 hover:text-indigo-500 rounded"
                                                                                                    title="Download/View file"
                                                                                                >
                                                                                                    <Eye size={13} />
                                                                                                </button>
                                                                                                {isAdminOrHr && doc.verified_status !== 'Verified' && (
                                                                                                    <button 
                                                                                                        onClick={() => handleVerifyDocument(doc.id, 'Verified')}
                                                                                                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded transition-colors"
                                                                                                        title="Verify/Approve Document"
                                                                                                    >
                                                                                                        <Check size={13} />
                                                                                                    </button>
                                                                                                )}
                                                                                                {isAdminOrHr && doc.verified_status !== 'Rejected' && (
                                                                                                    <button 
                                                                                                        onClick={() => {
                                                                                                            const reason = prompt("Enter rejection reason:");
                                                                                                            if (reason !== null) {
                                                                                                                handleVerifyDocument(doc.id, 'Rejected', reason);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                                                                                        title="Reject Document"
                                                                                                    >
                                                                                                        <X size={13} />
                                                                                                    </button>
                                                                                                )}
                                                                                                <button 
                                                                                                    onClick={() => handleDeleteDocument(doc.id, item.name)}
                                                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded"
                                                                                                    title="Delete uploaded file"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </>
                                                                                        ) : (
                                                                                            <button 
                                                                                                onClick={() => handleDirectDocumentUpload(item.key, item.name)}
                                                                                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 bg-slate-50 dark:bg-github-dark-subtle/50 rounded border border-slate-200 dark:border-github-dark-border"
                                                                                            >
                                                                                                <Upload size={10} />
                                                                                                <span>Upload</span>
                                                                                            </button>
                                                                                        )}
                                                                                        
                                                                                        {/* Exclude file field button */}
                                                                                        <button 
                                                                                            onClick={() => handleExcludeDocItem(item.key)}
                                                                                            className="opacity-0 group-hover/docrow:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-555 rounded"
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
                                {drawerTab === 'ai_verify' && (() => {
                                    const results = selectedEmployee.profile.ai_verification_results || {};
                                    const missingDocs = results.missing_documents || [];
                                    const expiredDocs = results.expired_documents || [];
                                    const extractedMetadata = results.extractedMetadata || {};
                                    const securityChecks = results.securityChecks || {};
                                    const discrepancies = results.discrepancies || [];

                                    const score = results.auditScore !== undefined ? results.auditScore : (100 - (missingDocs.length * 10) - (expiredDocs.length * 15) - (discrepancies.filter(d => !d.isOverridden).length * 15));

                                    let scoreColor = 'text-emerald-500 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900';
                                    let scoreBarColor = 'bg-emerald-500';
                                    let scoreLabel = 'High Compliance';
                                    if (score < 50) {
                                        scoreColor = 'text-rose-500 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900';
                                        scoreBarColor = 'bg-rose-500';
                                        scoreLabel = 'Critical Mismatches';
                                    } else if (score < 80) {
                                        scoreColor = 'text-amber-500 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900';
                                        scoreBarColor = 'bg-amber-500';
                                        scoreLabel = 'Needs Verification';
                                    }

                                    const ocrKeys = Object.keys(extractedMetadata);
                                    const currentDocKey = activeOcrDoc || ocrKeys[0] || '';

                                    return (
                                        <div className="space-y-6">
                                            {/* AI Header Card & Score */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2 flex flex-col justify-between p-4 bg-slate-50 dark:bg-github-dark-subtle/20 rounded-xl border border-slate-200/60 dark:border-github-dark-border">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                                                            <Sparkles size={16} className="text-indigo-500" />
                                                            AI Document Auditor Engine
                                                        </h4>
                                                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                                                            Our deep-learning models scan uploaded files for text legibility, matching details (names, dates), expiration metrics, hologram presence, metadata edits, and Photoshop tampering artifacts.
                                                        </p>
                                                    </div>
                                                    <div className="mt-4 flex items-center gap-3">
                                                        <button 
                                                            onClick={runAiVerification}
                                                            disabled={isVerifying}
                                                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                                        >
                                                            <RefreshCw size={13} className={isVerifying ? "animate-spin" : ""} />
                                                            {isVerifying ? "Auditing Files..." : "Run AI Auditor"}
                                                        </button>
                                                        <span className="text-[10px] text-slate-400">
                                                            Last checked: {results.lastChecked || 'Never'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={`p-4 border rounded-xl flex flex-col items-center justify-center text-center ${scoreColor}`}>
                                                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 dark:text-slate-500">Compliance Score</span>
                                                    <div className="text-4xl font-extrabold my-2">{score}%</div>
                                                    <div className="w-full bg-slate-200/50 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                                                        <div className={`h-full ${scoreBarColor}`} style={{ width: `${score}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold">{scoreLabel}</span>
                                                </div>
                                            </div>

                                            {/* Results Listings: Missing and Expired */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Missing docs */}
                                                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                                                    <span className="font-bold text-[10px] uppercase text-slate-400 flex items-center gap-1.5 mb-3">
                                                        <AlertCircle size={14} className="text-slate-400" />
                                                        Missing Fields ({missingDocs.length})
                                                    </span>
                                                    {missingDocs.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {missingDocs.map((d, i) => (
                                                                <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-github-dark-subtle text-slate-600 dark:text-slate-400 rounded text-[10px] font-medium border border-slate-200 dark:border-github-dark-border/40">
                                                                    {d}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
                                                            <Check size={14} />
                                                            All required files present.
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Expired docs */}
                                                <div className="border border-slate-200 dark:border-github-dark-border p-4 rounded-xl bg-white dark:bg-[#161b22]/30">
                                                    <span className="font-bold text-[10px] uppercase text-amber-500 flex items-center gap-1.5 mb-3">
                                                        <Clock size={14} />
                                                        Expired Alerts ({expiredDocs.length})
                                                    </span>
                                                    {expiredDocs.length > 0 ? (
                                                        <ul className="space-y-1.5 text-xs text-rose-500">
                                                            {expiredDocs.map((d, i) => (
                                                                <li key={i} className="flex items-center gap-1.5 font-medium">
                                                                    <AlertTriangle size={12} className="text-amber-500" />
                                                                    {d}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-emerald-550 text-xs font-medium">
                                                            <Check size={14} />
                                                            No expired records flagged.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* OCR Metadata Explorer Section */}
                                            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl bg-white dark:bg-[#161b22]/30 overflow-hidden">
                                                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                                    <div>
                                                        <h5 className="font-bold text-xs text-slate-750 dark:text-github-dark-text">OCR Extracted Metadata</h5>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Explore key-value data extracted by AI models from the uploaded files.</p>
                                                    </div>
                                                    
                                                    {/* Tabs Selector */}
                                                    {ocrKeys.length > 0 && (
                                                        <div className="flex gap-1 bg-slate-100 dark:bg-github-dark-subtle p-0.5 rounded-lg border border-slate-200 dark:border-github-dark-border/40">
                                                            {ocrKeys.map(key => {
                                                                const isActive = currentDocKey === key;
                                                                const label = key === 'aadhaar' ? 'Aadhaar' : key === 'pan' ? 'PAN Card' : key === 'degree' || key === 'grad_degree' ? 'Degree Cert' : key === 'passport' ? 'Passport' : key === 'experience_letter' ? 'Exp Letter' : key;
                                                                return (
                                                                    <button
                                                                        key={key}
                                                                        onClick={() => setActiveOcrDoc(key)}
                                                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                                                            isActive
                                                                                ? 'bg-white dark:bg-[#161b22] text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-github-dark-border/50'
                                                                                : 'text-slate-450 hover:text-slate-700 dark:hover:text-github-dark-text'
                                                                        }`}
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {ocrKeys.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-github-dark-border">
                                                        
                                                        {/* Left Panel: OCR Values */}
                                                        <div className="p-4 space-y-3">
                                                            <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Extracted Fields</span>
                                                            <div className="space-y-2">
                                                                {extractedMetadata[currentDocKey]?.map((item, index) => {
                                                                    let confidenceBg = 'bg-emerald-500';
                                                                    let confidenceText = 'text-emerald-500';
                                                                    if (item.confidence < 95) {
                                                                        confidenceBg = 'bg-amber-500';
                                                                        confidenceText = 'text-amber-500';
                                                                    } else if (item.confidence < 85) {
                                                                        confidenceBg = 'bg-rose-500';
                                                                        confidenceText = 'text-rose-500';
                                                                    }
                                                                    return (
                                                                        <div key={index} className="p-2.5 bg-slate-50 dark:bg-github-dark-subtle/10 rounded-lg border border-slate-200/20 dark:border-github-dark-border/30 flex flex-col gap-1.5 hover:shadow-sm transition-all duration-150">
                                                                            <div className="flex justify-between items-center text-[11px]">
                                                                                <span className="font-semibold text-slate-450 dark:text-slate-500 text-[10px]">{item.field}</span>
                                                                                <span className="font-bold text-slate-700 dark:text-github-dark-text select-all">{item.value}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex-1 bg-slate-200/50 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                                                                    <div className={`h-full ${confidenceBg}`} style={{ width: `${item.confidence}%` }}></div>
                                                                                </div>
                                                                                <span className={`text-[9px] font-black font-mono ${confidenceText}`}>
                                                                                    {item.confidence}% conf
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Right Panel: Security Verification Badges */}
                                                        <div className="p-4 space-y-4">
                                                            <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Document Authenticity & Security Checks</span>
                                                            
                                                            {(() => {
                                                                const checks = securityChecks[currentDocKey] || {};
                                                                
                                                                const hologramPassed = checks.hologram === 'Passed';
                                                                const blurPassed = checks.blur !== undefined && checks.blur < 0.15;
                                                                const metadataPassed = checks.metadata === 'Passed';
                                                                const editingPassed = checks.editing === 'Passed';

                                                                return (                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        
                                                                        {/* 1. Hologram Test */}
                                                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Hologram Verification</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {checks.hologram === 'N/A' ? (
                                                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-github-dark-subtle text-slate-400 text-[10px] font-bold rounded-full">N/A</span>
                                                                                ) : hologramPassed ? (
                                                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Passed</span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1"><XCircle size={10} /> Failed</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
 
                                                                        {/* 2. Blur / Legibility */}
                                                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Blur legibility test</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {blurPassed ? (
                                                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                                                        <CheckCircle2 size={10} /> Legible ({checks.blur})
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                                                        <XCircle size={10} /> Blur Alert ({checks.blur})
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
 
                                                                        {/* 3. EXIF Metadata Check */}
                                                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Metadata Alteration</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {metadataPassed ? (
                                                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> No Edits</span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-amber-500/10 dark:bg-amber-950/20 text-amber-550 text-[10px] font-bold rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Edited EXIF</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
 
                                                                        {/* 4. Photoshop manipulation */}
                                                                        <div className="p-3 border border-slate-200/40 dark:border-github-dark-border rounded-xl flex flex-col justify-between gap-2 bg-slate-50/50 dark:bg-[#161b22]/10 hover:shadow-sm transition-all">
                                                                            <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">Manipulation / Photoshop</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {editingPassed ? (
                                                                                    <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Authentic</span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-550 text-[10px] font-bold rounded-full flex items-center gap-1"><XCircle size={10} /> Tampering</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center text-slate-400 text-xs italic">
                                                        No OCR data extracted. Upload verification documents (e.g., Aadhaar Card, PAN Card, Degree Certificate) in the "Document Files" tab and run the AI auditor.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cross-Document Mismatch Matrix Comparison Grid */}
                                            <div className="border border-slate-200 dark:border-github-dark-border rounded-xl bg-white dark:bg-[#161b22]/30 overflow-hidden">
                                                <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/20">
                                                    <h5 className="font-bold text-xs text-slate-750 dark:text-github-dark-text">Cross-Document Discrepancy Matrix</h5>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Discrepancies identified by comparing fields across different official source documents.</p>
                                                </div>

                                                {discrepancies.length > 0 ? (
                                                    <div className="divide-y divide-slate-200 dark:divide-github-dark-border">
                                                        {discrepancies.map(d => (
                                                            <div key={d.id} className="p-4 space-y-3 hover:bg-slate-50/30 dark:hover:bg-github-dark-subtle/5 transition-all">
                                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                                                    
                                                                    {/* Compare Fields info */}
                                                                    <div className="flex items-start md:items-center gap-3">
                                                                        <span className="px-2.5 py-1 bg-rose-105 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 rounded text-[10px] font-black uppercase">
                                                                            {d.field} Mismatch
                                                                        </span>
                                                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                                            <span className="font-bold text-slate-500 dark:text-slate-400">{d.sourceA}:</span>
                                                                            <span className="text-slate-700 dark:text-github-dark-text bg-slate-100 dark:bg-github-dark-subtle px-2 py-0.5 rounded font-mono text-[11px]">{d.valueA}</span>
                                                                            <ArrowRight size={12} className="text-slate-450" />
                                                                            <span className="font-bold text-slate-500 dark:text-slate-400">{d.sourceB}:</span>
                                                                            <span className="text-rose-650 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded font-mono text-[11px] font-bold">{d.valueB}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Status or Override actions */}
                                                                    <div className="flex items-center gap-2">
                                                                        {d.isOverridden ? (
                                                                            <span className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-500 text-[10px] font-bold rounded-full flex items-center gap-1 border border-emerald-500/20">
                                                                                <ShieldCheck size={12} /> Overridden & Approved
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 bg-rose-500/10 dark:bg-rose-950/20 text-rose-500 text-[10px] font-bold rounded-full flex items-center gap-1 border border-rose-500/20 animate-pulse">
                                                                                <ShieldAlert size={12} /> Unresolved Discrepancy
                                                                            </span>
                                                                        )}
                                                                        
                                                                        {d.isOverridden ? (
                                                                            <button
                                                                                onClick={() => handleRevokeOverride(d.id)}
                                                                                className="text-[10px] text-slate-400 hover:text-red-500 font-bold underline transition-colors"
                                                                            >
                                                                                Revoke
                                                                            </button>
                                                                        ) : (
                                                                            overridingDiscrepancyId !== d.id && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setOverridingDiscrepancyId(d.id);
                                                                                        setOverrideReasonText('');
                                                                                    }}
                                                                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-github-dark-subtle dark:hover:bg-[#30363d] text-slate-700 dark:text-github-dark-text border border-slate-200 dark:border-github-dark-border rounded-lg text-[10px] font-bold transition-all shadow-sm"
                                                                                >
                                                                                    Override
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Overridden justifications log */}
                                                                {d.isOverridden && (
                                                                    <div className="p-2.5 bg-emerald-50/30 dark:bg-emerald-950/5 border border-emerald-200/20 dark:border-emerald-900/30 rounded-lg text-[10px] text-slate-500 dark:text-emerald-400/90 leading-relaxed font-mono">
                                                                        <strong>Justification:</strong> {d.overrideReason}
                                                                        <div className="mt-1 text-[9px] text-slate-400">
                                                                            Approved by {d.overriddenBy} on {d.overriddenAt}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Inline overriding dialog form */}
                                                                {overridingDiscrepancyId === d.id && (
                                                                    <div className="p-3.5 bg-slate-50 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-xl space-y-2 mt-2">
                                                                        <label className="block text-[9px] uppercase font-black text-slate-450 dark:text-slate-500">Provide Justification / Reason for Mismatch</label>
                                                                        <textarea
                                                                            value={overrideReasonText}
                                                                            onChange={(e) => setOverrideReasonText(e.target.value)}
                                                                            placeholder="e.g., Degree certificate verified with university registrar; mismatch is due to name containing middle initial. Checked and approved."
                                                                            className="w-full p-2 text-xs bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            rows={2}
                                                                        />
                                                                        <div className="flex justify-end gap-2">
                                                                            <button
                                                                                onClick={() => setOverridingDiscrepancyId(null)}
                                                                                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleOverrideDiscrepancy(d.id, overrideReasonText)}
                                                                                className="px-3 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-all shadow-sm"
                                                                            >
                                                                                Approve Override
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center text-slate-400 text-xs italic">
                                                        No discrepancies identified. All document fields match HR profile.
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    );
                                })()}

                                {/* 5. Performance Hub Tab */}
                                {drawerTab === 'perf_hub' && (() => {
                                    const empType = selectedEmployee?.profile?.employment_type || 'Full-time';
                                    const filteredCycles = cycles.filter(c => {
                                        if (!c.targetEmployeeType || c.targetEmployeeType === 'All') return true;
                                        return c.targetEmployeeType.toLowerCase() === empType.toLowerCase();
                                    });
                                    const activeCycleId = filteredCycles.some(c => c.id === selectedCycleId) ? selectedCycleId : (filteredCycles[0]?.id || '');

                                    return (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-github-dark-subtle/25 p-3 rounded-lg border border-slate-200 dark:border-github-dark-border mb-4">
                                                <span className="font-bold text-slate-700 dark:text-github-dark-text">Select Performance Cycle</span>
                                                <select 
                                                    value={activeCycleId} 
                                                    onChange={(e) => setSelectedCycleId(e.target.value)}
                                                    className="px-2.5 py-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded text-xs focus:outline-none cursor-pointer font-semibold"
                                                >
                                                    {filteredCycles.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name} ({c.type} - {c.status})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {activeCycleId ? (
                                                <PerformanceHub employee={selectedEmployee} selectedCycleId={activeCycleId} />
                                            ) : (
                                                <div className="p-8 text-center text-slate-400 italic">
                                                    No appraisal cycles configured targeting {empType} employees. Configure appraisal cycles in templates settings.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

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
                                        <AiPerformanceAnalyzer employee={selectedEmployee} selectedCycleId={selectedCycleId} />
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
                                    <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    Global Templates Configurations Manager
                                </h4>
                                <p className="text-slate-500 dark:text-github-dark-muted text-[10px] mt-0.5">Configure onboarding and document lists assigned dynamically to employees.</p>
                            </div>
                            <button 
                                onClick={() => setShowTemplatesModal(false)} 
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
                            <button
                                onClick={() => setTemplatesModalTab('appraisal_cycles')}
                                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition-all ${
                                    templatesModalTab === 'appraisal_cycles'
                                        ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-[#f0f6fc]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-github-dark-muted dark:hover:text-slate-200'
                                }`}
                            >
                                <Award size={14} />
                                <span>Performance Appraisal Cycles</span>
                            </button>
                        </div>

                        {/* Main Layout: Split Screen */}
                        <div className="flex-1 flex overflow-hidden text-xs">
                            
                            {/* Left Pane: Templates List Sidebar */}
                            <div className="w-1/3 border-r border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-[#161b22]/10 p-4 flex flex-col justify-between overflow-y-auto">
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
                                                        : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                                }`}
                                            >
                                                <span>{t.name}</span>
                                                <ArrowRight size={14} className={selectedChecklistTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                            </button>
                                        ))
                                    ) : templatesModalTab === 'document' ? (
                                        documentTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setSelectedDocTemplateId(t.id)}
                                                className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex items-center justify-between ${
                                                    selectedDocTemplateId === t.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                        : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                                }`}
                                            >
                                                <span>{t.name}</span>
                                                <ArrowRight size={14} className={selectedDocTemplateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                            </button>
                                        ))
                                    ) : (
                                        cycles.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => setSelectedCyclesManagerId(c.id)}
                                                className={`w-full text-left p-3 rounded-xl border font-bold transition-all flex flex-col gap-1 ${
                                                    selectedCyclesManagerId === c.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400'
                                                        : 'bg-white dark:bg-github-dark-subtle/35 border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{c.name}</span>
                                                    <ArrowRight size={14} className={selectedCyclesManagerId === c.id ? "opacity-100 text-indigo-600" : "opacity-0"} />
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                                                        c.status === 'Active'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                                                            : c.status === 'Evaluating'
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                                                            : c.status === 'Upcoming'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                                                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                        {c.status}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-normal">{c.type}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <button
                                    onClick={
                                        templatesModalTab === 'checklist' 
                                            ? handleAddChecklistTemplate 
                                            : templatesModalTab === 'document' 
                                            ? handleAddDocTemplate 
                                            : handleCreateNewCycleInManager
                                    }
                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm mt-4 shrink-0"
                                >
                                    <Plus size={14} />
                                    <span>
                                        {templatesModalTab === 'checklist' 
                                            ? 'Create New Template' 
                                            : templatesModalTab === 'document' 
                                            ? 'Create New Template' 
                                            : 'Create New Cycle'}
                                    </span>
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
                                                        value={tempChecklistId === template.id ? tempChecklistName : (template.name || '')}
                                                        onChange={(e) => {
                                                            setTempChecklistId(template.id);
                                                            setTempChecklistName(e.target.value);
                                                        }}
                                                        onBlur={() => {
                                                            if (tempChecklistId === template.id && tempChecklistName.trim() !== '' && tempChecklistName !== template.name) {
                                                                handleUpdateChecklistTemplateName(template.id, tempChecklistName.trim());
                                                            }
                                                        }}
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
                                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
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
                                })() : templatesModalTab === 'document' ? (() => {
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
                                                        value={tempDocId === template.id ? tempDocName : (template.name || '')}
                                                        onChange={(e) => {
                                                            setTempDocId(template.id);
                                                            setTempDocName(e.target.value);
                                                        }}
                                                        onBlur={() => {
                                                            if (tempDocId === template.id && tempDocName.trim() !== '' && tempDocName !== template.name) {
                                                                handleUpdateDocTemplateName(template.id, tempDocName.trim());
                                                            }
                                                        }}
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
                                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-github-dark-border font-bold rounded-xl flex items-center gap-1 shrink-0"
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
                                                                    <input
                                                                        type="text"
                                                                        value={editingCategoryNames[cat.id] !== undefined ? editingCategoryNames[cat.id] : cat.name}
                                                                        onChange={(e) => setEditingCategoryNames({ ...editingCategoryNames, [cat.id]: e.target.value })}
                                                                        onBlur={() => handleRenameDocTemplateCategory(template.id, cat.id, editingCategoryNames[cat.id])}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.target.blur();
                                                                            }
                                                                        }}
                                                                        className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none font-bold text-indigo-655 dark:text-indigo-400 uppercase text-[10px] tracking-wider py-0.5 px-1 w-2/3"
                                                                        placeholder="Category Name"
                                                                    />
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
                                })() : (() => {
                                     const cycle = cycles.find(c => c.id === selectedCyclesManagerId) || cycles[0];
                                     if (!cycle) return <div className="text-slate-400 italic p-6">No cycle selected</div>;
                                     return (
                                         <div className="space-y-6 flex-1 flex flex-col justify-between">
                                             <div className="space-y-5">
                                                 {/* Cycle Name */}
                                                 <div>
                                                     <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Cycle Name</label>
                                                     <input
                                                         type="text"
                                                         value={tempCycleId === cycle.id ? tempCycleName : (cycle.name || '')}
                                                         onChange={(e) => {
                                                             setTempCycleId(cycle.id);
                                                             setTempCycleName(e.target.value);
                                                         }}
                                                         onBlur={() => {
                                                             if (tempCycleId === cycle.id && tempCycleName.trim() !== '' && tempCycleName !== cycle.name) {
                                                                 handleUpdateCycleField(cycle.id, 'name', tempCycleName.trim());
                                                             }
                                                             setTempCycleId('');
                                                             setTempCycleName('');
                                                         }}
                                                         className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                     />
                                                 </div>

                                                 {/* Cycle Type & Status */}
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div>
                                                         <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Cycle Type</label>
                                                         <select
                                                             value={cycle.type}
                                                             onChange={(e) => handleUpdateCycleField(cycle.id, 'type', e.target.value)}
                                                             className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                                         >
                                                             <option value="Quarterly">Quarterly</option>
                                                             <option value="Half Yearly">Half Yearly</option>
                                                             <option value="Yearly">Yearly</option>
                                                             <option value="Custom">Custom</option>
                                                         </select>
                                                     </div>
                                                     <div>
                                                         <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Status</label>
                                                         <select
                                                             value={cycle.status}
                                                             onChange={(e) => handleUpdateCycleField(cycle.id, 'status', e.target.value)}
                                                             className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                                         >
                                                             <option value="Active">Active</option>
                                                             <option value="Evaluating">Evaluating</option>
                                                             <option value="Upcoming">Upcoming</option>
                                                             <option value="Closed">Closed</option>
                                                         </select>
                                                     </div>
                                                 </div>

                                                 {/* Target Employee Type */}
                                                 <div>
                                                     <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Target Employee Group</label>
                                                     <select
                                                         value={cycle.targetEmployeeType}
                                                         onChange={(e) => handleUpdateCycleField(cycle.id, 'targetEmployeeType', e.target.value)}
                                                         className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
                                                     >
                                                         <option value="All">All Staff (General)</option>
                                                         <option value="Intern">Interns Only</option>
                                                         <option value="Full-time">Permanent / Full-Time</option>
                                                         <option value="Management">Management / Leads</option>
                                                     </select>
                                                     <p className="text-[10px] text-slate-455 dark:text-github-dark-muted mt-1">
                                                         This cycle will only filter/appear for employees matching this employment type.
                                                     </p>
                                                 </div>

                                                 {/* Start & End Dates */}
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div>
                                                         <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">Start Date</label>
                                                         <input
                                                             type="date"
                                                             value={tempStartDateId === cycle.id ? tempStartDate : (cycle.startDate || '')}
                                                             onChange={(e) => {
                                                                 setTempStartDateId(cycle.id);
                                                                 setTempStartDate(e.target.value);
                                                             }}
                                                             onBlur={() => {
                                                                 if (tempStartDateId === cycle.id && tempStartDate !== cycle.startDate) {
                                                                     handleUpdateCycleField(cycle.id, 'startDate', tempStartDate);
                                                                 }
                                                                 setTempStartDateId('');
                                                                 setTempStartDate('');
                                                             }}
                                                             className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className="block text-[10px] uppercase font-black text-slate-400 dark:text-github-dark-muted mb-1.5">End Date</label>
                                                         <input
                                                             type="date"
                                                             value={tempEndDateId === cycle.id ? tempEndDate : (cycle.endDate || '')}
                                                             onChange={(e) => {
                                                                 setTempEndDateId(cycle.id);
                                                                 setTempEndDate(e.target.value);
                                                             }}
                                                             onBlur={() => {
                                                                 if (tempEndDateId === cycle.id && tempEndDate !== cycle.endDate) {
                                                                     handleUpdateCycleField(cycle.id, 'endDate', tempEndDate);
                                                                 }
                                                                 setTempEndDateId('');
                                                                 setTempEndDate('');
                                                             }}
                                                             className="w-full bg-slate-50 dark:bg-github-dark-subtle/50 border border-slate-200 dark:border-github-dark-border px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                                                         />
                                                     </div>
                                                 </div>
                                             </div>

                                             {/* Delete Cycle button */}
                                             <div className="pt-5 border-t border-slate-100 dark:border-github-dark-border flex justify-end">
                                                 <button
                                                     onClick={() => {
                                                         if (confirm(`Are you sure you want to delete cycle "${cycle.name}"?`)) {
                                                             handleDeleteCycleFromManager(cycle.id);
                                                         }
                                                     }}
                                                     className="px-4 py-2 text-red-500 hover:text-red-600 border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 font-bold rounded-xl flex items-center gap-1.5 transition-all"
                                                 >
                                                     <Trash2 size={13} />
                                                     <span>Delete Cycle</span>
                                                 </button>
                                             </div>
                                         </div>
                                     );
                                })()}

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/10 flex justify-end">
                            <button
                                onClick={() => setShowTemplatesModal(false)}
                                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all"
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
