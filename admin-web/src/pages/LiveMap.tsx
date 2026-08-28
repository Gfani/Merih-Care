import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { Card } from "../components/ui";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";
import { api } from "../services/api";

export interface LocationPin {
  id: string;
  userId: string;
  role: "provider" | "patient" | string;
  name: string;
  status: string; // available, busy, critical, offline
  x: number; // longitude
  y: number; // latitude
  accuracy?: number;
  privacyMode?: boolean;
  locationTimestamp?: string;
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  available:   { label: "Available", color: "#16a34a" },
  busy:        { label: "Busy", color: "#d97706" },
  critical:    { label: "Emergency", color: "#dc2626" },
  offline:     { label: "Offline", color: "#94a3b8" },
};

// Map scale helper to align any mock coordinates in Addis Ababa area
function getGpsCoords(x: number, y: number): [number, number] {
  if (y > 8.8 && y < 9.2 && x > 38.6 && x < 38.9) {
    return [y, x];
  }
  // Convert standard percentage or Egyptian-area mocks into Addis Ababa GPS area
  const lat = 9.0192 + ((y - 32) * 0.002);
  const lng = 38.7578 + ((x - 38) * 0.002);
  return [lat, lng];
}

export function AdminMapView({ compact = false }: { compact?: boolean }) {
  const [locations, setLocations] = useState<LocationPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "providers" | "patients">("all");
  const [selectedPin, setSelectedPin] = useState<LocationPin | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: number } | null>(null);
  const [myPrivacy, setMyPrivacy] = useState(false);

  const token = localStorage.getItem("admin_token") || "demo-token";
  const { isLive, connectionState, on, off } = useRealtimeSocket({ token });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Fetch initial location list
  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getLocations();
      setLocations(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch map locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Set up real-time listener for WS updates
  useEffect(() => {
    const handleLocationUpdate = (payload: any) => {
      const updated = payload.data;
      if (!updated) return;

      setLocations(prev => {
        const idx = prev.findIndex(l => l.userId === updated.providerId);
        if (idx !== -1) {
          const updatedList = [...prev];
          updatedList[idx] = {
            ...updatedList[idx],
            x: updated.lng,
            y: updated.lat,
            locationTimestamp: updated.lastUpdated || new Date().toISOString(),
          };
          return updatedList;
        } else {
          // Add new online provider
          return [
            ...prev,
            {
              id: `loc-${Date.now()}`,
              userId: updated.providerId,
              role: "provider",
              name: `Provider ${updated.providerId.slice(-4)}`,
              status: "available",
              x: updated.lng,
              y: updated.lat,
              locationTimestamp: updated.lastUpdated || new Date().toISOString(),
            },
          ];
        }
      });
    };

    on("location_update", handleLocationUpdate);
    return () => {
      off("location_update", handleLocationUpdate);
    };
  }, [on, off]);

  // Handle privacy toggle simulation for test environment
  const togglePrivacy = async () => {
    const nextPrivacy = !myPrivacy;
    setMyPrivacy(nextPrivacy);
    await api.updateLocationPrivacy(nextPrivacy);
    fetchLocations();
  };

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        maxZoom: 18,
      }).setView([9.0192, 38.7578], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers, Clustering, Route Line, and Priority Sorting
  useEffect(() => {
    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    // Clear previous elements
    group.clearLayers();
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const filtered = locations.filter(loc => {
      if (filter === "providers") return loc.role === "provider";
      if (filter === "patients") return loc.role === "patient";
      return true;
    });

    // 1. Manual clustering algorithm for nearby pins
    const clusters: Array<{ lat: number; lng: number; count: number; pins: LocationPin[] }> = [];
    const CLUSTER_THRESHOLD = 0.008; // ~800m threshold

    filtered.forEach(pin => {
      // Offline providers: coordinates masked to 0,0. Do not map on active chart.
      if (pin.role === "provider" && pin.status === "offline") {
        return;
      }

      const [gpsLat, gpsLng] = getGpsCoords(pin.x, pin.y);

      let added = false;
      for (const c of clusters) {
        const dist = Math.sqrt(Math.pow(gpsLat - c.lat, 2) + Math.pow(gpsLng - c.lng, 2));
        if (dist < CLUSTER_THRESHOLD) {
          c.pins.push(pin);
          c.count++;
          // Centroid adjustment
          c.lat = c.pins.reduce((sum, p) => sum + getGpsCoords(p.x, p.y)[0], 0) / c.pins.length;
          c.lng = c.pins.reduce((sum, p) => sum + getGpsCoords(p.x, p.y)[1], 0) / c.pins.length;
          added = true;
          break;
        }
      }

      if (!added) {
        clusters.push({ lat: gpsLat, lng: gpsLng, count: 1, pins: [pin] });
      }
    });

    // 2. Render Markers
    clusters.forEach(c => {
      if (c.count > 1) {
        // Render Cluster Marker
        const clusterHtml = `
          <div style="
            background: rgba(13, 124, 106, 0.9);
            border: 3px solid white;
            border-radius: 50%;
            color: white;
            font-weight: bold;
            font-size: 13px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.15);
          ">
            ${c.count}
          </div>
        `;
        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: "custom-cluster-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([c.lat, c.lng], { icon: clusterIcon }).addTo(group);
        marker.on("click", () => {
          map.setView([c.lat, c.lng], map.getZoom() + 2);
        });
      } else {
        // Render Single Marker
        const pin = c.pins[0];
        const isProvider = pin.role === "provider";
        const isEmergency = pin.status === "critical";

        const bg = isEmergency ? "#dc2626" : isProvider ? "#0d7c6a" : "#1b6fba";
        const pulsing = isEmergency ? "animate-pulse" : "";

        const markerHtml = `
          <div class="${pulsing}" style="
            background: ${bg};
            border: 2px solid white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.15);
          ">
            <span style="color: white; font-size: 10px; font-weight: bold;">
              ${isEmergency ? "🚨" : isProvider ? "🩺" : "👤"}
            </span>
          </div>
        `;

        const markerIcon = L.divIcon({
          html: markerHtml,
          className: "custom-marker-icon",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([c.lat, c.lng], { icon: markerIcon }).addTo(group);
        marker.bindTooltip(`
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
            <b>${pin.name}</b><br/>
            Role: ${pin.role}<br/>
            Status: ${STATUS_META[pin.status]?.label || pin.status}
          </div>
        `);

        marker.on("click", () => {
          setSelectedPin(pin);
        });
      }
    });

    // 3. Render Route Polyline if emergency/critical patient is active
    const activeEmergency = filtered.find(p => p.role === "patient" && p.status === "critical");
    const closestProvider = filtered.find(p => p.role === "provider" && p.status === "available");

    if (activeEmergency && closestProvider) {
      const eCoords = getGpsCoords(activeEmergency.x, activeEmergency.y);
      const pCoords = getGpsCoords(closestProvider.x, closestProvider.y);

      const routeLine = L.polyline([pCoords, eCoords], {
        color: "#dc2626",
        weight: 4,
        dashArray: "6, 10",
        opacity: 0.8,
      }).addTo(map);

      routeLineRef.current = routeLine;

      // Draw Haversine eta info
      const distInfo = api.getRoute(pCoords[0], pCoords[1], eCoords[0], eCoords[1]);
      Promise.resolve(distInfo).then(res => setRouteInfo(res));
    } else {
      setRouteInfo(null);
    }
  }, [locations, filter]);

  const height = compact ? 260 : 440;

  return (
    <div className={`flex gap-4 ${compact ? "flex-col md:flex-row" : "flex-col lg:flex-row"}`}>
      {/* Map canvas */}
      <div
        className="flex-1 relative rounded-[12px] overflow-hidden border border-[#c8d6e2] dark:border-slate-700 bg-[#dde6ef]"
        style={{ minHeight: height }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: `${height}px` }} />

        {/* City label */}
        <div className="absolute top-2 left-2 z-[400] text-[11px] text-[#5a7a96] font-semibold bg-white/95 dark:bg-slate-800/90 px-2 py-1 rounded-[6px] backdrop-blur-sm shadow-sm">
          Addis Ababa
        </div>

        {/* WebSocket Connection State (LIVE indicator strictly conditional) */}
        <div className="absolute top-2 right-2 z-[400] flex items-center gap-1.5 bg-white/95 dark:bg-slate-800/90 rounded-full px-2.5 py-1 shadow-sm border border-[#e2e8ee] dark:border-slate-700">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-[#16a34a] animate-pulse" : "bg-[#dc2626]"}`} />
          <span className="text-[10px] font-bold text-[#18232e] dark:text-slate-100">
            {isLive ? "LIVE STREAM" : connectionState.toUpperCase()}
          </span>
        </div>

        {/* Route Details Panel */}
        {routeInfo && (
          <div className="absolute bottom-3 right-3 z-[400] bg-white dark:bg-slate-800/95 rounded-[10px] shadow-lg p-2.5 border border-red-200 dark:border-red-900/40">
            <p className="text-[10px] text-red-500 font-bold">🚨 ACTIVE EMERGENCY PATH</p>
            <p className="text-sm font-extrabold text-[#18232e] dark:text-white mt-0.5">
              Distance: {routeInfo.distance}
            </p>
            <p className="text-xs text-[#0d7c6a] font-semibold">
              ETA: {routeInfo.eta} mins
            </p>
          </div>
        )}

        {/* Selected info card */}
        {selectedPin && (
          <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-[12px] shadow-lg p-3 border border-[#e2e8ee] dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: selectedPin.role === "provider" ? "#0d7c6a" : "#1b6fba" }}
              >
                {selectedPin.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#18232e] dark:text-white truncate">{selectedPin.name}</p>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white shrink-0"
                    style={{ backgroundColor: STATUS_META[selectedPin.status]?.color || "#94a3b8" }}
                  >
                    {STATUS_META[selectedPin.status]?.label || selectedPin.status}
                  </span>
                </div>
                <p className="text-[10px] text-[#8a9aaa] dark:text-slate-400">
                  Role: {selectedPin.role} · Acc: {selectedPin.accuracy}m
                </p>
                {selectedPin.locationTimestamp && (
                  <p className="text-[9px] text-[#8a9aaa]/80 dark:text-slate-500">
                    Updated: {new Date(selectedPin.locationTimestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-[#8a9aaa] hover:text-[#4a5a6a] shrink-0 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar list */}
      <div className={`${compact ? "md:w-48" : "lg:w-64"} space-y-2 shrink-0`}>
        {/* Privacy toggle controls */}
        <button
          onClick={togglePrivacy}
          className={`w-full py-1.5 px-3 rounded-[8px] text-[11px] font-bold border transition-colors ${myPrivacy ? "bg-red-50 text-red-600 border-red-200" : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"}`}
        >
          {myPrivacy ? "🔒 Mask Exact Location (ON)" : "🔓 Mask Exact Location (OFF)"}
        </button>

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

        {/* Count indicators */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Providers", count: locations.filter(p => p.role === "provider" && p.status !== "offline").length, color: "#0d7c6a" },
            { label: "Patients", count: locations.filter(p => p.role === "patient").length, color: "#1b6fba" },
            { label: "Emergency", count: locations.filter(p => p.status === "critical").length, color: "#dc2626" },
            { label: "Offline", count: locations.filter(p => p.role === "provider" && p.status === "offline").length, color: "#94a3b8" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[8px] px-2 py-1.5 text-center shadow-xs">
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pin list (Priority sorted - Emergencies first) */}
        {loading ? (
          <div className="text-center py-5 text-xs text-[#8a9aaa]">Loading pins...</div>
        ) : error ? (
          <div className="text-center py-5 text-xs text-red-500">{error}</div>
        ) : (
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: compact ? 120 : 260 }}>
            {locations
              .filter(pin => {
                if (filter === "providers") return pin.role === "provider";
                if (filter === "patients") return pin.role === "patient";
                return true;
              })
              .map(pin => {
                const meta = STATUS_META[pin.status] || { label: pin.status, color: "#94a3b8" };
                return (
                  <button
                    key={pin.id}
                    onClick={() => setSelectedPin(selectedPin?.id === pin.id ? null : pin)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-[8px] text-left transition-colors ${selectedPin?.id === pin.id ? "bg-[#e6f5f2] dark:bg-slate-700 border border-[#0d7c6a]/20" : "bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 hover:border-[#0d7c6a]/20"}`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: pin.role === "provider" ? "#0d7c6a" : "#1b6fba" }}
                    >
                      {pin.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#18232e] dark:text-white truncate">{pin.name}</p>
                      <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400 truncate">{pin.role}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveMapSection() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>Live Provider & Patient Map</h2>
        <p className="text-sm text-[#8a9aaa] mt-0.5">Real-time tracking across Addis Ababa · Leaflet tile integration</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-[#4a5a6a] dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#0d7c6a] rounded-full inline-block" /> Provider</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#1b6fba] rounded-full inline-block" /> Patient</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#dc2626] rounded-full inline-block animate-ping" /> Emergency Alert</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#94a3b8] rounded-full inline-block" /> Offline</span>
          </div>
        </div>
        <AdminMapView />
      </div>
    </div>
  );
}
