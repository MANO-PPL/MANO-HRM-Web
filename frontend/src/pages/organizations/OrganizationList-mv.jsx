import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Building, Plus, Loader2, Save, X, Search, Calendar, Shield, Activity, Clock, Users, Trash2, AlertTriangle, RotateCcw, Pencil, Phone, Mail, Lock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput from '../../components/PhoneInput';
import { validatePhone, validateEmail } from '../../utils/validation';

const OrgDetailModal = ({ org, onClose, onRefresh, listTab }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    ...org, 
    gst_number: org.gst_number || '',
    pan_number: org.pan_number || '',
    subscription_expiry: org.subscription_expiry ? new Date(org.subscription_expiry).toISOString().split('T')[0] : '' 
  });
  
  // Admins state
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [adminFormData, setAdminFormData] = useState({});

  useEffect(() => {
    fetchOrgAdmins();
  }, [org.org_id]);

  const fetchOrgAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await api.get(`/organizations/${org.org_id}/admins`);
      setOrgAdmins(res.data.data || []);
      setEditingAdminId(null);
    } catch (error) {
      toast.error('Failed to fetch org admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleEditAdmin = (admin) => {
    setEditingAdminId(admin.user_id);
    setAdminFormData({
      user_name: admin.user_name || '',
      email: admin.email || '',
      phone_no: admin.phone_no || '',
      is_active: admin.is_active ? true : false,
      password: ''
    });
  };

  const handleSaveAdmin = async (adminId) => {
    if (!validateEmail(adminFormData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (adminFormData.phone_no && !validatePhone(adminFormData.phone_no)) {
      toast.error("Please enter a valid phone number according to the country code.");
      return;
    }
    try {
      await api.put(`/organizations/${org.org_id}/admins/${adminId}`, adminFormData);
      toast.success("Admin updated successfully");
      fetchOrgAdmins();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update admin');
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    
    // Validate organization code
    const cleanCode = formData.org_code.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z0-9]+$/.test(cleanCode)) {
      toast.error("Organization code must be 3-10 alphanumeric characters with no spaces.");
      return;
    }

    if (!validateEmail(formData.contact_email)) {
      toast.error("Please enter a valid contact email address.");
      return;
    }
    if (!validatePhone(formData.contact_phone)) {
      toast.error("Please enter a valid contact phone number according to the country code.");
      return;
    }

    // GST & PAN validation
    const gst = (formData.gst_number || '').trim().toUpperCase();
    const pan = (formData.pan_number || '').trim().toUpperCase();

    if ((gst && !pan) || (!gst && pan)) {
      toast.error("Please enter both GST and PAN, or leave both fields blank.");
      return;
    }

    if (gst && pan) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

      if (!gstRegex.test(gst)) {
        toast.error("Please enter a valid GST number.");
        return;
      }
      if (!panRegex.test(pan)) {
        toast.error("Please enter a valid PAN number.");
        return;
      }
    }

    const payload = {
      ...formData,
      org_code: cleanCode,
      gst_number: gst || null,
      pan_number: pan || null
    };

    setFormLoading(true);
    try {
      await api.put(`/organizations/${org.org_id}`, payload);
      toast.success('Organization updated successfully');
      setIsEditing(false);
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save organization details');
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await api.put(`/organizations/${org.org_id}`, { status: 'active' });
      toast.success('Organization approved successfully');
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async () => {
    if (window.confirm("Are you sure you want to reject and delete this organization?")) {
      try {
        const res = await api.delete(`/organizations/${org.org_id}`);
        toast.success(res.data.message || 'Organization rejected successfully');
        onRefresh();
        onClose();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Rejection failed');
      }
    }
  };

  const handleDeactivate = async () => {
    if (window.confirm("Are you sure you want to suspend this organization? This disables access for all of its users.")) {
      try {
        await api.put(`/organizations/${org.org_id}`, { status: 'suspended' });
        toast.success('Organization deactivated successfully');
        onRefresh();
        onClose();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Deactivation failed');
      }
    }
  };

  const handleReactivate = async () => {
    try {
      await api.put(`/organizations/${org.org_id}`, { status: 'active' });
      toast.success('Organization reactivated successfully');
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reactivation failed');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to schedule this organization for deletion?")) {
      try {
        const res = await api.delete(`/organizations/${org.org_id}`);
        toast.success(res.data.message || 'Organization scheduled for deletion.');
        onRefresh();
        onClose();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Deletion failed.');
      }
    }
  };

  const handleCancelDeletion = async () => {
    try {
      const res = await api.post(`/organizations/${org.org_id}/cancel-deletion`);
      toast.success(res.data.message || 'Deletion cancelled.');
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel deletion.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="relative bg-white dark:bg-black w-full rounded-t-[2.5rem] p-6 shadow-2xl border-t border-slate-100 dark:border-slate-800 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />

        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-50 dark:bg-white/5"><X size={18} /></button>

        {isEditing ? (
          <form onSubmit={handleSaveOrg} className="space-y-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Edit Organization</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Org Name</label>
                <input required value={formData.org_name} onChange={(e) => setFormData({ ...formData, org_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Org Code</label>
                <input required value={formData.org_code} onChange={(e) => setFormData({ ...formData, org_code: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono" placeholder="Organization Code (e.g. ACM01)" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Plan</label>
                <select value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="Trial">Trial</option>
                  <option value="Basic">Basic</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Expiry Date</label>
                <input type="date" value={formData.subscription_expiry} onChange={(e) => setFormData({ ...formData, subscription_expiry: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Max Users</label>
                <input type="number" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Contact Person</label>
                <input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Contact Email</label>
                <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Contact Phone</label>
                <PhoneInput
                  value={formData.contact_phone}
                  onChange={(val) => setFormData({ ...formData, contact_phone: val })}
                  variant="admin-mobile"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">GST Number</label>
                <input value={formData.gst_number || ''} onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm uppercase font-mono" placeholder="GST Number" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">PAN Number</label>
                <input value={formData.pan_number || ''} onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm uppercase font-mono" placeholder="PAN Number" />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="submit" disabled={formLoading} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2">
                {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-655 dark:text-github-dark-muted rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-white/5">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center"><Building size={20} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase leading-none">{org.org_name}</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest mt-1 block">CODE: {org.org_code}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${org.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : org.status === 'pending_approval' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{org.status}</span>
              </div>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subscription</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{org.subscription_plan}</span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Max Users</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{org.max_users} Users</span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5 col-span-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Expiry Date</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {org.subscription_expiry ? new Date(org.subscription_expiry).toLocaleDateString() : 'Lifetime / Unlimited'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Name</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">{org.contact_name || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Email</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">{org.contact_email || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">GST Number</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white font-mono truncate block">{org.gst_number || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">PAN Number</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white font-mono truncate block">{org.pan_number || 'N/A'}</span>
              </div>
            </div>

            {/* Administrators section */}
            <div className="space-y-3 border-t border-slate-100 dark:border-white/5 pt-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Org Administrators</h4>
              
              {loadingAdmins ? (
                <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="animate-spin" size={14} /> Loading admins...</div>
              ) : orgAdmins.length === 0 ? (
                <p className="text-xs text-slate-500">No admins found for this organization.</p>
              ) : (
                <div className="space-y-3">
                  {orgAdmins.map(admin => (
                    <div key={admin.user_id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                      {editingAdminId === admin.user_id ? (
                        <div className="space-y-2">
                          <input size="sm" value={adminFormData.user_name} onChange={(e) => setAdminFormData({ ...adminFormData, user_name: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg text-xs" placeholder="Admin Name" />
                          <input size="sm" value={adminFormData.email} onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg text-xs" placeholder="Admin Email" />
                          <input size="sm" value={adminFormData.phone_no} onChange={(e) => setAdminFormData({ ...adminFormData, phone_no: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg text-xs" placeholder="Admin Phone" />
                          <input size="sm" type="password" value={adminFormData.password} onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg text-xs" placeholder="New Password (leave empty to keep)" />
                          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-github-dark-muted uppercase tracking-wider">
                            <input type="checkbox" checked={adminFormData.is_active} onChange={(e) => setAdminFormData({ ...adminFormData, is_active: e.target.checked })} /> Active Status
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => handleSaveAdmin(admin.user_id)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Save</button>
                            <button type="button" onClick={() => setEditingAdminId(null)} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-github-dark-muted rounded-lg text-[10px] font-bold uppercase tracking-wider">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                              {admin.user_name}
                              <span className={`w-1.5 h-1.5 rounded-full ${admin.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-github-dark-muted flex items-center gap-1"><Mail size={10} /> {admin.email}</p>
                            {admin.phone_no && <p className="text-[10px] text-slate-500 dark:text-github-dark-muted flex items-center gap-1"><Phone size={10} /> {admin.phone_no}</p>}
                          </div>
                          <button type="button" onClick={() => handleEditAdmin(admin)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg"><Pencil size={12} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-2.5 border-t border-slate-100 dark:border-white/5 pt-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Status Actions</h4>
              
              <div className="flex flex-wrap gap-2.5">
                {listTab !== 'approval' && (
                  <button type="button" onClick={() => setIsEditing(true)} className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/25 dark:hover:bg-indigo-900/40 dark:text-indigo-300 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-100 dark:border-white/5 flex items-center justify-center gap-1.5">
                    <Pencil size={12} /> Edit Details
                  </button>
                )}

                {listTab === 'deleted' ? (
                  <button type="button" onClick={handleCancelDeletion} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm">
                    <RotateCcw size={12} /> Recover Org
                  </button>
                ) : listTab === 'approval' ? (
                  <>
                    <button type="button" onClick={handleApprove} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm">
                      Approve
                    </button>
                    <button type="button" onClick={handleReject} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm">
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    {org.status === 'active' ? (
                      <button type="button" onClick={handleDeactivate} className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-amber-100 dark:border-white/5 flex items-center justify-center gap-1.5">
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" onClick={handleReactivate} className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 dark:text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-white/5 flex items-center justify-center gap-1.5">
                        Reactivate
                      </button>
                    )}
                    <button type="button" onClick={handleDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm">
                      <Trash2 size={12} /> Delete Org
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        )}
      </motion.div>
    </div>
  );
};

const AddOrgModal = ({ onClose, onRefresh }) => {
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    org_name: '', org_code: '', status: 'active', subscription_plan: 'Trial', subscription_expiry: '', grace_period_days: 0, max_users: 50,
    contact_name: '', contact_email: '', contact_phone: '',
    admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
    gst_number: '', pan_number: ''
  });
  const [isOrgCodeManuallyEdited, setIsOrgCodeManuallyEdited] = useState(false);

  // Auto-generate organization code based on organization name
  useEffect(() => {
    if (!isOrgCodeManuallyEdited && formData.org_name) {
      const name = formData.org_name;
      const words = name.trim().split(/[\s\-_]+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
      let code = "";
      if (words.length >= 3) {
        code = words.map(w => w[0]).join("");
      } else if (words.length === 2) {
        const firstWord = words[0];
        const secondWord = words[1];
        if (firstWord.length >= 2) {
          code = firstWord.substring(0, 2) + secondWord.charAt(0);
        } else {
          code = firstWord.charAt(0) + secondWord.substring(0, 2);
        }
      } else if (words.length === 1) {
        code = words[0];
      }

      let cleanCode = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (cleanCode.length > 10) {
        cleanCode = cleanCode.substring(0, 10);
      }
      if (cleanCode.length < 3 && cleanCode.length > 0) {
        const originalClean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (originalClean.length >= 3) {
          cleanCode = originalClean.substring(0, 5);
        } else {
          cleanCode = (cleanCode + "ORG").substring(0, 5);
        }
      }
      if (cleanCode) {
        setFormData(prev => ({ ...prev, org_code: cleanCode }));
      }
    }
  }, [formData.org_name, isOrgCodeManuallyEdited]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate organization code
    const cleanCode = formData.org_code.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 10 || !/^[A-Z0-9]+$/.test(cleanCode)) {
      toast.error("Organization code must be 3-10 alphanumeric characters with no spaces.");
      return;
    }

    if (!validateEmail(formData.contact_email)) {
      toast.error("Please enter a valid contact email address.");
      return;
    }
    if (!validatePhone(formData.contact_phone)) {
      toast.error("Please enter a valid contact phone number according to the country code.");
      return;
    }
    if (!validateEmail(formData.admin_email)) {
      toast.error("Please enter a valid admin email address.");
      return;
    }
    if (formData.admin_phone && !validatePhone(formData.admin_phone)) {
      toast.error("Please enter a valid admin phone number according to the country code.");
      return;
    }

    // GST & PAN validation
    const gst = (formData.gst_number || '').trim().toUpperCase();
    const pan = (formData.pan_number || '').trim().toUpperCase();

    if ((gst && !pan) || (!gst && pan)) {
      toast.error("Please enter both GST and PAN, or leave both fields blank.");
      return;
    }

    if (gst && pan) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

      if (!gstRegex.test(gst)) {
        toast.error("Please enter a valid GST number.");
        return;
      }
      if (!panRegex.test(pan)) {
        toast.error("Please enter a valid PAN number.");
        return;
      }
    }

    const payload = {
      ...formData,
      org_code: cleanCode,
      gst_number: gst || null,
      pan_number: pan || null
    };

    setFormLoading(true);
    try {
      await api.post('/organizations', payload);
      toast.success('Organization created successfully');
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Onboarding failed');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="relative bg-white dark:bg-black w-full rounded-t-[2.5rem] p-6 shadow-2xl border-t border-slate-100 dark:border-slate-800 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-850 rounded-full mx-auto mb-6" />

        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-655 dark:hover:text-white rounded-full bg-slate-50 dark:bg-white/5"><X size={18} /></button>

        <form onSubmit={handleSubmit} className="space-y-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Onboard New Org</h3>

          <div className="space-y-4">
            {/* General Info */}
            <div className="space-y-3 border-b border-slate-100 dark:border-white/5 pb-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization Details</h4>
              <div className="space-y-2">
                <input required value={formData.org_name} onChange={(e) => setFormData({ ...formData, org_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Organization Name" />
                <input required value={formData.org_code} onChange={(e) => { setIsOrgCodeManuallyEdited(true); setFormData({ ...formData, org_code: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() }); }} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono" placeholder="Organization Code (e.g. ACM01)" />
                <select value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="Trial">Trial</option>
                  <option value="Basic">Basic</option>
                  <option value="Premium">Premium</option>
                </select>
                <input type="date" value={formData.subscription_expiry} onChange={(e) => setFormData({ ...formData, subscription_expiry: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Subscription Expiry" />
                <input type="number" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Max Users limit (default 50)" />
                <input value={formData.gst_number || ''} onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm uppercase font-mono" placeholder="GST Number (Optional)" />
                <input value={formData.pan_number || ''} onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm uppercase font-mono" placeholder="PAN Number (Optional)" />
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-3 border-b border-slate-100 dark:border-white/5 pb-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Details</h4>
              <div className="space-y-2">
                <input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Contact Name" />
                <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Contact Email" />
                <PhoneInput
                  value={formData.contact_phone}
                  onChange={(val) => setFormData({ ...formData, contact_phone: val })}
                  variant="admin-mobile"
                  placeholder="Contact Phone"
                />
              </div>
            </div>

            {/* Admin details */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Admin User</h4>
              <div className="space-y-2">
                <input required value={formData.admin_name} onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Admin Name" />
                <input required type="email" value={formData.admin_email} onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Admin Email" />
                <PhoneInput
                  value={formData.admin_phone}
                  onChange={(val) => setFormData({ ...formData, admin_phone: val })}
                  variant="admin-mobile"
                  placeholder="Admin Phone (optional)"
                />
                <input required type="password" value={formData.admin_password} onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm" placeholder="Secure Password" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={formLoading} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2">
              {formLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Onboard Organization
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-655 dark:text-github-dark-muted rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-white/5">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const OrganizationListMobile = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listTab, setListTab] = useState('active'); // 'active' | 'deleted'
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/organizations');
      setOrganizations(res.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const isPendingDeletion = (o) => o.deletion_scheduled_at !== null && o.deletion_scheduled_at !== undefined;
  const matchesSearch = (o) =>
    o.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.org_code.toLowerCase().includes(searchQuery.toLowerCase());

  const activeOrgs = organizations.filter(o => o.status !== 'pending_approval' && !isPendingDeletion(o) && matchesSearch(o));
  const approvalOrgs = organizations.filter(o => o.status === 'pending_approval' && !isPendingDeletion(o) && matchesSearch(o));
  const pendingOrgs = organizations.filter(o => isPendingDeletion(o) && matchesSearch(o));
  const displayedOrgs = listTab === 'active' ? activeOrgs : listTab === 'approval' ? approvalOrgs : pendingOrgs;

  return (
    <MobileDashboardLayout title="Organizations">
      <div className="space-y-4 pb-24">
        
        {/* Sticky Search & Tabs Header */}
        <div className="sticky top-16 -mx-4 px-4 py-3 bg-slate-50 dark:bg-black z-20 transition-all duration-300">
          <div className="space-y-3">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm text-sm text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Tabs */}
            <div className="bg-[#f6f8fa] dark:bg-github-dark-subtle p-1.5 flex rounded-2xl border border-slate-200 dark:border-github-dark-border shadow-sm">
              <button
                type="button"
                onClick={() => setListTab('active')}
                className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  listTab === 'active'
                    ? 'bg-white dark:bg-[#21262d] text-indigo-600 dark:text-indigo-400 transform scale-[1.02] shadow-sm border border-slate-200 dark:border-github-dark-border'
                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-[#21262d]/50'
                }`}
              >
                <span>Active</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  listTab === 'active'
                    ? 'bg-indigo-50 text-indigo-605 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-[#21262d] dark:border-github-dark-border border'
                }`}>{activeOrgs.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setListTab('approval')}
                className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  listTab === 'approval'
                    ? 'bg-white dark:bg-[#21262d] text-violet-600 dark:text-violet-400 transform scale-[1.02] shadow-sm border border-slate-200 dark:border-github-dark-border'
                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-[#21262d]/50'
                }`}
              >
                <span>Approval</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  listTab === 'approval'
                    ? 'bg-violet-50 text-violet-605 dark:bg-violet-900/40 dark:text-violet-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-[#21262d] dark:border-github-dark-border border'
                }`}>{approvalOrgs.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setListTab('deleted')}
                className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  listTab === 'deleted'
                    ? 'bg-white dark:bg-[#21262d] text-amber-600 dark:text-amber-400 transform scale-[1.02] shadow-sm border border-slate-200 dark:border-github-dark-border'
                    : 'text-slate-500 dark:text-github-dark-muted hover:bg-slate-100 dark:hover:bg-[#21262d]/50'
                }`}
              >
                <span>Deleted</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  listTab === 'deleted'
                    ? 'bg-amber-50 text-amber-605 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-[#21262d] dark:border-github-dark-border border'
                }`}>{pendingOrgs.length}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Organizations List */}
        <div className="relative min-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-400 animate-pulse">Fetching organizations...</p>
            </div>
          ) : displayedOrgs.length > 0 ? (
            <div className="grid gap-3 pb-10">
              {displayedOrgs.map((org) => (
                <div
                  key={org.org_id}
                  onClick={() => setSelectedOrg(org)}
                  className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm active:scale-[0.98] transition-all flex items-center justify-between relative overflow-hidden group"
                >
                  <div className="absolute -right-4 -top-4 w-12 h-12 bg-indigo-500/5 blur-2xl rounded-full" />
                  
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/10">
                      <Building size={18} />
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-github-dark-text text-[13px] truncate">{org.org_name}</h4>
                      <p className="text-[10px] text-slate-450 dark:text-github-dark-muted font-mono tracking-widest mt-0.5">CODE: {org.org_code}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1">
                          <Shield size={10} /> {org.subscription_plan}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    org.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    org.status === 'pending_approval' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>{org.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-github-dark-subtle rounded-[2rem] flex items-center justify-center mb-5 border border-slate-200/50 dark:border-white/5">
                <Building size={28} className="text-slate-300 dark:text-github-dark-muted" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white mb-1">No organizations found</h3>
              <p className="text-xs text-slate-500 dark:text-github-dark-muted">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] shadow-2xl shadow-indigo-500/40 flex items-center justify-center active:scale-90 active:rotate-90 transition-all z-30 group"
        >
          <Plus size={28} className="group-hover:scale-110 transition-transform" />
          <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-active:opacity-100 transition-opacity" />
        </button>

        {/* Org details modal */}
        <AnimatePresence>
          {selectedOrg && (
            <OrgDetailModal
              org={selectedOrg}
              listTab={listTab}
              onClose={() => setSelectedOrg(null)}
              onRefresh={fetchOrganizations}
            />
          )}
        </AnimatePresence>

        {/* Add org modal */}
        <AnimatePresence>
          {showAddModal && (
            <AddOrgModal
              onClose={() => setShowAddModal(false)}
              onRefresh={fetchOrganizations}
            />
          )}
        </AnimatePresence>

      </div>
    </MobileDashboardLayout>
  );
};

export default OrganizationListMobile;
