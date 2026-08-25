import React from "react";

export function Rating({ value, count, showCount = true }: { value: number; count?: number; showCount?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#d97706"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      <span className="text-sm font-semibold text-[#18232e]">{value.toFixed(1)}</span>
      {showCount && count !== undefined && <span className="text-xs text-[#8a9aaa]">({count})</span>}
    </span>
  );
}
