import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import { 
  UserEntity, 
  ProviderEntity, 
  ServiceEntity, 
  AppointmentEntity, 
  ComplaintEntity, 
  ReviewEntity, 
  EmergencyEntity, 
  LocationEntity 
} from "./database/entities";

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ProviderEntity) private readonly providerRepo: Repository<ProviderEntity>,
    @InjectRepository(ServiceEntity) private readonly serviceRepo: Repository<ServiceEntity>,
    @InjectRepository(AppointmentEntity) private readonly appointmentRepo: Repository<AppointmentEntity>,
    @InjectRepository(ComplaintEntity) private readonly complaintRepo: Repository<ComplaintEntity>,
    @InjectRepository(ReviewEntity) private readonly reviewRepo: Repository<ReviewEntity>,
    @InjectRepository(EmergencyEntity) private readonly emergencyRepo: Repository<EmergencyEntity>,
    @InjectRepository(LocationEntity) private readonly locationRepo: Repository<LocationEntity>,
  ) {}

  // ─── AUTH ──────────────────────────────────────────────────────────────────────
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user && user.password === pass && user.status === "active") {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  // ─── USERS ─────────────────────────────────────────────────────────────────────
  async getAllUsers(): Promise<UserEntity[]> {
    return this.userRepo.find({ where: { role: "patient" } });
  }

  async toggleUserSuspension(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user) {
      user.status = user.status === "active" ? "suspended" : "active";
      return this.userRepo.save(user);
    }
    return null;
  }

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────────
  async getAllProviders(): Promise<any[]> {
    const providers = await this.providerRepo.find();
    // Parse serialized services array
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
  }

  async toggleProviderSuspension(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.status = provider.status === "active" ? "suspended" : "active";
      return this.providerRepo.save(provider);
    }
    return null;
  }

  // ─── VERIFICATIONS ─────────────────────────────────────────────────────────────
  async getVerificationQueue(): Promise<any[]> {
    const providers = await this.providerRepo.find({ where: { verified: false } });
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
  }

  async approveProvider(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = true;
      provider.status = "verified";
      return this.providerRepo.save(provider);
    }
    return null;
  }

  async rejectProvider(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = false;
      provider.status = "rejected";
      return this.providerRepo.save(provider);
    }
    return null;
  }

  // ─── SERVICES ──────────────────────────────────────────────────────────────────
  async getAllServices(): Promise<ServiceEntity[]> {
    return this.serviceRepo.find();
  }

  async toggleServiceActive(id: string): Promise<ServiceEntity> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (service) {
      service.status = service.status === "active" ? "closed" : "active";
      return this.serviceRepo.save(service);
    }
    return null;
  }

  // ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
  async getAllAppointments(): Promise<AppointmentEntity[]> {
    return this.appointmentRepo.find();
  }

  // ─── COMPLAINTS ────────────────────────────────────────────────────────────────
  async getAllComplaints(): Promise<ComplaintEntity[]> {
    return this.complaintRepo.find();
  }

  async resolveComplaint(id: string): Promise<ComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (complaint) {
      complaint.status = "resolved";
      return this.complaintRepo.save(complaint);
    }
    return null;
  }

  // ─── REVIEWS ───────────────────────────────────────────────────────────────────
  async getAllReviews(): Promise<ReviewEntity[]> {
    return this.reviewRepo.find();
  }

  async moderateReview(id: string, status: "published" | "hidden" | "flagged"): Promise<ReviewEntity> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (review) {
      review.status = status;
      return this.reviewRepo.save(review);
    }
    return null;
  }

  // ─── EMERGENCIES ───────────────────────────────────────────────────────────────
  async getAllEmergencies(): Promise<EmergencyEntity[]> {
    return this.emergencyRepo.find();
  }

  async dispatchEmergency(id: string, responder: string): Promise<EmergencyEntity> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (alert) {
      alert.status = "dispatched";
      alert.responder = responder;
      return this.emergencyRepo.save(alert);
    }
    return null;
  }

  // ─── LOCATIONS (LIVE MAP) ──────────────────────────────────────────────────────
  async getAllLocations(): Promise<LocationEntity[]> {
    return this.locationRepo.find();
  }

  async updateLocation(id: string, x: number, y: number): Promise<LocationEntity> {
    const loc = await this.locationRepo.findOne({ where: { id } });
    if (loc) {
      loc.x = x;
      loc.y = y;
      return this.locationRepo.save(loc);
    }
    return null;
  }

  async registerUser(name: string, email: string, pass: string, role: string): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new Error("User already exists");
    }
    const user = new UserEntity();
    user.id = "u-" + Date.now();
    user.name = name;
    user.email = email;
    user.password = pass; // Store in plaintext for simplicity
    user.phone = "";
    user.role = role;
    user.status = "active"; // Set to active so they can log in immediately
    user.dateJoined = new Date().toISOString().split("T")[0];
    return this.userRepo.save(user);
  }

  // ─── PLATFORM SETTINGS ─────────────────────────────────────────────────────────
  private getSettingsPath() {
    const databaseDir = path.join(process.cwd(), "database");
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    return path.join(databaseDir, "settings.json");
  }

  getSettings() {
    const settingsPath = this.getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      } catch (e) {
        console.error("Error reading settings.json", e);
      }
    }
    return {
      emailNotifs: true,
      smsNotifs: true,
      maintenanceMode: false,
      commissionRate: "15",
      minPayout: "500"
    };
  }

  updateSettings(data: any) {
    const settings = {
      emailNotifs: data.emailNotifs ?? true,
      smsNotifs: data.smsNotifs ?? true,
      maintenanceMode: data.maintenanceMode ?? false,
      commissionRate: data.commissionRate ?? "15",
      minPayout: data.minPayout ?? "500"
    };
    fs.writeFileSync(this.getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
    return settings;
  }

  // ─── ADMIN PROFILE & PASSWORD ──────────────────────────────────────────────────
  async getAdminProfile(): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (!admin) return { name: "Admin Kebede", email: "admin@merihcare.et" };
    return { name: admin.name, email: admin.email };
  }

  async updateAdminProfile(name: string, email: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (admin) {
      admin.name = name;
      admin.email = email;
      await this.userRepo.save(admin);
      return { name: admin.name, email: admin.email };
    }
    throw new Error("Admin user not found");
  }

  async updateAdminPassword(currentPass: string, newPass: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (admin) {
      if (admin.password !== currentPass) {
        throw new Error("Incorrect current password");
      }
      admin.password = newPass;
      await this.userRepo.save(admin);
      return { success: true };
    }
    throw new Error("Admin user not found");
  }

  // ─── PLATFORM METRICS IMPLEMENTATION ───────────────────────────────────────────
  getAuditLogs() {
    return [
      { id: "log001", actor: "Admin Kebede", action: "Provider verified", resource: "Dr. Meron Alemu", timestamp: "2026-08-25T09:10:00", status: "success" },
      { id: "log002", actor: "Admin Tigist", action: "User suspended", resource: "Bereket Mengistu", timestamp: "2026-08-25T08:45:00", status: "warning" },
      { id: "log003", actor: "System", action: "Payment processed", resource: "TXN-001", timestamp: "2026-08-25T08:00:00", status: "success" },
      { id: "log004", actor: "Admin Kebede", action: "Complaint resolved", resource: "CMP-003", timestamp: "2026-08-24T16:30:00", status: "success" },
      { id: "log005", actor: "Admin Tigist", action: "Service created", resource: "Elderly Care Premium", timestamp: "2026-08-24T14:00:00", status: "success" },
      { id: "log006", actor: "System", action: "Payment failed", resource: "TXN-008", timestamp: "2026-08-18T10:22:00", status: "error" },
    ];
  }

  getTransactions() {
    return [
      { id: "txn001", patientName: "Tigist Bekele", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "Telebirr", status: "successful", date: "2026-08-25" },
      { id: "txn002", patientName: "Selamawit Tadesse", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "refunded", date: "2026-08-15" },
      { id: "txn003", patientName: "Dawit Haile", providerName: "Yonas Tekeste", service: "Physiotherapy", amount: 600, method: "Cash", status: "successful", date: "2026-08-20" },
      { id: "txn004", patientName: "Bereket Mengistu", providerName: "Selamawit Dagnew", service: "Maternal Care", amount: 900, method: "Telebirr", status: "successful", date: "2026-08-24" },
      { id: "txn005", patientName: "Frehiwot Solomon", providerName: "Bereket Haile", service: "Lab Services", amount: 350, method: "Awash Bank", status: "pending", date: "2026-08-25" },
      { id: "txn006", patientName: "Dawit Haile", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "successful", date: "2026-08-22" },
      { id: "txn007", patientName: "Tigist Bekele", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "pending", date: "2026-08-25" },
      { id: "txn008", patientName: "Bereket Mengistu", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "failed", date: "2026-08-18" },
    ];
  }

  getServiceRequests() {
    return [
      {
        id: "req1",
        patientId: "u3",
        patientName: "Selamawit Tadesse",
        patientAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&auto=format",
        service: "Home Nursing",
        date: "2026-08-26",
        time: "16:00",
        location: "Megenagna, Addis Ababa",
        notes: "Post-surgery wound care and dressing change",
        estimatedEarnings: 750,
        distance: "1.4 km",
        status: "pending",
        createdAt: "2026-08-25T08:14:00",
      },
      {
        id: "req2",
        patientId: "u5",
        patientName: "Frehiwot Solomon",
        patientAvatar: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=200&h=200&fit=crop&auto=format",
        service: "Medication Assist",
        date: "2026-08-26",
        time: "12:00",
        location: "Piazza, Addis Ababa",
        notes: "Daily insulin injection management for elderly parent",
        estimatedEarnings: 380,
        distance: "3.2 km",
        status: "pending",
        createdAt: "2026-08-25T07:30:00",
      },
      {
        id: "req3",
        patientId: "u2",
        patientName: "Dawit Haile",
        patientAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format",
        service: "Wound Care",
        date: "2026-08-27",
        time: "10:30",
        location: "Kazanchis, Addis Ababa",
        notes: "Burn wound dressing — requires sterile technique",
        estimatedEarnings: 500,
        distance: "0.9 km",
        status: "pending",
        createdAt: "2026-08-25T06:55:00",
      },
    ];
  }

  getDashboardStats() {
    return {
      weeklyRequestsData: [
        { day: "Mon", requests: 18, completed: 14 },
        { day: "Tue", requests: 24, completed: 20 },
        { day: "Wed", requests: 21, completed: 17 },
        { day: "Thu", requests: 30, completed: 25 },
        { day: "Fri", requests: 27, completed: 22 },
        { day: "Sat", requests: 15, completed: 13 },
        { day: "Sun", requests: 10, completed: 9 },
      ],
      revenueData: [
        { month: "Mar", revenue: 48200 },
        { month: "Apr", revenue: 56800 },
        { month: "May", revenue: 72400 },
        { month: "Jun", revenue: 68100 },
        { month: "Jul", revenue: 89300 },
        { month: "Aug", revenue: 94700 },
      ],
      serviceDistribution: [
        { name: "Home Nursing", value: 28 },
        { name: "Doctor Visit", value: 22 },
        { name: "Physiotherapy", value: 16 },
        { name: "Telemedicine", value: 18 },
        { name: "Other", value: 16 },
      ],
      providerEarningsData: [
        { day: "Mon", earnings: 2400 },
        { day: "Tue", earnings: 3200 },
        { day: "Wed", earnings: 1800 },
        { day: "Thu", earnings: 4100 },
        { day: "Fri", earnings: 3600 },
        { day: "Sat", earnings: 2100 },
        { day: "Sun", earnings: 1400 },
      ]
    };
  }
}
