import { Test, TestingModule } from "@nestjs/testing";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LocationEntity } from "../../database/entities/location.entity";

describe("LocationsController", () => {
  let controller: LocationsController;
  let service: LocationsService;

  const mockLocRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        LocationsService,
        {
          provide: getRepositoryToken(LocationEntity),
          useValue: mockLocRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    service = module.get<LocationsService>(LocationsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
