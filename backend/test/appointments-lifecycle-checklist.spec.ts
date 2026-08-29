import { AppointmentsService } from "../src/modules/appointments/appointments.service";
import { AppointmentEntity } from "../src/database/entities/appointment.entity";

describe("Appointments Lifecycle Checklist Tests", () => {
  let service: AppointmentsService;
  let mockAptRepo: any;
  let mockHistoryRepo: any;
  let mockCancellationRepo: any;
  let mockDataSource: any;
  let mockRealtimeService: any;

  beforeEach(() => {
    mockAptRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((apt) => Promise.resolve(apt)),
    };

    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
    };

    mockCancellationRepo = {
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      })),
    };

    mockRealtimeService = {
      emitToUser: jest.fn(),
      broadcast: jest.fn(),
    };

    service = new AppointmentsService(
      mockAptRepo,
      mockHistoryRepo,
      mockCancellationRepo,
      mockDataSource,
      mockRealtimeService
    );
  });

  describe("Provider Check-In & Check-Out", () => {
    it("should update appointment status to arrived on provider check-in", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-1";
      apt.status = "on_the_way";
      mockAptRepo.findOne.mockResolvedValue(apt);

      const result = await service.checkInProvider("apt-1", "p-1", { latitude: 9.02, longitude: 38.74 });
      expect(result.status).toBe("arrived");
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });

    it("should update appointment status to completed and record clinical summary on check-out", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-1";
      apt.status = "in_progress";
      mockAptRepo.findOne.mockResolvedValue(apt);

      const vitals = { bloodPressure: "120/80", heartRate: 72 };
      const prescriptions = ["Amoxicillin 500mg"];

      const result = await service.checkOutProvider("apt-1", "p-1", vitals, prescriptions);
      expect(result.status).toBe("completed");
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });
  });

  describe("No-Show Detection", () => {
    it("should mark appointment as cancelled with no-show audit history", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-1";
      apt.status = "arrived";
      mockAptRepo.findOne.mockResolvedValue(apt);

      const result = await service.markNoShow("apt-1", "patient", "p-1", "Waited 15 mins at door");
      expect(result.status).toBe("cancelled");
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });
  });

  describe("Reschedule & Double-Booking Prevention", () => {
    it("should reschedule appointment to new available date and time", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-1";
      apt.providerId = "p-1";
      apt.date = "2026-09-01";
      apt.time = "10:00";
      apt.status = "scheduled";
      mockAptRepo.findOne.mockResolvedValue(apt);

      const result = await service.rescheduleAppointment("apt-1", "2026-09-02", "14:00", "patient-1");
      expect(result.date).toBe("2026-09-02");
      expect(result.time).toBe("14:00");
    });
  });
});
