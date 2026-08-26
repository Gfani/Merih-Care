import React, { useState } from "react";
import { Card } from "../components/ui";

/** Mock pin data — replace with real WS data (provider_location_updated events) */
export const MAP_PINS = [
  // Providers (online/active)
  { id: "p1", type: "provider" as const, name: "Dr. Meron Alemu", role: "Doctor", status: "active", lat: 38, lng: 32, color: "#0d7c6a", initials: "MA" },
  { id: "p2", type: "provider" as const, name: "Hiwot Girma", role: "Nurse", status: "on_the_way", lat: 62, lng: 48, color: "#0d7c6a", initials: "HG" },
  { id: "p3", type: "provider" as const, name: "Yohannes Tadesse", role: "Physiotherapist", status: "in_progress", lat: 48, lng: 68, color: "#0d7c6a", initials: "YT" },
  { id: "p4", type: "provider" as const, name: "Selam Bekele", role: "Nurse", status: "active", lat: 75, lng: 28, color: "#0d7c6a", initials: "SB" },
  { id: "p5", type: "provider" as const, name: "Abebe Fekadu", role: "Elderly Care", status: "offline", lat: 22, lng: 72, color: "#94a3b8", initials: "AF" },
  // Patients with active requests
  { id: "c1", type: "patient" as const, name: "Tigist Bekele", role: "Patient", status: "searching", lat: 40, lng: 30, color: "#1b6fba", initials: "TB" },
  { id: "c2", type: "patient" as const, name: "Dawit Haile", role: "Patient", status: "in_progress", lat: 50, lng: 65, color: "#1b6fba", initials: "DH" },
  { id: "c3", type: "patient" as const, name: "Marta Kebede", role: "Patient", status: "waiting", lat: 64, lng: 45, color: "#1b6fba", initials: "MK" },
];

export const STATUS_META: Record<string, { label: string; color: string }> = {
  active:      { label: "Online", color: "#16a34a" },
  on_the_way:  { label: "On the Way", color: "#d97706" },
  in_progress: { label: "In Progress", color: "#1b6fba" },
  offline:     { label: "Offline", color: "#94a3b8" },
  searching:   { label: "Searching", color: "#d97706" },
  waiting:     { label: "Waiting", color: "#7c3aed" },
};

