import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, Slide } from "react-toastify";

import ErrorBoundary from "./ErrorBoundary";
import ResponsiveRoute from "./components/ResponsiveRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { TourProvider } from "./context/TourContext";
import ProtectedRoute from "./context/protection";
import PublicRoute from "./context/publicRoute";
import TourOverlay from "./components/tour/TourOverlay.jsx";
import TestRoute from "./context/TestRoute";
import LoadingScreen from "./components/LoadingScreen.jsx";

// Lazy-loaded Public Auth Pages
const Login = lazy(() => import("./pages/user-auth/Login"));
const ForgotPassword = lazy(() => import("./pages/user-auth/ForgotPassword"));
const SuperAdminLogin = lazy(() => import("./pages/user-auth/SuperAdminLogin"));
const Register = lazy(() => import("./pages/user-auth/Register"));
const ChangePassword = lazy(() => import("./pages/user-auth/ChangePassword"));
const WordCaptchaTest = lazy(() => import("./pages/test/WordCaptchaTest"));

// Lazy-loaded Core & Dashboard Pages
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const Attendance = lazy(() => import("./pages/attendance/Attendance"));
const EmployeeList = lazy(() => import("./pages/employees/EmployeeList"));
const EmployeeForm = lazy(() => import("./pages/employees/EmployeeForm"));
const BulkUpload = lazy(() => import("./pages/employees/BulkUpload"));
const AttendanceMonitoring = lazy(() => import("./pages/attendance-monitoring/AttendanceMonitoring"));
const Reports = lazy(() => import("./pages/reports/Reports"));
const HolidayManagement = lazy(() => import("./pages/holidays/HolidayManagement"));
const BulkHolidayImport = lazy(() => import("./pages/holidays/BulkHolidayImport"));
const ShiftManagement = lazy(() => import("./pages/shift-management/ShiftManagement"));
const GeoFencing = lazy(() => import("./pages/geofencing/GeoFencing"));
const PolicyManagement = lazy(() => import("./pages/policies/PolicyManagement"));
const LeaveManagement = lazy(() => import("./pages/leaves/LeaveManagement"));
const Profile = lazy(() => import("./pages/profile/Profile"));
const Subscription = lazy(() => import("./pages/subscription/Subscription"));
const TestAPI = lazy(() => import("./pages/test/TestAPI"));
const VisualScripting = lazy(() => import("./pages/test/VisualScripting"));
const DailyActivity = lazy(() => import("./pages/dar/DailyActivity"));
const DARAdmin = lazy(() => import("./pages/dar/DARAdmin"));
const LeaveApplication = lazy(() => import("./pages/holidays/LeaveApplication"));
const ChatPage = lazy(() => import("./pages/collaboration/ChatPage"));
const LabourManagement = lazy(() => import("./pages/labour/LabourManagement"));
const PayrollDashboard = lazy(() => import("./pages/payroll/PayrollDashboard"));
const SalaryPackages = lazy(() => import("./pages/payroll/SalaryPackages"));
const Documentation = lazy(() => import("./pages/documentation/Documentation"));
const Payroll = lazy(() => import("./pages/payroll/Payroll"));
const SuperAdminDashboard = lazy(() => import("./pages/dashboard/SuperAdminDashboard"));
const EmployeeDashboard = lazy(() => import("./pages/dashboard/EmployeeDashboard"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

// Lazy-loaded Super Admin & Org Pages
const OrganizationList = lazy(() => import("./pages/organizations/OrganizationList"));
const SecurityAlerts = lazy(() => import("./pages/super-admin/SecurityAlerts"));
const UserFeedback = lazy(() => import("./pages/super-admin/UserFeedback"));
const PM2LogsConsole = lazy(() => import("./pages/super-admin/PM2LogsConsole"));
const APIAnalytics = lazy(() => import("./pages/super-admin/APIAnalytics"));
const DebugConsole = lazy(() => import("./pages/super-admin/DebugConsole"));
const SessionManagement = lazy(() => import("./pages/super-admin/SessionManagement"));

// Lazy-loaded Mobile View Pages
const MobileLogin = lazy(() => import("./pages/user-auth/Login-mv"));
const MobileForgotPassword = lazy(() => import("./pages/user-auth/ForgotPassword-mv"));
const SuperAdminLoginMobile = lazy(() => import("./pages/user-auth/SuperAdminLogin-mv"));
const MobileRegister = lazy(() => import("./pages/user-auth/Register-mv"));
const MobileAdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard-mv"));
const MobileEmployeeDashboard = lazy(() => import("./pages/dashboard/EmployeeDashboard-mv"));
const MobileAttendance = lazy(() => import("./pages/attendance/MobileAttendancePage"));
const MobileEmployeeList = lazy(() => import("./pages/employees/EmployeeList-mv"));
const MobileEmployeeForm = lazy(() => import("./pages/employees/EmployeeForm-mv"));
const MobileHolidayManagement = lazy(() => import("./pages/holidays/HolidayManagement-mv"));
const MobileLeaveApplication = lazy(() => import("./pages/holidays/LeaveApplication-mv"));
const MobileProfile = lazy(() => import("./pages/profile/Profile-mv"));
const MobileAttendanceMonitoring = lazy(() => import("./pages/attendance-monitoring/AttendanceMonitoring-mv"));
const MobileShiftManagement = lazy(() => import("./pages/shift-management/ShiftManagement-mv"));
const MobileGeoFencing = lazy(() => import("./pages/geofencing/GeoFencing-mv"));
const MobilePolicyManagement = lazy(() => import("./pages/policies/PolicyManagement-mv"));
const MobileLeaveManagement = lazy(() => import("./pages/leaves/LeaveManagement-mv"));
const MobileReports = lazy(() => import("./pages/reports/Reports-mv"));
const MobileNotifications = lazy(() => import("./pages/notifications/Notifications-mv"));
const MobileFeedback = lazy(() => import("./pages/feedback/Feedback-mv"));
const DailyActivityMobile = lazy(() => import("./pages/dar/DailyActivity-mv"));
const DARAdminMobile = lazy(() => import("./pages/dar/DARAdmin-mv"));
const MobileBulkHolidayImport = lazy(() => import("./pages/holidays/BulkHolidayImport-mv"));
const MobileBulkUpload = lazy(() => import("./pages/employees/BulkUpload-mv"));
const MobilePayroll = lazy(() => import("./pages/payroll/Payroll-mv"));
const SuperAdminDashboardMobile = lazy(() => import("./pages/dashboard/SuperAdminDashboard-mv"));
const OrganizationListMobile = lazy(() => import("./pages/organizations/OrganizationList-mv"));
const SecurityAlertsMobile = lazy(() => import("./pages/super-admin/SecurityAlerts-mv"));
const UserFeedbackMobile = lazy(() => import("./pages/super-admin/UserFeedback-mv"));
const SessionManagementMobile = lazy(() => import("./pages/super-admin/SessionManagement-mv"));
const MobileChatPage = lazy(() => import("./pages/collaboration/ChatPage-mv"));
const MobileLabourManagement = lazy(() => import("./pages/labour/MobileLabourManagement"));

// Idle prefetch of public auth routes for instantaneous navigation from showcase
if (typeof window !== "undefined") {
  const idlePreload = () => {
    try {
      import("./pages/user-auth/Login");
      import("./pages/user-auth/Register");
      import("./pages/user-auth/Login-mv");
      import("./pages/user-auth/Register-mv");
    } catch {}
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(idlePreload, { timeout: 2500 });
  } else {
    setTimeout(idlePreload, 1500);
  }
}
import ShowcaseNavbar from "./showcase/components/Navbar";
import ShowcaseFooter from "./showcase/components/Footer";
import ShowcaseMobileNavbar from "./showcase/components/MobileNavbar";
import ShowcaseMobileFooter from "./showcase/components/MobileFooter";
import ShowcaseTabletNavbar from "./showcase/components/TabletNavbar";
import ShowcaseTabletFooter from "./showcase/components/TabletFooter";
import ShowcaseHomePage from "./showcase/pages/HomePage";
import ShowcaseMobileHomePage from "./showcase/pages/MobileHomePage";
import ShowcaseTabletHomePage from "./showcase/pages/TabletHomePage";
import WebsiteChatbotWidget from "./showcase/components/WebsiteChatbotWidget";
import useDeviceType from "./showcase/hooks/useDeviceType";
import "./showcase/showcase.css";

const SEO_BASE_URL = "https://attendance.mano.co.in";

function upsertMetaTag(selector, attributes) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

function upsertCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isPublicLanding = path === "/";
    const isLoginPage = path === "/login";
    const isSignupPage = path === "/signup";
    const isForgotPassword = path === "/forgot-password";
    const isChangePassword = path === "/change-password";

    const title = isPublicLanding
      ? "MANO Attendance | Smart Attendance & Workforce Management"
      : isLoginPage
        ? "MANO Attendance Login | Secure Portal Access"
        : isSignupPage
          ? "Self-Onboarding Signup | MANO Attendance"
          : isForgotPassword
            ? "Forgot Password | MANO Attendance"
            : isChangePassword
              ? "Update Password | MANO Attendance"
              : "MANO Attendance";

    const description = isPublicLanding
      ? "MANO Attendance: The ultimate smart attendance and workforce management platform with geofencing, AI insights, and payroll reports."
      : isLoginPage
        ? "Access the MANO Attendance secure login portal. Manage your workforce, track live attendance, and generate reports."
        : isSignupPage
          ? "Register a new organization and administrator account on the MANO Attendance smart workforce platform."
          : isForgotPassword
            ? "Forgot Password | MANO Attendance"
            : isChangePassword
              ? "Update your password on first login to secure your account."
              : "MANO Attendance workforce platform.";

    const canonicalPath = isPublicLanding ? "" : isLoginPage ? "login" : isSignupPage ? "signup" : isForgotPassword ? "forgot-password" : isChangePassword ? "change-password" : "";
    const canonicalUrl = `${SEO_BASE_URL}/${canonicalPath}`;
    const robots = isPublicLanding || isLoginPage || isSignupPage || isForgotPassword ? "index, follow" : "noindex, nofollow";

    document.title = title;
    upsertCanonical(canonicalUrl);

    upsertMetaTag('meta[name="description"]', { name: "description", content: description });
    upsertMetaTag('meta[name="robots"]', { name: "robots", content: robots });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMetaTag('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMetaTag('meta[property="og:image"]', { property: "og:image", content: `${SEO_BASE_URL}/showcase/rag-assistant.png` });
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image", content: `${SEO_BASE_URL}/showcase/rag-assistant.png` });
  }, [location.pathname]);

  return null;
}

