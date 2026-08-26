import { Test, TestingModule } from "@nestjs/testing";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";

describe("PayoutsController", () => {
  let controller: PayoutsController;
  let service: PayoutsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayoutsController],
      providers: [
        PayoutsService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<PayoutsController>(PayoutsController);
    service = module.get<PayoutsService>(PayoutsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
