import { Test, TestingModule } from "@nestjs/testing";
import { ComplaintsController } from "./complaints.controller";
import { ComplaintsService } from "./complaints.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ComplaintEntity } from "../../database/entities/complaint.entity";

describe("ComplaintsController", () => {
  let controller: ComplaintsController;
  let service: ComplaintsService;

  const mockComplaintRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplaintsController],
      providers: [
        ComplaintsService,
        {
          provide: getRepositoryToken(ComplaintEntity),
          useValue: mockComplaintRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ComplaintsController>(ComplaintsController);
    service = module.get<ComplaintsService>(ComplaintsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
