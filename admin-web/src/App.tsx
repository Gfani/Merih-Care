import React, { useState } from "react";
import logo from "./assets/logo.png";
import { Avatar, ToastContainer, toast, SkeletonCard, Skeleton } from "./components/ui";
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, HeartPulse, ShieldCheck, ClipboardList, Inbox,
  Calendar, CreditCard, AlertTriangle, Star, Activity, Map, BarChart3,
  FileText, Settings as SettingsIcon, Sun, Moon, Menu
} from "lucide-react";

// Route-level lazy loading
const DashboardSection = React.lazy(() => import("./pages/Dashboard"));
const UsersSection = React.lazy(() => import("./pages/Users"));
const ProvidersSection = React.lazy(() => import("./pages/Providers"));
const VerificationSection = React.lazy(() => import("./pages/Verification"));
const ServicesSection = React.lazy(() => import("./pages/Services"));
const RequestsSection = React.lazy(() => import("./pages/Requests"));
const AppointmentsSection = React.lazy(() => import("./pages/Appointments"));
const PaymentsSection = React.lazy(() => import("./pages/Payments"));
const ComplaintsSection = React.lazy(() => import("./pages/Complaints"));
const ReviewsSection = React.lazy(() => import("./pages/Reviews"));
const EmergencySection = React.lazy(() => import("./pages/Emergency"));
const LiveMapSection = React.lazy(() => import("./pages/LiveMap"));
const ReportsSection = React.lazy(() => import("./pages/Reports"));
const AuditLogsSection = React.lazy(() => import("./pages/AuditLogs"));
const SettingsSection = React.lazy(() => import("./pages/Settings"));
const Login = React.lazy(() => import("./pages/Login"));
const SignUp = React.lazy(() => import("./pages/SignUp"));

