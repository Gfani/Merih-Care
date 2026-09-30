import { Injectable, Logger, Optional, Inject, forwardRef } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RealtimeService } from "../realtime/realtime.service";
import { ChatService } from "../chat/chat.service";
import { LocationsService, getLocationsRedisClient } from "../locations/locations.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentStatusHistoryEntity } from "../../database/entities/appointment-history.entity";
import { ConversationEntity, ConversationParticipantEntity } from "../../database/entities/chat-chat.entity";

export interface CandidateProvider {
  providerId: string;
  userId: string;
  name: string;
  phone: string;
  avatar?: string;
  specialty?: string;
  distanceKm: number;
  etaMinutes: number;
  etaSeconds?: number;
  latitude: number;
  longitude: number;
  routePoints?: Array<{ lat: number; lng: number }>;
  geometry?: any;
}

export interface CascadeSession {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  service: string;
  serviceType?: string;
  address: string;
  patientLat: number;
  patientLng: number;
  amount: number;
  candidates: CandidateProvider[];
  currentIndex: number;
  offerTimeoutSeconds: number;
  expiresAt: number;
  timer?: NodeJS.Timeout;
  status: "active" | "accepted" | "exhausted" | "cancelled";
  excludedProviders: Set<string>;
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates real-world road route, distance, and ETA using free Open Source Routing Machine (OSRM)
 * public API (https://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson)
 * with a resilient city-traffic road network simulation fallback.
 */
async function calculateRoadRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<{
  distanceKm: number;
  etaMinutes: number;
  etaSeconds: number;
  routePoints: Array<{ lat: number; lng: number }>;
  geometry?: any;
}> {
  const straightDistKm = calculateHaversineKm(originLat, originLng, destLat, destLng);

  // 1. Attempt free OSRM public routing API
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const etaSeconds = Math.round(route.duration);
        const etaMinutes = Math.max(1, Math.round(etaSeconds / 60));
        const coordinates: [number, number][] = route.geometry?.coordinates || [];
        const routePoints = coordinates.map((c) => ({
          lat: Number(c[1].toFixed(6)),
          lng: Number(c[0].toFixed(6)),
        }));
        if (routePoints.length >= 2) {
          return {
            distanceKm,
            etaMinutes,
            etaSeconds,
            routePoints,
            geometry: route.geometry,
          };
        }
      }
    }
  } catch (_) {
    // Network offline or timeout - fallback to intelligent road geometry
  }

  // 2. High-precision urban street network simulation fallback
  const roadDistKm = Number((straightDistKm * 1.28).toFixed(2));
  const etaMinutes = Math.max(3, Math.round((roadDistKm / 22) * 60 + 2));
  const etaSeconds = etaMinutes * 60;

  const steps = Math.max(5, Math.min(14, Math.round(straightDistKm * 3)));
  const routePoints: Array<{ lat: number; lng: number }> = [];
  routePoints.push({ lat: Number(originLat.toFixed(6)), lng: Number(originLng.toFixed(6)) });

  for (let i = 1; i < steps; i++) {
    const frac = i / steps;
    const perpLat = -(destLng - originLng);
    const perpLng = destLat - originLat;
    const curveAmp = Math.sin(frac * Math.PI) * 0.0015;

    const lat = originLat + (destLat - originLat) * frac + perpLat * curveAmp;
    const lng = originLng + (destLng - originLng) * frac + perpLng * curveAmp;
    routePoints.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }

  routePoints.push({ lat: Number(destLat.toFixed(6)), lng: Number(destLng.toFixed(6)) });

  return {
    distanceKm: roadDistKm,
    etaMinutes,
    etaSeconds,
    routePoints,
    geometry: {
      type: "LineString",
      coordinates: routePoints.map((pt) => [pt.lng, pt.lat]),
    },
  };
}

@Injectable()
export class DispatchCascadeService {
  private readonly logger = new Logger(DispatchCascadeService.name);
  private activeSessions = new Map<string, CascadeSession>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
    @Optional()
    private readonly chatService?: ChatService,
    @Optional()
    private readonly locationsService?: LocationsService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  private async getExcludedProvidersFromRedis(appointmentId: string): Promise<Set<string>> {
    const redis = getLocationsRedisClient();
    const set = new Set<string>();
    if (!redis) return set;
    try {
      if (typeof redis.smembers === "function") {
        const members: string[] = await redis.smembers(`providers:excluded:${appointmentId}`);
        if (Array.isArray(members)) {
          for (const m of members) set.add(String(m));
        }
      }
    } catch (_) {}
    return set;
  }

