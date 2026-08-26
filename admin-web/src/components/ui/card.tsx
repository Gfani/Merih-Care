import React from "react";

export function Card({ children, className = "", onClick, hover }: { children: React.ReactNode; className?: string; onClick?: () => void; hover?: boolean }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-[14px] border border-[#e2e8ee] dark:border-slate-700 ${hover || onClick ? "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7c6a] dark:focus-visible:ring-cyan-400" : ""} ${className}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
