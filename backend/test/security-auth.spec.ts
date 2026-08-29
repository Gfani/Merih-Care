import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../src/shared/guards/jwt-auth.guard";
import { RolesGuard } from "../src/shared/guards/roles.guard";
import { Reflector } from "@nestjs/core";
import { ExecutionContext, UnauthorizedException, ForbiddenException } from "@nestjs/common";

describe("Security - Authentication, Expired Tokens & Authorization Tests", () => {
  const jwtSecret = "super-secret-jwt-key-2026";
  let jwtService: JwtService;
  let reflector: Reflector;
  let jwtGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    jwtService = new JwtService({ secret: jwtSecret });
    reflector = new Reflector();
    jwtGuard = new JwtAuthGuard(jwtService);
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (authHeader?: string, user?: any, requiredRoles?: string[]): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader,
      },
      user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  describe("Token Expiration & Signature Security", () => {
    it("should reject expired JWT access tokens", async () => {
      // Create a token expired 10 seconds ago
      const expiredToken = jwtService.sign(
        { sub: "user-123", email: "patient@merihcare.et", role: "patient" },
        { expiresIn: -10 }
      );

      const context = createMockContext(`Bearer ${expiredToken}`);
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject tokens signed with a forged or different secret key", async () => {
      const forgedJwtService = new JwtService({ secret: "attacker-fake-secret-key" });
      const forgedToken = forgedJwtService.sign({
        sub: "user-attacker",
        email: "attacker@evil.com",
        role: "admin",
      });

      const context = createMockContext(`Bearer ${forgedToken}`);
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject malformed and missing Bearer authorization headers", async () => {
      const emptyHeaderContext = createMockContext(undefined);
      await expect(jwtGuard.canActivate(emptyHeaderContext)).rejects.toThrow(UnauthorizedException);

      const malformedHeaderContext = createMockContext("Basic dXNlcjpwYXNz");
      await expect(jwtGuard.canActivate(malformedHeaderContext)).rejects.toThrow(UnauthorizedException);

      const invalidTokenFormatContext = createMockContext("Bearer not-a-valid-token-format");
      await expect(jwtGuard.canActivate(invalidTokenFormatContext)).rejects.toThrow(UnauthorizedException);
    });

    it("should validate and allow properly signed active tokens", async () => {
      const validToken = jwtService.sign(
        { sub: "user-valid", email: "user@merihcare.et", role: "patient" },
        { expiresIn: "1h" }
      );

      const context = createMockContext(`Bearer ${validToken}`);
      const result = await jwtGuard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe("Role-Based Privilege Escalation Prevention", () => {
    it("should prevent a patient from accessing admin-only endpoints", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin", "super_admin"]);

      const patientContext = createMockContext(undefined, {
        sub: "patient-1",
        email: "patient@merihcare.et",
        role: "patient",
      });

      expect(() => rolesGuard.canActivate(patientContext)).toThrow(ForbiddenException);
    });

    it("should prevent a provider from accessing platform finance administration", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["finance_admin", "super_admin"]);

      const providerContext = createMockContext(undefined, {
        sub: "provider-1",
        email: "provider@merihcare.et",
        role: "provider",
      });

      expect(() => rolesGuard.canActivate(providerContext)).toThrow(ForbiddenException);
    });

    it("should grant access when user holds the authorized role", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin", "super_admin"]);

      const adminContext = createMockContext(undefined, {
        sub: "admin-1",
        email: "admin@merihcare.et",
        role: "admin",
      });

      expect(rolesGuard.canActivate(adminContext)).toBe(true);
    });
  });
});
