import { ReportsService } from "../src/modules/reports/reports.service";
import { UserEntity } from "../src/database/entities/user.entity";
import { ProviderEntity } from "../src/database/entities/provider.entity";
import { AppointmentEntity } from "../src/database/entities/appointment.entity";
import { ReviewEntity } from "../src/database/entities/review.entity";

describe("Reporting & Dashboard Checklist Tests", () => {
  let service: ReportsService;
  let mockUserRepo: any;
  let mockProviderRepo: any;
  let mockAppointmentRepo: any;
  let mockReviewRepo: any;

  beforeEach(() => {
    mockUserRepo = {
      count: jest.fn().mockResolvedValue(150),
    };
    mockProviderRepo = {
      count: jest.fn().mockResolvedValue(25),
    };
    mockAppointmentRepo = {
      count: jest.fn().mockResolvedValue(12),
      find: jest.fn().mockResolvedValue([]),
    };
    mockReviewRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    service = new ReportsService(
      mockUserRepo,
      mockProviderRepo,
      mockAppointmentRepo,
      mockReviewRepo
    );
  });

  describe("Live Database Metrics Aggregation", () => {
    it("should compute real KPI metrics from database entities", async () => {
      const apt1 = new AppointmentEntity();
      apt1.id = "apt-1";
      apt1.status = "completed";
      apt1.amount = 1200;
      apt1.service = "Physiotherapy";

      const apt2 = new AppointmentEntity();
      apt2.id = "apt-2";
      apt2.status = "completed";
      apt2.amount = 800;
      apt2.service = "Doctor Visit";

      mockAppointmentRepo.find.mockResolvedValue([apt1, apt2]);

      const review = new ReviewEntity();
      review.rating = 4.8;
      mockReviewRepo.find.mockResolvedValue([review]);

      const stats = await service.getDashboardStats();
      expect(stats.kpis.totalPatients).toBe(150);
      expect(stats.kpis.totalProviders).toBe(25);
      expect(stats.kpis.activeRequests).toBe(12);
      expect(stats.kpis.totalRevenue).toBe(2000);
      expect(stats.kpis.avgRating).toBe(4.8);
      expect(stats.dataFreshnessTimestamp).toBeDefined();
    });

    it("should filter metrics by service category when requested", async () => {
      const apt1 = new AppointmentEntity();
      apt1.id = "apt-1";
      apt1.status = "completed";
      apt1.amount = 1200;
      apt1.service = "Home Nursing";

      const apt2 = new AppointmentEntity();
      apt2.id = "apt-2";
      apt2.status = "completed";
      apt2.amount = 800;
      apt2.service = "Doctor Visit";

      mockAppointmentRepo.find.mockResolvedValue([apt1, apt2]);

      const filtered = await service.getDashboardStats({ service: "Home Nursing" });
      expect(filtered.kpis.totalRevenue).toBe(1200);
    });
  });

  describe("Operational CSV Export", () => {
    it("should export appointments operational data in valid CSV format", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-101";
      apt.patientId = "pat-1";
      apt.providerId = "prov-1";
      apt.service = "Telemedicine";
      apt.status = "completed";
      apt.amount = 500;
      apt.date = "2026-08-31";

      mockAppointmentRepo.find.mockResolvedValue([apt]);

      const csv = await service.exportOperationalReport();
      expect(csv).toContain("AppointmentID,PatientID,ProviderID,Service,Status,Amount,Date");
      expect(csv).toContain('"apt-101","pat-1","prov-1","Telemedicine","completed","500","2026-08-31"');
    });
  });
});
