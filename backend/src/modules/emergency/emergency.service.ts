import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import { EmergencyResponderEntity } from "../../database/entities/emergency-relation.entity";

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(EmergencyEntity)
    private readonly emergencyRepo: Repository<EmergencyEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getAllEmergencies(): Promise<EmergencyEntity[]> {
    return this.emergencyRepo.find();
  }

  // Atomic database transactions for emergency dispatches
  async dispatchEmergency(id: string, responder: string): Promise<EmergencyEntity> {
    return this.dataSource.transaction(async (manager) => {
      const alert = await manager.findOne(EmergencyEntity, { where: { id } });
      if (alert) {
        alert.status = "dispatched";
        alert.responder = responder;
        const savedAlert = await manager.save(alert);

        const dispatchLog = new EmergencyResponderEntity();
        dispatchLog.id = "log-" + Date.now();
        dispatchLog.emergencyId = id;
        dispatchLog.providerId = "provider-temp-id";
        dispatchLog.dispatchedAt = new Date().toISOString();
        await manager.save(dispatchLog);

        return savedAlert;
      }
      return null;
    });
  }
}
