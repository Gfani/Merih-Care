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

export const resolveApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes("api.merihcare.et")) {
    if (import.meta.env.PROD && envUrl.includes("localhost")) {
      throw new Error("Security Alert: Cannot use localhost VITE_API_URL in production build!");
    }
    return envUrl;
  }
  if (typeof window !== "undefined") {
    const customApi = localStorage.getItem("merihcare_api_url");
    if (customApi) return customApi;

    // Dynamically detect Azure Container Apps environment
    // e.g. hostname: app-merihcare-prod-admin.agreeablemoss-f06ffa43.uaenorth.azurecontainerapps.io
    const hostname = window.location.hostname;
    if (hostname.includes(".azurecontainerapps.io")) {
      const parts = hostname.split(".");
      const domainSuffix = parts.slice(1).join(".");
      return `https://app-merihcare-prod-backend.${domainSuffix}/api/v1`;
    }
  }
  if (envUrl) {
    return envUrl;
  }
  if (import.meta.env.PROD) {
    return "https://api.merihcare.et/api/v1";
  }
  return "http://localhost:3000/api/v1";
};

export const API_URL = resolveApiUrl();

const getHeaders = () => {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

const isDemoMode = (): boolean => {
  // Disallow demo mode in production builds
  if (import.meta.env.PROD) {
    return false;
  }
  const enabledByEnv = import.meta.env.VITE_ENABLE_DEMO_MODE === "true" || import.meta.env.DEV;
  const stored = localStorage.getItem("demo_mode");
  return enabledByEnv && stored === "true";
};

// Global unwrapper for NestJS StandardResponse envelope { success: true, data: T }
axios.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "success" in response.data && "data" in response.data) {
      return {
        ...response,
        data: response.data.data,
      };
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

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
      const payload = res.data;
      const formattedName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const user = payload.user || {
        id: payload.id || "admin-user",
        email: email,
        name: payload.name || formattedName,
        role: payload.role || payload.adminRole || "admin",
      };
      const token = payload.access_token || payload.token;
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(user));
      return { access_token: token, user };
    } catch (error) {
      if (isDemoMode()) {
        const formattedName = email ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Administrator";
        const mockUser = { id: "u-admin", name: formattedName, email: email || "admin@merihcare.et", role: "admin" };
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

  async googleAuth(idToken: string, role: string = "admin"): Promise<{ access_token: string; user: any }> {
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { idToken, role });
      const payload = res.data;
      const user = payload.user || {
        id: payload.id || "admin-user",
        email: payload.email,
        name: payload.name || "Administrator",
        role: payload.role || payload.adminRole || role,
      };
      const token = payload.access_token || payload.token;
      if (token) {
        localStorage.setItem("admin_token", token);
        localStorage.setItem("admin_user", JSON.stringify(user));
      }
      return { access_token: token, user };
    } catch (error) {
      if (isDemoMode()) {
        const mockUser = { id: "u-google-admin", name: "Google Administrator", email: "admin@gmail.com", role: "admin" };
        localStorage.setItem("admin_token", "mock-google-token");
        localStorage.setItem("admin_user", JSON.stringify(mockUser));
        return { access_token: "mock-google-token", user: mockUser };
      }
      throw error;
    }
  },

  logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  },

  async getAdminProfile(): Promise<{ name: string; email: string }> {
    const raw = localStorage.getItem("admin_user");
    if (raw && raw !== "undefined" && raw !== "null") {
      try {
        const user = JSON.parse(raw);
        if (user && user.email) {
          const fallbackName = user.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          return { name: user.name || fallbackName, email: user.email };
        }
      } catch {}
    }
    return { name: "System Administrator", email: "admin@merihcare.et" };
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

  async deleteUser(id: string): Promise<any> {
    try {
      const res = await axios.delete(`${API_URL}/users/${id}`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, deleted: true };
      throw error;
    }
  },

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────
  async getProviders(params?: { search?: string; specialty?: string; verified?: boolean | string }): Promise<Provider[]> {
    try {
      const queryParams = { verified: "all", ...params };
      const res = await axios.get(`${API_URL}/providers`, { headers: getHeaders(), params: queryParams });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockProviders as any;
      throw error;
    }
  },

  async getVerificationQueue(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/verification`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      return this.getProviders({ verified: "false" });
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
      const res = await axios.get(`${API_URL}/services`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return mockServices as any;
      throw error;
    }
  },

  async createService(data: Partial<ServiceCategory>): Promise<ServiceCategory> {
    try {
      const res = await axios.post(`${API_URL}/services`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { ...data, id: `svc-${Date.now()}` } as any;
      throw error;
    }
  },

  async updateService(id: string, data: Partial<ServiceCategory>): Promise<ServiceCategory> {
    try {
      const res = await axios.put(`${API_URL}/services/${id}`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, ...data } as any;
      throw error;
    }
  },

  async deleteService(id: string): Promise<any> {
    try {
      const res = await axios.delete(`${API_URL}/services/${id}`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, deleted: true };
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

  // ─── PAYOUTS & SETTLEMENTS ───────────────────────────────────────────────
  async getPayouts(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/payouts`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "pay-1", providerId: "prov-01", amount: 2400, status: "pending", bankAccount: "CBE - 1000234981", transactionReference: "REF-101", createdAt: new Date().toISOString() },
          { id: "pay-2", providerId: "prov-02", amount: 1800, status: "completed", bankAccount: "Awash - 014298172", transactionReference: "REF-102", createdAt: new Date().toISOString() },
        ];
      }
      throw error;
    }
  },

  async updatePayoutStatus(id: string, status: string, transactionReference?: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/payouts/${id}/status`, { status, transactionReference }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status, transactionReference };
      throw error;
    }
  },

  async createBatchSettlement(): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/payouts/batches`, {}, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { batchReference: `BATCH-${Date.now()}`, totalPayouts: 2, totalAmount: 4200, status: "completed" };
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

  async resolveComplaint(id: string, status?: Complaint["status"] | string, resolutionNotes?: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/complaints/${id}`, { status: status || "resolved", resolutionNotes: resolutionNotes || "Resolved by admin" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: status || "resolved", resolutionNotes, resolvedAt: new Date().toISOString() };
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

  async getEmergencies(): Promise<EmergencyAlert[]> {
    return this.getEmergencyAlerts();
  },

  async dispatchEmergency(id: string, responder: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/emergency/${id}/dispatch`, { responder }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, responder, status: "dispatched" };
      throw error;
    }
  },

  // ─── LOCATIONS & LIVE MAP ──────────────────────────────────────────────────
  async getLocations(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/locations`, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return [
          { id: "loc-1", userId: "p1", name: "Dr. Meron Alemu", role: "provider", latitude: 9.0192, longitude: 38.7578, status: "available" },
          { id: "loc-2", userId: "p2", name: "Hiwot Girma", role: "provider", latitude: 9.0250, longitude: 38.7620, status: "on_the_way" },
        ];
      }
      throw error;
    }
  },

  async updateLocationPrivacy(...args: any[]): Promise<any> {
    const userId = args[0];
    const privacyMode = args.length > 1 ? args[1] : true;
    try {
      const res = await axios.put(`${API_URL}/locations/${userId}/privacy`, { privacyMode }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { userId, privacyMode };
      throw error;
    }
  },

  async getRoute(...args: any[]): Promise<any> {
    const origin = args.length >= 4 ? { lat: args[0], lng: args[1] } : args[0];
    const destination = args.length >= 4 ? { lat: args[2], lng: args[3] } : args[1];
    try {
      const res = await axios.post(`${API_URL}/locations/route`, { origin, destination }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) {
        return {
          distance: "3.2 km",
          duration: "12 mins",
          coordinates: [origin, destination],
        };
      }
      throw error;
    }
  },

  async getVerificationReviews(): Promise<any[]> {
    return this.getProviders({ verified: false });
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

  async moderateReview(id: string, action?: any): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/reviews/${id}/moderate`, { action: action === "hidden" || action === "reject" ? "reject" : "approve" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, action, moderatedAt: new Date().toISOString() };
      throw error;
    }
  },

  async toggleService(id: string, active?: boolean): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/services/${id}/toggle`, { active }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, active };
      throw error;
    }
  },

  async updateAdminProfile(arg1: any, arg2?: any): Promise<any> {
    const data = arg2 !== undefined ? arg2 : arg1;
    try {
      const res = await axios.put(`${API_URL}/admin/profile`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return data;
      throw error;
    }
  },

  async updateAdminPassword(arg1: any, arg2?: any): Promise<any> {
    const data = arg2 !== undefined ? arg2 : arg1;
    try {
      const res = await axios.put(`${API_URL}/admin/password`, data, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { success: true };
      throw error;
    }
  },

  async approveAdminAccount(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/admin/users/${id}/approve`, { status: "approved" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: "approved" };
      throw error;
    }
  },

  async rejectAdminAccount(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/admin/users/${id}/approve`, { status: "rejected" }, { headers: getHeaders() });
      return res.data;
    } catch (error) {
      if (isDemoMode()) return { id, status: "rejected" };
      throw error;
    }
  },
};
