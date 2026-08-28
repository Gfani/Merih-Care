import { Test, TestingModule } from "@nestjs/testing";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { DataSource } from "typeorm";

describe("AppointmentsController", () => {
  let controller: AppointmentsController;
  let service: AppointmentsService;

  const mockAptRepo = {
    find: jest.fn(),
  };

  const mockHistoryRepo = {
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: mockAptRepo,
        },
        {
          provide: getRepositoryToken(AppointmentStatusHistoryEntity),
          useValue: mockHistoryRepo,
        },
        {
          provide: getRepositoryToken(CancellationReasonEntity),
          useValue: mockHistoryRepo,
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
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
