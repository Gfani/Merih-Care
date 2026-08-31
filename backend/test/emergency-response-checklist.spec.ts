import { EmergencyService } from "../src/modules/emergency/emergency.service";
import { EmergencyEntity } from "../src/database/entities/emergency.entity";

describe("Emergency Response Checklist Tests", () => {
  let service: EmergencyService;
  let mockEmergencyRepo: any;
  let mockResponderRepo: any;
  let mockEscalationRepo: any;
  let mockDataSource: any;
  let mockRealtimeService: any;

  beforeEach(() => {
    mockEmergencyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    mockResponderRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "log-1", emergencyId: "emg-1" }),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    mockEscalationRepo = {
      save: jest.fn().mockImplementation((esc) => Promise.resolve(esc)),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb({
        findOne: jest.fn().mockResolvedValue(new EmergencyEntity()),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      })),
    };
    mockRealtimeService = {
      emitEmergencyAlert: jest.fn(),
      emitToRoom: jest.fn(),
    };

    service = new EmergencyService(
      mockEmergencyRepo,
      mockResponderRepo,
      mockEscalationRepo,
      mockDataSource,
      mockRealtimeService
    );
  });

  describe("Emergency Creation & Priority Triage", () => {
    it("should create critical emergency alert and broadcast via realtime", async () => {
      const alert = await service.createEmergency(
        "pat-101",
        "Kazanchis, Addis Ababa",
        "+251911223344",
        "critical",
        "Abebe Bikila",
        "+251922334455"
      );

      expect(alert.type).toBe("Critical");
      expect(alert.status).toBe("active");
      expect(mockRealtimeService.emitEmergencyAlert).toHaveBeenCalled();
    });
  });

  describe("Responder Reassignment & Arrival", () => {
    it("should reassign responder and log escalation handoff", async () => {
      const existing = new EmergencyEntity();
      existing.id = "emg-1";
      existing.responder = "Dr. Dawit";
      mockEmergencyRepo.findOne.mockResolvedValue(existing);

      const updated = await service.reassignResponder("emg-1", "Dr. Aster", "admin-1", "Traffic delay on Ring Road");
      expect(updated.responder).toBe("Dr. Aster");
      expect(mockEscalationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ level: "REASSIGNED" })
      );
    });

    it("should record responder arrival and set status in_progress", async () => {
      const existing = new EmergencyEntity();
      existing.id = "emg-1";
      existing.status = "dispatched";
      mockEmergencyRepo.findOne.mockResolvedValue(existing);

      const arrived = await service.markResponderArrived("emg-1", "Dr. Aster");
      expect(arrived.status).toBe("in_progress");
      expect(mockResponderRepo.save).toHaveBeenCalled();
    });
  });

  describe("Resolution & Escalation", () => {
    it("should resolve emergency with clinical summary and broadcast completion", async () => {
      const existing = new EmergencyEntity();
      existing.id = "emg-1";
      existing.status = "in_progress";
      mockEmergencyRepo.findOne.mockResolvedValue(existing);

      const resolved = await service.resolveEmergency("emg-1", "Dr. Aster", "Patient stabilized and transferred");
      expect(resolved.status).toBe("resolved");
      expect(mockRealtimeService.emitToRoom).toHaveBeenCalledWith(
        "emergency:emg-1",
        "emergency_resolved",
        expect.objectContaining({ summary: "Patient stabilized and transferred" })
      );
    });

    it("should escalate unresolved emergency with Level 2 Paramedic alert", async () => {
      const existing = new EmergencyEntity();
      existing.id = "emg-1";
      mockEmergencyRepo.findOne.mockResolvedValue(existing);

      const result = await service.escalateEmergency("emg-1", "admin-1", "5-minute SLA exceeded without responder acceptance");
      expect(result.success).toBe(true);
      expect(result.level).toBe("LEVEL_2_PARAMEDIC_ESCALATION");
    });
  });
});