// Component to handle role-based dashboard view
const DashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <ResponsiveRoute DesktopComponent={EmployeeDashboard} MobileComponent={MobileEmployeeDashboard} />;
  }
  if (user?.user_type === 'super_admin') {
    return <ResponsiveRoute DesktopComponent={SuperAdminDashboard} MobileComponent={SuperAdminDashboardMobile} />;
  }
  return <ResponsiveRoute DesktopComponent={AdminDashboard} MobileComponent={MobileAdminDashboard} />;
};

function GlobalScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.body.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, search]);

  return null;
}

const ShowcaseShell = ({ children }) => {
  const { device } = useDeviceType();
  const [theme, setTheme] = useState(() => localStorage.getItem("showcase-theme") || "dark");

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("showcase-theme", next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-mode");
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark-mode");
      document.documentElement.classList.remove("light-mode");
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const NavComp = device === "mobile" ? ShowcaseMobileNavbar : device === "tablet" ? ShowcaseTabletNavbar : ShowcaseNavbar;
  const FootComp = device === "mobile" ? ShowcaseMobileFooter : device === "tablet" ? ShowcaseTabletFooter : ShowcaseFooter;

  return (
    <div className={`showcase-root site-bg ${theme}-mode`}>
      <NavComp theme={theme} toggleTheme={toggleTheme} />
      <main>{children}</main>
      <WebsiteChatbotWidget theme={theme} />
      <FootComp theme={theme} />
    </div>
  );
};

const RootHandler = () => {
  const { device } = useDeviceType();
  const PageComp = device === "mobile" ? ShowcaseMobileHomePage : device === "tablet" ? ShowcaseTabletHomePage : ShowcaseHomePage;

  return (
    <ShowcaseShell>
      <PageComp />
    </ShowcaseShell>
  );
};

const ScaleManager = () => {
  const location = useLocation();

  useEffect(() => {
    // Showcase is shown on "/"
    const isShowcase = location.pathname === "/";

    if (isShowcase) {
      document.documentElement.classList.remove("platform-zoomed");
    } else {
      document.documentElement.classList.add("platform-zoomed");
    }
  }, [location.pathname]);

  return null;
};

const MobileDashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <MobileEmployeeDashboard />;
  }
  return <MobileAdminDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <GlobalScrollToTop />
          <SeoManager />
          <ScaleManager />
          <ToastContainer enableMultiContainer containerId="defaultContainer" position="bottom-center" autoClose={3000} limit={1} hideProgressBar={true} pauseOnHover={false} pauseOnFocusLoss={false} closeOnClick={true} />
          <ToastContainer enableMultiContainer containerId="macOSNotifications" position="top-right" autoClose={3000} limit={3} hideProgressBar={true} closeButton={false} newestOnTop={true} transition={Slide} />
          <TourProvider>
            <TourOverlay />
            <Suspense fallback={<LoadingScreen message="Loading..." />}>
              <Routes>

                {/* Website Landing (shown first when not logged in) */}
                <Route path="/" element={<RootHandler />} />
                <Route path="/get-started" element={<Navigate to="/signup" replace />} />

                {/* Public Route: Login & Onboarding */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<ResponsiveRoute DesktopComponent={Login} MobileComponent={MobileLogin} />} />
                  <Route path="/signup" element={<ResponsiveRoute DesktopComponent={Register} MobileComponent={MobileRegister} />} />
                  <Route path="/org-login" element={<ResponsiveRoute DesktopComponent={SuperAdminLogin} MobileComponent={SuperAdminLoginMobile} />} />
                  <Route path="/forgot-password" element={<ResponsiveRoute DesktopComponent={ForgotPassword} MobileComponent={MobileForgotPassword} />} />
                </Route>

                {/* Test Routes - Only available in Development */}
                <Route element={<TestRoute />}>
                  <Route path="/word-captcha-test" element={<WordCaptchaTest />} />
                  <Route path="/test-api" element={<TestAPI />} />
                  <Route path="/visual-scripting" element={<VisualScripting />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route path="/unauthorized" element={<Unauthorized />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  {/* Common Routes (Accessible by all authenticated users: Admin, HR, Employee) */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'employee', 'super_admin']} />}>
                    <Route path="/dashboard" element={<DashboardHandler />} />
                    <Route path="/attendance" element={<ResponsiveRoute DesktopComponent={Attendance} MobileComponent={MobileAttendance} />} />
                    <Route path="/holidays" element={<ResponsiveRoute DesktopComponent={HolidayManagement} MobileComponent={MobileHolidayManagement} />} />
                    <Route path="/profile" element={<ResponsiveRoute DesktopComponent={Profile} MobileComponent={MobileProfile} />} />
                    <Route path="/daily-activity" element={<ResponsiveRoute DesktopComponent={DailyActivity} MobileComponent={DailyActivityMobile} />} />
                    <Route path="/apply-leave" element={<Navigate to="/holidays?tab=leaves&apply=true" replace />} />
                    <Route path="/collaboration" element={<ResponsiveRoute DesktopComponent={ChatPage} MobileComponent={MobileChatPage} />} />
                    <Route path="/documentation" element={<Documentation />} />
                    <Route path="/reports" element={<ResponsiveRoute DesktopComponent={Reports} MobileComponent={MobileReports} />} />

                    {/* Mobile-Only Pages fallback */}
                    <Route path="/notifications" element={<MobileNotifications />} />
                    <Route path="/feedback" element={<MobileFeedback />} />
                  </Route>

                  {/* Admin & HR Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
                    <Route path="/attendance-monitoring" element={<ResponsiveRoute DesktopComponent={AttendanceMonitoring} MobileComponent={MobileAttendanceMonitoring} />} />
                    <Route path="/payroll" element={<ResponsiveRoute DesktopComponent={Payroll} MobileComponent={MobilePayroll} />} />
                    <Route path="/policies" element={<ResponsiveRoute DesktopComponent={PolicyManagement} MobileComponent={MobilePolicyManagement} />} />
                    <Route path="/leave-management" element={<Navigate to="/holidays?tab=leaves" replace />} />
                    <Route path="/shift-management" element={<ResponsiveRoute DesktopComponent={PolicyManagement} MobileComponent={MobilePolicyManagement} />} />
                    <Route path="/geofencing" element={<ResponsiveRoute DesktopComponent={PolicyManagement} MobileComponent={MobilePolicyManagement} />} />
                    <Route path="/employees" element={<ResponsiveRoute DesktopComponent={EmployeeList} MobileComponent={MobileEmployeeList} />} />
                    <Route path="/employees/add" element={<ResponsiveRoute DesktopComponent={EmployeeForm} MobileComponent={MobileEmployeeForm} />} />
                    <Route path="/employees/edit/:id" element={<ResponsiveRoute DesktopComponent={EmployeeForm} MobileComponent={MobileEmployeeForm} />} />
                    <Route path="/employees/bulk" element={<ResponsiveRoute DesktopComponent={BulkUpload} MobileComponent={MobileBulkUpload} />} />
                    <Route path="/holidays/bulk" element={<ResponsiveRoute DesktopComponent={BulkHolidayImport} MobileComponent={MobileBulkHolidayImport} />} />
                    <Route path="/dar-admin" element={<ResponsiveRoute DesktopComponent={DARAdmin} MobileComponent={DARAdminMobile} />} />
                    <Route path="/labour-management" element={<ResponsiveRoute DesktopComponent={LabourManagement} MobileComponent={MobileLabourManagement} />} />
                    <Route path="/payroll-dashboard" element={<ResponsiveRoute DesktopComponent={PayrollDashboard} MobileComponent={MobilePayroll} />} />
                    <Route path="/payroll-packages" element={<Navigate to="/policies?tab=salary_packages" replace />} />
                  </Route>

                  {/* Admin Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="/subscription" element={<Subscription />} />
                  </Route>

                  {/* Super Admin Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                    <Route path="/organizations" element={<ResponsiveRoute DesktopComponent={OrganizationList} MobileComponent={OrganizationListMobile} />} />
                    <Route path="/super-admin/alerts" element={<ResponsiveRoute DesktopComponent={SecurityAlerts} MobileComponent={SecurityAlertsMobile} />} />
                    <Route path="/super-admin/feedback" element={<ResponsiveRoute DesktopComponent={UserFeedback} MobileComponent={UserFeedbackMobile} />} />
                    <Route path="/super-admin/logs" element={<ResponsiveRoute DesktopComponent={PM2LogsConsole} MobileComponent={PM2LogsConsole} />} />
                    <Route path="/super-admin/api-analytics" element={<ResponsiveRoute DesktopComponent={APIAnalytics} MobileComponent={APIAnalytics} />} />
                    <Route path="/super-admin/debug" element={<ResponsiveRoute DesktopComponent={DebugConsole} MobileComponent={DebugConsole} />} />
                    <Route path="/super-admin/sessions" element={<ResponsiveRoute DesktopComponent={SessionManagement} MobileComponent={SessionManagementMobile} />} />
                  </Route>
                </Route>

              </Routes>
            </Suspense>
          </TourProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
