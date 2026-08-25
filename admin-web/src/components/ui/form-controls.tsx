import React from "react";

// ─── INPUT ─────────────────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ label, error, hint, leftIcon, rightIcon, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-[#18232e] dark:text-white">{label}</label>}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9aaa]">{leftIcon}</span>}
        <input
          className={`w-full bg-white dark:bg-slate-800 border rounded-[10px] px-3 py-2.5 text-sm text-[#18232e] dark:text-slate-100 placeholder:text-[#8a9aaa] transition-colors ${leftIcon ? "pl-9" : ""} ${rightIcon ? "pr-9" : ""} ${error ? "border-[#dc2626] focus:border-[#dc2626]" : "border-[#e2e8ee] dark:border-slate-700 hover:border-[#cdd6df] dark:hover:border-slate-600 focus:border-[#0d7c6a] dark:focus:border-cyan-400"} ${className}`}
          {...props}
        />
        {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a9aaa]">{rightIcon}</span>}
      </div>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#8a9aaa]">{hint}</p>}
    </div>
  );
}

// ─── TEXTAREA ──────────────────────────────────────────────────────────────────
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-[#18232e] dark:text-white">{label}</label>}
      <textarea
        className={`w-full bg-white dark:bg-slate-800 border rounded-[10px] px-3 py-2.5 text-sm text-[#18232e] dark:text-slate-100 placeholder:text-[#8a9aaa] resize-none transition-colors min-h-[80px] ${error ? "border-[#dc2626]" : "border-[#e2e8ee] dark:border-slate-700 hover:border-[#cdd6df] dark:hover:border-slate-600 focus:border-[#0d7c6a] dark:focus:border-cyan-400"} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
    </div>
  );
}

// ─── SELECT ────────────────────────────────────────────────────────────────────
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = "", ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-[#18232e] dark:text-white">{label}</label>}
      <select
        className={`w-full bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[10px] px-3 py-2.5 text-sm text-[#18232e] dark:text-slate-100 hover:border-[#cdd6df] dark:hover:border-slate-600 focus:border-[#0d7c6a] dark:focus:border-cyan-400 cursor-pointer ${className}`}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── TOGGLE ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#0d7c6a]" : "bg-[#cdd6df]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
      {label && <span className="text-sm text-[#18232e] dark:text-slate-200">{label}</span>}
    </label>
  );
}
