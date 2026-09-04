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

  it("should forward date query parameter to getAvailability", async () => {
    const spy = jest.spyOn(service, "getAvailability").mockResolvedValue({
      providerId: "p-1",
      date: "2026-09-10",
      timeSlots: [],
    } as any);

    const result = await controller.getAvailability("p-1", "2026-09-10");
    expect(spy).toHaveBeenCalledWith("p-1", "2026-09-10");
    expect(result.date).toBe("2026-09-10");
  });

  it("should default to today's date if no date query param is supplied", async () => {
    const result = await service.getAvailability("p-1");
    const today = new Date().toISOString().split("T")[0];
    expect(result.date).toBe(today);
    expect(result.timeSlots.length).toBeGreaterThan(0);
  });
});
