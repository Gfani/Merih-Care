import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SignUpDto, LoginDto } from "../src/modules/auth/auth.controller";
import { MoveLocationDto } from "../src/modules/locations/locations.controller";

describe("DTO Validation Tests", () => {
  describe("SignUpDto Validation", () => {
    it("should pass for a valid patient signup payload", async () => {
      const dto = plainToInstance(SignUpDto, {
        name: "Dawit Haile",
        email: "dawit@merihcare.et",
        password: "Password123!",
        phone: "+251911223344",
        role: "patient",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail when password lacks uppercase letter", async () => {
      const dto = plainToInstance(SignUpDto, {
        name: "Dawit Haile",
        email: "dawit@merihcare.et",
        password: "password123!",
        role: "patient",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("matches");
    });

    it("should fail when password is less than 8 characters", async () => {
      const dto = plainToInstance(SignUpDto, {
        name: "Dawit",
        email: "dawit@merihcare.et",
        password: "Pass1!",
        role: "patient",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("minLength");
    });

    it("should fail for invalid email format", async () => {
      const dto = plainToInstance(SignUpDto, {
        name: "Dawit",
        email: "not-an-email",
        password: "Password123!",
        role: "patient",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isEmail");
    });

    it("should fail for invalid role not in whitelist", async () => {
      const dto = plainToInstance(SignUpDto, {
        name: "Dawit",
        email: "dawit@merihcare.et",
        password: "Password123!",
        role: "hacker_role",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("isIn");
    });
  });

  describe("LoginDto Validation", () => {
    it("should pass for valid login payload", async () => {
      const dto = plainToInstance(LoginDto, {
        email: "valid@merihcare.et",
        password: "password123",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail if email is missing or empty", async () => {
      const dto = plainToInstance(LoginDto, {
        password: "password123",
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("MoveLocationDto Validation", () => {
    it("should pass for valid Addis Ababa GPS coordinates", async () => {
      const dto = plainToInstance(MoveLocationDto, {
        latitude: 9.0054,
        longitude: 38.7845,
        accuracy: 10.0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail if latitude exceeds 90 degrees", async () => {
      const dto = plainToInstance(MoveLocationDto, {
        latitude: 95.5,
        longitude: 38.7845,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("max");
    });

    it("should fail if longitude is below -180 degrees", async () => {
      const dto = plainToInstance(MoveLocationDto, {
        latitude: 9.0054,
        longitude: -195.0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty("min");
    });
  });
});
