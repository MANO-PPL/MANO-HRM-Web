import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import MinimalSelect from '../../components/MinimalSelect';
import { 
  Briefcase, Plus, Search, Sparkles, Copy, Check, Share2, 
  Users, UserCheck, Calendar, MapPin, Award, ArrowRight, ArrowLeft,
  TrendingUp, Star, ThumbsUp, ThumbsDown, AlertCircle, Eye,
  Sliders, Grid, List, CheckCircle2, ChevronRight, X, FileText,
  Type, AtSign, Phone, Hash, AlignLeft, Link2, Heading, Minus,
  Save, LayoutTemplate, Bookmark, Upload, MoveUp, MoveDown,
  CheckSquare, ChevronDown, CircleDot, Trash2, PenLine
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const dateOnlyStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = dateOnlyStr.split('-');
  if (parts.length !== 3) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
  }
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = monthNames[monthIdx];
  
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  
  return `${day}${suffix} ${month} ${year}`;
};

const DEFAULT_PIPELINE_STAGES = [
  { id: 'stg_applied', name: 'Applied', color: 'slate' },
  { id: 'stg_screening', name: 'Screening', color: 'blue' },
  { id: 'stg_shortlisted', name: 'Shortlisted', color: 'indigo' },
  { id: 'stg_interview', name: 'Interview Scheduled', color: 'violet' },
  { id: 'stg_tech', name: 'Technical Round', color: 'purple' },
  { id: 'stg_hr', name: 'HR Round', color: 'pink' },
  { id: 'stg_selected', name: 'Selected', color: 'emerald' },
  { id: 'stg_rejected', name: 'Rejected', color: 'rose' },
  { id: 'stg_offered', name: 'Offered', color: 'amber' },
  { id: 'stg_joined', name: 'Joined', color: 'teal' }
];

