import { 
  Controller, Get, Post, Delete, Param, Body, UseGuards, 
  Req, UseInterceptors, UploadedFile, BadRequestException, Query 
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MedicalRecordsService } from "./medical.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateRecordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  diagnosis: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  notes: string;

  @ApiProperty({ required: false })
  @IsOptional()
  attachments?: any;
}

export class GrantConsentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  providerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  durationDays?: number;
}

export class AcceptPolicyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  version: string;
}

export class ReportIncidentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;
}

@Controller("medical-records")
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Get(":patientId")
  async getRecords(
    @Param("patientId") patientId: string, 
    @Req() req: any
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const role = req.user?.role;
    const perms = req.user?.permissions || [];
    const adminRole = req.user?.adminRole;
    return this.medicalRecordsService.getRecords(
      patientId, 
      actorId, 
      role, 
      perms, 
      adminRole, 
      req.ip, 
      req.headers["user-agent"]
    );
  }

  @Post(":patientId")
  async createRecord(
    @Param("patientId") patientId: string,
    @Body() body: CreateRecordDto,
    @Req() req: any
  ) {
    const providerId = req.user?.id || req.user?.sub;
    // Check if the writer is indeed a provider
    if (req.user?.role !== "provider") {
      throw new BadRequestException("Only providers can create medical records.");
    }
    return this.medicalRecordsService.createRecord(
      patientId, 
      providerId, 
      body.diagnosis, 
      body.notes, 
      body.attachments, 
      req.ip, 
      req.headers["user-agent"]
    );
  }

  @Post("consent/grant")
  async grantConsent(@Body() body: GrantConsentDto, @Req() req: any) {
    const patientId = req.user?.id || req.user?.sub;
    return this.medicalRecordsService.grantConsent(patientId, body.providerId, body.durationDays || 30);
  }

  @Delete("consent/revoke/:providerId")
  async revokeConsent(@Param("providerId") providerId: string, @Req() req: any) {
    const patientId = req.user?.id || req.user?.sub;
    return this.medicalRecordsService.revokeConsent(patientId, providerId);
  }

  @Post("policy/accept")
  async acceptPolicy(@Body() body: AcceptPolicyDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.medicalRecordsService.acceptPrivacyPolicy(userId, body.version);
  }

  @Post("incidents")
  async reportIncident(@Body() body: ReportIncidentDto, @Req() req: any) {
    const reporterId = req.user?.id || req.user?.sub;
    return this.medicalRecordsService.reportIncident(reporterId, body.title, body.description);
  }

  @Get(":patientId/export")
  async exportData(@Param("patientId") patientId: string, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    const role = req.user?.role;
    const perms = req.user?.permissions || [];
    const adminRole = req.user?.adminRole;

    await this.medicalRecordsService.verifyAccess(patientId, actorId, role, perms, adminRole);
    return this.medicalRecordsService.exportPatientData(patientId, req.ip, req.headers["user-agent"]);
  }

  @Delete(":patientId/delete-account")
  async deleteAccount(@Param("patientId") patientId: string, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    if (actorId !== patientId && req.user?.role !== "admin") {
      throw new BadRequestException("Unauthorized to trigger account deletion.");
    }
    await this.medicalRecordsService.deletePatientAccount(patientId);
    return { success: true, message: "Account records and personal data deleted." };
  }

  @Post("admin/backup")
  async backupDatabase(@Req() req: any) {
    if (req.user?.role !== "admin" || req.user?.adminRole !== "super_admin") {
      throw new BadRequestException("Only super admins can trigger encrypted database backups.");
    }
    const path = await this.medicalRecordsService.backupAndEncryptDatabase();
    return { success: true, backupPath: path };
  }

  @Post("upload/medical-file")
  @UseInterceptors(FileInterceptor("file"))
  async uploadMedicalFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    this.medicalRecordsService.validateAndScanFile(
      file.originalname, 
      file.buffer, 
      file.mimetype, 
      file.size
    );
    const filename = await this.medicalRecordsService.saveSecureMedicalFile(file.originalname, file.buffer);
    return { success: true, secureFilename: filename };
  }
}
