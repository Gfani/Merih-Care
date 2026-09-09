import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import Login from "./Login";
import { api } from "../services/api";
import { AuthProvider } from "../context/AuthContext";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

describe("Admin Web - Login & Redirect Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should render login form with email and password inputs", () => {
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );
    expect(screen.getByPlaceholderText("fanuelgoitom79@gmail.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign In$/i })).toBeInTheDocument();
  });

  it("should successfully log in and invoke onLogin callback on valid credentials", async () => {
    const onLogin = vi.fn();
    vi.spyOn(api, "login").mockResolvedValue({
      access_token: "mock-valid-token",
      user: { name: "Super Admin", email: "admin@merihcare.et" },
    });

    render(
      <AuthProvider>
        <Login onLogin={onLogin} />
      </AuthProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("fanuelgoitom79@gmail.com"), {
      target: { value: "admin@merihcare.et" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "Admin123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("admin@merihcare.et", "Admin123!");
      expect(onLogin).toHaveBeenCalled();
    });
  });

  it("should handle error when login fails", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("fanuelgoitom79@gmail.com"), {
      target: { value: "wrong@merihcare.et" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "WrongPassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("wrong@merihcare.et", "WrongPassword");
    });
  });
});
