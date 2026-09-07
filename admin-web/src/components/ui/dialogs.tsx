import React, { useEffect, useRef } from "react";
import { Button, ButtonVariant } from "./button";

// ─── MODAL ─────────────────────────────────────────────────────────────────────
export function Modal({ 
  open, 
  onClose, 
  title, 
  children, 
  footer,
  maxWidth = "sm:max-w-md",
}: { 
  open: boolean; 
  onClose: () => void; 
  title?: string; 
  children: React.ReactNode; 
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      lastActiveElement.current = document.activeElement as HTMLElement;
      
      // Allow slight delay for render transition to focus
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusables = modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
          );
          if (focusables.length > 0) {
            focusables[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "";
      if (lastActiveElement.current) {
        lastActiveElement.current.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white dark:bg-slate-800 rounded-t-[20px] sm:rounded-[16px] w-full ${maxWidth} shadow-xl animate-slide-up focus:outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8ee] dark:border-slate-700">
            <h3 className="text-base font-semibold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>{title}</h3>
            <button 
              type="button" 
              onClick={onClose} 
              aria-label="Close dialog"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f4f7] dark:hover:bg-slate-700 text-[#8a9aaa] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d7c6a]"
            >
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
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    }>
      <p className="text-sm text-[#4a5a6a] dark:text-slate-350">{message}</p>
    </Modal>
  );
}
