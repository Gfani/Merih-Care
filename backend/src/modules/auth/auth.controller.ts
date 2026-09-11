import { Controller, Post, Get, Delete, Put, Body, Param, Req, UnauthorizedException, BadRequestException, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsOptional, Matches, IsIn, Length, IsString } from "class-validator";
import { Request } from "express";
import { verifyTOTP } from "../../shared/utils/totp";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RateLimiterGuard } from "../../shared/guards/rate-limiter.guard";

export class LoginDto {
  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @Length(6, 6)
  otpToken?: string;
}

export class SignUpDto {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { 
    message: "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character" 
  })
  password: string;

  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(["admin", "provider", "patient"])
  role?: string;

  @IsOptional()
  @IsIn(["super_admin", "operations_admin", "finance_admin", "verification_admin", "support_admin"])
  adminRole?: string;

  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  experience?: number;

  @IsOptional()
  @MaxLength(255)
  education?: string;

  @IsOptional()
  @MaxLength(255)
  hospitalAffiliation?: string;

  @IsOptional()
  @MaxLength(500)
  cvUrl?: string;

  @IsOptional()
  @MaxLength(500)
  licenseDocumentUrl?: string;

  @IsOptional()
  @MaxLength(500)
  idDocumentUrl?: string;

  @IsOptional()
  @IsIn(["email", "sms"])
  verificationChannel?: "email" | "sms";
}

export class GoogleAuthDto {
  @IsNotEmpty()
  @IsString()
  idToken: string;

  @IsOptional()
  @IsIn(["patient", "provider", "admin"])
  role?: string;

  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  experience?: number;

  @IsOptional()
  @MaxLength(255)
  education?: string;

  @IsOptional()
  @MaxLength(255)
  hospitalAffiliation?: string;

  @IsOptional()
  @MaxLength(500)
  cvUrl?: string;

  @IsOptional()
  @MaxLength(500)
  licenseDocumentUrl?: string;

  @IsOptional()
  @MaxLength(500)
  idDocumentUrl?: string;
}

export class RefreshDto {
  @IsNotEmpty()
  @MaxLength(500)
  refresh_token: string;
}

export class LogoutDto {
  @IsNotEmpty()
  @MaxLength(500)
  refresh_token: string;
}

export class PasswordResetRequestDto {
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @MaxLength(100)
  identifier?: string;

  @IsOptional()
  @IsIn(["email", "sms"])
  channel?: "email" | "sms";
}

export class PasswordResetConfirmDto {
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @MaxLength(100)
  identifier?: string;

  @IsNotEmpty()
  @Length(6, 6)
  token: string;

  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { 
    message: "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character" 
  })
  newPassword: string;
}

export class EmailVerificationRequestDto {
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @MaxLength(100)
  identifier?: string;

  @IsOptional()
  @IsIn(["email", "sms"])
  channel?: "email" | "sms";
}

export class EmailVerificationConfirmDto {
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @MaxLength(100)
  identifier?: string;

  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginDto, @Req() req: Request) {
    try {
      const user = await this.authService.validateUser(body.email, body.password);
      if (!user) {
        throw new UnauthorizedException("Invalid credentials");
      }

      if (user.mfaEnabled) {
        if (!body.otpToken) {
          return { mfaRequired: true, userId: user.id };
        }
        const mfaVerified = verifyTOTP(body.otpToken, user.mfaSecret || "");
        if (!mfaVerified) {
          throw new UnauthorizedException("Invalid multi-factor code");
        }
      }

      return this.authService.createSession(
        user.id,
        req.headers["user-agent"] || "",
        req.ip || ""
      );
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }

  @Post("google")
  async googleAuth(@Body() body: GoogleAuthDto, @Req() req: Request) {
    try {
      const providerDetails = body.role === "provider" ? {
        title: body.title,
        specialty: body.specialty,
        licenseNumber: body.licenseNumber,
        experience: body.experience,
        education: body.education,
        hospitalAffiliation: body.hospitalAffiliation,
        cvUrl: body.cvUrl,
        licenseDocumentUrl: body.licenseDocumentUrl,
        idDocumentUrl: body.idDocumentUrl,
      } : undefined;

      return await this.authService.googleAuth(
        body.idToken,
        body.role || "patient",
        providerDetails,
        (req.headers["user-agent"] as string) || "Unknown",
        req.ip || "127.0.0.1"
      );
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post("signup")
  async signup(@Body() body: SignUpDto, @Req() req: Request) {
    try {
      let targetRole = body.role || "patient";
      let targetAdminRole = body.adminRole;

      if (body.department) {
        targetRole = "admin";
        targetAdminRole = body.department.toLowerCase().endsWith("_admin")
          ? body.department
          : `${body.department.toLowerCase()}_admin`;
      }

      const providerDetails = targetRole === "provider" ? {
        title: body.title,
        specialty: body.specialty,
        licenseNumber: body.licenseNumber,
        experience: body.experience,
        education: body.education,
        hospitalAffiliation: body.hospitalAffiliation,
        cvUrl: body.cvUrl,
        licenseDocumentUrl: body.licenseDocumentUrl,
        idDocumentUrl: body.idDocumentUrl,
      } : undefined;

      const user = await this.authService.registerUser(
        body.name,
        body.email,
        body.password,
        targetRole,
        targetAdminRole,
        body.phone,
        providerDetails,
        body.verificationChannel
      );

      if (user.isApproved) {
        return this.authService.createSession(
          user.id,
          req.headers["user-agent"] || "",
          req.ip || ""
        );
      }

      return {
        success: true,
        message: "Registration successful. Pending administrator approval before you can access endpoints."
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Post("refresh")
  async refresh(@Body() body: RefreshDto, @Req() req: Request) {
    try {
      return await this.authService.rotateSession(
        body.refresh_token,
        req.headers["user-agent"] || "",
        req.ip || ""
      );
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }

  @Post("logout")
  async logout(@Body() body: LogoutDto) {
    await this.authService.revokeSession(body.refresh_token);
    return { success: true };
  }

  @Post("password-reset/request")
  @UseGuards(RateLimiterGuard)
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.requestPasswordReset(id, body.channel);
  }

  @Post("password-reset/confirm")
  @UseGuards(RateLimiterGuard)
  async confirmPasswordReset(@Body() body: PasswordResetConfirmDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.confirmPasswordReset(id, body.token, body.newPassword);
  }

  @Post("email-verification/request")
  @UseGuards(RateLimiterGuard)
  async requestEmailVerification(@Body() body: EmailVerificationRequestDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.requestEmailVerification(id, body.channel);
  }

  @Post("email-verification/confirm")
  @UseGuards(RateLimiterGuard)
  async confirmEmailVerification(@Body() body: EmailVerificationConfirmDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.confirmEmailVerification(id, body.token);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: any) {
    return this.authService.getActiveSessions(req.user.id || req.user.sub);
  }

  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  async revokeSessionById(@Param("id") sessionId: string) {
    await this.authService.revokeSessionById(sessionId);
    return { success: true };
  }

  @Delete("sessions/all")
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.authService.revokeAllUserSessions(userId);
    return { success: true };
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.authService.getUserById(userId);
  }

  @Delete("account")
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.authService.deleteAccount(userId);
    return { success: true, message: "Account deleted successfully" };
  }
}
