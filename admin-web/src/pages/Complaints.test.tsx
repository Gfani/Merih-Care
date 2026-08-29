import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Complaints from "./Complaints";
import { api } from "../services/api";

describe("Admin Web - Complaints Resolution Tests", () => {
  const mockComplaintsList = [
    {
      id: "comp-1",
      userName: "Selamawit Tadesse",
      userRole: "patient",
      subject: "Late Arrival",
      priority: "high",
      status: "open",
      createdAt: "2026-08-25",
    },
    {
      id: "comp-2",
      userName: "Dawit Haile",
      userRole: "patient",
      subject: "Billing Discrepancy",
      priority: "low",
      status: "resolved",
      createdAt: "2026-08-22",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("admin_user", JSON.stringify({ role: "super_admin" }));
    vi.spyOn(api, "getComplaints").mockResolvedValue(mockComplaintsList);
    vi.spyOn(api, "resolveComplaint").mockResolvedValue({ id: "comp-1", status: "resolved" });
  });

  it("should render complaints list with items", async () => {
    render(<Complaints />);

    await waitFor(() => {
      expect(screen.getAllByText("Late Arrival").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Billing Discrepancy").length).toBeGreaterThan(0);
    });
  });

  it("should filter complaints by status dropdown", async () => {
    render(<Complaints />);

    await waitFor(() => {
      expect(screen.getAllByText("Late Arrival").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Billing Discrepancy").length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[0];
    fireEvent.change(statusSelect, { target: { value: "open" } });

    await waitFor(() => {
      expect(screen.getAllByText("Late Arrival").length).toBeGreaterThan(0);
      expect(screen.queryByText("Billing Discrepancy")).not.toBeInTheDocument();
    });
  });

  it("should open review modal when Review button is clicked and mark complaint as resolved", async () => {
    render(<Complaints />);

    await waitFor(() => {
      expect(screen.getAllByText("Late Arrival").length).toBeGreaterThan(0);
    });

    const reviewButtons = screen.getAllByRole("button", { name: /^Review$/i });
    expect(reviewButtons.length).toBeGreaterThan(0);
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Mark Resolved$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Mark Resolved$/i }));

    await waitFor(() => {
      expect(api.resolveComplaint).toHaveBeenCalledWith("comp-1");
    });
  });
});
