import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
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

  async getAdminProfile(): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (!admin) return { name: "Admin Kebede", email: "admin@merihcare.et" };
    return { name: admin.name, email: admin.email };
  }

  async updateAdminProfile(name: string, email: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (admin) {
      admin.name = name;
      admin.email = email;
      await this.userRepo.save(admin);
      return { name: admin.name, email: admin.email };
    }
    throw new Error("Admin user not found");
  }

  async updateAdminPassword(currentPass: string, newPass: string): Promise<any> {
    const admin = await this.userRepo.findOne({ where: { role: "admin" } });
    if (admin) {
      admin.password = newPass; // Hashed at controller/service level
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
    if (actorId === targetId) {
      throw new Error("Administrators cannot approve their own accounts");
    }

    const targetUser = await this.userRepo.findOne({ where: { id: targetId } });
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role !== "admin") {
      throw new Error("Target user is not an administrator");
    }

    targetUser.isApproved = true;
    return this.userRepo.save(targetUser);
  }

  async getPendingAdmins(): Promise<UserEntity[]> {
    return this.userRepo.find({ where: { role: "admin", isApproved: false } });
  }
}
