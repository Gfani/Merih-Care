import { Test, TestingModule } from "@nestjs/testing";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";
import { JwtService } from "@nestjs/jwt";

describe("UploadsController", () => {
  let controller: UploadsController;
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        UploadsService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
    service = module.get<UploadsService>(UploadsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
