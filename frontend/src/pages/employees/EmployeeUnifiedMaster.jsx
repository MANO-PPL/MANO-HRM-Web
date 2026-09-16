import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { adminService } from '../../services/adminService';
import { onboardingService } from '../../services/onboardingService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence } from 'framer-motion';
import { getColumnPreferences, updateColumnPreferences } from '../../services/userService';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import { useTour } from '../../context/TourContext';

// Modular subcomponents
import EmployeeFiltersBar from './components/EmployeeFiltersBar';
import EmployeeTable from './components/EmployeeTable';
import EmployeeProfileDrawer from './drawers/EmployeeProfileDrawer';
import DocumentUploadModal from './modals/DocumentUploadModal';
import TemplatesConfigModal from './modals/TemplatesConfigModal';

const PAGE_KEY = 'admin_employees';
const TOUR_STEPS = [
    {
        targetId: 'emp-unified-filters',
        title: 'Search & Filters',
        description: 'Find any employee instantly by name, department, designation, or active/inactive status - useful before scrolling through a large directory.',
    },
    {
        targetId: 'emp-unified-add-btn',
        title: 'Add Employee',
        description: 'Creates a new employee profile and automatically starts their onboarding checklist (documents, offer, contract, laptop, email, training, manager assignment).',
    },
    {
        targetId: 'emp-unified-table-row',
        title: 'Employee Profile',
        description: "Click any row to open that employee's full 360° profile - documents, onboarding progress, geofence assignments, and performance reviews all live there.",
    },
];

const MOCK_BACKUP_EMPLOYEES = [
    { id: 101, user_code: 'EMP-101', name: 'Sathish Kumar', email: 'sathish@mano.co.in', phone: '9876543210', department: 'Engineering', designation: 'Tech Lead', status: 'Active', joiningDate: '2024-05-10', profile_image_url: '' },
    { id: 102, user_code: 'EMP-102', name: 'Karthik Raja', email: 'karthik@mano.co.in', phone: '9876543211', department: 'Sales', designation: 'Sales Head', status: 'Active', joiningDate: '2025-02-15', profile_image_url: '' },
    { id: 103, user_code: 'EMP-103', name: 'Divya Bharathi', email: 'divya@mano.co.in', phone: '9876543212', department: 'HR & Admin', designation: 'HR Specialist', status: 'Active', joiningDate: '2026-01-10', profile_image_url: '' },
    { id: 104, user_code: 'EMP-104', name: 'Arjun Das', email: 'arjun@mano.co.in', phone: '9876543213', department: 'Marketing', designation: 'Content Lead', status: 'Inactive', joiningDate: '2025-08-20', profile_image_url: '' },
    { id: 105, user_code: 'EMP-105', name: 'Vijay Sethu', email: 'vijay@mano.co.in', phone: '9876543214', department: 'Engineering', designation: 'Software Engineer', status: 'Deleted', joiningDate: '2026-06-01', profile_image_url: '' }
];

