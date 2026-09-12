import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/auth.service";
import { UserEntity } from "../src/database/entities/user.entity";
import { SessionEntity } from "../src/database/entities/session.entity";
import { ProviderEntity } from "../src/database/entities/provider.entity";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";

describe("OAuth Social Authentication (Google & Apple)", () => {
  let authController: AuthController;
  let authService: AuthService;
  const users: any[] = [];
  const providers: any[] = [];
  const sessions: any[] = [];

  const mockUserRepo = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      return Promise.resolve(users.find((u) => u.email === where?.email || u.id === where?.id) || null);
    }),
    save: jest.fn().mockImplementation((user) => {
      const idx = users.findIndex((u) => u.id === user.id || u.email === user.email);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...user };
        return Promise.resolve(users[idx]);
      }
      users.push(user);
      return Promise.resolve(user);
    }),
  };

  const mockProviderRepo = {
    findOne: jest.fn().mockImplementation(({ where }) => {
      return Promise.resolve(providers.find((p) => p.userId === where?.userId || p.id === where?.id) || null);
    }),
    save: jest.fn().mockImplementation((provider) => {
      const idx = providers.findIndex((p) => p.id === provider.id || p.userId === provider.userId);
      if (idx >= 0) {
        providers[idx] = { ...providers[idx], ...provider };
        return Promise.resolve(providers[idx]);
      }
      providers.push(provider);
      return Promise.resolve(provider);
    }),
  };

  const mockSessionRepo = {
    save: jest.fn().mockImplementation((s) => {
      sessions.push(s);
      return Promise.resolve(s);
    }),
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    users.length = 0;
    providers.length = 0;
    sessions.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: "test_jwt_secret" })],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: getRepositoryToken(SessionEntity), useValue: mockSessionRepo },
        { provide: getRepositoryToken(ProviderEntity), useValue: mockProviderRepo },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe("Google OAuth Endpoints", () => {
    it("should provision and authenticate a patient via Google OAuth", async () => {
      const res = await authController.googleAuth(
        { idToken: "test-google-token:patient.google@gmail.com:Google Patient" },
        { headers: { "user-agent": "MobileApp" }, ip: "10.0.0.1" } as any
      );

      expect(res.access_token).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.user.email).toBe("patient.google@gmail.com");
      expect(res.user.role).toBe("patient");
      expect(res.user.hasPatientAccount).toBe(true);
    });

    it("should register a provider via Google and place them in pending verification", async () => {
      const res = await authController.googleAuth(
        {
          idToken: "test-google-token:dr.google@gmail.com:Dr. Google",
          role: "provider",
          specialty: "Cardiology",
          licenseNumber: "ETH-CARD-099",
        },
        { headers: {}, ip: "127.0.0.1" } as any
      );

      expect(res.pendingApproval).toBe(true);
      expect(res.message).toMatch(/pending administrator verification/i);
      expect(res.access_token).toBeUndefined();
    });

    it("should reject Google authentication when account is suspended", async () => {
      users.push({
        id: "u-suspended-google",
        email: "suspended.google@gmail.com",
        name: "Suspended User",
        status: "suspended",
        isApproved: true,
        role: "patient",
      });

      await expect(
        authController.googleAuth(
          { idToken: "test-google-token:suspended.google@gmail.com:Suspended User" },
          { headers: {}, ip: "127.0.0.1" } as any
        )
      ).rejects.toThrow(/Account is suspended/);
    });
  });

  describe("Apple OAuth Endpoints", () => {
    it("should provision and authenticate a patient via Apple OAuth", async () => {
      const res = await authController.appleAuth(
        {
          identityToken: "test-apple-token:patient.apple@icloud.com:Apple Patient:apple-sub-001",
          givenName: "Apple",
          familyName: "Patient",
        },
        { headers: { "user-agent": "iOS-App" }, ip: "10.0.0.2" } as any
      );

      expect(res.access_token).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.user.email).toBe("patient.apple@icloud.com");
      expect(res.user.name).toBe("Apple Patient");
      expect(res.user.role).toBe("patient");
      expect(res.user.hasPatientAccount).toBe(true);
    });

    it("should register a provider via Apple and place them in pending verification", async () => {
      const res = await authController.appleAuth(
        {
          identityToken: "test-apple-token:dr.apple@icloud.com:Dr. Apple:apple-sub-002",
          role: "provider",
          specialty: "Neurology",
          licenseNumber: "ETH-NEURO-777",
        },
        { headers: {}, ip: "127.0.0.1" } as any
      );

      expect(res.pendingApproval).toBe(true);
      expect(res.message).toMatch(/pending administrator verification/i);
      expect(res.access_token).toBeUndefined();
    });

    it("should support Apple private relay emails when only sub is provided", async () => {
      // Mock identity token with sub but empty email
      const res = await authController.appleAuth(
        {
          identityToken: "test-apple-token::Private User:apple-sub-relay-123",
          givenName: "Private",
          familyName: "User",
        },
        { headers: {}, ip: "127.0.0.1" } as any
      );

      expect(res.access_token).toBeDefined();
      expect(res.user.email).toBe("apple-sub-relay-123@privaterelay.appleid.com");
    });

    it("should reject Apple authentication with empty identity token", async () => {
      await expect(
        authController.appleAuth(
          { identityToken: "" } as any,
          { headers: {}, ip: "127.0.0.1" } as any
        )
      ).rejects.toThrow();
    });

    it("should reject Apple authentication when account is suspended", async () => {
      users.push({
        id: "u-suspended-apple",
        email: "suspended.apple@icloud.com",
        name: "Suspended Apple User",
        status: "suspended",
        isApproved: true,
        role: "patient",
      });

      await expect(
        authController.appleAuth(
          { identityToken: "test-apple-token:suspended.apple@icloud.com:Suspended:apple-sub-999" },
          { headers: {}, ip: "127.0.0.1" } as any
        )
      ).rejects.toThrow(/Account is suspended/);
    });
  });
});
