import { Test, TestingModule } from "@nestjs/testing";
import { EmergencyController } from "./emergency.controller";
import { EmergencyService } from "./emergency.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import {
  EmergencyResponderEntity,
  EmergencyEscalationHistoryEntity,
} from "../../database/entities/emergency-relation.entity";
import { DataSource } from "typeorm";
import { RealtimeService } from "../realtime/realtime.service";

describe("EmergencyController", () => {
  let controller: EmergencyController;
  let service: EmergencyService;

  const mockEmergencyRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockResponderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockEscalationRepo = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmergencyController],
      providers: [
        EmergencyService,
        {
          provide: getRepositoryToken(EmergencyEntity),
          useValue: mockEmergencyRepo,
        },
        {
          provide: getRepositoryToken(EmergencyResponderEntity),
          useValue: mockResponderRepo,
        },
        {
          provide: getRepositoryToken(EmergencyEscalationHistoryEntity),
          useValue: mockEscalationRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            getRepository: jest.fn(),
          },
        },
        {
          provide: RealtimeService,
          useValue: { emitEmergencyAlert: jest.fn(), emitToRoom: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<EmergencyController>(EmergencyController);
    service = module.get<EmergencyService>(EmergencyService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
