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
  @UseInterceptors(FileInterceptor("file"))
  async uploadCredential(@UploadedFile() file: any) {
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
    return this.uploadsService.handleUpload(sanitizedName, file.buffer, file.mimetype, "credentials");
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
  async getSignedUrl(@Query("fileKey") fileKey: string) {
    if (!fileKey) {
      throw new BadRequestException("fileKey query parameter is required");
    }
    return this.uploadsService.generatePresignedUrl(fileKey);
  }

  @Get("view/:fileKey(*)")
  async viewFileWithKey(
    @Param("fileKey") fileKey: string,
    @Res() res: Response
  ) {
    return this.serveFile(fileKey, false, res);
  }

  @Get("view")
  async viewFileWithQuery(
    @Query("fileKey") fileKey: string,
    @Query("url") url: string,
    @Res() res: Response
  ) {
    const key = fileKey || url || "";
    return this.serveFile(key, false, res);
  }

  @Get("download/:fileKey(*)")
  async downloadFileWithKey(
    @Param("fileKey") fileKey: string,
    @Res() res: Response
  ) {
    return this.serveFile(fileKey, true, res);
  }

  @Get("download")
  async downloadFileWithQuery(
    @Query("fileKey") fileKey: string,
    @Query("url") url: string,
    @Res() res: Response
  ) {
    const key = fileKey || url || "";
    return this.serveFile(key, true, res);
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
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (filePath) {
      return res.sendFile(filePath);
    } else if (buffer) {
      return res.end(buffer);
    } else {
      throw new NotFoundException("Document could not be located");
    }
  }
}
