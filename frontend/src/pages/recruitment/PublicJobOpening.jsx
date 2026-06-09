import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Briefcase, MapPin, Calendar, Clock, DollarSign, 
  Upload, FileText, Send, CheckCircle,
  Linkedin, Globe, Sparkles, Award, Sun, Moon, ArrowRight
} from 'lucide-react';
import { toast } from 'react-toastify';

// Hardcoded standard openings if not yet set in localStorage
const DEFAULT_OPENINGS = [
  {
    id: 1,
    slug: 'react-developer-001',
    job_title: 'React Developer',
    department: 'Engineering',
    location: 'Bangalore, India / Remote',
    employment_type: 'Full-time',
    experience_required: '2+ Years',
    salary_range: '₹8,000,000 - ₹12,000,000 / year',
    skills_required: 'React, Redux, JavaScript, HTML5, CSS3, Tailwind CSS',
    responsibilities: 'Design and implement user interface components.\nBuild responsive and scalable web apps.\nCollaborate with backend engineers and UI/UX designers.',
    benefits: 'Health insurance & wellness benefits.\nFlexible working hours & remote work allowance.\nLearning stipend and certification reimbursement.',
    deadline: '2026-07-15',
    status: 'active'
  },
  {
    id: 2,
    slug: 'nodejs-engineer-002',
    job_title: 'Node.js Engineer',
    department: 'Engineering',
    location: 'Bangalore, India / Hybrid',
    employment_type: 'Full-time',
    experience_required: '3+ Years',
    salary_range: '₹10,000,000 - ₹15,000,000 / year',
    skills_required: 'Node.js, Express, Knex, MySQL, Redis, AWS, RESTful APIs',
    responsibilities: 'Design and maintain high-performance backend API services.\nOptimize database queries and cache layer.\nImplement security practices and access token controls.',
    benefits: 'Comprehensive health cover.\nQuarterly bonuses & stock options.\nFlexible schedules & hardware allowance.',
    deadline: '2026-07-20',
    status: 'active'
  }
];

