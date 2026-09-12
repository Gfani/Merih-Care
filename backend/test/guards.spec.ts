import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../src/shared/guards/jwt-auth.guard";
import { RolesGuard } from "../src/shared/guards/roles.guard";

describe("Authorization & Guards Tests", () => {
  describe("RolesGuard", () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    function createMockContext(user: any): ExecutionContext {
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as any;
    }

    it("should allow access if no roles are required on route", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(null);
      const context = createMockContext(null);

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it("should allow access when user role matches required role", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin", "super_admin"]);
      const context = createMockContext({ id: "u-1", role: "admin" });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it("should throw ForbiddenException when user role does not match", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
      const context = createMockContext({ id: "u-patient", role: "patient" });

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if user is not attached to request", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["provider"]);
      const context = createMockContext(undefined);

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should grant access to multi-role account holding both patient and provider roles", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["provider"]);
      const context = createMockContext({
        id: "u-multi",
        role: "patient",
        roles: ["patient", "provider"],
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it("should grant access to superior admin email on admin-restricted endpoints", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin", "super_admin"]);
      const context = createMockContext({
        id: "u-superior",
        email: "fanuelgoitom79@gmial.com",
        role: "patient",
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe("JwtAuthGuard", () => {
    let jwtGuard: JwtAuthGuard;
    let mockJwtService: Partial<JwtService>;

    beforeEach(() => {
      mockJwtService = {
        verifyAsync: jest.fn(),
      };
      jwtGuard = new JwtAuthGuard(mockJwtService as JwtService);
    });

    function createMockHttpContext(authHeader?: string): { context: ExecutionContext; req: any } {
      const req: any = { headers: { authorization: authHeader } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
      return { context, req };
    }

    it("should throw UnauthorizedException if authorization header is missing", async () => {
      const { context } = createMockHttpContext(undefined);
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if header is not Bearer format", async () => {
      const { context } = createMockHttpContext("Basic 12345");
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject mock-jwt-token-xyz when token verification fails", async () => {
      (mockJwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("Invalid token"));
      const { context } = createMockHttpContext("Bearer mock-jwt-token-xyz");
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should verify valid JWT token and attach payload to req.user", async () => {
      const payload = { sub: "u-123", email: "user@merihcare.et", role: "patient" };
      (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const { context, req } = createMockHttpContext("Bearer valid.jwt.token");
      const result = await jwtGuard.canActivate(context);

      expect(result).toBe(true);
      expect(req.user).toEqual(payload);
    });

    it("should throw UnauthorizedException if JWT verification fails (e.g. expired)", async () => {
      (mockJwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("Token expired"));

      const { context } = createMockHttpContext("Bearer expired.jwt.token");
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject immediately if user was removed from the database", async () => {
      const payload = { sub: "u-removed", email: "removed@merihcare.et", role: "admin" };
      (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const mockDataSource = {
        isInitialized: true,
        getRepository: jest.fn().mockReturnValue(mockUserRepo),
      };

      const guardWithDb = new JwtAuthGuard(mockJwtService as JwtService, mockDataSource as any);
      const { context } = createMockHttpContext("Bearer valid.jwt.token");

      await expect(guardWithDb.canActivate(context)).rejects.toThrow("Your account has been removed. Access denied.");
    });

    it("should reject immediately with clear message if user account is suspended", async () => {
      const payload = { sub: "u-suspended", email: "suspended@merihcare.et", role: "provider" };
      (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({ id: "u-suspended", status: "suspended", role: "provider" }),
      };
      const mockDataSource = {
        isInitialized: true,
        getRepository: jest.fn().mockReturnValue(mockUserRepo),
      };

      const guardWithDb = new JwtAuthGuard(mockJwtService as JwtService, mockDataSource as any);
      const { context } = createMockHttpContext("Bearer valid.jwt.token");

      await expect(guardWithDb.canActivate(context)).rejects.toThrow("Your account has been suspended by administration. Please contact support.");
    });
  });
});