  private async addExcludedProviderToRedis(appointmentId: string, providerId: string): Promise<void> {
    const redis = getLocationsRedisClient();
    if (!redis || !providerId) return;
    try {
      if (typeof redis.sadd === "function") {
        await redis.sadd(`providers:excluded:${appointmentId}`, providerId);
        if (typeof redis.expire === "function") {
          await redis.expire(`providers:excluded:${appointmentId}`, 3600);
        }
      }
    } catch (_) {}
  }

  private async persistExcludedProviderInDb(appointmentId: string, providerId: string): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized || !providerId) return;
    try {
      const aptRepo = this.dataSource.getRepository(AppointmentEntity);
      const apt = await aptRepo.findOne({ where: { id: appointmentId } });
      if (apt) {
        const existing = Array.isArray(apt.excludedProviders) ? apt.excludedProviders : [];
        if (!existing.includes(providerId)) {
          apt.excludedProviders = [...existing, providerId];
          await aptRepo.save(apt);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not persist excluded provider in DB: ${err?.message || err}`);
    }
  }

  /**
   * Find verified and online providers matching specialty within radiusKm (default 5km),
   * querying Redis GEOADD/GEOSEARCH when available, fetching OSRM shortest path routes & ETAs,
   * filtering out excluded candidates, and ranking candidates strictly by the shortest driving duration.
   */
  async findRankedCandidates(
    patientLat: number,
    patientLng: number,
    specialtyOrService?: string,
    radiusKm = 5,
    excludedProviders?: Set<string> | string[],
  ): Promise<CandidateProvider[]> {
    if (!this.dataSource || !this.dataSource.isInitialized) return [];

    const excludedSet = new Set<string>();
    if (excludedProviders) {
      if (excludedProviders instanceof Set) {
        for (const item of excludedProviders) excludedSet.add(item);
      } else if (Array.isArray(excludedProviders)) {
        for (const item of excludedProviders) excludedSet.add(item);
      }
    }

    const provRepo = this.dataSource.getRepository(ProviderEntity);
    const locRepo = this.dataSource.getRepository(LocationEntity);

    // 1. Fetch active & available providers from database
    const providers = await provRepo.find({
      where: { available: true, status: "active" },
      relations: ["user"],
    });

    if (providers.length === 0) return [];

    // 2. Query Redis in-memory geospatial index for online providers within radiusKm
    let redisProviders: Array<{ providerId: string; lat: number; lng: number; distanceKm: number }> = [];
    if (this.locationsService) {
      try {
        redisProviders = await this.locationsService.findNearbyOnlineProviders(patientLat, patientLng, radiusKm);
      } catch (err: any) {
        this.logger.warn(`Redis nearby provider search notice: ${err?.message || err}`);
      }
    } else {
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
            redisProviders = results
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
          }
        } catch (err: any) {
          this.logger.warn(`Direct Redis nearby search notice: ${err?.message || err}`);
        }
      }
    }

    // Map Redis coordinates by providerId
    const redisMap = new Map<string, { lat: number; lng: number; distanceKm: number }>();
    for (const rp of redisProviders) {
      redisMap.set(rp.providerId, rp);
    }

    // 3. Fallback coordinate map from LocationEntity if Redis has no entries
    const locMap = new Map<string, { lat: number; lng: number }>();
    if (redisMap.size === 0) {
      const locations = await locRepo.find({
        where: { role: "provider" },
      });
      for (const loc of locations) {
        if (loc.userId && typeof loc.y === "number" && typeof loc.x === "number") {
          locMap.set(loc.userId, { lat: loc.y, lng: loc.x });
        }
      }
    }

    const normSpecialty = (specialtyOrService || "").toLowerCase().trim();
    const candidates: CandidateProvider[] = [];

    for (const prov of providers) {
      if (excludedSet.has(prov.id) || (prov.userId && excludedSet.has(prov.userId))) {
        continue; // Excluded from this cascade cycle (already rejected or timed out)
      }

      // Determine coordinates: prefer Redis geospatial location, fallback to locRepo, then provider profile
      let pLat = prov.latitude;
      let pLng = prov.longitude;

      const redisMatch = (prov.userId && redisMap.get(prov.userId)) || redisMap.get(prov.id);
      if (redisMatch) {
        pLat = redisMatch.lat;
        pLng = redisMatch.lng;
      } else if (prov.userId && locMap.has(prov.userId)) {
        const live = locMap.get(prov.userId)!;
        pLat = live.lat;
        pLng = live.lng;
      }

      if (typeof pLat !== "number" || typeof pLng !== "number" || isNaN(pLat) || isNaN(pLng)) {
        continue; // Skip providers with no valid coordinates
      }

      // Proximity check: if Redis was used and provider wasn't found in Redis radius, skip
      const straightDistKm = calculateHaversineKm(patientLat, patientLng, pLat, pLng);
      if (straightDistKm > radiusKm) {
        continue;
      }

      // Check specialty match if requested
      if (normSpecialty && normSpecialty !== "general care" && normSpecialty !== "doctor home visit") {
        const provSpecialty = (prov.specialty || "").toLowerCase();
        const provTitle = (prov.title || "").toLowerCase();
        const provServices = (prov.servicesRaw || "").toLowerCase();

        const matches =
          provSpecialty.includes(normSpecialty) ||
          provTitle.includes(normSpecialty) ||
          provServices.includes(normSpecialty) ||
          normSpecialty.includes(provSpecialty);

        if (!matches && prov.verified) {
          if (normSpecialty.includes("doctor") && !provTitle.includes("dr") && !provSpecialty.includes("doctor")) {
            continue;
          }
          if (normSpecialty.includes("physio") && !provSpecialty.includes("physio") && !provServices.includes("physio")) {
            continue;
          }
        }
      }

      // Ping OSRM API for true driving route, distance, and ETA duration
      const roadRoute = await calculateRoadRoute(pLat, pLng, patientLat, patientLng);

      candidates.push({
        providerId: prov.id,
        userId: prov.userId || prov.id,
        name: prov.name,
        phone: prov.phone || prov.user?.phone || "",
        avatar: prov.avatar,
        specialty: prov.specialty || prov.title,
        distanceKm: roadRoute.distanceKm,
        etaMinutes: roadRoute.etaMinutes,
        etaSeconds: roadRoute.etaSeconds,
        latitude: pLat,
        longitude: pLng,
        routePoints: roadRoute.routePoints,
        geometry: roadRoute.geometry,
      });
    }

    // Rank candidates strictly in ascending order by shortest OSRM driving duration
    return candidates.sort((a, b) => {
      const durA = typeof a.etaSeconds === "number" ? a.etaSeconds : a.etaMinutes * 60;
      const durB = typeof b.etaSeconds === "number" ? b.etaSeconds : b.etaMinutes * 60;
      return durA - durB;
    });
  }

  /**
   * Start the cascade dispatch routine for an immediate on-demand care request.
   */
  /**
   * Start the cascade dispatch routine for an immediate on-demand care request.
   */
  async startCascade(
    appointment: AppointmentEntity,
    patientLat?: number,
    patientLng?: number,
    radiusKm = 5,
    timeoutSeconds = 30,
  ): Promise<CascadeSession | null> {
    // Default to Addis Ababa central coordinates if not provided
    const lat = typeof patientLat === "number" ? patientLat : (appointment.latitude ?? 9.0222);
    const lng = typeof patientLng === "number" ? patientLng : (appointment.longitude ?? 38.7468);

    // Cancel any existing session for this appointment
    this.cancelCascade(appointment.id);

    // Load excluded providers from DB and Redis
    const redisExcluded = await this.getExcludedProvidersFromRedis(appointment.id);
    const dbExcluded = Array.isArray(appointment.excludedProviders) ? appointment.excludedProviders : [];
    const excludedProviders = new Set<string>([...redisExcluded, ...dbExcluded]);

    let candidates = await this.findRankedCandidates(lat, lng, appointment.service, radiusKm, excludedProviders);

    // If no candidate found within radiusKm, widen search up to 25 km
    if (candidates.length === 0 && radiusKm < 25) {
      candidates = await this.findRankedCandidates(lat, lng, appointment.service, 25, excludedProviders);
    }

    if (candidates.length === 0) {
      this.logger.warn(`No candidate providers found within radius for appointment ${appointment.id}`);
      // Notify patient: "No doctors available nearby right now, searching again..."
      const exhaustedMsg = "No doctors available nearby right now, searching again...";
      this.realtimeService.emitToRoom(`patient:${appointment.patientId}`, "dispatch_update", {
        event: "dispatch_update",
        appointmentId: appointment.id,
        status: "searching",
        exhausted: true,
        message: exhaustedMsg,
      });
      this.realtimeService.emitToRoom(`patient:${appointment.patientId}`, "dispatch_cascade_exhausted", {
        appointmentId: appointment.id,
        message: exhaustedMsg,
      });

      if (this.notificationsService && appointment.patientId) {
        this.notificationsService.sendNotification(appointment.patientId, {
          type: "dispatch_update",
          title: "Searching for Clinicians 🩺",
          body: exhaustedMsg,
          priority: "normal",
          targetChannel: "in_app",
          data: {
            appointmentId: appointment.id,
            status: "searching",
            exhausted: true,
          },
        }).catch(() => {});
      }

      // Fallback: broadcast to general providers pool & alert dispatch admin
      const fallbackPayload = {
        id: appointment.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        patientPhone: appointment.patientPhone,
        service: appointment.service,
        location: appointment.location,
        latitude: lat,
        longitude: lng,
        patientLat: lat,
        patientLng: lng,
        amount: appointment.amount,
        status: "searching",
      };
      this.realtimeService.emitToRoom("providers", "new_service_request", fallbackPayload);
      this.realtimeService.emitToRoom("admin", "new_service_request", fallbackPayload);
      this.realtimeService.emitToRoom("admin", "dispatch_cascade_exhausted", {
        appointmentId: appointment.id,
        reason: "No nearby available providers found",
      });
      return null;
    }

    const session: CascadeSession = {
      appointmentId: appointment.id,
      patientId: appointment.patientId || "pat-user",
      patientName: appointment.patientName || "Patient",
      patientPhone: appointment.patientPhone || undefined,
      service: appointment.service || "Immediate Care",
      serviceType: appointment.serviceId || undefined,
      address: appointment.location || "Addis Ababa",
      patientLat: lat,
      patientLng: lng,
      amount: appointment.amount || 0,
      candidates,
      currentIndex: 0,
      offerTimeoutSeconds: timeoutSeconds,
      expiresAt: Date.now() + timeoutSeconds * 1000,
      status: "active",
      excludedProviders,
    };

    this.activeSessions.set(appointment.id, session);
    this.logger.log(`Starting cascade dispatch for appointment ${appointment.id} with ${candidates.length} candidates.`);

    await this.sendOfferToCurrentCandidate(session);
    return session;
  }

  /**
   * Send high-priority service_offer WebSocket event to candidate at session.currentIndex with strict 30-second timer.
   */
  private async sendOfferToCurrentCandidate(session: CascadeSession): Promise<void> {
    if (session.status !== "active") return;

    // Skip any candidate that was already excluded
    while (
      session.currentIndex < session.candidates.length &&
      (session.excludedProviders.has(session.candidates[session.currentIndex].providerId) ||
       session.excludedProviders.has(session.candidates[session.currentIndex].userId))
    ) {
      session.currentIndex++;
    }

    if (session.currentIndex >= session.candidates.length) {
      await this.handleCandidateExhaustion(session);
      return;
    }

    const candidate = session.candidates[session.currentIndex];
    const timeoutSec = session.offerTimeoutSeconds || 30;
    session.expiresAt = Date.now() + timeoutSec * 1000;

    const offerPayload = {
      event: "service_offer",
      appointmentId: session.appointmentId,
      id: session.appointmentId,
      patientId: session.patientId,
      patientName: session.patientName,
      patientPhone: session.patientPhone,
      service: session.service,
      serviceType: session.serviceType,
      address: session.address,
      patientLat: session.patientLat,
      patientLng: session.patientLng,
      distanceKm: candidate.distanceKm,
      etaMinutes: candidate.etaMinutes,
      etaSeconds: candidate.etaSeconds,
      fee: session.amount,
      amount: session.amount,
      timeoutSeconds: timeoutSec,
      expiresAt: session.expiresAt,
      cascadeIndex: session.currentIndex,
      totalCandidates: session.candidates.length,
      providerId: candidate.providerId,
      providerUserId: candidate.userId,
      routePoints: candidate.routePoints || [],
      routeGeometry: candidate.geometry || null,
    };

    // Emit targeted high-priority events to the candidate's rooms (both service_offer and new_service_request)
    this.realtimeService.emitToRoom(`provider:${candidate.userId}`, "service_offer", offerPayload);
    this.realtimeService.emitToRoom(`provider:${candidate.userId}`, "new_service_request", offerPayload);
    if (candidate.providerId !== candidate.userId) {
      this.realtimeService.emitToRoom(`provider:${candidate.providerId}`, "service_offer", offerPayload);
      this.realtimeService.emitToRoom(`provider:${candidate.providerId}`, "new_service_request", offerPayload);
    }

    // High-priority push notification to provider
    if (this.notificationsService) {
      this.notificationsService.sendNotification(candidate.userId, {
        type: "service_offer",
        title: "New Immediate Care Request 🩺 (30s)",
        body: `${session.patientName} requested ${session.service} (${candidate.distanceKm} km away, ETA ~${candidate.etaMinutes}m). 30 seconds to accept.`,
        priority: "critical",
        targetChannel: "in_app",
        data: {
          appointmentId: session.appointmentId,
          expiresAt: session.expiresAt,
          timeoutSeconds: timeoutSec,
          distanceKm: candidate.distanceKm,
          etaMinutes: candidate.etaMinutes,
        },
      }).catch(() => {});
    }

    // Emit real-time dispatch progress to the patient so map draws route & floating ETA badge
    const patientDispatchPayload = {
      event: "dispatch_update",
      appointmentId: session.appointmentId,
      status: "searching",
      providerAttemptIndex: session.currentIndex,
      totalCandidates: session.candidates.length,
      providerId: candidate.providerId,
      providerUserId: candidate.userId,
      providerName: candidate.name,
      providerAvatar: candidate.avatar,
      providerSpecialty: candidate.specialty,
      providerLat: candidate.latitude,
      providerLng: candidate.longitude,
      distanceKm: candidate.distanceKm,
      etaMinutes: candidate.etaMinutes,
      etaSeconds: candidate.etaSeconds,
      routePoints: candidate.routePoints || [],
      routeGeometry: candidate.geometry || null,
      timeoutSeconds: timeoutSec,
      expiresAt: session.expiresAt,
    };
    this.realtimeService.emitToRoom(`patient:${session.patientId}`, "dispatch_update", patientDispatchPayload);
    this.realtimeService.emitToRoom(`appointment:${session.appointmentId}`, "dispatch_update", patientDispatchPayload);
    this.realtimeService.emitToRoom("admin", "dispatch_update", patientDispatchPayload);

    // Keep dispatchers in admin room informed of live cascade progress
    this.realtimeService.emitToRoom("admin", "dispatch_offer_sent", {
      appointmentId: session.appointmentId,
      candidateIndex: session.currentIndex,
      totalCandidates: session.candidates.length,
      providerId: candidate.providerId,
      providerName: candidate.name,
      distanceKm: candidate.distanceKm,
      etaMinutes: candidate.etaMinutes,
      expiresAt: session.expiresAt,
    });

    this.logger.log(
      `Dispatched offer to candidate #${session.currentIndex} (${candidate.name}, ${candidate.distanceKm} km, ETA: ${candidate.etaMinutes} min) for apt ${session.appointmentId}`,
    );

    // Strict 30-second acceptance countdown timer
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.handleTimeout(session.appointmentId, candidate.userId, candidate.providerId);
    }, timeoutSec * 1000);
  }

  /**
   * Handle candidate batch exhaustion: expand search up to 25km, or transition to terminal state.
   */
  private async handleCandidateExhaustion(session: CascadeSession): Promise<void> {
    this.logger.log(`Candidate batch exhausted for apt ${session.appointmentId}. Attempting search radius expansion up to 25km...`);

    // Check if new candidates exist within 25km excluding all previously pinged providers
    const expandedCandidates = await this.findRankedCandidates(
      session.patientLat,
      session.patientLng,
      session.service,
      25,
      session.excludedProviders,
    );

    const existingProvIds = new Set(session.candidates.map((c) => c.providerId));
    const newCandidates = expandedCandidates.filter(
      (c) =>
        !existingProvIds.has(c.providerId) &&
        !session.excludedProviders.has(c.providerId) &&
        !session.excludedProviders.has(c.userId),
    );

    if (newCandidates.length > 0) {
      this.logger.log(`Found ${newCandidates.length} additional candidates in expanded radius for apt ${session.appointmentId}. Continuing cascade.`);
      session.candidates.push(...newCandidates);
      await this.sendOfferToCurrentCandidate(session);
      return;
    }

    // Terminal state: 0 remaining online providers within radius after exhausting all candidates
    this.logger.log(`Terminal state: 0 remaining online providers within radius for appointment ${session.appointmentId}`);
    session.status = "exhausted";
    if (session.timer) clearTimeout(session.timer);
    this.activeSessions.delete(session.appointmentId);

    // Keep appointment in 'searching' status in DB (DO NOT cancel!)
    try {
      const aptRepo = this.dataSource.getRepository(AppointmentEntity);
      const apt = await aptRepo.findOne({ where: { id: session.appointmentId } });
      if (apt && apt.status !== "accepted" && apt.status !== "completed") {
        apt.status = "searching";
        await aptRepo.save(apt);
      }
    } catch (_) {}

    // Notify the patient: "No doctors available nearby right now, searching again..."
    const exhaustedMsg = "No doctors available nearby right now, searching again...";
    const patientPayload = {
      event: "dispatch_update",
      appointmentId: session.appointmentId,
      status: "searching",
      exhausted: true,
      message: exhaustedMsg,
      totalAttempted: session.excludedProviders.size,
    };
    this.realtimeService.emitToRoom(`patient:${session.patientId}`, "dispatch_update", patientPayload);
    this.realtimeService.emitToRoom(`patient:${session.patientId}`, "dispatch_cascade_exhausted", {
      appointmentId: session.appointmentId,
      message: exhaustedMsg,
      totalAttempted: session.excludedProviders.size,
    });

    if (this.notificationsService && session.patientId) {
      this.notificationsService.sendNotification(session.patientId, {
        type: "dispatch_update",
        title: "Searching for Clinicians 🩺",
        body: exhaustedMsg,
        priority: "normal",
        targetChannel: "in_app",
        data: {
          appointmentId: session.appointmentId,
          status: "searching",
          exhausted: true,
        },
      }).catch(() => {});
    }

    // Inform admin room
    this.realtimeService.emitToRoom("admin", "dispatch_cascade_exhausted", {
      appointmentId: session.appointmentId,
      totalAttempted: session.excludedProviders.size,
      message: `All nearby providers declined or timed out for appointment ${session.appointmentId}. Kept in searching queue.`,
    });

    // Fall back to general providers broadcast pool
    const broadcastPayload = {
      id: session.appointmentId,
      appointmentId: session.appointmentId,
      patientId: session.patientId,
      patientName: session.patientName,
      patientPhone: session.patientPhone,
      service: session.service,
      location: session.address,
      latitude: session.patientLat,
      longitude: session.patientLng,
      patientLat: session.patientLat,
      patientLng: session.patientLng,
      amount: session.amount,
      status: "searching",
    };
    this.realtimeService.emitToRoom("providers", "new_service_request", broadcastPayload);
    this.realtimeService.emitToRoom("admin", "new_service_request", broadcastPayload);
  }

  /**
   * Called when provider clicks "Accept" on mobile app.
   */
  async handleAccept(appointmentId: string, providerIdentifier: string): Promise<{ success: boolean; message: string; appointment?: AppointmentEntity }> {
    const session = this.activeSessions.get(appointmentId);
    if (!session || session.status !== "active") {
      return { success: false, message: "Offer session is no longer active or has already been fulfilled." };
    }

    const currentCandidate = session.candidates[session.currentIndex];
    const isMatched =
      currentCandidate &&
      (currentCandidate.userId === providerIdentifier ||
        currentCandidate.providerId === providerIdentifier ||
        session.candidates.some((c) => c.userId === providerIdentifier || c.providerId === providerIdentifier));

    if (!isMatched) {
      return { success: false, message: "Provider is not authorized for this offer." };
    }

    const acceptedCandidate =
      currentCandidate && (currentCandidate.userId === providerIdentifier || currentCandidate.providerId === providerIdentifier)
        ? currentCandidate
        : session.candidates.find((c) => c.userId === providerIdentifier || c.providerId === providerIdentifier)!;

    if (session.timer) clearTimeout(session.timer);
    session.status = "accepted";
    this.activeSessions.delete(appointmentId);

    // Transition appointment in database
    const aptRepo = this.dataSource.getRepository(AppointmentEntity);
    const apt = await aptRepo.findOne({ where: { id: appointmentId } });
    if (!apt) {
      return { success: false, message: "Appointment not found." };
    }

    apt.status = "accepted";
    apt.providerId = acceptedCandidate.providerId;
    apt.providerName = acceptedCandidate.name;
    apt.providerPhone = acceptedCandidate.phone;
    apt.providerAvatar = acceptedCandidate.avatar || null;
    await aptRepo.save(apt);

    // Save history
    try {
      const historyRepo = this.dataSource.getRepository(AppointmentStatusHistoryEntity);
      const hist = new AppointmentStatusHistoryEntity();
      hist.id = `apth-${Date.now()}`;
      hist.appointmentId = apt.id;
      hist.status = "accepted";
      hist.changedBy = acceptedCandidate.userId;
      hist.notes = `Accepted via live dispatch cascade by ${acceptedCandidate.name} (ETA ~${acceptedCandidate.etaMinutes} min).`;
      hist.createdAt = new Date().toISOString();
      await historyRepo.save(hist);
    } catch (_) {}

    // Auto-initialize temporary chat room strictly bound to this appointment
    let conversationId: string | null = null;
    if (apt.patientId) {
      try {
        if (this.chatService) {
          const conv = await this.chatService.createConversation(
            [apt.patientId, acceptedCandidate.userId],
            apt.id,
            false,
          );
          conversationId = conv.id;
        } else {
          // Direct DB creation using DataSource without requiring ChatService injection
          const convRepo = this.dataSource.getRepository(ConversationEntity);
          const partRepo = this.dataSource.getRepository(ConversationParticipantEntity);
          const conv = new ConversationEntity();
          conv.id = `conv-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          conv.type = "appointment";
          conv.appointmentId = apt.id;
          conv.isProtected = false;
          conv.createdAt = new Date().toISOString();
          await convRepo.save(conv);

          const p1 = new ConversationParticipantEntity();
          p1.id = `part-${Date.now()}-0`;
          p1.conversationId = conv.id;
          p1.userId = apt.patientId;
          p1.role = "owner";
          p1.joinedAt = new Date().toISOString();
          await partRepo.save(p1);

          const p2 = new ConversationParticipantEntity();
          p2.id = `part-${Date.now()}-1`;
          p2.conversationId = conv.id;
          p2.userId = acceptedCandidate.userId;
          p2.role = "member";
          p2.joinedAt = new Date().toISOString();
          await partRepo.save(p2);

          conversationId = conv.id;
        }
        this.logger.log(`Auto-initialized lifecycle-bound chat conversation ${conversationId} for apt ${apt.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to auto-create conversation for apt ${apt.id}: ${err.message}`);
      }
    }

    const updatePayload = {
      id: apt.id,
      appointmentId: apt.id,
      patientId: apt.patientId,
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      providerId: apt.providerId,
      providerName: apt.providerName,
      providerPhone: apt.providerPhone,
      service: apt.service,
      status: "accepted",
      date: apt.date,
      time: apt.time,
      location: apt.location,
      amount: apt.amount,
      conversationId,
      etaMinutes: acceptedCandidate.etaMinutes,
      routePoints: acceptedCandidate.routePoints || [],
      updatedAt: new Date().toISOString(),
    };

    // Notify accepted provider, patient, and admin dashboard
    this.realtimeService.emitToRoom(`provider:${acceptedCandidate.userId}`, "offer_accepted", updatePayload);
    if (apt.patientId) {
      this.realtimeService.emitToRoom(`patient:${apt.patientId}`, "appointment_status_update", updatePayload);
      this.realtimeService.emitToRoom(`patient:${apt.patientId}`, "dispatch_update", {
        event: "dispatch_update",
        appointmentId: apt.id,
        status: "accepted",
        providerId: acceptedCandidate.providerId,
        providerUserId: acceptedCandidate.userId,
        providerName: acceptedCandidate.name,
        providerPhone: acceptedCandidate.phone,
        providerAvatar: acceptedCandidate.avatar,
        providerSpecialty: acceptedCandidate.specialty,
        providerLat: acceptedCandidate.latitude,
        providerLng: acceptedCandidate.longitude,
        etaMinutes: acceptedCandidate.etaMinutes,
        distanceKm: acceptedCandidate.distanceKm,
        routePoints: acceptedCandidate.routePoints || [],
        conversationId,
      });
    }
    this.realtimeService.emitToRoom("admin", "appointment_status_update", updatePayload);
    this.realtimeService.emitToRoom("admin", "dispatch_update", {
      event: "dispatch_update",
      appointmentId: apt.id,
      status: "accepted",
      providerId: acceptedCandidate.providerId,
      providerUserId: acceptedCandidate.userId,
      providerName: acceptedCandidate.name,
      providerPhone: acceptedCandidate.phone,
      providerAvatar: acceptedCandidate.avatar,
      providerSpecialty: acceptedCandidate.specialty,
      providerLat: acceptedCandidate.latitude,
      providerLng: acceptedCandidate.longitude,
      etaMinutes: acceptedCandidate.etaMinutes,
      distanceKm: acceptedCandidate.distanceKm,
      routePoints: acceptedCandidate.routePoints || [],
      conversationId,
    });
    this.realtimeService.emitAppointmentUpdate(apt.id, "accepted", updatePayload);

    return { success: true, message: "Offer accepted successfully.", appointment: apt };
  }

  /**
   * Called when provider calls POST /api/v1/appointments/:id/reject or socket decline_offer.
   * Does NOT cancel the appointment! Instead, sets status to 'searching', logs excluded provider,
   * and immediately cascades to the next candidate.
   */
  async handleReject(appointmentId: string, providerIdentifier: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(appointmentId);

    // 1. Always record in Redis and Database exclusions
    await this.addExcludedProviderToRedis(appointmentId, providerIdentifier);
    await this.persistExcludedProviderInDb(appointmentId, providerIdentifier);

    // 2. Ensure DB appointment status remains 'searching' (NEVER 'cancelled'!)
    try {
      const aptRepo = this.dataSource.getRepository(AppointmentEntity);
      const apt = await aptRepo.findOne({ where: { id: appointmentId } });
      if (apt && apt.status !== "accepted" && apt.status !== "completed") {
        apt.status = "searching";
        const existing = Array.isArray(apt.excludedProviders) ? apt.excludedProviders : [];
        if (!existing.includes(providerIdentifier)) {
          apt.excludedProviders = [...existing, providerIdentifier];
        }
        await aptRepo.save(apt);
      }
    } catch (_) {}

    // 3. Record in status history
    try {
      const histRepo = this.dataSource.getRepository(AppointmentStatusHistoryEntity);
      const hist = new AppointmentStatusHistoryEntity();
      hist.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      hist.appointmentId = appointmentId;
      hist.status = "searching";
      hist.changedBy = providerIdentifier;
      hist.notes = `Provider declined offer: ${reason || "Declined by provider"}. Cascading to next clinician...`;
      hist.createdAt = new Date().toISOString();
      await histRepo.save(hist);
    } catch (_) {}

    if (!session || session.status !== "active") return;

    if (session.timer) clearTimeout(session.timer);

    session.excludedProviders.add(providerIdentifier);
    const currentCandidate = session.candidates[session.currentIndex];
    if (currentCandidate) {
      session.excludedProviders.add(currentCandidate.userId);
      session.excludedProviders.add(currentCandidate.providerId);
    }

    this.realtimeService.emitToRoom(`provider:${providerIdentifier}`, "offer_cancelled", {
      appointmentId,
      reason: reason || "declined",
    });

    this.logger.log(`Provider ${providerIdentifier} declined offer for apt ${appointmentId} (${reason || "No reason"}). Cascading immediately to next clinician...`);

    // Cascade to next candidate
    session.currentIndex += 1;
    await this.sendOfferToCurrentCandidate(session);
  }

  async handleDecline(appointmentId: string, providerIdentifier: string): Promise<void> {
    return this.handleReject(appointmentId, providerIdentifier, "declined");
  }

  /**
   * Called when 30-second countdown timer expires.
   */
  async handleTimeout(appointmentId: string, providerUserId: string, providerId?: string): Promise<void> {
    const session = this.activeSessions.get(appointmentId);
    if (!session || session.status !== "active") return;

    const currentCandidate = session.candidates[session.currentIndex];
    if (
      currentCandidate &&
      (currentCandidate.userId === providerUserId ||
       currentCandidate.providerId === providerId ||
       !providerUserId)
    ) {
      if (session.timer) clearTimeout(session.timer);

      // Add to exclusions
      session.excludedProviders.add(currentCandidate.userId);
      session.excludedProviders.add(currentCandidate.providerId);
      await this.addExcludedProviderToRedis(appointmentId, currentCandidate.userId);
      await this.addExcludedProviderToRedis(appointmentId, currentCandidate.providerId);
      await this.persistExcludedProviderInDb(appointmentId, currentCandidate.providerId);

      this.realtimeService.emitToRoom(`provider:${currentCandidate.userId}`, "offer_expired", {
        appointmentId,
        message: "Acceptance window (30s) expired.",
      });
      if (currentCandidate.providerId !== currentCandidate.userId) {
        this.realtimeService.emitToRoom(`provider:${currentCandidate.providerId}`, "offer_expired", {
          appointmentId,
          message: "Acceptance window (30s) expired.",
        });
      }

      // Record in appointment history
      try {
        const histRepo = this.dataSource.getRepository(AppointmentStatusHistoryEntity);
        const hist = new AppointmentStatusHistoryEntity();
        hist.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        hist.appointmentId = appointmentId;
        hist.status = "searching";
        hist.changedBy = currentCandidate.userId;
        hist.notes = `Offer timed out after 30s on ${currentCandidate.name}. Cascading to next clinician...`;
        hist.createdAt = new Date().toISOString();
        await histRepo.save(hist);
      } catch (_) {}

      // Keep appointment status as 'searching' (do NOT cancel!)
      try {
        const aptRepo = this.dataSource.getRepository(AppointmentEntity);
        const apt = await aptRepo.findOne({ where: { id: appointmentId } });
        if (apt && apt.status !== "accepted" && apt.status !== "completed") {
          apt.status = "searching";
          await aptRepo.save(apt);
        }
      } catch (_) {}

      this.logger.log(`Offer for apt ${appointmentId} timed out on provider ${currentCandidate.name}. Cascading to next clinician...`);

      session.currentIndex += 1;
      await this.sendOfferToCurrentCandidate(session);
    }
  }

  /**
   * Cancel an active cascade session (e.g. if patient cancels request).
   */
  cancelCascade(appointmentId: string): void {
    const session = this.activeSessions.get(appointmentId);
    if (session) {
      if (session.timer) clearTimeout(session.timer);
      session.status = "cancelled";
      const current = session.candidates[session.currentIndex];
      if (current) {
        this.realtimeService.emitToRoom(`provider:${current.userId}`, "offer_cancelled", {
          appointmentId,
          reason: "Request was cancelled or reassigned.",
        });
      }
      this.activeSessions.delete(appointmentId);
    }
  }

  /**
   * Get active session state for telemetry or inspection.
   */
  getSession(appointmentId: string): CascadeSession | undefined {
    return this.activeSessions.get(appointmentId);
  }
}
