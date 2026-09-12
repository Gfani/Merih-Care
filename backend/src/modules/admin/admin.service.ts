import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

export function isSuperiorAdmin(email?: string): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return clean === "fanuelgoitom79@gmail.com" || clean === "fanuelgoitom79@gmial.com";
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Optional()
    @InjectRepository(SessionEntity)
    private readonly sessionRepo?: Repository<SessionEntity>,
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
    targetUser.permissions = "all";
    return this.userRepo.save(targetUser);
  }

  async getPendingAdmins(): Promise<UserEntity[]> {
    const admins = await this.userRepo.find({ where: { role: "admin", isApproved: false } });
    const realAdmins: UserEntity[] = [];
    const mockAdmins: UserEntity[] = [];

    for (const a of admins) {
      // Must complete email OTP verification before appearing in pending approval queue
      if (!a.emailVerified) {
        continue;
      }

      const email = (a.email || "").toLowerCase();
      const name = (a.name || "").toLowerCase();
      const isMock =
        name === "merihcare admin" ||
        /^admin\.\d+@gmail\.com$/.test(email) ||
        email.includes("test-google-token");
      if (isMock) {
        mockAdmins.push(a);
      } else {
        realAdmins.push(a);
      }
    }

    // Automatically clean up any synthetic mock accounts
    if (mockAdmins.length > 0) {
      await this.userRepo.remove(mockAdmins).catch(() => {});
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
    return { success: true };
  }

  async getAllAdministrators(): Promise<UserEntity[]> {
    return this.userRepo.find({
      where: [
        { role: "admin", isApproved: true },
        { role: "super_admin", isApproved: true }
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const admin = new UserEntity();
    admin.id = "u-" + crypto.randomUUID();
    admin.name = data.name.trim();
    admin.email = emailNorm;
    admin.password = hashedPassword;
    admin.phone = data.phone?.trim() || "";
    admin.role = "admin";
    admin.adminRole = data.adminRole || (data.department ? `${data.department.toLowerCase()}_admin` : "operations_admin");
    admin.isApproved = true;
    admin.status = "active";
    admin.permissions = "all";
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
    const targetEmail = (targetUser.email || "").toLowerCase().trim();
    if (isSuperiorAdmin(targetEmail)) {
      throw new Error("The superior administrator account (fanuelgoitom79@gmail.com) cannot be deleted under any circumstances");
    }

    // Resolve actor details
    let actorEmail = "";
    if (actorId) {
      const actorUser = await this.userRepo.findOne({ where: { id: actorId } });
      actorEmail = (actorUser?.email || "").toLowerCase().trim();
    }

    // Check if target is a super administrator
    const isTargetSuper =
      targetUser.adminRole === "super_admin" ||
      targetUser.role === "super_admin" ||
      targetEmail === "goitomfanuel@gmail.com" ||
      targetEmail === "fani@g.com";

    if (isTargetSuper && !isSuperiorAdmin(actorEmail)) {
      throw new Error("Only the superior administrator (fanuelgoitom79@gmail.com) has permission to delete super administrators");
    }

    // Revoke and purge all active sessions immediately so tokens are killed instantly
    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: targetUser.id });
      } catch (err) {
        console.error("Failed to revoke sessions on admin deletion:", err);
      }
    }

    await this.userRepo.remove(targetUser);
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
      !!user.adminRole ||
      (user.roles && user.roles.includes("admin"));

    if (!isTargetAdmin) {
      throw new Error("Target user is not an administrator account. Operation rejected.");
    }

    const targetEmail = (user.email || "").toLowerCase().trim();
    if (
      (targetEmail === "fanuelgoitom79@gmail.com" || targetEmail === "fanuelgoitom79@gmial.com") &&
      !isSuperiorAdmin(actorEmail)
    ) {
      throw new Error("Only the superior administrator can reset their own password.");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPass, salt);
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: user.id });
      } catch {}
    }

    return this.userRepo.save(user);
  }

}
