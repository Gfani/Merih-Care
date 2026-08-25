import React, { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem { id: string; message: string; type: ToastType; }

let toastCallback: ((item: ToastItem) => void) | null = null;

export function toast(message: string, type: ToastType = "info") {
  if (toastCallback) toastCallback({ id: Date.now().toString(), message, type });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastCallback = (item) => {
      setToasts(prev => [...prev, item]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== item.id)), 3500);
    };
    return () => { toastCallback = null; };
  }, []);

  const icons: Record<ToastType, string> = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  const colors: Record<ToastType, string> = { success: "#16a34a", error: "#dc2626", info: "#1b6fba", warning: "#d97706" };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-[#e2e8ee] rounded-[12px] px-4 py-3 shadow-lg min-w-[260px] animate-fade-in pointer-events-auto">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: colors[t.type] }}>{icons[t.type]}</span>
          <span className="text-sm text-[#18232e] font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
