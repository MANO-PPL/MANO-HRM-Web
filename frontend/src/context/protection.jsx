import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { AlertTriangle, LogOut } from "lucide-react";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, authChecked, logout } = useAuth();
  const location = useLocation();
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

  // Enforce password change before any other route is rendered
  if (user && user.force_password_change && location.pathname.toLowerCase() !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Enforce subscription expiry or pending approval page for organization admins
  if (user && user.user_type === "admin" && (user.org_status === "pending_approval" || user.isOrgExpired || user.org_status !== "active")) {
    const isPendingApproval = user.org_status === "pending_approval";
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700/60 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className={`w-16 h-16 ${isPendingApproval ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} rounded-full flex items-center justify-center mx-auto border`}>
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              {isPendingApproval ? "Approval Pending" : "Subscription Expired"}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {isPendingApproval 
                ? "Your organization registration is currently pending approval by the Super Admin. You will receive access once the registration is approved."
                : "Your organization's subscription has expired and access has been suspended. Please contact the system administrator team to renew your subscription."
              }
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/30 text-left space-y-3">
            <span className="text-indigo-400 font-semibold text-[10px] uppercase tracking-wider block">Super Admin Contact</span>
            <p className="text-xs text-slate-400">Email: <span className="font-mono text-slate-300">support@mano.com</span></p>
            <p className="text-xs text-slate-400">Phone: <span className="font-mono text-slate-300">+91 98765 43210</span></p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full bg-indigo-600 hover:bg-indigo-750 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-[0.25em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </div>
    );
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
