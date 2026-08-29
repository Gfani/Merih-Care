import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly jwtService: JwtService,
  ) {}

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
    user.id = "u-" + Date.now();
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
    } else {
      user.isApproved = true;
    }

    return this.userRepo.save(user);
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

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: "15m" });
    const refreshToken = await this.jwtService.signAsync({ sub: user.id }, { expiresIn: "7d" });

    const session = new SessionEntity();
    session.id = "s-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
    session.userId = userId;
    session.refreshToken = await bcrypt.hash(refreshToken, 10);
    session.tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    session.userAgent = userAgent || "Unknown";
    session.ipAddress = ipAddress || "127.0.0.1";
    session.lastActive = new Date().toISOString();
    await this.sessionRepo.save(session);

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

  async getUserById(id: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const { password, ...result } = user;
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
