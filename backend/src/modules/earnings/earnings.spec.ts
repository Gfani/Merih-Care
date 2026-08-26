import { Test, TestingModule } from "@nestjs/testing";
import { ProviderEarningsController } from "./earnings.controller";
import { ProviderEarningsService } from "./earnings.service";
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
