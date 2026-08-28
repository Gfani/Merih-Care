import { Test, TestingModule } from "@nestjs/testing";
import { ProviderEarningsController } from "./earnings.controller";
import { ProviderEarningsService } from "./earnings.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ProviderEarningsEntity, PayoutEntity } from "../../database/entities/financial.entity";
import { JwtService } from "@nestjs/jwt";

describe("ProviderEarningsController", () => {
  let controller: ProviderEarningsController;
  let service: ProviderEarningsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderEarningsController],
      providers: [
        ProviderEarningsService,
        {
          provide: getRepositoryToken(ProviderEarningsEntity),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PayoutEntity),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ProviderEarningsController>(ProviderEarningsController);
    service = module.get<ProviderEarningsService>(ProviderEarningsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
