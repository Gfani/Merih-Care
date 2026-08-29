import { UploadsController } from "../src/modules/uploads/uploads.controller";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { BadRequestException } from "@nestjs/common";

describe("Security - Invalid Uploads & MIME Restrictions Tests", () => {
  let controller: UploadsController;
  let service: UploadsService;

  beforeEach(() => {
    service = new UploadsService();
    controller = new UploadsController(service);
  });

  it("should reject uploads without a file payload", async () => {
    await expect(controller.uploadFile(null)).rejects.toThrow(BadRequestException);
    await expect(controller.uploadFile(undefined)).rejects.toThrow(BadRequestException);
  });

  it("should reject oversized files exceeding the 10MB threshold", async () => {
    const oversizedFile = {
      originalname: "huge-medical-record.pdf",
      mimetype: "application/pdf",
      size: 11 * 1024 * 1024, // 11MB
      buffer: Buffer.alloc(100),
    };

    await expect(controller.uploadFile(oversizedFile)).rejects.toThrow(
      "File size exceeds the 10MB limit"
    );
  });

  it("should reject dangerous and executable file types (.exe, .sh, .php, .js)", async () => {
    const maliciousFiles = [
      { originalname: "payload.exe", mimetype: "application/x-msdownload", size: 1024, buffer: Buffer.from("MZ") },
      { originalname: "exploit.sh", mimetype: "application/x-sh", size: 1024, buffer: Buffer.from("#!/bin/sh") },
      { originalname: "webshell.php", mimetype: "application/x-php", size: 1024, buffer: Buffer.from("<?php") },
      { originalname: "script.js", mimetype: "application/javascript", size: 1024, buffer: Buffer.from("alert(1)") },
    ];

    for (const file of maliciousFiles) {
      await expect(controller.uploadFile(file)).rejects.toThrow(
        "Unsupported file type"
      );
    }
  });

  it("should accept valid permitted document and image file types (PDF, PNG, JPG, WEBP)", async () => {
    const validFile = {
      originalname: "doctor-medical-license.pdf",
      mimetype: "application/pdf",
      size: 500 * 1024, // 500KB
      buffer: Buffer.from("%PDF-1.4"),
    };

    const result = await controller.uploadFile(validFile);
    expect(result).toBeDefined();
    expect(result.fileName).toBe("doctor-medical-license.pdf");
    expect(result.url).toContain("doctor-medical-license.pdf");
  });
});
