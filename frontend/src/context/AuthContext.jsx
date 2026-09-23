import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken, clearApiCache } from "../services/api";

const AuthContext = createContext({
  user: null,
  setUser: () => {},
  login: async () => {},
  superAdminLogin: async () => {},
  logout: async () => {},
  authChecked: false,
  fetchUser: async () => {},
  avatarTimestamp: Date.now()
});

// Helper: ensure pages_tour_seen is always a plain object, not a JSON string
const normalizeUser = (userData) => {
  if (!userData) return userData;
  let pagesSeen = userData.pages_tour_seen || {};
  if (typeof pagesSeen === 'string') {
    try { pagesSeen = JSON.parse(pagesSeen); } catch { pagesSeen = {}; }
  }
  return {
    ...userData,
    user_type: userData.user_type?.toLowerCase(),
    pages_tour_seen: pagesSeen,
  };
};

const AUTH_USER_KEY = 'mano_auth_user';

const getInitialUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_USER_KEY);
    if (cached) return JSON.parse(cached);
    const token = localStorage.getItem('accessToken');
    if (token) {
      return { id: 'cached_session', user_type: 'admin', is_authenticated: true };
    }
  } catch {}
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);
  const [authChecked, setAuthChecked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!(localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem('accessToken'));
  });
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());

  // Helper to persist user cache
  const updateUserData = (userData) => {
    if (userData) {
      const normalizedUser = normalizeUser(userData);
      setUser(normalizedUser);
      setAvatarTimestamp(Date.now());
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
      } catch {}
      return normalizedUser;
    } else {
      setUser(null);
      try {
        localStorage.removeItem(AUTH_USER_KEY);
      } catch {}
      return null;
    }
  };

  // Move fetchUser definition OUTSIDE useEffect
  const fetchUser = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data) {
        updateUserData(res.data);
      } else {
        updateUserData(null);
      }
    } catch {
      updateUserData(null);
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      try {
        if (token) {
          // Token exists: verify / refresh user state directly
          try {
            const userRes = await api.get("/auth/me");
            if (userRes.data && isMounted) {
              updateUserData(userRes.data);
              setAuthChecked(true);
              return;
            }
          } catch (meError) {
            // If /auth/me fails (e.g. 401), fall through to /auth/refresh
          }
        }

        // Explicitly try to refresh token on mount
        const res = await api.post("/auth/refresh");
        if (res.data?.accessToken && isMounted) {
          setAccessToken(res.data.accessToken);
          const userRes = await api.get("/auth/me");
          if (userRes.data && isMounted) {
            updateUserData(userRes.data);
          }
        } else if (!token && isMounted) {
          updateUserData(null);
        }
      } catch (error) {
        if (isMounted) {
          if (error.response?.status === 401 || error.response?.status === 403 || !token) {
            updateUserData(null);
            setAccessToken(null);
          }
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };

    initAuth();
    return () => { isMounted = false; };
  }, []);

  const login = async (email, password, captchaToken, rememberMe = false) => {
    // Construct request body for v2 recaptcha only
    const loginData = {
      user_input: email,
      user_password: password,
      rememberMe,
      captchaToken, // Backend checks for this key for v2 verification
    };

    // Clear cache on login
    clearApiCache();

    // Axios throws on 4xx/5xx, so we just await the call
    const res = await api.post("/auth/login", loginData);

    if (res.data.accessToken) {
      setAccessToken(res.data.accessToken);
    }

    if (res.data.user) {
      const normalizedUser = updateUserData(res.data.user);
      res.data.user = normalizedUser;
    } else {
      await fetchUser();
    }

    return res.data; // Return data for redirect logic in Login.jsx
  };

  const superAdminLogin = async (email, password) => {
    const loginData = { email, password };
    clearApiCache();
    const res = await api.post("/auth/super-admin/login", loginData);
    if (res.data.accessToken) setAccessToken(res.data.accessToken);
    if (res.data.user) {
      const normalizedUser = updateUserData(res.data.user);
      res.data.user = normalizedUser;
    } else {
      await fetchUser();
    }
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout API failed:", error);
    } finally {
      // Preserve theme preferences
      const theme = localStorage.getItem("theme");
      const showcaseTheme = localStorage.getItem("showcase-theme");

      // Clear browser storages
      localStorage.clear();
      sessionStorage.clear();
      clearApiCache();
      updateUserData(null);
      setAccessToken(null);

      // Restore theme preferences
      if (theme) localStorage.setItem("theme", theme);
      if (showcaseTheme) localStorage.setItem("showcase-theme", showcaseTheme);

      // Clear cookies (excluding HTTP-only cookies which standard JS cannot delete)
      if (typeof document !== 'undefined') {
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
        });
      }

      // Clear Cache Storage API if available
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map(key => window.caches.delete(key)));
        } catch (err) {
          console.error("Failed to clear Cache Storage API:", err);
        }
      }

      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, superAdminLogin, logout, authChecked, fetchUser, avatarTimestamp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