const PublicJobOpening = () => {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
    address: '',
    linkedin: '',
    portfolio: '',
    current_company: '',
    current_ctc: '',
    expected_ctc: '',
    notice_period: 'Immediate',
    cover_letter: ''
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Initialize theme from localStorage or default to browser system setting
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    // Get openings from localStorage or set defaults
    const stored = localStorage.getItem('mano_recruitment_openings');
    let openings = DEFAULT_OPENINGS;
    if (stored) {
      try {
        openings = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('mano_recruitment_openings', JSON.stringify(DEFAULT_OPENINGS));
    }

    const foundJob = openings.find(j => j.slug === slug);
    if (foundJob) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (foundJob.status !== 'active') {
        setJob(null);
        setIsExpired(false);
      } else if (foundJob.deadline && foundJob.deadline < todayStr) {
        setJob(null);
        setIsExpired(true);
      } else {
        setJob(foundJob);
        setIsExpired(false);
      }
    } else {
      setJob(null);
      setIsExpired(false);
    }
  }, [slug]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF resumes are supported for AI analysis.');
        return;
      }
      setResumeFile(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!resumeFile) {
      toast.error('Please upload your resume (PDF).');
      return;
    }

    setSubmitting(true);
    setAiAnalyzing(true);

    // Simulate AI resume parsing and candidate ranking
    setTimeout(() => {
      setAiAnalyzing(false);

      // Simple scoring rule engine based on form details for realism
      const skillInput = formData.cover_letter + ' ' + (resumeFile?.name || '');
      const skillsLower = skillInput.toLowerCase();
      
      // Calculate scores dynamically based on matches
      let skillMatch = 70;
      let experienceMatch = 75;
      let educationMatch = 80;
      let cultureFit = 85;

      const jobSkills = job.skills_required.toLowerCase().split(',').map(s => s.trim());
      const matchingSkills = jobSkills.filter(skill => skillsLower.includes(skill) || formData.cover_letter.toLowerCase().includes(skill));
      
      if (matchingSkills.length > 0) {
        skillMatch = Math.min(100, 70 + (matchingSkills.length * 8));
      }

      if (formData.notice_period === 'Immediate') cultureFit = 95;
      if (formData.notice_period === '90 days') cultureFit = 65;

      // Experience calculation based on notice / inputs
      if (formData.current_company) {
        experienceMatch = Math.min(100, 75 + Math.floor(Math.random() * 20));
      }

      const overallScore = Math.round((skillMatch + experienceMatch + educationMatch + cultureFit) / 4);

      let recommendation = 'Recommended';
      if (overallScore >= 85) recommendation = 'Highly Recommended';
      else if (overallScore < 70) recommendation = 'Not Recommended';

      // Strengths & Weaknesses generator
      const strengths = [];
      const weaknesses = [];

      if (matchingSkills.length > 0) {
        strengths.push(`Matches essential requirements: ${matchingSkills.slice(0, 3).join(', ')}`);
      } else {
        strengths.push("Good general skills listed");
      }

      if (formData.notice_period === 'Immediate') {
        strengths.push("Available immediately (Notice period: Immediate)");
      } else {
        weaknesses.push(`Notice period of ${formData.notice_period} might delay onboarding`);
      }

      if (overallScore >= 80) {
        strengths.push("Excellent profile scoring with professional experience indicators");
      }

      if (matchingSkills.length < jobSkills.length / 2) {
        weaknesses.push("Missing core skills requested in the job description");
      }

      if (weaknesses.length === 0) {
        weaknesses.push("None identified from brief resume scanning");
      }

      let initialStage = 'Applied';
      const storedStages = localStorage.getItem('mano_pipeline_stages');
      if (storedStages) {
        try {
          const parsed = JSON.parse(storedStages);
          if (parsed && parsed.length > 0) {
            if (typeof parsed[0] === 'object' && parsed[0].name) {
              initialStage = parsed[0].name;
            } else if (typeof parsed[0] === 'string') {
              initialStage = parsed[0];
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      const newCandidate = {
        id: Date.now(),
        job_id: job.id,
        full_name: formData.full_name,
        email: formData.email,
        mobile: formData.mobile,
        address: formData.address,
        linkedin: formData.linkedin,
        portfolio: formData.portfolio,
        current_company: formData.current_company || 'N/A',
        current_ctc: formData.current_ctc || 'N/A',
        expected_ctc: formData.expected_ctc || 'N/A',
        notice_period: formData.notice_period,
        resume_name: resumeFile.name,
        cover_letter: formData.cover_letter,
        stage: initialStage,
        created_at: new Date().toISOString().split('T')[0],
        ai_score: overallScore,
        skill_match_score: skillMatch,
        experience_match_score: experienceMatch,
        education_match_score: educationMatch,
        culture_fit_score: cultureFit,
        ai_strengths: strengths,
        ai_weaknesses: weaknesses,
        ai_recommendation: recommendation,
        extracted_skills: matchingSkills.length > 0 ? matchingSkills : ['HTML5', 'CSS3', 'JavaScript'],
        total_experience: '2.5 Years',
        relevant_experience: '2 Years',
        education: 'Bachelor of Engineering',
        certifications: ['Agile Methodology Basic Certificate'],
        projects: ['Project Dashboard Implementation', 'Client Portal Interface'],
        achievements: ['Optimized rendering flow by 20%']
      };

      // Save to localStorage
      const storedCandidates = localStorage.getItem('mano_recruitment_candidates');
      let candidatesList = [];
      if (storedCandidates) {
        try {
          candidatesList = JSON.parse(storedCandidates);
        } catch (e) {
          console.error(e);
        }
      }
      candidatesList.push(newCandidate);
      localStorage.setItem('mano_recruitment_candidates', JSON.stringify(candidatesList));

      setSubmitting(false);
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    }, 2500);
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-github-dark-bg flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] p-8 rounded-2xl shadow-lg">
          <Briefcase size={48} className="mx-auto text-slate-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-[#f0f6fc] mb-2">
            {isExpired ? 'Application Deadline Passed' : 'Job Opening Closed'}
          </h2>
          <p className="text-slate-500 dark:text-github-dark-muted text-sm mb-6">
            {isExpired 
              ? 'The deadline for submitting applications to this role has passed, and we are no longer accepting submissions.'
              : 'This opening has been deactivated by the administrator or is no longer accepting applications.'}
          </p>
          <Link to="/login" className="px-5 py-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white rounded-lg text-sm font-medium transition-all">
            Go to Portal Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#010409] font-poppins text-slate-800 dark:text-[#f0f6fc] transition-colors duration-300 pb-16">
      
      {/* Careers Header */}
      <header className="bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#30363d] py-5 shadow-sm transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/mano-logo.svg" alt="MANO" className="w-8 h-8 object-contain" />
            <span className="font-black text-xl text-[#0969da] dark:text-github-dark-accent">MANO Careers</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Header Sun/Moon Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-[#30363d] text-slate-500 dark:text-github-dark-muted border border-slate-200 dark:border-[#30363d] transition-all"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />}
            </button>

            <span className="text-xs bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-[#c9d1d9] px-3 py-1 rounded-full font-mono border border-transparent dark:border-[#30363d]">
              Applicant Portal
            </span>
          </div>
        </div>
      </header>

      {/* Main Body - Horizontal Width Expanded */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 mt-8">
        {submitted ? (
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-10 text-center shadow-lg max-w-2xl mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-[#f0f6fc] mb-3">Application Submitted!</h1>
            <p className="text-slate-600 dark:text-github-dark-muted text-sm mb-2 max-w-md mx-auto">
              Thank you for applying for the <strong>{job.job_title}</strong> role at MANO. Our recruitment team has received your application.
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-8">
              Our AI resume assistant is currently analyzing your credentials for matching. No further action is required from your end.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setSubmitted(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-[#21262d] text-slate-700 dark:text-[#c9d1d9] border border-transparent dark:border-[#30363d] rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#30363d] transition-colors"
              >
                Submit another application
              </button>
            </div>
          </div>
        ) : (
          /* Grid updated to col-12 to scale layouts wider */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Job Details Section (8 Columns out of 12 for spacious horizontal presentation) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-6 md:p-8 shadow-sm transition-colors duration-300">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-[#f0f6fc] leading-tight mb-2">
                      {job.job_title}
                    </h1>
                    <p className="text-sm font-bold text-[#0969da] dark:text-github-dark-accent">
                      {job.department}
                    </p>
                  </div>
                  <span className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-bold">
                    Active Opening
                  </span>
                </div>

                {/* Badges bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-[#161b22] border border-slate-100 dark:border-[#30363d] rounded-xl text-xs font-medium text-slate-600 dark:text-[#8b949e]">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.employment_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>{job.experience_required} Exp Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#0969da] dark:text-github-dark-accent" />
                    <span>Apply before {job.deadline}</span>
                  </div>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-[#c9d1d9] mt-8">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Job Responsibilities
                    </h3>
                    <p className="whitespace-pre-line pl-4">
                      {job.responsibilities}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Skills Required
                    </h3>
                    <div className="flex flex-wrap gap-2 pl-4 mt-3">
                      {job.skills_required.split(',').map((skill, i) => (
                        <span key={i} className="bg-slate-100 dark:bg-[#21262d] border border-transparent dark:border-[#30363d] text-slate-700 dark:text-[#c9d1d9] px-3 py-1.5 rounded-lg text-xs font-mono font-semibold">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#f0f6fc] mb-2.5 border-l-4 border-[#0969da] pl-3">
                      Benefits & Perks
                    </h3>
                    <p className="whitespace-pre-line pl-4">
                      {job.benefits}
                    </p>
                  </div>

                  {job.salary_range && (
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-center gap-3">
                      <DollarSign size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Offered Salary Package Range:</span>
                        <p className="font-bold text-indigo-700 dark:text-indigo-400 text-sm mt-0.5">{job.salary_range}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Application Submission Form (4 Columns or 5 Columns out of 12) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl p-6 shadow-sm sticky top-6 transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-[#f0f6fc] mb-4 flex items-center gap-2">
                  <Send size={18} className="text-[#0969da]" />
                  Apply for this position
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      required
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      name="mobile"
                      required
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Current Company
                    </label>
                    <input
                      type="text"
                      name="current_company"
                      value={formData.current_company}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                      placeholder="ACME Corp"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                        Current CTC
                      </label>
                      <input
                        type="text"
                        name="current_ctc"
                        value={formData.current_ctc}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                        placeholder="₹6 LPA"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                        Expected CTC
                      </label>
                      <input
                        type="text"
                        name="expected_ctc"
                        value={formData.expected_ctc}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                        placeholder="₹9 LPA"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Notice Period *
                    </label>
                    <select
                      name="notice_period"
                      value={formData.notice_period}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="15 days">15 Days</option>
                      <option value="30 days">30 Days</option>
                      <option value="60 days">60 Days</option>
                      <option value="90 days">90 Days</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block flex items-center gap-1">
                        <Linkedin size={12} className="text-[#0a66c2]" /> LinkedIn Profile
                      </label>
                      <input
                        type="url"
                        name="linkedin"
                        value={formData.linkedin}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                        placeholder="linkedin.com/in/..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block flex items-center gap-1">
                        <Globe size={12} className="text-slate-400" /> Portfolio Website
                      </label>
                      <input
                        type="url"
                        name="portfolio"
                        value={formData.portfolio}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                        placeholder="johndoe.dev"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Short Cover Letter / Cover Note
                    </label>
                    <textarea
                      name="cover_letter"
                      rows="3"
                      value={formData.cover_letter}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/20 focus:border-[#0969da] dark:text-[#f0f6fc]"
                      placeholder="Brief note on why you're a good fit..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted mb-1 block">
                      Resume File (PDF Only) *
                    </label>
                    <div className="relative border-2 border-dashed border-slate-200 dark:border-[#30363d] rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-[#161b22] transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        required
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Upload size={20} className="text-slate-400" />
                        {resumeFile ? (
                          <span className="text-xs font-bold text-slate-700 dark:text-[#c9d1d9] flex items-center gap-1">
                            <FileText size={12} className="text-indigo-500" />
                            {resumeFile.name}
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-semibold text-slate-600 dark:text-[#c9d1d9]">Click to Upload Resume</span>
                            <span className="text-[10px] text-slate-400">PDF up to 5MB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {aiAnalyzing ? (
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3.5 text-center flex flex-col items-center gap-2 animate-pulse">
                      <Sparkles className="w-5 h-5 text-indigo-500 animate-spin" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">AI Resume Assistant analyzing skills...</span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center gap-2 bg-[#0969da] hover:bg-[#0969da]/90 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={16} />
                      Submit Application
                    </button>
                  )}
                </form>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default PublicJobOpening;
