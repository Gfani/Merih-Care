import { Test, TestingModule } from "@nestjs/testing";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityService } from "./availability.service";
import { JwtService } from "@nestjs/jwt";

describe("AvailabilityController", () => {
  let controller: AvailabilityController;
  let service: AvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        AvailabilityService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
    service = module.get<AvailabilityService>(AvailabilityService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
