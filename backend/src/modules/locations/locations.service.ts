import { Injectable, BadRequestException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LocationEntity } from "../../database/entities/location.entity";
import { LocationHistoryEntity } from "../../database/entities/emergency-relation.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { RealtimeService } from "../realtime/realtime.service";
import * as crypto from "crypto";

let locationsRedisClient: any = null;
let locationsRedisInitialized = false;

export function setLocationsRedisClientForTesting(client: any) {
  locationsRedisClient = client;
  locationsRedisInitialized = true;
}

export function resetLocationsRedisClientForTesting() {
  locationsRedisClient = null;
  locationsRedisInitialized = false;
}

export function getLocationsRedisClient(): any {
  if (locationsRedisInitialized) return locationsRedisClient;
  locationsRedisInitialized = true;
  const redisUrl =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
      ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      : null);
  if (!redisUrl) return null;
  try {
    const Redis = require("ioredis");
    locationsRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 2) return null;
        return 1000;
      },
    });
    locationsRedisClient.connect().catch(() => {
      locationsRedisClient = null;
    });
  } catch (_) {
    locationsRedisClient = null;
  }
  return locationsRedisClient;
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private readonly locationRepo: Repository<LocationEntity>,
    @InjectRepository(LocationHistoryEntity)
    private readonly historyRepo: Repository<LocationHistoryEntity>,
    @InjectRepository(ProviderEntity)
    @Optional()
    private readonly providerRepo?: Repository<ProviderEntity>,
    @Optional()
    private readonly realtimeService?: RealtimeService,
  ) {}

  async getActiveProviderLocations(): Promise<LocationEntity[]> {
    const redis = (this as any).redis || getLocationsRedisClient();
    let redisMembers: string[] = [];
    let redisPositions: Array<[string, string] | null> = [];

    if (redis) {
      try {
        const members: string[] = await redis.zrange("providers:locations:online", 0, -1);
        if (Array.isArray(members) && members.length > 0) {
          redisMembers = members;
          redisPositions = await redis.geopos("providers:locations:online", ...members);
        }
      } catch (err) {
        // Safe failover
      }
    }

    const onlineProviders: LocationEntity[] = [];
    const seenIds = new Set<string>();

    // Query genuine locations and providers from DB
    const locationsFromDb = await this.locationRepo.find();
    const providersFromDb = this.providerRepo
      ? await this.providerRepo.find({ where: { available: true } }).catch(() => [])
      : [];

    const locMap = new Map<string, LocationEntity>();
    for (const l of locationsFromDb) {
      if (l.userId) locMap.set(l.userId, l);
      locMap.set(l.id, l);
    }

    const provMap = new Map<string, ProviderEntity>();
    for (const p of providersFromDb) {
      if (p.userId) provMap.set(p.userId, p);
      provMap.set(p.id, p);
    }

    // A. Add providers actively reporting in Redis GEO
    if (redisMembers.length > 0) {
      for (let i = 0; i < redisMembers.length; i++) {
        const memberId = redisMembers[i];
        const pos = redisPositions[i];
        if (!pos) continue;
        const lng = parseFloat(pos[0]);
        const lat = parseFloat(pos[1]);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

        seenIds.add(memberId);
        const existing = locMap.get(memberId);
        const prov = provMap.get(memberId);
        const entry = new LocationEntity();
        entry.id = existing?.id || `loc-${memberId}`;
        entry.userId = memberId;
        (entry as any).providerId = memberId;
        entry.role = "provider";
        entry.status = existing?.status && existing.status !== "offline" ? existing.status : "available";
        entry.accuracy = existing?.accuracy || 5;
        entry.privacyMode = existing?.privacyMode || false;
        entry.locationTimestamp = existing?.locationTimestamp || new Date().toISOString();
        entry.x = entry.privacyMode ? Math.round(lng * 100) / 100 : lng;
        entry.y = entry.privacyMode ? Math.round(lat * 100) / 100 : lat;
        (entry as any).lat = entry.y;
        (entry as any).lng = entry.x;
        (entry as any).latitude = entry.y;
        (entry as any).longitude = entry.x;
        (entry as any).isOnline = true;
        (entry as any).name = prov?.name || existing?.name || `Provider ${memberId.slice(-4)}`;
        onlineProviders.push(entry);
      }
    }

    // B. Also include genuine active/available providers from DB
    for (const l of locationsFromDb) {
      const id = l.userId || l.id;
      if (seenIds.has(id) || seenIds.has(l.id)) continue;
      if (l.role !== "provider") continue;

      const isOffline = l.status === "offline";
      if (!isOffline && (!l.x || !l.y || (l.x === 0 && l.y === 0) || isNaN(l.x) || isNaN(l.y))) continue;

      seenIds.add(id);
      const prov = provMap.get(id);
      const entry = new LocationEntity();
      entry.id = l.id;
      entry.userId = l.userId || l.id;
      (entry as any).providerId = entry.userId;
      entry.role = "provider";
      entry.status = l.status || "available";
      entry.accuracy = l.accuracy || 5;
      entry.privacyMode = l.privacyMode || false;
      entry.locationTimestamp = l.locationTimestamp || l.updatedAt?.toISOString() || new Date().toISOString();

      if (isOffline) {
        entry.x = 0;
        entry.y = 0;
        (entry as any).lat = 0;
        (entry as any).lng = 0;
        (entry as any).latitude = 0;
        (entry as any).longitude = 0;
        (entry as any).isOnline = false;
      } else {
        entry.x = entry.privacyMode ? Math.round(l.x * 100) / 100 : l.x;
        entry.y = entry.privacyMode ? Math.round(l.y * 100) / 100 : l.y;
        (entry as any).lat = entry.y;
        (entry as any).lng = entry.x;
        (entry as any).latitude = entry.y;
        (entry as any).longitude = entry.x;
        (entry as any).isOnline = true;
      }

      (entry as any).name = prov?.name || l.name || `Provider ${entry.userId.slice(-4)}`;
      onlineProviders.push(entry);

      // Warm Redis GEO key if online
      if (!isOffline && redis && typeof redis.geoadd === "function") {
        redis.geoadd("providers:locations:online", l.x, l.y, entry.userId).catch(() => {});
      }
    }

    // C. Also check verified providers who have available: true in providerRepo
    for (const p of providersFromDb) {
      const id = p.userId || p.id;
      if (seenIds.has(id) || seenIds.has(p.id)) continue;
      if (!p.available || p.status === "suspended") continue;
      if (!p.latitude || !p.longitude || (p.latitude === 0 && p.longitude === 0)) continue;

      seenIds.add(id);
      const entry = new LocationEntity();
      entry.id = `loc-${id}`;
      entry.userId = p.userId || p.id;
      (entry as any).providerId = entry.userId;
      entry.role = "provider";
      entry.status = "available";
      entry.accuracy = 5;
      entry.privacyMode = false;
      entry.locationTimestamp = p.updatedAt?.toISOString() || new Date().toISOString();
      entry.x = p.longitude;
      entry.y = p.latitude;
      (entry as any).lat = entry.y;
      (entry as any).lng = entry.x;
      (entry as any).latitude = entry.y;
      (entry as any).longitude = entry.x;
      (entry as any).isOnline = true;
      (entry as any).name = p.name || `Dr. ${entry.userId.slice(-4)}`;
      onlineProviders.push(entry);

      if (redis && typeof redis.geoadd === "function") {
        redis.geoadd("providers:locations:online", p.longitude, p.latitude, entry.userId).catch(() => {});
      }
    }

    return onlineProviders;
  }

  async getAllLocations(): Promise<LocationEntity[]> {
    return this.getActiveProviderLocations();
  }

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
    accuracy = 0,
  ): Promise<LocationEntity> {
    if (typeof latitude !== "number" || typeof longitude !== "number" || isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException("Invalid coordinates: latitude and longitude must be numbers");
    }
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException(`Latitude ${latitude} is out of valid range [-90, 90]`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException(`Longitude ${longitude} is out of valid range [-180, 180]`);
    }

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

    // In-memory Redis Geospatial update
    const redis = getLocationsRedisClient();
    if (redis) {
      try {
        const providerMemberId = loc.userId || id;
        if (loc.status !== "offline") {
          // Redis GEOADD: key longitude latitude member (longitude MUST precede latitude in Redis)
          await redis.geoadd("providers:locations:online", longitude, latitude, providerMemberId);
        } else {
          await redis.zrem("providers:locations:online", providerMemberId);
        }
      } catch (err) {
        // Safe failover if Redis command encounters an error
      }
    }

    if (this.realtimeService) {
      const updatePayload = {
        providerId: loc.userId || id,
        userId: loc.userId || id,
        lat: latitude,
        lng: longitude,
        x: longitude,
        y: latitude,
        latitude,
        longitude,
        lastUpdated: loc.locationTimestamp,
        status: loc.status || "available",
        isOnline: true,
      };
      this.realtimeService.emitToRoom("admin", "location_update", updatePayload);
      this.realtimeService.emitToRoom("admin_room", "location_update", updatePayload);
    }

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
    const saved = await this.locationRepo.save(loc);

    // Synchronize Redis Geospatial index
    const redis = getLocationsRedisClient();
    if (redis) {
      try {
        if (status === "offline") {
          await redis.zrem("providers:locations:online", userId);
        } else if (typeof loc.x === "number" && typeof loc.y === "number" && (loc.x !== 0 || loc.y !== 0)) {
          await redis.geoadd("providers:locations:online", loc.x, loc.y, userId);
        }
      } catch (err) {
        // Safe failover
      }
    }

    if (this.realtimeService) {
      if (status === "offline") {
        const offlinePayload = {
          providerId: userId,
          userId,
          status: "offline",
          ts: new Date().toISOString(),
        };
        this.realtimeService.emitToRoom("admin", "provider_offline", offlinePayload);
        this.realtimeService.emitToRoom("admin_room", "provider_offline", offlinePayload);
      } else {
        const updatePayload = {
          providerId: userId,
          userId,
          lat: loc.y,
          lng: loc.x,
          x: loc.x,
          y: loc.y,
          latitude: loc.y,
          longitude: loc.x,
          status,
          isOnline: true,
          lastUpdated: loc.locationTimestamp || new Date().toISOString(),
        };
        this.realtimeService.emitToRoom("admin", "location_update", updatePayload);
        this.realtimeService.emitToRoom("admin_room", "location_update", updatePayload);
      }
    }

    return saved;
  }

  /**
   * Find online providers within radiusKm using Redis GEOSEARCH / GEORADIUS.
   * Resiliently falls back to database locations if Redis is unpopulated, offline, or unavailable.
   */
  async findNearbyOnlineProviders(
    patientLat: number,
    patientLng: number,
    radiusKm = 5,
  ): Promise<Array<{ providerId: string; lat: number; lng: number; distanceKm: number }>> {
    const redis = getLocationsRedisClient();
    if (redis) {
      try {
        let results: any = null;
        if (typeof redis.geosearch === "function") {
          results = await redis.geosearch(
            "providers:locations:online",
            "FROMLONLAT",
            patientLng,
            patientLat,
            "BYRADIUS",
            radiusKm,
            "km",
            "WITHCOORD",
            "WITHDIST",
            "ASC",
          );
        } else if (typeof redis.georadius === "function") {
          results = await redis.georadius(
            "providers:locations:online",
            patientLng,
            patientLat,
            radiusKm,
            "km",
            "WITHCOORD",
            "WITHDIST",
            "ASC",
          );
        }

        if (Array.isArray(results) && results.length > 0) {
          const parsed = results
            .map((item: any) => {
              const member = Array.isArray(item) ? item[0] : item.member;
              const dist = Array.isArray(item) ? parseFloat(item[1]) : parseFloat(item.distance || "0");
              const coords = Array.isArray(item)
                ? item[2]
                : item.coordinates
                ? [item.coordinates.longitude, item.coordinates.latitude]
                : [0, 0];
              const lng = Array.isArray(coords) ? parseFloat(coords[0]) : 0;
              const lat = Array.isArray(coords) ? parseFloat(coords[1]) : 0;
              return {
                providerId: String(member),
                lat,
                lng,
                distanceKm: isNaN(dist) ? 0 : dist,
              };
            })
            .filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng) && (p.lat !== 0 || p.lng !== 0));

          if (parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        // Fallback to database search
      }
    }

    // Database fallback
    const locations = await this.locationRepo.find({ where: { role: "provider" } });
    const nearby: Array<{ providerId: string; lat: number; lng: number; distanceKm: number }> = [];

    for (const loc of locations) {
      if (loc.status === "offline") continue;
      const lat = loc.y;
      const lng = loc.x;
      if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        continue;
      }
      const distInfo = this.calculateDistanceAndEta(patientLat, patientLng, lat, lng);
      const distKm = parseFloat(distInfo.distance);
      if (distKm <= radiusKm) {
        nearby.push({
          providerId: loc.userId || loc.id,
          lat,
          lng,
          distanceKm: distKm,
        });
      }
    }

    return nearby.sort((a, b) => a.distanceKm - b.distanceKm);
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
