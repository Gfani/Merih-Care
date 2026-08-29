import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Reports from "./Reports";
import { api } from "../services/api";

describe("Admin Web - Reports & Export Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getDashboardStats").mockResolvedValue({
      weeklyRequestsData: [{ day: "Mon", requests: 12 }],
      revenueData: [{ month: "Aug", revenue: 45000 }],
      serviceDistribution: [{ name: "Nursing", value: 40 }],
      providerEarningsData: [{ provider: "Dr. Meron", earnings: 15000 }],
    });
  });

  it("should render reports and analytics dashboard", async () => {
    render(<Reports />);

    await waitFor(() => {
      expect(screen.getByText(/User Growth/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Export PDF/i })).toBeInTheDocument();
  });

  it("should trigger export PDF when export button is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<Reports />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Export PDF/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /Export PDF/i });
    fireEvent.click(exportBtn);

    expect(printSpy).toHaveBeenCalled();
  });
});
