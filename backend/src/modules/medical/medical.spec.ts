import { Test, TestingModule } from "@nestjs/testing";
import { MedicalRecordsController } from "./medical.controller";
import { MedicalRecordsService } from "./medical.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { 
  MedicalRecordEntity, 
  PatientConsentEntity, 
  PrivacyPolicyAcceptanceEntity, 
  IncidentReportEntity 
} from "../../database/entities/medical.entity";
import { MedicalRecordAccessLogEntity } from "../../database/entities/logs-delivery.entity";
import { DataSource } from "typeorm";

describe("MedicalRecordsController", () => {
  let controller: MedicalRecordsController;
  let service: MedicalRecordsService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordsController],
      providers: [
        MedicalRecordsService,
        {
          provide: getRepositoryToken(MedicalRecordEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(PatientConsentEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(PrivacyPolicyAcceptanceEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(IncidentReportEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(MedicalRecordAccessLogEntity),
          useValue: mockRepo,
        },
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
