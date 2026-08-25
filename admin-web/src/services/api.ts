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
  providerEarningsData
} from "../data/mock";

const API_URL = "http://localhost:3000/api/v1";

const getHeaders = () => {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
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
      if (email === "admin@merihcare.et" && pass === "admin123") {
        localStorage.setItem("admin_token", "mock-token-xyz");
        localStorage.setItem("admin_user", JSON.stringify({ name: "Admin Kebede", email }));
        return { access_token: "mock-token-xyz", user: { name: "Admin Kebede" } };
      }
      throw new Error("Invalid credentials");
    }
  },

  async signup(name: string, email: string, pass: string, dept: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password: pass, department: dept });
      return res.data;
    } catch (error) {
      console.warn("API signup failed, falling back to mock behavior:", error);
      return { success: true };
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
    } catch {
      return mockPatients;
    }
  },

  async toggleUserSuspension(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/users/${id}/suspend`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status: currentStatus === "active" ? "suspended" : "active" };
    }
  },

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────
  async getProviders(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/providers`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockProviders;
    }
  },

  async toggleProviderSuspension(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/providers/${id}/suspend`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status: currentStatus === "active" ? "suspended" : "active" };
    }
  },

  // ─── VERIFICATIONS ─────────────────────────────────────────────────────────────
  async getVerificationQueue(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/verification`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockProviders.filter(p => !p.verified);
    }
  },

  async approveProvider(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/verification/${id}/approve`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, verified: true, status: "verified" };
    }
  },

  async rejectProvider(id: string): Promise<any> {
    try {
      const res = await axios.post(`${API_URL}/verification/${id}/reject`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, verified: false, status: "rejected" };
    }
  },

  // ─── SERVICES ──────────────────────────────────────────────────────────────
  async getServices(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/services`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockServices;
    }
  },

  async toggleService(id: string, currentStatus: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/services/${id}/toggle`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status: currentStatus === "active" ? "closed" : "active" };
    }
  },

  // ─── APPOINTMENTS ──────────────────────────────────────────────────────────
  async getAppointments(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/appointments`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockAppointments;
    }
  },

  // ─── COMPLAINTS ────────────────────────────────────────────────────────────
  async getComplaints(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/complaints`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockComplaints;
    }
  },

  async resolveComplaint(id: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/complaints/${id}/resolve`, {}, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status: "resolved" };
    }
  },

  // ─── REVIEWS ───────────────────────────────────────────────────────────────
  async getReviews(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/reviews`, { headers: getHeaders() });
      return res.data;
    } catch {
      return mockReviews;
    }
  },

  async moderateReview(id: string, status: "published" | "hidden" | "flagged"): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/reviews/${id}/moderate`, { status }, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status };
    }
  },

  // ─── EMERGENCY ─────────────────────────────────────────────────────────────
  async getEmergencies(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/emergency`, { headers: getHeaders() });
      return res.data;
    } catch {
      // Create mock emergencies list locally
      return [
        { id: "em1", patient: "Ababa Kebede", location: "Bole Medhanialem, Addis Ababa", phone: "+251 91 122 3344", time: "10:30 AM", type: "Critical", status: "active" },
        { id: "em2", patient: "Marta Solomon", location: "Kazanchis (Near UNECA), Addis Ababa", phone: "+251 92 333 4455", time: "10:45 AM", type: "Moderate", status: "active" },
        { id: "em3", patient: "Dr. Abraham", location: "Megenagna Roundabout, Addis Ababa", phone: "+251 93 444 5566", time: "11:02 AM", type: "Critical", status: "active" },
      ];
    }
  },

  async dispatchEmergency(id: string, responder: string): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/emergency/${id}/dispatch`, { responder }, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, status: "dispatched", responder };
    }
  },

  // ─── MAP TRACKING (LOCATIONS) ──────────────────────────────────────────────
  async getLocations(): Promise<any[]> {
    try {
      const res = await axios.get(`${API_URL}/locations`, { headers: getHeaders() });
      return res.data;
    } catch {
      // Fallback pins
      return [
        { id: "pin1", name: "Dr. Meron Alemu (GP)", role: "provider", x: 42, y: 35, status: "available" },
        { id: "pin2", name: "Hiwot Girma (Nurse)", role: "provider", x: 55, y: 48, status: "available" },
        { id: "pin3", name: "Yonas Tekeste (Physio)", role: "provider", x: 28, y: 62, status: "busy" },
        { id: "pin4", name: "Bereket Haile (Lab Tech)", role: "provider", x: 68, y: 25, status: "available" },
        { id: "pin5", name: "Critical Heart Alert (Abebe K.)", role: "patient", x: 40, y: 32, status: "critical" },
        { id: "pin6", name: "Moderate Asthma (Marta S.)", role: "patient", x: 53, y: 46, status: "busy" },
      ];
    }
  },

  async updateLocation(id: string, x: number, y: number): Promise<any> {
    try {
      const res = await axios.put(`${API_URL}/locations/${id}/move`, { x, y }, { headers: getHeaders() });
      return res.data;
    } catch {
      return { id, x, y };
    }
  }
};
