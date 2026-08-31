import { Test, TestingModule } from "@nestjs/testing";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReviewEntity } from "../../database/entities/review.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";

describe("ReviewsController", () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  const mockReviewRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockProviderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(ReviewEntity),
          useValue: mockReviewRepo,
        },
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockProviderRepo,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
