import React, { useState } from "react";
import logo from "./assets/logo.png";
import { Avatar, ToastContainer, toast, Skeleton } from "./components/ui";
import { createHashRouter, RouterProvider, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, HeartPulse, ShieldCheck, ClipboardList, Inbox,
  Calendar, CreditCard, AlertTriangle, Star, Activity, Map, BarChart3,
  FileText, Settings as SettingsIcon, Sun, Moon, Menu, Bell, CheckCircle2,
  Radio, X, ExternalLink
} from "lucide-react";
import { api } from "./services/api";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { BackendHealthBanner } from "./components/BackendHealthBanner";
import { LoadingShell } from "./components/LoadingShell";
import { useRealtimeSocket } from "./hooks/useRealtimeSocket";

// Lazy-loaded pages
const DashboardSection = React.lazy(() => import("./pages/Dashboard"));
const UsersSection = React.lazy(() => import("./pages/Users"));
const ProvidersSection = React.lazy(() => import("./pages/Providers"));
const VerificationSection = React.lazy(() => import("./pages/Verification"));
const ServicesSection = React.lazy(() => import("./pages/Services"));
const RequestsSection = React.lazy(() => import("./pages/Requests"));
const AppointmentsSection = React.lazy(() => import("./pages/Appointments"));
const PaymentsSection = React.lazy(() => import("./pages/Payments"));
const PayoutsSection = React.lazy(() => import("./pages/Payouts"));
const ComplaintsSection = React.lazy(() => import("./pages/Complaints"));
const ReviewsSection = React.lazy(() => import("./pages/Reviews"));
const EmergencySection = React.lazy(() => import("./pages/Emergency"));
const LiveMapSection = React.lazy(() => import("./pages/LiveMap"));
const ReportsSection = React.lazy(() => import("./pages/Reports"));
const AuditLogsSection = React.lazy(() => import("./pages/AuditLogs"));
const SettingsSection = React.lazy(() => import("./pages/Settings"));
const Login = React.lazy(() => import("./pages/Login"));
const SignUp = React.lazy(() => import("./pages/SignUp"));

