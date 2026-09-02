import React from 'react';
import { Plus, Search, Crosshair, Users } from 'lucide-react';

const GeofenceLocationList = ({
  locations = [],
  selectedLocation,
  setSelectedLocation,
  users = [],
  selectedUserId,
  searchQuery = '',
  setSearchQuery,
  onOpenCreate
}) => {
  const filteredLocations = locations.filter(loc =>
    loc.location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div data-tour-id="geo-sidebar-locations" className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm flex flex-col overflow-hidden">
      {/* Header / Search */}
      <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/50 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 dark:text-github-dark-text text-sm">Locations</h3>
          <button
            onClick={onOpenCreate}
            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
            title="Add Location"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search offices..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-github-dark-text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Locations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
        {filteredLocations.map(loc => {
          const selectedUser = selectedUserId ? users.find(u => u.user_id === selectedUserId) : null;
          const isUserAssignedLocation = selectedUser && selectedUser.work_locations?.some(wl => Number(wl.location_id) === Number(loc.location_id));
          const isSelected = selectedLocation && selectedLocation.location_id === loc.location_id;

          return (
            <div
              key={loc.location_id}
              onClick={() => setSelectedLocation(loc)}
              className={`p-3 rounded-lg border transition-all cursor-pointer group ${loc.is_active === 0
                ? 'opacity-60'
                : ''
                } ${isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                  : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${isUserAssignedLocation
                  ? 'ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5'
                  : ''
                }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col gap-0.5">
                  <h4 className={`font-semibold text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{loc.location_name}</h4>
                  {isUserAssignedLocation && (
                    <span className="text-[9px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full w-max flex items-center gap-0.5 mt-0.5">
                      Assigned
                    </span>
                  )}
                </div>
                {loc.is_active === 1 ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    <span className="text-[10px] text-slate-400 font-normal">Inactive</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-github-dark-muted line-clamp-1 mb-2 font-normal">{loc.address}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-github-dark-muted font-normal">
                <span className="flex items-center gap-1"><Crosshair size={10} /> {loc.radius}m</span>
                <span className="flex items-center gap-1">
                  <Users size={10} />
                  {users.filter(u =>
                    u.work_locations?.some(
                      w => w.location_id === Number(loc.location_id)
                    )
                  ).length} Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeofenceLocationList;
