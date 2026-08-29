import { Test, TestingModule } from "@nestjs/testing";
import { AppointmentsService } from "./appointments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { RealtimeService } from "../realtime/realtime.service";
import { BadRequestException } from "@nestjs/common";

describe("Appointment Lifecycle Tests", () => {
  let service: AppointmentsService;

  const mockAppointmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockHistoryRepo = {
    save: jest.fn(),
  };

  const mockCancellationRepo = {
    save: jest.fn(),
  };

  const mockRealtimeService = {
    emitAppointmentUpdate: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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

  describe("Status Transition Validation", () => {
    it("should allow valid forward lifecycle transitions", () => {
      expect(service.isValidTransition("requested", "searching")).toBe(true);
      expect(service.isValidTransition("searching", "accepted")).toBe(true);
      expect(service.isValidTransition("accepted", "on_the_way")).toBe(true);
      expect(service.isValidTransition("on_the_way", "arrived")).toBe(true);
      expect(service.isValidTransition("arrived", "in_progress")).toBe(true);
      expect(service.isValidTransition("in_progress", "completed")).toBe(true);
    });

    it("should allow cancellation from appropriate intermediate states", () => {
      expect(service.isValidTransition("requested", "cancelled")).toBe(true);
      expect(service.isValidTransition("scheduled", "cancelled")).toBe(true);
      expect(service.isValidTransition("on_the_way", "cancelled")).toBe(true);
      expect(service.isValidTransition("arrived", "cancelled")).toBe(true);
    });

    it("should reject invalid backward or skipping transitions", () => {
      expect(service.isValidTransition("completed", "scheduled")).toBe(false);
      expect(service.isValidTransition("cancelled", "in_progress")).toBe(false);
      expect(service.isValidTransition("requested", "completed")).toBe(false);
    });
  });

  describe("updateStatus", () => {
    it("should transition status and emit realtime update", async () => {
      const mockApt = {
        id: "apt-101",
        status: "arrived",
        patientId: "patient-1",
        providerId: "prov-1",
      };
      mockAppointmentRepo.findOne.mockResolvedValue(mockApt);
      mockAppointmentRepo.save.mockImplementation((a) => Promise.resolve(a));

      const updated = await service.updateStatus("apt-101", "in_progress", "prov-1", "Started vital checks.");

      expect(updated.status).toBe("in_progress");
      expect(mockHistoryRepo.save).toHaveBeenCalled();
      expect(mockRealtimeService.emitAppointmentUpdate).toHaveBeenCalledWith(
        "apt-101",
        "in_progress",
        expect.objectContaining({ providerId: "prov-1" }),
      );
    });

    it("should throw BadRequestException on illegal status progression", async () => {
      const mockApt = {
        id: "apt-101",
        status: "requested",
      };
      mockAppointmentRepo.findOne.mockResolvedValue(mockApt);

      await expect(service.updateStatus("apt-101", "completed", "prov-1"))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe("cancelAppointment", () => {
    it("should cancel appointment and log cancellation reason", async () => {
      const mockApt = {
        id: "apt-102",
        status: "scheduled",
      };
      mockAppointmentRepo.findOne.mockResolvedValue(mockApt);
      mockAppointmentRepo.save.mockImplementation((a) => Promise.resolve(a));

      const cancelled = await service.cancelAppointment("apt-102", "Patient recovered", "patient-1");

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancellationReason).toBe("Patient recovered");
      expect(mockCancellationRepo.save).toHaveBeenCalled();
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });
  });

  describe("adminOverride", () => {
    it("should force status update and record admin audit note", async () => {
      const mockApt = {
        id: "apt-disputed",
        status: "disputed",
      };
      mockAppointmentRepo.findOne.mockResolvedValue(mockApt);
      mockAppointmentRepo.save.mockImplementation((a) => Promise.resolve(a));

      const resolved = await service.adminOverride("apt-disputed", "completed", "Mediation agreement signed", "admin-1");

      expect(resolved.status).toBe("completed");
      expect(mockHistoryRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        notes: expect.stringContaining("Admin override"),
      }));
    });
  });
});
