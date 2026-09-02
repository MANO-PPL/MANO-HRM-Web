import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Layers, ChevronDown, Check, MapPin, Crosshair, Edit2, Navigation } from 'lucide-react';
import CreateLocationModal from './CreateLocationModal';

const MapRecenter = ({ location }) => {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    const currentCenter = map.getCenter();
    const targetLatLng = L.latLng(lat, lng);

    const distance = currentCenter.distanceTo(targetLatLng);

    if (distance > 5) {
      map.flyTo(targetLatLng, 16, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [location, map]);

  return null;
};

const GeofenceMapArea = ({
  locations = [],
  selectedLocation,
  setSelectedLocation,
  users = [],
  selectedUserId,
  showCreateModal,
  newGeo,
  setNewGeo,
  onCloseCreate,
  handleCreateGeofence,
  useMyLocation,
  resetNewGeo,
  isEditingLocation,
  editDraftCoords,
  setEditDraftCoords,
  startEditing,
  useMyLocationForEdit,
  handleCancelEdit,
  handleSaveEditedLocation,
  toggleLocationStatus,
  radiusDraft,
  activeTheme,
  setActiveTheme,
  isThemeMenuOpen,
  setIsThemeMenuOpen,
  MAP_THEMES,
  createMarkerIcon,
  reverseGeocode
}) => {
  // Map click handler for create mode
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setNewGeo((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        if (reverseGeocode) {
          reverseGeocode(lat, lng).then((address) => {
            setNewGeo((prev) => ({
              ...prev,
              address,
            }));
          });
        }
      },
    });
    return null;
  };

  // Map click handler for edit mode
  const EditMapClickHandler = () => {
    useMapEvents({
      click(e) {
        if (!isEditingLocation || !editDraftCoords) return;
        const { lat, lng } = e.latlng;
        setEditDraftCoords(prev => ({ ...prev, latitude: lat, longitude: lng, address: '...' }));
        if (reverseGeocode) {
          reverseGeocode(lat, lng).then((address) => {
            setEditDraftCoords(prev => prev ? { ...prev, address } : null);
          });
        }
      },
    });
    return null;
  };

  return (
    <div data-tour-id="geo-map" className="flex-1 relative bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
      {(selectedLocation || showCreateModal || locations.length > 0) && (
        <MapContainer
          center={
            showCreateModal && newGeo.latitude && newGeo.longitude
              ? [newGeo.latitude, newGeo.longitude]
              : selectedLocation
                ? [Number(selectedLocation.latitude), Number(selectedLocation.longitude)]
                : locations.length > 0
                  ? [Number(locations[0].latitude), Number(locations[0].longitude)]
                  : [20, 78]
          }
          zoom={15}
          className="h-full w-full"
          attributionControl={false}
        >
          <TileLayer url={MAP_THEMES[activeTheme].url} />
          
          {/* Theme switcher */}
          <div className="absolute top-4 right-4 z-[1001]">
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex items-center gap-2 bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-github-dark-border hover:border-indigo-500/50 transition-all group cursor-pointer"
              >
                <Layers size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{MAP_THEMES[activeTheme].name}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-20">
                    <div className="py-1">
                      {Object.entries(MAP_THEMES).map(([id, theme]) => (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveTheme(id);
                            setIsThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors cursor-pointer ${activeTheme === id
                            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-normal'
                            }`}
                        >
                          <span>{theme.name}</span>
                          {activeTheme === id && <Check size={14} className="text-indigo-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {isEditingLocation && <EditMapClickHandler />}
          {showCreateModal && <MapClickHandler />}
          {!isEditingLocation && !showCreateModal && selectedLocation && <MapRecenter location={selectedLocation} />}

          {/* Create Mode Marker */}
          {showCreateModal && newGeo.latitude && newGeo.longitude && (
            <>
              <Marker 
                position={[newGeo.latitude, newGeo.longitude]} 
                icon={createMarkerIcon("#6366f1")}
              />
              <Circle
                center={[newGeo.latitude, newGeo.longitude]}
                radius={newGeo.radius}
                pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.25 }}
              />
            </>
          )}

          {/* Edit Mode Marker */}
          {isEditingLocation && editDraftCoords && editDraftCoords.latitude && editDraftCoords.longitude && (
            <>
              <Marker 
                position={[editDraftCoords.latitude, editDraftCoords.longitude]} 
                icon={createMarkerIcon("#6366f1")}
              />
              <Circle
                center={[editDraftCoords.latitude, editDraftCoords.longitude]}
                radius={editDraftCoords.radius}
                pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.25 }}
              />
            </>
          )}

          {/* Existing Locations Markers */}
          {!isEditingLocation && !showCreateModal && locations.map(loc => {
            const isCurrentSelected = selectedLocation && selectedLocation.location_id === loc.location_id;
            const selectedUser = selectedUserId ? users.find(u => u.user_id === selectedUserId) : null;
            const isUserAssigned = selectedUser && selectedUser.work_locations?.some(wl => Number(wl.location_id) === Number(loc.location_id));

            let markerColor = "#94a3b8";
            if (isCurrentSelected) {
              markerColor = "#6366f1";
            } else if (isUserAssigned) {
              markerColor = "#10b981";
            } else if (loc.is_active === 1) {
              markerColor = "#3b82f6";
            }

            return (
              <React.Fragment key={loc.location_id}>
                <Marker
                  position={[Number(loc.latitude), Number(loc.longitude)]}
                  icon={createMarkerIcon(markerColor)}
                  eventHandlers={{
                    click: () => {
                      if (!isEditingLocation && !showCreateModal) {
                        setSelectedLocation(loc);
                      }
                    }
                  }}
                />
                {isCurrentSelected && (
                  <Circle
                    center={[Number(loc.latitude), Number(loc.longitude)]}
                    radius={loc.radius}
                    pathOptions={{
                      color: "#6366f1",
                      fillColor: "#6366f1",
                      fillOpacity: 0.2,
                    }}
                  />
                )}
                {isUserAssigned && !isCurrentSelected && (
                  <Circle
                    center={[Number(loc.latitude), Number(loc.longitude)]}
                    radius={loc.radius}
                    pathOptions={{
                      color: "#10b981",
                      fillColor: "#10b981",
                      fillOpacity: 0.15,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      )}

      {/* Selected Location Details pill */}
      {selectedLocation && !isEditingLocation && !showCreateModal && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl bg-white/95 dark:bg-github-dark-subtle/90 backdrop-blur-xl border border-white/20 dark:border-github-dark-border/50 rounded-3xl p-8 flex flex-col md:flex-row gap-10 items-center justify-between text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_25px_70px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.6)] transition-all duration-300">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-base font-semibold truncate">{selectedLocation.location_name}</h2>
              <button
                onClick={toggleLocationStatus}
                className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${selectedLocation.is_active === 1 ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selectedLocation.is_active === 1 ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1.5 truncate font-normal">
              <MapPin size={14} className="flex-shrink-0" />
              {selectedLocation.address}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-normal">
              <Crosshair size={14} className="text-indigo-500 dark:text-indigo-400" />
              <span className="text-slate-600 dark:text-slate-300">Radius</span>
              <span className="font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-github-dark-text px-2 py-0.5 rounded text-xs">
                {radiusDraft} m
              </span>
            </div>
            <button
              onClick={startEditing}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Edit location"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode: Expanded Form */}
      {selectedLocation && isEditingLocation && editDraftCoords && !showCreateModal && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl bg-white/95 dark:bg-github-dark-subtle/95 backdrop-blur-2xl border border-slate-200 dark:border-github-dark-border rounded-3xl p-8 text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Edit2 size={14} className="text-indigo-500 dark:text-indigo-400" />
              Edit Geofence
            </h3>
            <span className="text-xs text-slate-500 dark:text-github-dark-muted animate-pulse font-normal">Click map to relocate pin</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Location Name</label>
              <input
                type="text"
                value={editDraftCoords.location_name}
                onChange={(e) => setEditDraftCoords(prev => ({ ...prev, location_name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Geofence Name"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Latitude</label>
              <input
                type="text"
                value={editDraftCoords.latitude ?? ''}
                onChange={(e) => setEditDraftCoords(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Latitude"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block font-normal">Longitude</label>
              <input
                type="text"
                value={editDraftCoords.longitude ?? ''}
                onChange={(e) => setEditDraftCoords(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-xs font-normal text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Longitude"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-500 dark:text-github-dark-muted font-normal">Radius</label>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{editDraftCoords.radius} m</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={editDraftCoords.radius}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditDraftCoords(prev => ({ ...prev, radius: val }));
                }}
                className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              />
            </div>
          </div>

          {editDraftCoords.address && (
            <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-3 flex items-center gap-1.5 truncate font-normal">
              <MapPin size={12} className="flex-shrink-0" /> {editDraftCoords.address}
            </p>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-github-dark-border">
            <button
              onClick={useMyLocationForEdit}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors cursor-pointer"
            >
              <Navigation size={12} /> Use my location
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedLocation}
                className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Location Modal */}
      <CreateLocationModal
        showCreateModal={showCreateModal}
        newGeo={newGeo}
        setNewGeo={setNewGeo}
        useMyLocation={useMyLocation}
        resetNewGeo={resetNewGeo}
        onClose={onCloseCreate}
        handleCreateGeofence={handleCreateGeofence}
      />
    </div>
  );
};

export default GeofenceMapArea;
