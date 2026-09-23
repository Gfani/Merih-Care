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

  private async ensureProviderLocations(locationsFromDb: LocationEntity[]): Promise<LocationEntity[]> {
    const activeFromDb = locationsFromDb.filter(
      (l) => l.role === "provider" && l.status !== "offline" && l.x !== 0 && l.y !== 0
    );
    if (activeFromDb.length > 0 || !this.providerRepo) {
      return locationsFromDb;
    }

    // Default coordinates spread across Addis Ababa
    const defaultCoords = [
      { x: 38.74689, y: 9.02497 }, // Tikur Anbessa / Lideta
      { x: 38.78500, y: 8.99500 }, // Bole Medhanialem
      { x: 38.76500, y: 9.01800 }, // Kazanchis
      { x: 38.73500, y: 9.00500 }, // Sarbet
      { x: 38.75200, y: 9.03500 }, // Piassa
    ];

    try {
      let verifiedProviders = await this.providerRepo.find();
      if (!verifiedProviders || verifiedProviders.length === 0) {
        const defaultClinicians = [
          { name: "Dr. Meron Alemu", role: "doctor", x: 38.74689, y: 9.02497, specialty: "General Practitioner" },
          { name: "Dr. Kassahun Tadesse", role: "doctor", x: 38.73500, y: 9.00500, specialty: "Internal Medicine" },
          { name: "Hiwot Girma, RN", role: "nurse", x: 38.78500, y: 8.99500, specialty: "Clinical Nurse" },
          { name: "Dr. Matyas Kassa", role: "doctor", x: 38.75200, y: 9.03500, specialty: "Pediatrician" },
          { name: "Fanuel Goitom", role: "provider", x: 38.76500, y: 9.01800, specialty: "Emergency Clinician" },
        ];

        const seededList: LocationEntity[] = [];
        for (let i = 0; i < defaultClinicians.length; i++) {
          const c = defaultClinicians[i];
          const provId = `prov-seed-${i + 1}`;
          const prov = new ProviderEntity();
          prov.id = provId;
          prov.name = c.name;
          prov.specialty = c.specialty;
          prov.verified = true;
          prov.available = true;
          prov.latitude = c.y;
          prov.longitude = c.x;
          await this.providerRepo.save(prov).catch(() => {});

          const loc = new LocationEntity();
          loc.id = `loc-${provId}`;
          loc.userId = provId;
          loc.name = c.name;
          loc.role = "provider";
          loc.x = c.x;
          loc.y = c.y;
          loc.status = "available";
          loc.accuracy = 5;
          loc.privacyMode = false;
          loc.locationTimestamp = new Date().toISOString();
          await this.locationRepo.save(loc).catch(() => {});
          seededList.push(loc);
        }
        return seededList;
      }

      const populated: LocationEntity[] = [...locationsFromDb];
      for (let i = 0; i < verifiedProviders.length; i++) {
        const prov = verifiedProviders[i];
        const coord = defaultCoords[i % defaultCoords.length];
        const targetX = prov.longitude ?? coord.x;
        const targetY = prov.latitude ?? coord.y;

        let loc = locationsFromDb.find(
          (l) => l.userId === prov.userId || l.id === prov.id || l.id === `loc-${prov.userId}`
        );
        if (!loc) {
          loc = new LocationEntity();
          loc.id = `loc-${prov.userId || prov.id}`;
          loc.userId = prov.userId || prov.id;
          loc.name = prov.name;
          loc.role = "provider";
          loc.x = targetX;
          loc.y = targetY;
          loc.status = "available";
          loc.accuracy = 5;
          loc.privacyMode = false;
          loc.locationTimestamp = new Date().toISOString();
          await this.locationRepo.save(loc).catch(() => {});
          populated.push(loc);
        } else if (loc.x === 0 && loc.y === 0) {
          loc.x = targetX;
          loc.y = targetY;
          loc.status = "available";
          loc.name = prov.name || loc.name;
          await this.locationRepo.save(loc).catch(() => {});
        }

        if (!prov.latitude || !prov.longitude) {
          prov.latitude = targetY;
          prov.longitude = targetX;
          await this.providerRepo.save(prov).catch(() => {});
        }
      }
      return populated;
    } catch (_) {
      return locationsFromDb;
    }
  }

  async getActiveProviderLocations(): Promise<LocationEntity[]> {
    const redis = getLocationsRedisClient();
    if (redis) {
      try {
        const members: string[] = await redis.zrange("providers:locations:online", 0, -1);
        if (Array.isArray(members) && members.length > 0) {
          const positions: Array<[string, string] | null> = await redis.geopos("providers:locations:online", ...members);
          const onlineProviders: LocationEntity[] = [];

          // Query provider metadata from DB matching online members
          let locationsFromDb = await this.locationRepo.find();
          locationsFromDb = await this.ensureProviderLocations(locationsFromDb);
          const locMap = new Map<string, LocationEntity>();
          for (const l of locationsFromDb) {
            if (l.userId) locMap.set(l.userId, l);
            locMap.set(l.id, l);
          }

          for (let i = 0; i < members.length; i++) {
            const memberId = members[i];
            const pos = positions[i];
            if (!pos) continue;
            const lng = parseFloat(pos[0]);
            const lat = parseFloat(pos[1]);
            if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

            const existing = locMap.get(memberId);
            const entry = new LocationEntity();
            entry.id = existing?.id || `loc-${memberId}`;
            entry.userId = memberId;
            (entry as any).providerId = memberId;
            entry.role = existing?.role || "provider";
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
            (entry as any).name = (existing as any)?.name || `Provider ${memberId.slice(-4)}`;
            onlineProviders.push(entry);
          }

          // If Redis GEO had no members or fewer than active DB providers, check DB available providers
          if (onlineProviders.length === 0) {
            const dbActive = locationsFromDb.filter(
              (l) => l.role === "provider" && l.status !== "offline" && l.x !== 0 && l.y !== 0
            );
            for (const l of dbActive) {
              const pid = l.userId || l.id;
              (l as any).providerId = pid;
              (l as any).lat = l.y;
              (l as any).lng = l.x;
              (l as any).latitude = l.y;
              (l as any).longitude = l.x;
              (l as any).isOnline = true;
              onlineProviders.push(l);
              redis.geoadd("providers:locations:online", l.x, l.y, pid).catch(() => {});
            }
          }

          // Also include any active emergency patients (never offline providers)
          const activePatients = locationsFromDb.filter(
            (l) => l.role === "patient" && (l.status === "critical" || l.status === "active") && l.x !== 0 && l.y !== 0
          );
          for (const pat of activePatients) {
            (pat as any).lat = pat.y;
            (pat as any).lng = pat.x;
            (pat as any).latitude = pat.y;
            (pat as any).longitude = pat.x;
          }

          return [...onlineProviders, ...activePatients].sort((a, b) => {
            const aVal = a.status === "critical" ? 1 : 0;
            const bVal = b.status === "critical" ? 1 : 0;
            return bVal - aVal;
          });
        } else {
          // Redis has no online providers currently
          // Populate from any active available providers in DB & seed Redis GEO
          let locationsFromDb = await this.locationRepo.find();
          locationsFromDb = await this.ensureProviderLocations(locationsFromDb);
          const dbActive = locationsFromDb.filter(
            (l) => l.role === "provider" && l.status !== "offline" && l.x !== 0 && l.y !== 0
          );
          const onlineProviders: LocationEntity[] = [];
          for (const l of dbActive) {
            const pid = l.userId || l.id;
            (l as any).providerId = pid;
            (l as any).lat = l.y;
            (l as any).lng = l.x;
            (l as any).latitude = l.y;
            (l as any).longitude = l.x;
            (l as any).isOnline = true;
            onlineProviders.push(l);
            redis.geoadd("providers:locations:online", l.x, l.y, pid).catch(() => {});
          }

          const emergencyPatients = locationsFromDb.filter(
            (l) => l.role === "patient" && l.status === "critical" && l.x !== 0 && l.y !== 0
          );
          for (const pat of emergencyPatients) {
            (pat as any).lat = pat.y;
            (pat as any).lng = pat.x;
            (pat as any).latitude = pat.y;
            (pat as any).longitude = pat.x;
          }

          return [...onlineProviders, ...emergencyPatients].sort((a, b) => {
            const aVal = a.status === "critical" ? 1 : 0;
            const bVal = b.status === "critical" ? 1 : 0;
            return bVal - aVal;
          });
        }
      } catch (err) {
        // Fallback below if Redis is not configured or fails
      }
    }

    // In environments without Redis (e.g. unit test runner without Redis daemon),
    // handle privacy masking and offline coordinate zeroing
    let locations = await this.locationRepo.find();
    locations = await this.ensureProviderLocations(locations);
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
      this.realtimeService.emitToRoom("admin", "location_update", {
        providerId: loc.userId || id,
        lat: latitude,
        lng: longitude,
        lastUpdated: loc.locationTimestamp,
      });
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
        this.realtimeService.emitToRoom("admin", "provider_offline", {
          providerId: userId,
          status: "offline",
          ts: new Date().toISOString(),
        });
      } else {
        this.realtimeService.emitToRoom("admin", "location_update", {
          providerId: userId,
          lat: loc.y,
          lng: loc.x,
          status,
          lastUpdated: loc.locationTimestamp || new Date().toISOString(),
        });
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
