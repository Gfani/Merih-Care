import { VerificationService } from "../src/modules/verification/verification.service";
import { ProviderEntity } from "../src/database/entities/provider.entity";

describe("Verification & Provider Compliance Checklist Tests", () => {
  let service: VerificationService;
  let mockProviderRepo: any;
  let mockReviewRepo: any;
  let mockHistoryRepo: any;

  beforeEach(() => {
    mockProviderRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    mockReviewRepo = {
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
    };

    service = new VerificationService(
      mockProviderRepo,
      mockReviewRepo,
      mockHistoryRepo
    );
  });

  describe("Reviewer Assignment & Queue", () => {
    it("should assign administrator to review provider credentials", async () => {
      const provider = new ProviderEntity();
      provider.id = "prov-101";
      provider.name = "Dr. Abebe Bikila";
      mockProviderRepo.findOne.mockResolvedValue(provider);

      const result = await service.assignReviewer("prov-101", "u-admin-lead", "u-admin-super");
      expect(result.success).toBe(true);
      expect(result.assignedReviewerId).toBe("u-admin-lead");
      expect(mockHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "under_review" })
      );
    });
  });

  describe("Compliance Sanctions & Suspensions", () => {
    it("should apply compliance suspension and record history entry", async () => {
      const provider = new ProviderEntity();
      provider.id = "prov-102";
      provider.verified = true;
      provider.status = "verified";
      mockProviderRepo.findOne.mockResolvedValue(provider);

      const sanctioned = await service.sanctionProvider(
        "prov-102",
        "Expired malpractice insurance",
        "suspended",
        "u-admin-compliance"
      );

      expect(sanctioned.verified).toBe(false);
      expect(sanctioned.status).toBe("suspended");
      expect(mockHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ notes: expect.stringContaining("Expired malpractice insurance") })
      );
    });
  });

  describe("Expiring Licenses Tracking", () => {
    it("should query upcoming license review items for active verified providers", async () => {
      const p1 = new ProviderEntity();
      p1.id = "prov-1";
      p1.name = "Dr. Dawit";
      p1.verified = true;
      p1.status = "verified";

      const p2 = new ProviderEntity();
      p2.id = "prov-2";
      p2.verified = false;

      mockProviderRepo.find.mockResolvedValue([p1, p2]);

      const expiring = await service.getExpiringLicenses();
      expect(expiring).toHaveLength(1);
      expect(expiring[0].providerId).toBe("prov-1");
      expect(expiring[0].reviewDueInDays).toBe(30);
    });
  });
});
