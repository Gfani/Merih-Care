import { HealthService } from "../src/modules/health/health.service";
import { AppointmentPolicyService } from "../src/modules/appointments/appointments.policy";
import { ProvidersService } from "../src/modules/providers/providers.service";

describe("Backend Checklist Hardening Tests", () => {
  describe("Health Liveness & Readiness", () => {
    let healthService: HealthService;
    let mockDataSource: any;

    beforeEach(() => {
      mockDataSource = {
        isInitialized: true,
        query: jest.fn().mockResolvedValue([{ 1: 1 }]),
      };
      healthService = new HealthService(mockDataSource);
    });

    it("should return up for liveness check", async () => {
      const result = await healthService.checkLiveness();
      expect(result.status).toBe("up");
      expect(result.timestamp).toBeDefined();
    });

    it("should return detailed subsystem status for readiness check", async () => {
      const result = await healthService.checkReadiness();
      expect(result.status).toBe("up");
      expect(result.subsystems.database.status).toBe("up");
      expect(result.subsystems.storage.status).toBe("up");
      expect(result.subsystems.redis.status).toBe("up");
      expect(result.subsystems.queue.status).toBe("up");
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Appointment Policy State Machine & Conflict Prevention", () => {
    let policy: AppointmentPolicyService;

    beforeEach(() => {
      policy = new AppointmentPolicyService();
    });

    it("should allow valid state transitions", () => {
      expect(() => policy.validateStateTransition("requested", "accepted")).not.toThrow();
      expect(() => policy.validateStateTransition("accepted", "on_the_way")).not.toThrow();
      expect(() => policy.validateStateTransition("on_the_way", "arrived")).not.toThrow();
      expect(() => policy.validateStateTransition("arrived", "in_progress")).not.toThrow();
      expect(() => policy.validateStateTransition("in_progress", "completed")).not.toThrow();
    });

    it("should reject invalid state transitions", () => {
      expect(() => policy.validateStateTransition("completed", "scheduled")).toThrow(
        /Invalid appointment state transition/
      );
      expect(() => policy.validateStateTransition("cancelled", "in_progress")).toThrow(
        /Invalid appointment state transition/
      );
    });

    it("should detect overlapping booking slot conflicts", () => {
      const existingSlot = { date: "2026-09-01", time: "14:00", durationMinutes: 60 };
      const overlappingSlot = { date: "2026-09-01", time: "14:30", durationMinutes: 45 };

      expect(() => policy.checkSlotConflict(existingSlot, overlappingSlot)).toThrow(
        /Provider scheduling conflict/
      );
    });

    it("should permit non-overlapping booking slots on the same date", () => {
      const existingSlot = { date: "2026-09-01", time: "14:00", durationMinutes: 60 };
      const nextSlot = { date: "2026-09-01", time: "15:30", durationMinutes: 60 };

      expect(() => policy.checkSlotConflict(existingSlot, nextSlot)).not.toThrow();
    });
  });

  describe("Provider Location Privacy Fuzzing", () => {
    let providersService: ProvidersService;
    let mockRepo: any;

    beforeEach(() => {
      mockRepo = {
        find: jest.fn().mockResolvedValue([
          { id: "p-1", name: "Dr. Aster", latitude: 9.012345, longitude: 38.765432, services: ["Doctor Home Visit"] },
        ]),
      };
      providersService = new ProvidersService(mockRepo);
    });

    it("should fuzz coordinates to approximate 500m radius", async () => {
      const result = await providersService.getAllProviders(true);
      expect(result[0].latitude).not.toBe(9.012345);
      expect(result[0].longitude).not.toBe(38.765432);
      expect(result[0].latitude.toString().split(".")[1].length).toBeLessThanOrEqual(3);
    });
  });
});
