import { Injectable, BadRequestException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LocationEntity } from "../../database/entities/location.entity";
import { LocationHistoryEntity } from "../../database/entities/emergency-relation.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { RealtimeService } from "../realtime/realtime.service";
import { PresenceService } from "../realtime/presence.service";
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

class InMemoryGeoStore {
  private geoData = new Map<string, Map<string, { lng: number; lat: number }>>();

  async geoadd(key: string, lng: number, lat: number, member: string): Promise<number> {
    if (!this.geoData.has(key)) {
      this.geoData.set(key, new Map());
    }
    this.geoData.get(key)!.set(String(member), { lng: Number(lng), lat: Number(lat) });
    return 1;
  }

  async geopos(key: string, ...members: string[]): Promise<Array<[string, string] | null>> {
    const map = this.geoData.get(key);
    return members.map((m) => {
      const pos = map?.get(String(m));
      return pos ? [String(pos.lng), String(pos.lat)] : null;
    });
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const map = this.geoData.get(key);
    if (!map) return [];
    const keys = Array.from(map.keys());
    if (stop === -1) return keys.slice(start);
    return keys.slice(start, stop + 1);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const map = this.geoData.get(key);
    if (!map) return 0;
    let count = 0;
    for (const m of members) {
      if (map.delete(String(m))) count++;
    }
    return count;
  }

  async del(key: string): Promise<number> {
    return this.geoData.delete(key) ? 1 : 0;
  }

  async geosearch(
    key: string,
    _from: string,
    lng: number,
    lat: number,
    _by: string,
    radiusKm: number,
    ..._rest: any[]
  ): Promise<any[]> {
    const map = this.geoData.get(key);
    if (!map) return [];
    const results: any[] = [];
    for (const [member, pos] of map.entries()) {
      const dLat = (pos.lat - lat) * (Math.PI / 180);
      const dLon = (pos.lng - lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * (Math.PI / 180)) * Math.cos(pos.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist <= radiusKm) {
        results.push([member, dist.toFixed(4), [String(pos.lng), String(pos.lat)]]);
      }
    }
    return results;
  }
}

const fallbackGeoStore = new InMemoryGeoStore();

