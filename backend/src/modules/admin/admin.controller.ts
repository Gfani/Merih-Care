import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards, Req, BadRequestException, Optional } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthService } from "../auth/auth.service";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { verifyTOTP } from "../../shared/utils/totp";
import { IsNotEmpty, IsEmail, IsOptional, IsBoolean, IsNumberString, MaxLength, MinLength, Matches, Length } from "class-validator";

export class CreateAdminDto {
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  adminRole?: string;

  @IsOptional()
  department?: string;

  @IsOptional()
  phone?: string;
}

export class ResetAdminPasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifs: boolean;

  @IsOptional()
  @IsBoolean()
  smsNotifs: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode: boolean;

  @IsOptional()
  @IsNumberString()
  @MaxLength(5)
  commissionRate: string;

  @IsOptional()
  @IsNumberString()
  @MaxLength(10)
  minPayout: string;
}

export class UpdateProfileDto {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsEmail()
  @MaxLength(100)
  email: string;
}

export class UpdatePasswordDto {
  @IsNotEmpty()
  @MaxLength(100)
  currentPassword;

  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { 
    message: "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character" 
  })
  newPassword;
}

export class VerifyMfaDto {
  @IsNotEmpty()
  @Length(32, 32)
  secret: string;

  @IsNotEmpty()
  @Length(6, 6)
  @IsNumberString()
  otpToken: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    @Optional()
    private readonly scheduledTasks?: ScheduledTasksService,
  ) {}

  @Get(["settings", "admin/settings"])
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put(["settings", "admin/settings"])
  async updateSettings(@Body() body: UpdateSettingsDto) {
    return this.adminService.updateSettings(body);
  }

  @Get("admin/profile")
  async getAdminProfile(@Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    return this.adminService.getAdminProfile(actorId);
  }

  @Put("admin/profile")
  async updateAdminProfile(@Body() body: UpdateProfileDto, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    return this.adminService.updateAdminProfile(actorId, body.name, body.email);
  }

  @Put("admin/password")
  async updateAdminPassword(@Body() body: UpdatePasswordDto, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    // Validate current password using bcrypt via the validateUser lookup
    const admin = await this.authService.validateUser(req.user.email, body.currentPassword);
    if (!admin) {
      throw new BadRequestException("Incorrect current password");
    }
    const hashedNew = await this.authService.hashPassword(body.newPassword);
    return this.adminService.updateAdminPassword(actorId, body.currentPassword, hashedNew);
  }


  @Post("admin/mfa/enable")
  async enableMfa() {
    const secret = this.adminService.generateMfaSecret();
    return { secret };
  }

  @Post("admin/mfa/verify")
  async verifyMfa(@Body() body: VerifyMfaDto, @Req() req: any) {
    const verified = verifyTOTP(body.otpToken, body.secret);
    if (!verified) {
      throw new BadRequestException("Verification failed. Invalid authenticator token.");
    }
    await this.authService.completeMfaSetup(req.user.id, body.secret);
    return { success: true };
  }

  @Get(["admin/users/pending", "admin/pending-approvals"])
  async getPendingAdmins(@Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can view pending administrators");
    }
    return this.adminService.getPendingAdmins();
  }

  @Put(["admin/users/:id/approve", "admin/approvals/:id"])
  async approveAdminPut(@Param("id") targetId: string, @Body() body: any, @Req() req: any) {
    return this.approveAdmin(targetId, body, req);
  }

  @Post(["admin/users/:id/approve", "admin/approvals/:id"])
  async approveAdmin(@Param("id") targetId: string, @Body() body: any, @Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can approve or reject accounts");
    }
    const actorId = req.user?.id || req.user?.sub;
    try {
      const status = body?.status || "approved";
      if (status === "rejected") {
        return await this.adminService.rejectAdminAccount(actorId, targetId);
      }
      return await this.adminService.approveAdminAccount(actorId, targetId);
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get("admin/administrators")
  async getAdministrators(@Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can view full administrator directory");
    }
    return this.adminService.getAllAdministrators();
  }

  @Post("admin/administrators")
  async createAdministrator(@Body() body: CreateAdminDto, @Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can create administrator accounts");
    }
    try {
      return await this.adminService.createAdministrator(body);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Delete("admin/administrators/:id")
  async deleteAdministrator(@Param("id") id: string, @Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "fanuelgoitom79@gmial.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can delete administrator accounts");
    }
    const actorId = req.user?.id || req.user?.sub;
    // Step-up MFA check if enabled
    if (req.user?.mfaEnabled) {
      const mfaToken = (req.headers["x-mfa-token"] || "").toString();
      if (!mfaToken) {
        throw new BadRequestException("Step-up authentication required: x-mfa-token header missing");
      }
      const actor = await this.authService.getUserById(actorId);
      if (actor?.mfaSecret && !verifyTOTP(mfaToken, actor.mfaSecret)) {
        throw new BadRequestException("Invalid MFA step-up verification code");
      }
    }
    try {
      return await this.adminService.deleteAdministrator(actorId, id);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Post("admin/administrators/:id/reset-password")
  async resetAdminPassword(@Param("id") id: string, @Body() body: ResetAdminPasswordDto, @Req() req: any) {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      userEmail === "fanuelgoitom79@gmail.com" ||
      userEmail === "fanuelgoitom79@gmial.com" ||
      userEmail === "goitomfanuel@gmail.com" ||
      userEmail === "fani@g.com" ||
      userEmail === "admin@merihcare.et";
    if (!isSuper) {
      throw new BadRequestException("Only super administrators can reset administrator passwords");
    }

    const actorId = req.user?.id || req.user?.sub;
    if (req.user?.mfaEnabled) {
      const mfaToken = (req.headers["x-mfa-token"] || (body as any).mfaToken || "").toString();
      if (!mfaToken) {
        throw new BadRequestException("Step-up authentication required: x-mfa-token header missing");
      }
      const actor = await this.authService.getUserById(actorId);
      if (actor?.mfaSecret && !verifyTOTP(mfaToken, actor.mfaSecret)) {
        throw new BadRequestException("Invalid MFA step-up verification code");
      }
    }

    try {
      await this.adminService.updateAdminPasswordForUser(userEmail, id, body.newPassword);
      return { success: true, message: "Password updated successfully" };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }


  @Post("admin/tasks/reminders/trigger")
  async triggerReminders() {
    if (this.scheduledTasks) {
      return this.scheduledTasks.processAppointmentReminders();
    }
    return { remindersSent: 0 };
  }

  @Post("admin/tasks/cleanup/trigger")
  async triggerSessionCleanup() {
    if (this.scheduledTasks) {
      return this.scheduledTasks.cleanupExpiredSessions();
    }
    return { purgedSessions: 0 };
  }

  @Post("admin/tasks/retry/trigger")
  async triggerRetries() {
    if (this.scheduledTasks) {
      return this.scheduledTasks.retryPendingWebhooks();
    }
    return { retried: 1 };
  }
}
