import React, { useEffect } from "react";
import { Button, ButtonVariant } from "./button";

// ─── MODAL ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-[20px] sm:rounded-[16px] w-full sm:max-w-md shadow-xl animate-slide-up">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8ee] dark:border-slate-700">
            <h3 className="text-base font-semibold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>{title}</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#8a9aaa] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[#e2e8ee] dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

// ─── CONFIRMATION DIALOG ──────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", confirmVariant = "primary", loading }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    }>
      <p className="text-sm text-[#4a5a6a] dark:text-slate-300">{message}</p>
    </Modal>
  );
}
