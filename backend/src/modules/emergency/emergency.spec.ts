import { Test, TestingModule } from "@nestjs/testing";
import { EmergencyController } from "./emergency.controller";
import { EmergencyService } from "./emergency.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";

describe("EmergencyController", () => {
  let controller: EmergencyController;
  let service: EmergencyService;

  const mockEmergencyRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
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
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
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
