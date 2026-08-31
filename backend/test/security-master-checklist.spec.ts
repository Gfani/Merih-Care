import * as fs from "fs";
import * as path from "path";
import { encrypt, decrypt } from "../src/shared/utils/crypto";

describe("Security Master Checklist Verification", () => {
  const rootDir = path.resolve(__dirname, "../../");
  const backendDocsDir = path.join(rootDir, "backend/docs/security");

  describe("Security Documentation Standards", () => {
    it("should have comprehensive security governance policy", () => {
      const policyPath = path.join(backendDocsDir, "security-policy.md");
      expect(fs.existsSync(policyPath)).toBe(true);
      const content = fs.readFileSync(policyPath, "utf-8");
      expect(content).toContain("AES-256-GCM");
      expect(content).toContain("ValidationPipe");
      expect(content).toContain("HMAC SHA-256");
    });

    it("should have formal incident response plan and severity SLA", () => {
      const incidentPath = path.join(backendDocsDir, "incident-response-process.md");
      expect(fs.existsSync(incidentPath)).toBe(true);
      const content = fs.readFileSync(incidentPath, "utf-8");
      expect(content).toContain("Sev 1 (Critical)");
      expect(content).toContain("Containment");
    });

    it("should have vulnerability scanning and dependency patching workflows", () => {
      expect(fs.existsSync(path.join(backendDocsDir, "vulnerability-scanning.md"))).toBe(true);
      expect(fs.existsSync(path.join(backendDocsDir, "dependency-patching-workflow.md"))).toBe(true);
    });
  });

  describe("Cryptographic PHI Integrity", () => {
    it("should reliably encrypt and decrypt sensitive health data using AES-256 GCM", () => {
      const sensitiveNote = "Patient diagnosed with stage 2 hypertension. Prescribed daily medication.";
      const ciphertext = encrypt(sensitiveNote);

      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toEqual(sensitiveNote);
      expect(ciphertext.length).toBeGreaterThan(32);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toEqual(sensitiveNote);
    });
  });
});