export function AdminMapView({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<typeof MAP_PINS[0] | null>(null);
  const [filter, setFilter] = useState<"all" | "providers" | "patients">("all");

  const [demoMode] = useState(() => {
    const stored = localStorage.getItem("demo_mode");
    return stored === null ? true : stored === "true";
  });

  const visible = MAP_PINS.filter(p =>
    filter === "all" ? true : filter === "providers" ? p.type === "provider" : p.type === "patient"
  );

  // Deterministic street grid
  const hLines = [18, 34, 45, 58, 70, 82];
  const vLines = [15, 28, 42, 55, 65, 78, 88];

  const height = compact ? 260 : 440;

  return (
    <div className={`flex gap-4 ${compact ? "flex-col md:flex-row" : "flex-col lg:flex-row"}`}>
      {/* Map canvas */}
      <div className="flex-1 relative rounded-[12px] overflow-hidden bg-[#dde6ef] dark:bg-slate-900 border border-[#c8d6e2] dark:border-slate-700" style={{ minHeight: height }}>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Street grid */}
          {hLines.map(y => <line key={`h${y}`} x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="#b8cad8" strokeWidth="1" />)}
          {vLines.map(x => <line key={`v${x}`} x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%" stroke="#b8cad8" strokeWidth="1" />)}
          {/* Main roads */}
          <line x1="0%" y1="45%" x2="100%" y2="45%" stroke="#a0b8cc" strokeWidth="2.5" />
          <line x1="42%" y1="0%" x2="42%" y2="100%" stroke="#a0b8cc" strokeWidth="2.5" />
          <line x1="0%" y1="70%" x2="100%" y2="68%" stroke="#a0b8cc" strokeWidth="1.5" />
          <line x1="65%" y1="0%" x2="63%" y2="100%" stroke="#a0b8cc" strokeWidth="1.5" />
          {/* Active route lines */}
          <polyline points="62%,48% 55%,46% 42%,30% 38%,32%" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="5 3" opacity="0.7" />
          <polyline points="48%,68% 50%,65%" fill="none" stroke="#1b6fba" strokeWidth="2" strokeDasharray="5 3" opacity="0.7" />
          {/* Active status pulse rings */}
          {visible.filter(p => p.status === "searching" || p.status === "on_the_way" || p.status === "active").map(p => (
            <g key={`ring-${p.id}`}>
              <circle cx={`${p.lat}%`} cy={`${p.lng}%`} r="3%" fill="none" stroke={p.status === "searching" ? "#d97706" : p.type === "provider" ? "#0d7c6a" : "#1b6fba"} strokeWidth="1.5" opacity="0.5">
                <animate attributeName="r" from="2%" to="9%" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>

        {/* City label */}
        <div className="absolute top-2 left-2 text-[11px] text-[#5a7a96] font-semibold bg-white dark:bg-slate-800/70 px-2 py-1 rounded-[6px] backdrop-blur-sm">
          Addis Ababa
        </div>

        {/* Live badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white dark:bg-slate-800/90 rounded-full px-2.5 py-1 shadow-sm border border-[#e2e8ee] dark:border-slate-700">
          <span className={`w-1.5 h-1.5 rounded-full ${demoMode ? "bg-amber-500 animate-pulse" : "bg-[#dc2626] animate-pulse"}`} />
          <span className="text-[10px] font-bold text-[#18232e] dark:text-slate-100">
            {demoMode ? "DEMO (SANDBOX)" : "LIVE API"}
          </span>
        </div>

        {/* Pins */}
        {visible.map(pin => {
          const meta = STATUS_META[pin.status] || { label: pin.status, color: "#94a3b8" };
          const isSelected = selected?.id === pin.id;
          const isProvider = pin.type === "provider";
          const desc = `${pin.name} (${pin.role}) - Status: ${meta.label}`;
          return (
            <button
              key={pin.id}
              onClick={() => setSelected(isSelected ? null : pin)}
              className={`absolute flex flex-col items-center group ${pin.status === "searching" || pin.status === "on_the_way" || pin.status === "active" ? "animate-bounce" : ""}`}
              style={{ left: `${pin.lat}%`, top: `${pin.lng}%`, transform: "translate(-50%, -100%)" }}
              aria-label={desc}
              title={desc}
            >
              <div
                className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold transition-transform group-hover:scale-110 ${isSelected ? "scale-125 ring-2 ring-offset-1" : ""}`}
                style={{ backgroundColor: pin.status === "offline" ? "#94a3b8" : pin.color, ringColor: pin.color } as React.CSSProperties}
              >
                {isProvider ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill="white"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill="white" stroke="white"/></svg>
                )}
              </div>
              {/* Status dot */}
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: meta.color }} />
              {/* Name label on hover / selected */}
              <div className={`mt-1 bg-white dark:bg-slate-800 text-[#18232e] dark:text-slate-100 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                {pin.name.split(" ")[0]}
              </div>
            </button>
          );
        })}

        {/* Selected info card */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 bg-white dark:bg-slate-800/95 backdrop-blur-sm rounded-[12px] shadow-lg p-3 border border-[#e2e8ee] dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: selected.color }}>
                {selected.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#18232e] dark:text-white truncate">{selected.name}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white shrink-0" style={{ backgroundColor: STATUS_META[selected.status]?.color || "#94a3b8" }}>
                    {STATUS_META[selected.status]?.label || selected.status}
                  </span>
                </div>
                <p className="text-[10px] text-[#8a9aaa] dark:text-slate-400">{selected.role} · {selected.type === "provider" ? "Provider" : "Patient"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#8a9aaa] hover:text-[#4a5a6a] shrink-0 text-lg leading-none">×</button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar list */}
      <div className={`${compact ? "md:w-48" : "lg:w-64"} space-y-2`}>
        {/* Filter tabs */}
        <div className="flex gap-1 bg-[#f4f7f9] dark:bg-slate-800 rounded-[8px] p-1">
          {(["all", "providers", "patients"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-[11px] font-semibold py-1 rounded-[6px] capitalize transition-colors ${filter === f ? "bg-white dark:bg-slate-700 text-[#0d7c6a] dark:text-cyan-400 shadow-sm" : "text-[#8a9aaa]"}`}
            >
              {f === "all" ? "All" : f === "providers" ? "Providers" : "Patients"}
            </button>
          ))}
        </div>

        {/* Count badges */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Online", count: MAP_PINS.filter(p => p.type === "provider" && p.status !== "offline").length, color: "#0d7c6a" },
            { label: "Active", count: MAP_PINS.filter(p => p.status === "in_progress").length, color: "#1b6fba" },
            { label: "Searching", count: MAP_PINS.filter(p => p.status === "searching").length, color: "#d97706" },
            { label: "Offline", count: MAP_PINS.filter(p => p.status === "offline").length, color: "#94a3b8" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[8px] px-2 py-1.5 text-center">
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pin list */}
        <div className="space-y-1 overflow-y-auto" style={{ maxHeight: compact ? 140 : 300 }}>
          {visible.map(pin => {
            const meta = STATUS_META[pin.status] || { label: pin.status, color: "#94a3b8" };
            return (
              <button
                key={pin.id}
                onClick={() => setSelected(selected?.id === pin.id ? null : pin)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-[8px] text-left transition-colors ${selected?.id === pin.id ? "bg-[#e6f5f2] dark:bg-slate-700 border border-[#0d7c6a]/20" : "bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 hover:border-[#0d7c6a]/20"}`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: pin.status === "offline" ? "#94a3b8" : pin.color }}>
                  {pin.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[#18232e] dark:text-white truncate">{pin.name.split(" ")[0]}</p>
                  <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400 truncate">{pin.role}</p>
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LiveMapSection() {
  const [demoMode] = useState(() => {
    const stored = localStorage.getItem("demo_mode");
    return stored === null ? true : stored === "true";
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>Live Provider & Patient Map</h2>
        <p className="text-sm text-[#8a9aaa] mt-0.5">Real-time tracking across Addis Ababa · WS events: provider_location_updated</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Providers Online", value: "4", color: "#0d7c6a", sub: "of 5 total" },
          { label: "Active Services", value: "2", color: "#1b6fba", sub: "in progress" },
          { label: "Searching", value: "1", color: "#d97706", sub: "finding provider" },
          { label: "Coverage Area", value: "Addis Ababa", color: "#7c3aed", sub: "all sub-cities" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[12px] p-4">
            <p className="text-xs text-[#8a9aaa] mb-1">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color, fontFamily: "DM Sans, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-[#8a9aaa] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Full map */}
      <div className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-[#4a5a6a]">
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#0d7c6a] rounded-full inline-block" /> Provider</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#1b6fba] rounded-full inline-block" /> Patient</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border-2 border-[#d97706] bg-white dark:bg-slate-800" /> Searching</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#94a3b8] rounded-full inline-block" /> Offline</span>
            <span className="flex items-center gap-1.5"><svg width="24" height="6" viewBox="0 0 24 6"><line x1="0" y1="3" x2="24" y2="3" stroke="#d97706" strokeWidth="2" strokeDasharray="4 2"/></svg> Route</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8a9aaa]">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${demoMode ? "bg-amber-500" : "bg-[#16a34a]"}`} />
            {demoMode ? "Demo Sandbox mode" : "Connected to Live WebSocket Stream"}
          </div>
        </div>
        <AdminMapView />
      </div>
    </div>
  );
}
