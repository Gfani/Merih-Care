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

    // 1. Seed & Ensure Super Administrator Accounts
    const targetSuperAdmins = [
      "fanuelgoitom79@gmail.com",
      "goitomfanuel@gmail.com",
      "fani@g.com",
      (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim()
    ].filter(e => e && e !== "admin@merihcare.et");

    for (const adminEmail of targetSuperAdmins) {
      let superAdmin = await this.userRepo.findOne({ where: { email: adminEmail } });
      if (!superAdmin) {
        superAdmin = new UserEntity();
        superAdmin.id = adminEmail === "fanuelgoitom79@gmail.com" ? "u-superadmin" : "u-superadmin-" + adminEmail.split("@")[0];
        superAdmin.email = adminEmail;
        superAdmin.name = "Fanuel Goitom";
        superAdmin.phone = "+251 91 111 2233";
        superAdmin.dateJoined = new Date().toISOString().split("T")[0];
        superAdmin.password = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD || "Fani7939", 10);
        superAdmin.role = "admin";
        superAdmin.adminRole = "super_admin";
        superAdmin.roles = "admin,provider,patient";
        superAdmin.permissions = "all";
        superAdmin.isApproved = true;
        superAdmin.status = "active";
        superAdmin.tokenVersion = 0;
        await this.userRepo.save(superAdmin);
        console.log(`New super administrator bootstrapped: ${adminEmail}`);
      } else {
        // Retain user's existing password; only ensure required administrative privileges
        let updated = false;
        if (superAdmin.role !== "admin") {
          superAdmin.role = "admin";
          updated = true;
        }
        if (superAdmin.adminRole !== "super_admin") {
          superAdmin.adminRole = "super_admin";
          updated = true;
        }
        if (!superAdmin.roles || !superAdmin.roles.includes("admin")) {
          superAdmin.roles = "admin,provider,patient";
          updated = true;
        }
        if (superAdmin.tokenVersion === undefined || superAdmin.tokenVersion === null) {
          superAdmin.tokenVersion = 0;
          updated = true;
        }
        if (updated) {
          await this.userRepo.save(superAdmin);
        }
        console.log(`Super administrator configured (password preserved): ${adminEmail}`);
      }
    }


    // Decommission old placeholder admin@merihcare.et if present
    const oldAdmin = await this.userRepo.findOne({ where: { email: "admin@merihcare.et" } });
    if (oldAdmin) {
      await this.userRepo.remove(oldAdmin).catch(() => {});
      console.log("Decommissioned obsolete placeholder admin@merihcare.et");
    }

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
