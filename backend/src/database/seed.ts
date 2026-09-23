import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
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

    const isProd = process.env.NODE_ENV === "production";
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    let adminPasswordToUse = initialAdminPassword;
    if (!adminPasswordToUse || adminPasswordToUse.length < 8) {
      adminPasswordToUse = process.env.ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD || "Admin@1234";
    }

    // 1. Seed & Ensure Super Administrator Accounts from Environment Variables
    const defaultSuperAdmin = (process.env.SUPER_ADMIN_EMAIL || "admin@merihcare.live").toLowerCase().trim();
    const targetSuperAdmins = [defaultSuperAdmin, "fanuelgoitom79@gmail.com", "fani@g.com"].filter(Boolean);

    for (const adminEmail of targetSuperAdmins) {
      let superAdmin = await this.userRepo.findOne({ where: { email: adminEmail } });
      if (!superAdmin) {
        const bootstrapPassword = adminPasswordToUse;

        superAdmin = new UserEntity();
        superAdmin.id = "u-superadmin-" + adminEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
        superAdmin.email = adminEmail;
        superAdmin.name = process.env.SUPER_ADMIN_NAME || "System Administrator";
        superAdmin.phone = process.env.SUPER_ADMIN_PHONE || "0939044079";
        superAdmin.dateJoined = new Date().toISOString().split("T")[0];
        superAdmin.password = await bcrypt.hash(bootstrapPassword, 10);
        superAdmin.role = "admin";
        superAdmin.adminRole = "super_admin";
        superAdmin.roles = "admin,provider,patient";
        superAdmin.permissions = "all";
        superAdmin.isApproved = true;
        superAdmin.status = "active";
        superAdmin.tokenVersion = 0;
        superAdmin.mustChangePassword = isProd;
        await this.userRepo.save(superAdmin);
        console.log(`New super administrator bootstrapped: ${adminEmail}`);
      } else {
        // Retain user's existing password; in dev, update password if TEST_ADMIN_PASSWORD is set
        let updated = false;
        if (!isProd && process.env.TEST_ADMIN_PASSWORD) {
          superAdmin.password = await bcrypt.hash(process.env.TEST_ADMIN_PASSWORD, 10);
          updated = true;
        }
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
        console.log(`Super administrator configured: ${adminEmail}`);
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
      // Aliases for mobile app on-demand requests
      { id: "srv-1", name: "Doctor Home Visit", icon: "👨‍⚕️", description: "Comprehensive medical checkup and consultation at your doorstep.", providerCount: 0, priceFrom: 800, status: "active" },
      { id: "srv-2", name: "Urgent Nursing Care", icon: "🏥", description: "Wound dressing, IV therapy, vitals checking and injections.", providerCount: 0, priceFrom: 450, status: "active" },
      { id: "srv-3", name: "Physiotherapy Session", icon: "🦿", description: "Mobility recovery, rehabilitation, and pain relief therapy.", providerCount: 0, priceFrom: 600, status: "active" },
      { id: "srv-4", name: "Elderly & Palliative Care", icon: "🧓", description: "Assistance with mobility, hygiene, and daily medical monitoring.", providerCount: 0, priceFrom: 500, status: "active" },
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

    // 3. Ensure Active Locations for Verified Providers in Addis Ababa
    const defaultCoords = [
      { x: 38.74689, y: 9.02497 }, // Tikur Anbessa / Lideta
      { x: 38.78500, y: 8.99500 }, // Bole Medhanialem
      { x: 38.76500, y: 9.01800 }, // Kazanchis
      { x: 38.73500, y: 9.00500 }, // Sarbet
      { x: 38.75200, y: 9.03500 }, // Piassa
    ];

    try {
      const activeProviders = await this.providerRepo.find({
        where: [{ available: true, verified: true }, { available: true }],
      });

      for (let i = 0; i < activeProviders.length; i++) {
        const prov = activeProviders[i];
        const coord = defaultCoords[i % defaultCoords.length];
        const targetX = prov.longitude ?? coord.x;
        const targetY = prov.latitude ?? coord.y;

        let loc = await this.locationRepo.findOne({
          where: [{ userId: prov.userId }, { id: prov.id }, { id: `loc-${prov.userId}` }],
        });

        if (!loc) {
          loc = new LocationEntity();
          loc.id = `loc-${prov.userId || prov.id}`;
          loc.userId = prov.userId || prov.id;
          loc.name = prov.name;
          loc.role = "provider";
          loc.x = targetX;
          loc.y = targetY;
          loc.status = "available";
          loc.accuracy = 5;
          loc.privacyMode = false;
          loc.locationTimestamp = new Date().toISOString();
          await this.locationRepo.save(loc);
        } else if (loc.x === 0 && loc.y === 0) {
          loc.x = targetX;
          loc.y = targetY;
          loc.name = prov.name || loc.name;
          loc.status = "available";
          await this.locationRepo.save(loc);
        }

        if (!prov.latitude || !prov.longitude) {
          prov.latitude = targetY;
          prov.longitude = targetX;
          await this.providerRepo.save(prov);
        }
      }
    } catch (err) {
      console.warn("Non-fatal: could not seed provider locations:", err);
    }

    console.log("Database seeded successfully (with active provider locations ready)!");
  }
}
