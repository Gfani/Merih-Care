import { Test, TestingModule } from "@nestjs/testing";
import { EmergencyService } from "./emergency.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import {
  EmergencyResponderEntity,
  EmergencyEscalationHistoryEntity,
} from "../../database/entities/emergency-relation.entity";
import { RealtimeService } from "../realtime/realtime.service";

describe("Emergency Escalation Tests", () => {
  let service: EmergencyService;
  let mockTransactionManager: any;

  const mockEmergencyRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const mockResponderRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const mockEscalationRepo = { save: jest.fn() };
  const mockRealtimeService = { emitEmergencyAlert: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockTransactionManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockTransactionManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: getRepositoryToken(EmergencyEntity), useValue: mockEmergencyRepo },
        { provide: getRepositoryToken(EmergencyResponderEntity), useValue: mockResponderRepo },
        { provide: getRepositoryToken(EmergencyEscalationHistoryEntity), useValue: mockEscalationRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: RealtimeService, useValue: mockRealtimeService },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  describe("dispatchEmergency", () => {
    it("should update emergency to dispatched and broadcast realtime alert", async () => {
      const mockAlert = {
        id: "emg-001",
        patient: "Abebe Bikila",
        location: "Kazanchis, Addis Ababa",
        status: "pending",
      };
      mockTransactionManager.findOne.mockResolvedValue(mockAlert);

      const dispatched = await service.dispatchEmergency("emg-001", "Dr. Meron Alemu");

      expect(dispatched).toBeDefined();
      expect(dispatched.status).toBe("dispatched");
      expect(dispatched.responder).toBe("Dr. Meron Alemu");
      expect(mockRealtimeService.emitEmergencyAlert).toHaveBeenCalledWith(
        "emg-001",
        expect.objectContaining({
          emergencyId: "emg-001",
          status: "dispatched",
          responder: "Dr. Meron Alemu",
        }),
      );
    });

    it("should throw NotFoundException if emergency alert is not found", async () => {
      mockTransactionManager.findOne.mockResolvedValue(null);

      await expect(service.dispatchEmergency("emg-missing", "Dr. Meron Alemu")).rejects.toThrow(
        "Emergency case not found"
      );
      expect(mockRealtimeService.emitEmergencyAlert).not.toHaveBeenCalled();
    });
  });
});
