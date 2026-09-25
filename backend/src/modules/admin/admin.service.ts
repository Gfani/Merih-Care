import { Injectable, Optional, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { ROLE_PERMISSIONS } from "../../shared/constants/permissions";
import { validatePhoneNumber } from "../../shared/utils/phone.util";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Optional()
    @InjectRepository(SessionEntity)
    private readonly sessionRepo?: Repository<SessionEntity>,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
    @Optional()
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService?: RealtimeService,
  ) {}

  private getSettingsPath() {
    const databaseDir = path.join(process.cwd(), "database");
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    return path.join(databaseDir, "settings.json");
  }

  getSettings() {
    const settingsPath = this.getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      } catch (e) {
        console.error("Error reading settings.json", e);
      }
    }
    return {
      emailNotifs: true,
      smsNotifs: true,
      maintenanceMode: false,
      commissionRate: "15",
      minPayout: "500"
    };
  }

  updateSettings(data: any) {
    const settings = {
      emailNotifs: data.emailNotifs ?? true,
      smsNotifs: data.smsNotifs ?? true,
      maintenanceMode: data.maintenanceMode ?? false,
      commissionRate: data.commissionRate ?? "15",
      minPayout: data.minPayout ?? "500"
    };
    fs.writeFileSync(this.getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
    return settings;
  }

  async getAdminProfile(actorId?: string): Promise<any> {
    const admin = actorId
      ? await this.userRepo.findOne({ where: { id: actorId } })
      : await this.userRepo.findOne({ where: { role: "admin" } });
    if (!admin) return { name: "Admin Kebede", email: "admin@merihcare.et" };
    return { name: admin.name, email: admin.email, role: admin.role, adminRole: admin.adminRole };
  }

  async updateAdminProfile(actorId: string, name: string, email: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { id: actorId } });
    if (admin) {
      admin.name = name;
      admin.email = email;
      await this.userRepo.save(admin);
      return { name: admin.name, email: admin.email };
    }
    throw new Error("Admin user not found");
  }

  async updateAdminPassword(actorId: string, currentPass: string, newPass: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { id: actorId } });
    if (admin) {
      admin.password = newPass; // Hashed at controller/service level
      admin.mustChangePassword = false;
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
      await this.userRepo.save(admin);
      return { success: true };
    }
    throw new Error("Admin user not found");
  }


  // Generate a random Base32 TOTP secret key
  generateMfaSecret(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < 32; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    return secret;
  }

  // Administrative approvals
  async approveAdminAccount(actorId: string, targetId: string): Promise<UserEntity> {
    if (actorId && actorId === targetId) {
      throw new Error("Administrators cannot approve their own accounts");
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetId } });
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role !== "admin" && targetUser.role !== "super_admin") {
      throw new Error("Target user is not an administrator");
    }

    targetUser.isApproved = true;
    targetUser.status = "active";
    targetUser.emailVerified = true;
    targetUser.permissions = targetUser.adminRole === "super_admin" ? "all" : (targetUser.permissions || "all");
    const saved = await this.userRepo.save(targetUser);

    // Notify the newly approved administrator
    if (this.notificationsService) {
      await this.notificationsService.sendNotification(targetUser.id, {
        type: "verification_update",
        title: "Administrator Account Approved",
        body: `Congratulations ${targetUser.name}! Your MerihCare administrator registration has been approved. You may now sign in to access the administrator portal.`,
        priority: "critical",
        recipientEmail: targetUser.email,
        recipientPhone: targetUser.phone,
      }).catch(() => {});
    }

    // Broadcast live event to all superadmin consoles and target user
    if (this.realtimeService) {
      this.realtimeService.emitToRoom("admin", "user_status_changed", {
        userId: targetUser.id,
        status: "active",
        isApproved: true,
      });
      this.realtimeService.emitToRoom(`admin:${targetUser.id}`, "account_approved", {
        userId: targetUser.id,
      });
    }

    return saved;
  }

  async getPendingAdmins(): Promise<any[]> {
    const admins = await this.userRepo.find({
      where: [
        { role: "admin", isApproved: false },
        { role: "super_admin", isApproved: false },
      ],
      order: { createdAt: "DESC" } as any,
    });
    const realAdmins: any[] = [];

    for (const a of admins) {
      const email = (a.email || "").toLowerCase();
      // Filter out test-generated token mocks only
      if (email.includes("test-google-token")) {
        continue;
      }

      // Format clean department string for UI display
      const deptRaw = (a as any).department || a.adminRole || "operations";
      const department = deptRaw
        .replace(/_admin$/i, "")
        .replace(/[_\-]/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      realAdmins.push({
        ...a,
        department,
        adminRole: a.adminRole || "admin",
      });
    }

    return realAdmins;
  }

  async rejectAdminAccount(actorId: string, targetId: string): Promise<{ success: boolean }> {
    if (actorId && actorId === targetId) {
      throw new Error("Administrators cannot reject their own accounts");
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetId } });
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role !== "admin" && targetUser.role !== "super_admin") {
      throw new Error("Target user is not an administrator");
    }

    await this.userRepo.remove(targetUser);

    if (this.realtimeService) {
      this.realtimeService.emitToRoom("admin", "user_status_changed", {
        userId: targetId,
        status: "removed",
        isApproved: false,
      });
    }

    return { success: true };
  }

  async getAllAdministrators(): Promise<UserEntity[]> {
    return this.userRepo.find({
      where: [
        { role: "admin", isApproved: true },
        { role: "super_admin", isApproved: true },
        { role: "owner", isApproved: true },
      ],
      order: { dateJoined: "DESC" as any }
    });
  }

  async createAdministrator(data: { name: string; email: string; password: string; adminRole?: string; department?: string; phone?: string }): Promise<UserEntity> {
    const emailNorm = (data.email || "").toLowerCase().trim();
    const existing = await this.userRepo.findOne({ where: { email: emailNorm } });
    if (existing) {
      throw new Error("An account with this email address already exists");
    }

    const phoneValidation = validatePhoneNumber(data.phone);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || "A valid phone number is required.");
    }
    const phoneNorm = phoneValidation.normalized;

    const existingPhone = await this.userRepo.findOne({ where: { phone: phoneNorm } });
    if (existingPhone) {
      throw new Error("A user with this phone number is already registered");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const admin = new UserEntity();
    admin.id = "u-" + crypto.randomUUID();
    admin.name = data.name.trim();
    admin.email = emailNorm;
    admin.password = hashedPassword;
    admin.phone = phoneNorm;
    admin.role = data.adminRole === "owner" ? "owner" : "admin";
    admin.roles = data.adminRole === "owner" ? "owner,admin" : "admin";
    admin.adminRole = data.adminRole || (data.department ? `${data.department.toLowerCase()}_admin` : "operations_admin");
    admin.isApproved = true;
    admin.status = "active";
    admin.permissions = (admin.adminRole === "super_admin" || admin.adminRole === "owner")
      ? "all" 
      : (ROLE_PERMISSIONS[admin.adminRole] || []).join(",");
    admin.dateJoined = new Date().toISOString().split("T")[0];

    return this.userRepo.save(admin);
  }

  async deleteAdministrator(actorId: string, targetId: string): Promise<{ success: boolean; message?: string }> {
    if (actorId && actorId === targetId) {
      throw new Error("Super administrators cannot delete their own account");
    }
    const targetUser = await this.userRepo.findOne({ where: { id: targetId } });
    if (!targetUser) {
      throw new Error("Administrator account not found");
    }

    // Resolve actor details
    const actorUser = actorId ? await this.userRepo.findOne({ where: { id: actorId } }) : null;
    const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();

    const isActorOwner =
      actorUser?.role === "owner" ||
      actorUser?.adminRole === "owner" ||
      (actorUser?.email && actorUser.email.toLowerCase().trim() === ownerEmail);

    const isActorSuper =
      isActorOwner ||
      actorUser?.adminRole === "super_admin" ||
      actorUser?.role === "super_admin";

    if (!isActorSuper) {
      throw new Error("Only super administrators have permission to delete administrators");
    }

    // Supreme Owner Protection: Nobody can delete the Owner account under any circumstances
    const isTargetOwner =
      targetUser.role === "owner" ||
      targetUser.adminRole === "owner" ||
      (targetUser.email && targetUser.email.toLowerCase().trim() === ownerEmail);

    if (isTargetOwner) {
      throw new Error("The platform Owner account cannot be deleted under any circumstances");
    }

    // Check if target is a super administrator
    const isTargetSuper =
      targetUser.adminRole === "super_admin" ||
      targetUser.role === "super_admin";

    if (isTargetSuper) {
      // Standard super_admin accounts cannot delete other super_admins; ONLY the Owner can delete a super_admin
      if (!isActorOwner) {
        throw new Error("Super administrators cannot delete other super administrators. Only the platform Owner has permission to delete a super administrator.");
      }
    }

    // Revoke and purge all active sessions immediately so tokens are killed instantly
    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: targetUser.id });
      } catch (err) {
        console.error("Failed to revoke sessions on admin deletion:", err);
      }
    }

    targetUser.status = "disabled";
    targetUser.isApproved = false;
    targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1;
    await this.userRepo.remove(targetUser);

    if (this.realtimeService) {
      try {
        this.realtimeService.emitToRoom("admin", "user_status_changed", {
          userId: targetId,
          status: "removed",
          isApproved: false,
        });
      } catch (err) {
        console.error("Failed to emit admin removal status change:", err);
      }
    }

    return { success: true, message: `Administrator ${targetUser.name || targetUser.email} has been immediately removed.` };
  }

  async updateAdminPasswordForUser(actorEmail: string, userId: string, newPass: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("Administrator account not found");
    }

    const isTargetAdmin =
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.role === "owner" ||
      !!user.adminRole ||
      (user.roles && user.roles.includes("admin"));

    if (!isTargetAdmin) {
      throw new Error("Target user is not an administrator account. Operation rejected.");
    }

    const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();
    const actorUser = actorEmail ? await this.userRepo.findOne({ where: { email: actorEmail } }) : null;

    const isActorOwner =
      actorUser?.role === "owner" ||
      actorUser?.adminRole === "owner" ||
      (actorEmail && actorEmail.toLowerCase().trim() === ownerEmail);

    const isActorSuper =
      isActorOwner ||
      actorUser?.adminRole === "super_admin" ||
      actorUser?.role === "super_admin";

    const isSelf = actorUser && actorUser.id === user.id;

    if (!isActorSuper && !isSelf) {
      throw new Error("Only super administrators can reset passwords for other administrator accounts.");
    }

    const isTargetOwner =
      user.role === "owner" ||
      user.adminRole === "owner" ||
      (user.email && user.email.toLowerCase().trim() === ownerEmail);

    if (isTargetOwner && !isActorOwner && !isSelf) {
      throw new Error("Cannot reset the password of the platform Owner.");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPass, salt);
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    user.mustChangePassword = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: user.id });
      } catch {}
    }

    return this.userRepo.save(user);
  }

  async promoteAdministrator(actorId: string, targetUserId: string, targetAdminRole: string): Promise<UserEntity> {
    const actorUser = await this.userRepo.findOne({ where: { id: actorId } });
    const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();

    const isActorOwner =
      actorUser?.role === "owner" ||
      actorUser?.adminRole === "owner" ||
      (actorUser?.email && actorUser.email.toLowerCase().trim() === ownerEmail);

    const isSuper =
      isActorOwner ||
      actorUser?.adminRole === "super_admin" ||
      actorUser?.role === "super_admin";

    if (!isSuper) {
      throw new Error("Only super administrators have permission to promote administrators or reassign administrative roles");
    }

    const validRoles = ["owner", "super_admin", "operations_admin", "finance_admin", "verification_admin", "support_admin", "medical_admin"];
    if (!validRoles.includes(targetAdminRole)) {
      throw new Error(`Invalid administrative role. Must be one of: ${validRoles.join(", ")}`);
    }

    if (targetAdminRole === "owner" && !isActorOwner) {
      throw new Error("Only the platform Owner can designate an Owner account");
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new Error("Target user account not found");
    }

    const isTargetOwner =
      targetUser.role === "owner" ||
      targetUser.adminRole === "owner" ||
      (targetUser.email && targetUser.email.toLowerCase().trim() === ownerEmail);

    if (isTargetOwner) {
      throw new Error("The platform Owner role cannot be demoted or altered");
    }

    const isTargetSuper = targetUser.adminRole === "super_admin" || targetUser.role === "super_admin";
    if (isTargetSuper && targetAdminRole !== "super_admin" && targetAdminRole !== "owner") {
      if (!isActorOwner) {
        throw new Error("Super administrators cannot demote other super administrators. Only the platform Owner has permission to demote a super administrator.");
      }
    }

    targetUser.role = targetAdminRole === "owner" ? "owner" : "admin";
    targetUser.adminRole = targetAdminRole;
    targetUser.isApproved = true;
    targetUser.status = "active";
    targetUser.permissions =
      (targetAdminRole === "super_admin" || targetAdminRole === "owner")
        ? "all"
        : (ROLE_PERMISSIONS[targetAdminRole] || []).join(",");
    targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1;

    // Invalidate sessions so the target must re-authenticate with newly assigned privileges
    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: targetUser.id });
      } catch (err) {
        console.error("Failed to invalidate sessions on role promotion:", err);
      }
    }

    return this.userRepo.save(targetUser);
  }

}

