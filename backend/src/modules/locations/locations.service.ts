import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LocationEntity } from "../../database/entities/location.entity";
import { LocationHistoryEntity } from "../../database/entities/emergency-relation.entity";
import * as crypto from "crypto";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private readonly locationRepo: Repository<LocationEntity>,
    @InjectRepository(LocationHistoryEntity)
    private readonly historyRepo: Repository<LocationHistoryEntity>,
  ) {}

  async getAllLocations(): Promise<LocationEntity[]> {
    const locations = await this.locationRepo.find();
    const formatted = locations.map(loc => {
      // Hide location when provider is offline
      if (loc.role === "provider" && loc.status === "offline") {
        loc.x = 0;
        loc.y = 0;
      }
      // Provider privacy controls: mask coordinates if privacyMode is active
      if (loc.role === "provider" && loc.privacyMode) {
        // Mask coordinate precision to neighborhood level (~1km accuracy) by rounding to 2 decimals
        loc.x = Math.round(loc.x * 100) / 100;
        loc.y = Math.round(loc.y * 100) / 100;
      }
      return loc;
    });

    // Prioritize emergency/critical status locations first
    return formatted.sort((a, b) => {
      const aVal = a.status === "critical" ? 1 : 0;
      const bVal = b.status === "critical" ? 1 : 0;
      return bVal - aVal;
    });
  }

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
    accuracy = 0,
  ): Promise<LocationEntity> {
    // Try to find by location ID or user ID
    let loc = await this.locationRepo.findOne({ where: [{ id }, { userId: id }] });
    if (!loc) {
      loc = new LocationEntity();
      loc.id = id.startsWith("loc-") ? id : `loc-${crypto.randomUUID()}`;
      loc.userId = id;
      loc.role = "provider";
    }

    loc.y = latitude; // y is latitude
    loc.x = longitude; // x is longitude
    loc.accuracy = accuracy;
    loc.locationTimestamp = new Date().toISOString();
    loc.updatedAt = new Date();

    const saved = await this.locationRepo.save(loc);

    // Save location history record
    const history = new LocationHistoryEntity();
    history.id = `loch-${crypto.randomUUID()}`;
    history.providerId = loc.userId || id;
    history.x = longitude;
    history.y = latitude;
    history.timestamp = new Date().toISOString();
    await this.historyRepo.save(history);

    return saved;
  }

  async setPrivacyMode(userId: string, privacyMode: boolean): Promise<LocationEntity> {
    let loc = await this.locationRepo.findOne({ where: { userId } });
    if (!loc) {
      loc = new LocationEntity();
      loc.id = `loc-${crypto.randomUUID()}`;
      loc.userId = userId;
      loc.role = "provider";
      loc.x = 38.7578; // Addis Ababa default lon
      loc.y = 9.0192;  // Addis Ababa default lat
    }
    loc.privacyMode = privacyMode;
    return this.locationRepo.save(loc);
  }

  async setStatus(userId: string, status: string): Promise<LocationEntity> {
    let loc = await this.locationRepo.findOne({ where: { userId } });
    if (!loc) {
      loc = new LocationEntity();
      loc.id = `loc-${crypto.randomUUID()}`;
      loc.userId = userId;
      loc.role = "provider";
      loc.x = 38.7578;
      loc.y = 9.0192;
    }
    loc.status = status;
    return this.locationRepo.save(loc);
  }

  checkGeofenceArrival(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radiusMeters = 100
  ): { isWithinGeofence: boolean; distanceMeters: number } {
    const R = 6371e3; // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    return {
      isWithinGeofence: distanceMeters <= radiusMeters,
      distanceMeters,
    };
  }

  async getEmergencyOverlays(): Promise<any[]> {
    const locations = await this.locationRepo.find({ where: { status: "critical" } });
    return locations.map((loc) => ({
      id: loc.id,
      userId: loc.userId,
      latitude: loc.y,
      longitude: loc.x,
      severity: "critical",
      updatedAt: loc.locationTimestamp || new Date().toISOString(),
    }));
  }

  calculateDistanceAndEta(lat1: number, lon1: number, lat2: number, lon2: number) {
    // Haversine formula to compute geodesic distance on Earth
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Average travel speed in Addis Ababa traffic is ~20-25 km/h
    const speedKmh = 22;
    const etaMinutes = Math.ceil((distanceKm / speedKmh) * 60);

    return {
      distance: `${distanceKm.toFixed(2)} km`,
      eta: etaMinutes,
    };
  }
}
