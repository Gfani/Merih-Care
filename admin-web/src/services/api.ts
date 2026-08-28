import axios from "axios";
import { 
  providers as mockProviders,
  patients as mockPatients,
  appointments as mockAppointments,
  complaints as mockComplaints,
  reviews as mockReviews,
  serviceCategories as mockServices,
  serviceRequests as mockRequests,
  auditLogs as mockLogs,
  weeklyRequestsData,
  revenueData,
  serviceDistribution,
  providerEarningsData,
  transactions as mockTransactions
} from "../data/mock";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

const getHeaders = () => {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

const isDemoMode = () => {
  const stored = localStorage.getItem("demo_mode");
  return stored === null ? true : stored === "true";
};

export const api = {
  // ─── AUTH ──────────────────────────────────────────────────────────────────
  async login(email: string, pass: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
      localStorage.setItem("admin_token", res.data.access_token);
      localStorage.setItem("admin_user", JSON.stringify(res.data.user));
      return res.data;
    } catch (error) {
      console.warn("API login failed, checking fallback credentials:", error);
      if (isDemoMode() && email === "admin@merihcare.et" && pass === "admin123") {
        localStorage.setItem("admin_token", "mock-token-xyz");
        localStorage.setItem("admin_user", JSON.stringify({ name: "Admin Kebede", email }));
        return { access_token: "mock-token-xyz", user: { name: "Admin Kebede" } };
      }
      throw error;
    }
  },

  async signup(name: string, email: string, pass: string, dept: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password: pass, department: dept });
      return res.data;
    } catch (error) {
      console.warn("API signup failed, falling back to mock behavior:", error);
      if (isDemoMode()) {
        return { success: true };
      }
      throw error;
    }
  },

  logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  },

  // ─── PATIENTS / USERS ──────────────────────────────────────────────────────
  async getUsers(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockPatients;
      }
      throw error;
    }
  },

  async toggleUserSuspension(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/users/${id}/suspend`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status: currentStatus === "active" ? "suspended" : "active" };
      }
      throw error;
    }
  },

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────
  async getProviders(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/providers`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockProviders;
      }
      throw error;
    }
  },

  async toggleProviderSuspension(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/providers/${id}/suspend`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status: currentStatus === "active" ? "suspended" : "active" };
      }
      throw error;
    }
  },

  // ─── VERIFICATIONS ─────────────────────────────────────────────────────────────
  async getVerificationQueue(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/verification`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockProviders.filter(p => !p.verified);
      }
      throw error;
    }
  },

  async approveProvider(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/verification/${id}/approve`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, verified: true, status: "verified" };
      }
      throw error;
    }
  },

  async rejectProvider(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/verification/${id}/reject`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, verified: false, status: "rejected" };
      }
      throw error;
    }
  },

  async getPendingAdmins(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/admin/users/pending`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "u-pending-1", name: "Operations Coordinator", email: "ops.coord@merihcare.et", adminRole: "operations_admin", dateJoined: "2026-08-27" },
          { id: "u-pending-2", name: "Finance Officer", email: "finance.off@merihcare.et", adminRole: "finance_admin", dateJoined: "2026-08-27" }
        ];
      }
      throw error;
    }
  },

  async approveAdminAccount(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/admin/users/${id}/approve`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, isApproved: true };
      }
      throw error;
    }
  },

  // ─── SERVICES ──────────────────────────────────────────────────────────────
  async getServices(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/services`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockServices;
      }
      throw error;
    }
  },

  async toggleService(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/services/${id}/toggle`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status: currentStatus === "active" ? "closed" : "active" };
      }
      throw error;
    }
  },

  // ─── APPOINTMENTS ──────────────────────────────────────────────────────────
  async getAppointments(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/appointments`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockAppointments;
      }
      throw error;
    }
  },

  // ─── COMPLAINTS ────────────────────────────────────────────────────────────
  async getComplaints(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/complaints`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockComplaints;
      }
      throw error;
    }
  },

  async resolveComplaint(id: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/complaints/${id}/resolve`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status: "resolved" };
      }
      throw error;
    }
  },

  // ─── REVIEWS ───────────────────────────────────────────────────────────────
  async getReviews(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/reviews`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockReviews;
      }
      throw error;
    }
  },

  async moderateReview(id: string, status: "published" | "hidden" | "flagged"): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/reviews/${id}/moderate`, { status }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status };
      }
      throw error;
    }
  },

  // ─── EMERGENCY ─────────────────────────────────────────────────────────────
  async getEmergencies(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/emergency`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "EM-001", patient: "Frehiwot Solomon", location: "Piazza, Addis Ababa", time: "10:22 AM", status: "active", severity: "High" },
          { id: "EM-002", patient: "Dawit Haile", location: "Kazanchis, Addis Ababa", time: "09:55 AM", status: "assigned", severity: "Medium" },
        ];
      }
      throw error;
    }
  },

  async dispatchEmergency(id: string, responder: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/emergency/${id}/dispatch`, { responder }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, status: "dispatched", responder };
      }
      throw error;
    }
  },

  // ─── MAP TRACKING (LOCATIONS) ──────────────────────────────────────────────
  async getLocations(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/locations`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "pin1", name: "Dr. Meron Alemu (GP)", role: "provider", x: 42, y: 35, status: "available" },
          { id: "pin2", name: "Hiwot Girma (Nurse)", role: "provider", x: 55, y: 48, status: "available" },
          { id: "pin3", name: "Yonas Tekeste (Physio)", role: "provider", x: 28, y: 62, status: "busy" },
          { id: "pin4", name: "Bereket Haile (Lab Tech)", role: "provider", x: 68, y: 25, status: "available" },
          { id: "pin5", name: "Critical Heart Alert (Abebe K.)", role: "patient", x: 40, y: 32, status: "critical" },
          { id: "pin6", name: "Moderate Asthma (Marta S.)", role: "patient", x: 53, y: 46, status: "busy" },
        ];
      }
      throw error;
    }
  },

  async updateLocation(id: string, x: number, y: number): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/locations/${id}/move`, { x, y }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { id, x, y };
      }
      throw error;
    }
  },

  // ─── PLATFORM SETTINGS ─────────────────────────────────────────────────────
  async getSettings(): Promise<any> {
    try {
      const res = await axios.get(`${API_URL}/settings`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return {
          emailNotifs: true,
          smsNotifs: true,
          maintenanceMode: false,
          commissionRate: "15",
          minPayout: "500"
        };
      }
      throw error;
    }
  },

  async updateSettings(data: any): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/settings`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return data;
      }
      throw error;
    }
  },

  // ─── ADMIN PROFILE & PASSWORD ──────────────────────────────────────────────
  async getAdminProfile(): Promise<any> {
    try {
      const res = await axios.get(`${API_URL}/admin/profile`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { name: "Admin Kebede", email: "admin@merihcare.et" };
      }
      throw error;
    }
  },

  async updateAdminProfile(name: string, email: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/admin/profile`, { name, email }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { name, email };
      }
      throw error;
    }
  },

  async updateAdminPassword(currentPass: string, newPass: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/admin/password`, { currentPassword: currentPass, newPassword: newPass }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return { success: true };
      }
      throw error;
    }
  },

  // ─── ADDITIONAL METRICS & DASHBOARD STATS ──────────────────────────────────
  async getAuditLogs(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/audit-logs`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockLogs;
      }
      throw error;
    }
  },

  async getPayments(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/payments`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockTransactions;
      }
      throw error;
    }
  },

  async getServiceRequests(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/requests`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return mockRequests;
      }
      throw error;
    }
  },

  async getDashboardStats(): Promise<any> {
    try {
      const res = await axios.get(`${API_URL}/dashboard/stats`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return {
          weeklyRequestsData,
          revenueData,
          serviceDistribution,
          providerEarningsData
        };
      }
      throw error;
    }
  }
};
