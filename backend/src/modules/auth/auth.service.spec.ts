import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import * as bcrypt from "bcryptjs";

describe("AuthService Unit Tests", () => {
  let service: AuthService;
  let jwtService: JwtService;

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

  const mockProviderRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("mock_jwt_token"),
            verifyAsync: jest.fn().mockResolvedValue({ sub: "u-1", email: "test@merihcare.et", role: "patient" }),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: mockSessionRepo,
        },
        {
          provide: getRepositoryToken(ProviderEntity),
          useValue: mockProviderRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe("Password Hashing", () => {
    it("should hash password with bcrypt salt rounds", async () => {
      const hashed = await service.hashPassword("Password123!");
      expect(hashed).toBeDefined();
      expect(hashed).not.toEqual("Password123!");
      const isMatch = await bcrypt.compare("Password123!", hashed);
      expect(isMatch).toBe(true);
    });
  });

  describe("validateUser", () => {
    it("should return user without password on valid credentials", async () => {
      const hashed = await bcrypt.hash("Password123!", 10);
      const mockUser = {
        id: "u-1",
        email: "patient@merihcare.et",
        password: hashed,
        status: "active",
        isApproved: true,
        loginAttempts: 0,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.validateUser("patient@merihcare.et", "Password123!");
      expect(result).toBeDefined();
      expect(result.id).toEqual("u-1");
      expect(result.password).toBeUndefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it("should increment login attempts and lock out user after 5 failed attempts", async () => {
      const hashed = await bcrypt.hash("CorrectPassword123!", 10);
      const mockUser: any = {
        id: "u-1",
        email: "patient@merihcare.et",
        password: hashed,
        status: "active",
        isApproved: true,
        loginAttempts: 4,
        lockoutUntil: null,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.validateUser("patient@merihcare.et", "WrongPassword!");
      expect(result).toBeNull();
      expect(mockUser.loginAttempts).toBe(5);
      expect(mockUser.lockoutUntil).toBeDefined();
    });

    it("should throw error if account is locked and lockout time is active", async () => {
      const lockoutTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const mockUser = {
        id: "u-1",
        email: "patient@merihcare.et",
        status: "active",
        isApproved: true,
        lockoutUntil: lockoutTime,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.validateUser("patient@merihcare.et", "Password123!"))
        .rejects.toThrow(/Account locked/);
    });

    it("should throw error if user account is suspended", async () => {
      const mockUser = {
        id: "u-1",
        email: "suspended@merihcare.et",
        status: "suspended",
        isApproved: true,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.validateUser("suspended@merihcare.et", "Password123!"))
        .rejects.toThrow("Account is suspended");
    });

    it("should throw error if user account is pending approval", async () => {
      const mockUser = {
        id: "u-1",
        email: "pending@merihcare.et",
        status: "active",
        isApproved: false,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.validateUser("pending@merihcare.et", "Password123!"))
        .rejects.toThrow("Account is pending administrator approval");
    });
  });

  describe("registerUser", () => {
    it("should register new patient user and auto-approve", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const user = await service.registerUser("Test User", "new@merihcare.et", "Password123!", "patient", undefined, "+251911000000");

      expect(user).toBeDefined();
      expect(user.email).toBe("new@merihcare.et");
      expect(user.role).toBe("patient");
      expect(user.isApproved).toBe(true);
      expect(user.phone).toBe("+251911000000");
    });

    it("should throw if user email already exists", async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: "u-existing" });

      await expect(service.registerUser("Duplicate", "dup@merihcare.et", "Password123!", "patient"))
        .rejects.toThrow("User already exists");
    });

    it("should require adminRole if registering as admin", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.registerUser("Admin", "admin_new@merihcare.et", "Password123!", "admin"))
        .rejects.toThrow("Admin accounts require a specified admin role");
    });

    it("should reject disposable or temporary email addresses", async () => {
      await expect(
        service.registerUser("Fake User", "doctor@mailinator.com", "SecureDoc2026!", "provider")
      ).rejects.toThrow("Disposable or temporary email addresses are not permitted");

      await expect(
        service.registerUser("Fake User 2", "scam@tempmail.com", "SecureDoc2026!", "patient")
      ).rejects.toThrow("Disposable or temporary email addresses are not permitted");
    });

    it("should reject passwords that are too short or lack complexity", async () => {
      await expect(
        service.registerUser("User", "valid@merihcare.et", "short", "patient")
      ).rejects.toThrow("Password must be at least 8 characters long");

      await expect(
        service.registerUser("User", "valid@merihcare.et", "alllowercase123", "patient")
      ).rejects.toThrow("Password must contain at least 1 uppercase letter");
    });

    it("should reject provider registration missing mandatory medical credentials", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.registerUser("Dr. Abebe", "abebe.md@merihcare.et", "SecureDoc2026!", "provider", undefined, "+251911223344", {
          title: "Dr.",
          specialty: "General Medicine",
          licenseNumber: "", // Missing
          education: "MD - AAU",
          hospitalAffiliation: "Tikur Anbessa",
          cvUrl: "https://storage.merihcare.et/cv.pdf"
        })
      ).rejects.toThrow("Medical license or registration number is required");
    });

    it("should successfully register provider with full credentials and set pending_verification", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));
      mockProviderRepo.save.mockImplementation((p) => Promise.resolve(p));

      const user = await service.registerUser(
        "Dr. Abebe",
        "abebe.md@merihcare.et",
        "SecureDoc2026!",
        "provider",
        undefined,
        "+251911223344",
        {
          title: "Dr.",
          specialty: "Cardiology",
          licenseNumber: "ETH-MED-99214",
          experience: 8,
          education: "MD, Cardiology - AAU",
          hospitalAffiliation: "Tikur Anbessa Specialized Hospital",
          cvUrl: "https://storage.merihcare.et/cv.pdf",
          licenseDocumentUrl: "https://storage.merihcare.et/license.pdf",
          idDocumentUrl: "https://storage.merihcare.et/id.pdf"
        }
      );

      expect(user).toBeDefined();
      expect(user.role).toBe("provider");
      expect(user.isApproved).toBe(false);
      expect(user.status).toBe("pending_verification");
      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          licenseNumber: "ETH-MED-99214",
          specialty: "Cardiology",
          education: "MD, Cardiology - AAU",
          hospitalAffiliation: "Tikur Anbessa Specialized Hospital",
          cvUrl: "https://storage.merihcare.et/cv.pdf",
          status: "pending_verification",
          verified: false,
        })
      );
    });
  });

  describe("Sessions & Tokens", () => {
    it("should create active session and return access and refresh tokens", async () => {
      const mockUser = {
        id: "u-1",
        name: "Test",
        email: "test@merihcare.et",
        role: "patient",
        mfaEnabled: false,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockSessionRepo.save.mockImplementation((s) => Promise.resolve(s));

      const sessionData = await service.createSession("u-1", "TestAgent", "127.0.0.1");
      expect(sessionData).toHaveProperty("access_token");
      expect(sessionData).toHaveProperty("refresh_token");
      expect(sessionData.user).toBeDefined();
      expect(mockSessionRepo.save).toHaveBeenCalled();
    });

    it("should fetch active sessions for user", async () => {
      mockSessionRepo.find.mockResolvedValue([{ id: "s-1", userId: "u-1", isRevoked: false }]);

      const sessions = await service.getActiveSessions("u-1");
      expect(sessions.length).toBe(1);
      expect(mockSessionRepo.find).toHaveBeenCalledWith({ where: { userId: "u-1", isRevoked: false } });
    });
  });

  describe("MFA & Profile", () => {
    it("should complete MFA setup by saving secret and setting mfaEnabled", async () => {
      const mockUser = { id: "u-1", mfaEnabled: false, mfaSecret: null };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      await service.completeMfaSetup("u-1", "JBSWY3DPEHPK3PXP");
      expect(mockUser.mfaEnabled).toBe(true);
      expect(mockUser.mfaSecret).toBe("JBSWY3DPEHPK3PXP");
      expect(mockUserRepo.save).toHaveBeenCalledWith(mockUser);
    });

    it("should retrieve user profile excluding password", async () => {
      const mockUser = { id: "u-1", name: "Tigist", email: "t@m.et", password: "hashed_pass" };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const profile = await service.getUserById("u-1");
      expect(profile).toBeDefined();
      expect(profile.password).toBeUndefined();
      expect(profile.email).toBe("t@m.et");
    });
  });
});
