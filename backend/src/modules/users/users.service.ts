import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async getAllUsers(role = "patient"): Promise<UserEntity[]> {
    return this.userRepo.find({ where: { role } });
  }

  async toggleUserSuspension(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    user.status = user.status === "active" ? "suspended" : "active";
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
