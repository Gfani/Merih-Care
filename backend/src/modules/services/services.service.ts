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

  async createService(data: any): Promise<ServiceEntity> {
    const service = new ServiceEntity();
    service.id = data.id || `srv-${Date.now()}`;
    service.name = data.name;
    service.description = data.description || "";
    service.icon = data.icon || "Activity";
    service.priceFrom = Number(data.priceFrom) || 0;
    service.providerCount = 0;
    service.status = "active";
    return this.serviceRepo.save(service);
  }

  async updateService(id: string, data: any): Promise<ServiceEntity> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (service) {
      if (data.name !== undefined) service.name = data.name;
      if (data.description !== undefined) service.description = data.description;
      if (data.icon !== undefined) service.icon = data.icon;
      if (data.priceFrom !== undefined) service.priceFrom = Number(data.priceFrom);
      if (data.status !== undefined) service.status = data.status;
      return this.serviceRepo.save(service);
    }
    return null;
  }
}
