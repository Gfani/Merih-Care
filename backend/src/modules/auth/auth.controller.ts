import { Controller, Post, Get, Body, Req, UnauthorizedException, BadRequestException, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsOptional, Matches, IsIn, Length } from "class-validator";
import { Request } from "express";
import { verifyTOTP } from "../../shared/utils/totp";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";

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
  @IsIn(["admin", "provider", "patient"])
  role?: string;

  @IsOptional()
  @IsIn(["super_admin", "operations_admin", "finance_admin", "verification_admin", "support_admin"])
  adminRole?: string;
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

  @Post("signup")
  async signup(@Body() body: SignUpDto, @Req() req: Request) {
    try {
      const targetRole = body.role || "patient";

      if (targetRole === "admin" && body.email !== "admin@merihcare.et") {
        throw new BadRequestException("Public administrative account creation is blocked. Admin requests must be created through super admin approval.");
      }

      const user = await this.authService.registerUser(
        body.name,
        body.email,
        body.password,
        targetRole,
        body.adminRole
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

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: any) {
    return this.authService.getActiveSessions(req.user.id);
  }
}
