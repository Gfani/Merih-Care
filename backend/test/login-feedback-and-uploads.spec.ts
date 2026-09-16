import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/auth.service";
import { UploadsController } from "../src/modules/uploads/uploads.controller";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../src/database/entities/user.entity";
import { SessionEntity } from "../src/database/entities/session.entity";
import { ProviderEntity } from "../src/database/entities/provider.entity";
import * as bcrypt from "bcryptjs";

describe("Granular Login Feedback & Credential Uploads", () => {
  describe("AuthService.validateUser Feedback", () => {
    let authService: AuthService;
    const mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    };
    const mockSessionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const mockProviderRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
          { provide: getRepositoryToken(SessionEntity), useValue: mockSessionRepo },
          { provide: getRepositoryToken(ProviderEntity), useValue: mockProviderRepo },
          { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        ],
      }).compile();

      authService = module.get<AuthService>(AuthService);
    });

    it("should throw specific UnauthorizedException when user account is not registered", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        authService.validateUser("unregistered@merihcare.et", "AnyPass123!")
      ).rejects.toThrow(
        "Account not registered: No account found with this email, username, or phone number. Please check your spelling or register a new account."
      );
    });

    it("should throw specific UnauthorizedException when password does not match", async () => {
      const hashedPassword = await bcrypt.hash("CorrectPassword123!", 10);
      const existingUser = {
        id: "u-123",
        email: "doctor@merihcare.et",
        phone: "+251911000111",
        password: hashedPassword,
        status: "active",
        isApproved: true,
        role: "patient",
        loginAttempts: 0,
      };
      mockUserRepo.findOne.mockResolvedValue(existingUser);

      await expect(
        authService.validateUser("doctor@merihcare.et", "WrongPassword123!")
      ).rejects.toThrow(
        "Incorrect password: The password you entered is incorrect. Please check your password or use 'Forgot Password' to reset it."
      );
      expect(existingUser.loginAttempts).toBe(1);
    });

    it("should successfully return user profile when credentials are correct", async () => {
      const password = "CorrectPassword123!";
      const hashedPassword = await bcrypt.hash(password, 10);
      const existingUser = {
        id: "u-123",
        email: "doctor@merihcare.et",
        password: hashedPassword,
        status: "active",
        isApproved: true,
        role: "patient",
        loginAttempts: 0,
      };
      mockUserRepo.findOne.mockResolvedValue(existingUser);

      const result = await authService.validateUser("doctor@merihcare.et", password);
      expect(result).toBeDefined();
      expect(result.id).toBe("u-123");
      expect(result.password).toBeUndefined();
      expect(result.loginAttempts).toBe(0);
    });
  });

  describe("UploadsController.uploadCredential Unauthenticated Upload", () => {
    let uploadsController: UploadsController;
    let uploadsService: UploadsService;

    beforeEach(() => {
      uploadsService = new UploadsService();
      uploadsController = new UploadsController(uploadsService);
    });

    it("should allow credential upload during provider registration without JWT token", async () => {
      const mockFile = {
        originalname: "medical-license.pdf",
        mimetype: "application/pdf",
        size: 1024,
        buffer: Buffer.from("%PDF-1.4 mock license payload"),
      };

      const result = await uploadsController.uploadCredential(mockFile, {});
      expect(result).toBeDefined();
      expect(result.fileName).toContain("medical-license.pdf");
      expect(result.storageKey).toContain("credentials/");
      expect(result.url).toContain("signature=");
    });
  });
});
