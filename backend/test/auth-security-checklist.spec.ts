import { AuthService } from "../src/modules/auth/auth.service";
import { UsersService } from "../src/modules/users/users.service";
import { UserEntity } from "../src/database/entities/user.entity";
import { SessionEntity } from "../src/database/entities/session.entity";
import * as bcrypt from "bcryptjs";

describe("Auth & User Security Checklist Tests", () => {
  let authService: AuthService;
  let usersService: UsersService;
  let mockUserRepo: any;
  let mockSessionRepo: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((user) => Promise.resolve(user)),
      remove: jest.fn().mockImplementation((user) => Promise.resolve(user)),
      find: jest.fn().mockResolvedValue([]),
    };

    mockSessionRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue("mock-jwt-token"),
      verifyAsync: jest.fn().mockResolvedValue({ sub: "u-1" }),
    };

    authService = new AuthService(mockUserRepo, mockSessionRepo, mockJwtService);
    usersService = new UsersService(mockUserRepo);
  });

  describe("Password Reset Flow", () => {
    it("should issue password reset token for registered user", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset("patient@merihcare.et");
      expect(result.success).toBe(true);
      expect(mockUser.passwordResetToken).toBeDefined();
    });

    it("should confirm password reset with valid token and update password", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.passwordResetToken = (authService as any).hashToken("849201");
      mockUser.passwordResetExpires = new Date(Date.now() + 10000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.confirmPasswordReset("patient@merihcare.et", "849201", "NewSecurePass123!");
      expect(result.success).toBe(true);
      expect(mockUser.passwordResetToken).toBeNull();
    });

    it("should reject invalid password reset token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.passwordResetToken = (authService as any).hashToken("849201");
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.confirmPasswordReset("patient@merihcare.et", "000000", "NewSecurePass123!")
      ).rejects.toThrow("Invalid or expired password reset token");
    });

    it("should return uniform response when phone number does not match user account to prevent enumeration", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.phone = "+251911223344";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset("patient@merihcare.et", "sms", {
        email: "patient@merihcare.et",
        phone: "0999887766",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("If an account matches the provided identifier");
    });

    it("should accept password reset request when phone number matches user account in different formats", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.phone = "+251911223344";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset("patient@merihcare.et", "sms", {
        email: "patient@merihcare.et",
        phone: "0911223344",
      });
      expect(result.success).toBe(true);
      expect(result.channel).toBe("sms");
    });

    it("should return uniform response via SMS fallback when user account has no phone registered", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "nophone@merihcare.et";
      mockUser.phone = null;
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset("nophone@merihcare.et", "sms", {
        email: "nophone@merihcare.et",
        phone: "0911223344",
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("If an account matches the provided identifier");
    });

    it("should reject password reset confirmation if phone does not match user account", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.phone = "+251911223344";
      mockUser.passwordResetToken = (authService as any).hashToken("849201");
      mockUser.passwordResetExpires = new Date(Date.now() + 10000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.confirmPasswordReset("patient@merihcare.et", "849201", "NewSecurePass123!", {
          email: "patient@merihcare.et",
          phone: "0999887766",
        })
      ).rejects.toThrow("The entered phone number is not associated with this user account");
    });
  });

  describe("Email Verification Flow", () => {
    it("should confirm email verification with matching token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "doctor@merihcare.et";
      mockUser.emailVerificationToken = (authService as any).hashToken("571923");
      mockUser.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.confirmEmailVerification("doctor@merihcare.et", "571923");
      expect(result.success).toBe(true);
      expect(mockUser.emailVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeNull();
      expect(mockUser.emailVerificationExpires).toBeNull();
    });

    it("should reject expired email verification token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "doctor@merihcare.et";
      mockUser.emailVerificationToken = (authService as any).hashToken("571923");
      mockUser.emailVerificationExpires = new Date(Date.now() - 1000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.confirmEmailVerification("doctor@merihcare.et", "571923")
      ).rejects.toThrow("Email verification token has expired");
    });

    it("should reject invalid email verification token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "doctor@merihcare.et";
      mockUser.emailVerificationToken = (authService as any).hashToken("571923");
      mockUser.emailVerificationExpires = new Date(Date.now() + 100000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.confirmEmailVerification("doctor@merihcare.et", "000000")
      ).rejects.toThrow("Invalid email verification token");
    });
  });

  describe("Session Invalidation & Revocation", () => {
    it("should revoke all active sessions for a user", async () => {
      const s1 = new SessionEntity();
      s1.id = "s-1";
      s1.userId = "u-1";
      s1.isRevoked = false;

      const s2 = new SessionEntity();
      s2.id = "s-2";
      s2.userId = "u-1";
      s2.isRevoked = false;

      mockSessionRepo.find.mockResolvedValue([s1, s2]);

      await authService.revokeAllUserSessions("u-1");
      expect(s1.isRevoked).toBe(true);
      expect(s2.isRevoked).toBe(true);
    });
  });

  describe("Account Lockout Policy", () => {
    it("should increment login attempts and lock account on 5 consecutive failures", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "test@merihcare.et";
      mockUser.password = await bcrypt.hash("correct-pass", 10);
      mockUser.loginAttempts = 4;
      mockUser.status = "active";
      mockUser.isApproved = true;

      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.validateUser("test@merihcare.et", "wrong-pass");
      expect(result).toBeNull();
      expect(mockUser.loginAttempts).toBe(5);
      expect(mockUser.lockoutUntil).toBeDefined();
    });
  });

  describe("User Role Update & Reactivation", () => {
    it("should update user role", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.role = "patient";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const updated = await usersService.updateUserRole("u-1", "verifier");
      expect(updated.role).toBe("verifier");
    });

    it("should reactivate a suspended user and clear lockout", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.status = "suspended";
      mockUser.lockoutUntil = "2026-08-30";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const updated = await usersService.reactivateUser("u-1");
      expect(updated.status).toBe("active");
      expect(updated.lockoutUntil).toBeNull();
    });
  });

  describe("Suspension Notification & Multi-Role Verification", () => {
    it("should throw explicit suspension message when suspended user attempts login", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-suspended";
      mockUser.email = "suspended@merihcare.et";
      mockUser.status = "suspended";
      mockUser.isApproved = true;
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.validateUser("suspended@merihcare.et", "SomePassword123!")
      ).rejects.toThrow("Your account has been suspended by administration. Please contact support");
    });

    it("should create multi-role session including patient, provider, and admin roles", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-omni";
      mockUser.name = "Omni User";
      mockUser.email = "omni@merihcare.et";
      mockUser.role = "admin";
      mockUser.adminRole = "operations_admin";
      mockUser.roles = "patient,provider,admin";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const session = await authService.createSession("u-omni", "TestAgent", "127.0.0.1");
      expect(session.user.roles).toContain("patient");
      expect(session.user.roles).toContain("provider");
      expect(session.user.roles).toContain("admin");
      expect(session.user.hasAdminAccount).toBe(true);
      expect(session.user.hasPatientAccount).toBe(true);
    });
  });

  describe("Administrator Role-Based Deletion & Quorum Protection", () => {
    let adminService: any;
    const { AdminService } = require("../src/modules/admin/admin.service");

    beforeEach(() => {
      adminService = new AdminService(mockUserRepo, mockSessionRepo);
    });

    it("should prevent non-super administrators from deleting administrators", async () => {
      const nonSuperActor = new UserEntity();
      nonSuperActor.id = "u-actor";
      nonSuperActor.email = "ops@merihcare.et";
      nonSuperActor.adminRole = "operations_admin";

      const targetAdmin = new UserEntity();
      targetAdmin.id = "u-target";
      targetAdmin.email = "target@merihcare.et";
      targetAdmin.adminRole = "support_admin";

      mockUserRepo.findOne
        .mockResolvedValueOnce(targetAdmin)
        .mockResolvedValueOnce(nonSuperActor);

      await expect(
        adminService.deleteAdministrator("u-actor", "u-target")
      ).rejects.toThrow("Only super administrators have permission to delete administrators");
    });

    it("should prevent deleting the last remaining super administrator", async () => {
      const actorSuper = new UserEntity();
      actorSuper.id = "u-actor";
      actorSuper.email = "super1@merihcare.et";
      actorSuper.adminRole = "super_admin";

      const targetSuper = new UserEntity();
      targetSuper.id = "u-target";
      targetSuper.email = "super2@merihcare.et";
      targetSuper.adminRole = "super_admin";

      mockUserRepo.findOne
        .mockResolvedValueOnce(targetSuper)
        .mockResolvedValueOnce(actorSuper);
      mockUserRepo.count = jest.fn().mockResolvedValue(1);

      await expect(
        adminService.deleteAdministrator("u-actor", "u-target")
      ).rejects.toThrow("Cannot delete the last remaining super administrator account");
    });

    it("should allow a super administrator to delete an admin when quorum is preserved", async () => {
      const superActor = new UserEntity();
      superActor.id = "u-actor";
      superActor.email = "super1@merihcare.et";
      superActor.adminRole = "super_admin";

      const targetSuper = new UserEntity();
      targetSuper.id = "u-target";
      targetSuper.email = "super2@merihcare.et";
      targetSuper.adminRole = "super_admin";

      mockUserRepo.findOne
        .mockResolvedValueOnce(targetSuper)
        .mockResolvedValueOnce(superActor);
      mockUserRepo.count = jest.fn().mockResolvedValue(2);
      mockUserRepo.remove.mockResolvedValue(targetSuper);

      const result = await adminService.deleteAdministrator("u-actor", "u-target");
      expect(result.success).toBe(true);
      expect(mockSessionRepo.delete).toHaveBeenCalledWith({ userId: "u-target" });
      expect(mockUserRepo.remove).toHaveBeenCalledWith(targetSuper);
    });
  });
});
