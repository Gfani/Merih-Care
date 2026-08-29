import { Test, TestingModule } from "@nestjs/testing";
import { VerificationService } from "./verification.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity, VerificationHistoryEntity } from "../../database/entities/verification.entity";

describe("VerificationService Unit Tests", () => {
  let service: VerificationService;

  const mockProviderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockReviewRepo = {
    save: jest.fn(),
  };

  const mockHistoryRepo = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockProviderRepo,
        },
        {
          provide: getRepositoryToken(VerificationReviewEntity),
          useValue: mockReviewRepo,
        },
        {
          provide: getRepositoryToken(VerificationHistoryEntity),
          useValue: mockHistoryRepo,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  describe("getVerificationQueue", () => {
    it("should return unverified providers", async () => {
      mockProviderRepo.find.mockResolvedValue([
        { id: "p-1", verified: false, status: "pending" },
      ]);

      const queue = await service.getVerificationQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe("p-1");
    });
  });

  describe("approveProvider", () => {
    it("should approve provider, set verified to true, and create audit records", async () => {
      const mockProvider = { id: "p-1", verified: false, status: "pending" };
      mockProviderRepo.findOne.mockResolvedValue(mockProvider);
      mockProviderRepo.save.mockImplementation((p) => Promise.resolve(p));
      mockReviewRepo.save.mockImplementation((r) => Promise.resolve(r));
      mockHistoryRepo.save.mockImplementation((h) => Promise.resolve(h));

      const result = await service.approveProvider("p-1", "admin-1");

      expect(result.verified).toBe(true);
      expect(result.status).toBe("verified");
      expect(mockReviewRepo.save).toHaveBeenCalled();
      expect(mockHistoryRepo.save).toHaveBeenCalled();
    });

    it("should return null if provider not found", async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);
      const result = await service.approveProvider("p-missing", "admin-1");
      expect(result).toBeNull();
    });
  });

  describe("rejectProvider", () => {
    it("should mark provider as rejected with reason and audit records", async () => {
      const mockProvider = { id: "p-1", verified: false, status: "pending" };
      mockProviderRepo.findOne.mockResolvedValue(mockProvider);
      mockProviderRepo.save.mockImplementation((p) => Promise.resolve(p));
      mockReviewRepo.save.mockImplementation((r) => Promise.resolve(r));
      mockHistoryRepo.save.mockImplementation((h) => Promise.resolve(h));

      const result = await service.rejectProvider("p-1", "Invalid medical license", "admin-1");

      expect(result.verified).toBe(false);
      expect(result.status).toBe("rejected");
      expect(mockReviewRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        decision: "rejected",
        notes: "Invalid medical license",
      }));
    });
  });

  describe("requestCorrections", () => {
    it("should mark provider as needs_fix with comments", async () => {
      const mockProvider = { id: "p-1", verified: false, status: "pending" };
      mockProviderRepo.findOne.mockResolvedValue(mockProvider);
      mockProviderRepo.save.mockImplementation((p) => Promise.resolve(p));
      mockReviewRepo.save.mockImplementation((r) => Promise.resolve(r));
      mockHistoryRepo.save.mockImplementation((h) => Promise.resolve(h));

      const result = await service.requestCorrections("p-1", "Please upload clearer degree scan", "admin-1");

      expect(result.status).toBe("needs_fix");
      expect(mockReviewRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        decision: "corrections_requested",
        notes: "Please upload clearer degree scan",
      }));
    });
  });
});
