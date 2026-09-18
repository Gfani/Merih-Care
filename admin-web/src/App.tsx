import React, { useState } from "react";
import logo from "./assets/logo.png";
import { Avatar, ToastContainer, toast, Skeleton } from "./components/ui";
import { createHashRouter, RouterProvider, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, HeartPulse, ShieldCheck, ClipboardList, Inbox,
  Calendar, CreditCard, AlertTriangle, Star, Activity, Map, BarChart3,
  FileText, Settings as SettingsIcon, Sun, Moon, Menu, Bell, CheckCircle2,
  Radio, X, ExternalLink, RefreshCw, ShieldAlert
} from "lucide-react";
import { api } from "./services/api";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { BackendHealthBanner } from "./components/BackendHealthBanner";
import { LoadingShell } from "./components/LoadingShell";
import { useRealtimeSocket } from "./hooks/useRealtimeSocket";
import { useRouteError } from "react-router-dom";

// Graceful chunk loader with exponential retry backoff for transient network glitches
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  maxRetries = 3
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await factory();
      } catch (error: any) {
        attempts++;
        const message = String(error?.message || "");
        const isChunkNetworkError =
          message.includes("Failed to fetch dynamically imported module") ||
          message.includes("error loading dynamically imported module") ||
          message.includes("Importing a module script failed");

        // If not a chunk network error or exceeded retry attempts, pass error to ErrorBoundary
        if (!isChunkNetworkError || attempts >= maxRetries) {
          throw error;
        }

        // Exponential backoff delay (800ms, 1600ms, 2400ms)
        const delay = attempts * 800;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return factory();
  });
}

// Non-destructive Vite asset loading error observer
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    console.warn("[Vite Preload] Handled chunk preload warning gracefully without disrupting user session.");
  });
}

