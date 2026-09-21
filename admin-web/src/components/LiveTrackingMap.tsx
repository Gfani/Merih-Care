/**
 * Real-Time Leaflet Live Tracking Map Engine
 * Uses genuine GPS coordinates on standard OpenStreetMap tiles without artificial offsets or spoofing.
 */

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export interface LiveTrackingMapProps {
  patientLocation?: MapLocation;
  providerLocation?: MapLocation;
  showRoute?: boolean;
  eta?: number; // minutes
  distance?: string;
  state?: MapState;
  zoom?: "city" | "neighborhood" | "street";
  className?: string;
  style?: React.CSSProperties;
  /** Called when map is ready — wire real SDK init here. */
  onMapReady?: () => void;
}

export type MockMapProps = LiveTrackingMapProps;

// Default initial coordinates (Addis Ababa, Ethiopia)
const DEFAULT_CENTER: [number, number] = [9.02497, 38.74689];

function createPatientIcon(label?: string, searching = false): L.DivIcon {
  return L.divIcon({
    className: "leaflet-custom-patient-marker",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        ${
          searching
            ? `<div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; border: 2px solid #0d7c6a; top: -8px; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75;"></div>`
            : ""
        }
        <div style="width: 32px; height: 32px; background-color: #0d7c6a; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 2;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" fill="#0d7c6a" />
          </svg>
        </div>
        ${
          label
            ? `<div style="margin-top: 3px; background: white; color: #18232e; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap; font-family: Inter, sans-serif;">${label}</div>`
            : ""
        }
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function createProviderIcon(label?: string, arrived = false): L.DivIcon {
  const bg = arrived ? "#16a34a" : "#1b6fba";
  return L.divIcon({
    className: "leaflet-custom-provider-marker",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="width: 32px; height: 32px; background-color: ${bg}; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 2;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div style="margin-top: 3px; background: white; color: #18232e; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); white-space: nowrap; font-family: Inter, sans-serif;">
          ${arrived ? "Arrived ✓" : label || "Healthcare Provider"}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

export function LiveTrackingMap({
  patientLocation,
  providerLocation,
  showRoute = true,
  eta,
  distance,
  state = "static",
  zoom = "neighborhood",
  className = "",
  style,
  onMapReady,
}: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const patientMarkerRef = useRef<L.Marker | null>(null);
  const providerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const isTracking =
    state === "provider_on_way" || state === "arrived" || state === "in_progress";

  // Initial map setup
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter: [number, number] = patientLocation
      ? [patientLocation.lat, patientLocation.lng]
      : providerLocation
      ? [providerLocation.lat, providerLocation.lng]
      : DEFAULT_CENTER;

    const initialZoom = zoom === "street" ? 16 : zoom === "city" ? 11 : 13;

    try {
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "OpenStreetMap",
      }).addTo(map);

      // Compact zoom control
      L.control
        .zoom({
          position: "topleft",
        })
        .addTo(map);

      mapInstanceRef.current = map;

      if (onMapReady) {
        onMapReady();
      }
    } catch (e) {
      console.warn("Leaflet map initialization skipped or caught:", e);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers, route, and camera bounds when coordinates or state change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Patient Marker
    let patientCoord: [number, number] | null = null;
    if (patientLocation) {
      patientCoord = [patientLocation.lat, patientLocation.lng];
      const isSearching = state === "searching";
      const patientIcon = createPatientIcon(patientLocation.label, isSearching);

      if (!patientMarkerRef.current) {
        patientMarkerRef.current = L.marker(patientCoord, { icon: patientIcon }).addTo(map);
      } else {
        patientMarkerRef.current.setLatLng(patientCoord);
        patientMarkerRef.current.setIcon(patientIcon);
      }
    } else if (patientMarkerRef.current) {
      map.removeLayer(patientMarkerRef.current);
      patientMarkerRef.current = null;
    }

    // 2. Provider Marker (Strictly real coordinates, no synthetic offsets)
    const isArrived = state === "arrived";
    if (providerLocation) {
      const provCoord: [number, number] = [providerLocation.lat, providerLocation.lng];
      const provIcon = createProviderIcon(providerLocation.label, isArrived);

      if (!providerMarkerRef.current) {
        providerMarkerRef.current = L.marker(provCoord, { icon: provIcon }).addTo(map);
      } else {
        providerMarkerRef.current.setLatLng(provCoord);
        providerMarkerRef.current.setIcon(provIcon);
      }

      // 3. Route Polyline
      if (showRoute && isTracking && !isArrived && patientCoord) {
        const routePoints: [number, number][] = [provCoord, patientCoord];
        if (!routePolylineRef.current) {
          routePolylineRef.current = L.polyline(routePoints, {
            color: "#0d7c6a",
            weight: 3.5,
            dashArray: "6, 6",
            opacity: 0.85,
          }).addTo(map);
        } else {
          routePolylineRef.current.setLatLngs(routePoints);
        }
      } else if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }

      // 4. Fit bounds to contain both points if available
      try {
        if (patientCoord) {
          const bounds = L.latLngBounds([patientCoord, provCoord]);
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 15,
            animate: true,
          });
        } else {
          map.setView(provCoord, zoom === "street" ? 16 : zoom === "city" ? 11 : 13);
        }
      } catch (_) {}
    } else {
      if (providerMarkerRef.current) {
        map.removeLayer(providerMarkerRef.current);
        providerMarkerRef.current = null;
      }
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (patientCoord) {
        map.setView(patientCoord, zoom === "street" ? 16 : zoom === "city" ? 11 : 13);
      }
    }
  }, [patientLocation, providerLocation, state, showRoute, zoom]);

  return (
    <div
      className={`relative overflow-hidden bg-[#e8edf2] rounded-xl border border-slate-200 ${className}`}
      style={style}
      role="region"
      aria-label="Real-time live map tracking"
    >
      {/* Leaflet DOM container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Live Badge */}
      {isTracking && state !== "arrived" && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-md border border-slate-200">
          <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-[11px] font-bold text-slate-800 tracking-wide">LIVE GPS</span>
        </div>
      )}

      {/* Search status overlay */}
      {state === "searching" && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-md border border-slate-200">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
          <span className="text-[11px] font-semibold text-slate-700">Searching Nearby Providers...</span>
        </div>
      )}

      {/* ETA & Distance badge */}
      {eta !== undefined && isTracking && state !== "arrived" && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3.5 py-2 text-center border border-slate-200">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Estimated Arrival</p>
          <p className="text-base font-bold text-[#0d7c6a]">{eta} min</p>
          {distance && <p className="text-[11px] text-slate-500 font-medium">{distance}</p>}
        </div>
      )}

      {/* Map location badge */}
      <div className="absolute bottom-3 left-3 z-10 text-[11px] font-medium text-slate-600 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-sm border border-slate-200">
        📍 {patientLocation?.label || providerLocation?.label || "Addis Ababa, Ethiopia"}
      </div>
    </div>
  );
}

export const MockMap = LiveTrackingMap;
export default LiveTrackingMap;
