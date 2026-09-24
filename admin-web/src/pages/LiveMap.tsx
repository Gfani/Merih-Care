import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { Card } from "../components/ui";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export interface LocationPin {
  id: string;
  userId: string;
  role: "provider" | "patient" | string;
  name: string;
  status: string; // available, busy, critical
  isOnline?: boolean;
  x: number; // longitude
  y: number; // latitude
  accuracy?: number;
  privacyMode?: boolean;
  locationTimestamp?: string;
}

export interface ActiveTrip {
  id: string;
  appointmentId: string;
  status: string; // accepted, on_the_way, in_progress, completed, cancelled
  service?: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientLat: number;
  patientLng: number;
  providerId: string;
  providerUserId?: string;
  providerName: string;
  providerPhone?: string;
  providerLat: number;
  providerLng: number;
  isOnline?: boolean;
  routePoints?: Array<[number, number]>;
  distanceKm?: number;
  etaMinutes?: number;
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  available:   { label: "Available", color: "#16a34a" },
  busy:        { label: "Busy", color: "#d97706" },
  critical:    { label: "Emergency", color: "#dc2626" },
  offline:     { label: "Offline", color: "#94a3b8" },
};

export function AdminMapView({ compact = false }: { compact?: boolean }) {
  const [locations, setLocations] = useState<LocationPin[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "providers" | "patients">("all");
  const [selectedPin, setSelectedPin] = useState<LocationPin | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: number } | null>(null);
  const [activeDispatch, setActiveDispatch] = useState<{
    appointmentId: string;
    status: string;
    providerName?: string;
    providerLat?: number;
    providerLng?: number;
    routePoints?: Array<[number, number]>;
    distanceKm?: number;
    etaMinutes?: number;
  } | null>(null);
  const [myPrivacy, setMyPrivacy] = useState(false);
  const { token } = useAuth();
  const { isLive, connectionState, on, off } = useRealtimeSocket({ token: token || undefined });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routesGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const prevCountRef = useRef<number>(0);

  // Fetch initial location list strictly from real-time backend
  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getLocations();
      const raw = Array.isArray(data) ? data : [];
      const normalized: LocationPin[] = raw
        .filter((loc: any) => loc.status !== "offline" && loc.isOnline !== false)
        .map((loc: any) => ({
          id: String(loc.id || loc.userId || `pin-${Date.now()}`),
          userId: String(loc.userId || loc.id),
          name: loc.name || (loc.userId ? `User ${String(loc.userId).substring(0, 6)}` : `User ${loc.id || "00"}`),
          role: loc.role || "provider",
          status: loc.status || "available",
          isOnline: loc.isOnline !== false,
          x: Number(loc.x ?? loc.longitude ?? loc.lng ?? 0),
          y: Number(loc.y ?? loc.latitude ?? loc.lat ?? 0),
          accuracy: loc.accuracy ?? 5,
          privacyMode: Boolean(loc.privacyMode),
          locationTimestamp: loc.locationTimestamp || loc.updatedAt || new Date().toISOString(),
        }))
        .filter((pin: LocationPin) => !isNaN(pin.x) && !isNaN(pin.y) && !(pin.x === 0 && pin.y === 0));

      setLocations(normalized);
    } catch (err: any) {
      setError(err.message || "Failed to fetch map locations.");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTrips = async () => {
    try {
      const data = await api.getActiveDispatches();
      if (Array.isArray(data)) {
        setActiveTrips(data);
        const first = data.find((t: any) => t.status === "on_the_way" || t.status === "accepted");
        if (first) {
          setActiveDispatch({
            appointmentId: first.appointmentId,
            status: first.status,
            providerName: first.providerName,
            providerLat: first.providerLat,
            providerLng: first.providerLng,
            routePoints: first.routePoints,
            distanceKm: first.distanceKm,
            etaMinutes: first.etaMinutes,
          });
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchLocations();
    fetchActiveTrips();
  }, []);

  // Re-sync locations and active trips whenever live connection is established
  useEffect(() => {
    if (isLive) {
      fetchLocations();
      fetchActiveTrips();
    }
  }, [isLive]);

  // Periodic fallback refresh every 20s if socket is disconnected/reconnecting
  useEffect(() => {
    if (isLive) return;
    const interval = setInterval(() => {
      fetchLocations();
      fetchActiveTrips();
    }, 20000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Set up real-time listener for WS updates
  useEffect(() => {
    const handleLocationUpdate = (payload: any) => {
      const updated = payload?.data || payload;
      if (!updated) return;
      const targetId = String(updated.providerId || updated.userId || updated.id || "");
      if (!targetId) return;

      // Drop immediately if marked offline
      if (updated.status === "offline" || updated.isOnline === false) {
        setLocations(prev => prev.filter(l => l.userId !== targetId && l.id !== targetId && l.id !== `loc-${targetId}`));
        setSelectedPin(prev => (prev?.userId === targetId || prev?.id === targetId || prev?.id === `loc-${targetId}` ? null : prev));
        setActiveTrips(prev => prev.map(t => (t.providerId === targetId || t.providerUserId === targetId || t.patientId === targetId ? { ...t, isOnline: false } : t)));
        return;
      }

      const lat = Number(updated.lat ?? updated.latitude ?? updated.y);
      const lng = Number(updated.lng ?? updated.longitude ?? updated.x);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const role = updated.role || updated.targetRole || (updated.patientId ? "patient" : "provider");
      const isPatient = role === "patient";
      const name = updated.name || (isPatient ? `Patient ${targetId.slice(-4)}` : `Provider ${targetId.slice(-4)}`);

      setLocations(prev => {
        const idx = prev.findIndex(l => l.userId === targetId || l.id === targetId || l.id === `loc-${targetId}`);
        if (idx !== -1) {
          const updatedList = [...prev];
          updatedList[idx] = {
            ...updatedList[idx],
            role: role || updatedList[idx].role,
            name: updated.name || updatedList[idx].name,
            x: lng,
            y: lat,
            status: updated.status || updatedList[idx].status || "available",
            isOnline: true,
            locationTimestamp: updated.lastUpdated || updated.timestamp || new Date().toISOString(),
          };
          return updatedList;
        } else {
          // New online provider or active patient entry
          return [
            ...prev,
            {
              id: `loc-${targetId}`,
              userId: targetId,
              role: role,
              name: name,
              status: updated.status || "available",
              isOnline: true,
              x: lng,
              y: lat,
              accuracy: updated.accuracy ?? 5,
              locationTimestamp: updated.lastUpdated || updated.timestamp || new Date().toISOString(),
            },
          ];
        }
      });

      // Update provider coordinates on any active navigation trips in real-time
      setActiveTrips(prev => {
        let changed = false;
        const next = prev.map(trip => {
          if (trip.providerId === targetId || trip.providerUserId === targetId) {
            changed = true;
            const updatedPts: Array<[number, number]> = trip.routePoints && trip.routePoints.length >= 2
              ? [[lat, lng], ...trip.routePoints.slice(1)]
              : [[lat, lng], [trip.patientLat, trip.patientLng]];
            return {
              ...trip,
              providerLat: lat,
              providerLng: lng,
              routePoints: updatedPts,
            };
          }
          return trip;
        });
        return changed ? next : prev;
      });
    };

    const handleOffline = (payload: any) => {
      const data = payload?.data || payload;
      const targetId = String(data?.providerId || data?.patientId || data?.userId || data?.id || "");
      if (!targetId) return;

      setLocations(prev => prev.filter(l => l.userId !== targetId && l.id !== targetId && l.id !== `loc-${targetId}`));
      setSelectedPin(prev => (prev?.userId === targetId || prev?.id === targetId || prev?.id === `loc-${targetId}` ? null : prev));
      setActiveTrips(prev => prev.map(t => (t.providerId === targetId || t.providerUserId === targetId || t.patientId === targetId ? { ...t, isOnline: false } : t)));
    };

    const handleDispatchUpdate = (payload: any) => {
      const data = payload?.data || payload;
      if (!data) return;
      const aptId = String(data.appointmentId || data.id || "");
      if (!aptId) return;

      // When an appointment updates to "completed" or "cancelled", clear the trip immediately
      if (data.status === "completed" || data.status === "cancelled" || data.status === "rejected") {
        setActiveTrips(prev => prev.filter(t => t.appointmentId !== aptId && t.id !== aptId));
        setActiveDispatch(prev => (prev?.appointmentId === aptId ? null : prev));
        return;
      }

      if (data.status === "searching" || data.status === "accepted" || data.status === "on_the_way" || data.status === "in_progress") {
        let pts: Array<[number, number]> = [];
        if (Array.isArray(data.routePoints) && data.routePoints.length > 0) {
          pts = data.routePoints.map((pt: any) => [
            Number(pt.lat ?? pt[0]),
            Number(pt.lng ?? pt[1]),
          ]);
        } else if (data.providerLat && data.providerLng) {
          pts = [
            [Number(data.providerLat), Number(data.providerLng)],
            [Number(data.patientLat || 9.02497), Number(data.patientLng || 38.74689)],
          ];
        }

        const newTrip: ActiveTrip = {
          id: aptId,
          appointmentId: aptId,
          status: String(data.status),
          service: data.service,
          patientId: String(data.patientId || ""),
          patientName: data.patientName || "Patient",
          patientPhone: data.patientPhone,
          patientLat: Number(data.patientLat || 9.02497),
          patientLng: Number(data.patientLng || 38.74689),
          providerId: String(data.providerId || ""),
          providerUserId: String(data.providerUserId || data.providerId || ""),
          providerName: data.providerName || "Matched Clinician",
          providerPhone: data.providerPhone,
          providerLat: Number(data.providerLat || 9.018),
          providerLng: Number(data.providerLng || 38.765),
          routePoints: pts,
          distanceKm: data.distanceKm ? Number(data.distanceKm) : undefined,
          etaMinutes: data.etaMinutes ? Number(data.etaMinutes) : undefined,
        };

        setActiveTrips(prev => {
          const idx = prev.findIndex(t => t.appointmentId === aptId || t.id === aptId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newTrip };
            return next;
          }
          return [...prev, newTrip];
        });

        setActiveDispatch({
          appointmentId: aptId,
          status: String(data.status),
          providerName: data.providerName || "Matched Clinician",
          providerLat: data.providerLat ? Number(data.providerLat) : undefined,
          providerLng: data.providerLng ? Number(data.providerLng) : undefined,
          routePoints: pts,
          distanceKm: data.distanceKm ? Number(data.distanceKm) : undefined,
          etaMinutes: data.etaMinutes ? Number(data.etaMinutes) : undefined,
        });
      }
    };

    const handleAppointmentStatusUpdate = (payload: any) => {
      const data = payload?.data || payload;
      if (!data) return;
      const aptId = String(data.appointmentId || data.id || "");
      if (data.status === "completed" || data.status === "cancelled") {
        setActiveTrips(prev => prev.filter(t => t.appointmentId !== aptId && t.id !== aptId));
        setActiveDispatch(prev => (prev?.appointmentId === aptId ? null : prev));
      } else if (data.status === "on_the_way" || data.status === "accepted" || data.status === "in_progress") {
        handleDispatchUpdate(payload);
      }
    };

    on("location_update", handleLocationUpdate);
    on("provider_location_update", handleLocationUpdate);
    on("patient_location_update", handleLocationUpdate);
    on("provider_offline", handleOffline);
    on("patient_offline", handleOffline);
    on("user_offline", handleOffline);
    on("dispatch_update", handleDispatchUpdate);
    on("dispatch_offer_sent", handleDispatchUpdate);
    on("appointment_status_update", handleAppointmentStatusUpdate);

    return () => {
      off("location_update", handleLocationUpdate);
      off("provider_location_update", handleLocationUpdate);
      off("patient_location_update", handleLocationUpdate);
      off("provider_offline", handleOffline);
      off("patient_offline", handleOffline);
      off("user_offline", handleOffline);
      off("dispatch_update", handleDispatchUpdate);
      off("dispatch_offer_sent", handleDispatchUpdate);
      off("appointment_status_update", handleAppointmentStatusUpdate);
    };
  }, [on, off]);

  // Handle privacy toggle
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
        zoomControl: false,
        maxZoom: 18,
      }).setView([9.02497, 38.74689], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Standard 100% free OpenStreetMap tile server
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: "abc",
        maxZoom: 19,
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      routesGroupRef.current = L.layerGroup().addTo(map);
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

    // Strict online-only filter
    const filtered = locations.filter(loc => {
      if (loc.status === "offline" || loc.isOnline === false) return false;
      if (filter === "providers") return loc.role === "provider";
      if (filter === "patients") return loc.role === "patient";
      return true;
    });

    // Fit map bounds automatically to active incoming providers
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map(p => [p.y, p.x] as [number, number]));
      if (bounds.isValid()) {
        if (prevCountRef.current !== filtered.length) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          prevCountRef.current = filtered.length;
        }
      }
    }

    // 1. Clustering algorithm for nearby pins
    const clusters: Array<{ lat: number; lng: number; count: number; pins: LocationPin[] }> = [];
    const CLUSTER_THRESHOLD = 0.008; // ~800m threshold

    filtered.forEach(pin => {
      const lat = pin.y;
      const lng = pin.x;
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      let added = false;
      for (const c of clusters) {
        const dist = Math.sqrt(Math.pow(lat - c.lat, 2) + Math.pow(lng - c.lng, 2));
        if (dist < CLUSTER_THRESHOLD) {
          c.pins.push(pin);
          c.count++;
          // Centroid adjustment
          c.lat = c.pins.reduce((sum, p) => sum + p.y, 0) / c.pins.length;
          c.lng = c.pins.reduce((sum, p) => sum + p.x, 0) / c.pins.length;
          added = true;
          break;
        }
      }

      if (!added) {
        clusters.push({ lat, lng, count: 1, pins: [pin] });
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

    // Clear previous routes
    if (routesGroupRef.current) {
      routesGroupRef.current.clearLayers();
    }

    // 3. Render Active Navigation Trips ("God's Eye" Fleet View)
    const onTheWayTrips = activeTrips.filter((t) => t.status === "on_the_way");
    onTheWayTrips.forEach((trip) => {
      // a) Plot patient's destination pin in blue
      if (!isNaN(trip.patientLat) && !isNaN(trip.patientLng) && !(trip.patientLat === 0 && trip.patientLng === 0)) {
        const patientIcon = L.divIcon({
          html: `
            <div style="
              background: #1b6fba;
              border: 2px solid white;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 8px rgba(27, 111, 186, 0.45);
            ">
              <span style="color: white; font-size: 14px;">📍</span>
            </div>
          `,
          className: "custom-patient-dest-icon",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const patMarker = L.marker([trip.patientLat, trip.patientLng], { icon: patientIcon }).addTo(group);
        patMarker.bindTooltip(`
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
            <b style="color: #1b6fba;">📍 Patient Destination</b><br/>
            <b>${trip.patientName}</b><br/>
            Service: ${trip.service || "Home Care Visit"}<br/>
            Status: Awaiting Clinician
          </div>
        `);
      }

      // b) Plot provider's vehicle/marker in green
      if (!isNaN(trip.providerLat) && !isNaN(trip.providerLng) && !(trip.providerLat === 0 && trip.providerLng === 0)) {
        const vehicleIcon = L.divIcon({
          html: `
            <div class="animate-pulse" style="
              background: #16a34a;
              border: 2.5px solid white;
              border-radius: 50%;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(22, 163, 74, 0.5);
            ">
              <span style="color: white; font-size: 15px;">🚗</span>
            </div>
          `,
          className: "custom-provider-vehicle-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const provMarker = L.marker([trip.providerLat, trip.providerLng], { icon: vehicleIcon }).addTo(group);
        provMarker.bindTooltip(`
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
            <b style="color: #16a34a;">🩺 Clinician En Route</b><br/>
            <b>${trip.providerName}</b><br/>
            Destination: ${trip.patientName}<br/>
            ETA: ~${trip.etaMinutes ?? 5} min (${trip.distanceKm ?? 1.8} km)
          </div>
        `);
      }

      // c) Draw polyline connecting provider to patient
      const pts: Array<[number, number]> =
        trip.routePoints && trip.routePoints.length >= 2
          ? trip.routePoints
          : [
              [trip.providerLat, trip.providerLng],
              [trip.patientLat, trip.patientLng],
            ];

      if (routesGroupRef.current) {
        L.polyline(pts, {
          color: "#16a34a",
          weight: 4.5,
          opacity: 0.9,
        }).addTo(routesGroupRef.current);
      }
    });

    // 4. Render Route Polyline for On-Demand Dispatch OR Emergency (fallback)
    if (onTheWayTrips.length === 0) {
      if (activeDispatch && activeDispatch.routePoints && activeDispatch.routePoints.length > 1) {
        const isAccepted = activeDispatch.status === "accepted" || activeDispatch.status === "on_the_way";
        const routeLine = L.polyline(activeDispatch.routePoints, {
          color: isAccepted ? "#0d7c6a" : "#0284c7",
          weight: 4.5,
          dashArray: isAccepted ? undefined : "6, 8",
          opacity: 0.9,
        }).addTo(map);

        routeLineRef.current = routeLine;
        setRouteInfo(null);
      } else {
        const activeEmergency = filtered.find(p => p.role === "patient" && p.status === "critical");
        const closestProvider = filtered.find(p => p.role === "provider" && p.status === "available");

        if (activeEmergency && closestProvider) {
          const eCoords: [number, number] = [activeEmergency.y, activeEmergency.x];
          const pCoords: [number, number] = [closestProvider.y, closestProvider.x];

          const routeLine = L.polyline([pCoords, eCoords], {
            color: "#dc2626",
            weight: 4,
            dashArray: "6, 10",
            opacity: 0.8,
          }).addTo(map);

          routeLineRef.current = routeLine;

          const distInfo = api.getRoute(pCoords[0], pCoords[1], eCoords[0], eCoords[1]);
          Promise.resolve(distInfo).then(res => setRouteInfo(res));
        } else {
          setRouteInfo(null);
        }
      }
    }
  }, [locations, filter, activeDispatch, activeTrips]);

  const filteredPins = locations.filter(loc => {
    if (loc.status === "offline" || loc.isOnline === false) return false;
    if (filter === "providers") return loc.role === "provider";
    if (filter === "patients") return loc.role === "patient";
    return true;
  });

  const mapHeight = compact ? 280 : 640;

  return (
    <div className={`flex gap-4 ${compact ? "flex-col md:flex-row" : "flex-col lg:flex-row"}`}>
      {/* Map canvas */}
      <div
        className="flex-1 relative rounded-[14px] overflow-hidden border border-[#c8d6e2] dark:border-slate-700 bg-[#dde6ef] shadow-sm"
        style={{ minHeight: `${mapHeight}px`, height: compact ? `${mapHeight}px` : "calc(100vh - 210px)" }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* City label */}
        <div className="absolute top-2.5 left-2.5 z-[400] text-[11px] text-[#0d7c6a] dark:text-cyan-400 font-bold bg-white/95 dark:bg-slate-800/90 px-3 py-1.5 rounded-[8px] backdrop-blur-sm shadow-sm border border-[#e2e8ee] dark:border-slate-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0d7c6a] animate-pulse" />
          Addis Ababa, Ethiopia
        </div>

        {/* On-The-Way Live Trip Monitoring ("God's Eye" Floating Status Card) */}
        {activeTrips.filter(t => t.status === "on_the_way").length > 0 ? (
          <div className="absolute top-12 left-2.5 z-[400] space-y-2 max-w-xs md:max-w-sm pointer-events-auto">
            {activeTrips.filter(t => t.status === "on_the_way").map((trip) => (
              <div
                key={trip.id || trip.appointmentId}
                className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-[12px] shadow-xl p-3 border border-[#16a34a]/40 ring-1 ring-[#16a34a]/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#16a34a] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-ping" />
                    Live Fleet Navigation
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    ON THE WAY
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 dark:bg-green-500/20 text-[#16a34a] flex items-center justify-center text-base shrink-0 border border-green-500/20">
                    🚗
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#18232e] dark:text-white leading-snug">
                      {trip.providerName} en route to {trip.patientName} • ETA {trip.etaMinutes ?? 5} min
                    </p>
                    <p className="text-[11px] text-[#5a7a96] dark:text-slate-400 mt-0.5">
                      Distance: {trip.distanceKm ?? 1.8} km • Service: {trip.service || "Home Care"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeDispatch && (
          <div className="absolute top-10 left-2 z-[400] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-[10px] shadow-lg p-2.5 border border-[#0d7c6a]/30 max-w-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#0d7c6a]">
                <span className="w-2 h-2 rounded-full bg-[#0d7c6a] animate-pulse" />
                ON-DEMAND DISPATCH
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                {activeDispatch.status === "searching" ? "Matching (30s)" : "Clinician En Route"}
              </span>
            </div>
            <p className="text-xs font-bold text-[#18232e] dark:text-white mt-1 truncate">
              {activeDispatch.providerName || "Assigned Clinician"}
            </p>
            <p className="text-[11px] text-[#5a7a96] dark:text-slate-300">
              ETA: ~{activeDispatch.etaMinutes ?? 5} min ({activeDispatch.distanceKm ?? 1.2} km)
            </p>
          </div>
        )}

        {/* WebSocket Connection State */}
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

        {/* Count indicators (Strictly active & online) */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Online Providers", count: filteredPins.filter(p => p.role === "provider").length, color: "#0d7c6a" },
            { label: "Active Patients", count: filteredPins.filter(p => p.role === "patient").length, color: "#1b6fba" },
            { label: "Emergencies", count: filteredPins.filter(p => p.status === "critical").length, color: "#dc2626" },
            { label: "Total Active", count: filteredPins.length, color: "#0284c7" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[8px] px-2 py-1.5 text-center shadow-xs">
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[9px] text-[#8a9aaa] dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pin list (Priority sorted - Emergencies first, Online Only) */}
        {loading ? (
          <div className="text-center py-5 text-xs text-[#8a9aaa]">Loading pins...</div>
        ) : error ? (
          <div className="text-center py-5 text-xs text-red-500">{error}</div>
        ) : filteredPins.length === 0 ? (
          <div className="text-center py-8 px-2 text-xs text-[#8a9aaa] bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[8px]">
            No online providers or active patients currently broadcasting GPS.
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: compact ? 130 : "calc(100vh - 430px)", minHeight: compact ? 120 : 320 }}>
            {filteredPins.map(pin => {
              const meta = STATUS_META[pin.status] || { label: pin.status, color: "#16a34a" };
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
                    {(pin.name || (pin.userId ? `U-${pin.userId}` : "MC")).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-[#18232e] dark:text-white truncate">{pin.name || `User ${pin.userId || pin.id}`}</p>
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
        <p className="text-sm text-[#8a9aaa] mt-0.5">Real-time tracking across Addis Ababa · Genuine GPS feed</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-[#4a5a6a] dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#0d7c6a] rounded-full inline-block" /> Provider</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#1b6fba] rounded-full inline-block" /> Patient</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-3 h-3 bg-[#dc2626] rounded-full inline-block animate-ping" /> Emergency Alert</span>
          </div>
        </div>
        <AdminMapView />
      </div>
    </div>
  );
}
