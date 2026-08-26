import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
  ) {}

  async getVerificationQueue(): Promise<any[]> {
    const providers = await this.providerRepo.find({ where: { verified: false } });
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
  }

  async approveProvider(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = true;
      provider.status = "verified";
      return this.providerRepo.save(provider);
    }
    return null;
  }

  async rejectProvider(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = false;
      provider.status = "rejected";
      return this.providerRepo.save(provider);
    }
    return null;
  }
}
