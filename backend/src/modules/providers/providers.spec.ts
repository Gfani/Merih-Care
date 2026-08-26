import { Test, TestingModule } from "@nestjs/testing";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { DataSource } from "typeorm";

describe("ProvidersController", () => {
  let controller: ProvidersController;
  let service: ProvidersService;

  const mockProviderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [
        ProvidersService,
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockProviderRepo,
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

    controller = module.get<ProvidersController>(ProvidersController);
    service = module.get<ProvidersService>(ProvidersService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
