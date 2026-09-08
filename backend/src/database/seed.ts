import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { 
  UserEntity, 
  ProviderEntity, 
  ServiceEntity, 
  AppointmentEntity, 
  ComplaintEntity, 
  ReviewEntity, 
  EmergencyEntity, 
  LocationEntity 
} from "./entities";

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
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

  async onModuleInit() {
    try {
      await this.seed();
    } catch (err) {
      console.error("Non-fatal error during database seed check:", err);
    }
  }

  async seed() {
    console.log("Checking and ensuring essential initial records (admin, services)...");

    // 1. Seed Users (Admins and Patients)
    const adminEmail = "admin@merihcare.et";
    let adminUser = await this.userRepo.findOne({ where: { email: adminEmail } });
    if (!adminUser) {
      adminUser = new UserEntity();
      adminUser.id = "u-admin";
      adminUser.email = adminEmail;
    }
    adminUser.name = "Admin Kebede";
    adminUser.password = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "admin123", 10);
    adminUser.phone = "+251 91 111 2233";
    adminUser.role = "admin";
    adminUser.adminRole = "super_admin";
    adminUser.permissions = "all";
    adminUser.isApproved = true;
    adminUser.status = "active";
    adminUser.dateJoined = "2022-01-10";
    await this.userRepo.save(adminUser);

    // 2. Seed Services
    const mockServices = [
      { id: "home-nursing", name: "Home Nursing", icon: "🏥", description: "Professional nursing care at home", providerCount: 0, priceFrom: 800, status: "active" },
      { id: "doctor-visit", name: "Doctor Visit", icon: "👨‍⚕️", description: "Physician consultations at your location", providerCount: 0, priceFrom: 1200, status: "active" },
      { id: "physiotherapy", name: "Physiotherapy", icon: "🦿", description: "Rehabilitation and physical therapy", providerCount: 0, priceFrom: 600, status: "active" },
      { id: "elderly-care", name: "Elderly Care", icon: "🧓", description: "Compassionate care for older adults", providerCount: 0, priceFrom: 700, status: "active" },
      { id: "maternal-care", name: "Maternal Care", icon: "🤱", description: "Prenatal and postnatal support", providerCount: 0, priceFrom: 900, status: "active" },
      { id: "child-care", name: "Child Care", icon: "👶", description: "Pediatric care and support", providerCount: 0, priceFrom: 750, status: "active" },
      { id: "wound-care", name: "Wound Care", icon: "🩹", description: "Professional wound dressing and care", providerCount: 0, priceFrom: 500, status: "active" },
      { id: "medication", name: "Medication Assist", icon: "💊", description: "Medication administration and management", providerCount: 0, priceFrom: 400, status: "active" },
      { id: "lab-services", name: "Lab Services", icon: "🧪", description: "Home specimen collection", providerCount: 0, priceFrom: 350, status: "active" },
      { id: "telemedicine", name: "Telemedicine", icon: "📱", description: "Remote consultations with specialists", providerCount: 0, priceFrom: 300, status: "active" },
    ];

    for (const s of mockServices) {
      let se = await this.serviceRepo.findOne({ where: { id: s.id } });
      if (!se) {
        se = new ServiceEntity();
        se.id = s.id;
      }
      se.name = s.name;
      se.icon = s.icon;
      se.description = s.description;
      se.providerCount = s.providerCount;
      se.priceFrom = s.priceFrom;
      se.status = s.status;
      await this.serviceRepo.save(se);
    }

    console.log("Database seeded successfully (clean production-ready state with no demo users/providers)!");
  }
}
