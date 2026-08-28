import { Test, TestingModule } from "@nestjs/testing";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { JwtService } from "@nestjs/jwt";

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  save: jest.fn(),
});

describe("RealtimeGateway", () => {
  let gateway: RealtimeGateway;
  let service: RealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        RealtimeService,
        { provide: getRepositoryToken(LocationEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(AppointmentEntity), useValue: mockRepo() },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    service = module.get<RealtimeService>(RealtimeService);
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
    expect(service).toBeDefined();
  });

  it("RealtimeService.emitToRoom does not throw when server is null", () => {
    expect(() => service.emitToRoom("test-room", "test_event", {})).not.toThrow();
  });

  it("RealtimeService emits versioned envelope", () => {
    const mockEmit = jest.fn();
    (service as any).server = { to: jest.fn(() => ({ emit: mockEmit })) };
    service.emitAppointmentUpdate("apt-123", "in_progress");
    expect(mockEmit).toHaveBeenCalledWith(
      "appointment_status_update",
      expect.objectContaining({ v: 1, event: "appointment_status_update" }),
    );
  });
});
