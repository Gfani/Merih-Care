import { Test, TestingModule } from "@nestjs/testing";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

describe("Realtime Socket Gateway Tests", () => {
  let gateway: RealtimeGateway;
  let realtimeService: RealtimeService;

  const mockLocationRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockAppointmentRepo = { findOne: jest.fn(), count: jest.fn() };
  const mockRealtimeService = {
    setServer: jest.fn(),
    emitLocationUpdate: jest.fn(),
    emitLocationStale: jest.fn(),
    emitAdminMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: RealtimeService, useValue: mockRealtimeService },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: getRepositoryToken(LocationEntity), useValue: mockLocationRepo },
        { provide: getRepositoryToken(AppointmentEntity), useValue: mockAppointmentRepo },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    realtimeService = module.get<RealtimeService>(RealtimeService);
  });

  function createMockSocket(userId: string, role: string) {
    return {
      id: `socket-${userId}`,
      userId,
      role,
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as any;
  }

  describe("handleConnection", () => {
    it("should auto-join personal room and emit connection_established", () => {
      const socket = createMockSocket("u-patient-1", "patient");
      gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith("patient:u-patient-1");
      expect(socket.emit).toHaveBeenCalledWith("connection_established", expect.objectContaining({
        data: expect.objectContaining({ userId: "u-patient-1", role: "patient" }),
      }));
    });

    it("should join providers broadcast room when provider connects", () => {
      const socket = createMockSocket("prov-1", "provider");
      gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith("provider:prov-1");
      expect(socket.join).toHaveBeenCalledWith("providers");
    });
  });

  describe("handleJoinAppointment", () => {
    it("should allow appointment participant to join room", async () => {
      const socket = createMockSocket("patient-1", "patient");
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-101",
        patientId: "patient-1",
        providerId: "prov-1",
      });

      const response = await gateway.handleJoinAppointment(socket, { appointmentId: "apt-101" });
      expect(response.ok).toBe(true);
      expect(socket.join).toHaveBeenCalledWith("appointment:apt-101");
    });

    it("should reject non-participant from joining appointment room", async () => {
      const socket = createMockSocket("stranger-user", "patient");
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-101",
        patientId: "patient-1",
        providerId: "prov-1",
      });

      const response = await gateway.handleJoinAppointment(socket, { appointmentId: "apt-101" });
      expect(response.ok).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringContaining("Not authorized") }));
    });
  });

  describe("handleJoinEmergency", () => {
    it("should allow provider and admin to join emergency room", () => {
      const socket = createMockSocket("prov-1", "provider");
      const response = gateway.handleJoinEmergency(socket, { emergencyId: "emg-999" });

      expect(response.ok).toBe(true);
      expect(socket.join).toHaveBeenCalledWith("emergency:emg-999");
    });

    it("should reject patient from joining provider emergency dispatch room", () => {
      const socket = createMockSocket("patient-1", "patient");
      const response = gateway.handleJoinEmergency(socket, { emergencyId: "emg-999" });

      expect(response.ok).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringContaining("Only providers and admins") }));
    });
  });

  describe("handleLocationUpdate", () => {
    it("should update location and broadcast to appointment room", async () => {
      const socket = createMockSocket("prov-1", "provider");
      mockLocationRepo.findOne.mockResolvedValue({ userId: "prov-1", x: 0, y: 0 });

      const response = await gateway.handleLocationUpdate(socket, {
        appointmentId: "apt-101",
        lat: 9.0054,
        lng: 38.7845,
      });

      expect(response.ok).toBe(true);
      expect(mockLocationRepo.save).toHaveBeenCalled();
      expect(mockRealtimeService.emitLocationUpdate).toHaveBeenCalledWith(
        "apt-101",
        "prov-1",
        9.0054,
        38.7845,
        expect.any(String),
      );
    });

    it("should reject location updates from patients", async () => {
      const socket = createMockSocket("patient-1", "patient");
      const response = await gateway.handleLocationUpdate(socket, {
        appointmentId: "apt-101",
        lat: 9.0054,
        lng: 38.7845,
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain("Only providers may send location");
    });
  });
});
