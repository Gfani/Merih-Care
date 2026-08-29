import { Test, TestingModule } from "@nestjs/testing";
import { AuthController, LoginDto, SignUpDto } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { UnauthorizedException } from "@nestjs/common";

describe("Auth Integration Tests", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockSessionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: "test_jwt_secret" })],
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: mockSessionRepo,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe("POST /auth/signup", () => {
    it("should successfully sign up a patient and return an active session", async () => {
      mockUserRepo.findOne.mockImplementation(({ where }: any) => {
        if (where?.email) return Promise.resolve(null);
        if (where?.id) return Promise.resolve({ id: where.id, email: "abebe@merihcare.et", name: "Abebe Bikila", role: "patient" });
        return Promise.resolve(null);
      });
      mockUserRepo.save.mockImplementation((u) => {
        u.id = "u-new-1";
        u.isApproved = true;
        return Promise.resolve(u);
      });
      mockSessionRepo.save.mockImplementation((s) => Promise.resolve(s));

      const signupDto: SignUpDto = {
        name: "Abebe Bikila",
        email: "abebe@merihcare.et",
        password: "Password123!",
        phone: "+251911122334",
        role: "patient",
      };

      const mockReq: any = { headers: { "user-agent": "MobileApp" }, ip: "127.0.0.1" };
      const response = await controller.signup(signupDto, mockReq);

      expect(response).toBeDefined();
      expect(response).toHaveProperty("access_token");
      expect(response).toHaveProperty("refresh_token");
      expect(response.user.email).toBe("abebe@merihcare.et");
    });

    it("should map department to admin role for administrative registrations", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const signupDto: SignUpDto = {
        name: "Admin Staff",
        email: "staff@merihcare.et",
        password: "Password123!",
        department: "operations",
      };

      const mockReq: any = { headers: {}, ip: "127.0.0.1" };
      const response = await controller.signup(signupDto, mockReq);

      expect(response).toBeDefined();
      expect(response.message).toContain("Pending administrator approval");
    });
  });

  describe("POST /auth/login", () => {
    it("should login active user successfully and return tokens", async () => {
      const mockUser = {
        id: "u-101",
        email: "patient@merihcare.et",
        password: "hashed_password",
        status: "active",
        isApproved: true,
        loginAttempts: 0,
      };

      jest.spyOn(authService, "validateUser").mockResolvedValue(mockUser);
      jest.spyOn(authService, "createSession").mockResolvedValue({
        access_token: "mock_access_token",
        refresh_token: "mock_refresh_token",
        user: mockUser,
      });

      const loginDto: LoginDto = {
        email: "patient@merihcare.et",
        password: "Password123!",
      };

      const mockReq: any = { headers: {}, ip: "127.0.0.1" };
      const result = await controller.login(loginDto, mockReq);

      expect(result).toHaveProperty("access_token");
      expect(result.user.id).toBe("u-101");
    });

    it("should reject login with Invalid credentials when validation fails", async () => {
      jest.spyOn(authService, "validateUser").mockResolvedValue(null);

      const loginDto: LoginDto = {
        email: "invalid@merihcare.et",
        password: "WrongPassword!",
      };

      const mockReq: any = { headers: {}, ip: "127.0.0.1" };
      await expect(controller.login(loginDto, mockReq)).rejects.toThrow(UnauthorizedException);
    });

    it("should prompt for MFA code if mfaEnabled is true on user", async () => {
      const mockMfaUser = {
        id: "u-mfa",
        email: "mfa@merihcare.et",
        status: "active",
        isApproved: true,
        mfaEnabled: true,
        mfaSecret: "JBSWY3DPEHPK3PXP",
      };

      jest.spyOn(authService, "validateUser").mockResolvedValue(mockMfaUser);

      const loginDto: LoginDto = {
        email: "mfa@merihcare.et",
        password: "Password123!",
      };

      const mockReq: any = { headers: {}, ip: "127.0.0.1" };
      const result = await controller.login(loginDto, mockReq);

      expect(result).toHaveProperty("mfaRequired", true);
      expect(result).toHaveProperty("userId", "u-mfa");
    });
  });

  describe("GET /auth/profile", () => {
    it("should return sanitized profile for logged in user", async () => {
      const mockProfile = { id: "u-1", name: "Tigist", email: "tigist@merihcare.et", role: "patient" };
      jest.spyOn(authService, "getUserById").mockResolvedValue(mockProfile);

      const mockReq: any = { user: { sub: "u-1", role: "patient" } };
      const profile = await controller.getProfile(mockReq);

      expect(profile).toBeDefined();
      expect(profile.id).toBe("u-1");
      expect(profile.name).toBe("Tigist");
    });
  });
});