const EmployeeUnifiedMaster = () => {
    const { avatarTimestamp, user: currentUser } = useAuth();
    useTour();

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
    const [drawerTab, setDrawerTab] = useState('profile'); // profile, checklist, documents, ai_verify, perf_hub, perf_analyzer
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
                    } catch (e) { }
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
        onConfirm: () => { },
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
            await refreshCycles();
        }
    };

    const handleUpdateCycleField = async (id, field, value) => {
        const cycle = cycles.find(c => c.id === id);
        if (!cycle) return;

        const updatedCycle = { ...cycle, [field]: value };
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
            await refreshCycles();
        }
    };

    const handleDeleteCycleFromManager = async (id) => {
        const updated = cycles.filter(c => c.id !== id);
        setCycles(updated);

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
            await refreshCycles();
        }
    };

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

        const variant = Number(empId) % 3;
        let defaultProfile = {};

        if (variant === 0) {
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

        const dbEmp = employees?.find(e => e.id === empId);
        if (dbEmp) {
            if ('joining_date' in dbEmp) {
                merged.joining_date = dbEmp.joining_date || 'N/A';
            }
            if ('reporting_manager' in dbEmp) {
                merged.reporting_manager = dbEmp.reporting_manager || 'N/A';
            }
            if ('work_location' in dbEmp) {
                merged.work_location = dbEmp.work_location || 'N/A';
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
                    phone: u.phone_no || 'N/A',
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
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.user_code.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
        const matchesStatus = emp.status === statusFilter;

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
            script.onerror = () => reject(new Error('Failed to load JSZip from CDN'));
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
                    if (docExclusions.includes(item.key)) return;

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

            const extractedMetadata = {};
            const securityChecks = {};
            const discrepancies = [];

            const hrName = selectedEmployee.name;
            const hrDob = selectedEmployee.profile.dob || '1995-12-10';
            const hrGender = selectedEmployee.profile.gender || 'Male';
            const hrAddress = selectedEmployee.profile.address || 'Flat 402, Sunshine Apartments, Bangalore';

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

    const handleDocumentUploadSave = (e) => {
        e.preventDefault();
        if (!selectedEmployee) return;

        const updatedDocs = {
            ...(selectedEmployee.profile?.documents || {}),
            [uploadModal.docKey]: {
                uploaded: true,
                fileName: uploadForm.fileName || 'Uploaded_Doc.pdf',
                nameOnDoc: uploadForm.nameOnDoc || selectedEmployee.name,
                expiryDate: uploadForm.expiryDate || null,
                isExpiredSim: !!uploadForm.isExpiredSim,
                isMismatchSim: !!uploadForm.isMismatchSim,
                uploadedAt: new Date().toISOString().split('T')[0],
                status: 'Verified'
            }
        };

        saveEmployeeProfile(selectedEmployee.id, {
            ...selectedEmployee.profile,
            documents: updatedDocs
        });
        setUploadModal(prev => ({ ...prev, isOpen: false }));
        toast.success(`Uploaded ${uploadModal.docName || 'document'} successfully`);
    };

    const handleFormSuccess = () => {
        fetchEmployees(selectedEmployee.id);
        setEditMode(false);
    };

    return (
        <DashboardLayout title="Employee Master Directory (Unified)" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={TOUR_STEPS}>
            <div className="h-[calc(100vh-64px)] p-3 space-y-3 overflow-hidden flex flex-col">
                {/* 4 Top Metric Cards & Filters Row */}
                <EmployeeFiltersBar
                    employees={employees}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    onboardingFilter={onboardingFilter}
                    setOnboardingFilter={setOnboardingFilter}
                    activeCount={activeCount}
                    inactiveCount={inactiveCount}
                    trashCount={trashCount}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    deptFilter={deptFilter}
                    setDeptFilter={setDeptFilter}
                    departments={departments}
                    showColumnCustomizer={showColumnCustomizer}
                    setShowColumnCustomizer={setShowColumnCustomizer}
                    visibleColumns={visibleColumns}
                    toggleColumn={toggleColumn}
                    resetColumnsToDefault={resetColumnsToDefault}
                    setShowTemplatesModal={setShowTemplatesModal}
                />

                {/* Main Dynamic Columns Table */}
                <EmployeeTable
                    loading={loading}
                    filteredEmployees={filteredEmployees}
                    visibleColumns={visibleColumns}
                    avatarTimestamp={avatarTimestamp}
                    getEmployeeProfile={getEmployeeProfile}
                    handleSelectEmployee={handleSelectEmployee}
                    handleRestore={handleRestore}
                    handleForceDelete={handleForceDelete}
                    handleToggleStatus={handleToggleStatus}
                    setEditMode={setEditMode}
                    handleDelete={handleDelete}
                />
            </div>

            {/* UNIFIED DETAILS & EDIT SIDEBAR DRAWER */}
            <EmployeeProfileDrawer
                selectedEmployee={selectedEmployee}
                onClose={() => setSelectedEmployee(null)}
                drawerTab={drawerTab}
                setDrawerTab={setDrawerTab}
                editMode={editMode}
                setEditMode={setEditMode}
                avatarTimestamp={avatarTimestamp}
                currentUser={currentUser}
                handleFormSuccess={handleFormSuccess}
                // Templates & Onboarding
                checklistTemplates={checklistTemplates}
                documentTemplates={documentTemplates}
                onboardingData={onboardingData}
                handleChecklistTemplateChange={handleChecklistTemplateChange}
                handleDocumentTemplateChange={handleDocumentTemplateChange}
                handleRestoreChecklistExclusions={handleRestoreChecklistExclusions}
                handleChecklistToggle={handleChecklistToggle}
                handleExcludeChecklistItem={handleExcludeChecklistItem}
                // Documents
                bulkSelectMode={bulkSelectMode}
                setBulkSelectMode={setBulkSelectMode}
                selectedDocIdsForZip={selectedDocIdsForZip}
                setSelectedDocIdsForZip={setSelectedDocIdsForZip}
                handleDownloadZip={handleDownloadZip}
                handleRestoreDocExclusions={handleRestoreDocExclusions}
                handleViewDocument={handleViewDocument}
                handleVerifyDocument={handleVerifyDocument}
                handleDeleteDocument={handleDeleteDocument}
                handleDirectDocumentUpload={handleDirectDocumentUpload}
                handleExcludeDocItem={handleExcludeDocItem}
                // AI Verification
                activeOcrDoc={activeOcrDoc}
                setActiveOcrDoc={setActiveOcrDoc}
                runAiVerification={runAiVerification}
                isVerifying={isVerifying}
                handleRevokeOverride={handleRevokeOverride}
                overridingDiscrepancyId={overridingDiscrepancyId}
                setOverridingDiscrepancyId={setOverridingDiscrepancyId}
                overrideReasonText={overrideReasonText}
                setOverrideReasonText={setOverrideReasonText}
                handleOverrideDiscrepancy={handleOverrideDiscrepancy}
                // Performance Hub & Cycles
                cycles={cycles}
                selectedCycleId={selectedCycleId}
                setSelectedCycleId={setSelectedCycleId}
            />

            {/* DOCUMENT UPLOAD SIMULATION MODAL */}
            <DocumentUploadModal
                uploadModal={uploadModal}
                setUploadModal={setUploadModal}
                uploadForm={uploadForm}
                setUploadForm={setUploadForm}
                handleDocumentUploadSave={handleDocumentUploadSave}
            />

            {/* TEMPLATES CONFIGURATION MODAL */}
            <TemplatesConfigModal
                showTemplatesModal={showTemplatesModal}
                setShowTemplatesModal={setShowTemplatesModal}
                templatesModalTab={templatesModalTab}
                setTemplatesModalTab={setTemplatesModalTab}
                checklistTemplates={checklistTemplates}
                selectedChecklistTemplateId={selectedChecklistTemplateId}
                setSelectedChecklistTemplateId={setSelectedChecklistTemplateId}
                tempChecklistName={tempChecklistName}
                setTempChecklistName={setTempChecklistName}
                tempChecklistId={tempChecklistId}
                setTempChecklistId={setTempChecklistId}
                newChecklistItemText={newChecklistItemText}
                setNewChecklistItemText={setNewChecklistItemText}
                handleAddChecklistTemplate={handleAddChecklistTemplate}
                handleUpdateChecklistTemplateName={handleUpdateChecklistTemplateName}
                handleAddChecklistTemplateItem={handleAddChecklistTemplateItem}
                handleDeleteChecklistTemplateItem={handleDeleteChecklistTemplateItem}
                handleDeleteChecklistTemplate={handleDeleteChecklistTemplate}
                documentTemplates={documentTemplates}
                selectedDocTemplateId={selectedDocTemplateId}
                setSelectedDocTemplateId={setSelectedDocTemplateId}
                tempDocName={tempDocName}
                setTempDocName={setTempDocName}
                tempDocId={tempDocId}
                setTempDocId={setTempDocId}
                newDocCatText={newDocCatText}
                setNewDocCatText={setNewDocCatText}
                newDocItemNames={newDocItemNames}
                setNewDocItemNames={setNewDocItemNames}
                newDocItemRequired={newDocItemRequired}
                setNewDocItemRequired={setNewDocItemRequired}
                editingCategoryNames={editingCategoryNames}
                setEditingCategoryNames={setEditingCategoryNames}
                handleAddDocTemplate={handleAddDocTemplate}
                handleUpdateDocTemplateName={handleUpdateDocTemplateName}
                handleAddDocTemplateCategory={handleAddDocTemplateCategory}
                handleRenameDocTemplateCategory={handleRenameDocTemplateCategory}
                handleDeleteDocTemplateCategory={handleDeleteDocTemplateCategory}
                handleAddDocTemplateItem={handleAddDocTemplateItem}
                handleDeleteDocTemplateItem={handleDeleteDocTemplateItem}
                handleDeleteDocTemplate={handleDeleteDocTemplate}
                cycles={cycles}
                selectedCyclesManagerId={selectedCyclesManagerId}
                setSelectedCyclesManagerId={setSelectedCyclesManagerId}
                tempCycleName={tempCycleName}
                setTempCycleName={setTempCycleName}
                tempCycleId={tempCycleId}
                setTempCycleId={setTempCycleId}
                tempStartDate={tempStartDate}
                setTempStartDate={setTempStartDate}
                tempStartDateId={tempStartDateId}
                setTempStartDateId={setTempStartDateId}
                tempEndDate={tempEndDate}
                setTempEndDate={setTempEndDate}
                tempEndDateId={tempEndDateId}
                setTempEndDateId={setTempEndDateId}
                handleCreateNewCycleInManager={handleCreateNewCycleInManager}
                handleUpdateCycleField={handleUpdateCycleField}
                handleDeleteCycleFromManager={handleDeleteCycleFromManager}
            />

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
