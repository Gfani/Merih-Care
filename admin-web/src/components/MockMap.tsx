/**
 * MockMap — structured for future replacement with a real map provider.
 *
 * When integrating a real map (Mapbox, Google Maps, Leaflet, etc.):
 * 1. Replace the JSX inside this component with the real map SDK render.
 * 2. Keep the same prop interface — callers need no changes.
 * 3. The `onMapReady` callback slot is available for SDK init hooks.
 *
 * WebSocket events to connect later:
 *   provider_location_updated  → update providerLocation prop
 *   provider_arrived           → trigger arrived state
 *   service_started            → trigger inProgress state
 */

import React from "react";

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
}

export type MapState =
  | "searching"
  | "provider_on_way"
  | "arrived"
  | "in_progress"
  | "static";

interface MockMapProps {
  patientLocation?: MapLocation;
  providerLocation?: MapLocation;
  showRoute?: boolean;
  eta?: number;            // minutes
  distance?: string;
  state?: MapState;
  zoom?: "city" | "neighborhood" | "street";
  className?: string;
  style?: React.CSSProperties;
  /** Called when map is ready — wire real SDK init here. */
  onMapReady?: () => void;
}

/** Deterministic pseudo-street grid from a seed */
function seededLines(seed: number, count: number, vertical: boolean): React.ReactNode[] {
  return Array.from({ length: count }, (_, i) => {
    const pos = ((i * 73 + seed * 37) % 80) + 10;
    const opacity = ((i * 31 + seed * 19) % 4) * 0.06 + 0.08;
    return vertical ? (
      <line key={i} x1={`${pos}%`} y1="0%" x2={`${pos}%`} y2="100%" stroke="#94a3b8" strokeWidth="0.5" opacity={opacity} />
    ) : (
      <line key={i} x1="0%" y1={`${pos}%`} x2="100%" y2={`${pos}%`} stroke="#94a3b8" strokeWidth="0.5" opacity={opacity} />
    );
  });
}

export default function MockMap({
  patientLocation,
  providerLocation,
  showRoute = false,
  eta,
  distance,
  state = "static",
  className = "",
  style,
}: MockMapProps) {
  const isTracking = state === "provider_on_way" || state === "arrived" || state === "in_progress";

  // Fixed mock screen positions
  const patientPx = { x: 52, y: 58 };
  const providerPx = state === "arrived" ? { x: 53, y: 57 } : { x: 28, y: 34 };

  return (
    <div
      className={`relative overflow-hidden bg-[#e8edf2] ${className}`}
      style={style}
      role="img"
      aria-label="Map view"
    >
      {/* Street grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {seededLines(1, 14, true)}
        {seededLines(2, 10, false)}
        {/* A few thicker "main roads" */}
        <line x1="0%" y1="45%" x2="100%" y2="43%" stroke="#cbd5e1" strokeWidth="2" opacity="0.6" />
        <line x1="0%" y1="70%" x2="100%" y2="70%" stroke="#cbd5e1" strokeWidth="2" opacity="0.5" />
        <line x1="35%" y1="0%" x2="37%" y2="100%" stroke="#cbd5e1" strokeWidth="2" opacity="0.5" />
        <line x1="65%" y1="0%" x2="63%" y2="100%" stroke="#cbd5e1" strokeWidth="2" opacity="0.4" />

        {/* Route line */}
        {showRoute && isTracking && (
          <polyline
            points={`${providerPx.x}%,${providerPx.y}% 40%,44% 52%,44% ${patientPx.x}%,${patientPx.y}%`}
            fill="none"
            stroke="#0d7c6a"
            strokeWidth="3"
            strokeDasharray="6 4"
            opacity="0.8"
          />
        )}

        {/* Searching rings */}
        {state === "searching" && (
          <>
            <circle cx="52%" cy="58%" r="8%" fill="none" stroke="#0d7c6a" strokeWidth="1.5" opacity="0.3">
              <animate attributeName="r" from="5%" to="20%" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="52%" cy="58%" r="8%" fill="none" stroke="#0d7c6a" strokeWidth="1.5" opacity="0.2">
              <animate attributeName="r" from="5%" to="30%" dur="2s" begin="0.7s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin="0.7s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>

      {/* Subtle map label */}
      <div className="absolute top-2 left-2 text-[10px] text-[#94a3b8] font-medium bg-white/70 px-1.5 py-0.5 rounded">
        Addis Ababa
      </div>

      {/* Patient pin */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: `${patientPx.x}%`, top: `${patientPx.y}%`, transform: "translate(-50%, -100%)" }}
      >
        <div className="w-8 h-8 bg-[#0d7c6a] rounded-full border-3 border-white shadow-lg flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" fill="#0d7c6a" />
          </svg>
        </div>
        {patientLocation?.label && (
          <div className="mt-1 bg-white text-[#18232e] text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            {patientLocation.label}
          </div>
        )}
      </div>

      {/* Provider pin (when tracking) */}
      {isTracking && (
        <div
          className="absolute flex flex-col items-center transition-all duration-1000"
          style={{ left: `${providerPx.x}%`, top: `${providerPx.y}%`, transform: "translate(-50%, -100%)" }}
        >
          <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${state === "arrived" ? "bg-[#16a34a]" : "bg-[#1b6fba]"}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="mt-1 bg-white text-[#18232e] text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            {state === "arrived" ? "Arrived ✓" : providerLocation?.label || "Provider"}
          </div>
        </div>
      )}

      {/* ETA badge */}
      {eta !== undefined && isTracking && state !== "arrived" && (
        <div className="absolute bottom-3 right-3 bg-white rounded-[10px] shadow-md px-3 py-2 text-center">
          <p className="text-[10px] text-[#8a9aaa] font-medium">ETA</p>
          <p className="text-base font-bold text-[#0d7c6a]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {eta} min
          </p>
          {distance && <p className="text-[10px] text-[#8a9aaa]">{distance}</p>}
        </div>
      )}

      {/* Live badge */}
      {isTracking && state !== "arrived" && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-1">
          <span className="w-1.5 h-1.5 bg-[#dc2626] rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-[#18232e]">LIVE</span>
        </div>
      )}
    </div>
  );
}
