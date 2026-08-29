import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import Login from "./Login";
import { api } from "../services/api";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

describe("Admin Web - Login & Redirect Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render login form with email and password inputs", () => {
    render(<Login />);
    expect(screen.getByPlaceholderText("admin@merihcare.et")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign In$/i })).toBeInTheDocument();
  });

  it("should successfully log in and invoke onLogin callback on valid credentials", async () => {
    const onLogin = vi.fn();
    vi.spyOn(api, "login").mockResolvedValue({
      access_token: "mock-valid-token",
      user: { name: "Super Admin", email: "admin@merihcare.et" },
    });

    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText("admin@merihcare.et"), {
      target: { value: "admin@merihcare.et" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "Admin123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("admin@merihcare.et", "Admin123!");
      expect(onLogin).toHaveBeenCalled();
    });
  });

  it("should handle error when login fails", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText("admin@merihcare.et"), {
      target: { value: "wrong@merihcare.et" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "WrongPassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("wrong@merihcare.et", "WrongPassword");
    });
  });
});
