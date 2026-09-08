import { describe, it, expect } from "vitest";
import { validateRealEmail } from "./validation";

describe("validateRealEmail in admin-web", () => {
  it("rejects fake email with single letter domain ssf@f.com and doctor@f.com", () => {
    const resultSsf = validateRealEmail("ssf@f.com");
    expect(resultSsf.isValid).toBe(false);
    expect(resultSsf.error).toBeDefined();

    const resultDoctor = validateRealEmail("doctor@f.com");
    expect(resultDoctor.isValid).toBe(false);
    expect(resultDoctor.error).toMatch(/not a recognized or legitimate email service/i);
  });

  it("rejects fake email with dummy domain test@test.com", () => {
    const result = validateRealEmail("test@test.com");
    expect(result.isValid).toBe(false);
  });

  it("rejects fake single letter domains like doctor@g.com or user@a.org", () => {
    expect(validateRealEmail("doctor@g.com").isValid).toBe(false);
    expect(validateRealEmail("user@a.org").isValid).toBe(false);
  });

  it("rejects dummy usernames like fake@gmail.com and ssf@gmail.com", () => {
    expect(validateRealEmail("ssf@gmail.com").isValid).toBe(false);
    expect(validateRealEmail("fake@gmail.com").isValid).toBe(false);
    expect(validateRealEmail("test@gmail.com").isValid).toBe(false);
  });

  it("rejects repeating synthetic usernames like aaaaa@gmail.com", () => {
    expect(validateRealEmail("aaaaa@gmail.com").isValid).toBe(false);
  });

  it("accepts reputable consumer domains (Gmail, Yahoo, Outlook, Hotmail, iCloud, Proton)", () => {
    expect(validateRealEmail("doctor.merih@gmail.com").isValid).toBe(true);
    expect(validateRealEmail("samuel.nurse@yahoo.com").isValid).toBe(true);
    expect(validateRealEmail("dr.abebe@outlook.com").isValid).toBe(true);
    expect(validateRealEmail("clinician@hotmail.com").isValid).toBe(true);
    expect(validateRealEmail("helen.physio@icloud.com").isValid).toBe(true);
    expect(validateRealEmail("admin@merihcare.et").isValid).toBe(true);
    expect(validateRealEmail("caregiver@proton.me").isValid).toBe(true);
  });

  it("accepts official Ethiopian and institutional health domains", () => {
    expect(validateRealEmail("physician@aau.edu.et").isValid).toBe(true);
    expect(validateRealEmail("officer@moh.gov.et").isValid).toBe(true);
    expect(validateRealEmail("lead@blacklion.hospital").isValid).toBe(true);
  });
});
