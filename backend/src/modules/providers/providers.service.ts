import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import * as crypto from "crypto";

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

  /**
   * Calculates Haversine distance in kilometers between two GPS points
   */
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  async getAllProviders(
    fuzzLocation = true,
    limit = 50,
    offset = 0,
    userLat?: number,
    userLon?: number,
    verified?: string
  ): Promise<any[]> {
    const where: any = {};
    if (verified !== undefined) {
      where.verified = verified === "true";
    }

    const providers = await this.providerRepo.find({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: "DESC" as any },
    });

    return providers.map((p) => {
      const copy: any = { ...p, services: p.services };

      // Compute dynamic distance if coordinates available
      if (userLat !== undefined && userLon !== undefined && copy.latitude && copy.longitude) {
        copy.distance = `${this.calculateDistanceKm(userLat, userLon, copy.latitude, copy.longitude)} km`;
      }

      if (fuzzLocation && copy.latitude && copy.longitude) {
        copy.latitude = this.fuzzCoordinate(copy.latitude);
        copy.longitude = this.fuzzCoordinate(copy.longitude);
      }
      return copy;
    });
  }

  async getProviderById(id: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({
      where: { id },
      relations: ["user"],
    });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return provider;
  }

  async createProvider(data: Partial<ProviderEntity>): Promise<ProviderEntity> {
    const provider = new ProviderEntity();
    provider.id = data.id || `prov-${crypto.randomUUID()}`;
    provider.name = data.name || "Healthcare Provider";
    provider.title = data.title || "Specialist";
    provider.userId = data.userId || null;
    provider.pricePerVisit = data.pricePerVisit || 500;
    provider.latitude = data.latitude || null;
    provider.longitude = data.longitude || null;
    provider.available = data.available !== undefined ? data.available : true;
    provider.status = "active";
    if (data.services) {
      provider.services = data.services;
    }
    return this.providerRepo.save(provider);
  }

  async updateProvider(id: string, data: Partial<ProviderEntity>): Promise<ProviderEntity> {
    const provider = await this.getProviderById(id);
    if (data.name !== undefined) provider.name = data.name;
    if (data.title !== undefined) provider.title = data.title;
    if (data.pricePerVisit !== undefined) provider.pricePerVisit = data.pricePerVisit;
    if (data.available !== undefined) provider.available = data.available;
    if (data.latitude !== undefined) provider.latitude = data.latitude;
    if (data.longitude !== undefined) provider.longitude = data.longitude;
    if (data.services !== undefined) provider.services = data.services;
    if (data.status !== undefined) provider.status = data.status;

    return this.providerRepo.save(provider);
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
