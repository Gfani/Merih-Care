import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: any) {
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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException("Unsupported file type. Only JPG, PNG, GIF, WEBP, PDF, and DOC/DOCX files are permitted.");
    }

    return this.uploadsService.handleUpload(file.originalname, file.buffer);
  }
}
