import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

import {
  fetchLocations,
  fetchWorkLocationUsers,
  createLocation,
  updateLocationAssignments,
  updateLocation
} from "../../services/userService";
import DashboardLayout from '../../components/DashboardLayout';
import GeofenceLocationList from './components/GeofenceLocationList';
import GeofenceMapArea from './components/GeofenceMapArea';
import GeofenceStaffAssignment from './components/GeofenceStaffAssignment';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const PAGE_KEY = 'admin_geofencing';
const TOUR_STEPS = [
    {
        targetId: 'geo-map',
        title: 'Geofence Map',
        description: 'Visualize all your office locations and their allowed punch-in radiuses on the live map.',
    },
    {
        targetId: 'geo-sidebar-locations',
        title: 'Locations List',
        description: 'Create and edit geofenced locations, adjust coordinates, and set the allowed punch-in radius. Note: A radius that is too small (e.g., < 50m) can block clock-ins due to indoor GPS drift/fluctuation, causing false attendance failures. Conversely, a radius that is too large (e.g., > 200m) compromises geofence security by allowing employees to clock in from nearby roads or cafes. A balanced range of 80m - 150m is recommended.',
    },
    {
        targetId: 'geo-sidebar-users',
        title: 'Assign Staff',
        description: 'Select a location to see which employees are allowed to clock in from there, and manage their assignments.',
    },
];

