import api from './api';

// Client-side memory cache for geofencing / user locations
const cache = {
  workLocationUsers: null,
  locations: null
};

// Synchronous client-side cache for direct component consumption
export const userCacheData = {
  workLocationUsers: null,
  locations: null
};

export const clearGeofenceCache = () => {
  cache.workLocationUsers = null;
  cache.locations = null;
  userCacheData.workLocationUsers = null;
  userCacheData.locations = null;
};

/**
 * Get all users eligible for geofence assignment
 */
export const fetchWorkLocationUsers = async () => {
  if (cache.workLocationUsers) {
    return cache.workLocationUsers;
  }

  const promise = (async () => {
    try {
      const res = await api.get('/admin/users?workLocation=true');
      userCacheData.workLocationUsers = res.data;
      return res.data;
    } catch (error) {
      cache.workLocationUsers = null;
      throw new Error(error.response?.data?.message || "Failed to fetch users");
    }
  })();

  cache.workLocationUsers = promise;
  return promise;
};

/* ============================
   LOCATIONS (GEOFENCE)
   ============================ */

/**
 * Get all active work locations
 */
export const fetchLocations = async () => {
  if (cache.locations) {
    return cache.locations;
  }

  const promise = (async () => {
    try {
      const res = await api.get('/locations');
      userCacheData.locations = res.data;
      return res.data;
    } catch (error) {
      cache.locations = null;
      throw new Error(error.response?.data?.message || "Failed to fetch locations");
    }
  })();

  cache.locations = promise;
  return promise;
};

/**
 * Create new geofence location
 */
export const createLocation = async (payload) => {
  try {
    const res = await api.post('/locations', payload);
    clearGeofenceCache();
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create location");
  }
};

/**
 * Update geofence location
 */
export const updateLocation = async (locationId, payload) => {
  try {
    const res = await api.put(`/locations/${locationId}`, payload);
    clearGeofenceCache();
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update location");
  }
};

/**
 * Assign / Remove users from locations (bulk)
 */
export const updateLocationAssignments = async (assignments) => {
  try {
    const res = await api.post('/locations/assignments', { assignments });
    clearGeofenceCache();
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update assignments");
  }
};
