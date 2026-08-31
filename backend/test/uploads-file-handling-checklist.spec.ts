import { UploadsService } from "../src/modules/uploads/uploads.service";

describe("Uploads & File Handling Checklist Tests", () => {
  let service: UploadsService;

  beforeEach(() => {
    service = new UploadsService();
  });

  describe("Malware Signature Scanning & Executable Rejection", () => {
    it("should reject Windows MZ binary executable header", () => {
      // 0x4D, 0x5A = 'M', 'Z'
      const mzBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
      expect(() => service.scanForMalware("photo.png", mzBuffer)).toThrow(
        "Windows executable binary signature detected"
      );
    });

    it("should reject Linux ELF binary header", () => {
      // 0x7F, 'E', 'L', 'F'
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]);
      expect(() => service.scanForMalware("document.pdf", elfBuffer)).toThrow(
        "Linux ELF binary signature detected"
      );
    });

    it("should reject dangerous executable file extensions", () => {
      const benignBuffer = Buffer.from("echo malicious");
      expect(() => service.scanForMalware("payload.bat", benignBuffer)).toThrow(
        "Disallowed executable extension"
      );
    });

    it("should pass benign image buffer", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => service.scanForMalware("medical-license.png", pngBuffer)).not.toThrow();
    });
  });

  describe("Filename Sanitization", () => {
    it("should strip directory traversal and unsafe characters from filename", () => {
      const dirty = "../../../etc/passwd;malware.png";
      const sanitized = service.sanitizeFilename(dirty);
      expect(sanitized).not.toContain("../");
      expect(sanitized).not.toContain(";");
    });
  });

  describe("Signed URL Generation & Upload Result", () => {
    it("should generate cryptographically signed time-limited access URL", () => {
      const result = service.generatePresignedUrl("prov-1/lic-123.pdf", 3600);
      expect(result.url).toContain("signature=");
      expect(result.url).toContain("expires=");
      expect(result.expiresAt).toBeDefined();
    });

    it("should handle valid file upload and return storage metadata", async () => {
      const validBuffer = Buffer.from("PDF-1.4 sample content");
      const res = await service.handleUpload("xray.pdf", validBuffer, "application/pdf", "user-101");
      expect(res.id).toBeDefined();
      expect(res.fileName).toBe("xray.pdf");
      expect(res.fileSize).toBe(validBuffer.length);
      expect(res.url).toContain("signature=");
    });
  });
});