const createMarkerIcon = (color) => {
  return L.divIcon({
    html: `<span style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28" stroke="#ffffff" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </span>`,
    className: 'custom-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

const GeoFencing = ({ embedded = false }) => {
  const navigate = useNavigate();

  // Redirect to mobile view if on mobile

  // --- STATE ---
  const { avatarTimestamp } = useAuth();
  const { startTour, hasSeenPage, wasSkippedThisSession, tourEnabled } = useTour();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [radiusDraft, setRadiusDraft] = useState(100);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit location mode
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editDraftCoords, setEditDraftCoords] = useState(null);

  // Debounce state for radius save
  const [radiusSaveTimer, setRadiusSaveTimer] = useState(null);

  const [newGeo, setNewGeo] = useState({
    location_name: "",
    address: "",
    latitude: null,
    longitude: null,
    radius: 100,
  });

  const [activeTheme, setActiveTheme] = useState('voyager');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // --- THEME SYNC ---
  useEffect(() => {
    // Initial sync
    const isDark = document.documentElement.classList.contains('dark');
    setActiveTheme(isDark ? 'dark' : 'voyager');

    // Observe changes to the 'dark' class on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const darkActive = document.documentElement.classList.contains('dark');
          setActiveTheme(darkActive ? 'dark' : 'voyager');
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const MAP_THEMES = {
    dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
    light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
  };

  const [mapPickEnabled, setMapPickEnabled] = useState(true);
  // Reverse geocoding helper
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      return data.display_name || "";
    } catch (err) {
      console.error("Reverse geocoding failed", err);
      return "";
    }
  }

  const handleCreateGeofence = async () => {
    if (!newGeo.location_name || !newGeo.latitude || !newGeo.longitude || !newGeo.address) {
      alert("Name and location are required");
      return;
    }

    try {
      await createLocation({
        location_name: newGeo.location_name,
        address: newGeo.address,
        latitude: newGeo.latitude,
        longitude: newGeo.longitude,
        radius: newGeo.radius,
      });

      setShowCreateModal(false);
      setNewGeo({
        location_name: "",
        address: "",
        latitude: null,
        longitude: null,
        radius: 100,
      });

      // refresh locations
      const data = await fetchLocations();
      if (data.ok) {
        setLocations(data.locations);
        setSelectedLocation(data.locations[0]);
      }
    } catch (err) {
      alert("Failed to create geofence");
      console.error(err);
    }
  };

  // Use my location (GPS) handler
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // IMMEDIATE update → marker shows instantly
        setNewGeo((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        // fetch address async (non-blocking)
        const address = await reverseGeocode(lat, lng);
        setNewGeo((prev) => ({
          ...prev,
          address,
        }));
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true }
    );
  };

  // Reset handler
  const resetNewGeo = () => {
    setNewGeo({
      location_name: "",
      address: "",
      latitude: null,
      longitude: null,
      radius: 100,
    });
  };



  // Start editing - initialize draft from selected location
  const startEditing = () => {
    if (!selectedLocation) return;
    setEditDraftCoords({
      location_name: selectedLocation.location_name,
      latitude: Number(selectedLocation.latitude),
      longitude: Number(selectedLocation.longitude),
      address: selectedLocation.address,
      radius: selectedLocation.radius,
    });
    setIsEditingLocation(true);
  };

  // Use my location in edit mode
  const useMyLocationForEdit = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditDraftCoords(prev => prev ? { ...prev, latitude: lat, longitude: lng } : null);
        const address = await reverseGeocode(lat, lng);
        setEditDraftCoords(prev => prev ? { ...prev, address } : null);
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true }
    );
  };

  // Save all edited fields
  const handleSaveEditedLocation = async () => {
    if (!selectedLocation || !editDraftCoords) return;
    if (!editDraftCoords.location_name || !editDraftCoords.latitude || !editDraftCoords.longitude) {
      alert('Name and location are required');
      return;
    }
    try {
      await updateLocation(selectedLocation.location_id, {
        location_name: editDraftCoords.location_name,
        latitude: editDraftCoords.latitude,
        longitude: editDraftCoords.longitude,
        address: editDraftCoords.address,
        radius: editDraftCoords.radius,
      });
      const updated = { ...selectedLocation, ...editDraftCoords };
      setSelectedLocation(updated);
      setLocations(prev => prev.map(loc =>
        loc.location_id === selectedLocation.location_id ? updated : loc
      ));
      setRadiusDraft(editDraftCoords.radius);
      setIsEditingLocation(false);
      setEditDraftCoords(null);
    } catch (err) {
      console.error('Failed to update location', err);
      alert('Failed to save location. Please retry.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingLocation(false);
    setEditDraftCoords(null);
  };



  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoadingLocations(true);
        const data = await fetchLocations();
        if (data.ok && data.locations.length > 0) {
          setLocations(data.locations);
          setSelectedLocation(data.locations[0]);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      } finally {
        setLoadingLocations(false);
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      setRadiusDraft(selectedLocation.radius);
    }
  }, [selectedLocation]);

  // Cleanup effect for radiusSaveTimer
  useEffect(() => {
    return () => {
      if (radiusSaveTimer) {
        clearTimeout(radiusSaveTimer);
      }
    };
  }, [radiusSaveTimer]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const data = await fetchWorkLocationUsers();



        if (data?.success) {
          setUsers(
            data.users.map(u => ({
              ...u,
              work_locations: (u.work_locations || [])
                .map(wl => {
                  // ACTUAL backend shape uses loc_id
                  if (wl.loc_id != null) {
                    return { location_id: Number(wl.loc_id) };
                  }

                  // fallback safety (older shapes)
                  if (typeof wl === "number") {
                    return { location_id: wl };
                  }

                  const id = wl.location_id ?? wl.work_location_id;
                  return id != null ? { location_id: Number(id) } : null;
                })
                .filter(Boolean),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);


  const handleRadiusChange = (newRadius) => {
    setRadiusDraft(newRadius);

    if (!selectedLocation) return;

    // optimistic UI update
    setSelectedLocation(prev => ({
      ...prev,
      radius: newRadius,
    }));

    setLocations(prev =>
      prev.map(loc =>
        loc.location_id === selectedLocation.location_id
          ? { ...loc, radius: newRadius }
          : loc
      )
    );

    // debounce API call
    if (radiusSaveTimer) {
      clearTimeout(radiusSaveTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await updateLocation(selectedLocation.location_id, {
          radius: newRadius,
        });
      } catch (err) {
        console.error("Failed to persist radius", err);
        alert("Failed to save radius");

        // rollback on failure
        const data = await fetchLocations();
        if (data?.ok) {
          setLocations(data.locations);
          setSelectedLocation(
            data.locations.find(
              l => l.location_id === selectedLocation.location_id
            ) || data.locations[0]
          );
        }
      }
    }, 500); // 500ms debounce

    setRadiusSaveTimer(timer);
  };

  const toggleLocationStatus = async () => {
    if (!selectedLocation) return;

    const updatedStatus = selectedLocation.is_active === 1 ? 0 : 1;

    // optimistic UI
    setSelectedLocation(prev => ({
      ...prev,
      is_active: updatedStatus,
    }));

    setLocations(prev =>
      prev.map(loc =>
        loc.location_id === selectedLocation.location_id
          ? { ...loc, is_active: updatedStatus }
          : loc
      )
    );

    try {
      await updateLocation(selectedLocation.location_id, {
        is_active: updatedStatus,
      });
    } catch (err) {
      console.error("Failed to update is_active", err);
      alert("Failed to update geofence status");

      // rollback on failure
      const data = await fetchLocations();
      if (data?.ok) {
        setLocations(data.locations);
        setSelectedLocation(
          data.locations.find(
            l => l.location_id === selectedLocation.location_id
          ) || data.locations[0]
        );
      }
    }
  };

  // A user can have MULTIPLE work locations.
  // Assignments are additive, not exclusive.
  // Disabling a location does NOT delete assignments.
  const toggleUserAssignment = async (userId, isAssigned) => {
    if (!selectedLocation) return;

    const payload = [
      {
        work_location_id: selectedLocation.location_id,
        add: isAssigned ? [] : [userId],
        remove: isAssigned ? [userId] : [],
      },
    ];

    const employee = users.find(u => u.user_id === userId);
    const empName = employee ? employee.user_name : "Employee";

    try {
      // optimistic UI update
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? {
              ...u,
              work_locations: isAssigned
                ? u.work_locations.filter(
                  (w) => w.location_id !== selectedLocation.location_id
                )
                : [
                  ...(u.work_locations || []),
                  { location_id: Number(selectedLocation.location_id) },
                ],
            }
            : u
        )
      );

      await updateLocationAssignments(payload);
      if (isAssigned) {
        toast.success(`${empName} removed from ${selectedLocation.location_name}`);
      } else {
        toast.success(`${empName} assigned to ${selectedLocation.location_name}`);
      }
    } catch (err) {
      console.error("Assignment update failed", err);
      toast.error("Failed to update assignment. Please retry.");

      // rollback on failure
      const data = await fetchWorkLocationUsers();
      if (data?.success) {
        setUsers(data.users);
      }
    }
  };

  if (loadingLocations) {
    return (
      <DashboardLayout title="Geo-Fencing">
        <div className="p-6 text-slate-500">Loading locations...</div>
      </DashboardLayout>
    );
  }

  const content = (
    <div className={`flex ${embedded ? 'h-full p-0' : 'h-[calc(100vh-64px)] p-3'} w-full overflow-hidden gap-3 bg-slate-50 dark:bg-dark-bg`}>
      {/* Left Panel: Locations List */}
      <GeofenceLocationList
        locations={locations}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        users={users}
        selectedUserId={selectedUserId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCreate={() => {
          setIsEditingLocation(false);
          setEditDraftCoords(null);
          setShowCreateModal(true);
        }}
      />

      {/* Center Panel: Map Area */}
      <GeofenceMapArea
        locations={locations}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        users={users}
        selectedUserId={selectedUserId}
        showCreateModal={showCreateModal}
        newGeo={newGeo}
        setNewGeo={setNewGeo}
        onCloseCreate={() => {
          resetNewGeo();
          setShowCreateModal(false);
        }}
        handleCreateGeofence={handleCreateGeofence}
        useMyLocation={useMyLocation}
        resetNewGeo={resetNewGeo}
        isEditingLocation={isEditingLocation}
        editDraftCoords={editDraftCoords}
        setEditDraftCoords={setEditDraftCoords}
        startEditing={startEditing}
        useMyLocationForEdit={useMyLocationForEdit}
        handleCancelEdit={handleCancelEdit}
        handleSaveEditedLocation={handleSaveEditedLocation}
        toggleLocationStatus={toggleLocationStatus}
        radiusDraft={radiusDraft}
        activeTheme={activeTheme}
        setActiveTheme={setActiveTheme}
        isThemeMenuOpen={isThemeMenuOpen}
        setIsThemeMenuOpen={setIsThemeMenuOpen}
        MAP_THEMES={MAP_THEMES}
        createMarkerIcon={createMarkerIcon}
        reverseGeocode={reverseGeocode}
      />

      {/* Right Panel: Employee Assignment */}
      <GeofenceStaffAssignment
        users={users}
        locations={locations}
        selectedLocation={selectedLocation}
        loadingUsers={loadingUsers}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        avatarTimestamp={avatarTimestamp}
        toggleUserAssignment={toggleUserAssignment}
      />
    </div>
  );

  if (embedded) return content;
  return (
    <DashboardLayout title="Geo-Fencing" noPadding={true} tourPageKey={PAGE_KEY} tourSteps={TOUR_STEPS}>
      {content}
    </DashboardLayout>
  );
};

export default GeoFencing;
