import React from "react";
import { 
  CheckCircle, AlertCircle, XCircle, Clock, Calendar, RefreshCw, Info, AlertTriangle, ShieldCheck 
} from "lucide-react";

export type StatusType = "pending" | "searching" | "accepted" | "scheduled" | "on_the_way" | "arrived" | "in_progress" | "completed" | "cancelled" | "rejected" | "expired" | "failed" | "disputed" | "verified" | "suspended" | "active" | "open" | "under_review" | "resolved" | "closed" | "needs_fix";

const statusConfig: Record<StatusType, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Pending", bg: "#fef3c7", text: "#92400e", dot: "#d97706" },
  searching: { label: "Searching", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  accepted: { label: "Accepted", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  scheduled: { label: "Scheduled", bg: "#e6f5f2", text: "#0a5c4e", dot: "#0d7c6a" },
  on_the_way: { label: "On the Way", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  arrived: { label: "Arrived", bg: "#ede9fe", text: "#5b21b6", dot: "#7c3aed" },
  in_progress: { label: "In Progress", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  completed: { label: "Completed", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  cancelled: { label: "Cancelled", bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
  rejected: { label: "Rejected", bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  expired: { label: "Expired", bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
  failed: { label: "Failed", bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  disputed: { label: "Disputed", bg: "#fff7ed", text: "#9a3412", dot: "#ea580c" },
  verified: { label: "Verified", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  suspended: { label: "Suspended", bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  active: { label: "Active", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  open: { label: "Open", bg: "#fef3c7", text: "#92400e", dot: "#d97706" },
  under_review: { label: "Under Review", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  resolved: { label: "Resolved", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  closed: { label: "Closed", bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
  needs_fix: { label: "Needs Correction", bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
};

const statusIcons: Record<StatusType, React.ReactNode> = {
  pending: <Clock size={12} aria-hidden="true" />,
  searching: <RefreshCw size={12} aria-hidden="true" className="animate-spin" />,
  accepted: <CheckCircle size={12} aria-hidden="true" />,
  scheduled: <Calendar size={12} aria-hidden="true" />,
  on_the_way: <Clock size={12} aria-hidden="true" />,
  arrived: <Info size={12} aria-hidden="true" />,
  in_progress: <Clock size={12} aria-hidden="true" />,
  completed: <CheckCircle size={12} aria-hidden="true" />,
  cancelled: <XCircle size={12} aria-hidden="true" />,
  rejected: <XCircle size={12} aria-hidden="true" />,
  expired: <XCircle size={12} aria-hidden="true" />,
  failed: <XCircle size={12} aria-hidden="true" />,
  disputed: <AlertTriangle size={12} aria-hidden="true" />,
  verified: <ShieldCheck size={12} aria-hidden="true" />,
  suspended: <AlertTriangle size={12} aria-hidden="true" />,
  active: <CheckCircle size={12} aria-hidden="true" />,
  open: <Info size={12} aria-hidden="true" />,
  under_review: <Clock size={12} aria-hidden="true" />,
  resolved: <CheckCircle size={12} aria-hidden="true" />,
  closed: <XCircle size={12} aria-hidden="true" />,
  needs_fix: <AlertTriangle size={12} aria-hidden="true" />,
};

export function StatusBadge({ status }: { status: StatusType }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  const icon = statusIcons[status] || statusIcons.pending;
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" 
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="shrink-0 flex items-center" style={{ color: cfg.dot }}>{icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── VERIFICATION BADGE ────────────────────────────────────────────────────────
export function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-[#e6f5f2] text-[#0d7c6a] font-semibold rounded-full ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}>
      <svg width={size === "sm" ? 10 : 12} height={size === "sm" ? 10 : 12} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#0d7c6a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Verified
    </span>
  );
}

// ─── PRIORITY BADGE ────────────────────────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = (priority || "low").toLowerCase() as "low" | "medium" | "high" | "urgent";
  const map = {
    low: { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
    medium: { bg: "#fef3c7", text: "#92400e", dot: "#d97706" },
    high: { bg: "#fed7aa", text: "#9a3412", dot: "#ea580c" },
    urgent: { bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  };
  const cfg = map[normalized] || map.low;
  const priorityIcons = {
    low: <Clock size={12} aria-hidden="true" />,
    medium: <Info size={12} aria-hidden="true" />,
    high: <AlertCircle size={12} aria-hidden="true" />,
    urgent: <AlertTriangle size={12} aria-hidden="true" />,
  };
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize" 
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="shrink-0 flex items-center" style={{ color: cfg.dot }}>{priorityIcons[normalized] || priorityIcons.low}</span>
      {priority}
    </span>
  );
}
