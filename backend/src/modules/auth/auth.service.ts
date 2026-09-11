import { Injectable, Optional, Inject, forwardRef, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "dispostable.com",
  "getairmail.com",
  "fake.com",
  "fakemail.com",
  "test.com",
  "example.com",
  "fakeinbox.com",
  "crazymailing.com",
  "inboxkitten.com",
  "dropmail.me",
  "mohmal.com",
  "nada.ltd",
  "burnermail.io",
  "mytemp.email",
  "fakemailgenerator.com",
  "tempmailaddress.com",
  "byom.de",
  "emailondeck.com",
  "getnada.com",
  "maildrop.cc",
  "mintemail.com",
  "trashmail.net",
  "dayrep.com",
  "teleworm.us",
  "armyspy.com",
  "cuvox.de",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "spam4.me",
  "grr.la",
  "harakirimail.com",
]);

export const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "12345678",
  "123456789",
  "00000000",
  "qwerty1234",
  "admin123",
  "admin1234",
  "merihcare123",
  "letmein123",
]);

export const REPUTABLE_CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "myyahoo.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "windowslive.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "mail.com",
  "gmx.com",
]);

export function validateRealEmail(email: string): void {
  if (!email || typeof email !== "string") {
    throw new Error("Email address is required");
  }
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(normalized)) {
    throw new Error("Please enter a valid, well-formed email address");
  }
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    throw new Error("Invalid email address format");
  }
  const [localPart, domain] = parts;
  if (!localPart || localPart.length > 64 || !domain) {
    throw new Error("Invalid email address format");
  }

  // Reject synthetic or too-short mailbox local parts (e.g. ssf@, aaa@, 111@)
  if (localPart.length < 3) {
    throw new Error("Email username must be at least 3 characters long");
  }
  if (/^([a-z0-9])\1{2,}$/i.test(localPart)) {
    throw new Error("Email address appears synthetic or fake. Please use a real personal or professional email.");
  }
  const dummyMailboxes = new Set(["asdf", "qwerty", "test", "fake", "temp", "dummy", "none", "null", "user", "admin123"]);
  if (dummyMailboxes.has(localPart)) {
    throw new Error("Please use your real personal or professional email address.");
  }

  // Check disposable domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    throw new Error(
      "Disposable or temporary email addresses are not permitted. Please use a real, permanent email address."
    );
  }

  // Reputable consumer email providers are directly allowed
  if (REPUTABLE_CONSUMER_DOMAINS.has(domain)) {
    return;
  }

  // Non-consumer domains must be legitimate institutional, educational, government, medical or organization domains
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  const domainName = domainParts[0];

  // Block single-letter or two-letter dummy domains like f.com, g.com, ab.com
  if (domainName.length < 3) {
    throw new Error(
      `The domain "${domain}" is not a recognized or legitimate email service. Please use a real email provider (e.g. @gmail.com, @yahoo.com, @outlook.com) or a verified institutional email.`
    );
  }

  // Block numeric dummy domains (e.g. 123.com) or repeated characters (e.g. aaa.com)
  if (/^\d+$/.test(domainName) || /^([a-z0-9])\1{2,}$/i.test(domainName)) {
    throw new Error(`The domain "${domain}" is invalid. Please use a real email provider.`);
  }

  const dummyDomains = new Set(["fake", "test", "example", "temp", "dummy", "trash", "sample", "mailinator", "none", "bogus", "invalid"]);
  if (dummyDomains.has(domainName)) {
    throw new Error("Please use a real, permanent email address.");
  }

  if (!tld || tld.length < 2 || ["local", "test", "example", "invalid", "internal"].includes(tld)) {
    throw new Error("Email must contain a valid top-level domain (e.g. .com, .et, .org, .edu)");
  }

  // Recognized institutional, regional, or educational TLDs
  const validInstitutionalTlds = new Set([
    "et", "edu", "gov", "org", "int", "health", "hospital", "clinic", "care", "med", "ac.uk", "edu.et", "gov.et"
  ]);
  const fullTld = domainParts.slice(1).join(".");
  if (validInstitutionalTlds.has(tld) || validInstitutionalTlds.has(fullTld)) {
    return;
  }

  // For generic TLDs (.com, .net, .co, .io), ensure domainName is at least 3 characters and looks like an established organization
  if (["com", "net", "co", "io"].includes(tld)) {
    if (domainName.length >= 3) {
      return;
    }
  }

  throw new Error(
    "Please use a real, reputable email provider (such as Gmail, Yahoo, Outlook, iCloud) or a recognized institutional domain."
  );
}

