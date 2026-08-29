import React from "react";
import { Skeleton } from "./ui";

export function LoadingShell() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-[8px]" />
          <Skeleton className="h-4 w-72 rounded-[6px]" />
        </div>
        <Skeleton className="h-10 w-32 rounded-[10px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-[14px] border border-[#e2e8ee] space-y-3">
            <Skeleton className="h-4 w-24 rounded-[4px]" />
            <Skeleton className="h-8 w-36 rounded-[6px]" />
            <Skeleton className="h-3 w-40 rounded-[4px]" />
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-[14px] border border-[#e2e8ee] space-y-4">
        <Skeleton className="h-6 w-40 rounded-[6px]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center py-2 border-b border-[#f1f5f9] last:border-0">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3 rounded-[4px]" />
              <Skeleton className="h-3 w-1/2 rounded-[4px]" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
