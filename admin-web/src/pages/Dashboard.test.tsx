import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import DashboardSection from "./Dashboard";
import { api } from "../services/api";
import { BrowserRouter } from "react-router-dom";

// Track current auth state in tests
let mockAuthUser: any = null;

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    token: "mock-token",
    user: mockAuthUser,
  }),
}));

vi.mock("../hooks/useRealtimeSocket", () => ({
  useRealtimeSocket: () => ({
    isLive: true,
    connectionState: "connected",
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    joinRoom: vi.fn(),
  }),
}));

vi.mock("./LiveMap", () => ({
  AdminMapView: () => <div data-testid="mock-admin-map">Mock Map View</div>,
}));

// Mock recharts ResponsiveContainer to render children
vi.mock("recharts", async () => {
  const original = await vi.importActual<any>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 200 }}>{children}</div>,
  };
});

describe("Admin Web - Dashboard Revenue Visibility & Role Restrictions", () => {
  const mockStats = {
    kpis: {
      totalPatients: 1420,
      totalProviders: 85,
      activeRequests: 19,
      totalRevenue: 285400,
    },
    weeklyRequestsData: [
      { day: "Mon", requests: 20, completed: 18 },
      { day: "Tue", requests: 35, completed: 30 },
    ],
    revenueData: [
      { month: "Jan", revenue: 80000 },
      { month: "Feb", revenue: 95000 },
    ],
    serviceDistribution: [
      { name: "General Care", value: 45 },
      { name: "Nursing", value: 30 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getDashboardStats").mockResolvedValue(mockStats as any);
    vi.spyOn(api, "getAuditLogs").mockResolvedValue([]);
    vi.spyOn(api, "getNotifications").mockResolvedValue([]);
    vi.spyOn(api, "getVerificationQueue").mockResolvedValue([]);
  });

  it("should hide Revenue StatCard and Revenue Trend chart from normal administrator", async () => {
    mockAuthUser = {
      id: "admin-1",
      email: "support@merihcare.et",
      role: "admin",
      adminRole: "operations_admin",
    };

    render(
      <BrowserRouter>
        <DashboardSection />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Total Patients")).toBeInTheDocument();
      expect(screen.getByText("Total Providers")).toBeInTheDocument();
      expect(screen.getByText("Active Requests")).toBeInTheDocument();
      expect(screen.getByText("Weekly Requests")).toBeInTheDocument();
    });

    // Revenue card and Trend chart must be strictly omitted from the DOM
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Platform earnings")).not.toBeInTheDocument();
    expect(screen.queryByText(/285,400/)).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue Trend")).not.toBeInTheDocument();
  });

  it("should render Revenue StatCard and Revenue Trend chart for super_admin", async () => {
    mockAuthUser = {
      id: "super-1",
      email: "superadmin@merihcare.et",
      role: "super_admin",
      adminRole: "super_admin",
    };

    render(
      <BrowserRouter>
        <DashboardSection />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Total Patients")).toBeInTheDocument();
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.getByText("Platform earnings")).toBeInTheDocument();
      expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
      expect(screen.getByText(/285,400/)).toBeInTheDocument();
    });
  });

  it("should render Revenue StatCard and Revenue Trend chart for supreme owner", async () => {
    mockAuthUser = {
      id: "owner-1",
      email: "owner@merihcare.et",
      role: "owner",
      adminRole: "owner",
    };

    render(
      <BrowserRouter>
        <DashboardSection />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.getByText("Platform earnings")).toBeInTheDocument();
      expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
      expect(screen.getByText(/285,400/)).toBeInTheDocument();
    });
  });
});
