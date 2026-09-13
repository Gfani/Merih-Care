import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../src/shared/guards/roles.guard";
import { PermissionsGuard } from "../src/shared/guards/permissions.guard";
import { JwtAuthGuard } from "../src/shared/guards/jwt-auth.guard";
import { JwtService } from "@nestjs/jwt";
import { Permission, ROLE_PERMISSIONS, getEffectivePermissions } from "../src/shared/constants/permissions";
import { UploadsController } from "../src/modules/uploads/uploads.controller";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { DocumentEntity } from "../src/database/entities/document.entity";

describe("Security Boundary & Guard Integration Tests", () => {
  describe("RolesGuard Boundary Checks", () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    const createMockContext = (requiredRoles: string[], user: any) => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(requiredRoles);
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as any;
    };

    it("should reject non-super_admin from super_admin restricted endpoints", () => {
      const financeAdminUser = {
        id: "user-fin-1",
        email: "finance@merihcare.et",
        role: "admin",
        adminRole: "finance_admin",
        roles: ["admin", "patient"],
      };

      const ctx = createMockContext(["super_admin"], financeAdminUser);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("should reject support_admin from super_admin restricted endpoints", () => {
      const supportAdminUser = {
        id: "user-sup-1",
        email: "support@merihcare.et",
        role: "admin",
        adminRole: "support_admin",
        roles: ["admin", "patient"],
      };

      const ctx = createMockContext(["super_admin"], supportAdminUser);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("should reject standard admin from super_admin restricted endpoints", () => {
      const standardAdminUser = {
        id: "user-admin-1",
        email: "regular-admin@merihcare.et",
        role: "admin",
        adminRole: "operations_admin",
        roles: ["admin", "patient"],
      };

      const ctx = createMockContext(["super_admin"], standardAdminUser);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("should permit legitimate super_admin to super_admin restricted endpoints", () => {
      const superAdminUser = {
        id: "user-super-1",
        email: "super@merihcare.et",
        role: "admin",
        adminRole: "super_admin",
        roles: ["admin", "patient"],
      };

      const ctx = createMockContext(["super_admin"], superAdminUser);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });
  });

  describe("PermissionsGuard & Matrix Validation", () => {
    let permissionsGuard: PermissionsGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      permissionsGuard = new PermissionsGuard(reflector);
    });

    const createMockContext = (requiredPermissions: string[], user: any) => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(requiredPermissions);
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as any;
    };

    it("should NOT grant all permissions merely because user has adminRole", () => {
      const financeAdmin = {
        id: "fin-1",
        adminRole: "finance_admin",
        role: "admin",
      };

      const effective = getEffectivePermissions(financeAdmin);
      expect(effective).toContain(Permission.FINANCIAL_READ);
      expect(effective).not.toContain(Permission.ADMINS_WRITE);
      expect(effective).not.toContain(Permission.CREDENTIALS_APPROVE);
      expect(effective).not.toContain(Permission.SETTINGS_WRITE);

      // Guard rejection test for unprivileged operation
      const ctx = createMockContext([Permission.ADMINS_WRITE], financeAdmin);
      expect(() => permissionsGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("should restrict verification admins to verification permissions only", () => {
      const verifier = {
        id: "ver-1",
        adminRole: "verification_admin",
        role: "admin",
      };

      const effective = getEffectivePermissions(verifier);
      expect(effective).toContain(Permission.CREDENTIALS_REVIEW);
      expect(effective).toContain(Permission.CREDENTIALS_APPROVE);
      expect(effective).not.toContain(Permission.FINANCIAL_PAYOUT);
      expect(effective).not.toContain(Permission.ADMINS_DELETE);
    });

    it("should grant all permissions exclusively to super_admin", () => {
      const superAdmin = {
        id: "super-1",
        adminRole: "super_admin",
        role: "admin",
      };

      const effective = getEffectivePermissions(superAdmin);
      expect(effective.length).toBe(Object.values(Permission).length);
      const ctx = createMockContext([Permission.ADMINS_DELETE, Permission.SETTINGS_WRITE], superAdmin);
      expect(permissionsGuard.canActivate(ctx)).toBe(true);
    });
  });

  describe("JwtAuthGuard Fail-Closed tokenVersion Boundary", () => {
    let jwtService: JwtService;

    beforeEach(() => {
      jwtService = new JwtService({ secret: "test_secret" });
    });

    it("should fail-closed when payload is missing tokenVersion", async () => {
      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "u-1",
          email: "user@merihcare.et",
          tokenVersion: 2,
          status: "active",
        }),
      };
      const mockDataSource = {
        isInitialized: true,
        getRepository: () => mockUserRepo,
      } as any;

      const guard = new JwtAuthGuard(jwtService, mockDataSource);
      const token = await jwtService.signAsync({ sub: "u-1" }); // NO tokenVersion

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${token}` },
          }),
        }),
      } as any;

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("should fail-closed when tokenVersion is mismatched", async () => {
      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "u-1",
          email: "user@merihcare.et",
          tokenVersion: 2, // revoked version
          status: "active",
        }),
      };
      const mockDataSource = {
        isInitialized: true,
        getRepository: () => mockUserRepo,
      } as any;

      const guard = new JwtAuthGuard(jwtService, mockDataSource);
      const token = await jwtService.signAsync({ sub: "u-1", tokenVersion: 1 }); // Old version

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${token}` },
          }),
        }),
      } as any;

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("should succeed when tokenVersion matches exactly", async () => {
      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "u-1",
          email: "user@merihcare.et",
          tokenVersion: 3,
          status: "active",
          role: "patient",
        }),
      };
      const mockDataSource = {
        isInitialized: true,
        getRepository: () => mockUserRepo,
      } as any;

      const guard = new JwtAuthGuard(jwtService, mockDataSource);
      const token = await jwtService.signAsync({ sub: "u-1", tokenVersion: 3 });

      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("u-1");
    });
  });

  describe("Medical Credential Document Authorization Boundary", () => {
    let uploadsService: UploadsService;
    let uploadsController: UploadsController;
    let mockDocRepo: any;

    beforeEach(() => {
      mockDocRepo = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
      };
      uploadsService = new UploadsService(mockDocRepo);
      uploadsController = new UploadsController(uploadsService);
    });

    it("should reject signed-url generation for another user's document", async () => {
      mockDocRepo.findOne.mockResolvedValue({
        id: "doc-1",
        fileKey: "provider-1/license.pdf",
        ownerId: "provider-1",
      });

      const maliciousRequest = {
        user: {
          id: "attacker-user-2",
          role: "patient",
          roles: ["patient"],
        },
      };

      await expect(
        uploadsController.getSignedUrl("provider-1/license.pdf", maliciousRequest)
      ).rejects.toThrow(ForbiddenException);
    });

    it("should permit signed-url generation for the document owner", async () => {
      mockDocRepo.findOne.mockResolvedValue({
        id: "doc-1",
        fileKey: "provider-1/license.pdf",
        ownerId: "provider-1",
      });

      const ownerRequest = {
        user: {
          id: "provider-1",
          role: "provider",
          roles: ["provider"],
        },
      };

      const result = await uploadsController.getSignedUrl("provider-1/license.pdf", ownerRequest);
      expect(result).toBeDefined();
      expect(result.url).toContain("provider-1");
      expect(result.expiresAt).toBeDefined();
    });

    it("should permit signed-url generation for verification admin", async () => {
      mockDocRepo.findOne.mockResolvedValue({
        id: "doc-1",
        fileKey: "provider-1/license.pdf",
        ownerId: "provider-1",
      });

      const verifierRequest = {
        user: {
          id: "admin-verifier-1",
          role: "admin",
          adminRole: "verification_admin",
          roles: ["admin"],
        },
      };

      const result = await uploadsController.getSignedUrl("provider-1/license.pdf", verifierRequest);
      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
    });
  });

  describe("CORS Lookalike Domain Rejection Boundary", () => {
    const isDomainAllowed = (origin: string, allowlist: string[]) => {
      if (allowlist.includes(origin)) return true;
      try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname;
        return (
          hostname === "merihcare.live" ||
          hostname.endsWith(".merihcare.live") ||
          hostname === "merihcare.et" ||
          hostname.endsWith(".merihcare.et")
        );
      } catch {
        return false;
      }
    };

    const allowlist = ["https://admin.merihcare.live", "https://merihcare.live", "https://merihcare.et"];

    it("should accept legitimate domain and subdomains", () => {
      expect(isDomainAllowed("https://admin.merihcare.live", allowlist)).toBe(true);
      expect(isDomainAllowed("https://app.merihcare.live", allowlist)).toBe(true);
      expect(isDomainAllowed("https://merihcare.et", allowlist)).toBe(true);
    });

    it("should reject lookalike attack domains ending in merihcare.live", () => {
      expect(isDomainAllowed("https://attackermerihcare.live", allowlist)).toBe(false);
      expect(isDomainAllowed("https://fake-merihcare.live.evil.com", allowlist)).toBe(false);
      expect(isDomainAllowed("https://merihcare.live.attacker.com", allowlist)).toBe(false);
      expect(isDomainAllowed("https://notmerihcare.et", allowlist)).toBe(false);
    });
  });
});

