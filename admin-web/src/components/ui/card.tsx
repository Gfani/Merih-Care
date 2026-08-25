import React from "react";

export function Card({ children, className = "", onClick, hover }: { children: React.ReactNode; className?: string; onClick?: () => void; hover?: boolean }) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-[14px] border border-[#e2e8ee] dark:border-slate-700 ${hover ? "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
