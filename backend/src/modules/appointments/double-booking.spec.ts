import { Test, TestingModule } from "@nestjs/testing";
import { AppointmentsService } from "./appointments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { RealtimeService } from "../realtime/realtime.service";
import { ConflictException } from "@nestjs/common";

describe("Double-Booking Prevention Tests", () => {
  let service: AppointmentsService;

  const mockAppointmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockHistoryRepo = { save: jest.fn() };
  const mockCancellationRepo = { save: jest.fn() };
  const mockRealtimeService = { emitAppointmentUpdate: jest.fn() };

  let mockTransactionManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockTransactionManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockTransactionManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: mockAppointmentRepo,
        },
        {
          provide: getRepositoryToken(AppointmentStatusHistoryEntity),
          useValue: mockHistoryRepo,
        },
        {
          provide: getRepositoryToken(CancellationReasonEntity),
          useValue: mockCancellationRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: RealtimeService,
          useValue: mockRealtimeService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe("createAppointment collision check", () => {
    it("should allow booking when provider is free at specified date and time", async () => {
      mockTransactionManager.findOne.mockResolvedValue(null);

      const apt = await service.createAppointment({
        patientId: "patient-1",
        providerId: "prov-1",
        date: "2026-08-30",
        time: "10:00 AM",
        service: "General Checkup",
      });

      expect(apt).toBeDefined();
      expect(apt.providerId).toBe("prov-1");
      expect(mockTransactionManager.save).toHaveBeenCalled();
    });

    it("should throw ConflictException if provider is already booked for date & time slot", async () => {
      mockTransactionManager.findOne.mockResolvedValue({
        id: "apt-existing-1",
        providerId: "prov-1",
        date: "2026-08-30",
        time: "10:00 AM",
        status: "scheduled",
      });

      await expect(
        service.createAppointment({
          patientId: "patient-2",
          providerId: "prov-1",
          date: "2026-08-30",
          time: "10:00 AM",
          service: "Nursing Visit",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject second concurrent booking when first booking occupies the slot in transaction", async () => {
      let firstCalled = false;
      mockTransactionManager.findOne.mockImplementation((entity: any) => {
        if (entity === AppointmentEntity) {
          if (!firstCalled) {
            firstCalled = true;
            return Promise.resolve(null);
          }
          return Promise.resolve({ id: "apt-winner", providerId: "prov-1", date: "2026-08-30", time: "10:00 AM" });
        }
        return Promise.resolve(null);
      });

      const firstBooking = await service.createAppointment({
        patientId: "patient-1",
        providerId: "prov-1",
        date: "2026-08-30",
        time: "10:00 AM",
      });
      expect(firstBooking).toBeDefined();

      await expect(
        service.createAppointment({
          patientId: "patient-2",
          providerId: "prov-1",
          date: "2026-08-30",
          time: "10:00 AM",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("rescheduleAppointment collision check", () => {
    it("should throw ConflictException if target reschedule slot is already occupied", async () => {
      const currentApt = {
        id: "apt-1",
        providerId: "prov-1",
        date: "2026-08-30",
        time: "10:00 AM",
        status: "scheduled",
      };
      mockAppointmentRepo.findOne
        .mockResolvedValueOnce(currentApt) // First call: find appointment to reschedule
        .mockResolvedValueOnce({ id: "apt-other", providerId: "prov-1", date: "2026-08-31", time: "02:00 PM" }); // Second call: collision search

      await expect(
        service.rescheduleAppointment("apt-1", "2026-08-31", "02:00 PM", "patient-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("should allow reschedule if target slot has no collision", async () => {
      const currentApt = {
        id: "apt-1",
        providerId: "prov-1",
        date: "2026-08-30",
        time: "10:00 AM",
        status: "scheduled",
      };
      mockAppointmentRepo.findOne
        .mockResolvedValueOnce(currentApt)
        .mockResolvedValueOnce(null);
      mockAppointmentRepo.save.mockImplementation((a) => Promise.resolve(a));

      const rescheduled = await service.rescheduleAppointment("apt-1", "2026-08-31", "04:00 PM", "patient-1");
      expect(rescheduled.date).toBe("2026-08-31");
      expect(rescheduled.time).toBe("04:00 PM");
    });
  });
});
