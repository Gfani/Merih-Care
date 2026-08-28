import React from "react";
import { Info, Check, AlertTriangle, X } from "lucide-react";

// ─── SKELETON ──────────────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-[14px] border border-[#e2e8ee] dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ─── EMPTY STATE ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-[#f0f4f7] dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl mb-4 text-[#0d7c6a] dark:text-cyan-400">{icon}</div>
      <h3 className="text-base font-semibold text-[#18232e] dark:text-white mb-1" style={{ fontFamily: "DM Sans, sans-serif" }}>{title}</h3>
      {description && <p className="text-sm text-[#8a9aaa] dark:text-slate-400 max-w-[200px] mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── ALERT ────────────────────────────────────────────────────────────────────
export type AlertVariant = "info" | "success" | "warning" | "error";

const alertIcons: Record<AlertVariant, React.ReactNode> = {
  info: <Info size={12} aria-hidden="true" />,
  success: <Check size={12} aria-hidden="true" />,
  warning: <AlertTriangle size={12} aria-hidden="true" />,
  error: <X size={12} aria-hidden="true" />,
};

const alertConfig: Record<AlertVariant, { bg: string; border: string; text: string }> = {
  info: { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  success: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  warning: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
  error: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
};

export function Alert({ variant = "info", title, children }: { variant?: AlertVariant; title?: string; children: React.ReactNode }) {
  const cfg = alertConfig[variant];
  const icon = alertIcons[variant];
  return (
    <div className="flex gap-3 p-3 rounded-[10px] border text-sm" style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
      <span className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: cfg.text }}>{icon}</span>
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p className="opacity-90">{children}</p>
      </div>
    </div>
  );
}
