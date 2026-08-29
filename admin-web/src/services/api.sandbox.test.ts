import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./api";
import axios from "axios";

describe("Admin Web - Sandbox / Live Mode & API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Sandbox vs Live Mode Behavior", () => {
    it("should return false for isDemoMode by default or when demo_mode is 'false'", () => {
      expect(api.isDemoMode()).toBe(false);
      localStorage.setItem("demo_mode", "false");
      expect(api.isDemoMode()).toBe(false);
    });

    it("should return true for isDemoMode when demo_mode is 'true'", () => {
      localStorage.setItem("demo_mode", "true");
      expect(api.isDemoMode()).toBe(true);
    });

    it("should fallback to mock data when in sandbox mode and API fails", async () => {
      localStorage.setItem("demo_mode", "true");
      vi.spyOn(axios, "get").mockRejectedValue(new Error("Network Error"));

      const users = await api.getUsers();
      expect(users).toBeDefined();
      expect(users.length).toBeGreaterThan(0);
    });

    it("should throw error in live mode when backend network fails", async () => {
      localStorage.setItem("demo_mode", "false");
      vi.spyOn(axios, "get").mockRejectedValue(new Error("Connection refused"));

      await expect(api.getUsers()).rejects.toThrow("Connection refused");
    });
  });

  describe("Session Expiration & Logout", () => {
    it("should clear localStorage tokens and user info on logout", () => {
      localStorage.setItem("admin_token", "jwt-token-123");
      localStorage.setItem("admin_user", JSON.stringify({ name: "Admin" }));

      api.logout();

      expect(localStorage.getItem("admin_token")).toBeNull();
      expect(localStorage.getItem("admin_user")).toBeNull();
    });
  });

  describe("Retry & Network Resilience", () => {
    it("should successfully retrieve data on retry attempt", async () => {
      localStorage.setItem("demo_mode", "false");

      // First call fails, second call succeeds
      vi.spyOn(axios, "get")
        .mockRejectedValueOnce(new Error("Transient 503"))
        .mockResolvedValueOnce({ data: [{ id: "u-1", name: "Recovered User" }] });

      const attemptFetch = async (retries = 2): Promise<any> => {
        try {
          return await api.getUsers();
        } catch (err) {
          if (retries > 1) return await attemptFetch(retries - 1);
          throw err;
        }
      };

      const result = await attemptFetch();
      expect(result).toEqual([{ id: "u-1", name: "Recovered User" }]);
    });
  });
});
