import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
}
