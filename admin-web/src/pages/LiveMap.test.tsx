import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { AdminMapView } from "./LiveMap";
import { api } from "../services/api";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ token: "mock-admin-token" }),
}));

// Mock useRealtimeSocket
let socketHandlers: Record<string, (payload: any) => void> = {};
vi.mock("../hooks/useRealtimeSocket", () => ({
  useRealtimeSocket: () => ({
    isLive: true,
    connectionState: "connected",
    on: (evt: string, cb: any) => {
      socketHandlers[evt] = cb;
    },
    off: (evt: string) => {
      delete socketHandlers[evt];
    },
    emit: vi.fn(),
  }),
}));

// Mock leaflet DOM methods if jsdom does not support canvas/SVG
vi.mock("leaflet", () => {
  const layerGroupMock = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  };

  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getZoom: vi.fn().mockReturnValue(13),
    remove: vi.fn(),
  };

  return {
    default: {
      map: vi.fn(() => mapMock),
      control: {
        zoom: vi.fn(() => ({ addTo: vi.fn() })),
      },
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => layerGroupMock),
      divIcon: vi.fn(() => ({})),
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        setLatLng: vi.fn().mockReturnThis(),
      })),
      polyline: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
        setLatLngs: vi.fn(),
      })),
      latLngBounds: vi.fn((coords: any) => ({
        isValid: vi.fn(() => Array.isArray(coords) && coords.length > 0),
      })),
    },
  };
});

describe("Admin Web - LiveMap Strict Online GPS Tracking Tests", () => {
  const mockLocationsData = [
    {
      id: "p-online-1",
      userId: "u-p1",
      name: "Dr. Meron Alemu",
      role: "provider",
      status: "available",
      isOnline: true,
      x: 38.74689,
      y: 9.02497,
    },
    {
      id: "p-offline-2",
      userId: "u-p2",
      name: "Dr. Offline Clinician",
      role: "provider",
      status: "offline",
      isOnline: false,
      x: 38.75000,
      y: 9.02000,
    },
    {
      id: "pat-online-3",
      userId: "u-pat1",
      name: "Abebe Patient",
      role: "patient",
      status: "available",
      isOnline: true,
      x: 38.76000,
      y: 9.03000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers = {};
    vi.spyOn(api, "getLocations").mockResolvedValue(mockLocationsData as any);
  });

  it("should render online providers and patients, and strictly exclude offline providers", async () => {
    render(<AdminMapView />);

    await waitFor(() => {
      // Dr. Meron Alemu (online) should be present
      expect(screen.getByText("Dr. Meron Alemu")).toBeInTheDocument();
      // Abebe Patient (online) should be present
      expect(screen.getByText("Abebe Patient")).toBeInTheDocument();
    });

    // Dr. Offline Clinician MUST NOT exist in the DOM
    expect(screen.queryByText("Dr. Offline Clinician")).not.toBeInTheDocument();
  });

  it("should dynamically drop provider when receiving provider_offline WebSocket event", async () => {
    render(<AdminMapView />);

    await waitFor(() => {
      expect(screen.getByText("Dr. Meron Alemu")).toBeInTheDocument();
    });

    // Simulate provider turning offline via WebSocket broadcast
    act(() => {
      if (socketHandlers["provider_offline"]) {
        socketHandlers["provider_offline"]({ providerId: "u-p1" });
      }
    });

    // Dr. Meron Alemu should immediately be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText("Dr. Meron Alemu")).not.toBeInTheDocument();
    });
  });

  it("should remove provider when receiving location_update with status: offline", async () => {
    render(<AdminMapView />);

    await waitFor(() => {
      expect(screen.getByText("Dr. Meron Alemu")).toBeInTheDocument();
    });

    // Simulate location_update indicating provider went offline
    act(() => {
      if (socketHandlers["location_update"]) {
        socketHandlers["location_update"]({
          data: { providerId: "u-p1", status: "offline", isOnline: false },
        });
      }
    });

    await waitFor(() => {
      expect(screen.queryByText("Dr. Meron Alemu")).not.toBeInTheDocument();
    });
  });

  it("should dynamically drop active patient when receiving patient_offline WebSocket event", async () => {
    render(<AdminMapView />);

    await waitFor(() => {
      expect(screen.getByText("Abebe Patient")).toBeInTheDocument();
    });

    // Simulate patient disconnecting via WebSocket broadcast
    act(() => {
      if (socketHandlers["patient_offline"]) {
        socketHandlers["patient_offline"]({ patientId: "u-pat1" });
      }
    });

    // Abebe Patient should immediately be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText("Abebe Patient")).not.toBeInTheDocument();
    });
  });

  it("should dynamically display new active patient upon location_update event", async () => {
    render(<AdminMapView />);

    await waitFor(() => {
      expect(screen.getByText("Abebe Patient")).toBeInTheDocument();
    });

    // New active patient broadcasts location
    act(() => {
      if (socketHandlers["location_update"]) {
        socketHandlers["location_update"]({
          data: {
            userId: "u-pat2",
            name: "Bethlehem Patient",
            role: "patient",
            targetRole: "patient",
            status: "available",
            isOnline: true,
            lat: 9.035,
            lng: 38.755,
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Bethlehem Patient")).toBeInTheDocument();
    });
  });

  it("should render active tasks and dispatches when loaded from getActiveDispatches", async () => {
    vi.spyOn(api, "getActiveDispatches").mockResolvedValue([
      {
        id: "disp-101",
        appointmentId: "disp-101",
        status: "on_the_way",
        service: "Elderly Physiotherapy",
        patientName: "Tigist Bekele",
        patientLat: 9.025,
        patientLng: 38.748,
        providerName: "Nurse Aster Kebede",
        providerLat: 9.019,
        providerLng: 38.752,
        etaMinutes: 7,
        distanceKm: 2.1,
      },
    ] as any);

    render(<AdminMapView />);

    await waitFor(() => {
      expect(screen.getByText("Tigist Bekele")).toBeInTheDocument();
      expect(screen.getByText("Clinician: Nurse Aster Kebede")).toBeInTheDocument();
      expect(screen.getByText("ON THE WAY")).toBeInTheDocument();
    });
  });

  it("should update active task dynamically via dispatch_update socket event", async () => {
    render(<AdminMapView />);

    act(() => {
      if (socketHandlers["dispatch_update"]) {
        socketHandlers["dispatch_update"]({
          data: {
            appointmentId: "disp-202",
            status: "searching",
            service: "Emergency Cardiology",
            patientName: "Kassahun Haile",
            patientLat: 9.030,
            patientLng: 38.740,
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Kassahun Haile")).toBeInTheDocument();
      expect(screen.getByText("SEARCHING")).toBeInTheDocument();
    });
  });
});

