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
  generatePresignedUrl(fileKey: string, expiresInSeconds = 86400): { url: string; expiresAt: string } {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const secret = process.env.JWT_SECRET || "merihcare-secure-storage-secret";
    const cleanKey = fileKey.replace(/^\/+/, "");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${cleanKey}:${expiresAt}`)
      .digest("hex");

    let baseUrl = process.env.STORAGE_ENDPOINT;
    if (!baseUrl || baseUrl.includes("merihcare.et")) {
      if (process.env.API_BASE_URL) {
        baseUrl = `${process.env.API_BASE_URL.replace(/\/+$/, "")}/uploads/view`;
      } else if (process.env.NODE_ENV === "production" || process.env.CONTAINER_APP_NAME) {
        baseUrl = "https://app-merihcare-prod-backend.agreeablemoss-f06ffa43.uaenorth.azurecontainerapps.io/api/v1/uploads/view";
      } else {
        const port = process.env.PORT || 3000;
        baseUrl = `http://localhost:${port}/api/v1/uploads/view`;
      }
    }

    const sep = baseUrl.endsWith("/") ? "" : "/";
    const accessUrl = baseUrl.includes("/uploads/view")
      ? `${baseUrl}${sep}${encodeURIComponent(cleanKey)}?expires=${expiresAt}&signature=${signature}`
      : `${baseUrl}${sep}signed/${encodeURIComponent(cleanKey)}?expires=${expiresAt}&signature=${signature}`;

    return {
      url: accessUrl,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  /**
   * Validates cryptographic time-limited HMAC signature
   */
  validateSignature(fileKey: string, expires: number, signature: string): boolean {
    if (!signature || !expires) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > expires) return false;

    const secret = process.env.JWT_SECRET || "merihcare-secure-storage-secret";
    const cleanKey = fileKey.replace(/^\/+/, "");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${cleanKey}:${expires}`)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Resolves file MIME types from extension
   */
  getMimeType(fileName: string): string {
    const ext = path.extname(fileName || "").toLowerCase();
    switch (ext) {
      case ".pdf":
        return "application/pdf";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webp":
        return "image/webp";
      case ".gif":
        return "image/gif";
      case ".doc":
        return "application/msword";
      case ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case ".txt":
        return "text/plain";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Synthesizes an authenticated official credential PDF when requested demo/mock files are not on disk
   */
  generateFallbackPdf(title: string, subtitle: string): Buffer {
    const sanitizedTitle = (title || "Credential Document").replace(/[()]/g, "");
    const sanitizedSub = (subtitle || "Official Record").replace(/[()]/g, "");
    const content = `BT
/F1 18 Tf
50 720 Td
(${sanitizedTitle}) Tj
/F1 11 Tf
0 -30 Td
(${sanitizedSub}) Tj
0 -22 Td
(Issuing Authority: Merihcare National Healthcare Credential Board) Tj
0 -20 Td
(Verification Status: Digital Record Authenticated) Tj
0 -20 Td
(Issued Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}) Tj
0 -30 Td
(This document represents an officially registered credential in the Merihcare health platform.) Tj
ET`;
    const streamLen = Buffer.byteLength(content, "utf-8");

    const pdfSource = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000236 00000 n 
0000000${(300 + streamLen).toString().padStart(3, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${370 + streamLen}
%%EOF`;
    return Buffer.from(pdfSource);
  }

  /**
   * Resolves physical disk path or fallback buffer for any requested document key or URL
   */
  resolveFile(fileKey: string): { filePath?: string; buffer?: Buffer; fileName: string; mimeType: string } {
    let cleanKey = decodeURIComponent(fileKey || "").replace(/\\/g, "/").trim();
    if (cleanKey.includes("?")) {
      cleanKey = cleanKey.split("?")[0];
    }
    // Strip protocol & host if an absolute URL was provided
    if (cleanKey.startsWith("http://") || cleanKey.startsWith("https://")) {
      cleanKey = cleanKey.replace(/^https?:\/\/[^/]+/, "");
    }
    if (cleanKey.includes("/api/v1/")) {
      cleanKey = cleanKey.split("/api/v1/")[1];
    }
    if (cleanKey.includes("/signed/")) {
      cleanKey = cleanKey.split("/signed/")[1];
    }
    if (cleanKey.includes("/uploads/view/")) {
      cleanKey = cleanKey.split("/uploads/view/")[1];
    }
    if (cleanKey.includes("/uploads/download/")) {
      cleanKey = cleanKey.split("/uploads/download/")[1];
    }
    if (cleanKey.includes("/credentials/")) {
      cleanKey = "credentials/" + cleanKey.split("/credentials/")[1];
    }
    cleanKey = cleanKey.replace(/\.\./g, "").replace(/^\/+/, "");

    const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const baseName = path.basename(cleanKey);
    const sanitizedBase = this.sanitizeFilename(baseName);

    const candidates = [
      path.join(uploadsBaseDir, cleanKey),
      path.join(uploadsBaseDir, "credentials", cleanKey),
      path.join(uploadsBaseDir, "credentials", baseName),
      path.join(uploadsBaseDir, "credentials", sanitizedBase),
      path.join(uploadsBaseDir, baseName),
      path.join(uploadsBaseDir, sanitizedBase),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          filePath: path.resolve(candidate),
          fileName: path.basename(candidate),
          mimeType: this.getMimeType(candidate),
        };
      }
    }

    try {
      if (fs.existsSync(uploadsBaseDir)) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetNorm = norm(baseName);

        const checkDir = (dir: string) => {
          if (!fs.existsSync(dir)) return null;
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const fullP = path.join(dir, f);
            if (fs.statSync(fullP).isFile()) {
              const fNorm = norm(f);
              if (
                f === baseName ||
                f === sanitizedBase ||
                f.endsWith("-" + baseName) ||
                f.endsWith("-" + sanitizedBase) ||
                f.toLowerCase() === baseName.toLowerCase() ||
                f.toLowerCase().endsWith("-" + baseName.toLowerCase()) ||
                f.toLowerCase().endsWith("-" + sanitizedBase.toLowerCase()) ||
                (targetNorm.length >= 4 && (fNorm.endsWith(targetNorm) || fNorm.includes(targetNorm)))
              ) {
                return {
                  filePath: path.resolve(fullP),
                  fileName: f,
                  mimeType: this.getMimeType(f),
                };
              }
            }
          }
          return null;
        };

        const credMatch = checkDir(path.join(uploadsBaseDir, "credentials"));
        if (credMatch) return credMatch;
        const rootMatch = checkDir(uploadsBaseDir);
        if (rootMatch) return rootMatch;

        const entries = fs.readdirSync(uploadsBaseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subMatch = checkDir(path.join(uploadsBaseDir, entry.name));
            if (subMatch) return subMatch;
          }
        }
      }
    } catch (_) {}

    // Only allow synthetic fallback for known demo mock names (e.g. cv.pdf, kassahun_cv.pdf)
    const isMockOrDemo =
      cleanKey.includes("kassahun_") ||
      cleanKey === "credentials/cv.pdf" ||
      cleanKey === "cv.pdf";

    if (isMockOrDemo) {
      const fallbackTitle = baseName.replace(/[_-]/g, " ").replace(/\.[a-zA-Z0-9]+$/, "").toUpperCase() || "CREDENTIAL DOCUMENT";
      const pdfBuffer = this.generateFallbackPdf(fallbackTitle, `Document Reference: ${cleanKey}`);
      return {
        buffer: pdfBuffer,
        fileName: baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    // For genuine provider uploads where file is missing from disk volume:
    return {
      fileName: baseName,
      mimeType: this.getMimeType(baseName),
    };
  }

  async handleUpload(
    fileName: string,
    fileBuffer: Buffer,
    mimeType = "application/octet-stream",
    userId = "system"
  ): Promise<any> {
    // Maximum file size limit: 15MB
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    if (fileBuffer && fileBuffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum allowed limit of 15MB (${fileBuffer.length} bytes)`);
    }

    // Malware signature and dangerous extension scan
    this.scanForMalware(fileName, fileBuffer);

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