// Lazy-loaded pages with automatic retry on new deployments
const DashboardSection = lazyWithRetry(() => import("./pages/Dashboard"));
const UsersSection = lazyWithRetry(() => import("./pages/Users"));
const ProvidersSection = lazyWithRetry(() => import("./pages/Providers"));
const VerificationSection = lazyWithRetry(() => import("./pages/Verification"));
const ServicesSection = lazyWithRetry(() => import("./pages/Services"));
const RequestsSection = lazyWithRetry(() => import("./pages/Requests"));
const AppointmentsSection = lazyWithRetry(() => import("./pages/Appointments"));
const PaymentsSection = lazyWithRetry(() => import("./pages/Payments"));
const PayoutsSection = lazyWithRetry(() => import("./pages/Payouts"));
const ComplaintsSection = lazyWithRetry(() => import("./pages/Complaints"));
const ReviewsSection = lazyWithRetry(() => import("./pages/Reviews"));
const EmergencySection = lazyWithRetry(() => import("./pages/Emergency"));
const LiveMapSection = lazyWithRetry(() => import("./pages/LiveMap"));
const ReportsSection = lazyWithRetry(() => import("./pages/Reports"));
const AuditLogsSection = lazyWithRetry(() => import("./pages/AuditLogs"));
const SettingsSection = lazyWithRetry(() => import("./pages/Settings"));
const AdministratorsSection = lazyWithRetry(() => import("./pages/Administrators"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const SignUp = lazyWithRetry(() => import("./pages/SignUp"));

const getNavigationSections = (badges: { verification: number; complaints: number; payouts: number; requests: number; admins?: number }) => [
  {
    title: "Overview",
    items: [
      { id: "dashboard", path: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
      { id: "live-map", path: "/live-map", label: "Live Map", icon: <Map size={16} /> },
      { id: "reports", path: "/reports", label: "Reports", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "People",
    items: [
      { id: "users", path: "/users", label: "Users", icon: <Users size={16} /> },
      { id: "providers", path: "/providers", label: "Providers", icon: <HeartPulse size={16} /> },
      { id: "verification", path: "/verification", label: "Verification", icon: <ShieldCheck size={16} />, badge: badges.verification || undefined },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "requests", path: "/requests", label: "Service Requests", icon: <Inbox size={16} />, badge: badges.requests || undefined },
      { id: "appointments", path: "/appointments", label: "Appointments", icon: <Calendar size={16} /> },
      { id: "services", path: "/services", label: "Services", icon: <ClipboardList size={16} /> },
      { id: "emergency", path: "/emergency", label: "Emergency", icon: <Activity size={16} /> },
    ],
  },
  {
    title: "Finance",
    items: [
      { id: "payments", path: "/payments", label: "Payments", icon: <CreditCard size={16} /> },
      { id: "payouts", path: "/payouts", label: "Payouts", icon: <CreditCard size={16} />, badge: badges.payouts || undefined },
    ],
  },
  {
    title: "Safety & Quality",
    items: [
      { id: "complaints", path: "/complaints", label: "Complaints", icon: <AlertTriangle size={16} />, badge: badges.complaints || undefined },
      { id: "reviews", path: "/reviews", label: "Reviews", icon: <Star size={16} /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "administrators", path: "/administrators", label: "Administrators", icon: <ShieldAlert size={16} />, badge: badges.admins || undefined },
      { id: "audit-logs", path: "/audit-logs", label: "Audit Logs", icon: <FileText size={16} /> },
      { id: "settings", path: "/settings", label: "Settings", icon: <SettingsIcon size={16} /> },
    ],
  },
];

function RouteErrorBoundary() {
  const error: any = useRouteError();
  const isChunkError =
    error?.message?.includes("Failed to fetch dynamically imported module") ||
    error?.message?.includes("error loading dynamically imported module") ||
    error?.name === "TypeError";

  React.useEffect(() => {
    if (isChunkError) {
      const key = "merihcare_router_retry";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - Number(last) > 8000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }, [isChunkError]);

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex items-center justify-center p-6">
      <div className="bg-white rounded-[16px] border border-[#e2e8ee] p-8 max-w-lg w-full text-center shadow-lg">
        <div className="w-14 h-14 bg-[#0d7c6a]/10 text-[#0d7c6a] rounded-full flex items-center justify-center mx-auto mb-4">
          <RefreshCw size={28} className="animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-[#18232e] mb-2">New Release Active</h1>
        <p className="text-sm text-[#4a5a6a] mb-6">
          A new platform release has been deployed. Refreshing to load latest components...
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#0d7c6a] text-white rounded-lg text-sm font-semibold hover:bg-[#0a6355]"
        >
          Reload Dashboard
        </button>
      </div>
    </div>
  );
}

const router = createHashRouter([
  {
    path: "*",
    element: <AppContent />,
    errorElement: <RouteErrorBoundary />,
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
  const [badgeCounts, setBadgeCounts] = useState({ verification: 0, complaints: 0, payouts: 0, requests: 0, admins: 0 });

  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const count = await api.getUnreadCount();
      setUnreadCount(count);
      const list = await api.getNotifications(1, 20);
      const notifs = Array.isArray(list) ? list : (list as any)?.notifications || [];
      setNotifications(notifs);
    } catch {
      // Ignored in background
    }
  };

  const loadBadgeCounts = async () => {
    if (!isAuthenticated) return;
    try {
      const [verifs, comps, pays, reqs, pendingAdmins, notifs] = await Promise.all([
        api.getVerificationQueue().catch(() => []),
        api.getComplaints().catch(() => []),
        api.getPayouts().catch(() => []),
        api.getAppointments().catch(() => []),
        api.getPendingAdmins().catch(() => []),
        api.getNotifications(1, 20).catch(() => []),
      ]);

      const pendingVerifItems = (verifs || []).filter(
        (v: any) =>
          !v.verified ||
          v.status === "pending_verification" ||
          v.status === "pending" ||
          v.status === "needs_fix"
      );

      const notifList = Array.isArray(notifs) ? notifs : (notifs as any)?.notifications || [];
      const unreadVerifNotifs = notifList.filter(
        (n: any) =>
          !n.read &&
          (n.type === "verification_update" ||
            n.type === "verification" ||
            n.type === "approval_requested" ||
            n.title?.toLowerCase().includes("verification") ||
            n.message?.toLowerCase().includes("verification") ||
            n.body?.toLowerCase().includes("verification"))
      );

      const lastReadAt = localStorage.getItem("merihcare_verifications_read_at");
      let pendingVerifs = 0;
      if (unreadVerifNotifs.length > 0) {
        pendingVerifs = unreadVerifNotifs.length;
      } else if (lastReadAt) {
        const lastReadTime = new Date(lastReadAt).getTime();
        pendingVerifs = pendingVerifItems.filter((p: any) => {
          const createdAtTime = p.createdAt ? new Date(p.createdAt).getTime() : 0;
          return createdAtTime > lastReadTime;
        }).length;
      } else {
        pendingVerifs = pendingVerifItems.length;
      }

      const pendingComps = (comps || []).filter((c: any) => c.status === "open" || c.status === "pending").length;
      const pendingPays = (pays || []).filter((p: any) => p.status === "pending").length;
      const reqList = Array.isArray(reqs) ? reqs : (reqs as any)?.data || [];
      const pendingReqs = reqList.filter((r: any) => r.status === "requested" || r.status === "searching" || r.status === "pending").length;
      const pendingAdminCount = Array.isArray(pendingAdmins) ? pendingAdmins.length : 0;
      setBadgeCounts({
        verification: pendingVerifs,
        complaints: pendingComps,
        payouts: pendingPays,
        requests: pendingReqs,
        admins: pendingAdminCount,
      });
    } catch {
      // Ignored in background
    }
  };

  const playNotificationChime = React.useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  }, []);

  const handleRealtimeEvent = React.useCallback((event: string, payload: any) => {
    if (event === "approval_requested") {
      const data = payload?.data || payload;
      const applicantName = data?.name || "Applicant";
      const applicantRole = data?.role === "admin" ? "Administrator" : "Provider";
      toast(`🔔 New ${applicantRole} Application: ${applicantName} is awaiting approval`, "info");
      loadBadgeCounts();
      loadNotifications();
    } else if (event === "user_status_changed" || event === "account_approved") {
      loadBadgeCounts();
      loadNotifications();
    } else if (event === "new_service_request") {
      const data = payload?.data || payload;
      const patientName = data?.patientName || data?.patient?.name || "Patient";
      const serviceType = data?.serviceType || data?.service || "Care Service";
      const location = data?.location ? ` (${data.location})` : "";
      playNotificationChime();
      toast(`🚨 New Patient Service Request: ${serviceType} for ${patientName}${location}`, "info");
      setBadgeCounts((prev) => ({ ...prev, requests: (prev.requests || 0) + 1 }));
      loadBadgeCounts();
      loadNotifications();
    } else if (event === "appointment_status_update") {
      const data = payload?.data || payload;
      if (data?.status === "requested" || data?.status === "searching") {
        playNotificationChime();
        toast(`🚨 New Care Request: ${data.service || "Care Service"} by ${data.patientName || "Patient"}`, "info");
        setBadgeCounts((prev) => ({ ...prev, requests: (prev.requests || 0) + 1 }));
      }
      loadBadgeCounts();
      loadNotifications();
    } else if (event === "notification") {
      const data = payload?.data || payload;
      if (data?.type === "new_service_request" || data?.title?.toLowerCase().includes("request")) {
        playNotificationChime();
        toast(`🚨 ${data?.title || "New Service Request"}: ${data?.body || ""}`, "info");
        setBadgeCounts((prev) => ({ ...prev, requests: (prev.requests || 0) + 1 }));
      }
      loadBadgeCounts();
      loadNotifications();
    }
  }, [playNotificationChime]);

  // Real-time socket health monitor
  const { isLive, connectionState } = useRealtimeSocket({ token, onEvent: handleRealtimeEvent });

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      localStorage.setItem("merihcare_verifications_read_at", new Date().toISOString());
      setBadgeCounts((prev) => ({ ...prev, verification: 0 }));
      toast("All notifications marked read", "success");
    } catch (err: any) {
      toast(err.message || "Failed to mark all read", "error");
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {
        console.error("Failed to mark single notification as read:", e);
      }
    }
    setNotifPopoverOpen(false);
    const isVerif =
      n.type === "verification_update" ||
      n.type === "approval_requested" ||
      n.title?.toLowerCase().includes("verification") ||
      n.message?.toLowerCase().includes("verification");

    if (isVerif) {
      localStorage.setItem("merihcare_verifications_read_at", new Date().toISOString());
      setBadgeCounts((prev) => ({ ...prev, verification: 0 }));
      navigate("/verification");
    } else if (n.type === "new_service_request" || n.title?.toLowerCase().includes("request")) {
      navigate("/requests");
    } else if (n.type === "complaint" || n.title?.toLowerCase().includes("complaint")) {
      navigate("/complaints");
    }
  };

  React.useEffect(() => {
    if (location.pathname === "/verification") {
      localStorage.setItem("merihcare_verifications_read_at", new Date().toISOString());
      setBadgeCounts((prev) => ({ ...prev, verification: 0 }));
    }
  }, [location.pathname]);

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

  const isAuthed = isAuthenticated || !!sessionStorage.getItem("admin_token") || !!localStorage.getItem("admin_token");

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

  const isSuperAdmin =
    user?.adminRole === "super_admin" ||
    user?.role === "super_admin" ||
    (user as any)?.permissions === "all";

  const isAnyAdmin =
    isSuperAdmin ||
    user?.role === "admin" ||
    !!(user as any)?.adminRole ||
    String(user?.role).includes("admin");

  const sectionsToRender = getNavigationSections(badgeCounts);
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
                const hasBadge = Boolean((item as any).badge);
                const badgeCount = (item as any).badge;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors relative group ${
                      active
                        ? "bg-[#0d7c6a] text-white"
                        : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700 hover:text-[#18232e] dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0 relative flex items-center justify-center">
                      {item.icon}
                      {hasBadge && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-600 px-1 text-[8.5px] font-black text-white ring-2 ring-white dark:ring-slate-800 animate-pulse shadow-sm"
                          title={`${badgeCount} new pending item${badgeCount > 1 ? "s" : ""}`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </span>
                    {(mobile || sidebarOpen) && <span className="flex-1 truncate">{item.label}</span>}
                    {(mobile || sidebarOpen) && hasBadge && (
                      <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-600 text-white shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        {badgeCount}
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
        <Link
          to="/administrators"
          title="Open Administrator Management"
          className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
        >
          <Avatar name={user?.name || "Admin"} size="sm" />
          {(mobile || sidebarOpen) && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#18232e] dark:text-white truncate">{user?.name || "Admin"}</p>
              <p className="text-[10px] text-[#0d7c6a] dark:text-emerald-400 font-bold capitalize flex items-center gap-1">
                <ShieldAlert size={10} />
                {isSuperAdmin
                  ? "Super Admin"
                  : (user as any)?.adminRole?.replace(/_/g, " ") || "Administrator"}
              </p>
            </div>
          )}
        </Link>
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
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3 hover:bg-[#f8fafc] dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                              !n.read ? "bg-[#f0fdf4] dark:bg-emerald-950/20 border-l-2 border-[#0d7c6a]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-[#18232e] dark:text-white truncate">{n.title}</p>
                              {!n.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0d7c6a] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#4a5a6a] dark:text-slate-300 mt-0.5 leading-relaxed">{n.message || n.body}</p>
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
                <Route path="/reports" element={<ProtectedRoute><ReportsSection /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UsersSection /></ProtectedRoute>} />
                <Route path="/providers" element={<ProtectedRoute><ProvidersSection /></ProtectedRoute>} />
                <Route path="/verification" element={<ProtectedRoute><VerificationSection /></ProtectedRoute>} />
                <Route path="/requests" element={<ProtectedRoute><RequestsSection /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute><AppointmentsSection /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><ServicesSection /></ProtectedRoute>} />
                <Route path="/emergency" element={<ProtectedRoute><EmergencySection /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsSection /></ProtectedRoute>} />
                <Route path="/payouts" element={<ProtectedRoute><PayoutsSection /></ProtectedRoute>} />
                <Route path="/complaints" element={<ProtectedRoute><ComplaintsSection /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute><ReviewsSection /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute><AuditLogsSection /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsSection /></ProtectedRoute>} />
                <Route path="/administrators" element={<ProtectedRoute><AdministratorsSection /></ProtectedRoute>} />
                <Route path="/admins" element={<ProtectedRoute><AdministratorsSection /></ProtectedRoute>} />
              </Routes>
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
