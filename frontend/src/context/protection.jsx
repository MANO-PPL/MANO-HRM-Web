import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, authChecked } = useAuth();
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    if (authChecked) {
      if (!user) {
        toast.warn("Please login first to access this page!", {
          toastId: "login-required",
        });
        setShowRedirect(true);
        return;
      }

      // Check user roles 
      const hasPermission = allowedRoles.length === 0 || (user?.user_type && allowedRoles.includes(user.user_type));

      if (!hasPermission) {
        console.warn('Access Denied: User role not in allowed roles', {
          userRole: user?.user_type,
          allowed: allowedRoles
        });
        toast.error(`Access Denied. Role: ${user?.user_type}`);
        setShowRedirect(true);
      }
    }
  }, [user, authChecked, allowedRoles]);

  if (!authChecked) {
    return <LoadingScreen message="Verifying session security..." />;
  }

  if (showRedirect) {
    if (user) {
      return <Navigate to="/unauthorized" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return user ? (children || <Outlet />) : null;

};

export default ProtectedRoute;
