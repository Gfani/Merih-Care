import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Optional()
    @InjectRepository(SessionEntity)
    private readonly sessionRepo?: Repository<SessionEntity>,
    @Optional()
    @InjectRepository(ProviderEntity)
    private readonly providerRepo?: Repository<ProviderEntity>,
  ) {}

  async getAllUsers(role: string = "patient"): Promise<UserEntity[]> {
    if (role && role !== "all") {
      return this.userRepo.find({ where: { role } });
    }
    return this.userRepo.find();
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return false;

    // Immediately revoke/purge active sessions so user is logged out immediately
    if (this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: id });
      } catch {}
    }

    // Clean up associated provider entity if one exists
    if (this.providerRepo) {
      try {
        const prov = await this.providerRepo.findOne({ where: { userId: id } });
        if (prov) await this.providerRepo.remove(prov);
      } catch {}
    }

    await this.userRepo.remove(user);
    return true;
  }

  async toggleUserSuspension(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const newStatus = user.status === "active" ? "suspended" : "active";
    user.status = newStatus;

    if (newStatus === "suspended" && this.sessionRepo) {
      try {
        await this.sessionRepo.delete({ userId: id });
      } catch {}
    }

    return this.userRepo.save(user);
  }

  async reactivateUser(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    user.status = "active";
    user.loginAttempts = 0;
    user.lockoutUntil = null;
    return this.userRepo.save(user);
  }

  async updateUserRole(id: string, newRole: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    user.role = newRole;
    return this.userRepo.save(user);
  }
}
