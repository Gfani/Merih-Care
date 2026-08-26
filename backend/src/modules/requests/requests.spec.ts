import { Test, TestingModule } from "@nestjs/testing";
import { ServiceRequestsController } from "./requests.controller";
import { ServiceRequestsService } from "./requests.service";
import { JwtService } from "@nestjs/jwt";

describe("ServiceRequestsController", () => {
  let controller: ServiceRequestsController;
  let service: ServiceRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRequestsController],
      providers: [
        ServiceRequestsService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ServiceRequestsController>(ServiceRequestsController);
    service = module.get<ServiceRequestsService>(ServiceRequestsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
