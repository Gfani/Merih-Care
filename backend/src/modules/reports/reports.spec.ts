import { Test, TestingModule } from "@nestjs/testing";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { ReviewEntity } from "../../database/entities/review.entity";

describe("ReportsController", () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockRepo = {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ReviewEntity),
          useValue: mockRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
