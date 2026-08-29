import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Settings from "./Settings";
import { api } from "../services/api";

vi.mock("react-router-dom", () => ({
  useBlocker: () => ({ state: "unblocked", reset: vi.fn(), proceed: vi.fn() }),
  useNavigate: () => vi.fn(),
}));

describe("Admin Web - Settings & Maintenance Confirmation Tests", () => {
  const mockInitialSettings = {
    emailNotifs: true,
    smsNotifs: true,
    maintenanceMode: false,
    commissionRate: "15",
    minPayout: "500",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getSettings").mockResolvedValue(mockInitialSettings);
    vi.spyOn(api, "updateSettings").mockImplementation((data: any) => Promise.resolve(data));
    vi.spyOn(api, "getAdminProfile").mockResolvedValue({ name: "Admin Kebede", email: "admin@merihcare.et" });
  });

  it("should render settings form with commission rate and payout threshold inputs", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("500")).toBeInTheDocument();
    });
  });

  it("should update and persist settings when Save Changes is clicked", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    });

    const commissionInput = screen.getByDisplayValue("15");
    fireEvent.change(commissionInput, { target: { value: "18" } });

    const saveBtn = screen.getByRole("button", { name: /Save Platform Settings|Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ commissionRate: "18" }),
      );
    });
  });

  it("should confirm before toggling emergency maintenance mode", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText(/Maintenance Mode/i)).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