const getNavigationSections = (badges: { verification: number; complaints: number; payouts: number }) => [
  {
    title: "Overview",
    allowedRoles: ["super_admin", "admin", "finance_admin", "verifier"],
    items: [
      { id: "dashboard", path: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
      { id: "live-map", path: "/live-map", label: "Live Map", icon: <Map size={16} /> },
      { id: "reports", path: "/reports", label: "Reports", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "People",
    allowedRoles: ["super_admin", "admin", "verifier"],
    items: [
      { id: "users", path: "/users", label: "Users", icon: <Users size={16} /> },
      { id: "providers", path: "/providers", label: "Providers", icon: <HeartPulse size={16} /> },
      { id: "verification", path: "/verification", label: "Verification", icon: <ShieldCheck size={16} />, badge: badges.verification || undefined },
    ],
  },
  {
    title: "Operations",
    allowedRoles: ["super_admin", "admin", "verifier"],
    items: [
      { id: "requests", path: "/requests", label: "Service Requests", icon: <Inbox size={16} /> },
      { id: "appointments", path: "/appointments", label: "Appointments", icon: <Calendar size={16} /> },
      { id: "services", path: "/services", label: "Services", icon: <ClipboardList size={16} /> },
      { id: "emergency", path: "/emergency", label: "Emergency", icon: <Activity size={16} /> },
    ],
  },
  {
    title: "Finance",
    allowedRoles: ["super_admin", "admin", "finance_admin"],
    items: [
      { id: "payments", path: "/payments", label: "Payments", icon: <CreditCard size={16} /> },
      { id: "payouts", path: "/payouts", label: "Payouts", icon: <CreditCard size={16} />, badge: badges.payouts || undefined },
    ],
  },
  {
    title: "Safety & Quality",
    allowedRoles: ["super_admin", "admin"],
    items: [
      { id: "complaints", path: "/complaints", label: "Complaints", icon: <AlertTriangle size={16} />, badge: badges.complaints || undefined },
      { id: "reviews", path: "/reviews", label: "Reviews", icon: <Star size={16} /> },
    ],
  },
  {
    title: "Administration",
    allowedRoles: ["super_admin", "admin"],
    items: [
      { id: "audit-logs", path: "/audit-logs", label: "Audit Logs", icon: <FileText size={16} /> },
      { id: "settings", path: "/settings", label: "Settings", icon: <SettingsIcon size={16} /> },
    ],
  },
];

const router = createHashRouter([
  {
    path: "*",
    element: <AppContent />,
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user, token, isAuthenticated, logout, hasPermission, login } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState({ verification: 0, complaints: 0, payouts: 0 });

  // Real-time socket health monitor
  const { isLive, connectionState } = useRealtimeSocket({ token });

  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const count = await api.getUnreadCount();
      setUnreadCount(count);
      const list = await api.getNotifications(1, 10);
      setNotifications(list);
    } catch {
      // Ignored in background
    }
  };

  const loadBadgeCounts = async () => {
    if (!isAuthenticated) return;
    try {
      const [verifs, comps, pays] = await Promise.all([
        api.getVerificationReviews().catch(() => []),
        api.getComplaints().catch(() => []),
        api.getPayouts().catch(() => []),
      ]);
      const pendingVerifs = (verifs || []).filter((v: any) => v.status === "pending" || v.reviewStatus === "pending").length;
      const pendingComps = (comps || []).filter((c: any) => c.status === "open" || c.status === "pending").length;
      const pendingPays = (pays || []).filter((p: any) => p.status === "pending").length;
      setBadgeCounts({ verification: pendingVerifs, complaints: pendingComps, payouts: pendingPays });
    } catch {
      // Ignored in background
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast("All notifications marked read", "success");
    } catch (err: any) {
      toast(err.message || "Failed to mark all read", "error");
    }
  };

  React.useEffect(() => {
    loadNotifications();
    loadBadgeCounts();
    const timer = setInterval(() => {
      loadNotifications();
      loadBadgeCounts();
    }, 60000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const isAuthed = isAuthenticated || !!localStorage.getItem("admin_token");

  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (isAuthed && isAuthPage) {
      navigate("/", { replace: true });
    }
  }, [isAuthed, isAuthPage, navigate]);

  if (isAuthPage && !isAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        <ToastContainer />
        <React.Suspense fallback={<LoadingShell />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
          </Routes>
        </React.Suspense>
      </div>
    );
  }

  const isSuperAdminEmail =
    user?.email === "fanuelgoitom79@gmail.com" ||
    user?.email === "fani@g.com" ||
    user?.email === "admin@merihcare.et";

  const isAnyAdmin =
    isSuperAdminEmail ||
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    !!(user as any)?.adminRole ||
    String(user?.role).includes("admin");

  const allSections = getNavigationSections(badgeCounts);
  const visibleSections = allSections.filter((sec) => {
    if (isAnyAdmin) return true;
    if (!sec.allowedRoles || sec.allowedRoles.length === 0) return true;
    return hasPermission(sec.allowedRoles as any);
  });
  const sectionsToRender = visibleSections.length > 0 ? visibleSections : allSections;
  const flatItems = sectionsToRender.flatMap((s) => s.items);
  const currentItem = flatItems.find((i) => i.path === location.pathname) || flatItems[0] || { label: "Overview" };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[#e2e8ee] dark:border-slate-700">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src={logo} alt="Merihcare Logo" className="w-8 h-8 rounded-full object-cover shrink-0" />
          {(mobile || sidebarOpen) && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#18232e] dark:text-white leading-tight">MERIHCARE</p>
              <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400 leading-tight">Admin Portal</p>
            </div>
          )}
        </div>
        {!mobile && (
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="w-7 h-7 flex items-center justify-center hover:bg-[#f0f4f7] dark:hover:bg-slate-700 rounded-lg shrink-0 text-[#8a9aaa]"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {sectionsToRender.map((section) => (
          <div key={section.title} className="mb-2">
            {(mobile || sidebarOpen) && (
              <p className="px-4 py-1 text-[10px] font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#0d7c6a] text-white"
                        : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700 hover:text-[#18232e] dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {(mobile || sidebarOpen) && <span className="flex-1 truncate">{item.label}</span>}
                    {(mobile || sidebarOpen) && (item as any).badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[#dc2626] text-white">
                        {(item as any).badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[#e2e8ee] dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <Avatar name={user?.name || "Admin"} size="sm" />
          {(mobile || sidebarOpen) && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#18232e] dark:text-white truncate">{user?.name || "Admin"}</p>
              <p className="text-[10px] text-[#8a9aaa] dark:text-slate-400 capitalize">
                {user?.email === "fanuelgoitom79@gmail.com" || user?.email === "fani@g.com" || user?.adminRole === "super_admin"
                  ? "Super Admin"
                  : (user as any)?.adminRole?.replace(/_/g, " ") || "Administrator"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f9] dark:bg-slate-900 text-[#18232e] dark:text-slate-100 flex flex-col">
      <ToastContainer />
      <BackendHealthBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white dark:bg-slate-800 border-r border-[#e2e8ee] dark:border-slate-700 transition-all duration-200 shrink-0 ${
            sidebarOpen ? "w-56" : "w-16"
          }`}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative w-64 bg-white dark:bg-slate-800 flex flex-col z-10">
              <SidebarContent mobile />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navbar */}
          <header className="h-14 bg-white dark:bg-slate-800 border-b border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-lg hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#4a5a6a]"
              >
                <Menu size={18} />
              </button>
              <h1 className="text-sm font-bold text-[#18232e] dark:text-white">{currentItem.label}</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Real-time Socket Health Indicator */}
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${
                  isLive
                    ? "bg-[#dcfce7] text-[#166534]"
                    : "bg-[#fef3c7] text-[#92400e]"
                }`}
                title={isLive ? "Socket.IO Live Connected" : "Connecting to Socket.IO..."}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLive ? "bg-[#16a34a] animate-pulse" : "bg-[#d97706]"
                  }`}
                />
                <span className="hidden sm:inline">{isLive ? "Live" : "Reconnecting"}</span>
              </div>

              {/* Notifications Center */}
              <div className="relative">
                <button
                  onClick={() => setNotifPopoverOpen((o) => !o)}
                  className="relative p-2 rounded-lg hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300"
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-[#dc2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifPopoverOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-[12px] border border-[#e2e8ee] dark:border-slate-700 shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#18232e] dark:text-white">Notifications</span>
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-semibold text-[#0d7c6a] hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#f1f5f9] dark:divide-slate-700">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#8a9aaa]">No notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3 hover:bg-[#f8fafc] dark:hover:bg-slate-700/50">
                            <p className="text-xs font-bold text-[#18232e] dark:text-white">{n.title}</p>
                            <p className="text-[11px] text-[#4a5a6a] dark:text-slate-300 mt-0.5">{n.message}</p>
                            <span className="text-[9px] text-[#8a9aaa] mt-1 block">{n.createdAt}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode((d) => !d)}
                className="p-2 rounded-lg hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300"
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* Logout button */}
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="text-xs font-semibold text-[#dc2626] hover:underline ml-1"
              >
                Sign out
              </button>
            </div>
          </header>

          {/* Body Routes with Suspense */}
          <main className="flex-1 overflow-y-auto">
            <React.Suspense fallback={<LoadingShell />}>
              <Routes>
                <Route path="/" element={<ProtectedRoute><DashboardSection /></ProtectedRoute>} />
                <Route path="/live-map" element={<ProtectedRoute><LiveMapSection /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance_admin"]}><ReportsSection /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><UsersSection /></ProtectedRoute>} />
                <Route path="/providers" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "verifier"]}><ProvidersSection /></ProtectedRoute>} />
                <Route path="/verification" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "verifier"]}><VerificationSection /></ProtectedRoute>} />
                <Route path="/requests" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><RequestsSection /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><AppointmentsSection /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><ServicesSection /></ProtectedRoute>} />
                <Route path="/emergency" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><EmergencySection /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance_admin"]}><PaymentsSection /></ProtectedRoute>} />
                <Route path="/payouts" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance_admin"]}><PayoutsSection /></ProtectedRoute>} />
                <Route path="/complaints" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><ComplaintsSection /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><ReviewsSection /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><AuditLogsSection /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><SettingsSection /></ProtectedRoute>} />
              </Routes>
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
