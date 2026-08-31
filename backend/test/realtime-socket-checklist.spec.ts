import { RealtimeGateway } from "../src/modules/realtime/realtime.gateway";
import { RealtimeService } from "../src/modules/realtime/realtime.service";
import { LocationEntity } from "../src/database/entities/location.entity";
import { AppointmentEntity } from "../src/database/entities/appointment.entity";

describe("Realtime & Socket Checklist Tests", () => {
  let gateway: RealtimeGateway;
  let service: RealtimeService;
  let mockJwtService: any;
  let mockLocationRepo: any;
  let mockAppointmentRepo: any;

  beforeEach(() => {
    service = new RealtimeService();
    mockJwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: "user-1", role: "provider" }),
    };
    mockLocationRepo = {
      findOne: jest.fn().mockResolvedValue(new LocationEntity()),
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
    };
    mockAppointmentRepo = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(5),
    };

    gateway = new RealtimeGateway(
      service,
      mockJwtService,
      mockLocationRepo,
      mockAppointmentRepo
    );
  });

  describe("Room Authorization", () => {
    it("should authorize patient/provider to join their appointment room", async () => {
      const mockSocket: any = {
        id: "sock-1",
        userId: "p-1",
        role: "provider",
        join: jest.fn(),
        emit: jest.fn(),
      };

      const apt = new AppointmentEntity();
      apt.id = "apt-101";
      apt.providerId = "p-1";
      apt.patientId = "pat-1";
      mockAppointmentRepo.findOne.mockResolvedValue(apt);

      const result = await gateway.handleJoinAppointment(mockSocket, { appointmentId: "apt-101" });
      expect(result.ok).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith("appointment:apt-101");
    });

    it("should reject unauthorized user trying to join an appointment room", async () => {
      const mockSocket: any = {
        id: "sock-2",
        userId: "stranger-99",
        role: "patient",
        join: jest.fn(),
        emit: jest.fn(),
      };

      const apt = new AppointmentEntity();
      apt.id = "apt-101";
      apt.providerId = "p-1";
      apt.patientId = "pat-1";
      mockAppointmentRepo.findOne.mockResolvedValue(apt);

      const result = await gateway.handleJoinAppointment(mockSocket, { appointmentId: "apt-101" });
      expect(result.ok).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.any(String) }));
    });

    it("should reject non-admin from joining admin room", () => {
      const mockSocket: any = {
        id: "sock-3",
        role: "patient",
        join: jest.fn(),
        emit: jest.fn(),
      };

      const result = gateway.handleJoinAdmin(mockSocket);
      expect(result.ok).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith("error", { message: "Admin role required" });
    });
  });

  describe("Location Streaming & Rate Limiting", () => {
    it("should process initial location update for provider", async () => {
      const mockSocket: any = {
        id: "sock-loc-1",
        userId: "p-1",
        role: "provider",
        join: jest.fn(),
        emit: jest.fn(),
      };

      gateway.handleConnection(mockSocket);

      const result = await gateway.handleLocationUpdate(mockSocket, {
        appointmentId: "apt-101",
        lat: 9.02,
        lng: 38.74,
      });

      expect(result.ok).toBe(true);
      expect(result.ts).toBeDefined();
    });

    it("should rate-limit subsequent location update within 3 seconds", async () => {
      const mockSocket: any = {
        id: "sock-loc-2",
        userId: "p-1",
        role: "provider",
        join: jest.fn(),
        emit: jest.fn(),
      };

      gateway.handleConnection(mockSocket);

      await gateway.handleLocationUpdate(mockSocket, {
        appointmentId: "apt-101",
        lat: 9.02,
        lng: 38.74,
      });

      // Immediate second update
      const secondResult = await gateway.handleLocationUpdate(mockSocket, {
        appointmentId: "apt-101",
        lat: 9.021,
        lng: 38.741,
      });

      expect(secondResult.ok).toBe(false);
      expect(secondResult.error).toBe("RATE_LIMITED");
    });
  });

  describe("Session Reconnect Restoration", () => {
    it("should restore rooms upon reconnect", () => {
      const mockSocket: any = {
        id: "sock-restore-1",
        join: jest.fn(),
      };

      const result = gateway.handleRestoreSession(mockSocket, {
        rooms: ["appointment:apt-1", "emergency:emg-1"],
      });

      expect(result.ok).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith("appointment:apt-1");
      expect(mockSocket.join).toHaveBeenCalledWith("emergency:emg-1");
    });
  });
});
