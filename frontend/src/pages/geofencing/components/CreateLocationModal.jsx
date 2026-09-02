import React from 'react';
import { Plus, Navigation, MapPin } from 'lucide-react';

const CreateLocationModal = ({
  showCreateModal,
  newGeo,
  setNewGeo,
  useMyLocation,
  resetNewGeo,
  onClose,
  handleCreateGeofence
}) => {
  if (!showCreateModal) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl bg-white/95 dark:bg-github-dark-subtle/95 backdrop-blur-2xl border border-slate-200 dark:border-github-dark-border rounded-3xl p-8 text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Plus size={14} className="text-indigo-500 dark:text-indigo-400" />
          Create New Geofence
        </h3>
        <span className="text-xs text-slate-500 dark:text-github-dark-muted animate-pulse font-normal">Click map to drop pin</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Name */}
        <div>
          <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Location Name</label>
          <input
            type="text"
            value={newGeo.location_name}
            onChange={(e) => setNewGeo({ ...newGeo, location_name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Geofence Name"
          />
        </div>

        {/* Latitude */}
        <div>
          <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Latitude</label>
          <input
            type="text"
            value={newGeo.latitude ?? ''}
            onChange={(e) => setNewGeo({ ...newGeo, latitude: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Latitude"
          />
        </div>

        {/* Longitude */}
        <div>
          <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Longitude</label>
          <input
            type="text"
            value={newGeo.longitude ?? ''}
            onChange={(e) => setNewGeo({ ...newGeo, longitude: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="Longitude"
          />
        </div>

        {/* Radius */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">Radius</label>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{newGeo.radius} m</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={10}
            value={newGeo.radius}
            onChange={(e) => setNewGeo({ ...newGeo, radius: Number(e.target.value) })}
            className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
          />
        </div>
      </div>

      {/* Address preview */}
      {newGeo.address && (
        <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-3 flex items-center gap-1.5 truncate font-normal">
          <MapPin size={12} className="flex-shrink-0" /> {newGeo.address}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-github-dark-border">
        <div className="flex gap-2">
          <button
            onClick={useMyLocation}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors cursor-pointer"
          >
            <Navigation size={12} /> Use my location
          </button>
          <button
            onClick={resetNewGeo}
            className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetNewGeo();
              onClose();
            }}
            className="px-4 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGeofence}
            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
          >
            Create Geofence
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateLocationModal;
