import React from "react";

export function Avatar({ src, name, size = "md", verified }: { src?: string; name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; verified?: boolean }) {
  const sizes: Record<string, string> = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-12 h-12 text-lg", xl: "w-16 h-16 text-xl" };
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-[#e6f5f2] text-[#0d7c6a] font-semibold flex items-center justify-center`}>{initials}</div>
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0d7c6a] rounded-full flex items-center justify-center">
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      )}
    </div>
  );
}
