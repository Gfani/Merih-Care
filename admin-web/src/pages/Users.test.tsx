import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Users from "./Users";
import { api } from "../services/api";

describe("Admin Web - Users Management & Suspend/Restore Tests", () => {
  const mockPatientsList = [
    { id: "u-1", name: "Tigist Bekele", email: "tigist@merihcare.et", phone: "+251911000000", status: "active", createdAt: "2026-08-20" },
    { id: "u-2", name: "Dawit Haile", email: "dawit@merihcare.et", phone: "+251922000000", status: "suspended", createdAt: "2026-08-21" },
  ];
  const mockProvidersList = [
    { id: "p-1", name: "Dr. Meron Alemu", email: "meron@merihcare.et", phone: "+251933000000", status: "verified", createdAt: "2026-08-19" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getUsers").mockResolvedValue(mockPatientsList);
    vi.spyOn(api, "getProviders").mockResolvedValue(mockProvidersList);
    vi.spyOn(api, "toggleUserSuspension").mockImplementation((id: string, currentStatus: string) => {
      return Promise.resolve({ id, status: currentStatus === "active" ? "suspended" : "active" });
    });
  });

  it("should render users table with correct patient and provider records", async () => {
    render(<Users />);

    await waitFor(() => {
      expect(screen.getAllByText("Tigist Bekele").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Dawit Haile").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Dr. Meron Alemu").length).toBeGreaterThan(0);
    });

    expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument();
  });

  it("should filter users by search input keyword", async () => {
    render(<Users />);

    await waitFor(() => {
      expect(screen.getAllByText("Tigist Bekele").length).toBeGreaterThan(0);
    });

    const searchInput = screen.getByPlaceholderText(/search users/i);
    fireEvent.change(searchInput, { target: { value: "Dawit" } });

    expect(screen.getAllByText("Dawit Haile").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tigist Bekele")).not.toBeInTheDocument();
  });

  it("should open suspension confirm dialog and toggle user status", async () => {
    render(<Users />);

    await waitFor(() => {
      expect(screen.getAllByText("Tigist Bekele").length).toBeGreaterThan(0);
    });

    const actionButtons = screen.getAllByRole("button", { name: /^Suspend$/i });
    expect(actionButtons.length).toBeGreaterThan(0);

    fireEvent.click(actionButtons[0]);

    // Modal appears with confirmation message
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to suspend Tigist Bekele/i)).toBeInTheDocument();
    });

    const modalConfirmBtns = screen.getAllByRole("button", { name: /^Suspend$/i });
    fireEvent.click(modalConfirmBtns[modalConfirmBtns.length - 1]);

    await waitFor(() => {
      expect(api.toggleUserSuspension).toHaveBeenCalledWith("u-1", "active");
    });
  });

  it("should render accessible table with responsive container", async () => {
    const { container } = render(<Users />);

    await waitFor(() => {
      expect(screen.getAllByText("Tigist Bekele").length).toBeGreaterThan(0);
    });

    const overflowContainer = container.querySelector(".overflow-x-auto");
    expect(overflowContainer).toBeInTheDocument();
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
