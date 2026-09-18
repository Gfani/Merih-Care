import { Controller, Post, Get, Delete, Put, Body, Param, Req, Res, UnauthorizedException, BadRequestException, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsOptional, Matches, IsIn, Length, IsString } from "class-validator";
import { Request, Response } from "express";
import { verifyTOTP } from "../../shared/utils/totp";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RateLimiterGuard } from "../../shared/guards/rate-limiter.guard";
import { getSecureCookieOptions } from "../../shared/utils/cookie.util";

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

export class AppleAuthDto {
  @IsNotEmpty()
  @IsString()
  identityToken: string;

  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @IsOptional()
  @IsString()
  givenName?: string;

  @IsOptional()
  @IsString()
  familyName?: string;

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
  @IsOptional()
  @MaxLength(500)
  refresh_token?: string;
}

export class LogoutDto {
  @IsOptional()
  @MaxLength(500)
  refresh_token?: string;
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

  private setAuthCookies(res: Response, session: any) {
    if (!res || !session?.token) return;
    const isProd = process.env.NODE_ENV === "production";
    const cookieOptions = getSecureCookieOptions(isProd);

    res.cookie("token", session.token, cookieOptions);
    if (session.user?.role === "admin" || session.user?.adminRole || session.user?.roles?.includes("admin")) {
      res.cookie("admin_token", session.token, cookieOptions);
    }
    if (session.refresh_token) {
      res.cookie("refresh_token", session.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
  }

  private clearAuthCookies(res: Response) {
    if (!res) return;
    res.clearCookie("token", { path: "/" });
    res.clearCookie("admin_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.authService.getUserById(userId);
  }

  @Post("login")
  @UseGuards(RateLimiterGuard)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response
  ) {
    try {
      const user = await this.authService.validateUser(body.email, body.password);
      if (!user) {
        throw new UnauthorizedException("Account not registered: No account found with this email or username. Please check your credentials or register.");
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

      const session = await this.authService.createSession(
        user.id,
        req.headers["user-agent"] || "",
        req.ip || ""
      );
      if (res) this.setAuthCookies(res, session);
      return session;
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }

  @Post("google")
  async googleAuth(
    @Body() body: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response
  ) {
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

      const session = await this.authService.googleAuth(
        body.idToken,
        body.role || "patient",
        providerDetails,
        (req.headers["user-agent"] as string) || "Unknown",
        req.ip || "127.0.0.1"
      );
      if (res) this.setAuthCookies(res, session);
      return session;
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post("apple")
  async appleAuth(
    @Body() body: AppleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response
  ) {
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

      const userName = [body.givenName, body.familyName].filter(Boolean).join(" ") || undefined;

      const session = await this.authService.appleAuth(
        body.identityToken,
        body.role || "patient",
        userName,
        providerDetails,
        (req.headers["user-agent"] as string) || "Unknown",
        req.ip || "127.0.0.1"
      );
      if (res) this.setAuthCookies(res, session);
      return session;
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post("signup")
  async signup(
    @Body() body: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response
  ) {
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
        const session = await this.authService.createSession(
          user.id,
          req.headers["user-agent"] || "",
          req.ip || ""
        );
        if (res) this.setAuthCookies(res, session);
        return session;
      }

      return {
        success: true,
        message: "Registration successful. Pending administrator approval before you can access endpoints.",
        destination: (body.verificationChannel === "sms" ? body.phone : body.email) || body.email,
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Post("refresh")
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response
  ) {
    try {
      const refreshToken = body.refresh_token || (req as any).cookies?.refresh_token;
      if (!refreshToken) {
        throw new UnauthorizedException("Missing refresh token");
      }
      const session = await this.authService.rotateSession(
        refreshToken,
        req.headers["user-agent"] || "",
        req.ip || ""
      );
      if (res) this.setAuthCookies(res, session);
      return session;
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }

  @Post("logout")
  async logout(
    @Body() body: LogoutDto,
    @Req() req: any,
    @Res({ passthrough: true }) res?: Response
  ) {
    const refreshToken = body.refresh_token || req?.cookies?.refresh_token;
    const userId = req?.user?.id || req?.user?.sub;
    if (refreshToken) {
      await this.authService.revokeSession(refreshToken, userId);
    }
    if (res) this.clearAuthCookies(res);
    return { success: true };
  }


  @Post("switch-active-role")
  @UseGuards(JwtAuthGuard)
  async switchActiveRole(@Body() body: { role: string }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.authService.switchActiveRole(userId, body.role);
  }

  @Post("password-reset/request")
  @UseGuards(RateLimiterGuard)
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.requestPasswordReset(id, body.channel, {
      email: body.email,
      phone: body.phone,
    });
  }

  @Post("password-reset/confirm")
  @UseGuards(RateLimiterGuard)
  async confirmPasswordReset(@Body() body: PasswordResetConfirmDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.confirmPasswordReset(id, body.token, body.newPassword, {
      email: body.email,
      phone: body.phone,
    });
  }

  @Post("email-verification/request")
  @UseGuards(RateLimiterGuard)
  async requestEmailVerification(@Body() body: EmailVerificationRequestDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.requestEmailVerification(id, body.channel, {
      email: body.email,
      phone: body.phone,
    });
  }

  @Post("email-verification/confirm")
  @UseGuards(RateLimiterGuard)
  async confirmEmailVerification(@Body() body: EmailVerificationConfirmDto) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.confirmEmailVerification(id, body.token, {
      email: body.email,
      phone: body.phone,
    });
  }

  @Post("lookup-contact")
  @Post("forgot-password/lookup")
  @HttpCode(HttpStatus.OK)
  async lookupContact(@Body() body: { identifier?: string; email?: string; phone?: string }) {
    const id = body.identifier || body.email || body.phone || "";
    return this.authService.lookupContact(id);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: any) {
    return this.authService.getActiveSessions(req.user.id || req.user.sub);
  }

  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  async revokeSessionById(@Param("id") sessionId: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.authService.revokeSessionById(userId, sessionId);
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