export function getLocationsRedisClient(): any {
  if (locationsRedisInitialized) return locationsRedisClient || fallbackGeoStore;
  locationsRedisInitialized = true;
  const redisUrl =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
      ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      : null);
  if (!redisUrl) {
    locationsRedisClient = null;
    return fallbackGeoStore;
  }
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
  return locationsRedisClient || fallbackGeoStore;
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
    @InjectRepository(UserEntity)
    @Optional()
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    private readonly realtimeService?: RealtimeService,
    @Optional()
    private readonly presenceService?: PresenceService,
  ) {}

  async getActiveProviderLocations(): Promise<LocationEntity[]> {
    const redis = (this as any).redis || getLocationsRedisClient();
    if (!redis || typeof redis.zrange !== "function") {
      return [];
    }

    try {
      const members: string[] = await redis.zrange("providers:locations:online", 0, -1);
      if (!Array.isArray(members) || members.length === 0) {
        return [];
      }

      const positions: Array<[string, string] | null> = await redis.geopos("providers:locations:online", ...members);
      const onlineProviders: LocationEntity[] = [];

      // Query database to attach the provider's name/metadata to the Redis coordinates
      const providersFromDb = this.providerRepo
        ? await this.providerRepo.find().catch(() => [])
        : [];

      const provMap = new Map<string, ProviderEntity>();
      for (const p of providersFromDb) {
        if (p.userId) provMap.set(p.userId, p);
        provMap.set(p.id, p);
      }

      const seenProviderIds = new Set<string>();
      for (let i = 0; i < members.length; i++) {
        const memberId = members[i];
        const pos = positions[i];
        if (!pos) continue;
        let lng = parseFloat(pos[0]);
        let lat = parseFloat(pos[1]);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

        // Auto-correct swapped coordinates for Ethiopia (lat ~3-15, lng ~33-48)
        if (lat > 25 && lng < 20) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }

        const prov = provMap.get(memberId);
        const canonicalId = prov?.userId || prov?.id || memberId;
        if (seenProviderIds.has(canonicalId)) {
          // If a secondary alias member exists in Redis, purge it asynchronously
          if (memberId !== canonicalId) {
            redis.zrem("providers:locations:online", memberId).catch(() => {});
          }
          continue;
        }
        seenProviderIds.add(canonicalId);

        const entry = new LocationEntity();
        entry.id = `loc-${canonicalId}`;
        entry.userId = canonicalId;
        (entry as any).providerId = canonicalId;
        entry.role = "provider";
        entry.status = "available";
        entry.accuracy = 5;
        entry.privacyMode = false;
        entry.locationTimestamp = new Date().toISOString();
        entry.x = lng;
        entry.y = lat;
        (entry as any).lat = lat;
        (entry as any).lng = lng;
        (entry as any).latitude = lat;
        (entry as any).longitude = lng;
        (entry as any).isOnline = true;
        (entry as any).name = prov?.name || `Provider ${canonicalId.slice(-4)}`;
        onlineProviders.push(entry);
      }

      return onlineProviders;
    } catch (_) {
      return [];
    }
  }

  async getActivePatientLocations(): Promise<LocationEntity[]> {
    const redis = (this as any).redis || getLocationsRedisClient();
    if (!redis || typeof redis.zrange !== "function") {
      return [];
    }

    try {
      const members: string[] = await redis.zrange("patients:locations:online", 0, -1);
      if (!Array.isArray(members) || members.length === 0) {
        return [];
      }

      const positions: Array<[string, string] | null> = await redis.geopos("patients:locations:online", ...members);
      const onlinePatients: LocationEntity[] = [];

      const usersFromDb = this.userRepo ? await this.userRepo.find().catch(() => []) : [];
      const userMap = new Map<string, any>();
      for (const u of usersFromDb) {
        userMap.set(u.id, u);
      }

      const seenPatientIds = new Set<string>();
      for (let i = 0; i < members.length; i++) {
        const memberId = members[i];
        const pos = positions[i];
        if (!pos) continue;
        let lng = parseFloat(pos[0]);
        let lat = parseFloat(pos[1]);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

        // Auto-correct swapped coordinates for Ethiopia
        if (lat > 25 && lng < 20) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }

        const user = userMap.get(memberId);
        const canonicalId = user?.id || memberId;
        if (seenPatientIds.has(canonicalId)) {
          continue;
        }
        seenPatientIds.add(canonicalId);

        const entry = new LocationEntity();
        entry.id = `loc-pat-${canonicalId}`;
        entry.userId = canonicalId;
        entry.role = "patient";
        entry.status = "available";
        entry.accuracy = 10;
        entry.privacyMode = false;
        entry.locationTimestamp = new Date().toISOString();
        entry.x = lng;
        entry.y = lat;
        (entry as any).lat = lat;
        (entry as any).lng = lng;
        (entry as any).latitude = lat;
        (entry as any).longitude = lng;
        (entry as any).isOnline = true;
        (entry as any).name = user?.name || `Patient ${canonicalId.slice(-4)}`;
        onlinePatients.push(entry);
      }

      return onlinePatients;
    } catch (_) {
      return [];
    }
  }

  async getLiveMapLocations(role?: string): Promise<LocationEntity[]> {
    if (role === "patient") {
      return this.getActivePatientLocations();
    }

    const [providers, patients] = await Promise.all([
      this.getActiveProviderLocations(),
      role === "provider" ? Promise.resolve([]) : this.getActivePatientLocations(),
    ]);

    if (role === "provider") {
      return providers;
    }

    return [...providers, ...patients].sort((a, b) => {
      const aVal = a.status === "critical" ? 1 : 0;
      const bVal = b.status === "critical" ? 1 : 0;
      return bVal - aVal;
    });
  }

  async getAllLocations(): Promise<LocationEntity[]> {
    const locations = await this.locationRepo.find();
    return locations
      .map((loc) => {
        (loc as any).providerId = loc.userId || loc.id;
        (loc as any).lat = loc.y;
        (loc as any).lng = loc.x;
        (loc as any).latitude = loc.y;
        (loc as any).longitude = loc.x;
        (loc as any).isOnline = loc.status !== "offline";
        if (loc.privacyMode) {
          const px = Math.round(loc.x * 100) / 100;
          const py = Math.round(loc.y * 100) / 100;
          return {
            ...loc,
            x: px,
            y: py,
            lat: py,
            lng: px,
            latitude: py,
            longitude: px,
            providerId: loc.userId || loc.id,
            isOnline: loc.status !== "offline",
          };
        }
        if (loc.role === "provider" && loc.status === "offline") {
          return {
            ...loc,
            x: 0,
            y: 0,
            lat: 0,
            lng: 0,
            latitude: 0,
            longitude: 0,
            providerId: loc.userId || loc.id,
            isOnline: false,
          };
        }
        return loc;
      })
      .sort((a, b) => {
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
    roleOverride?: string,
  ): Promise<LocationEntity> {
    if (typeof latitude !== "number" || typeof longitude !== "number" || isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException("Invalid coordinates: latitude and longitude must be numbers");
    }
    // Auto-correct swapped coordinates for Ethiopia (lat ~3-15, lng ~33-48)
    if (latitude > 25 && longitude < 20) {
      const temp = latitude;
      latitude = longitude;
      longitude = temp;
    }

    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException(`Latitude ${latitude} is out of valid range [-90, 90]`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException(`Longitude ${longitude} is out of valid range [-180, 180]`);
    }

    // Try to find by location ID or user ID
    let loc = await this.locationRepo.findOne({ where: [{ id }, { userId: id }] });
    let resolvedRole = roleOverride || loc?.role;
    if (!resolvedRole) {
      if (this.userRepo) {
        const user = await this.userRepo.findOne({ where: [{ id }, { email: id }] }).catch(() => null);
        if (user?.role) resolvedRole = user.role;
      }
    }
    if (!resolvedRole) resolvedRole = "provider";

    if (!loc) {
      loc = new LocationEntity();
      loc.id = id.startsWith("loc-") ? id : `loc-${crypto.randomUUID()}`;
      loc.userId = id;
      loc.role = resolvedRole;
      loc.status = "available";
      loc.privacyMode = false;
    } else if (!loc.role || roleOverride) {
      loc.role = resolvedRole;
    }

    if (loc.status === "offline") {
      loc.status = "available";
    }

    loc.y = latitude; // y is latitude
    loc.x = longitude; // x is longitude
    loc.accuracy = accuracy || 0;
    loc.locationTimestamp = new Date().toISOString();
    loc.updatedAt = new Date();

    const saved = await this.locationRepo.save(loc);

    // Save location history record safely
    try {
      const history = new LocationHistoryEntity();
      history.id = `loch-${crypto.randomUUID()}`;
      history.providerId = loc.userId || id;
      history.x = longitude;
      history.y = latitude;
      history.timestamp = new Date().toISOString();
      await this.historyRepo.save(history);
    } catch (_) {}

    // Also update ProviderEntity coordinates if available
    if (this.providerRepo && (loc.role === "provider" || resolvedRole === "provider")) {
      try {
        const prov = await this.providerRepo.findOne({ where: [{ id }, { userId: id }] });
        if (prov) {
          prov.latitude = latitude;
          prov.longitude = longitude;
          prov.available = true;
          await this.providerRepo.save(prov);
        }
      } catch (_) {}
    }

    // Redis Geospatial update
    const redis = getLocationsRedisClient();
    const redisKey = loc.role === "patient" ? "patients:locations:online" : "providers:locations:online";
    if (redis) {
      try {
        const memberId = loc.userId || id;
        if (loc.status !== "offline") {
          // Redis GEOADD: key longitude latitude member (longitude MUST precede latitude in Redis)
          await redis.geoadd(redisKey, longitude, latitude, memberId);
          // Purge secondary alias from Redis if different from memberId
          if (id && id !== memberId) {
            await redis.zrem(redisKey, id).catch(() => {});
          }
          if (loc.userId && loc.userId !== memberId) {
            await redis.zrem(redisKey, loc.userId).catch(() => {});
          }
        } else {
          await redis.zrem(redisKey, memberId);
          if (id && id !== memberId) {
            await redis.zrem(redisKey, id).catch(() => {});
          }
          if (loc.userId && loc.userId !== memberId) {
            await redis.zrem(redisKey, loc.userId).catch(() => {});
          }
        }
      } catch (err) {
        // Safe failover if Redis command encounters an error
      }
    }

    if (this.realtimeService) {
      const isProv = loc.role === "provider";
      const updatePayload = {
        providerId: isProv ? (loc.userId || id) : undefined,
        userId: loc.userId || id,
        name: loc.name,
        role: loc.role || "provider",
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
      if (isProv) {
        this.realtimeService.emitToRoom("admin", "provider_location_update", updatePayload);
        this.realtimeService.emitToRoom("admin_room", "provider_location_update", updatePayload);
      }
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
    let loc = await this.locationRepo.findOne({ where: [{ userId }, { id: userId }] });
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
    const redisKey = loc.role === "patient" ? "patients:locations:online" : "providers:locations:online";
    if (redis) {
      try {
        if (status === "offline") {
          await redis.zrem(redisKey, userId);
        } else if (typeof loc.x === "number" && typeof loc.y === "number" && (loc.x !== 0 || loc.y !== 0)) {
          await redis.geoadd(redisKey, loc.x, loc.y, userId);
        }
      } catch (err) {
        // Safe failover
      }
    }

    if (this.realtimeService) {
      const isProv = loc.role === "provider";
      if (status === "offline") {
        const offlinePayload = {
          providerId: isProv ? userId : undefined,
          userId,
          role: loc.role || "provider",
          status: "offline",
          isOnline: false,
          ts: new Date().toISOString(),
        };
        const evt = isProv ? "provider_offline" : "patient_offline";
        this.realtimeService.emitToRoom("admin", evt, offlinePayload);
        this.realtimeService.emitToRoom("admin_room", evt, offlinePayload);
        this.realtimeService.emitToRoom("admin", "location_update", offlinePayload);
        this.realtimeService.emitToRoom("admin_room", "location_update", offlinePayload);
      } else {
        const updatePayload = {
          providerId: isProv ? userId : undefined,
          userId,
          name: loc.name,
          role: loc.role || "provider",
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
        if (isProv) {
          this.realtimeService.emitToRoom("admin", "provider_location_update", updatePayload);
          this.realtimeService.emitToRoom("admin_room", "provider_location_update", updatePayload);
        }
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
              let lng = Array.isArray(coords) ? parseFloat(coords[0]) : 0;
              let lat = Array.isArray(coords) ? parseFloat(coords[1]) : 0;
              if (lat > 25 && lng < 20) {
                const temp = lat;
                lat = lng;
                lng = temp;
              }
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
      let lat = loc.y;
      let lng = loc.x;
      if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        continue;
      }
      if (lat > 25 && lng < 20) {
        const temp = lat;
        lat = lng;
        lng = temp;
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
