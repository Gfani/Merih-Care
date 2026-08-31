import { ComplaintsService } from "../src/modules/complaints/complaints.service";
import { ReviewsService } from "../src/modules/reviews/reviews.service";
import { ComplaintEntity } from "../src/database/entities/complaint.entity";
import { ReviewEntity } from "../src/database/entities/review.entity";
import { ProviderEntity } from "../src/database/entities/provider.entity";

describe("Complaints & Reviews Checklist Tests", () => {
  let complaintsService: ComplaintsService;
  let reviewsService: ReviewsService;
  let mockComplaintRepo: any;
  let mockReviewRepo: any;
  let mockProviderRepo: any;

  beforeEach(() => {
    mockComplaintRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };
    mockReviewRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    mockProviderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };

    complaintsService = new ComplaintsService(mockComplaintRepo);
    reviewsService = new ReviewsService(mockReviewRepo, mockProviderRepo);
  });

  describe("Complaint Triage & Staff Response", () => {
    it("should create high-priority complaint in pending status", async () => {
      const complaint = await complaintsService.createComplaint(
        "pat-101",
        "Abebe Bikila",
        "patient",
        "Late Arrival and Unprofessionalism",
        "high",
        "Provider arrived 45 minutes late without prior notification."
      );

      expect(complaint.priority).toBe("high");
      expect(complaint.status).toBe("pending");
      expect(mockComplaintRepo.save).toHaveBeenCalled();
    });

    it("should assign investigator and submit official staff response", async () => {
      const existing = new ComplaintEntity();
      existing.id = "comp-1";
      existing.status = "pending";
      existing.description = "Late Arrival";
      mockComplaintRepo.findOne.mockResolvedValue(existing);

      await complaintsService.assignInvestigator("comp-1", "u-admin-inv", "u-admin-lead");
      expect(existing.status).toBe("investigating");

      const resolved = await complaintsService.respondToComplaint(
        "comp-1",
        "We have reviewed the GPS telemetry and issued a formal warning.",
        "resolved",
        "u-admin-inv"
      );

      expect(resolved.status).toBe("resolved");
      expect(resolved.description).toContain("[Official Response by u-admin-inv]");
    });

    it("should escalate critical grievances to senior compliance", async () => {
      const existing = new ComplaintEntity();
      existing.id = "comp-2";
      existing.priority = "medium";
      mockComplaintRepo.findOne.mockResolvedValue(existing);

      const result = await complaintsService.escalateComplaint("comp-2", "Potential medical malpractice claim", "u-admin-lead");
      expect(result.success).toBe(true);
      expect(result.escalatedPriority).toBe("critical");
      expect(existing.priority).toBe("critical");
    });
  });

  describe("Review Moderation & Reputation Recalculation", () => {
    it("should hide abusive review and recalculate provider average rating", async () => {
      const review = new ReviewEntity();
      review.id = "rev-1";
      review.providerId = "prov-1";
      review.rating = 1;
      review.status = "published";
      mockReviewRepo.findOne.mockResolvedValue(review);

      // Remaining published review has rating 5
      const goodReview = new ReviewEntity();
      goodReview.id = "rev-2";
      goodReview.providerId = "prov-1";
      goodReview.rating = 5;
      goodReview.status = "published";
      mockReviewRepo.find.mockResolvedValue([goodReview]);

      const provider = new ProviderEntity();
      provider.id = "prov-1";
      provider.rating = 3.0;
      provider.reviewCount = 2;
      mockProviderRepo.findOne.mockResolvedValue(provider);

      const moderated = await reviewsService.moderateReview("rev-1", "hidden");
      expect(moderated.status).toBe("hidden");
      expect(provider.rating).toBe(5);
      expect(provider.reviewCount).toBe(1);
      expect(mockProviderRepo.save).toHaveBeenCalled();
    });
  });
});
