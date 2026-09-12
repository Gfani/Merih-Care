import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ForbiddenException, UnauthorizedException, BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/auth.service";
import { AdminService } from "../src/modules/admin/admin.service";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { RolesGuard } from "../src/shared/guards/roles.guard";
import { JwtAuthGuard } from "../src/shared/guards/jwt-auth.guard";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserEntity } from "../src/database/entities/user.entity";
import { SessionEntity } from "../src/database/entities/session.entity";
import * as bcrypt from "bcryptjs";

describe("Security Audit Remediation Test Suite", () => {
  let authService: AuthService;
  let adminService: AdminService;
  let uploadsService: UploadsService;
  let rolesGuard: RolesGuard;
  let jwtService: JwtService;

  const mockUserRepo: any = {
    users: [] as UserEntity[],
    findOne: jest.fn(async ({ where }) => {
      return mockUserRepo.users.find((u: any) => {
        for (const k of Object.keys(where)) {
          if (u[k] !== where[k]) return false;
        }
        return true;
      }) || null;
    }),
    save: jest.fn(async (u) => {
      const idx = mockUserRepo.users.findIndex((existing: any) => existing.id === u.id);
      if (idx !== -1) {
        mockUserRepo.users[idx] = { ...mockUserRepo.users[idx], ...u };
        return mockUserRepo.users[idx];
      }
      mockUserRepo.users.push(u);
      return u;
    }),
    delete: jest.fn(async () => ({ affected: 1 })),
    remove: jest.fn(async (u) => {
      mockUserRepo.users = mockUserRepo.users.filter((existing: any) => existing.id !== u.id);
    }),
  };

  const mockSessionRepo: any = {
    sessions: [] as SessionEntity[],
    find: jest.fn(async ({ where }) => {
      return mockSessionRepo.sessions.filter((s: any) => {
        if (where.userId && s.userId !== where.userId) return false;
        if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
        return true;
      });
    }),
    findOne: jest.fn(async ({ where }) => {
      return mockSessionRepo.sessions.find((s: any) => {
        for (const k of Object.keys(where)) {
          if (s[k] !== where[k]) return false;
        }
        return true;
      }) || null;
    }),
    save: jest.fn(async (s) => {
      const idx = mockSessionRepo.sessions.findIndex((existing: any) => existing.id === s.id);
      if (idx !== -1) {
        mockSessionRepo.sessions[idx] = { ...mockSessionRepo.sessions[idx], ...s };
        return mockSessionRepo.sessions[idx];
      }
      mockSessionRepo.sessions.push(s);
      return s;
    }),
    delete: jest.fn(async () => ({ affected: 1 })),
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: "test-remediation-secret" });
    authService = new AuthService(
      mockUserRepo,
      mockSessionRepo,
      jwtService,
      {} as any,
      {} as any,
      {} as any,
    );
    adminService = new AdminService(
      mockUserRepo,
      mockSessionRepo,
    );
    uploadsService = new UploadsService();
    rolesGuard = new RolesGuard(new Reflector());
  });


  beforeEach(() => {
    mockUserRepo.users = [];
    mockSessionRepo.sessions = [];
    delete process.env.NODE_ENV;
  });

  describe("1. Privilege Escalation Prevention in Role Switching", () => {
    it("should reject a patient attempting to self-promote to admin", async () => {
      const patient = new UserEntity();
      patient.id = "patient-victim-1";
      patient.email = "patient@gmail.com";
      patient.role = "patient";
      patient.roles = "patient";
      patient.isApproved = true;
      patient.status = "active";
      patient.tokenVersion = 0;
      await mockUserRepo.save(patient);

      await expect(
        authService.switchActiveRole(patient.id, "admin")
      ).rejects.toThrow(ForbiddenException);

      const refreshed = await mockUserRepo.findOne({ where: { id: patient.id } });
      expect(refreshed.role).toBe("patient");
      expect(refreshed.roles).toBe("patient");
    });

    it("should allow switching only among roles already granted to the user", async () => {
      const dualUser = new UserEntity();
      dualUser.id = "dual-user-1";
      dualUser.email = "clinician@gmail.com";
      dualUser.role = "patient";
      dualUser.roles = "patient,provider";
      dualUser.isApproved = true;
      dualUser.status = "active";
      dualUser.tokenVersion = 0;
      await mockUserRepo.save(dualUser);

      const result = await authService.switchActiveRole(dualUser.id, "provider");
      expect(result.success).toBe(true);
      expect(result.activeRole).toBe("provider");
      expect(result.access_token).toBeDefined();

      const refreshed = await mockUserRepo.findOne({ where: { id: dualUser.id } });
      expect(refreshed.role).toBe("provider");
      expect(refreshed.roles).toBe("patient,provider");
    });
  });

  describe("2. OAuth Cryptographic Verification & Mock Token Prohibitions", () => {
    it("should strictly reject mock Google tokens when NODE_ENV=production", async () => {
      process.env.NODE_ENV = "production";
      await expect(
        authService.googleAuth("test-google-token:attacker@gmail.com:Attacker")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should strictly reject mock Apple tokens when NODE_ENV=production", async () => {
      process.env.NODE_ENV = "production";
      await expect(
        authService.appleAuth("test-apple-token:attacker@icloud.com:Attacker")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject forged unsigned Google tokens", async () => {
      delete process.env.NODE_ENV;
      const forgedToken = "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImZvcmdlZEBnbWFpbC5jb20ifQ.";
      await expect(
        authService.googleAuth(forgedToken)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("3. Strict Granular RBAC in RolesGuard", () => {
    it("should deny a support or finance admin access to super_admin endpoints", () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
      const guard = new RolesGuard(reflector);

      const contextMock: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "admin-finance-1",
              email: "finance@merihcare.et",
              role: "admin",
              adminRole: "finance_admin",
              roles: ["admin"],
            },
          }),
        }),
      };

      expect(() => guard.canActivate(contextMock)).toThrow(ForbiddenException);
    });

    it("should grant access to super_admin when user has super_admin role", () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
      const guard = new RolesGuard(reflector);

      const contextMock: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "super-1",
              email: "fanuelgoitom79@gmail.com",
              role: "admin",
              adminRole: "super_admin",
              roles: ["admin"],
            },
          }),
        }),
      };

      expect(guard.canActivate(contextMock)).toBe(true);
    });
  });

  describe("4. Session Revocation Ownership (IDOR Prevention)", () => {
    it("should reject revoking another user's session ID", async () => {
      const session = new SessionEntity();
      session.id = "s-alice-123";
      session.userId = "user-alice";
      session.refreshToken = "hash";
      session.isRevoked = false;
      session.tokenExpires = new Date(Date.now() + 100000).toISOString();
      session.lastActive = new Date().toISOString();
      await mockSessionRepo.save(session);

      await expect(
        authService.revokeSessionById("user-bob-attacker", "s-alice-123")
      ).rejects.toThrow(NotFoundException);

      const check = await mockSessionRepo.findOne({ where: { id: "s-alice-123" } });
      expect(check.isRevoked).toBe(false);
    });

    it("should permit revoking a session owned by the authenticated caller", async () => {
      const session = new SessionEntity();
      session.id = "s-alice-456";
      session.userId = "user-alice";
      session.refreshToken = "hash";
      session.isRevoked = false;
      session.tokenExpires = new Date(Date.now() + 100000).toISOString();
      session.lastActive = new Date().toISOString();
      await mockSessionRepo.save(session);

      await authService.revokeSessionById("user-alice", "s-alice-456");

      const check = await mockSessionRepo.findOne({ where: { id: "s-alice-456" } });
      expect(check.isRevoked).toBe(true);
    });

    it("should omit hashed refresh tokens from active session listings", async () => {
      const session = new SessionEntity();
      session.id = "s-alice-789";
      session.userId = "user-alice";
      session.refreshToken = "secret-bcrypt-hash";
      session.isRevoked = false;
      session.tokenExpires = new Date(Date.now() + 100000).toISOString();
      session.lastActive = new Date().toISOString();
      session.userAgent = "Chrome";
      session.ipAddress = "127.0.0.1";
      await mockSessionRepo.save(session);

      const active = await authService.getActiveSessions("user-alice");
      expect(active.length).toBe(1);
      expect((active[0] as any).refreshToken).toBeUndefined();
      expect(active[0].userAgent).toBe("Chrome");
    });
  });

  describe("5. Token Versioning & Session Revocation Verification", () => {
    it("should reject an access token when user tokenVersion has incremented after logout", async () => {
      const user = new UserEntity();
      user.id = "user-session-test";
      user.email = "session@gmail.com";
      user.role = "patient";
      user.status = "active";
      user.tokenVersion = 0;
      await mockUserRepo.save(user);

      // 1. Issue access token with tokenVersion 0
      const tokenV0 = await jwtService.signAsync({
        sub: user.id,
        email: user.email,
        tokenVersion: 0,
      });

      // 2. Mock datasource for guard
      const mockDataSource: any = {
        isInitialized: true,
        getRepository: () => mockUserRepo,
      };
      const guard = new JwtAuthGuard(jwtService, mockDataSource);

      const contextMock: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${tokenV0}` },
          }),
        }),
      };

      // V0 token is valid initially
      expect(await guard.canActivate(contextMock)).toBe(true);

      // 3. User logs out or revokes sessions -> tokenVersion increments to 1
      await authService.revokeAllUserSessions(user.id);
      const updatedUser = await mockUserRepo.findOne({ where: { id: user.id } });
      expect(updatedUser.tokenVersion).toBe(1);

      // 4. Old V0 access token must now be rejected immediately
      await expect(guard.canActivate(contextMock)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("6. Password Reset Security: Uniform Responses & OTP Guessing Lockout", () => {
    it("should return a uniform response even if the account does not exist", async () => {
      const res = await authService.requestPasswordReset("nonexistent.user@merihcare.com", "email");
      expect(res.success).toBe(true);
      expect(res.message).toContain("If an account matches the provided identifier");
    });

    it("should lock out password reset after 5 incorrect OTP attempts", async () => {
      const user = new UserEntity();
      user.id = "user-otp-test";
      user.email = "victim.otp@gmail.com";
      user.password = "OldPassword123!";
      user.role = "patient";
      user.status = "active";
      user.passwordResetToken = (authService as any).hashToken("123456");
      user.passwordResetExpires = new Date(Date.now() + 300000).toISOString();
      user.failedResetAttempts = 0;
      await mockUserRepo.save(user);

      // 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await expect(
          authService.confirmPasswordReset(user.email, "000000", "NewPass123!@#")
        ).rejects.toThrow(BadRequestException);
      }

      const userAfter4 = await mockUserRepo.findOne({ where: { id: user.id } });
      expect(userAfter4.failedResetAttempts).toBe(4);
      expect(userAfter4.passwordResetToken).toBeDefined();

      // 5th failed attempt: must trigger token invalidation
      await expect(
        authService.confirmPasswordReset(user.email, "000000", "NewPass123!@#")
      ).rejects.toThrow(/Too many incorrect attempts/);

      const lockedUser = await mockUserRepo.findOne({ where: { id: user.id } });
      expect(lockedUser.passwordResetToken).toBeNull();
    });
  });

  describe("7. Admin Password & Profile Scoping to Authenticated Actor", () => {
    it("should update only the authenticated administrator account", async () => {
      const adminA = new UserEntity();
      adminA.id = "admin-a-id";
      adminA.email = "admina@merihcare.et";
      adminA.name = "Admin Alpha";
      adminA.role = "admin";
      await mockUserRepo.save(adminA);

      const adminB = new UserEntity();
      adminB.id = "admin-b-id";
      adminB.email = "adminb@merihcare.et";
      adminB.name = "Admin Beta";
      adminB.role = "admin";
      await mockUserRepo.save(adminB);

      // Admin B updates profile using their actorId
      await adminService.updateAdminProfile("admin-b-id", "Admin Beta Updated", "adminb.new@merihcare.et");

      const refreshedA = await mockUserRepo.findOne({ where: { id: "admin-a-id" } });
      const refreshedB = await mockUserRepo.findOne({ where: { id: "admin-b-id" } });

      expect(refreshedA.name).toBe("Admin Alpha");
      expect(refreshedB.name).toBe("Admin Beta Updated");
    });

    it("should reject updateAdminPasswordForUser if target user is not an administrator", async () => {
      const patient = new UserEntity();
      patient.id = "patient-target-id";
      patient.email = "patient.target@gmail.com";
      patient.role = "patient";
      patient.roles = "patient";
      await mockUserRepo.save(patient);

      await expect(
        adminService.updateAdminPasswordForUser("super@merihcare.et", "patient-target-id", "NewAdminPass123!")
      ).rejects.toThrow(/Target user is not an administrator account/);
    });

    it("should reject resetting the superior administrator password by another admin", async () => {
      const superior = new UserEntity();
      superior.id = "superior-id";
      superior.email = "fanuelgoitom79@gmail.com";
      superior.role = "admin";
      superior.adminRole = "super_admin";
      await mockUserRepo.save(superior);

      await expect(
        adminService.updateAdminPasswordForUser("other.admin@merihcare.et", "superior-id", "NewAdminPass123!")
      ).rejects.toThrow(/Only the superior administrator can reset their own password/);
    });
  });

  describe("8. Presigned Document Verification", () => {
    it("should validate legitimate HMAC presigned URLs and reject forged or expired URLs", () => {
      process.env.JWT_SECRET = "secure-test-key-1234";
      const presigned = uploadsService.generatePresignedUrl("credentials/doctor_license.pdf", 3600);
      const url = new URL(presigned.url);
      const expires = parseInt(url.searchParams.get("expires")!, 10);
      const signature = url.searchParams.get("signature")!;

      // Valid signature succeeds
      expect(uploadsService.validateSignature("credentials/doctor_license.pdf", expires, signature)).toBe(true);

      // Tampered file key fails
      expect(uploadsService.validateSignature("credentials/other_doctor.pdf", expires, signature)).toBe(false);

      // Expired timestamp fails
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 100;
      expect(uploadsService.validateSignature("credentials/doctor_license.pdf", expiredTimestamp, signature)).toBe(false);
    });
  });
});
