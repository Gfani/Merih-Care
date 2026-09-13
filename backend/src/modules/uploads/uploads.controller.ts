import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import { Response } from "express";
import { UploadsService } from "./uploads.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("credential")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async uploadCredential(@UploadedFile() file: any, @Req() req?: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException("Credential file size exceeds the 10MB limit");
    }

    // Permitted file types: images and documents
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Unsupported file type. Only PDF, DOC/DOCX, PNG, and JPG files are permitted for provider credentials."
      );
    }

    // Scan for malware & executable headers
    this.uploadsService.scanForMalware(file.originalname, file.buffer);

    const sanitizedName = this.uploadsService.sanitizeFilename(file.originalname);
    const userId = req?.user?.id || "credentials";
    return this.uploadsService.handleUpload(sanitizedName, file.buffer, file.mimetype, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: any, @Req() req?: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException("File size exceeds the 10MB limit");
    }

    // Permitted file types: images and documents
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Unsupported file type. Only JPG, PNG, GIF, WEBP, PDF, and DOC/DOCX files are permitted."
      );
    }

    // Scan for malware & executable headers
    this.uploadsService.scanForMalware(file.originalname, file.buffer);

    const sanitizedName = this.uploadsService.sanitizeFilename(file.originalname);
    const userId = req?.user?.id || "user-1";

    return this.uploadsService.handleUpload(sanitizedName, file.buffer, file.mimetype, userId);
  }

  @Get("signed-url")
  @UseGuards(JwtAuthGuard)
  async getSignedUrl(@Query("fileKey") fileKey: string, @Req() req: any) {
    if (!fileKey) {
      throw new BadRequestException("fileKey query parameter is required");
    }
    const cleanKey = fileKey.replace(/^\/+/, "");
    const doc = await this.uploadsService.getDocumentByFileKey(cleanKey);
    const userId = req.user?.id;
    const isOwner = doc ? doc.ownerId === userId : cleanKey.startsWith(userId + "/");
    const isVerifier = doc && doc.verifierId === userId;
    const hasReviewPerm =
      req.user?.role === "super_admin" ||
      req.user?.adminRole === "super_admin" ||
      req.user?.adminRole === "verification_admin" ||
      req.user?.adminRole === "verifier" ||
      (Array.isArray(req.user?.permissions) && req.user.permissions.includes("credentials:review"));

    if (!isOwner && !isVerifier && !hasReviewPerm) {
      throw new ForbiddenException("Cannot generate signed URL for another user's document");
    }
    return this.uploadsService.generatePresignedUrl(cleanKey);
  }

  @Get("view/:fileKey(*)")
  async viewFileWithKey(
    @Param("fileKey") fileKey: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    await this.assertAuthorizedFileAccess(fileKey, expires, signature, req);
    return this.serveFile(fileKey, false, res);
  }

  @Get("view")
  async viewFileWithQuery(
    @Query("fileKey") fileKey: string,
    @Query("url") url: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const key = fileKey || url || "";
    await this.assertAuthorizedFileAccess(key, expires, signature, req);
    return this.serveFile(key, false, res);
  }

  @Get("download/:fileKey(*)")
  async downloadFileWithKey(
    @Param("fileKey") fileKey: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    await this.assertAuthorizedFileAccess(fileKey, expires, signature, req);
    return this.serveFile(fileKey, true, res);
  }

  @Get("download")
  async downloadFileWithQuery(
    @Query("fileKey") fileKey: string,
    @Query("url") url: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const key = fileKey || url || "";
    await this.assertAuthorizedFileAccess(key, expires, signature, req);
    return this.serveFile(key, true, res);
  }

  private async assertAuthorizedFileAccess(
    fileKey: string,
    expires?: string,
    signature?: string,
    req?: any
  ): Promise<void> {
    if (!fileKey) {
      throw new BadRequestException("File key or URL is required");
    }

    // 1. Verify cryptographic HMAC signature if provided
    if (signature && expires) {
      const expNum = parseInt(expires, 10);
      const isValid = this.uploadsService.validateSignature(fileKey, expNum, signature);
      if (isValid) return;
      throw new ForbiddenException("Invalid or expired presigned document URL");
    }

    // 2. Database-backed authorization for authenticated callers
    const user = req?.user;
    if (user) {
      const cleanKey = fileKey.replace(/^\/+/, "");
      const doc = await this.uploadsService.getDocumentByFileKey(cleanKey);
      const isOwner = doc ? doc.ownerId === user.id : cleanKey.startsWith(user.id + "/");
      const isVerifier = doc && doc.verifierId === user.id;
      const isAuthorizedAdmin =
        user.role === "super_admin" ||
        user.adminRole === "super_admin" ||
        user.adminRole === "verification_admin" ||
        user.adminRole === "verifier" ||
        (Array.isArray(user.permissions) && user.permissions.includes("credentials:review"));

      if (isOwner || isVerifier || isAuthorizedAdmin) return;
    }

    // 3. Demo credentials in development/testing only
    if (process.env.NODE_ENV !== "production") {
      const cleanKey = fileKey.replace(/^\/+/, "");
      if (cleanKey === "cv.pdf" || cleanKey === "credentials/cv.pdf" || cleanKey.includes("kassahun_")) {
        return;
      }
    }

    throw new ForbiddenException(
      "Access denied: Document requires a valid presigned URL or authenticated administrative access."
    );
  }

  private serveFile(fileKey: string, asAttachment: boolean, res: Response) {
    if (!fileKey) {
      throw new BadRequestException("File key or URL is required");
    }

    const { filePath, buffer, fileName, mimeType } = this.uploadsService.resolveFile(fileKey);

    const disposition = asAttachment ? "attachment" : "inline";
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    if (filePath) {
      return res.sendFile(filePath);
    } else if (buffer) {
      return res.end(buffer);
    } else {
      throw new NotFoundException("Document could not be located");
    }
  }
}

