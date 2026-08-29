import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { WifiOff, RefreshCw } from "lucide-react";

export function BackendHealthBanner() {
  const [isOutage, setIsOutage] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    const res = await api.checkBackendHealth();
    setIsOutage(res.status === "unreachable");
    setChecking(false);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isOutage) return null;

  return (
    <div className="bg-[#fee2e2] border-b border-[#fca5a5] px-4 py-2 text-xs font-semibold text-[#991b1b] flex items-center justify-between z-50">
      <div className="flex items-center gap-2">
        <WifiOff size={14} className="text-[#dc2626]" />
        <span>Backend API Server is unreachable. Displaying cached session state. Live real-time updates may be paused.</span>
      </div>
      <button
        onClick={checkHealth}
        disabled={checking}
        className="inline-flex items-center gap-1 text-[#dc2626] hover:underline cursor-pointer disabled:opacity-50"
      >
        <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
        <span>{checking ? "Checking..." : "Retry Connection"}</span>
      </button>
    </div>
  );
}
