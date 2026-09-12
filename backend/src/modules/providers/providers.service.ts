import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { NotificationsService } from "../notifications/notifications.service";
import * as crypto from "crypto";

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(SessionEntity)
    private readonly sessionRepo?: Repository<SessionEntity>,
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
    verified?: string,
    search?: string,
    specialty?: string
  ): Promise<any[]> {
    const where: any = {};
    if (verified !== undefined && verified !== "all") {
      where.verified = verified === "true";
    } else if (verified === undefined) {
      where.verified = true;
    }

    const providers = await this.providerRepo.find({
      where,
      relations: ["user"],
      take: limit,
      skip: offset,
      order: { createdAt: "DESC" as any },
    });

    let results: any[] = [];
    for (const p of providers) {
      let phone = p.phone || p.user?.phone || "";
      let email = p.email || p.user?.email || "";

      if ((!phone || !email) && this.userRepo && p.userId) {
        const u = await this.userRepo.findOne({ where: { id: p.userId } }).catch(() => null);
        if (u) {
          if (!phone && u.phone) phone = u.phone;
          if (!email && u.email) email = u.email;
        }
      }

      const copy: any = {
        ...p,
        phone,
        email,
        services: p.services,
      };

      // Compute dynamic distance if coordinates available
      if (userLat !== undefined && userLon !== undefined && copy.latitude && copy.longitude) {
        copy.distance = `${this.calculateDistanceKm(userLat, userLon, copy.latitude, copy.longitude)} km`;
      }

      if (fuzzLocation && copy.latitude && copy.longitude) {
        copy.latitude = this.fuzzCoordinate(copy.latitude);
        copy.longitude = this.fuzzCoordinate(copy.longitude);
      }
      results.push(copy);
    }

    if (specialty && specialty !== "All") {
      const lower = specialty.toLowerCase();
      results = results.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(lower)) ||
          (p.services && p.services.some((s: string) => s.toLowerCase().includes(lower)))
      );
    }

    if (search && search.trim().length > 0) {
      const lower = search.trim().toLowerCase();
      results = results.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(lower)) ||
          (p.title && p.title.toLowerCase().includes(lower)) ||
          (p.services && p.services.some((s: string) => s.toLowerCase().includes(lower)))
      );
    }

    return results;
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

  async getProviderByUserId(userId: string): Promise<ProviderEntity | null> {
    return this.providerRepo.findOne({
      where: { userId },
      relations: ["user"],
    });
  }

  async updateProviderByUserId(userId: string, data: Partial<ProviderEntity>): Promise<ProviderEntity> {
    let provider = await this.providerRepo.findOne({ where: { userId } });
    if (!provider) {
      provider = new ProviderEntity();
      provider.id = `prov-${crypto.randomUUID()}`;
      provider.userId = userId;
      provider.name = data.name || "Healthcare Provider";
      provider.title = data.title || "Healthcare Specialist";
      provider.status = "active";
      provider.available = true;
    }
    if (data.name !== undefined) provider.name = data.name;
    if (data.title !== undefined) provider.title = data.title;
    if (data.pricePerVisit !== undefined) provider.pricePerVisit = data.pricePerVisit;
    if (data.available !== undefined) provider.available = data.available;
    if (data.latitude !== undefined) provider.latitude = data.latitude;
    if (data.longitude !== undefined) provider.longitude = data.longitude;
    if (data.services !== undefined) provider.services = data.services;
    if (data.avatar !== undefined) provider.avatar = data.avatar;
    if (data.experience !== undefined) provider.experience = data.experience;
    if (data.status !== undefined) provider.status = data.status;

    return this.providerRepo.save(provider);
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
    if (!provider) return null;

    const newStatus = provider.status === "active" ? "suspended" : "active";
    provider.status = newStatus;
    provider.available = newStatus === "active";

    // Synchronize underlying user status and invalidate sessions immediately if suspended
    if (this.userRepo && provider.userId) {
      const user = await this.userRepo.findOne({ where: { id: provider.userId } });
      if (user) {
        user.status = newStatus;
        await this.userRepo.save(user);
      }
    }

    if (newStatus === "suspended" && this.sessionRepo && provider.userId) {
      try {
        await this.sessionRepo.delete({ userId: provider.userId });
      } catch (err) {
        console.error("Failed to revoke sessions on provider suspension:", err);
      }
    }

    return this.providerRepo.save(provider);
  }

  async deleteProvider(id: string): Promise<{ success: boolean; message: string }> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException("Healthcare provider not found");
    }

    const userId = provider.userId;

    // Immediately purge all active sessions so tokens are killed instantly
    if (this.sessionRepo && userId) {
      try {
        await this.sessionRepo.delete({ userId });
      } catch (err) {
        console.error("Failed to revoke sessions on provider deletion:", err);
      }
    }

    // Handle user account: if user only had provider role, delete user; otherwise remove provider role
    if (this.userRepo && userId) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user) {
        const remainingRoles = (user.roles || "")
          .split(",")
          .map((r) => r.trim())
          .filter((r) => r && r !== "provider");

        if (remainingRoles.length === 0 && user.role === "provider" && !user.adminRole) {
          await this.userRepo.remove(user);
        } else {
          user.role = remainingRoles.includes("admin") ? "admin" : "patient";
          user.roles = remainingRoles.join(",");
          await this.userRepo.save(user);
        }
      }
    }

    await this.providerRepo.remove(provider);
    return {
      success: true,
      message: `Healthcare provider ${provider.name} has been immediately removed.`,
    };
  }

  async contactProvider(
    providerId: string, 
    actorId: string, 
    title: string, 
    message: string, 
    priority: "normal" | "urgent" = "normal"
  ): Promise<{ success: boolean; message: string }> {
    const provider = await this.providerRepo.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (this.notificationsService && provider.userId) {
      await this.notificationsService.sendNotification(provider.userId, {
        type: "general",
        title: title || "Message from MerihCare Administration",
        body: message,
        priority: priority === "urgent" ? "critical" : "normal",
        data: {
          sender: "administration",
          actorId,
          providerId,
        },
      }).catch((e) => console.error("[NOTIFICATIONS] Error sending notification to provider:", e));
    }

    return {
      success: true,
      message: `Message sent successfully to ${provider.name}`,
    };
  }
}