const PIPELINE_COLOR_MAP = {
  blue: { border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500 bg-blue-400' },
  indigo: { border: 'border-indigo-300 dark:border-indigo-700', dot: 'bg-indigo-500' },
  violet: { border: 'border-violet-300 dark:border-violet-700', dot: 'bg-violet-500' },
  purple: { border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500' },
  pink: { border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-500' },
  emerald: { border: 'border-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-500' },
  rose: { border: 'border-rose-300 dark:border-rose-700', dot: 'bg-rose-500' },
  amber: { border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500' },
  teal: { border: 'border-teal-300 dark:border-teal-700', dot: 'bg-teal-500' },
  slate: { border: 'border-slate-300 dark:border-slate-600', dot: 'bg-slate-400' }
};

// ─── APPLICATION FORM BUILDER CONSTANTS ─────────────────────────────────────

const PREDEFINED_FORM_TEMPLATES = [
  {
    id: 'tpl_tech_standard',
    name: 'Standard Tech Role',
    description: 'Ideal for engineering, software development, and IT positions.',
    color: 'blue',
    fields: [
      { id: 'f1', type: 'text', label: 'Full Name', placeholder: 'John Doe', required: true, options: [], width: 'full' },
      { id: 'f2', type: 'email', label: 'Email Address', placeholder: 'john@example.com', required: true, options: [], width: 'full' },
      { id: 'f3', type: 'tel', label: 'Mobile Number', placeholder: '+91 98765 43210', required: true, options: [], width: 'half' },
      { id: 'f4', type: 'text', label: 'Current Company', placeholder: 'ACME Corp', required: false, options: [], width: 'half' },
      { id: 'f5', type: 'text', label: 'Current CTC', placeholder: '₹6 LPA', required: false, options: [], width: 'half' },
      { id: 'f6', type: 'text', label: 'Expected CTC', placeholder: '₹9 LPA', required: false, options: [], width: 'half' },
      { id: 'f7', type: 'select', label: 'Notice Period', placeholder: '', required: true, options: ['Immediate', '15 days', '30 days', '60 days', '90 days'], width: 'half' },
      { id: 'f8', type: 'number', label: 'Total Experience (Years)', placeholder: '2', required: true, options: [], width: 'half' },
      { id: 'f9', type: 'textarea', label: 'Skills & Technologies', placeholder: 'React, Node.js, TypeScript...', required: true, options: [], width: 'full' },
      { id: 'f10', type: 'url', label: 'LinkedIn Profile', placeholder: 'linkedin.com/in/...', required: false, options: [], width: 'half' },
      { id: 'f11', type: 'url', label: 'Portfolio / GitHub URL', placeholder: 'github.com/...', required: false, options: [], width: 'half' },
      { id: 'f12', type: 'section_header', label: 'Your Application', placeholder: '', required: false, options: [], width: 'full' },
      { id: 'f13', type: 'textarea', label: 'Cover Note', placeholder: "Brief note on why you're a great fit...", required: false, options: [], width: 'full' },
      { id: 'f14', type: 'file', label: 'Resume Upload (PDF)', placeholder: '', required: true, options: [], width: 'full' },
    ]
  },
  {
    id: 'tpl_exec_senior',
    name: 'Executive / Senior Leadership',
    description: 'Designed for managerial, director, and C-suite level applications.',
    color: 'purple',
    fields: [
      { id: 'g1', type: 'text', label: 'Full Name', placeholder: 'John Doe', required: true, options: [], width: 'full' },
      { id: 'g2', type: 'email', label: 'Email Address', placeholder: 'john@example.com', required: true, options: [], width: 'full' },
      { id: 'g3', type: 'tel', label: 'Mobile Number', placeholder: '+91 98765 43210', required: true, options: [], width: 'full' },
      { id: 'g4', type: 'section_header', label: 'Professional Profile', placeholder: '', required: false, options: [], width: 'full' },
      { id: 'g5', type: 'text', label: 'Current Designation', placeholder: 'VP of Engineering', required: true, options: [], width: 'half' },
      { id: 'g6', type: 'text', label: 'Current Organisation', placeholder: 'ACME Corp', required: true, options: [], width: 'half' },
      { id: 'g7', type: 'number', label: 'Total Years in Leadership', placeholder: '8', required: true, options: [], width: 'half' },
      { id: 'g8', type: 'number', label: 'Team Size Managed', placeholder: '25', required: false, options: [], width: 'half' },
      { id: 'g9', type: 'text', label: 'Current CTC (LPA)', placeholder: '₹25 LPA', required: false, options: [], width: 'half' },
      { id: 'g10', type: 'text', label: 'Expected CTC (LPA)', placeholder: '₹35 LPA', required: false, options: [], width: 'half' },
      { id: 'g11', type: 'select', label: 'Notice Period', placeholder: '', required: true, options: ['Immediate', '30 days', '60 days', '90 days', '3 months', '6 months'], width: 'full' },
      { id: 'g12', type: 'textarea', label: 'Key Achievements & Highlights', placeholder: 'Describe major accomplishments in your career...', required: true, options: [], width: 'full' },
      { id: 'g13', type: 'section_header', label: 'References & Identity', placeholder: '', required: false, options: [], width: 'full' },
      { id: 'g14', type: 'url', label: 'LinkedIn Profile', placeholder: 'linkedin.com/in/...', required: true, options: [], width: 'full' },
      { id: 'g15', type: 'textarea', label: 'Professional Reference (Name & Contact)', placeholder: 'Name — Company — Email/Phone', required: false, options: [], width: 'full' },
      { id: 'g16', type: 'file', label: 'Resume / CV Upload', placeholder: '', required: true, options: [], width: 'full' },
    ]
  }
];

const COMPONENT_PALETTE = [
  {
    category: 'Text & Input',
    items: [
      { type: 'text', label: 'Short Text', icon: 'Type', defaultLabel: 'Text Field', defaultPlaceholder: 'Enter text...' },
      { type: 'email', label: 'Email', icon: 'AtSign', defaultLabel: 'Email Address', defaultPlaceholder: 'email@example.com' },
      { type: 'tel', label: 'Phone', icon: 'Phone', defaultLabel: 'Phone Number', defaultPlaceholder: '+91 98765 43210' },
      { type: 'number', label: 'Number', icon: 'Hash', defaultLabel: 'Number', defaultPlaceholder: '0' },
      { type: 'url', label: 'URL / Link', icon: 'Link2', defaultLabel: 'Website URL', defaultPlaceholder: 'https://...' },
      { type: 'date', label: 'Date Picker', icon: 'Calendar', defaultLabel: 'Select Date', defaultPlaceholder: '' },
      { type: 'textarea', label: 'Long Text', icon: 'AlignLeft', defaultLabel: 'Long Answer', defaultPlaceholder: 'Enter details...' },
    ]
  },
  {
    category: 'Choice & Selection',
    items: [
      { type: 'select', label: 'Dropdown', icon: 'ChevronDown', defaultLabel: 'Select Option', defaultPlaceholder: '', defaultOptions: ['Option 1', 'Option 2', 'Option 3'] },
      { type: 'radio_group', label: 'Radio Group', icon: 'CircleDot', defaultLabel: 'Choose One', defaultPlaceholder: '', defaultOptions: ['Option A', 'Option B', 'Option C'] },
      { type: 'checkbox_group', label: 'Checkboxes', icon: 'CheckSquare', defaultLabel: 'Choose Multiple', defaultPlaceholder: '', defaultOptions: ['Option A', 'Option B', 'Option C'] },
    ]
  },
  {
    category: 'Media & Upload',
    items: [
      { type: 'file', label: 'File Upload', icon: 'Upload', defaultLabel: 'Upload File', defaultPlaceholder: '' },
    ]
  },
  {
    category: 'Layout',
    items: [
      { type: 'section_header', label: 'Section Header', icon: 'Heading', defaultLabel: 'Section Title', defaultPlaceholder: '' },
      { type: 'divider', label: 'Divider Line', icon: 'Minus', defaultLabel: '', defaultPlaceholder: '' },
    ]
  },
];

// ─── FORM BUILDER HELPERS (module-level, no hooks) ─────────────────────────

const getFieldTypeIconElement = (type, size) => {
  const map = { text: Type, email: AtSign, tel: Phone, number: Hash, url: Link2, date: Calendar, textarea: AlignLeft, select: ChevronDown, radio_group: CircleDot, checkbox_group: CheckSquare, file: Upload, section_header: Heading, divider: Minus };
  const Icon = map[type] || Type;
  return <Icon size={size} />;
};

const getPaletteIconElement = (icon, size) => {
  const map = { Type, AtSign, Phone, Hash, Link2, Calendar, AlignLeft, ChevronDown, CircleDot, CheckSquare, Upload, Heading, Minus };
  const Icon = map[icon] || Type;
  return <Icon size={size} />;
};

const getFieldTypeColor = (type) => {
  const c = { text: 'bg-blue-500', email: 'bg-blue-600', tel: 'bg-teal-500', number: 'bg-violet-500', url: 'bg-indigo-500', date: 'bg-orange-500', textarea: 'bg-sky-500', select: 'bg-emerald-500', radio_group: 'bg-amber-500', checkbox_group: 'bg-rose-500', file: 'bg-purple-500', section_header: 'bg-slate-500', divider: 'bg-slate-400' };
  return c[type] || 'bg-slate-500';
};

const getFieldTypeLabel = (type) => {
  const l = { text: 'Short Text', email: 'Email', tel: 'Phone', number: 'Number', url: 'URL', date: 'Date', textarea: 'Long Text', select: 'Dropdown', radio_group: 'Radio Group', checkbox_group: 'Checkboxes', file: 'File Upload', section_header: 'Section Header', divider: 'Divider' };
  return l[type] || type;
};

const RecruitmentDashboard = () => {
  const navigate = useNavigate();
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('openings'); // openings, create, pipeline, candidates, formbuilder
  
  // Data State
  const [openings, setOpenings] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [editingJobId, setEditingJobId] = useState(null);
  const [selectedJobForSidebar, setSelectedJobForSidebar] = useState(null);

  // Form Fields for new job opening
  const [newJob, setNewJob] = useState({
    job_title: '',
    department: '',
    location: '',
    employment_type: 'Full-time',
    experience_required: '',
    salary_range: '',
    skills_required: '',
    responsibilities: '',
    benefits: '',
    deadline: '',
    status: 'active',
    other_details: '',
    attachment_name: null,
    attachment_url: null
  });

  const [attachmentFile, setAttachmentFile] = useState(null);

  // AI Prompt generator fields
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingJD, setGeneratingJD] = useState(false);

  // Auto-resize textareas based on content length to prevent scrollbars
  const responsibilitiesRef = useRef(null);
  const benefitsRef = useRef(null);
  const otherDetailsRef = useRef(null);

  useEffect(() => {
    const adjustHeight = (ref) => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    };
    adjustHeight(responsibilitiesRef);
    adjustHeight(benefitsRef);
    adjustHeight(otherDetailsRef);
  }, [newJob.responsibilities, newJob.benefits, newJob.other_details]);

  // Filter/Sort State
  const [sortBy, setSortBy] = useState('overall'); // overall, skill, experience, education, culture
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState('');

  // ─── APPLICATION FORM BUILDER STATE ─────────────────────────────────────────
  const [formBuilderStep, setFormBuilderStep] = useState('choose'); // 'choose' | 'predefined' | 'build' | 'saved'
  const [formComponents, setFormComponents] = useState([]);
  const [formTitle, setFormTitle] = useState('New Application Form');
  const [savedFormTemplates, setSavedFormTemplates] = useState([]);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateDesc, setSaveTemplateDesc] = useState('');
  const [formPreviewOpen, setFormPreviewOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);

  // ─── PIPELINE CUSTOMIZATION STATE ───────────────────────────────────────────
  const [pipelineStages, setPipelineStages] = useState([]);
  const [isCustomizingPipeline, setIsCustomizingPipeline] = useState(false);
  const [editingStages, setEditingStages] = useState([]);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('blue');

  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [currentTemplateSource, setCurrentTemplateSource] = useState('scratch');

  // ─── CREATE OPENING WIZARD STATE ─────────────────────────────────────────────
  const [createStep, setCreateStep] = useState('details'); // 'details' | 'formbuilder'
  const [pendingJobData, setPendingJobData] = useState(null);

  // ─── PIPELINE DRAG-AND-DROP STATE ────────────────────────────────────────────
  const [draggedCandidateId, setDraggedCandidateId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const fetchData = async () => {
    try {
      const openingsRes = await api.get('/recruitment/openings');
      setOpenings(openingsRes.data);
      
      const candidatesRes = await api.get('/recruitment/candidates');
      setCandidates(candidatesRes.data);

      const stagesRes = await api.get('/recruitment/pipeline-stages');
      let stages = stagesRes.data;
      if (!stages || stages.length === 0) {
        await api.post('/recruitment/pipeline-stages', { stages: DEFAULT_PIPELINE_STAGES });
        stages = DEFAULT_PIPELINE_STAGES;
      }
      setPipelineStages(stages);

      const templatesRes = await api.get('/recruitment/templates');
      setSavedFormTemplates(templatesRes.data);

      if (openingsRes.data.length > 0) {
        setSelectedJob(prev => {
          if (prev) {
            const found = openingsRes.data.find(o => o.id === prev.id);
            if (found) return found;
          }
          return openingsRes.data[0];
        });
      } else {
        setSelectedJob(null);
      }
    } catch (err) {
      console.error('Error fetching recruitment data:', err);
      toast.error('Failed to load recruitment data from server.');
    }
  };

  // Load from database on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Toggle opening status
  const toggleJobStatus = async (id) => {
    const job = openings.find(j => j.id === id);
    if (!job) return;
    try {
      const nextStatus = job.status === 'active' ? 'inactive' : 'active';
      await api.put(`/recruitment/openings/${id}/status`, { status: nextStatus });
      toast.info(`Job opening set to ${nextStatus}.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update job status.');
    }
  };



  const handleDeleteCandidate = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the candidate application for ${name}?`)) {
      try {
        await api.delete(`/recruitment/candidates/${id}`);
        toast.success(`Candidate ${name}'s application deleted.`);
        setSelectedCandidate(null);
        await fetchData();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete candidate application.');
      }
    }
  };

  const resetCreateFlow = () => {
    setEditingJobId(null);
    setAttachmentFile(null);
    setNewJob({
      job_title: '',
      department: '',
      location: '',
      employment_type: 'Full-time',
      experience_required: '',
      salary_range: '',
      skills_required: '',
      responsibilities: '',
      benefits: '',
      deadline: '',
      status: 'active',
      other_details: '',
      attachment_name: null,
      attachment_url: null
    });
    setFormComponents([]);
    setFormTitle('New Application Form');
    setFormBuilderStep('choose');
    setPendingJobData(null);
    setCreateStep('details');
    setCurrentTemplateId(null);
    setCurrentTemplateSource('scratch');
  };

  const handleEditJob = (job) => {
    setEditingJobId(job.id);
    setAttachmentFile(null);
    setNewJob({
      job_title: job.job_title || '',
      department: job.department || '',
      location: job.location || '',
      employment_type: job.employment_type || 'Full-time',
      experience_required: job.experience_required || '',
      salary_range: job.salary_range || '',
      skills_required: job.skills_required || '',
      responsibilities: job.responsibilities || '',
      benefits: job.benefits || '',
      deadline: job.deadline ? job.deadline.split('T')[0] : '',
      status: job.status || 'active',
      other_details: job.other_details || '',
      attachment_name: job.attachment_name || null,
      attachment_url: job.attachment_url || null
    });
    if (job.form_config) {
      setFormComponents(job.form_config);
      setFormTitle(job.job_title + ' — Application Form');
      setCurrentTemplateId(job.template_id);
      setCurrentTemplateSource(job.template_source || 'scratch');
    } else {
      setFormComponents([]);
      setFormTitle('New Application Form');
      setCurrentTemplateId(null);
      setCurrentTemplateSource('scratch');
    }
    setCreateStep('details');
    setActiveTab('create');
  };

  // Generate public link copy to clipboard
  const handleCopyLink = (slug) => {
    const link = `${window.location.origin}/careers/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(slug);
    toast.success('Public Career Link copied to clipboard!');
    setTimeout(() => setCopiedLink(''), 2000);
  };

  // Shared logic to actually publish or update a job
  const publishJob = async (jobData, withFormConfig = false) => {
    try {
      const formDataPayload = new FormData();
      Object.keys(jobData).forEach(key => {
        if (jobData[key] !== null && jobData[key] !== undefined) {
          formDataPayload.append(key, jobData[key]);
        }
      });

      const formConfig = (withFormConfig || editingJobId) && formComponents.length > 0 ? formComponents : null;
      if (formConfig) {
        formDataPayload.append('form_config', JSON.stringify(formConfig));
      }
      formDataPayload.append('template_id', (withFormConfig || editingJobId) ? currentTemplateId || '' : '');
      formDataPayload.append('template_source', (withFormConfig || editingJobId) ? currentTemplateSource || 'scratch' : 'scratch');

      if (attachmentFile) {
        formDataPayload.append('attachment', attachmentFile);
      }

      if (editingJobId) {
        await api.put(`/recruitment/openings/${editingJobId}`, formDataPayload, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success(`"${jobData.job_title}" updated successfully!`);
      } else {
        await api.post('/recruitment/openings', formDataPayload, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success(`"${jobData.job_title}" published successfully!`);
      }

      // Reset everything
      setNewJob({ job_title: '', department: '', location: '', employment_type: 'Full-time', experience_required: '', salary_range: '', skills_required: '', responsibilities: '', benefits: '', deadline: '', status: 'active', other_details: '', attachment_name: null, attachment_url: null });
      setAttachmentFile(null);
      setFormComponents([]);
      setFormTitle('New Application Form');
      setFormBuilderStep('choose');
      setPendingJobData(null);
      setCreateStep('details');
      setCurrentTemplateId(null);
      setCurrentTemplateSource('scratch');
      setEditingJobId(null);
      await fetchData();
      setActiveTab('openings');
    } catch (err) {
      console.error(err);
      toast.error(editingJobId ? 'Failed to update job opening.' : 'Failed to publish job opening.');
    }
  };
  // Step 1 → Step 2: validate job details, move to form builder
  const handleProceedToFormBuilder = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!newJob.job_title || !newJob.department || !newJob.skills_required || !newJob.deadline || !newJob.location) {
      toast.error('Please fill in all required fields before designing the form.');
      return;
    }
    setPendingJobData({ ...newJob });
    
    // Always default to templates dashboard/choose step first
    setFormBuilderStep('choose');
    
    setEditingFieldId(null);
    setCreateStep('formbuilder');
  };

  // Publish directly from step 1 (skip form builder)
  const handlePublishDirectly = (e) => {
    e.preventDefault();
    if (!newJob.job_title || !newJob.department || !newJob.skills_required || !newJob.deadline || !newJob.location) {
      toast.error('Please fill in all required fields.');
      return;
    }
    publishJob(newJob, false);
  };

  // Publish from step 2 (with form config)
  const handlePublishWithForm = () => {
    publishJob(pendingJobData || newJob, true);
  };

  // AI JD Generator
  const handleGenerateJD = async () => {
    if (!aiPrompt) {
      toast.error('Please enter requirements (e.g. "Need React Developer with 2 years experience")');
      return;
    }

    setGeneratingJD(true);

    try {
      const res = await api.post('/recruitment/generate-jd', { rolePrompt: aiPrompt });
      const data = res.data;

      setNewJob(prev => ({
        ...prev,
        job_title: data.job_title || '',
        department: data.department || '',
        location: data.location || '',
        experience_required: data.experience_required || '',
        salary_range: data.salary_range || '',
        skills_required: data.skills_required || '',
        responsibilities: data.responsibilities || '',
        benefits: data.benefits || '',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
      }));

      toast.success('AI parsed requirements and populated the Job Description form!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to generate AI job description.');
    } finally {
      setGeneratingJD(false);
    }
  };

  // Move candidate to a different stage
  const handleUpdateStage = async (candId, newStage) => {
    try {
      await api.put(`/recruitment/candidates/${candId}/stage`, { stage: newStage });
      toast.success('Candidate stage updated.');
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to move candidate stage.');
    }
  };

  // Open pipeline customization modal
  const handleOpenCustomizePipeline = () => {
    setEditingStages(pipelineStages.map(s => ({ ...s })));
    setIsCustomizingPipeline(true);
  };

  // Save customized pipeline stages
  const handleSaveCustomizePipeline = async () => {
    // 1. Validations
    if (editingStages.length === 0) {
      toast.error('The recruitment pipeline must have at least one stage.');
      return;
    }

    const trimmedStages = editingStages.map(s => ({
      ...s,
      name: s.name.trim()
    }));

    if (trimmedStages.some(s => s.name === '')) {
      toast.error('Stage names cannot be empty.');
      return;
    }

    const names = trimmedStages.map(s => s.name.toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      toast.error('Stage names must be unique.');
      return;
    }

    try {
      await api.post('/recruitment/pipeline-stages', { stages: trimmedStages });
      setIsCustomizingPipeline(false);
      toast.success('Recruitment pipeline customized successfully!');
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to customize recruitment pipeline.');
    }
  };

  // Modal list editing helpers
  const handleUpdateStageName = (index, value) => {
    const updated = [...editingStages];
    updated[index].name = value;
    setEditingStages(updated);
  };

  const handleUpdateStageColor = (index, color) => {
    const updated = [...editingStages];
    updated[index].color = color;
    setEditingStages(updated);
  };

  const handleDeleteStage = (index) => {
    if (editingStages.length <= 1) {
      toast.error('The recruitment pipeline must have at least one stage.');
      return;
    }
    const updated = editingStages.filter((_, i) => i !== index);
    setEditingStages(updated);
  };

  const handleMoveStage = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editingStages.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...editingStages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setEditingStages(updated);
  };

  const handleAddNewStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) {
      toast.error('Please enter a stage name.');
      return;
    }
    if (editingStages.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('A stage with this name already exists.');
      return;
    }
    const newStage = {
      id: 'stg_' + Date.now(),
      name: trimmed,
      color: newStageColor
    };
    setEditingStages([...editingStages, newStage]);
    setNewStageName('');
    setNewStageColor('blue');
    toast.success(`Stage "${trimmed}" added to list!`);
  };

  // Filter candidates for selected job
  const filteredCandidates = candidates
    .filter(c => selectedJob && c.job_id === selectedJob.id)
    .filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.extracted_skills || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));

  // Sort candidates based on criteria
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (sortBy === 'overall') return b.ai_score - a.ai_score;
    if (sortBy === 'skill') return b.skill_match_score - a.skill_match_score;
    if (sortBy === 'experience') return b.experience_match_score - a.experience_match_score;
    if (sortBy === 'education') return b.education_match_score - a.education_match_score;
    if (sortBy === 'culture') return b.culture_fit_score - a.culture_fit_score;
    return b.ai_score - a.ai_score;
  });

  // ─── FORM BUILDER HANDLERS ──────────────────────────────────────────────────

  const loadFormTemplate = (fields, title = 'Application Form', templateId = null, templateSource = 'scratch') => {
    const freshFields = fields.map((f, idx) => ({
      ...f,
      id: `field_${Date.now()}_${idx}`
    }));
    setFormComponents(freshFields);
    setFormTitle(title);
    setEditingFieldId(null);
    setFormBuilderStep('build');
    setCurrentTemplateId(templateId);
    setCurrentTemplateSource(templateSource);
  };

  const addFieldToCanvas = (paletteItem) => {
    const newField = {
      id: `field_${Date.now()}`,
      type: paletteItem.type,
      label: paletteItem.defaultLabel,
      placeholder: paletteItem.defaultPlaceholder || '',
      required: false,
      options: paletteItem.defaultOptions ? [...paletteItem.defaultOptions] : [],
      width: 'full'
    };
    setFormComponents(prev => [...prev, newField]);
  };

  const updateField = (fieldId, updates) => {
    setFormComponents(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const deleteField = (fieldId) => {
    setFormComponents(prev => prev.filter(f => f.id !== fieldId));
    if (editingFieldId === fieldId) setEditingFieldId(null);
  };

  const moveFieldUp = (index) => {
    if (index === 0) return;
    const updated = [...formComponents];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setFormComponents(updated);
  };

  const moveFieldDown = (index) => {
    if (index === formComponents.length - 1) return;
    const updated = [...formComponents];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setFormComponents(updated);
  };

  const addOptionToField = (fieldId) => {
    setFormComponents(prev => prev.map(f => {
      if (f.id === fieldId) return { ...f, options: [...f.options, `Option ${f.options.length + 1}`] };
      return f;
    }));
  };

  const updateFieldOption = (fieldId, optIndex, value) => {
    setFormComponents(prev => prev.map(f => {
      if (f.id === fieldId) {
        const newOptions = [...f.options];
        newOptions[optIndex] = value;
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const removeFieldOption = (fieldId, optIndex) => {
    setFormComponents(prev => prev.map(f => {
      if (f.id === fieldId) return { ...f, options: f.options.filter((_, i) => i !== optIndex) };
      return f;
    }));
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }
    try {
      const payload = {
        name: saveTemplateName.trim(),
        description: saveTemplateDesc.trim() || 'Custom application form template',
        fields: formComponents
      };
      await api.post('/recruitment/templates', payload);
      setIsSaveTemplateModalOpen(false);
      setSaveTemplateName('');
      setSaveTemplateDesc('');
      toast.success(`Template "${payload.name}" saved successfully!`);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template to database.');
    }
  };

  const handleDeleteSavedTemplate = async (id) => {
    if (window.confirm('Delete this saved template?')) {
      try {
        await api.delete(`/recruitment/templates/${id}`);
        toast.success('Template deleted.');
        await fetchData();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete template.');
      }
    }
  };

  const sidebarCandidates = candidates
    .filter(c => selectedJobForSidebar && c.job_id === selectedJobForSidebar.id)
    .filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.extracted_skills || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));

  const sortedSidebarCandidates = [...sidebarCandidates].sort((a, b) => {
    if (sortBy === 'overall') return b.ai_score - a.ai_score;
    if (sortBy === 'skill') return b.skill_match_score - a.skill_match_score;
    if (sortBy === 'experience') return b.experience_match_score - a.experience_match_score;
    if (sortBy === 'education') return b.education_match_score - a.education_match_score;
    if (sortBy === 'culture') return b.culture_fit_score - a.culture_fit_score;
    return b.ai_score - a.ai_score;
  });

  return (
    <DashboardLayout title="Careers & Recruitment" noPadding={false}>
      
      {/* Top action cards / summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-[#0969da] rounded-lg">
            <Briefcase size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Active Openings</span>
            <p className="text-xl font-bold mt-0.5">{openings.filter(j => j.status === 'active').length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Total Applicants</span>
            <p className="text-xl font-bold mt-0.5">{candidates.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Top Match Score (AI)</span>
            <p className="text-xl font-bold mt-0.5">
              {candidates.length > 0 ? `${Math.max(...candidates.map(c => c.ai_score))}%` : 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-github-dark-muted font-medium">Applied This Month</span>
            <p className="text-xl font-bold mt-0.5">{candidates.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Document Studio Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 font-sans">
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('openings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'openings'
              ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
              : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <Briefcase size={15} className={`${activeTab === 'openings' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
            <span className="leading-none">Job Openings</span>
          </button>
          <button
            onClick={() => {
              if (openings.length > 0 && !selectedJob) setSelectedJob(openings[0]);
              setActiveTab('pipeline');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'pipeline'
              ? 'bg-white dark:bg-slate-700 text-[#0969da] dark:text-[#f0f6fc] shadow-sm'
              : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <Sliders size={15} className={`${activeTab === 'pipeline' ? 'text-[#0969da] dark:text-[#f0f6fc]' : 'text-slate-400'} -mt-[1px]`} />
            <span className="leading-none">Recruitment Pipeline</span>
          </button>
        </div>

        {/* Document Studio & Create Job Redirect Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetCreateFlow();
              setActiveTab('create');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-600/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Plus size={15} />
            <span>Create Job</span>
          </button>
          
          <button
            onClick={() => navigate('/documents')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <FileText size={15} />
            <span>HR Document Studio</span>
          </button>
        </div>
      </div>

      {/* TAB 1: JOB OPENINGS LIST */}
      {activeTab === 'openings' && (
        <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 dark:text-github-dark-text">Job Openings Directory</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {openings.map(job => (
                <div 
                  key={job.id} 
                  onClick={() => {
                    setSelectedJobForSidebar(job);
                    setSelectedCandidate(null);
                  }}
                  className={`cursor-pointer hover:border-[#0969da] dark:hover:border-github-dark-accent bg-slate-50/50 dark:bg-github-dark-bg/30 border rounded-2xl p-5 transition-all relative overflow-hidden flex flex-col justify-between ${job.status === 'inactive' ? 'opacity-60 border-slate-200 dark:border-github-dark-border/50' : 'border-slate-200 dark:border-github-dark-border hover:shadow-md'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-extrabold text-base text-slate-800 dark:text-github-dark-text leading-snug">{job.job_title}</h4>
                        <span className="text-xs font-bold text-[#0969da] dark:text-github-dark-accent mt-0.5 inline-block">{job.department}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${job.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-github-dark-border dark:text-slate-400'}`}>
                          {job.status}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleJobStatus(job.id);
                          }}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${job.status === 'active' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          title="Toggle job status"
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${job.status === 'active' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs text-slate-500 dark:text-github-dark-muted my-4 font-medium">
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {job.location}</span>
                      <span className="flex items-center gap-1.5"><Award size={14} className="text-slate-400" /> {job.experience_required} Required</span>
                      <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-slate-400" /> {job.employment_type}</span>
                      <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> Apply by {formatDate(job.deadline)}</span>
                    </div>

                    <div className="mb-4">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase">Skills:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {job.skills_required.split(',').map((skill, i) => (
                          <span key={i} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-2 py-0.5 rounded text-[10px] font-mono font-medium">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-github-dark-border/50 flex flex-wrap gap-3 items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-github-dark-text">
                        {candidates.filter(c => c.job_id === job.id).length} Applicants
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(job);
                          setActiveTab('pipeline');
                        }}
                        className="p-1.5 text-slate-500 hover:text-[#0969da] dark:hover:text-github-dark-accent rounded-lg border border-slate-200 dark:border-github-dark-border transition-colors hover:bg-slate-50 dark:hover:bg-github-dark-border/40"
                        title="View pipeline"
                      >
                        <Sliders size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditJob(job);
                        }}
                        className="p-1.5 text-slate-500 hover:text-blue-500 rounded-lg border border-slate-200 dark:border-github-dark-border transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        title="Edit job opening"
                      >
                        <PenLine size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(job.slug);
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-github-dark-border hover:bg-slate-200 dark:hover:bg-github-dark-border/70 text-slate-700 dark:text-github-dark-text rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border border-transparent dark:border-github-dark-border"
                      >
                        {copiedLink === job.slug ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        Share Link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CREATE OPENING — 2-STEP WIZARD */}
        {activeTab === 'create' && (
          <div>

            {/* ── Step Indicator ── */}
            <div className="flex items-center gap-2 mb-6 font-sans">
              <button
                type="button"
                onClick={() => setCreateStep('details')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer hover:opacity-90 border ${
                  createStep === 'details'
                    ? 'bg-[#0969da] text-white border-[#0969da] shadow-sm'
                    : 'bg-emerald-50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-950/30'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                  createStep === 'details' ? 'bg-white text-[#0969da]' : 'bg-emerald-700 text-white dark:bg-emerald-400 dark:text-emerald-950'
                }`}>1</span>
                Job Details
              </button>

              <ChevronRight size={14} className="text-slate-400 dark:text-github-dark-muted" />

              <button
                type="button"
                onClick={(e) => handleProceedToFormBuilder(e)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer hover:opacity-90 border ${
                  createStep === 'formbuilder'
                    ? 'bg-[#0969da] text-white border-[#0969da] shadow-sm'
                    : 'bg-slate-50 dark:bg-github-dark-bg text-slate-500 dark:text-github-dark-muted border-slate-200 dark:border-github-dark-border'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                  createStep === 'formbuilder' ? 'bg-white text-[#0969da]' : 'bg-slate-300 text-slate-700 dark:bg-github-dark-border dark:text-github-dark-muted'
                }`}>2</span>
                Application Form
                <span className="text-[9px] bg-slate-200 dark:bg-github-dark-border text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full font-bold">optional</span>
              </button>
            </div>

            {/* ── STEP 1: JOB DETAILS ── */}
            {createStep === 'details' && (
              <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <h3 className="font-bold text-slate-800 dark:text-github-dark-text mb-6">{editingJobId ? 'Edit Job Opening' : 'Job Opening Details'}</h3>
                    <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Job Title *</label>
                      <input
                        type="text"
                        required
                        value={newJob.job_title}
                        onChange={(e) => setNewJob({ ...newJob, job_title: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                        placeholder="e.g. React Developer"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Department *</label>
                      <input
                        type="text"
                        required
                        value={newJob.department}
                        onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                        placeholder="e.g. Engineering"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Location *</label>
                      <input
                        type="text"
                        required
                        value={newJob.location}
                        onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                        placeholder="Bangalore, India / Remote"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Employment Type</label>
                      <MinimalSelect
                        value={newJob.employment_type}
                        onChange={(val) => setNewJob({ ...newJob, employment_type: val })}
                        options={["Full-time", "Part-time", "Contract", "Internship"]}
                        triggerClassName="w-full justify-between !bg-slate-50 dark:!bg-github-dark-bg !border-slate-200 dark:!border-github-dark-border text-slate-700 dark:text-[#c9d1d9] font-medium text-sm px-3 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Experience Required *</label>
                      <input
                        type="text"
                        required
                        value={newJob.experience_required}
                        onChange={(e) => setNewJob({ ...newJob, experience_required: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                        placeholder="e.g. 2+ Years"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Salary Range</label>
                      <input
                        type="text"
                        value={newJob.salary_range}
                        onChange={(e) => setNewJob({ ...newJob, salary_range: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                        placeholder="e.g. ₹8,00,000 - ₹12,00,000 / year"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Application Deadline *</label>
                      <input
                        type="date"
                        required
                        value={newJob.deadline}
                        onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Skills Required * (Comma separated)</label>
                    <input
                      type="text"
                      required
                      value={newJob.skills_required}
                      onChange={(e) => setNewJob({ ...newJob, skills_required: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                      placeholder="React, Redux, JavaScript, CSS3"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Responsibilities</label>
                    <textarea
                      ref={responsibilitiesRef}
                      rows="1"
                      value={newJob.responsibilities}
                      onChange={(e) => setNewJob({ ...newJob, responsibilities: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] resize-none overflow-hidden min-h-[80px]"
                      placeholder="Detail the daily responsibilities..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Benefits</label>
                    <textarea
                      ref={benefitsRef}
                      rows="1"
                      value={newJob.benefits}
                      onChange={(e) => setNewJob({ ...newJob, benefits: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] resize-none overflow-hidden min-h-[80px]"
                      placeholder="Detail company perks and benefits..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">Other Details</label>
                    <textarea
                      ref={otherDetailsRef}
                      rows="1"
                      value={newJob.other_details || ''}
                      onChange={(e) => setNewJob({ ...newJob, other_details: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] resize-none overflow-hidden min-h-[80px]"
                      placeholder="Enter other details, instructions, or notes for this opening..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1.5 block">Attachment (Optional)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        id="opening-attachment-file"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachmentFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="opening-attachment-file"
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-bg hover:bg-slate-100 dark:hover:bg-github-dark-border/80 rounded-lg text-xs font-bold cursor-pointer text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <Upload size={14} />
                        {attachmentFile ? 'Change File' : 'Upload Attachment'}
                      </label>
                      {attachmentFile ? (
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-github-dark-border/40 px-2.5 py-1 rounded-lg">
                          <span className="text-xs font-bold text-[#0969da] flex items-center gap-1">
                            <FileText size={12} />
                            {attachmentFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachmentFile(null);
                              // Clear the file input DOM value so same file can be uploaded again if needed
                              const inputEl = document.getElementById('opening-attachment-file');
                              if (inputEl) inputEl.value = '';
                            }}
                            className="text-rose-500 hover:text-rose-700 p-0.5 transition-colors"
                            title="Remove uploaded file"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : newJob.attachment_name ? (
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-github-dark-border/40 px-2.5 py-1 rounded-lg">
                          <a
                            href={`/api/recruitment/openings-attachments/${newJob.attachment_url.split('/').pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#0969da] hover:underline flex items-center gap-1"
                          >
                            <FileText size={12} />
                            {newJob.attachment_name} (Current)
                          </a>
                          <button
                            type="button"
                            onClick={() => setNewJob({ ...newJob, attachment_name: null, attachment_url: null })}
                            className="text-rose-500 hover:text-rose-700 p-0.5 transition-colors"
                            title="Delete current attachment"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No file uploaded</span>
                      )}
                    </div>
                  </div>

                  {/* Step 1 Footer Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-github-dark-border mt-4">
                    <button
                      type="button"
                      onClick={handleProceedToFormBuilder}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-sm font-bold transition-all shadow-md"
                    >
                      Next: Design Application Form <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishDirectly}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-github-dark-border hover:bg-slate-200 dark:hover:bg-github-dark-border/80 text-slate-700 dark:text-github-dark-text rounded-lg text-sm font-semibold transition-all border border-slate-200 dark:border-github-dark-border"
                    >
                      <CheckCircle2 size={15} className="text-emerald-500" /> {editingJobId ? 'Save Changes' : 'Publish Directly'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('openings')}
                      className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-github-dark-text text-sm font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: AI JD Assistant */}
              <div className="lg:col-span-1">
                <div className="border border-indigo-100 dark:border-indigo-950/50 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl p-6 sticky top-6">
                  <h4 className="font-bold text-slate-800 dark:text-github-dark-text mb-2 flex items-center gap-1.5">
                    <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                    AI JD Generator
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    Type a requirement and let AI generate the complete job description.
                  </p>
                  <div className="space-y-4">
                    <textarea
                      rows="3"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-github-dark-border rounded-xl text-xs bg-white dark:bg-github-dark-subtle focus:outline-none"
                      placeholder="Need React Developer with 2 years experience..."
                    />
                    {generatingJD ? (
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3 text-center flex flex-col items-center gap-2 animate-pulse">
                        <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-spin" />
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">AI assembling JD...</span>
                      </div>
                    ) : (
                      <button type="button" onClick={handleGenerateJD} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all flex justify-center items-center gap-1.5 shadow-sm">
                        <Sparkles size={14} /> Auto-Generate JD
                      </button>
                    )}
                    <div className="border-t border-slate-200 dark:border-github-dark-border/50 pt-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Quick Prompts:</span>
                      {['Need React Developer with 2 years experience', 'Backend node developer with MySQL, 3 years exp', 'Python AI engineer with LLM experience'].map(p => (
                        <button key={p} type="button" onClick={() => setAiPrompt(p)} className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 font-mono transition-colors block border border-slate-100 dark:border-github-dark-border truncate">
                          "{p}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
            )}

            {/* ── STEP 2: APPLICATION FORM BUILDER ── */}
            {createStep === 'formbuilder' && (
              <div className="space-y-4 font-sans">
                {/* Step 2 Toolbar */}
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      {/* Breadcrumbs */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-github-dark-muted mb-1 select-none">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('openings'); }}
                          className="hover:text-[#0969da] transition-colors uppercase tracking-wider"
                        >
                          Job Openings
                        </button>
                        <ChevronRight size={10} className="text-slate-400 shrink-0" />
                        <button
                          type="button"
                          onClick={() => { setCreateStep('details'); }}
                          className="hover:text-[#0969da] transition-colors uppercase tracking-wider"
                        >
                          Job Details
                        </button>
                        <ChevronRight size={10} className="text-slate-400 shrink-0" />
                        <button
                          type="button"
                          onClick={() => { setFormBuilderStep('choose'); }}
                          className="hover:text-[#0969da] transition-colors uppercase tracking-wider"
                        >
                          Templates Dashboard
                        </button>
                        {formBuilderStep !== 'choose' && (
                          <>
                            <ChevronRight size={10} className="text-slate-400 shrink-0" />
                            <span className="text-[#0969da] dark:text-github-dark-accent uppercase tracking-wider">
                              {formBuilderStep === 'predefined' ? 'Predefined Templates' : formBuilderStep === 'saved' ? 'Saved Templates' : 'Canvas Builder'}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2.5">
                        <input
                          value={formTitle}
                          onChange={e => setFormTitle(e.target.value)}
                          className="font-extrabold text-slate-800 dark:text-github-dark-text bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-[#0969da] outline-none text-sm px-1 py-0.5 transition-colors min-w-[220px]"
                        />
                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-github-dark-border px-2 py-0.5 rounded-full font-bold">{formComponents.length} fields</span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5 pl-1">for: <strong>{pendingJobData?.job_title}</strong></p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFormPreviewOpen(true)} disabled={formComponents.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-github-dark-border hover:bg-slate-200 text-slate-700 dark:text-github-dark-text rounded-lg text-xs font-bold transition-colors disabled:opacity-40">
                      <Eye size={14} /> Preview
                    </button>
                    <button onClick={() => { setSaveTemplateName(formTitle); setSaveTemplateDesc(''); setIsSaveTemplateModalOpen(true); }} disabled={formComponents.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-40">
                      <Save size={14} /> Save as Template
                    </button>
                    <button onClick={handlePublishWithForm} className="flex items-center gap-1.5 px-5 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-xs font-bold transition-colors shadow-md">
                      <CheckCircle2 size={14} /> {editingJobId ? 'Save Changes' : 'Publish Opening'}
                    </button>
                  </div>
                </div>

                {/* ── Choose / Build / Templates ── */}
                {formBuilderStep === 'choose' && (
                  <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-10 shadow-sm">
                    <div className="text-center mb-10">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200 dark:shadow-indigo-950/30">
                        <LayoutTemplate size={30} className="text-white" />
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-800 dark:text-github-dark-text mb-2">Design the Application Form</h3>
                      <p className="text-sm text-slate-500 dark:text-github-dark-muted max-w-lg mx-auto leading-relaxed font-medium">Candidates will fill this form when applying for <strong>{pendingJobData?.job_title}</strong>. Choose how to start.</p>
                    </div>
                    <div className={`grid grid-cols-1 ${formComponents.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 max-w-5xl mx-auto font-sans`}>
                      {/* Continue with Current Form */}
                      {formComponents.length > 0 && (
                        <div
                          onClick={() => setFormBuilderStep('build')}
                          className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] cursor-pointer p-8 rounded-2xl text-center group transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/5 dark:hover:shadow-orange-500/10 hover:-translate-y-1 hover:border-orange-500 dark:hover:border-orange-400 relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-500 transition-all duration-300 shadow-sm">
                            <PenLine size={24} />
                          </div>
                          <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2.5 text-base group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Continue Editing</h4>
                          <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed mb-3">Resume editing the currently designed form.</p>
                          <span className="inline-block text-[10px] font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-100 dark:border-orange-900/30">{formComponents.length} Fields</span>
                        </div>
                      )}

                      {/* Build from Scratch */}
                      <div
                        onClick={() => { setFormComponents([]); setFormTitle('New Application Form'); setEditingFieldId(null); setFormBuilderStep('build'); }}
                        className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] cursor-pointer p-8 rounded-2xl text-center group transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-[#0969da] dark:hover:border-github-dark-accent relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/30 text-[#0969da] dark:text-[#f0f6fc] rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:bg-[#0969da] group-hover:text-white transition-all duration-300 shadow-sm">
                          <PenLine size={24} />
                        </div>
                        <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2.5 text-base group-hover:text-[#0969da] dark:group-hover:text-github-dark-accent transition-colors">Build from Scratch</h4>
                        <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed">Start blank and add fields from the palette.</p>
                      </div>

                      {/* Use Predefined Template */}
                      <div
                        onClick={() => setFormBuilderStep('predefined')}
                        className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] cursor-pointer p-8 rounded-2xl text-center group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-500 dark:hover:border-indigo-400 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-all duration-300 shadow-sm">
                          <LayoutTemplate size={24} />
                        </div>
                        <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2.5 text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Use a Template</h4>
                        <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed mb-3">Pick from 2 pre-built templates for tech or leadership roles.</p>
                        <span className="inline-block text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/30">2 Ready</span>
                      </div>

                      {/* My Saved Templates */}
                      <div
                        onClick={() => setFormBuilderStep('saved')}
                        className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] cursor-pointer p-8 rounded-2xl text-center group transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 dark:hover:shadow-emerald-500/10 hover:-translate-y-1 hover:border-emerald-500 dark:hover:border-emerald-400 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-all duration-300 shadow-sm">
                          <Bookmark size={24} />
                        </div>
                        <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2.5 text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Saved Templates</h4>
                        <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed mb-3">Reuse templates you've saved from previous builds.</p>
                        <span className="inline-block text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">{savedFormTemplates.length} Saved</span>
                      </div>
                    </div>
                  </div>
                )}

                {formBuilderStep === 'predefined' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 dark:border-[#30363d]/60 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-[#f0f6fc] text-base">Choose a Predefined Template</h3>
                        <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-0.5">Select a template to pre-populate fields matching your job role type.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {PREDEFINED_FORM_TEMPLATES.map(tpl => (
                        <div 
                          key={tpl.id} 
                          className={`bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-2xl shadow-sm hover:shadow-lg hover:border-transparent dark:hover:border-transparent hover:ring-2 hover:ring-offset-2 dark:hover:ring-offset-black transition-all group overflow-hidden flex flex-col justify-between ${
                            tpl.color === 'blue' 
                              ? 'hover:ring-blue-500' 
                              : 'hover:ring-purple-500'
                          }`}
                        >
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100 dark:border-[#30363d]/60">
                              <div>
                                <div className={`inline-flex items-center gap-2 text-sm font-extrabold mb-1 ${tpl.color === 'blue' ? 'text-[#0969da]' : 'text-purple-600 dark:text-purple-400'}`}>
                                  {tpl.color === 'blue' ? <Sliders size={15} /> : <Award size={15} />}
                                  {tpl.name}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1 leading-relaxed">{tpl.description}</p>
                              </div>
                              <span className="text-[10px] bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] px-2.5 py-1 rounded-full font-bold ml-3 shrink-0 border border-transparent dark:border-[#30363d]">{tpl.fields.length} fields</span>
                            </div>

                            <div className="space-y-2 mb-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                              {tpl.fields.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-xs py-0.5">
                                  {f.type === 'section_header' ? (
                                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1.5 mb-0.5">― {f.label}</span>
                                  ) : f.type === 'divider' ? (
                                    <div className="w-full border-t border-slate-100 dark:border-[#30363d]/50 my-1" />
                                  ) : (
                                    <>
                                      <span className={`p-1 rounded-md text-white shrink-0 shadow-sm ${getFieldTypeColor(f.type)}`}>{getFieldTypeIconElement(f.type, 9)}</span>
                                      <span className="font-semibold text-slate-700 dark:text-[#c9d1d9] flex-1 truncate">{f.label}</span>
                                      {f.required && <span className="text-[9px] bg-rose-50 dark:bg-rose-950/20 text-rose-500 px-1.5 py-0.5 rounded-full font-bold border border-rose-100 dark:border-rose-950/30">required</span>}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50 dark:bg-[#161b22]/60 border-t border-slate-100 dark:border-[#30363d]/40 mt-auto">
                            <button 
                              onClick={() => loadFormTemplate(tpl.fields, tpl.name + ' Form')} 
                              className={`w-full py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer ${
                                tpl.color === 'blue' 
                                  ? 'bg-[#0969da] hover:bg-[#0969da]/90 text-white' 
                                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                              }`}
                            >
                              Use This Template <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formBuilderStep === 'saved' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 dark:border-github-dark-border pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-[#f0f6fc] text-base">My Saved Templates</h3>
                        <p className="text-xs text-slate-400 dark:text-github-dark-muted mt-0.5">Select from form configurations you have saved in previous designs.</p>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">{savedFormTemplates.length} saved</span>
                    </div>
                    {savedFormTemplates.length === 0 ? (
                      <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-14 text-center shadow-sm">
                        <Bookmark size={44} className="mx-auto text-slate-300 mb-4" />
                        <h4 className="font-extrabold text-slate-600 text-sm mb-2">No Saved Templates Yet</h4>
                        <p className="text-xs text-slate-400 mb-5">Build a form and save it as a template to find it here.</p>
                        <button onClick={() => { setFormComponents([]); setFormBuilderStep('build'); }} className="px-5 py-2.5 bg-[#0969da] text-white rounded-lg text-xs font-bold hover:bg-[#0969da]/90">Build Your First Form</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-sans">
                        {savedFormTemplates.map(tpl => (
                          <div key={tpl.id} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 pr-2">
                                  <h4 className="font-extrabold text-sm text-[#0969da] dark:text-[#f0f6fc] truncate">{tpl.name}</h4>
                                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{tpl.description || 'No description provided.'}</p>
                                </div>
                                <button onClick={() => handleDeleteSavedTemplate(tpl.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 transition-colors"><Trash2 size={13} /></button>
                              </div>
                              <div className="flex gap-2 text-[10px] text-slate-400 mb-4 items-center font-medium">
                                <span className="bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] px-2 py-0.5 rounded font-bold border border-transparent dark:border-[#30363d]">{(tpl.fields||[]).length} fields</span>
                                <span>•</span>
                                <span>{new Date(tpl.created_at || tpl.savedAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                              <div className="space-y-1.5 mb-4 pr-1">
                                {(tpl.fields||[]).filter(f=>f.type!=='divider').slice(0,4).map((f,i)=>(
                                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <span className={`p-0.5 rounded text-white shrink-0 shadow-sm ${getFieldTypeColor(f.type)}`}>{getFieldTypeIconElement(f.type,8)}</span>
                                    <span className="font-medium truncate text-slate-600 dark:text-slate-300">{f.label}</span>
                                  </div>
                                ))}
                                {(tpl.fields?.length||0)>4 && <p className="text-[9px] text-slate-400 pl-4 font-mono font-bold">+{tpl.fields.length-4} more fields</p>}
                              </div>
                            </div>
                            <button onClick={() => loadFormTemplate(tpl.fields, tpl.name)} className="w-full py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer mt-auto">
                              Use Template <ArrowRight size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {formBuilderStep === 'build' && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                    {/* Palette */}
                    <div className="lg:col-span-1 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm overflow-hidden sticky top-4">
                      <div className="p-4 border-b border-slate-100 dark:border-[#30363d]/50 bg-slate-50/50">
                        <h4 className="font-extrabold text-[11px] text-slate-600 dark:text-github-dark-text uppercase tracking-widest">Field Components</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Click any to add</p>
                      </div>
                      <div className="p-3 space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
                        {COMPONENT_PALETTE.map(group => (
                          <div key={group.category}>
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 px-1">{group.category}</p>
                            <div className="space-y-1">
                              {group.items.map(item => (
                                <button key={item.type} onClick={() => addFieldToCanvas(item)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/15 hover:text-[#0969da] text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all group/btn text-left border border-transparent hover:border-blue-100">
                                  <span className="p-1.5 bg-slate-100 dark:bg-github-dark-border rounded-lg group-hover/btn:bg-blue-100 transition-colors shrink-0 text-slate-500 group-hover/btn:text-[#0969da]">{getPaletteIconElement(item.icon, 11)}</span>
                                  <span className="leading-none flex-1">{item.label}</span>
                                  <Plus size={11} className="text-slate-300 group-hover/btn:text-[#0969da] shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Canvas */}
                    <div className="lg:col-span-3 space-y-2.5">
                      {formComponents.length === 0 ? (
                        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-2xl p-20 text-center shadow-sm relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-[#21262d] rounded-2xl flex items-center justify-center mb-6 border border-slate-100 dark:border-[#30363d] shadow-sm text-slate-400 dark:text-slate-500">
                            <LayoutTemplate size={28} />
                          </div>
                          <h4 className="font-extrabold text-slate-800 dark:text-[#f0f6fc] text-base mb-2">Form Canvas is Empty</h4>
                          <p className="text-xs text-slate-500 dark:text-[#8b949e] max-w-sm leading-relaxed">
                            Start designing by clicking on any of the field components on the left palette to add them to your candidate application form.
                          </p>
                        </div>
                      ) : (
                        formComponents.map((field, idx) => (
                          <div key={field.id} className={`bg-white dark:bg-github-dark-subtle border rounded-xl shadow-sm transition-all ${editingFieldId === field.id ? 'border-[#0969da] ring-2 ring-[#0969da]/10' : 'border-slate-200 dark:border-github-dark-border hover:border-slate-300'}`}>
                            <div className="flex items-center gap-2.5 px-4 py-2.5">
                              <span className={`p-1.5 rounded-lg text-white shrink-0 ${getFieldTypeColor(field.type)}`}>{getFieldTypeIconElement(field.type, 11)}</span>
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{getFieldTypeLabel(field.type)}</span>
                              {field.required && <span className="text-[9px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">Required</span>}
                              <div className="ml-auto flex items-center gap-1">
                                <button onClick={() => updateField(field.id, { width: field.width === 'full' ? 'half' : 'full' })} className="text-[9px] font-bold border border-slate-200 dark:border-github-dark-border rounded-lg px-2 py-1 text-slate-400 hover:text-slate-700 transition-colors">{field.width === 'full' ? '⬛ Full' : '▪ Half'}</button>
                                <button onClick={() => updateField(field.id, { required: !field.required })} className={`text-[9px] font-bold border rounded-lg px-2 py-1 transition-colors ${field.required ? 'border-rose-200 text-rose-500 hover:bg-rose-50' : 'border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-slate-600'}`}>{field.required ? '★ Req' : '☆ Opt'}</button>
                                <button onClick={() => moveFieldUp(idx)} disabled={idx === 0} className="p-1.5 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-25"><MoveUp size={12} /></button>
                                <button onClick={() => moveFieldDown(idx)} disabled={idx === formComponents.length - 1} className="p-1.5 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-25"><MoveDown size={12} /></button>
                                <button onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)} className={`p-1.5 rounded-lg transition-colors ${editingFieldId === field.id ? 'bg-[#0969da] text-white' : 'hover:bg-slate-100 dark:hover:bg-github-dark-border/40 text-slate-400 hover:text-slate-600'}`}><PenLine size={12} /></button>
                                <button onClick={() => deleteField(field.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                            <div className="px-4 pb-3">
                              {field.type === 'section_header' ? (
                                <div className="border-t-2 border-slate-100 dark:border-github-dark-border/60 pt-2"><span className="font-extrabold text-sm text-slate-700 dark:text-github-dark-text">{field.label || 'Section Header'}</span></div>
                              ) : field.type === 'divider' ? (
                                <hr className="border-slate-200 dark:border-github-dark-border mt-1" />
                              ) : (
                                <>
                                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">{field.label || 'Untitled'} {field.required && <span className="text-rose-500">*</span>}</label>
                                  {(field.type === 'select' || field.type === 'radio_group' || field.type === 'checkbox_group') ? (
                                    <div className="flex flex-wrap gap-1.5">{field.options.length > 0 ? field.options.map((opt, i) => <span key={i} className="bg-slate-100 dark:bg-github-dark-border text-slate-600 px-2.5 py-1 rounded-lg text-xs border border-slate-200">{opt}</span>) : <span className="text-xs text-slate-400 italic">No options — click edit to add</span>}</div>
                                  ) : field.type === 'file' ? (
                                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2"><Upload size={14} /> Click to upload</div>
                                  ) : field.type === 'textarea' ? (
                                    <div className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400 min-h-[44px]">{field.placeholder || 'Long answer...'}</div>
                                  ) : (
                                    <div className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400">{field.placeholder || 'Short answer...'}</div>
                                  )}
                                </>
                              )}
                            </div>
                            {editingFieldId === field.id && (
                              <div className="border-t border-slate-100 dark:border-github-dark-border/50 px-4 py-4 space-y-3 bg-slate-50/50 dark:bg-github-dark-bg/30 rounded-b-xl">
                                {field.type !== 'divider' && (<div><label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 block">Label</label><input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]" /></div>)}
                                {field.type !== 'section_header' && field.type !== 'divider' && field.type !== 'file' && field.type !== 'select' && field.type !== 'radio_group' && field.type !== 'checkbox_group' && (<div><label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 block">Placeholder</label><input value={field.placeholder} onChange={e => updateField(field.id, { placeholder: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]" /></div>)}
                                {(field.type === 'select' || field.type === 'radio_group' || field.type === 'checkbox_group') && (<div><label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">Options</label><div className="space-y-1.5">{field.options.map((opt, optIdx) => (<div key={optIdx} className="flex items-center gap-2"><input value={opt} onChange={e => updateFieldOption(field.id, optIdx, e.target.value)} className="flex-1 px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:border-[#0969da]" /><button onClick={() => removeFieldOption(field.id, optIdx)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"><X size={12} /></button></div>))}<button onClick={() => addOptionToField(field.id)} className="flex items-center gap-1.5 text-xs font-semibold text-[#0969da] mt-1"><Plus size={12} /> Add Option</button></div></div>)}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: PIPELINE KANBAN BOARD */}
        {activeTab === 'pipeline' && (
          <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 shadow-sm flex flex-col">
            {/* Job Opening Selector Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 dark:border-github-dark-border pb-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-github-dark-muted font-bold uppercase">Select Role:</span>
                  <MinimalSelect
                    size="sm"
                    value={selectedJob ? String(selectedJob.id) : ''}
                    onChange={(val) => setSelectedJob(openings.find(j => String(j.id) === String(val)))}
                    options={openings.map(job => ({ value: String(job.id), label: `${job.job_title} (${job.department})` }))}
                    triggerClassName="justify-between !bg-slate-50 dark:!bg-github-dark-subtle !border-slate-200 dark:!border-github-dark-border text-slate-700 dark:text-[#c9d1d9] font-bold text-xs px-3 py-1.5 rounded-lg"
                  />
                </div>
                
                <button
                  onClick={handleOpenCustomizePipeline}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-github-dark-border hover:bg-slate-100 dark:hover:bg-github-dark-border/40 text-slate-700 dark:text-github-dark-text bg-white dark:bg-github-dark-subtle rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Sliders size={13} className="text-slate-500 dark:text-github-dark-muted" />
                  Customize Pipeline
                </button>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search applicants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0969da]"
                />
              </div>
            </div>

            {/* Dynamic Kanban with Drag-and-Drop */}
            {sortedCandidates.length === 0 && (
              <div className="text-center py-10 border border-dashed border-slate-200 dark:border-github-dark-border rounded-2xl">
                <Users size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-500">No applicants for this opening yet.</p>
                <p className="text-xs text-slate-400 mt-1">Share the public career link to receive applications.</p>
              </div>
            )}
            {sortedCandidates.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 dark:text-github-dark-muted mb-3 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#0969da] animate-pulse"></span>
                  Drag cards between columns to move candidates through stages
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {pipelineStages.map(stage => {
                    const colorScheme = PIPELINE_COLOR_MAP[stage.color] || PIPELINE_COLOR_MAP.slate;
                    const stageCandidates = sortedCandidates.filter(c => c.stage === stage.name);
                    const isOver = dragOverStage === stage.name;
                    return (
                      <div
                        key={stage.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.name); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedCandidateId) handleUpdateStage(draggedCandidateId, stage.name);
                          setDraggedCandidateId(null);
                          setDragOverStage(null);
                        }}
                        className={`flex flex-col min-h-[180px] rounded-xl border-2 p-2.5 transition-all duration-150 ${
                          isOver
                            ? 'border-[#0969da] bg-blue-50/40 dark:bg-blue-950/10 scale-[1.02] shadow-lg shadow-blue-100/50'
                            : `${colorScheme.border || 'border-slate-200 dark:border-github-dark-border'} bg-slate-50/60 dark:bg-github-dark-bg/30`
                        }`}
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-2.5 px-1">
                          <div className="flex items-center gap-1.5 truncate mr-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${colorScheme.dot || 'bg-slate-400'}`} />
                            <span className="text-[10px] font-extrabold text-slate-600 dark:text-github-dark-text uppercase tracking-wider leading-none truncate">{stage.name}</span>
                          </div>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${stageCandidates.length > 0 ? 'bg-[#0969da] text-white' : 'bg-slate-200 dark:bg-github-dark-border text-slate-500 dark:text-slate-400'}`}>
                            {stageCandidates.length}
                          </span>
                        </div>

                        {/* Drop Zone hint */}
                        {isOver && draggedCandidateId && (
                          <div className="border-2 border-dashed border-[#0969da]/50 rounded-xl py-3 text-center text-[10px] text-[#0969da] font-bold mb-2 bg-blue-50/50 dark:bg-blue-950/10 animate-pulse">
                            Drop here
                          </div>
                        )}

                        {/* Cards */}
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                          {stageCandidates.length === 0 && !isOver ? (
                            <div className="border border-dashed border-slate-200 dark:border-github-dark-border/50 rounded-lg py-5 text-center text-[9px] text-slate-400 font-medium">
                              Drop here
                            </div>
                          ) : (
                            stageCandidates.map(cand => {
                              const isDragging = draggedCandidateId === cand.id;
                              return (
                                <div
                                  key={cand.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedCandidateId(cand.id);
                                  }}
                                  onDragEnd={() => { setDraggedCandidateId(null); setDragOverStage(null); }}
                                  onClick={() => setSelectedCandidate(cand)}
                                  className={`bg-white dark:bg-github-dark-subtle border rounded-xl p-2.5 shadow-sm cursor-grab active:cursor-grabbing transition-all select-none group ${
                                    isDragging
                                      ? 'opacity-40 scale-95 border-[#0969da]'
                                      : 'border-slate-200 dark:border-github-dark-border hover:border-[#0969da] hover:shadow-md'
                                  }`}
                                >
                                  {/* Drag handle hint */}
                                  <div className="flex items-start justify-between mb-1">
                                    <h5 className="font-bold text-[11px] text-slate-800 dark:text-github-dark-text group-hover:text-[#0969da] transition-colors leading-tight">{cand.full_name}</h5>
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                                      cand.ai_score >= 85 ? 'bg-emerald-100 text-emerald-700' : cand.ai_score >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>{cand.ai_score}%</span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 font-medium mb-1.5 truncate">{cand.current_company}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(cand.extracted_skills || []).slice(0, 2).map((s, i) => (
                                      <span key={i} className="bg-slate-50 dark:bg-github-dark-border px-1.5 py-0.5 rounded text-[8px] font-mono">{s}</span>
                                    ))}
                                    {cand.extracted_skills && cand.extracted_skills.length > 2 && <span className="text-[8px] text-slate-400">+{cand.extracted_skills.length - 2}</span>}
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-github-dark-border/40 flex items-center justify-between">
                                    <span className="text-[8px] text-slate-400">{cand.created_at}</span>
                                    <span className="text-[8px] text-slate-400 font-medium">⠿ drag</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}



      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: APPLICATION FORM BUILDER                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'formbuilder' && (
        <div className="space-y-4">

          {/* ── STEP: CHOOSE MODE ── */}
          {formBuilderStep === 'choose' && (
            <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-10 shadow-sm">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200 dark:shadow-indigo-950/30">
                  <LayoutTemplate size={30} className="text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-github-dark-text mb-2">Application Form Builder</h3>
                <p className="text-sm text-slate-500 dark:text-github-dark-muted max-w-lg mx-auto leading-relaxed">
                  Design a fully customisable application form for candidates. Choose how you'd like to start building.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {/* Build from Scratch */}
                <div
                  onClick={() => { setFormComponents([]); setFormTitle('New Application Form'); setEditingFieldId(null); setFormBuilderStep('build'); }}
                  className="border-2 border-dashed border-slate-200 dark:border-github-dark-border hover:border-[#0969da] dark:hover:border-[#0969da] cursor-pointer p-7 rounded-2xl text-center group transition-all duration-200 hover:shadow-xl hover:shadow-blue-100/50 dark:hover:shadow-blue-950/20 hover:bg-blue-50/30 dark:hover:bg-blue-950/5"
                >
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/20 text-[#0969da] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/30 transition-all duration-200">
                    <PenLine size={28} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2 text-base group-hover:text-[#0969da] transition-colors">Build from Scratch</h4>
                  <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed">Start with a blank canvas and add field components from the palette to create a fully custom form.</p>
                </div>

                {/* Use Predefined Template */}
                <div
                  onClick={() => setFormBuilderStep('predefined')}
                  className="border-2 border-dashed border-slate-200 dark:border-github-dark-border hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer p-7 rounded-2xl text-center group transition-all duration-200 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-950/20 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/5"
                >
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/30 transition-all duration-200">
                    <LayoutTemplate size={28} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2 text-base group-hover:text-indigo-600 transition-colors">Use a Template</h4>
                  <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed mb-3">Pick from 2 pre-built templates optimised for tech roles or executive positions.</p>
                  <span className="inline-block text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">2 Templates Ready</span>
                </div>

                {/* My Saved Templates */}
                <div
                  onClick={() => setFormBuilderStep('saved')}
                  className="border-2 border-dashed border-slate-200 dark:border-github-dark-border hover:border-emerald-400 dark:hover:border-emerald-500 cursor-pointer p-7 rounded-2xl text-center group transition-all duration-200 hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/20 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/5"
                >
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/30 transition-all duration-200">
                    <Bookmark size={28} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 dark:text-github-dark-text mb-2 text-base group-hover:text-emerald-600 transition-colors">My Saved Templates</h4>
                  <p className="text-xs text-slate-500 dark:text-github-dark-muted leading-relaxed mb-3">Reuse form templates you've saved from previous builds in one click.</p>
                  <span className="inline-block text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full">{savedFormTemplates.length} Saved</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: PREDEFINED TEMPLATES PICKER ── */}
          {formBuilderStep === 'predefined' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setFormBuilderStep('choose')} className="p-2 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg transition-all text-slate-500 dark:text-github-dark-muted">
                  <ArrowLeft size={16} />
                </button>
                <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base">Choose a Predefined Template</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {PREDEFINED_FORM_TEMPLATES.map(tpl => (
                  <div key={tpl.id} className={`bg-white dark:bg-github-dark-subtle border-2 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group ${tpl.color === 'blue' ? 'border-slate-200 dark:border-github-dark-border hover:border-[#0969da]' : 'border-slate-200 dark:border-github-dark-border hover:border-purple-400'}`}>
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className={`inline-flex items-center gap-2 text-sm font-extrabold mb-1 ${tpl.color === 'blue' ? 'text-[#0969da]' : 'text-purple-600 dark:text-purple-400'}`}>
                          {tpl.color === 'blue' ? <Sliders size={16} /> : <Award size={16} />}
                          {tpl.name}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{tpl.description}</p>
                      </div>
                      <span className="text-[10px] bg-slate-100 dark:bg-github-dark-border text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-bold ml-3 shrink-0">{tpl.fields.length} fields</span>
                    </div>

                    <div className="space-y-1.5 mb-5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {tpl.fields.map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-xs">
                          {f.type === 'section_header' ? (
                            <span className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mt-1 ml-1">― {f.label}</span>
                          ) : f.type === 'divider' ? (
                            <div className="w-full border-t border-slate-200 dark:border-github-dark-border my-0.5" />
                          ) : (
                            <>
                              <span className={`p-1 rounded-md text-white shrink-0 ${getFieldTypeColor(f.type)}`}>{getFieldTypeIconElement(f.type, 9)}</span>
                              <span className="font-medium text-slate-600 dark:text-slate-300 flex-1">{f.label}</span>
                              {f.required && <span className="text-[9px] bg-rose-100 dark:bg-rose-950/30 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">req.</span>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => loadFormTemplate(tpl.fields, tpl.name + ' Form')}
                      className={`w-full py-2.5 rounded-lg text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-2 ${tpl.color === 'blue' ? 'bg-[#0969da] hover:bg-[#0969da]/90 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                      Use This Template <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: BUILD CANVAS ── */}
          {formBuilderStep === 'build' && (
            <div className="space-y-4">
              {/* Builder Toolbar */}
              <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setFormBuilderStep('choose')} className="p-2 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg transition-all text-slate-500 dark:text-github-dark-muted">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex items-center gap-2.5">
                    <input
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      className="font-extrabold text-slate-800 dark:text-github-dark-text bg-transparent border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-[#0969da] outline-none text-sm px-1 py-0.5 transition-colors min-w-[200px]"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-github-dark-muted bg-slate-100 dark:bg-github-dark-border px-2.5 py-1 rounded-full font-bold">{formComponents.length} fields</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFormPreviewOpen(true)}
                    disabled={formComponents.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-github-dark-border hover:bg-slate-200 dark:hover:bg-github-dark-border/80 text-slate-700 dark:text-github-dark-text rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    <Eye size={14} /> Preview Form
                  </button>
                  <button
                    onClick={() => { setSaveTemplateName(formTitle); setSaveTemplateDesc(''); setIsSaveTemplateModalOpen(true); }}
                    disabled={formComponents.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-40"
                  >
                    <Save size={14} /> Save as Template
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                    <CheckCircle2 size={14} /> Publish Form
                  </button>
                </div>
              </div>

              {/* Two-Column Layout: Palette + Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* Left: Component Palette */}
                <div className="lg:col-span-1 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm overflow-hidden sticky top-4">
                  <div className="p-4 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-bg/30">
                    <h4 className="font-extrabold text-[11px] text-slate-600 dark:text-github-dark-text uppercase tracking-widest">Field Components</h4>
                    <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5">Click any to add to canvas</p>
                  </div>
                  <div className="p-3 space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar">
                    {COMPONENT_PALETTE.map(group => (
                      <div key={group.category}>
                        <p className="text-[9px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-widest mb-1.5 px-1">{group.category}</p>
                        <div className="space-y-1">
                          {group.items.map(item => (
                            <button
                              key={item.type}
                              onClick={() => addFieldToCanvas(item)}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/15 hover:text-[#0969da] text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all group/btn text-left border border-transparent hover:border-blue-100 dark:hover:border-blue-900/20"
                            >
                              <span className="p-1.5 bg-slate-100 dark:bg-github-dark-border rounded-lg group-hover/btn:bg-blue-100 dark:group-hover/btn:bg-blue-950/30 transition-colors shrink-0 text-slate-500 dark:text-slate-400 group-hover/btn:text-[#0969da]">
                                {getPaletteIconElement(item.icon, 11)}
                              </span>
                              <span className="leading-none flex-1">{item.label}</span>
                              <Plus size={11} className="text-slate-300 dark:text-slate-600 group-hover/btn:text-[#0969da] transition-colors shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Form Canvas */}
                <div className="lg:col-span-3 space-y-2.5">
                  {formComponents.length === 0 ? (
                    <div className="bg-white dark:bg-github-dark-subtle border-2 border-dashed border-slate-200 dark:border-github-dark-border rounded-2xl p-16 text-center">
                      <LayoutTemplate size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                      <h4 className="font-extrabold text-slate-600 dark:text-github-dark-text text-sm mb-1">Canvas is Empty</h4>
                      <p className="text-xs text-slate-400 dark:text-github-dark-muted">Click any component from the palette on the left to add it here.</p>
                    </div>
                  ) : (
                    formComponents.map((field, idx) => (
                      <div
                        key={field.id}
                        className={`bg-white dark:bg-github-dark-subtle border rounded-xl shadow-sm transition-all ${editingFieldId === field.id ? 'border-[#0969da] ring-2 ring-[#0969da]/10' : 'border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-500'}`}
                      >
                        {/* Field Card Header */}
                        <div className="flex items-center gap-2.5 px-4 py-2.5">
                          <span className={`p-1.5 rounded-lg text-white shrink-0 ${getFieldTypeColor(field.type)}`}>
                            {getFieldTypeIconElement(field.type, 11)}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">{getFieldTypeLabel(field.type)}</span>
                          {field.required && <span className="text-[9px] bg-rose-100 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-bold">Required</span>}
                          
                          {/* Right Controls */}
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={() => updateField(field.id, { width: field.width === 'full' ? 'half' : 'full' })}
                              className="text-[9px] font-bold border border-slate-200 dark:border-github-dark-border rounded-lg px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                              title="Toggle width"
                            >
                              {field.width === 'full' ? '⬛ Full' : '▪ Half'}
                            </button>
                            <button
                              onClick={() => updateField(field.id, { required: !field.required })}
                              className={`text-[9px] font-bold border rounded-lg px-2 py-1 transition-colors ${field.required ? 'border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10' : 'border-slate-200 dark:border-github-dark-border text-slate-400 hover:text-slate-600 hover:border-slate-400'}`}
                              title="Toggle required"
                            >
                              {field.required ? '★ Req' : '☆ Opt'}
                            </button>
                            <button onClick={() => moveFieldUp(idx)} disabled={idx === 0} className="p-1.5 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors">
                              <MoveUp size={12} />
                            </button>
                            <button onClick={() => moveFieldDown(idx)} disabled={idx === formComponents.length - 1} className="p-1.5 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors">
                              <MoveDown size={12} />
                            </button>
                            <button
                              onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                              className={`p-1.5 rounded-lg transition-colors ${editingFieldId === field.id ? 'bg-[#0969da] text-white' : 'hover:bg-slate-100 dark:hover:bg-github-dark-border/40 text-slate-400 hover:text-slate-600'}`}
                              title="Edit field settings"
                            >
                              <PenLine size={12} />
                            </button>
                            <button onClick={() => deleteField(field.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-500 transition-colors" title="Delete field">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Field Preview */}
                        <div className="px-4 pb-3">
                          {field.type === 'section_header' ? (
                            <div className="border-t-2 border-slate-100 dark:border-github-dark-border/60 pt-2">
                              <span className="font-extrabold text-sm text-slate-700 dark:text-github-dark-text">{field.label || 'Section Header'}</span>
                            </div>
                          ) : field.type === 'divider' ? (
                            <hr className="border-slate-200 dark:border-github-dark-border mt-1" />
                          ) : (
                            <>
                              <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1.5 block">
                                {field.label || 'Untitled Field'} {field.required && <span className="text-rose-500">*</span>}
                              </label>
                              {(field.type === 'select' || field.type === 'radio_group' || field.type === 'checkbox_group') ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {field.options.length > 0 ? field.options.map((opt, i) => (
                                    <span key={i} className="bg-slate-100 dark:bg-github-dark-border text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-github-dark-border/60 font-medium">{opt}</span>
                                  )) : <span className="text-xs text-slate-400 italic">No options added — click edit to add</span>}
                                </div>
                              ) : field.type === 'file' ? (
                                <div className="border-2 border-dashed border-slate-200 dark:border-github-dark-border rounded-xl p-3 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                                  <Upload size={14} /> Click to upload
                                </div>
                              ) : field.type === 'textarea' ? (
                                <div className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400 min-h-[44px] flex items-start">{field.placeholder || 'Long answer text...'}</div>
                              ) : (
                                <div className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400">{field.placeholder || 'Short answer text...'}</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* ── Edit Panel (expanded when pencil icon clicked) ── */}
                        {editingFieldId === field.id && (
                          <div className="border-t border-slate-100 dark:border-github-dark-border/50 px-4 py-4 space-y-3 bg-slate-50/50 dark:bg-github-dark-bg/30 rounded-b-xl">
                            {field.type !== 'divider' && (
                              <div>
                                <label className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mb-1.5 block">Field Label</label>
                                <input
                                  value={field.label}
                                  onChange={e => updateField(field.id, { label: e.target.value })}
                                  className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                                  placeholder="Field label text"
                                />
                              </div>
                            )}
                            {field.type !== 'section_header' && field.type !== 'divider' && field.type !== 'file' && field.type !== 'select' && field.type !== 'radio_group' && field.type !== 'checkbox_group' && (
                              <div>
                                <label className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mb-1.5 block">Placeholder Text</label>
                                <input
                                  value={field.placeholder}
                                  onChange={e => updateField(field.id, { placeholder: e.target.value })}
                                  className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                                  placeholder="Hint text shown to the candidate..."
                                />
                              </div>
                            )}
                            {(field.type === 'select' || field.type === 'radio_group' || field.type === 'checkbox_group') && (
                              <div>
                                <label className="text-[10px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mb-2 block">Options</label>
                                <div className="space-y-1.5">
                                  {field.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <input
                                        value={opt}
                                        onChange={e => updateFieldOption(field.id, optIdx, e.target.value)}
                                        className="flex-1 px-3 py-1.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                                        placeholder={`Option ${optIdx + 1}`}
                                      />
                                      <button onClick={() => removeFieldOption(field.id, optIdx)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addOptionToField(field.id)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0969da] hover:text-[#0969da]/80 transition-colors mt-1"
                                  >
                                    <Plus size={12} /> Add Option
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: SAVED TEMPLATES ── */}
          {formBuilderStep === 'saved' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setFormBuilderStep('choose')} className="p-2 hover:bg-slate-100 dark:hover:bg-github-dark-border/40 rounded-lg transition-all text-slate-500 dark:text-github-dark-muted">
                  <ArrowLeft size={16} />
                </button>
                <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-base">My Saved Templates</h3>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">{savedFormTemplates.length} saved</span>
              </div>

              {savedFormTemplates.length === 0 ? (
                <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-16 text-center shadow-sm">
                  <Bookmark size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h4 className="font-extrabold text-slate-600 dark:text-github-dark-text text-sm mb-2">No Saved Templates Yet</h4>
                  <p className="text-xs text-slate-400 dark:text-github-dark-muted mb-6 max-w-xs mx-auto leading-relaxed">
                    Build a form from scratch or customise a predefined template, then click "Save as Template" to store it here for future reuse.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => { setFormComponents([]); setFormTitle('New Application Form'); setEditingFieldId(null); setFormBuilderStep('build'); }}
                      className="px-5 py-2.5 bg-[#0969da] text-white rounded-lg text-xs font-bold hover:bg-[#0969da]/90 transition-all shadow-sm"
                    >
                      Build Your First Form
                    </button>
                    <button
                      onClick={() => setFormBuilderStep('predefined')}
                      className="px-5 py-2.5 bg-slate-100 dark:bg-github-dark-border text-slate-700 dark:text-github-dark-text rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      Use a Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {savedFormTemplates.map(tpl => (
                    <div key={tpl.id} className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-github-dark-text truncate">{tpl.name}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-github-dark-muted mt-0.5 line-clamp-2">{tpl.description}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSavedTemplate(tpl.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5 text-[10px] text-slate-400 dark:text-github-dark-muted mb-3">
                        <span className="bg-slate-100 dark:bg-github-dark-border px-2.5 py-0.5 rounded-full font-bold">{(tpl.fields || []).length} fields</span>
                        <span>Saved {new Date(tpl.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>

                      <div className="space-y-1.5 mb-4 flex-1">
                        {(tpl.fields || []).filter(f => f.type !== 'divider').slice(0, 5).map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className={`p-0.5 rounded text-white shrink-0 ${getFieldTypeColor(f.type)}`}>{getFieldTypeIconElement(f.type, 8)}</span>
                            <span className="font-medium truncate">{f.label}</span>
                          </div>
                        ))}
                        {(tpl.fields?.length || 0) > 5 && (
                          <p className="text-[10px] text-slate-400 dark:text-github-dark-muted pl-5">+{tpl.fields.length - 5} more fields...</p>
                        )}
                      </div>

                      <button
                        onClick={() => loadFormTemplate(tpl.fields, tpl.name)}
                        className="w-full py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        Use Template <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* AI CANDIDATE SUMMARY MODAL                       */}
      {/* ════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════ */}
      {/* UNIFIED CANDIDATES / DETAILS RIGHT SIDEBAR DRAWER  */}
      {/* ════════════════════════════════════════════════ */}
      {(selectedJobForSidebar || selectedCandidate) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="absolute inset-0" onClick={() => {
            setSelectedJobForSidebar(null);
            setSelectedCandidate(null);
          }}></div>
          <div className="relative z-10 bg-white dark:bg-github-dark-subtle border-l border-slate-200 dark:border-github-dark-border w-full max-w-3xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            
            {/* --- CASE A: Candidates List Drawer --- */}
            {selectedJobForSidebar && !selectedCandidate && (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                      <Briefcase size={20} className="text-[#0969da]" />
                      Applicants for {selectedJobForSidebar.job_title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium mt-1">
                      {selectedJobForSidebar.department} &bull; {selectedJobForSidebar.location} &bull; {sortedSidebarCandidates.length} Candidates
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedJobForSidebar(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-border transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Filter / Search Bar */}
                <div className="p-6 border-b border-slate-100 dark:border-github-dark-border/60 bg-slate-50/50 dark:bg-github-dark-bg/10 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search applicants by name or skill..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da]"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <span className="text-[10px] text-slate-400 dark:text-github-dark-muted font-bold uppercase shrink-0">Sort By:</span>
                    <MinimalSelect
                      size="sm"
                      value={sortBy}
                      onChange={(val) => setSortBy(val)}
                      options={[
                        { value: 'overall', label: 'Overall Match' },
                        { value: 'skill', label: 'Skills Fit' },
                        { value: 'experience', label: 'Experience Fit' },
                        { value: 'education', label: 'Education Fit' },
                        { value: 'culture', label: 'Culture Fit' }
                      ]}
                      triggerClassName="w-full sm:w-auto justify-between !bg-white dark:!bg-github-dark-subtle !border-slate-200 dark:!border-github-dark-border text-slate-700 dark:text-[#c9d1d9] font-bold text-xs px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>

                {/* Body: Candidate List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                  {sortedSidebarCandidates.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 dark:border-github-dark-border rounded-2xl">
                      <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
                      <h4 className="font-bold text-sm text-slate-700 dark:text-github-dark-text">No Applicants Found</h4>
                      <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-1">
                        No candidates have applied matching this description or filter.
                      </p>
                    </div>
                  ) : (
                    sortedSidebarCandidates.map((cand, idx) => (
                      <div
                        key={cand.id}
                        onClick={() => setSelectedCandidate(cand)}
                        className="cursor-pointer bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:border-[#0969da] flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                            idx === 0 
                              ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/50' 
                              : idx === 1
                                ? 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-github-dark-border dark:border-github-dark-border/80'
                                : 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/20 dark:border-orange-900/50'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-800 dark:text-github-dark-text">{cand.full_name}</h4>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                                cand.ai_recommendation === 'Highly Recommended' 
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                              }`}>
                                {cand.ai_recommendation}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium mt-1">
                              Current: <span className="font-semibold text-slate-700 dark:text-[#f0f6fc]">{cand.current_company}</span> &bull; Stage: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{cand.stage}</span>
                            </p>
                          </div>
                        </div>
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 px-3 py-1.5 rounded-xl text-center shrink-0">
                          <span className="text-[9px] text-indigo-500 block uppercase font-extrabold">Overall</span>
                          <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">{cand.ai_score}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* --- CASE B: Candidate In-Depth Details Drawer --- */}
            {selectedCandidate && (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-start">
                  <div>
                    {selectedJobForSidebar && (
                      <button
                        onClick={() => setSelectedCandidate(null)}
                        className="flex items-center gap-1 text-xs font-extrabold text-[#0969da] hover:text-[#0969da]/80 dark:text-github-dark-accent mb-2.5 transition-colors"
                      >
                        <ArrowLeft size={13} /> Back to Applicants List
                      </button>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-extrabold text-xl text-slate-800 dark:text-github-dark-text">{selectedCandidate.full_name}</h3>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        selectedCandidate.ai_recommendation === 'Highly Recommended' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                      }`}>
                        {selectedCandidate.ai_recommendation}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-github-dark-muted font-medium mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Email: {selectedCandidate.email}</span>
                      <span>Mobile: {selectedCandidate.mobile}</span>
                      <span>Notice Period: <strong className="text-slate-700 dark:text-github-dark-text">{selectedCandidate.notice_period}</strong></span>
                    </p>
                  </div>

                  <button 
                    onClick={() => {
                      setSelectedJobForSidebar(null);
                      setSelectedCandidate(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-border transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
                  
                  {/* Score bar */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase font-extrabold block">AI Score</span>
                      <div className="w-20 h-20 rounded-full border-4 border-indigo-500 flex items-center justify-center text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-2 bg-white dark:bg-github-dark-subtle shadow-sm animate-in zoom-in duration-300">
                        {selectedCandidate.ai_score}%
                      </div>
                    </div>

                    <div className="md:col-span-4 bg-slate-50 dark:bg-github-dark-bg/50 border border-slate-200 dark:border-github-dark-border rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 items-center justify-center text-center">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted uppercase">Skills Match</span>
                        <p className="text-xl font-bold mt-1 text-slate-800 dark:text-[#f0f6fc]">{selectedCandidate.skill_match_score}%</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted uppercase">Experience Match</span>
                        <p className="text-xl font-bold mt-1 text-slate-800 dark:text-[#f0f6fc]">{selectedCandidate.experience_match_score}%</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted uppercase">Education Match</span>
                        <p className="text-xl font-bold mt-1 text-slate-800 dark:text-[#f0f6fc]">{selectedCandidate.education_match_score}%</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted uppercase">Culture Fit</span>
                        <p className="text-xl font-bold mt-1 text-slate-800 dark:text-[#f0f6fc]">{selectedCandidate.culture_fit_score}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50/30 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5">
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm flex items-center gap-1.5 mb-3">
                        <ThumbsUp size={16} /> Strengths
                      </h4>
                      <ul className="space-y-2 list-disc pl-5 text-slate-600 dark:text-slate-300">
                        {(selectedCandidate.ai_strengths || []).map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-red-50/30 dark:bg-red-950/5 border border-red-100 dark:border-red-900/30 rounded-2xl p-5">
                      <h4 className="font-bold text-red-800 dark:text-red-400 text-sm flex items-center gap-1.5 mb-3">
                        <ThumbsDown size={16} /> Weaknesses
                      </h4>
                      <ul className="space-y-2 list-disc pl-5 text-slate-600 dark:text-slate-300">
                        {(selectedCandidate.ai_weaknesses || []).map((weak, idx) => (
                          <li key={idx}>{weak}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Extracted Profile Details */}
                  <div className="bg-white dark:bg-github-dark-bg/20 border border-slate-200 dark:border-github-dark-border rounded-2xl p-6 space-y-5">
                    <h4 className="font-bold text-slate-800 dark:text-github-dark-text border-b border-slate-100 dark:border-github-dark-border pb-2 flex items-center gap-1.5">
                      <Sparkles size={16} className="text-indigo-500" /> Extracted Candidate Profile (AI Resume parsing)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Education</span>
                        <p className="font-semibold text-slate-800 dark:text-github-dark-text mt-1">{selectedCandidate.education || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Experience</span>
                        <p className="font-semibold text-slate-800 dark:text-github-dark-text mt-1">{selectedCandidate.total_experience || 'N/A'} (Relevant: {selectedCandidate.relevant_experience || 'N/A'})</p>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Current CTC &amp; Company</span>
                        <p className="font-semibold text-slate-800 dark:text-github-dark-text mt-1">{(selectedCandidate.current_ctc || 'N/A') + ' • ' + (selectedCandidate.current_company || 'N/A')}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Parsed Skills List</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedCandidate.extracted_skills || []).map((skill, idx) => (
                          <span key={idx} className="bg-slate-100 dark:bg-github-dark-border px-2.5 py-1 rounded text-xs font-mono font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {Array.isArray(selectedCandidate.projects) && selectedCandidate.projects.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Key Projects</span>
                        <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          {selectedCandidate.projects.map((proj, idx) => (
                            <li key={idx} className="font-medium">{proj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(selectedCandidate.achievements) && selectedCandidate.achievements.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Top Achievements</span>
                        <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          {selectedCandidate.achievements.map((ach, idx) => (
                            <li key={idx} className="font-medium text-indigo-600 dark:text-indigo-400">{ach}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedCandidate.cover_letter && (
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Cover Note</span>
                        <p className="p-3 bg-slate-50 dark:bg-github-dark-bg/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line italic">
                          "{selectedCandidate.cover_letter}"
                        </p>
                      </div>
                    )}

                    {selectedCandidate.form_responses && Object.keys(selectedCandidate.form_responses).length > 0 && (
                      <div className="pt-3 border-t border-slate-100 dark:border-github-dark-border mt-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Form Questionnaire Responses</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-github-dark-bg/30 p-4 rounded-xl">
                          {Object.entries(selectedCandidate.form_responses).map(([label, val]) => {
                            if (
                              ['resume_name', 'resume_url'].includes(label) ||
                              val === null || val === undefined || val === ''
                            ) return null;
                            
                            const displayVal = Array.isArray(val) ? val.join(', ') : String(val);

                            return (
                              <div key={label} className="text-xs">
                                <span className="font-semibold text-slate-400 dark:text-github-dark-muted block mb-0.5">{label}</span>
                                <span className="font-medium text-slate-800 dark:text-[#c9d1d9]">{displayVal}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Visible PDF Resume Embedded Iframe */}
                    {selectedCandidate.resume_path && (
                      <div className="pt-4 border-t border-slate-100 dark:border-github-dark-border mt-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Uploaded Resume PDF</span>
                        <iframe
                          src={`${api.defaults.baseURL || ''}/recruitment/resumes/${selectedCandidate.resume_path}`}
                          className="w-full h-[600px] border border-slate-200 dark:border-github-dark-border rounded-xl shadow-inner bg-slate-50 dark:bg-github-dark-bg/50"
                          title={`${selectedCandidate.full_name} Resume`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-bg/30 flex flex-col gap-4 shrink-0">
                  <div className="flex items-center justify-between bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border px-4 py-2.5 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-slate-500 dark:text-github-dark-muted">Change pipeline stage:</span>
                    <MinimalSelect
                      size="sm"
                      value={selectedCandidate.stage}
                      onChange={(val) => {
                        handleUpdateStage(selectedCandidate.id, val);
                        setSelectedCandidate(prev => ({ ...prev, stage: val }));
                      }}
                      options={pipelineStages.map(s => ({ value: s.name, label: s.name }))}
                      triggerClassName="!bg-transparent !border-0 px-2 py-1 text-xs font-bold text-[#0969da] dark:text-[#f0f6fc] focus:outline-none justify-between"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      onClick={() => handleDeleteCandidate(selectedCandidate.id, selectedCandidate.full_name)}
                      className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Trash2 size={13} /> Delete Applicant
                    </button>
                    {selectedJobForSidebar ? (
                      <button
                        onClick={() => setSelectedCandidate(null)}
                        className="px-3 py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        Back to Applicants
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedJobForSidebar(null);
                          setSelectedCandidate(null);
                        }}
                        className="px-3 py-2.5 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* SAVE AS TEMPLATE MODAL                          */}
      {/* ════════════════════════════════════════════════ */}
      {isSaveTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-github-dark-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                  <Save size={15} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-sm">Save as Template</h3>
              </div>
              <button onClick={() => setIsSaveTemplateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-github-dark-border">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-1.5 block">Template Name *</label>
                <input
                  value={saveTemplateName}
                  onChange={e => setSaveTemplateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-github-dark-text"
                  placeholder="e.g. Tech Role Standard Form"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-1.5 block">Description <span className="font-normal normal-case">(optional)</span></label>
                <textarea
                  rows="2"
                  value={saveTemplateDesc}
                  onChange={e => setSaveTemplateDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-github-dark-text resize-none"
                  placeholder="Brief description of this form template..."
                />
              </div>
              <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50/60 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <strong>{formComponents.length}</strong> form fields will be saved in this template.
                </span>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3 justify-end">
              <button onClick={() => setIsSaveTemplateModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-github-dark-border text-slate-700 dark:text-github-dark-text rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-github-dark-border/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Save size={13} /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* FORM PREVIEW MODAL                              */}
      {/* ════════════════════════════════════════════════ */}
      {formPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                  <Eye size={15} className="text-[#0969da]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-sm">{formTitle}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5">Candidate-facing application form preview</p>
                </div>
              </div>
              <button onClick={() => setFormPreviewOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-border transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
              <div className="space-y-4">
                {formComponents.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No fields added yet.</div>
                ) : (
                  formComponents.map(field => (
                    <div key={field.id}>
                      {field.type === 'section_header' ? (
                        <div className="border-t-2 border-slate-100 dark:border-github-dark-border pt-4 mt-2">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-github-dark-text">{field.label}</h4>
                        </div>
                      ) : field.type === 'divider' ? (
                        <hr className="border-slate-200 dark:border-github-dark-border" />
                      ) : (
                        <div className={field.width === 'half' ? 'w-full md:w-1/2' : 'w-full'}>
                          <label className="text-xs font-semibold text-slate-600 dark:text-github-dark-text mb-1.5 block">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea rows="3" disabled className="w-full px-3.5 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400 resize-none" placeholder={field.placeholder || 'Enter details...'} />
                          ) : field.type === 'select' ? (
                            <select disabled className="w-full px-3.5 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400">
                              <option>— Select an option —</option>
                              {field.options.map((o, i) => <option key={i}>{o}</option>)}
                            </select>
                          ) : field.type === 'radio_group' ? (
                            <div className="space-y-2">
                              {field.options.map((o, i) => (
                                <label key={i} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                  <input type="radio" disabled className="accent-[#0969da]" /> {o}
                                </label>
                              ))}
                            </div>
                          ) : field.type === 'checkbox_group' ? (
                            <div className="space-y-2">
                              {field.options.map((o, i) => (
                                <label key={i} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                  <input type="checkbox" disabled className="accent-[#0969da]" /> {o}
                                </label>
                              ))}
                            </div>
                          ) : field.type === 'file' ? (
                            <div className="border-2 border-dashed border-slate-200 dark:border-github-dark-border rounded-xl p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                              <Upload size={16} /> Click to upload file
                            </div>
                          ) : (
                            <input
                              type={field.type === 'url' ? 'text' : field.type}
                              disabled
                              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs text-slate-400"
                              placeholder={field.placeholder || 'Enter text...'}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-bg/30 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-400 dark:text-github-dark-muted">
                {formComponents.filter(f => f.required).length} required &nbsp;·&nbsp; {formComponents.length} total fields
              </span>
              <button onClick={() => setFormPreviewOpen(false)} className="px-5 py-2 bg-[#0969da] text-white rounded-xl text-xs font-extrabold hover:bg-[#0969da]/90 transition-colors shadow-sm">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════════════════════════════════════════════════ */}
      {/* PIPELINE CUSTOMIZATION MODAL                     */}
      {/* ════════════════════════════════════════════════ */}
      {isCustomizingPipeline && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="absolute inset-0" onClick={() => setIsCustomizingPipeline(false)}></div>
          <div className="relative z-10 bg-white dark:bg-github-dark-subtle border-l border-slate-200 dark:border-github-dark-border w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-github-dark-border flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                  <Sliders size={15} className="text-[#0969da]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-github-dark-text text-sm">Customize Recruitment Pipeline</h3>
                  <p className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5">
                    Add, edit, reorder or delete recruitment stages. Candidates in modified/deleted stages will migrate.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomizingPipeline(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-github-dark-border transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6 custom-scrollbar">
              {/* Stages List */}
              <div className="space-y-3">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">
                  Pipeline Stages ({editingStages.length})
                </label>
                <div className="space-y-2 border border-slate-100 dark:border-github-dark-border rounded-xl p-3 bg-slate-50/50 dark:bg-github-dark-bg/10">
                  {editingStages.map((stage, idx) => {
                    const colorScheme = PIPELINE_COLOR_MAP[stage.color] || PIPELINE_COLOR_MAP.slate;
                    return (
                      <div
                        key={stage.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border p-3 rounded-xl shadow-xs transition-all"
                      >
                        {/* Reorder actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(idx, 'up')}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-github-dark-border rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Stage Up"
                          >
                            <MoveUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === editingStages.length - 1}
                            onClick={() => handleMoveStage(idx, 'down')}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-github-dark-border rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Stage Down"
                          >
                            <MoveDown size={13} />
                          </button>
                        </div>

                        {/* Name Input */}
                        <div className="flex-1 w-full min-w-0">
                          <input
                            type="text"
                            value={stage.name}
                            onChange={(e) => handleUpdateStageName(idx, e.target.value)}
                            placeholder="e.g. Technical Interview"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0969da] dark:text-github-dark-text"
                          />
                        </div>

                        {/* Color Selector Row */}
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {Object.keys(PIPELINE_COLOR_MAP).map((col) => {
                            const c = PIPELINE_COLOR_MAP[col];
                            const isSelected = stage.color === col;
                            return (
                              <button
                                key={col}
                                type="button"
                                onClick={() => handleUpdateStageColor(idx, col)}
                                className={`w-4 h-4 rounded-full ${c.dot} transition-transform hover:scale-125 focus:outline-none shrink-0 relative ${
                                  isSelected ? 'ring-2 ring-[#0969da] ring-offset-1 dark:ring-offset-github-dark-subtle scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                                title={col.charAt(0).toUpperCase() + col.slice(1)}
                              />
                            );
                          })}
                        </div>

                        {/* Delete Stage */}
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(idx)}
                          disabled={editingStages.length <= 1}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors shrink-0 disabled:opacity-30"
                          title="Delete Stage"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Stage Block */}
              <div className="border border-slate-200 dark:border-github-dark-border rounded-2xl p-4 bg-slate-50/30 dark:bg-github-dark-bg/10 space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider block">
                  Add New Stage
                </h4>
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="Enter new stage name (e.g. Coding Test)..."
                      className="w-full px-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0969da] dark:text-github-dark-text"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNewStage()}
                    />
                  </div>

                  {/* New stage color preset select */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-github-dark-muted uppercase mr-1">Color:</span>
                    {Object.keys(PIPELINE_COLOR_MAP).map((col) => {
                      const c = PIPELINE_COLOR_MAP[col];
                      const isSelected = newStageColor === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewStageColor(col)}
                          className={`w-4 h-4 rounded-full ${c.dot} transition-transform hover:scale-125 focus:outline-none shrink-0 relative ${
                            isSelected ? 'ring-2 ring-[#0969da] ring-offset-1 dark:ring-offset-github-dark-subtle scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          title={col.charAt(0).toUpperCase() + col.slice(1)}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewStage}
                    className="w-full md:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-github-dark-border dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center justify-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-bg/30 flex justify-end items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomizingPipeline(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-github-dark-border text-slate-700 dark:text-github-dark-text rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-github-dark-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomizePipeline}
                className="px-5 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default RecruitmentDashboard;