const NAVIGATION_SECTIONS: {
  title: string;
  items: { id: string; path: string; label: string; icon: React.ReactNode; badge?: number }[];
}[] = [
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
      { id: "verification", path: "/verification", label: "Verification", icon: <ShieldCheck size={16} />, badge: 2 },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "requests", path: "/requests", label: "Service Requests", icon: <Inbox size={16} /> },
      { id: "appointments", path: "/appointments", label: "Appointments", icon: <Calendar size={16} /> },
      { id: "services", path: "/services", label: "Services", icon: <ClipboardList size={16} /> },
      { id: "emergency", path: "/emergency", label: "Emergency", icon: <Activity size={16} /> },
    ],
  },
  {
    title: "Finance",
    items: [
      { id: "payments", path: "/payments", label: "Payments", icon: <CreditCard size={16} /> },
    ],
  },
  {
    title: "Safety & Quality",
    items: [
      { id: "complaints", path: "/complaints", label: "Complaints", icon: <AlertTriangle size={16} />, badge: 4 },
      { id: "reviews", path: "/reviews", label: "Reviews", icon: <Star size={16} /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "audit-logs", path: "/audit-logs", label: "Audit Logs", icon: <FileText size={16} /> },
      { id: "settings", path: "/settings", label: "Settings", icon: <SettingsIcon size={16} /> },
    ],
  },
];

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("admin_token"));
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  const [demoMode, setDemoModeState] = useState(() => {
    const stored = localStorage.getItem("demo_mode");
    return stored === null ? true : stored === "true";
  });

  const toggleDemoMode = () => {
    const newVal = !demoMode;
    setDemoModeState(newVal);
    localStorage.setItem("demo_mode", newVal ? "true" : "false");
    toast(`Demo Mode ${newVal ? "Enabled (Using Mock Data)" : "Disabled (Connecting to Backend API)"}`, "info");
    window.location.reload();
  };

  React.useEffect(() => {
    const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
    if (!isLoggedIn && !isAuthPage) {
      navigate("/login");
    } else if (isLoggedIn && isAuthPage) {
      navigate("/");
    }
  }, [location.pathname, navigate, isLoggedIn]);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut listener - moved above early returns to fix Hook Violation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        const searchInput = document.querySelector(`main input[type="text"]`) as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        <ToastContainer />
        <React.Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
            <Route path="/signup" element={<SignUp />} />
          </Routes>
        </React.Suspense>
      </div>
    );
  }

  const flatItems = NAVIGATION_SECTIONS.flatMap(s => s.items);
  const currentItem = flatItems.find(i => i.path === location.pathname) || flatItems[0];
  const currentLabel = currentItem.label;

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo header */}
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
        {/* Desktop collapse toggle */}
        {!mobile && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-7 h-7 flex items-center justify-center hover:bg-[#f0f4f7] dark:hover:bg-slate-700 rounded-lg shrink-0 text-[#8a9aaa]"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu size={16} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {NAVIGATION_SECTIONS.map(section => (
          <div key={section.title} className="mb-4">
            {(mobile || sidebarOpen) && (
              <p className="px-4 py-1.5 text-[10px] font-bold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    title={item.label}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors relative ${
                      isActive
                        ? "bg-[#e6f5f2] dark:bg-slate-700 text-[#0d7c6a] dark:text-cyan-400 font-semibold"
                        : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f4f7f9] dark:hover:bg-slate-700 font-medium"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#0d7c6a] dark:bg-cyan-400" />}
                    <span className="shrink-0">{item.icon}</span>
                    {(mobile || sidebarOpen) && (
                      <>
                        <span className="flex-1 text-left truncate text-xs">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="w-5 h-5 bg-[#dc2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#e2e8ee] dark:border-slate-700 text-center text-[10px] text-[#8a9aaa] dark:text-slate-400">
        {(mobile || sidebarOpen) && <p>© 2026 Merihcare. All rights reserved.</p>}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f9] dark:bg-slate-900 flex flex-col text-[#18232e] dark:text-slate-100 transition-colors duration-200">
      <ToastContainer />

      {/* Demo mode warning banner */}
      {demoMode && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-inner shrink-0 z-50">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-ping" />
            Sandbox Sandbox — Viewing simulated offline mock data.
          </span>
          <button
            onClick={toggleDemoMode}
            className="bg-white/20 hover:bg-white/35 transition-colors px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer"
          >
            Switch to Live API
          </button>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        {/* ── MOBILE: Overlay backdrop ── */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ── MOBILE: Slide-in sidebar drawer ── */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-white dark:bg-slate-800 border-r border-[#e2e8ee] dark:border-slate-700 transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent mobile={true} />
        </aside>

        {/* ── DESKTOP: Persistent collapsible sidebar ── */}
        <aside
          className={`hidden lg:flex fixed top-0 bottom-0 left-0 z-30 flex-col bg-white dark:bg-slate-800 border-r border-[#e2e8ee] dark:border-slate-700 transition-all duration-200 ${
            sidebarOpen ? "w-56" : "w-16"
          }`}
        >
          <SidebarContent mobile={false} />
        </aside>

        {/* ── Main Content Area ── */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-200 ${sidebarOpen ? "lg:pl-56" : "lg:pl-16"}`}>

          {/* Top bar */}
          <header className="bg-white dark:bg-slate-800 border-b border-[#e2e8ee] dark:border-slate-700 px-4 md:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 transition-colors">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileSidebarOpen(o => !o)}
                className="lg:hidden w-8 h-8 flex items-center justify-center hover:bg-[#f0f4f7] dark:hover:bg-slate-700 rounded-lg text-[#4a5a6a] dark:text-slate-300"
                aria-label="Open sidebar"
              >
                <Menu size={18} />
              </button>
              <h1 className="text-sm md:text-base font-bold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
                {currentLabel}
              </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Dynamic local date */}
              <span className="hidden md:block text-xs text-[#8a9aaa] dark:text-slate-400">
                {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>

              {/* Demo Mode state indicator */}
              <button
                onClick={toggleDemoMode}
                className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all border shrink-0 ${
                  demoMode
                    ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                    : "bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
                }`}
                title={demoMode ? "Currently running on simulated mock data. Click to connect to actual API." : "Currently running on real API. Click to run in sandbox simulation mode."}
                aria-label={demoMode ? "Disable demo mode" : "Enable demo mode"}
              >
                {demoMode ? "Sandbox" : "Live API"}
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(d => !d)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 transition-colors"
                aria-label="Toggle Dark Mode"
                title="Toggle Dark Mode"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Notifications */}
              <button
                className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f4f7] dark:hover:bg-slate-700"
                title="View Notifications"
                aria-label="View notifications"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[#4a5a6a] dark:text-slate-300" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#dc2626] rounded-full" />
              </button>

              {/* Admin profile */}
              <div className="flex items-center gap-2 border-l border-[#e2e8ee] dark:border-slate-700 pl-2 md:pl-3">
                <Avatar name="Admin Kebede" size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[#18232e] dark:text-white leading-none">Admin Kebede</p>
                  <button
                    onClick={() => {
                      localStorage.removeItem("admin_token");
                      setIsLoggedIn(false);
                      toast("Logged out successfully", "info");
                      navigate("/login");
                    }}
                    className="text-[10px] text-red-500 hover:text-red-700 hover:underline leading-none block text-left mt-1"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f4f7f9] dark:bg-slate-900 transition-colors">
            <React.Suspense fallback={
              <div className="p-6 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            }>
              <Routes>
                <Route path="/" element={<DashboardSection />} />
                <Route path="/users" element={<UsersSection />} />
                <Route path="/providers" element={<ProvidersSection onVerification={() => navigate("/verification")} />} />
                <Route path="/verification" element={<VerificationSection />} />
                <Route path="/services" element={<ServicesSection />} />
                <Route path="/requests" element={<RequestsSection />} />
                <Route path="/appointments" element={<AppointmentsSection />} />
                <Route path="/payments" element={<PaymentsSection />} />
                <Route path="/complaints" element={<ComplaintsSection />} />
                <Route path="/reviews" element={<ReviewsSection />} />
                <Route path="/emergency" element={<EmergencySection />} />
                <Route path="/live-map" element={<LiveMapSection />} />
                <Route path="/reports" element={<ReportsSection />} />
                <Route path="/audit-logs" element={<AuditLogsSection />} />
                <Route path="/settings" element={<SettingsSection />} />
                <Route path="*" element={<DashboardSection />} />
              </Routes>
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

