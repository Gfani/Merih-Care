import { Injectable, Optional, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
    @Optional()
    @InjectRepository(ProviderEntity)
    private readonly providerRepo?: Repository<ProviderEntity>,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    // Check account lockout
    if (user.lockoutUntil) {
      const lockTime = new Date(user.lockoutUntil).getTime();
      if (Date.now() < lockTime) {
        throw new Error(`Account locked. Try again after ${user.lockoutUntil}`);
      } else {
        user.lockoutUntil = null;
        user.loginAttempts = 0;
        await this.userRepo.save(user);
      }
    }

    if (user.status !== "active") {
      throw new Error("Account is suspended");
    }

    if (!user.isApproved) {
      throw new Error("Account is pending administrator approval");
    }

    const matched = await bcrypt.compare(pass, user.password || "");
    if (matched) {
      user.loginAttempts = 0;
      await this.userRepo.save(user);
      const { password, ...result } = user;
      return result;
    } else {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        user.lockoutUntil = lockoutTime.toISOString();
      }
      await this.userRepo.save(user);
      return null;
    }
  }

  async registerUser(name: string, email: string, pass: string, role: string, adminRole?: string, phone?: string): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new Error("User already exists");
    }

    if (role === "admin" && !adminRole) {
      throw new Error("Admin accounts require a specified admin role");
    }

    const hashed = await this.hashPassword(pass);
    const user = new UserEntity();
    user.id = "u-" + crypto.randomUUID();
    user.name = name;
    user.email = email;
    user.password = hashed;
    user.phone = phone || "";
    user.role = role;
    user.status = "active";
    user.dateJoined = new Date().toISOString().split("T")[0];

    if (role === "admin") {
      user.adminRole = adminRole || "support_admin";
      user.isApproved = false; // Requires super admin approval
      if (email === "admin@merihcare.et") {
        user.isApproved = true;
        user.adminRole = "super_admin";
        user.permissions = "all";
      }
    } else if (role === "provider") {
      user.isApproved = false; // Healthcare providers require administrator verification and approval
      user.status = "pending_verification";
    } else {
      user.isApproved = true;
      user.status = "active";
    }

    const savedUser = await this.userRepo.save(user);

    if (role === "provider" && this.providerRepo) {
      try {
        const provider = new ProviderEntity();
        provider.id = "prov-" + crypto.randomUUID();
        provider.userId = savedUser.id;
        provider.name = savedUser.name;
        provider.title = "Healthcare Specialist";
        provider.pricePerVisit = 800;
        provider.available = false; // Disabled until admin approval
        provider.status = "pending_verification";
        provider.verified = false;
        provider.services = ["Doctor Visit", "Home Nursing"];
        await this.providerRepo.save(provider);
      } catch (err) {
        console.error("[AUTH] Failed to auto-create provider entity:", err);
      }
    }

    return savedUser;
  }

  async createSession(userId: string, userAgent: string, ipAddress: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      adminRole: user.adminRole,
      permissions: user.permissions
    };

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: "7d" });
    const refreshToken = await this.jwtService.signAsync({ sub: user.id }, { expiresIn: "30d" });

    const session = new SessionEntity();
    session.id = "s-" + crypto.randomUUID();
    session.userId = userId;
    session.refreshToken = await bcrypt.hash(refreshToken, 10);
    session.tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    session.userAgent = userAgent || "Unknown";
    session.ipAddress = ipAddress || "127.0.0.1";
    session.lastActive = new Date().toISOString();
    await this.sessionRepo.save(session);

    let providerData = null;
    if (user.role === "provider" && this.providerRepo) {
      providerData = await this.providerRepo.findOne({ where: { userId: user.id } }).catch(() => null);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminRole: user.adminRole,
        mfaEnabled: user.mfaEnabled,
        provider: providerData,
      }
    };
  }

  async rotateSession(oldRefreshToken: string, userAgent: string, ipAddress: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(oldRefreshToken);
      const userId = payload.sub;

      const sessions = await this.sessionRepo.find({ where: { userId, isRevoked: false } });
      let matchedSession: SessionEntity = null;

      for (const s of sessions) {
        if (await bcrypt.compare(oldRefreshToken, s.refreshToken)) {
          matchedSession = s;
          break;
        }
      }

      if (!matchedSession) {
        throw new Error("Invalid or rotated refresh token");
      }

      matchedSession.isRevoked = true;
      await this.sessionRepo.save(matchedSession);

      return this.createSession(userId, userAgent, ipAddress);
    } catch (e) {
      throw new Error("Token refresh failed: " + e.message);
    }
  }

  async revokeSession(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const userId = payload.sub;
      const sessions = await this.sessionRepo.find({ where: { userId, isRevoked: false } });

      for (const s of sessions) {
        if (await bcrypt.compare(refreshToken, s.refreshToken)) {
          s.isRevoked = true;
          await this.sessionRepo.save(s);
          break;
        }
      }
    } catch {}
  }

  async getActiveSessions(userId: string): Promise<SessionEntity[]> {
    return this.sessionRepo.find({ where: { userId, isRevoked: false } });
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
      session.isRevoked = true;
      await this.sessionRepo.save(session);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.sessionRepo.find({ where: { userId, isRevoked: false } });
    for (const s of sessions) {
      s.isRevoked = true;
      await this.sessionRepo.save(s);
    }
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user) {
      // Generate cryptographically secure 6-digit OTP code
      const resetOtp = crypto.randomInt(100000, 999999).toString();
      user.passwordResetToken = this.hashToken(resetOtp);
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await this.userRepo.save(user);

      // Dispatch password reset code via notification service
      if (this.notificationsService) {
        await this.notificationsService.sendNotification(user.id, {
          type: "general",
          title: "Password Reset Code",
          body: `Your MerihCare password reset code is ${resetOtp}. This code expires in 15 minutes.`,
          priority: "critical",
          data: { code: resetOtp, type: "password_reset" },
        }).catch(() => {});
      }
    }
    return {
      success: true,
      message: "If the email is registered, a password reset code has been sent.",
    };
  }

  async confirmPasswordReset(email: string, token: string, newPass: string): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { email } });
    const hashed = this.hashToken(token);
    if (!user || user.passwordResetToken !== hashed) {
      throw new Error("Invalid or expired password reset token");
    }

    if (user.passwordResetExpires && new Date(user.passwordResetExpires).getTime() < Date.now()) {
      throw new Error("Password reset token has expired");
    }

    user.password = await this.hashPassword(newPass);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    await this.userRepo.save(user);

    // Invalidate all active sessions for security
    await this.revokeAllUserSessions(user.id);
    return { success: true };
  }

  async requestEmailVerification(email: string): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user) {
      const verifyOtp = crypto.randomInt(100000, 999999).toString();
      user.emailVerificationToken = this.hashToken(verifyOtp);
      user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await this.userRepo.save(user);

      // Dispatch email verification code via notification service
      if (this.notificationsService) {
        await this.notificationsService.sendNotification(user.id, {
          type: "verification_update",
          title: "Email Verification Code",
          body: `Your MerihCare verification code is ${verifyOtp}.`,
          priority: "critical",
          data: { code: verifyOtp, type: "email_verification", recipientEmail: user.email },
        }).catch(() => {});
      }
    }
    return { success: true };
  }

  async confirmEmailVerification(email: string, token: string): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { email } });
    const hashed = this.hashToken(token);
    if (!user || user.emailVerificationToken !== hashed) {
      throw new Error("Invalid email verification token");
    }
    if (user.emailVerificationExpires && new Date(user.emailVerificationExpires) < new Date()) {
      throw new Error("Email verification token has expired");
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepo.save(user);
    return { success: true };
  }

  async getUserById(id: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const { password, ...result } = user;
    if (user.role === "provider" && this.providerRepo) {
      const provider = await this.providerRepo.findOne({ where: { userId: id } }).catch(() => null);
      if (provider) {
        (result as any).provider = provider;
      }
    }
    return result;
  }

  async completeMfaSetup(userId: string, secret: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      user.mfaSecret = secret;
      user.mfaEnabled = true;
      await this.userRepo.save(user);
    }
  }
}
