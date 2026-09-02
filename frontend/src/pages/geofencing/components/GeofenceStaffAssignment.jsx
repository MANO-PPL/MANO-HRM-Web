import React from 'react';
import { Users, Check, Plus } from 'lucide-react';

const GeofenceStaffAssignment = ({
  users = [],
  locations = [],
  selectedLocation,
  loadingUsers = false,
  selectedUserId,
  setSelectedUserId,
  avatarTimestamp,
  toggleUserAssignment
}) => {
  return (
    <div data-tour-id="geo-sidebar-users" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/50">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2 text-sm">
            <Users size={16} /> Assigned Staff
          </h3>
        </div>
      </div>
      <div className="p-2 flex-1 overflow-y-auto space-y-4 no-scrollbar">
        {loadingUsers && (
          <p className="text-xs text-slate-400 px-3 py-4 font-normal">Loading users...</p>
        )}

        {!loadingUsers && (() => {
          const selectedLocId = selectedLocation ? Number(selectedLocation.location_id) : null;
          
          const assignedUsers = users.filter(user => 
            selectedLocId != null &&
            Array.isArray(user.work_locations) &&
            user.work_locations.some(wl => wl.location_id === selectedLocId)
          );
          
          const unassignedUsers = users.filter(user => 
            selectedLocId == null ||
            !Array.isArray(user.work_locations) ||
            !user.work_locations.some(wl => wl.location_id === selectedLocId)
          );

          const renderUserCard = (user) => {
            const isAssigned = selectedLocId != null &&
              Array.isArray(user.work_locations) &&
              user.work_locations.some(wl => wl.location_id === selectedLocId);
              
            const assignedLocs = locations.filter(loc =>
              user.work_locations?.some(wl => Number(wl.location_id) === Number(loc.location_id))
            );
            const isSelected = selectedUserId === user.user_id;

            return (
              <div
                key={user.user_id}
                onClick={() => setSelectedUserId(prev => prev === user.user_id ? null : user.user_id)}
                className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/10'
                    : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                    {user.profile_image_url ? (
                      <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.user_name} className="w-full h-full object-cover" />
                    ) : (
                      user.user_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-github-dark-text truncate">{user.user_name}</p>
                    <p className="text-[11px] text-slate-400 truncate font-normal">{user.desg_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                      {assignedLocs.map(loc => (
                        <span key={loc.location_id} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 truncate max-w-[120px]" title={loc.location_name}>
                          {loc.location_name}
                        </span>
                      ))}
                      {assignedLocs.length === 0 && (
                        <span className="text-[9px] text-slate-400 italic font-normal">No locations</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUserAssignment(user.user_id, isAssigned);
                  }}
                  className={`p-1.5 rounded-md transition-all flex-shrink-0 cursor-pointer ${isAssigned
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                  {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                </button>
              </div>
            );
          };

          return (
            <div className="space-y-4">
              {assignedUsers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2">Assigned Staff ({assignedUsers.length})</p>
                  {assignedUsers.map(renderUserCard)}
                </div>
              )}
              {unassignedUsers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2">
                    {assignedUsers.length > 0 ? "Available Staff" : "All Staff"} ({unassignedUsers.length})
                  </p>
                  {unassignedUsers.map(renderUserCard)}
                </div>
              )}
              {assignedUsers.length === 0 && unassignedUsers.length === 0 && (
                <p className="text-xs text-slate-400 px-3 text-center py-4 font-normal">No staff found</p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default GeofenceStaffAssignment;
