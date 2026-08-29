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

  /**
   * Fuzz coordinate to approximately 500m radius to preserve privacy before booking
   */
  fuzzCoordinate(coord: number): number {
    return Math.round(coord * 200) / 200;
  }

  async getAllProviders(fuzzLocation = true): Promise<any[]> {
    const providers = await this.providerRepo.find();
    return providers.map((p) => {
      const copy: any = { ...p, services: p.services };
      if (fuzzLocation && copy.latitude && copy.longitude) {
        copy.latitude = this.fuzzCoordinate(copy.latitude);
        copy.longitude = this.fuzzCoordinate(copy.longitude);
      }
      return copy;
    });
  }

  async toggleProviderSuspension(id: string): Promise<ProviderEntity | null> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.status = provider.status === "active" ? "suspended" : "active";
      return this.providerRepo.save(provider);
    }
    return null;
  }
}
