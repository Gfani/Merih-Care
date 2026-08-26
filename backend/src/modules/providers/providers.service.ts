import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
  ) {}

  async getAllProviders(): Promise<any[]> {
    const providers = await this.providerRepo.find();
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
  }

  async toggleProviderSuspension(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.status = provider.status === "active" ? "suspended" : "active";
      return this.providerRepo.save(provider);
    }
    return null;
  }
}
