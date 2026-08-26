import { Test, TestingModule } from "@nestjs/testing";
import { MedicalRecordsController } from "./medical.controller";
import { MedicalRecordsService } from "./medical.service";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";

describe("MedicalRecordsController", () => {
  let controller: MedicalRecordsController;
  let service: MedicalRecordsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordsController],
      providers: [
        MedicalRecordsService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { getRepository: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<MedicalRecordsController>(MedicalRecordsController);
    service = module.get<MedicalRecordsService>(MedicalRecordsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
