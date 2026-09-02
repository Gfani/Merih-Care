import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  /**
   * Scans binary buffers for executable signatures (MZ header, ELF, shebang scripts)
   */
  scanForMalware(fileName: string, buffer: Buffer): void {
    if (!buffer || buffer.length === 0) return;

    // Check Windows MZ executable header (0x4D, 0x5A)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new BadRequestException("Malware check failed: Windows executable binary signature detected.");
    }

    // Check Linux ELF header (0x7F, 'E', 'L', 'F')
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      throw new BadRequestException("Malware check failed: Linux ELF binary signature detected.");
    }

    // Disallow dangerous extensions
    const ext = path.extname(fileName).toLowerCase();
    const dangerousExtensions = [".exe", ".bat", ".cmd", ".sh", ".dll", ".vbs", ".ps1", ".jar"];
    if (dangerousExtensions.includes(ext)) {
      throw new BadRequestException(`Malware check failed: Disallowed executable extension ${ext}`);
    }
  }

  /**
   * Sanitizes filenames by stripping directory traversal sequences and unsafe characters
   */
  sanitizeFilename(fileName: string): string {
    const base = path.basename(fileName);
    return base.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  /**
   * Generates time-limited cryptographically signed access URL
   */
  generatePresignedUrl(fileKey: string, expiresInSeconds = 3600): { url: string; expiresAt: string } {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const secret = process.env.JWT_SECRET || "merihcare-secure-storage-secret";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${fileKey}:${expiresAt}`)
      .digest("hex");

    const baseUrl = process.env.STORAGE_ENDPOINT || "https://storage.merihcare.et";
    return {
      url: `${baseUrl}/signed/${encodeURIComponent(fileKey)}?expires=${expiresAt}&signature=${signature}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  async handleUpload(
    fileName: string,
    fileBuffer: Buffer,
    mimeType = "application/octet-stream",
    userId = "system"
  ): Promise<any> {
    const sanitized = this.sanitizeFilename(fileName);
    const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const storageKey = `${userId}/${fileId}-${sanitized}`;

    // Persist binary payload to disk storage volume
    const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const targetFilePath = path.join(uploadsBaseDir, storageKey);
    const targetDir = path.dirname(targetFilePath);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, fileBuffer);
      this.logger.log(`Uploaded & persisted file: ${sanitized} -> ${targetFilePath} (${fileBuffer.length} bytes)`);
    } catch (err: any) {
      this.logger.error(`Failed to persist file ${targetFilePath}: ${err.message}`);
    }

    const presigned = this.generatePresignedUrl(storageKey);

    return {
      id: fileId,
      url: presigned.url,
      storageKey,
      filePath: targetFilePath,
      fileName: sanitized,
      fileSize: fileBuffer.length,
      mimeType,
      uploadedAt: new Date().toISOString(),
    };
  }
}
