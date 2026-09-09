import { Controller, Get, Put, Post, Param, Body, UseGuards, Req, BadRequestException, Optional } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthService } from "../auth/auth.service";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { verifyTOTP } from "../../shared/utils/totp";
import { IsNotEmpty, IsEmail, IsOptional, IsBoolean, IsNumberString, MaxLength, MinLength, Matches, Length } from "class-validator";

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
  async getAdminProfile() {
    return this.adminService.getAdminProfile();
  }

  @Put("admin/profile")
  async updateAdminProfile(@Body() body: UpdateProfileDto) {
    return this.adminService.updateAdminProfile(body.name, body.email);
  }

  @Put("admin/password")
  async updateAdminPassword(@Body() body: UpdatePasswordDto, @Req() req: any) {
    // Validate current password using bcrypt via the validateUser lookup
    const admin = await this.authService.validateUser(req.user.email, body.currentPassword);
    if (!admin) {
      throw new BadRequestException("Incorrect current password");
    }
    const hashedNew = await this.authService.hashPassword(body.newPassword);
    return this.adminService.updateAdminPassword(body.currentPassword, hashedNew);
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
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      req.user?.email === "admin@merihcare.et";
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
    const isSuper =
      req.user?.adminRole === "super_admin" ||
      req.user?.role === "super_admin" ||
      req.user?.email === "admin@merihcare.et";
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
