import { validateRealEmail, REPUTABLE_CONSUMER_DOMAINS, AuthService } from "../src/modules/auth/auth.service";
import { AuthController } from "../src/modules/auth/auth.controller";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../src/database/entities/user.entity";
import { SessionEntity } from "../src/database/entities/session.entity";

describe("Strict Real-Email Validation Tests", () => {
  it("should have recognized consumer domains defined", () => {
    expect(REPUTABLE_CONSUMER_DOMAINS.has("gmail.com")).toBe(true);
    expect(REPUTABLE_CONSUMER_DOMAINS.has("yahoo.com")).toBe(true);
    expect(REPUTABLE_CONSUMER_DOMAINS.has("outlook.com")).toBe(true);
    expect(REPUTABLE_CONSUMER_DOMAINS.has("hotmail.com")).toBe(true);
    expect(REPUTABLE_CONSUMER_DOMAINS.has("icloud.com")).toBe(true);
  });

  describe("Rejection of Fake and Synthetic Emails", () => {
    it("should strictly reject single-letter fake domains like ssf@f.com", () => {
      expect(() => validateRealEmail("ssf@f.com")).toThrow(/not a recognized or legitimate email service/i);
    });

    it("should strictly reject other single-letter and two-letter dummy domains", () => {
      expect(() => validateRealEmail("doctor@g.com")).toThrow(/not a recognized or legitimate email service/i);
      expect(() => validateRealEmail("doctor@ab.com")).toThrow(/not a recognized or legitimate email service/i);
    });

    it("should reject dummy test domains", () => {
      expect(() => validateRealEmail("doctor@test.com")).toThrow(/real, permanent email/i);
      expect(() => validateRealEmail("doctor@fake.com")).toThrow(/real, permanent email/i);
      expect(() => validateRealEmail("doctor@dummy.com")).toThrow(/real, permanent email/i);
    });

    it("should reject numeric dummy domains and repeated characters", () => {
      expect(() => validateRealEmail("person@123.com")).toThrow(/invalid/i);
      expect(() => validateRealEmail("person@aaa.com")).toThrow(/invalid/i);
    });

    it("should reject synthetic or repeated mailbox usernames", () => {
      expect(() => validateRealEmail("aaa@gmail.com")).toThrow(/synthetic or fake/i);
      expect(() => validateRealEmail("111@yahoo.com")).toThrow(/synthetic or fake/i);
      expect(() => validateRealEmail("asdf@outlook.com")).toThrow(/real personal or professional email/i);
    });

    it("should reject usernames under 3 characters", () => {
      expect(() => validateRealEmail("ab@gmail.com")).toThrow(/at least 3 characters/i);
    });

    it("should reject disposable domains", () => {
      expect(() => validateRealEmail("realuser@mailinator.com")).toThrow(/disposable or temporary/i);
      expect(() => validateRealEmail("realuser@tempmail.com")).toThrow(/disposable or temporary/i);
    });
  });

  describe("Acceptance of Genuine and Institutional Emails", () => {
    it("should accept valid Gmail addresses", () => {
      expect(() => validateRealEmail("dr.merih.tesfaye@gmail.com")).not.toThrow();
      expect(() => validateRealEmail("patient.abebe@googlemail.com")).not.toThrow();
    });

    it("should accept valid Yahoo addresses", () => {
      expect(() => validateRealEmail("merihcare_user@yahoo.com")).not.toThrow();
      expect(() => validateRealEmail("clinical_nurse@ymail.com")).not.toThrow();
    });

    it("should accept valid Microsoft Outlook and Hotmail addresses", () => {
      expect(() => validateRealEmail("dr.kassahun@outlook.com")).not.toThrow();
      expect(() => validateRealEmail("telehealth.patient@hotmail.com")).not.toThrow();
      expect(() => validateRealEmail("contact@live.com")).not.toThrow();
    });

    it("should accept valid Apple iCloud and ProtonMail addresses", () => {
      expect(() => validateRealEmail("ethiopian.doctor@icloud.com")).not.toThrow();
      expect(() => validateRealEmail("secure.practitioner@proton.me")).not.toThrow();
    });

    it("should accept recognized Ethiopian (.et) and hospital/university domains", () => {
      expect(() => validateRealEmail("admin@merihcare.et")).not.toThrow();
      expect(() => validateRealEmail("dr.merih@tikuranbessa.edu.et")).not.toThrow();
      expect(() => validateRealEmail("officer@moh.gov.et")).not.toThrow();
      expect(() => validateRealEmail("faculty@aau.edu.et")).not.toThrow();
    });

    it("should accept recognized medical and health organizations", () => {
      expect(() => validateRealEmail("physician@stpauls.org")).not.toThrow();
    });
  });

  describe("Google OAuth Verification & Provisioning", () => {
    let authController: AuthController;
    const users: any[] = [];
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

    const mockSessionRepo = {
      save: jest.fn().mockImplementation((s) => {
        sessions.push(s);
        return Promise.resolve(s);
      }),
      find: jest.fn().mockResolvedValue([]),
    };

    beforeEach(async () => {
      users.length = 0;
      sessions.length = 0;
      const module: TestingModule = await Test.createTestingModule({
        imports: [JwtModule.register({ secret: "test_secret" })],
        controllers: [AuthController],
        providers: [
          AuthService,
          { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
          { provide: getRepositoryToken(SessionEntity), useValue: mockSessionRepo },
        ],
      }).compile();

      authController = module.get<AuthController>(AuthController);
    });

    it("should provision a new patient signing in with verified Google account", async () => {
      const res = await authController.googleAuth(
        { idToken: "test-google-token:new.patient@gmail.com:Abebe Patient" },
        { headers: {}, ip: "127.0.0.1" } as any
      );

      expect(res.access_token).toBeDefined();
      expect(res.user.email).toBe("new.patient@gmail.com");
      expect(res.user.name).toBe("Abebe Patient");
      expect(res.user.role).toBe("patient");
    });

    it("should register a provider via Google as pending administrator verification", async () => {
      const res = await authController.googleAuth(
        {
          idToken: "test-google-token:dr.newprovider@gmail.com:Dr. New Provider",
          role: "provider",
          specialty: "Pediatrics",
        },
        { headers: {}, ip: "127.0.0.1" } as any
      );

      expect(res.pendingApproval).toBe(true);
      expect(res.message).toMatch(/pending administrator/i);
    });

    it("should reject Google tokens with empty string", async () => {
      await expect(
        authController.googleAuth({ idToken: "" } as any, { headers: {}, ip: "127.0.0.1" } as any)
      ).rejects.toThrow();
    });
  });
});
