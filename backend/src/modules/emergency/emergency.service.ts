import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(EmergencyEntity)
    private readonly emergencyRepo: Repository<EmergencyEntity>,
  ) {}

  async getAllEmergencies(): Promise<EmergencyEntity[]> {
    return this.emergencyRepo.find();
  }

  async dispatchEmergency(id: string, responder: string): Promise<EmergencyEntity> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (alert) {
      alert.status = "dispatched";
      alert.responder = responder;
      return this.emergencyRepo.save(alert);
    }
    return null;
  }
}
