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

  describe("Provider Verification Queue & Contact Status", () => {
    it("should display unverified providers in queue regardless of emailVerified status", async () => {
      const p1 = new ProviderEntity();
      p1.id = "prov-unverified-1";
      p1.userId = "u-doc-1";
      p1.name = "Dr. Merih Tesfaye";
      p1.verified = false;
      p1.status = "pending_verification";

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "u-doc-1",
          email: "dr.merih@hospital.et",
          phone: "+251911223344",
          emailVerified: false,
          isApproved: false,
          status: "pending_verification",
        }),
        find: jest.fn().mockResolvedValue([]),
      };

      const verificationService = new VerificationService(
        { find: jest.fn().mockResolvedValue([p1]) } as any,
        mockReviewRepo,
        mockHistoryRepo,
        mockUserRepo as any
      );

      const queue = await verificationService.getVerificationQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("prov-unverified-1");
      expect(queue[0].name).toBe("Dr. Merih Tesfaye");
      expect(queue[0].emailVerified).toBe(false);
      expect(queue[0].isApproved).toBe(false);
    });

    it("should approve provider, activate user account, and mark emailVerified true", async () => {
      const p = new ProviderEntity();
      p.id = "prov-to-approve";
      p.userId = "u-doc-to-approve";
      p.name = "Dr. Abel Tesfaye";
      p.verified = false;
      p.status = "pending_verification";

      const user = {
        id: "u-doc-to-approve",
        email: "abel@hospital.et",
        phone: "0987654324",
        emailVerified: false,
        isApproved: false,
        status: "pending_verification",
      };

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
      };

      const mockNotifications = {
        sendNotification: jest.fn().mockResolvedValue({}),
      };

      const mockRealtime = {
        emitUserStatusChanged: jest.fn(),
        emitToRoom: jest.fn(),
      };

      const verificationService = new VerificationService(
        {
          findOne: jest.fn().mockResolvedValue(p),
          save: jest.fn().mockImplementation((prov) => Promise.resolve(prov)),
        } as any,
        mockReviewRepo,
        mockHistoryRepo,
        mockUserRepo as any,
        mockNotifications as any,
        mockRealtime as any
      );

      const approved = await verificationService.approveProvider("prov-to-approve", "u-super-admin");
      expect(approved.verified).toBe(true);
      expect(approved.status).toBe("verified");
      expect(user.isApproved).toBe(true);
      expect(user.status).toBe("active");
      expect(user.emailVerified).toBe(true);
      expect(mockNotifications.sendNotification).toHaveBeenCalled();
      expect(mockRealtime.emitUserStatusChanged).toHaveBeenCalledWith("u-doc-to-approve", "active");
    });

    it("should approve provider by prov-<userId> when provider only exists as user in queue", async () => {
      const pendingUser = {
        id: "u-fresh-provider-99",
        name: "Dr. Selamawit",
        email: "selam@merihcare.et",
        phone: "0911000000",
        role: "provider",
        emailVerified: false,
        isApproved: false,
        status: "pending_verification",
      };

      const mockProviderRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      };

      const mockUserRepo = {
        findOne: jest.fn().mockImplementation((query) => {
          return Promise.resolve(pendingUser);
        }),
        save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
      };

      const verificationService = new VerificationService(
        mockProviderRepo as any,
        mockReviewRepo,
        mockHistoryRepo,
        mockUserRepo as any,
        { sendNotification: jest.fn().mockResolvedValue({}) } as any,
        { emitUserStatusChanged: jest.fn(), emitToRoom: jest.fn() } as any
      );

      const approved = await verificationService.approveProvider("prov-u-fresh-provider-99", "u-admin");
      expect(approved).not.toBeNull();
      expect(approved.verified).toBe(true);
      expect(approved.status).toBe("verified");
      expect(approved.available).toBe(true);
      expect(pendingUser.isApproved).toBe(true);
      expect(pendingUser.status).toBe("active");
      expect(pendingUser.emailVerified).toBe(true);
    });

    it("should grant credentials:review and credentials:approve to admin and operations_admin roles", () => {
      const { getEffectivePermissions, Permission } = require("../src/shared/constants/permissions");

      const adminUser = { role: "admin", adminRole: "operations_admin" };
      const perms = getEffectivePermissions(adminUser);
      expect(perms).toContain(Permission.CREDENTIALS_REVIEW);
      expect(perms).toContain(Permission.CREDENTIALS_APPROVE);

      const plainAdmin = { role: "admin" };
      const plainPerms = getEffectivePermissions(plainAdmin);
      expect(plainPerms).toContain(Permission.CREDENTIALS_REVIEW);
      expect(plainPerms).toContain(Permission.CREDENTIALS_APPROVE);
    });
  });

  describe("Textbee Phone Number Domestic Formatting for Ethiopian SIMs", () => {
    it("should format Ethiopian mobile numbers to 10-digit domestic format (09... or 07...)", () => {
      const { formatPhoneForTextbee } = require("../src/modules/notifications/notifications.service");

      expect(formatPhoneForTextbee("+251991607015")).toBe("0991607015");
      expect(formatPhoneForTextbee("251991607015")).toBe("0991607015");
      expect(formatPhoneForTextbee("0991607015")).toBe("0991607015");
      expect(formatPhoneForTextbee("991607015")).toBe("0991607015");
      expect(formatPhoneForTextbee("+251711223344")).toBe("0711223344");
      expect(formatPhoneForTextbee("0711223344")).toBe("0711223344");
      expect(formatPhoneForTextbee("+12025550199")).toBe("+12025550199");
    });
  });
});
