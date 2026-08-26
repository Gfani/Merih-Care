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

  async getAllUsers(): Promise<UserEntity[]> {
    return this.userRepo.find({ where: { role: "patient" } });
  }

  async toggleUserSuspension(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user) {
      user.status = user.status === "active" ? "suspended" : "active";
      return this.userRepo.save(user);
    }
    return null;
  }
}
