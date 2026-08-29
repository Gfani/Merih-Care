import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
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
import {
  User,
  Provider,
  Appointment,
  ServiceRequest,
  ServiceCategory,
  PaymentTransaction,
  Complaint,
  Review,
  EmergencyAlert,
  AuditLog,
  AdminNotification,
  SystemSettings,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

const getHeaders = () => {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

const isDemoMode = (): boolean => {
  const stored = localStorage.getItem("demo_mode");
  return stored === "true";
};

export const api = {
  isDemoMode,

  // ─── HEALTH & BACKEND STATUS ───────────────────────────────────────────────
  async checkBackendHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const res = await axios.get(`${API_URL}/health`, { headers: getHeaders() });
      return res.data;
    } catch {
      return { status: "unreachable", timestamp: new Date().toISOString() };
    }
  },

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  async login(email: string, pass: string): Promise<{ access_token: string; user: any }> {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
      localStorage.setItem("admin_token", res.data.access_token);
      localStorage.setItem("admin_user", JSON.stringify(res.data.user));
      return res.data;
    } catch (error) {
      if (isDemoMode() && email === "admin@merihcare.et" && pass === "admin123") {
        const mockUser = { id: "u-mock-admin", name: "Admin Kebede", email, role: "admin" };
        localStorage.setItem("admin_token", "mock-token-xyz");
        localStorage.setItem("admin_user", JSON.stringify(mockUser));
        return { access_token: "mock-token-xyz", user: mockUser };
      }
      throw error;
    }
  },

  async signup(name: string, email: string, pass: string, dept: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password: pass, department: dept });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { success: true };
      throw error;
    }
  },

  logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  },

  async getAdminProfile(): Promise<{ name: string; email: string }> {
    const raw = localStorage.getItem("admin_user");
    if (raw) {
      try {
        const user = JSON.parse(raw);
        return { name: user.name || "Admin Kebede", email: user.email || "admin@merihcare.et" };
      } catch {}
    }
    return { name: "Admin Kebede", email: "admin@merihcare.et" };
  },

  // ─── USERS / PATIENTS ──────────────────────────────────────────────────────
  async getUsers(params?: { search?: string; role?: string; page?: number; limit?: number }): Promise<User[]> {
    try {
      const res = await axios.get(`${API_URL}/users`, { headers: getHeaders(), params });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockPatients as any;
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

  async bulkUpdateUserStatus(userIds: string[], status: "active" | "suspended"): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/users/bulk-status`, { userIds, status }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { updated: userIds.length, status };
      throw error;
    }
  },

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────
  async getProviders(params?: { search?: string; specialty?: string; verified?: boolean }): Promise<Provider[]> {
    try {
      const res = await axios.get(`${API_URL}/providers`, { headers: getHeaders(), params });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockProviders as any;
      throw error;
    }
  },

  async verifyProvider(id: string, decision: "verified" | "rejected", notes?: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/verification/${id}`, { status: decision, notes }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: decision, verified: decision === "verified", notes };
      throw error;
    }
  },

  async approveProvider(id: string): Promise<any> {
    return this.verifyProvider(id, "verified");
  },

  async rejectProvider(id: string, reason: string): Promise<any> {
    return this.verifyProvider(id, "rejected", reason);
  },

  async requestCorrections(id: string, notes: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/verification/${id}/corrections`, { notes }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: "pending", notes };
      throw error;
    }
  },

  async toggleProviderSuspension(id: string, currentStatus: string): Promise<any> {
    return this.toggleUserSuspension(id, currentStatus);
  },

  async getPendingAdmins(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/admin/pending-approvals`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return [];
      throw error;
    }
  },

  async approveAdmin(id: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/admin/approvals/${id}`, { status: "approved" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: "approved" };
      throw error;
    }
  },

  async rejectAdmin(id: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/admin/approvals/${id}`, { status: "rejected" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: "rejected" };
      throw error;
    }
  },

  // ─── APPOINTMENTS & REQUESTS ───────────────────────────────────────────────
  async getAppointments(params?: { status?: string; search?: string }): Promise<Appointment[]> {
    try {
      const res = await axios.get(`${API_URL}/appointments`, { headers: getHeaders(), params });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockAppointments as any;
      throw error;
    }
  },

  async updateAppointmentStatus(id: string, status: Appointment["status"], reason?: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/appointments/${id}/status`, { status, reason }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status, reason };
      throw error;
    }
  },

  async getServiceRequests(): Promise<ServiceRequest[]> {
    try {
      const res = await axios.get(`${API_URL}/requests`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockRequests as any;
      throw error;
    }
  },

  // ─── SERVICES CATALOGUE ────────────────────────────────────────────────────
  async getServices(): Promise<ServiceCategory[]> {
    try {
      const res = await axios.get(`${API_URL}/services/categories`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockServices as any;
      throw error;
    }
  },

  async createService(data: Partial<ServiceCategory>): Promise<ServiceCategory> {
    try {
      const res = await axios.post(`${API_URL}/services/categories`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { ...data, id: `svc-${Date.now()}` } as any;
      throw error;
    }
  },

  async updateService(id: string, data: Partial<ServiceCategory>): Promise<ServiceCategory> {
    try {
      const res = await axios.put(`${API_URL}/services/categories/${id}`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, ...data } as any;
      throw error;
    }
  },

  // ─── PAYMENTS & REFUNDS ────────────────────────────────────────────────────
  async getTransactions(): Promise<PaymentTransaction[]> {
    try {
      const res = await axios.get(`${API_URL}/payments`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockTransactions as any;
      throw error;
    }
  },

  async getPayments(): Promise<any[]> {
    return this.getTransactions();
  },

  async processRefund(transactionId: string, amount: number, reason: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/payments/refund`, { transactionId, amount, reason }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id: `ref-${Date.now()}`, transactionId, amount, reason, status: "processed" };
      throw error;
    }
  },

  // ─── COMPLAINTS & REVIEWS ──────────────────────────────────────────────────
  async getComplaints(): Promise<Complaint[]> {
    try {
      const res = await axios.get(`${API_URL}/complaints`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockComplaints as any;
      throw error;
    }
  },

  async resolveComplaint(id: string, status: Complaint["status"], resolutionNotes: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/complaints/${id}`, { status, resolutionNotes }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status, resolutionNotes, resolvedAt: new Date().toISOString() };
      throw error;
    }
  },

  async getReviews(): Promise<Review[]> {
    try {
      const res = await axios.get(`${API_URL}/reviews`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockReviews as any;
      throw error;
    }
  },

  // ─── EMERGENCY ALERTS ──────────────────────────────────────────────────────
  async getEmergencyAlerts(): Promise<EmergencyAlert[]> {
    try {
      const res = await axios.get(`${API_URL}/emergency`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          {
            id: "emg-1",
            patientId: "pat-1",
            patientName: "Dawit Haile",
            patientPhone: "+251 91 123 4567",
            severity: "critical",
            coordinates: { latitude: 9.0192, longitude: 38.7578 },
            locationDescription: "Kazanchis, near UNECA",
            status: "active",
            triggeredAt: new Date().toISOString(),
          },
        ] as any;
      }
      throw error;
    }
  },

  // ─── AUDIT LOGS ────────────────────────────────────────────────────────────
  async getAuditLogs(params?: { search?: string; page?: number; limit?: number }): Promise<AuditLog[]> {
    try {
      const res = await axios.get(`${API_URL}/audit`, { headers: getHeaders(), params });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockLogs as any;
      throw error;
    }
  },

  // ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
  async getNotifications(page = 1, limit = 10): Promise<AdminNotification[]> {
    try {
      const res = await axios.get(`${API_URL}/notifications`, { headers: getHeaders(), params: { page, limit } });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "n1", title: "New Provider Registration", message: "Dr. Bereket Solomon submitted medical license.", type: "verification", read: false, createdAt: "10m ago" },
          { id: "n2", title: "Urgent Complaint Filed", message: "Complaint regarding appointment #101.", type: "complaint", read: false, createdAt: "1h ago" },
        ];
      }
      throw error;
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const res = await axios.get(`${API_URL}/notifications/unread-count`, { headers: getHeaders() });
      return res.data?.count ?? 0;
    } catch {
      return isDemoMode() ? 2 : 0;
    }
  },

  async markNotificationRead(id: string): Promise<void> {
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, { headers: getHeaders() });
    } catch (error) {
      if (!isDemoMode()) throw error;
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    try {
      await axios.put(`${API_URL}/notifications/read-all`, {}, { headers: getHeaders() });
    } catch (error) {
      if (!isDemoMode()) throw error;
    }
  },

  // ─── SETTINGS & REPORTS ────────────────────────────────────────────────────
  async getSettings(): Promise<any> {
    try {
      const res = await axios.get(`${API_URL}/admin/settings`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return {
          emailNotifs: true,
          smsNotifs: true,
          maintenanceMode: false,
          commissionRate: 15,
          minPayout: 500,
        };
      }
      throw error;
    }
  },

  async updateSettings(settings: any): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/admin/settings`, settings, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return settings;
      throw error;
    }
  },

  async getOverviewMetrics(): Promise<any> {
    try {
      const res = await axios.get(`${API_URL}/reports/overview`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return {
          weeklyRequests: weeklyRequestsData,
          revenue: revenueData,
          serviceDistribution: serviceDistribution,
          providerEarnings: providerEarningsData,
        };
      }
      throw error;
    }
  },

  async getDashboardStats(): Promise<any> {
    return this.getOverviewMetrics();
  },
};
