import { Test, TestingModule } from "@nestjs/testing";
import { ServiceRequestsController } from "./requests.controller";
import { ServiceRequestsService } from "./requests.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

describe("ServiceRequestsController", () => {
  let controller: ServiceRequestsController;
  let service: ServiceRequestsService;

  const mockAppointmentRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRequestsController],
      providers: [
        ServiceRequestsService,
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: mockAppointmentRepo,
        },
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
