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
    if (process.env.AUTO_SEED === "true") {
      await this.seed();
    } else {
      console.log("AUTO_SEED is not true. Skipping automatic startup seeder.");
    }
  }

  async seed() {
    if (process.env.NODE_ENV === "production") {
      console.warn("WARNING: Database seeding is disabled in production environments.");
      return;
    }

    console.log("Running idempotent database seeder...");

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

    const mockPatients = [
      { id: "u1", name: "Tigist Bekele", email: "tigist.bekele@email.com", phone: "+251 91 234 5678", role: "patient", status: "active", dateJoined: "2023-02-10" },
      { id: "u2", name: "Dawit Haile", email: "dawit.haile@email.com", phone: "+251 92 876 5432", role: "patient", status: "active", dateJoined: "2022-11-05" },
      { id: "u3", name: "Selamawit Tadesse", email: "selam.tadesse@email.com", phone: "+251 93 456 7890", role: "patient", status: "active", dateJoined: "2024-01-15" },
      { id: "u4", name: "Bereket Mengistu", email: "bereket.m@email.com", phone: "+251 91 111 2233", role: "patient", status: "suspended", dateJoined: "2022-08-22" },
      { id: "u5", name: "Frehiwot Solomon", email: "frehiwot.s@email.com", phone: "+251 94 567 8901", role: "patient", status: "active", dateJoined: "2024-03-01" },
    ];

    for (const p of mockPatients) {
      let u = await this.userRepo.findOne({ where: { id: p.id } });
      if (!u) {
        u = new UserEntity();
        u.id = p.id;
      }
      u.name = p.name;
      u.email = p.email;
      u.password = await bcrypt.hash("password123", 10);
      u.phone = p.phone;
      u.role = p.role;
      u.status = p.status;
      u.dateJoined = p.dateJoined;
      await this.userRepo.save(u);
    }

    // 2. Seed Services
    const mockServices = [
      { id: "home-nursing", name: "Home Nursing", icon: "🏥", description: "Professional nursing care at home", providerCount: 34, priceFrom: 800, status: "active" },
      { id: "doctor-visit", name: "Doctor Visit", icon: "👨‍⚕️", description: "Physician consultations at your location", providerCount: 21, priceFrom: 1200, status: "active" },
      { id: "physiotherapy", name: "Physiotherapy", icon: "🦿", description: "Rehabilitation and physical therapy", providerCount: 18, priceFrom: 600, status: "active" },
      { id: "elderly-care", name: "Elderly Care", icon: "🧓", description: "Compassionate care for older adults", providerCount: 15, priceFrom: 700, status: "active" },
      { id: "maternal-care", name: "Maternal Care", icon: "🤱", description: "Prenatal and postnatal support", providerCount: 12, priceFrom: 900, status: "active" },
      { id: "child-care", name: "Child Care", icon: "👶", description: "Pediatric care and support", providerCount: 16, priceFrom: 750, status: "active" },
      { id: "wound-care", name: "Wound Care", icon: "🩹", description: "Professional wound dressing and care", providerCount: 22, priceFrom: 500, status: "active" },
      { id: "medication", name: "Medication Assist", icon: "💊", description: "Medication administration and management", providerCount: 28, priceFrom: 400, status: "active" },
      { id: "lab-services", name: "Lab Services", icon: "🧪", description: "Home specimen collection", providerCount: 9, priceFrom: 350, status: "active" },
      { id: "telemedicine", name: "Telemedicine", icon: "📱", description: "Remote consultations with specialists", providerCount: 45, priceFrom: 300, status: "active" },
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

    // 3. Seed Providers
    const mockProviders = [
      {
        id: "p1",
        name: "Dr. Meron Alemu",
        title: "General Practitioner",
        avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format",
        rating: 4.9,
        reviewCount: 127,
        experience: 8,
        distance: "1.2 km",
        services: ["Doctor Visit", "Telemedicine", "Wound Care"],
        available: true,
        verified: true,
        pricePerVisit: 1200,
        status: "active",
      },
      {
        id: "p2",
        name: "Hiwot Girma",
        title: "Registered Nurse",
        avatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop&auto=format",
        rating: 4.8,
        reviewCount: 89,
        experience: 5,
        distance: "0.8 km",
        services: ["Home Nursing", "Medication Assist", "Wound Care"],
        available: true,
        verified: true,
        pricePerVisit: 800,
        status: "active",
      },
      {
        id: "p3",
        name: "Yonas Tekeste",
        title: "Physiotherapist",
        avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&auto=format",
        rating: 4.7,
        reviewCount: 54,
        experience: 6,
        distance: "2.1 km",
        services: ["Physiotherapy", "Elderly Care"],
        available: false,
        verified: true,
        pricePerVisit: 600,
        status: "active",
      },
      {
        id: "p4",
        name: "Selamawit Dagnew",
        title: "Maternal Care Nurse",
        avatar: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=200&h=200&fit=crop&auto=format",
        rating: 4.9,
        reviewCount: 63,
        experience: 7,
        distance: "1.5 km",
        services: ["Maternal Care", "Child Care", "Home Nursing"],
        available: true,
        verified: true,
        pricePerVisit: 900,
        status: "active",
      },
      {
        id: "p5",
        name: "Bereket Haile",
        title: "Medical Laboratory Technician",
        avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format",
        rating: 4.6,
        reviewCount: 41,
        experience: 4,
        distance: "3.0 km",
        services: ["Lab Services", "Medication Assist"],
        available: true,
        verified: true,
        pricePerVisit: 350,
        status: "active",
      },
    ];

    for (const p of mockProviders) {
      let pr = await this.providerRepo.findOne({ where: { id: p.id } });
      if (!pr) {
        pr = new ProviderEntity();
        pr.id = p.id;
      }
      pr.name = p.name;
      pr.title = p.title;
      pr.avatar = p.avatar;
      pr.rating = p.rating;
      pr.reviewCount = p.reviewCount;
      pr.experience = p.experience;
      pr.distance = p.distance;
      pr.services = p.services;
      pr.available = p.available;
      pr.verified = p.verified;
      pr.pricePerVisit = p.pricePerVisit;
      pr.status = p.status;
      await this.providerRepo.save(pr);
    }

    // 4. Seed Appointments
    const mockAppointments = [
      { id: "apt1", patientName: "Tigist Bekele", patientAvatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&auto=format", providerName: "Dr. Meron Alemu", providerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format", service: "Doctor Home Visit", date: "2026-08-26", time: "10:00", location: "Bole, Addis Ababa", amount: 1200, status: "scheduled" },
      { id: "apt2", patientName: "Tigist Bekele", patientAvatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&auto=format", providerName: "Hiwot Girma", providerAvatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop&auto=format", service: "Home Nursing", date: "2026-08-28", time: "14:00", location: "Bole, Addis Ababa", amount: 800, status: "pending" },
      { id: "apt3", patientName: "Dawit Haile", patientAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format", providerName: "Yonas Tekeste", providerAvatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&auto=format", service: "Physiotherapy", date: "2026-08-20", time: "09:30", location: "Kazanchis, Addis Ababa", amount: 600, status: "completed" },
      { id: "apt4", patientName: "Selamawit Tadesse", patientAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&auto=format", providerName: "Dr. Meron Alemu", providerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format", service: "Doctor Home Visit", date: "2026-08-15", time: "11:00", location: "Megenagna, Addis Ababa", amount: 1200, status: "cancelled" },
      { id: "apt5", patientName: "Bereket Mengistu", patientAvatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&auto=format", providerName: "Selamawit Dagnew", providerAvatar: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=200&h=200&fit=crop&auto=format", service: "Maternal Care", date: "2026-08-27", time: "08:00", location: "Sarbet, Addis Ababa", amount: 900, status: "accepted" },
    ];

    for (const a of mockAppointments) {
      let ap = await this.appointmentRepo.findOne({ where: { id: a.id } });
      if (!ap) {
        ap = new AppointmentEntity();
        ap.id = a.id;
      }
      ap.patientName = a.patientName;
      ap.patientAvatar = a.patientAvatar;
      ap.providerName = a.providerName;
      ap.providerAvatar = a.providerAvatar;
      ap.service = a.service;
      ap.date = a.date;
      ap.time = a.time;
      ap.location = a.location;
      ap.amount = a.amount;
      ap.status = a.status;
      await this.appointmentRepo.save(ap);
    }

    // 5. Seed Complaints
    const mockComplaints = [
      { id: "cmp001", reporterName: "Dawit Haile", reporterRole: "patient", subject: "Provider arrived 2 hours late without notice", date: "2026-08-23", status: "under_review", priority: "high", description: "The provider arrived late for my physiotherapy session." },
      { id: "cmp002", reporterName: "Tigist Bekele", reporterRole: "patient", subject: "Payment deducted but service was not confirmed", date: "2026-08-24", status: "pending", priority: "medium", description: "Telebirr transaction txn001 succeeded but the app does not show schedule." },
      { id: "cmp003", reporterName: "Hiwot Girma", reporterRole: "provider", subject: "Unable to update availability calendar", date: "2026-08-20", status: "resolved", priority: "low", description: "Calendar pagination bug on phone dashboard." },
      { id: "cmp004", reporterName: "Frehiwot Solomon", reporterRole: "patient", subject: "Provider did not follow proper hygiene protocol", date: "2026-08-25", status: "under_review", priority: "urgent", description: "Technician did not wear gloves during sample collection." },
    ];

    for (const c of mockComplaints) {
      let ce = await this.complaintRepo.findOne({ where: { id: c.id } });
      if (!ce) {
        ce = new ComplaintEntity();
        ce.id = c.id;
      }
      ce.reporterName = c.reporterName;
      ce.reporterRole = c.reporterRole;
      ce.subject = c.subject;
      ce.date = c.date;
      ce.status = c.status;
      ce.priority = c.priority;
      ce.description = c.description;
      await this.complaintRepo.save(ce);
    }

    // 6. Seed Reviews
    const mockReviews = [
      { id: "rev001", reviewerName: "Tigist Bekele", providerName: "Dr. Meron Alemu", rating: 5, comment: "Excellent care. Dr. Meron was professional, punctual, and very thorough.", service: "Doctor Home Visit", date: "2026-08-20", status: "published" },
      { id: "rev002", reviewerName: "Dawit Haile", providerName: "Yonas Tekeste", rating: 4, comment: "Good session, very helpful exercises. Could improve on timing.", service: "Physiotherapy", date: "2026-08-21", status: "published" },
      { id: "rev003", reviewerName: "Bereket Mengistu", providerName: "Selamawit Dagnew", rating: 5, comment: "Incredibly caring and knowledgeable. Highly recommend for maternal care.", service: "Maternal Care", date: "2026-08-24", status: "published" },
      { id: "rev004", reviewerName: "Frehiwot Solomon", providerName: "Bereket Haile", rating: 2, comment: "Collection process was delayed and results took too long.", service: "Lab Services", date: "2026-08-22", status: "flagged" },
    ];

    for (const r of mockReviews) {
      let re = await this.reviewRepo.findOne({ where: { id: r.id } });
      if (!re) {
        re = new ReviewEntity();
        re.id = r.id;
      }
      re.reviewerName = r.reviewerName;
      re.providerName = r.providerName;
      re.rating = r.rating;
      re.comment = r.comment;
      re.service = r.service;
      re.date = r.date;
      re.status = r.status;
      await this.reviewRepo.save(re);
    }

    // 7. Seed Emergencies
    const mockEmergencies = [
      { id: "em1", patient: "Ababa Kebede", location: "Bole Medhanialem, Addis Ababa", phone: "+251 91 122 3344", time: "10:30 AM", type: "Critical", status: "active" },
      { id: "em2", patient: "Marta Solomon", location: "Kazanchis (Near UNECA), Addis Ababa", phone: "+251 92 333 4455", time: "10:45 AM", type: "Moderate", status: "active" },
      { id: "em3", patient: "Dr. Abraham", location: "Megenagna Roundabout, Addis Ababa", phone: "+251 93 444 5566", time: "11:02 AM", type: "Critical", status: "active" },
    ];

    for (const e of mockEmergencies) {
      let ee = await this.emergencyRepo.findOne({ where: { id: e.id } });
      if (!ee) {
        ee = new EmergencyEntity();
        ee.id = e.id;
      }
      ee.patient = e.patient;
      ee.location = e.location;
      ee.phone = e.phone;
      ee.time = e.time;
      ee.type = e.type;
      ee.status = e.status;
      await this.emergencyRepo.save(ee);
    }

    // 8. Seed Locations (Map tracking coordinates)
    const mockLocations = [
      { id: "pin1", name: "Dr. Meron Alemu (GP)", role: "provider", x: 42, y: 35, status: "available" },
      { id: "pin2", name: "Hiwot Girma (Nurse)", role: "provider", x: 55, y: 48, status: "available" },
      { id: "pin3", name: "Yonas Tekeste (Physio)", role: "provider", x: 28, y: 62, status: "busy" },
      { id: "pin4", name: "Bereket Haile (Lab Tech)", role: "provider", x: 68, y: 25, status: "available" },
      { id: "pin5", name: "Critical Heart Alert (Abebe K.)", role: "patient", x: 40, y: 32, status: "critical" },
      { id: "pin6", name: "Moderate Asthma (Marta S.)", role: "patient", x: 53, y: 46, status: "busy" },
    ];

    for (const l of mockLocations) {
      let le = await this.locationRepo.findOne({ where: { id: l.id } });
      if (!le) {
        le = new LocationEntity();
        le.id = l.id;
      }
      le.name = l.name;
      le.role = l.role;
      le.x = l.x;
      le.y = l.y;
      le.status = l.status;
      await this.locationRepo.save(le);
    }

    console.log("Database seeded successfully!");
  }
}
