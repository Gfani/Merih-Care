import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceEntity } from "../../database/entities/service.entity";

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceEntity)
    private readonly serviceRepo: Repository<ServiceEntity>,
  ) {}

  async getAllServices(): Promise<ServiceEntity[]> {
    return this.serviceRepo.find();
  }

  async toggleServiceActive(id: string): Promise<ServiceEntity> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (service) {
      service.status = service.status === "active" ? "closed" : "active";
      return this.serviceRepo.save(service);
    }
    return null;
  }
}
