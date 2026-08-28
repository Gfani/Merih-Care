import { Test, TestingModule } from "@nestjs/testing";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity } from "../../database/entities/verification.entity";
import { VerificationHistoryEntity } from "../../database/entities/verification.entity";

describe("VerificationController", () => {
  let controller: VerificationController;
  let service: VerificationService;

  const mockProviderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockProviderRepo,
        },
        {
          provide: getRepositoryToken(VerificationReviewEntity),
          useValue: mockAuditRepo,
        },
        {
          provide: getRepositoryToken(VerificationHistoryEntity),
          useValue: mockAuditRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
    service = module.get<VerificationService>(VerificationService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
