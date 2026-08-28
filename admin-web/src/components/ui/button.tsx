import React from "react";

// ─── SPINNER ───────────────────────────────────────────────────────────────────
export function Spinner({ size = "md", color = "#0d7c6a" }: { size?: "sm" | "md" | "lg"; color?: string }) {
  const s = size === "sm" ? 14 : size === "md" ? 20 : 28;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── BUTTON ────────────────────────────────────────────────────────────────────
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[#0d7c6a] text-white hover:bg-[#0a5c4e] active:bg-[#094d42] shadow-sm",
  secondary: "bg-[#1b6fba] text-white hover:bg-[#155a96] active:bg-[#114b80] shadow-sm",
  outline: "border border-[#0d7c6a] text-[#0d7c6a] dark:text-cyan-400 dark:border-cyan-400 hover:bg-[#e6f5f2] dark:hover:bg-cyan-500/10 active:bg-[#ccede7] dark:active:bg-cyan-500/20",
  ghost: "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700 active:bg-[#e2e8ee] dark:active:bg-slate-600/50",
  danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b] shadow-sm",
  success: "bg-[#16a34a] text-white hover:bg-[#15803d] active:bg-[#166534] shadow-sm",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm rounded-[8px] min-h-[40px] min-w-[40px] md:min-h-[34px]",
  md: "px-4 py-2.5 text-sm rounded-[10px] min-h-[44px] min-w-[44px] md:min-h-[40px]",
  lg: "px-6 py-3 text-base rounded-[10px] min-h-[48px] min-w-[48px]",
};

export function Button({ variant = "primary", size = "md", loading, icon, fullWidth, children, className = "", disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7c6a] dark:focus-visible:ring-cyan-400 focus-visible:ring-offset-2 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading ? <Spinner size="sm" color={variant === "outline" || variant === "ghost" ? "#0d7c6a" : "white"} /> : icon}
      {children}
    </button>
  );
}
