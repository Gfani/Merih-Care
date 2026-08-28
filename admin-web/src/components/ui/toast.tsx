import React, { useState, useEffect } from "react";
import { Check, X, Info, AlertTriangle } from "lucide-react";

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

  const icons: Record<ToastType, React.ReactNode> = { 
    success: <Check size={14} aria-hidden="true" />, 
    error: <X size={14} aria-hidden="true" />, 
    info: <Info size={14} aria-hidden="true" />, 
    warning: <AlertTriangle size={14} aria-hidden="true" /> 
  };
  
  const colors: Record<ToastType, string> = { success: "#16a34a", error: "#dc2626", info: "#1b6fba", warning: "#d97706" };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none" aria-live="polite" aria-instant="true">
      {toasts.map(t => (
        <div 
          key={t.id} 
          role={t.type === "error" ? "alert" : "status"}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-[#e2e8ee] rounded-[12px] px-4 py-3 shadow-lg min-w-[260px] animate-fade-in pointer-events-auto"
        >
          <span 
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" 
            style={{ backgroundColor: colors[t.type] }}
          >
            {icons[t.type]}
          </span>
          <span className="text-sm text-[#18232e] dark:text-slate-100 font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