export function validateStrongPassword(password: string): void {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  if (password.length > 100) {
    throw new Error("Password exceeds maximum allowed length");
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    throw new Error("Password is too common and easily guessable. Please choose a stronger password.");
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[\d\W]/.test(password);
  if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
    throw new Error(
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character"
    );
  }
}

export interface ProviderRegistrationDetails {
  title?: string;
  specialty?: string;
  licenseNumber?: string;
  experience?: number;
  education?: string;
  hospitalAffiliation?: string;
  cvUrl?: string;
  licenseDocumentUrl?: string;
  idDocumentUrl?: string;
}

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
    @Optional()
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService?: RealtimeService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = (email || "").trim().toLowerCase();
    let user = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (!user && typeof this.userRepo.createQueryBuilder === "function") {
      user = await this.userRepo
        .createQueryBuilder("user")
        .where("LOWER(user.email) = :email", { email: normalizedEmail })
        .getOne();
    }
    if (!user) {
      return null;
    }

    // Guarantee super_admin role for administrative owners
    if (normalizedEmail === "fanuelgoitom79@gmail.com" || normalizedEmail === "goitomfanuel@gmail.com" || normalizedEmail === "fani@g.com") {
      if (user.role !== "admin" || user.adminRole !== "super_admin" || !user.isApproved || user.status !== "active") {
        user.role = "admin";
        user.adminRole = "super_admin";
        user.permissions = "all";
        user.isApproved = true;
        user.status = "active";
        await this.userRepo.save(user);
      }
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

    // Check approval status: Healthcare providers must be approved by admin first
    if (user.role === "provider") {
      if (!user.isApproved || user.status === "pending_verification") {
        throw new Error("Account is pending administrator approval");
      }

      if (this.providerRepo) {
        const provider = await this.providerRepo.findOne({ where: { userId: user.id } });
        if (provider && (!provider.verified || provider.status === "pending_verification")) {
          throw new Error("Account is pending administrator approval");
        }
      }
    } else if (!user.isApproved) {
      throw new Error("Account is pending administrator approval");
    }

    if (user.status !== "active") {
      throw new Error("Account is suspended");
    }

    const matched = await bcrypt.compare(pass, user.password || "");
    if (!matched) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        user.lockoutUntil = lockoutTime.toISOString();
      }
      await this.userRepo.save(user);
      return null;
    }

    user.loginAttempts = 0;
    await this.userRepo.save(user);
    const { password, ...result } = user;
    return result;
  }

  async registerUser(
    name: string,
    email: string,
    pass: string,
    role: string,
    adminRole?: string,
    phone?: string,
    providerDetails?: ProviderRegistrationDetails,
    verificationChannel?: "email" | "sms"
  ): Promise<UserEntity> {
    validateRealEmail(email);
    validateStrongPassword(pass);

    const normalizedEmail = (email || "").trim().toLowerCase();
    let existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (!existing && typeof this.userRepo.createQueryBuilder === "function") {
      existing = await this.userRepo
        .createQueryBuilder("user")
        .where("LOWER(user.email) = :email", { email: normalizedEmail })
        .getOne();
    }
    if (existing) {
      throw new Error("User already exists with this email address");
    }

    const normalizedPhone = (phone || "").trim().replace(/[\s\-\(\)]/g, "");
    if (normalizedPhone) {
      const existingPhone = await this.userRepo.findOne({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        throw new Error("A user with this phone number is already registered");
      }
    }

    if (role === "admin" && !adminRole) {
      throw new Error("Admin accounts require a specified admin role");
    }

    if (role === "provider") {
      if (providerDetails && typeof providerDetails.licenseNumber === "string" && !providerDetails.licenseNumber.trim()) {
        throw new Error("Medical license or registration number is required");
      }
      const generatedLicense = "MC-PRV-" + Math.floor(100000 + Math.random() * 900000);
      const licenseNumber =
        providerDetails?.licenseNumber && providerDetails.licenseNumber.trim()
          ? providerDetails.licenseNumber.trim()
          : generatedLicense;
      const education =
        providerDetails?.education && providerDetails.education.trim()
          ? providerDetails.education.trim()
          : "Clinical Healthcare Degree";
      const hospitalAffiliation =
        providerDetails?.hospitalAffiliation && providerDetails.hospitalAffiliation.trim()
          ? providerDetails.hospitalAffiliation.trim()
          : "Independent Healthcare Practice";
      const cvUrl =
        providerDetails?.cvUrl && providerDetails.cvUrl.trim()
          ? providerDetails.cvUrl.trim()
          : "https://storage.merihcare.et/credentials/cv.pdf";

      providerDetails = {
        title: providerDetails?.title || "Healthcare Specialist",
        specialty: providerDetails?.specialty || "General Medicine",
        licenseNumber,
        experience: Number(providerDetails?.experience) || 0,
        education,
        hospitalAffiliation,
        cvUrl,
        licenseDocumentUrl: providerDetails?.licenseDocumentUrl || "",
        idDocumentUrl: providerDetails?.idDocumentUrl || "",
      };
    }

    const hashed = await this.hashPassword(pass);
    const user = new UserEntity();
    user.id = "u-" + crypto.randomUUID();
    user.name = name;
    user.email = normalizedEmail;
    user.password = hashed;
    user.phone = normalizedPhone || phone || "";
    user.role = role;
    user.status = "active";
    user.dateJoined = new Date().toISOString().split("T")[0];

    // Generate random 6-digit email verification OTP (valid strictly for 5 minutes)
    const verifyOtp = crypto.randomInt(100000, 999999).toString();
    user.emailVerified = false;
    user.emailVerificationToken = this.hashToken(verifyOtp);
    user.emailVerificationExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    if (role === "admin") {
      user.adminRole = adminRole || "support_admin";
      user.isApproved = false; // All newly registered administrators strictly require super admin approval
      user.permissions = "";
    } else if (role === "provider") {
      user.isApproved = false; // Healthcare providers require administrator verification and approval
      user.status = "pending_verification";
    } else {
      user.isApproved = true;
      user.status = "active";
    }

    const savedUser = await this.userRepo.save(user);

    // Send verification code via user's selected channel (SMS or Email)
    if (this.notificationsService) {
      const channel: "email" | "sms" = verificationChannel || (savedUser.phone ? "sms" : "email");
      await this.notificationsService.sendNotification(savedUser.id, {
        type: "verification_update",
        title: channel === "sms" ? "MerihCare Verification Code" : "Verify Your Email",
        body: `Your MerihCare registration verification code is ${verifyOtp}. This code expires in 5 minutes.`,
        priority: "critical",
        recipientEmail: savedUser.email,
        recipientPhone: savedUser.phone,
        targetChannel: channel,
        data: { code: verifyOtp, type: "email_verification", recipientEmail: savedUser.email, channel },
      }).catch((err) => {
        console.error(`Failed to send verification code: ${err?.message || err}`);
      });
    }

    if (role === "provider" && this.providerRepo) {
      try {
        const provider = new ProviderEntity();
        provider.id = "prov-" + crypto.randomUUID();
        provider.userId = savedUser.id;
        provider.name = savedUser.name;
        provider.email = savedUser.email || "";
        provider.phone = savedUser.phone || "";
        provider.title = providerDetails?.title || "Healthcare Specialist";
        provider.specialty = providerDetails?.specialty || "General Medicine";
        provider.licenseNumber = providerDetails?.licenseNumber || "";
        provider.experience = Number(providerDetails?.experience) || 0;
        provider.education = providerDetails?.education || "";
        provider.hospitalAffiliation = providerDetails?.hospitalAffiliation || "";
        provider.cvUrl = providerDetails?.cvUrl || "";
        provider.licenseDocumentUrl = providerDetails?.licenseDocumentUrl || "";
        provider.idDocumentUrl = providerDetails?.idDocumentUrl || "";
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

  private async findUserByIdentifier(identifier: string): Promise<UserEntity | null> {
    const raw = (identifier || "").trim();
    if (!raw) return null;

    if (raw.includes("@")) {
      const lower = raw.toLowerCase();
      let user = await this.userRepo.findOne({ where: { email: lower } });
      if (!user && typeof this.userRepo.createQueryBuilder === "function") {
        user = await this.userRepo
          .createQueryBuilder("user")
          .where("LOWER(user.email) = :email", { email: lower })
          .getOne();
      }
      return user;
    }

    // Phone number lookup (supports local 09..., 07..., +251..., and non-formatted)
    const digitsOnly = raw.replace(/\D/g, "");
    let user = await this.userRepo.findOne({ where: { phone: raw } });
    if (!user && digitsOnly.length >= 9) {
      const last9 = digitsOnly.slice(-9);
      user = await this.userRepo
        .createQueryBuilder("user")
        .where("REPLACE(REPLACE(REPLACE(user.phone, '+', ''), '-', ''), ' ', '') LIKE :p", {
          p: `%${last9}`,
        })
        .getOne();
    }
    return user;
  }

  private maskDestination(str: string): string {
    if (!str) return "";
    if (str.includes("@")) {
      const [name, domain] = str.split("@");
      if (name.length <= 2) return `${name}***@${domain}`;
      return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
    }
    const clean = str.replace(/[^\d+]/g, "");
    if (clean.length > 6) {
      return `${clean.substring(0, 4)}****${clean.slice(-2)}`;
    }
    return clean;
  }

  async lookupContact(identifier: string): Promise<{ found: boolean; email?: string; phone?: string }> {
    if (!identifier || !identifier.trim()) {
      return { found: false };
    }
    const user = await this.findUserByIdentifier(identifier.trim());
    if (!user) {
      return { found: false };
    }
    return {
      found: true,
      email: user.email || undefined,
      phone: user.phone || undefined,
    };
  }

  async requestPasswordReset(
    identifier: string,
    requestedChannel?: "email" | "sms"
  ): Promise<{ success: boolean; message: string; channel: string; destination: string }> {
    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundException(`No registered account found matching "${identifier}". Please check the phone/email or sign up.`);
    }

    let channel: "email" | "sms" = requestedChannel || (identifier.includes("@") ? "email" : "sms");
    if (channel === "sms" && !user.phone) {
      channel = "email";
    }

    // Cryptographically random 6-digit OTP
    const resetOtp = crypto.randomInt(100000, 999999).toString();
    user.passwordResetToken = this.hashToken(resetOtp);
    user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await this.userRepo.save(user);

    // Dispatch password reset code via notification service to chosen channel
    if (this.notificationsService) {
      await this.notificationsService.sendNotification(user.id, {
        type: "general",
        title: channel === "sms" ? "MerihCare Password Reset Code" : "MerihCare Password Reset Code",
        body: `Your MerihCare password reset code is ${resetOtp}. This code expires in 5 minutes.`,
        priority: "critical",
        recipientEmail: user.email,
        recipientPhone: user.phone,
        targetChannel: channel,
        data: { code: resetOtp, type: "password_reset", recipientEmail: user.email, channel },
      }).catch((err) => {
        console.error("[AUTH] Failed to send reset code:", err);
      });
    }

    const dest = channel === "sms" ? (user.phone || identifier) : user.email;
    const masked = this.maskDestination(dest);

    return {
      success: true,
      channel,
      destination: masked,
      message: `A 6-digit password reset code has been dispatched via ${channel.toUpperCase()} to ${masked}. Valid for 5 minutes.`,
    };
  }

  async confirmPasswordReset(identifier: string, token: string, newPass: string): Promise<{ success: boolean; message: string }> {
    const user = await this.findUserByIdentifier(identifier);
    const hashed = this.hashToken(token);
    if (!user || user.passwordResetToken !== hashed) {
      throw new BadRequestException("Invalid or expired password reset token");
    }

    if (user.passwordResetExpires && new Date(user.passwordResetExpires).getTime() < Date.now()) {
      throw new BadRequestException("Password reset token has expired (codes expire in 5 minutes)");
    }

    validateStrongPassword(newPass);

    user.password = await this.hashPassword(newPass);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    await this.userRepo.save(user);

    // Invalidate all active sessions for security
    await this.revokeAllUserSessions(user.id);
    return { success: true, message: "Password has been updated successfully. You can now log in." };
  }

  async requestEmailVerification(
    identifier: string,
    requestedChannel?: "email" | "sms"
  ): Promise<{ success: boolean; message: string; channel: string; destination: string }> {
    const user = await this.findUserByIdentifier(identifier);
    if (user) {
      let channel: "email" | "sms" = requestedChannel || (identifier.includes("@") ? "email" : "sms");
      if (channel === "sms" && !user.phone) {
        channel = "email";
      }

      const verifyOtp = crypto.randomInt(100000, 999999).toString();
      user.emailVerificationToken = this.hashToken(verifyOtp);
      user.emailVerificationExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await this.userRepo.save(user);

      // Dispatch verification code via notification service
      if (this.notificationsService) {
        await this.notificationsService.sendNotification(user.id, {
          type: "verification_update",
          title: channel === "sms" ? "MerihCare Verification Code" : "MerihCare Email Verification Code",
          body: `Your MerihCare verification code is ${verifyOtp}. This code expires in 5 minutes.`,
          priority: "critical",
          recipientEmail: user.email,
          recipientPhone: user.phone,
          targetChannel: channel,
          data: { code: verifyOtp, type: "email_verification", recipientEmail: user.email, channel },
        }).catch((err) => {
          console.error("[AUTH] Failed to send verification code:", err);
        });
      }

      const dest = channel === "sms" ? (user.phone || identifier) : user.email;
      const masked = this.maskDestination(dest);

      return {
        success: true,
        channel,
        destination: masked,
        message: `A 6-digit verification code has been dispatched via ${channel.toUpperCase()} to ${masked}. Valid for 5 minutes.`,
      };
    }
    return {
      success: true,
      channel: requestedChannel || "email",
      destination: identifier,
      message: "Verification code dispatched if account exists.",
    };
  }

  async confirmEmailVerification(identifier: string, token: string): Promise<{ success: boolean; message: string }> {
    const user = await this.findUserByIdentifier(identifier);
    const hashed = this.hashToken(token);
    if (!user || user.emailVerificationToken !== hashed) {
      throw new BadRequestException("Invalid email verification token");
    }
    if (user.emailVerificationExpires && new Date(user.emailVerificationExpires) < new Date()) {
      throw new BadRequestException("Email verification token has expired (codes expire in 5 minutes)");
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    if (user.role === "patient") {
      user.status = "active";
      user.isApproved = true;
    }
    await this.userRepo.save(user);

    // Notify administrators live that a verified provider or admin has entered the approval queue
    if ((user.role === "provider" || user.role === "admin") && this.realtimeService) {
      this.realtimeService.emitApprovalRequested({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        adminRole: user.adminRole,
      });
    }

    return { success: true, message: "Account verification successful!" };
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

  async googleAuth(
    idToken: string,
    role = "patient",
    providerDetails?: ProviderRegistrationDetails,
    userAgent = "Unknown",
    ipAddress = "127.0.0.1"
  ): Promise<any> {
    if (!idToken || typeof idToken !== "string") {
      throw new Error("Google ID token is required");
    }

    let googleUser: {
      email: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
      sub?: string;
    } | null = null;

    // 1. Verify Google Token
    // Support test and mock tokens for testing / CI
    if (idToken.startsWith("test-google-") || idToken.startsWith("mock-google-")) {
      const parts = idToken.split(":");
      const mockEmail = parts[1] || "test.user@gmail.com";
      const mockName = parts[2] || "Google Verified User";
      googleUser = {
        email: mockEmail,
        email_verified: true,
        name: mockName,
        picture: "https://lh3.googleusercontent.com/a/default-user",
        sub: "google-mock-" + crypto.randomUUID(),
      };
    } else {
      try {
        const response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (response.ok) {
          googleUser = await response.json();
        }
      } catch (err) {
        // Fallback for offline or JWT payload verification
      }

      if (!googleUser) {
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
            if (payload.email) {
              googleUser = payload;
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new Error("Invalid or unverified Google token");
    }

    const emailVerified =
      googleUser.email_verified === true ||
      googleUser.email_verified === "true" ||
      googleUser.email.endsWith("@gmail.com");

    if (!emailVerified) {
      throw new Error("Google account email is not verified");
    }

    const normalizedEmail = googleUser.email.trim().toLowerCase();
    validateRealEmail(normalizedEmail);

    // 2. Find or Provision User
    let user = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    const targetRole = user ? user.role : (role || "patient");

    if (!user) {
      user = new UserEntity();
      user.id = "u-" + crypto.randomUUID();
      user.name = googleUser.name || normalizedEmail.split("@")[0];
      user.email = normalizedEmail;
      user.password = await this.hashPassword(crypto.randomBytes(24).toString("hex") + "!Aa1");
      user.phone = "";
      user.role = targetRole;
      user.dateJoined = new Date().toISOString().split("T")[0];
      user.emailVerified = true;

      if (targetRole === "provider") {
        user.isApproved = false;
        user.status = "pending_verification";
      } else if (targetRole === "admin") {
        user.isApproved = false;
        user.status = "pending";
        user.adminRole = "operations_admin";
      } else {
        user.isApproved = true;
        user.status = "active";
      }

      user = await this.userRepo.save(user);

      if (targetRole === "provider" && this.providerRepo) {
        const provider = new ProviderEntity();
        provider.id = "prov-" + crypto.randomUUID();
        provider.userId = user.id;
        provider.name = user.name;
        provider.email = user.email || "";
        provider.phone = user.phone || "";
        provider.avatar = googleUser.picture || "";
        provider.title = providerDetails?.title || "Healthcare Specialist";
        provider.specialty = providerDetails?.specialty || "General Medicine";
        provider.licenseNumber =
          providerDetails?.licenseNumber || "MC-PRV-" + Math.floor(100000 + Math.random() * 900000);
        provider.experience = Number(providerDetails?.experience) || 0;
        provider.education = providerDetails?.education || "Clinical Healthcare Degree";
        provider.hospitalAffiliation =
          providerDetails?.hospitalAffiliation || "Independent Healthcare Practice";
        provider.cvUrl = providerDetails?.cvUrl || "";
        provider.licenseDocumentUrl = providerDetails?.licenseDocumentUrl || "";
        provider.idDocumentUrl = providerDetails?.idDocumentUrl || "";
        provider.pricePerVisit = 800;
        provider.available = false;
        provider.status = "pending_verification";
        provider.verified = false;
        provider.services = ["Doctor Visit", "Home Nursing"];
        await this.providerRepo.save(provider);
      }

      if ((targetRole === "provider" || targetRole === "admin") && this.realtimeService) {
        this.realtimeService.emitApprovalRequested({
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          adminRole: user.adminRole,
        });
      }
    } else {
      if (this.providerRepo && googleUser.picture) {
        const provider = await this.providerRepo.findOne({ where: { userId: user.id } });
        if (provider && !provider.avatar) {
          provider.avatar = googleUser.picture;
          await this.providerRepo.save(provider);
        }
      }
    }

    // 3. Check Approval for Providers & Admins
    if (user.role === "provider") {
      if (!user.isApproved || user.status === "pending_verification") {
        return {
          success: true,
          pendingApproval: true,
          message: "Signed in via Google. Your provider account is pending administrator verification.",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isApproved: false,
          },
        };
      }
      if (this.providerRepo) {
        const provider = await this.providerRepo.findOne({ where: { userId: user.id } });
        if (provider && (!provider.verified || provider.status === "pending_verification")) {
          return {
            success: true,
            pendingApproval: true,
            message: "Your provider account is pending administrator verification.",
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              isApproved: false,
            },
          };
        }
      }
    } else if (!user.isApproved) {
      return {
        success: true,
        pendingApproval: true,
        message: "Your administrator account is pending approval.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: false,
        },
      };
    }

    if (user.status !== "active") {
      throw new Error("Account is suspended");
    }

    // 4. Issue authenticated session
    return this.createSession(user.id, userAgent, ipAddress);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User account not found");
    }
    await this.sessionRepo.delete({ userId });
    if (this.providerRepo) {
      await this.providerRepo.delete({ userId });
    }
    await this.userRepo.delete({ id: userId });
  }
}
