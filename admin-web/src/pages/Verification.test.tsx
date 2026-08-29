import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Verification from "./Verification";
import { api } from "../services/api";

describe("Admin Web - Provider Verification Tests", () => {
  const mockProvidersList = [
    {
      id: "p-pending-1",
      name: "Dr. Bereket Solomon",
      email: "bereket@merihcare.et",
      title: "General Practitioner",
      verified: false,
      status: "pending",
      date: "2026-08-28",
      documents: [{ name: "Medical License", type: "license", status: "submitted", url: "/docs/license.pdf" }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("admin_user", JSON.stringify({ email: "admin@merihcare.et", adminRole: "super_admin" }));
    vi.spyOn(api, "getProviders").mockResolvedValue(mockProvidersList);
    vi.spyOn(api, "getPendingAdmins").mockResolvedValue([]);
    vi.spyOn(api, "approveProvider").mockResolvedValue({ id: "p-pending-1", verified: true, status: "verified" });
    vi.spyOn(api, "rejectProvider").mockResolvedValue({ id: "p-pending-1", verified: false, status: "rejected" });
  });

  it("should render verification queue with pending provider records", async () => {
    render(<Verification />);

    const elements = await screen.findAllByText(/Dr. Bereket Solomon/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getAllByText("General Practitioner").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Approve/i }).length).toBeGreaterThan(0);
  });

  it("should open approve modal and approve provider", async () => {
    render(<Verification />);

    await screen.findAllByText(/Dr. Bereket Solomon/i);

    const approveButtons = screen.getAllByRole("button", { name: /Approve/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/You are approving Dr. Bereket Solomon/i)).toBeInTheDocument();
    });

    const modalApproveBtn = screen.getAllByRole("button", { name: /Approve/i });
    fireEvent.click(modalApproveBtn[modalApproveBtn.length - 1]);

    await waitFor(() => {
      expect(api.approveProvider).toHaveBeenCalledWith("p-pending-1");
    });
  });

  it("should open rejection modal and submit reason when Reject is clicked", async () => {
    render(<Verification />);

    await screen.findAllByText(/Dr. Bereket Solomon/i);

    const rejectBtn = screen.getByRole("button", { name: /Reject/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please specify the reason for rejection/i)).toBeInTheDocument();
    });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "License registration expired" } });

    const submitRejectBtn = screen.getByRole("button", { name: /Reject Verification/i });
    fireEvent.click(submitRejectBtn);

    await waitFor(() => {
      expect(api.rejectProvider).toHaveBeenCalledWith("p-pending-1", "License registration expired");
    });
  });
});
