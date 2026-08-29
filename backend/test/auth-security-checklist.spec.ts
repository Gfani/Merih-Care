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
      find: jest.fn().mockResolvedValue([]),
    };

    mockSessionRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
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
      mockUser.passwordResetToken = "849201";
      mockUser.passwordResetExpires = new Date(Date.now() + 10000).toISOString();
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.confirmPasswordReset("patient@merihcare.et", "849201", "NewSecurePass123!");
      expect(result.success).toBe(true);
      expect(mockUser.passwordResetToken).toBeNull();
    });

    it("should reject password reset with invalid token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "patient@merihcare.et";
      mockUser.passwordResetToken = "849201";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.confirmPasswordReset("patient@merihcare.et", "000000", "NewSecurePass123!")
      ).rejects.toThrow("Invalid or expired password reset token");
    });
  });

  describe("Email Verification Flow", () => {
    it("should confirm email verification with matching token", async () => {
      const mockUser = new UserEntity();
      mockUser.id = "u-1";
      mockUser.email = "doctor@merihcare.et";
      mockUser.emailVerificationToken = "571923";
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await authService.confirmEmailVerification("doctor@merihcare.et", "571923");
      expect(result.success).toBe(true);
      expect(mockUser.emailVerified).toBe(true);
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
});
