import { useEffect, useState } from "react"; // useState/Effect not strictly needed anymore if only using context, but harmless
import { useAuth } from "./AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen.jsx";

const PublicRoute = ({ children }) => {
  const { user, authChecked } = useAuth();
  const location = useLocation();

  if (!authChecked) {
    return <LoadingScreen message="Initializing MANO..." />;
  }

  // If user is logged in, redirect to dashboard. Otherwise render the public page (Login)
  
  return user ? <Navigate to="/dashboard" replace /> : (children || <Outlet />);
};

export default PublicRoute;

