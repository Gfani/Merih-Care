import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findPatients(): Promise<UserEntity[]> {
    return this.userRepo.find({ where: { role: "patient" } });
  }
}
