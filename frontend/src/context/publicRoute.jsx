import { useAuth } from "./AuthContext";
import { Navigate, Outlet } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen.jsx";

const PublicRoute = ({ children }) => {
  const { user, authChecked } = useAuth();

  // If user is already logged in, redirect immediately to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Only show the loading screen if we are restoring an existing stored session
  const hasStoredSession = typeof window !== 'undefined' && 
    Boolean(localStorage.getItem('accessToken') || localStorage.getItem('mano_auth_user'));

  if (!authChecked && hasStoredSession) {
    return <LoadingScreen message="Initializing MANO..." />;
  }

  // Guest users without stored session render immediately without delay
  return children || <Outlet />;
};

export default PublicRoute;

