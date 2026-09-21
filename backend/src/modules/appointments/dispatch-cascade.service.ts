import { Injectable, Logger, Optional } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RealtimeService } from "../realtime/realtime.service";
import { ChatService } from "../chat/chat.service";
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
  latitude: number;
  longitude: number;
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

@Injectable()
export class DispatchCascadeService {
  private readonly logger = new Logger(DispatchCascadeService.name);
  private activeSessions = new Map<string, CascadeSession>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
    @Optional()
    private readonly chatService?: ChatService,
  ) {}

  /**
   * Find verified and online providers matching specialty within radiusKm, ranked by ETA.
   */
  async findRankedCandidates(
    patientLat: number,
    patientLng: number,
    specialtyOrService?: string,
    radiusKm = 10,
  ): Promise<CandidateProvider[]> {
    if (!this.dataSource || !this.dataSource.isInitialized) return [];

    const provRepo = this.dataSource.getRepository(ProviderEntity);
    const locRepo = this.dataSource.getRepository(LocationEntity);

    // 1. Fetch available & active providers
    const providers = await provRepo.find({
      where: { available: true, status: "active" },
      relations: ["user"],
    });

    if (providers.length === 0) return [];

    // 2. Fetch live telemetry coordinates from LocationEntity
    const locations = await locRepo.find({
      where: { role: "provider" },
    });
    const locMap = new Map<string, { lat: number; lng: number }>();
    for (const loc of locations) {
      if (loc.userId && typeof loc.y === "number" && typeof loc.x === "number") {
        locMap.set(loc.userId, { lat: loc.y, lng: loc.x });
      }
    }

    const normSpecialty = (specialtyOrService || "").toLowerCase().trim();
    const candidates: CandidateProvider[] = [];

    for (const prov of providers) {
      // Determine coordinates: prefer live location, fallback to provider profile coordinates
      let pLat = prov.latitude;
      let pLng = prov.longitude;

      if (prov.userId && locMap.has(prov.userId)) {
        const live = locMap.get(prov.userId)!;
        pLat = live.lat;
        pLng = live.lng;
      }

      if (typeof pLat !== "number" || typeof pLng !== "number" || isNaN(pLat) || isNaN(pLng)) {
        continue; // Skip providers with no coordinates
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
          // If strict specialty match fails, continue unless general care
          if (normSpecialty.includes("doctor") && !provTitle.includes("dr") && !provSpecialty.includes("doctor")) {
            continue;
          }
          if (normSpecialty.includes("physio") && !provSpecialty.includes("physio") && !provServices.includes("physio")) {
            continue;
          }
        }
      }

      const distanceKm = calculateHaversineKm(patientLat, patientLng, pLat, pLng);

      // Filter by radius (e.g. 10km)
      if (distanceKm > radiusKm) continue;

      // Urban traffic speed estimation (~25 km/h)
      const etaMinutes = Math.max(3, Math.round((distanceKm / 25) * 60 + 2));

      candidates.push({
        providerId: prov.id,
        userId: prov.userId || prov.id,
        name: prov.name,
        phone: prov.phone || prov.user?.phone || "",
        avatar: prov.avatar,
        specialty: prov.specialty || prov.title,
        distanceKm: Number(distanceKm.toFixed(2)),
        etaMinutes,
        latitude: pLat,
        longitude: pLng,
      });
    }

    // Rank candidates in ascending order by ETA (closest clinician first)
    return candidates.sort((a, b) => a.etaMinutes - b.etaMinutes);
  }

  /**
   * Start the cascade dispatch routine for an immediate on-demand care request.
   */
  async startCascade(
    appointment: AppointmentEntity,
    patientLat?: number,
    patientLng?: number,
    radiusKm = 10,
  ): Promise<CascadeSession | null> {
    // Default to Addis Ababa central coordinates if not provided
    const lat = typeof patientLat === "number" ? patientLat : 9.0222;
    const lng = typeof patientLng === "number" ? patientLng : 38.7468;

    let candidates = await this.findRankedCandidates(lat, lng, appointment.service, radiusKm);

    // If no candidate found within radiusKm, widen search up to 25 km
    if (candidates.length === 0 && radiusKm < 25) {
      candidates = await this.findRankedCandidates(lat, lng, appointment.service, 25);
    }

    if (candidates.length === 0) {
      this.logger.warn(`No candidate providers found within radius for appointment ${appointment.id}`);
      // Fallback: broadcast to general providers pool & alert dispatch admin
      const fallbackPayload = {
        id: appointment.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        patientPhone: appointment.patientPhone,
        service: appointment.service,
        location: appointment.location,
        amount: appointment.amount,
        status: appointment.status,
      };
      this.realtimeService.emitToRoom("providers", "new_service_request", fallbackPayload);
      this.realtimeService.emitToRoom("admin", "new_service_request", fallbackPayload);
      this.realtimeService.emitToRoom("admin", "dispatch_cascade_exhausted", {
        appointmentId: appointment.id,
        reason: "No nearby available providers found",
      });
      return null;
    }

    // Cancel any existing session for this appointment
    this.cancelCascade(appointment.id);

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
      offerTimeoutSeconds: 30,
      expiresAt: Date.now() + 30000,
      status: "active",
    };

    this.activeSessions.set(appointment.id, session);
    this.logger.log(`Starting cascade dispatch for appointment ${appointment.id} with ${candidates.length} candidates.`);

    await this.sendOfferToCurrentCandidate(session);
    return session;
  }

  /**
   * Send high-priority service_offer WebSocket event to candidate at session.currentIndex.
   */
  private async sendOfferToCurrentCandidate(session: CascadeSession): Promise<void> {
    if (session.status !== "active") return;

    if (session.currentIndex >= session.candidates.length) {
      // All candidates exhausted!
      this.logger.log(`All candidates declined/timed out for appointment ${session.appointmentId}`);
      session.status = "exhausted";
      this.activeSessions.delete(session.appointmentId);

      const eventPayload = {
        appointmentId: session.appointmentId,
        id: session.appointmentId,
        patientId: session.patientId,
        patientName: session.patientName,
        service: session.service,
        location: session.address,
        amount: session.amount,
        status: "requested",
      };

      // Fall back to general providers broadcast pool
      this.realtimeService.emitToRoom("providers", "new_service_request", eventPayload);
      this.realtimeService.emitToRoom("admin", "new_service_request", eventPayload);
      this.realtimeService.emitToRoom("admin", "dispatch_cascade_exhausted", {
        appointmentId: session.appointmentId,
        totalAttempted: session.candidates.length,
        message: "All nearby provider offers were declined or timed out. Request returned to review queue.",
      });
      return;
    }

    const candidate = session.candidates[session.currentIndex];
    const timeoutSec = session.offerTimeoutSeconds || 30;
    session.expiresAt = Date.now() + timeoutSec * 1000;

    const offerPayload = {
      event: "service_offer",
      appointmentId: session.appointmentId,
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
      fee: session.amount,
      timeoutSeconds: timeoutSec,
      expiresAt: session.expiresAt,
      cascadeIndex: session.currentIndex,
      totalCandidates: session.candidates.length,
      providerId: candidate.providerId,
      providerUserId: candidate.userId,
    };

    // Emit targeted high-priority event to the candidate's rooms
    this.realtimeService.emitToRoom(`provider:${candidate.userId}`, "service_offer", offerPayload);
    if (candidate.providerId !== candidate.userId) {
      this.realtimeService.emitToRoom(`provider:${candidate.providerId}`, "service_offer", offerPayload);
    }

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

    // Start 30-second acceptance countdown timer
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.handleTimeout(session.appointmentId, candidate.userId);
    }, timeoutSec * 1000);
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
      updatedAt: new Date().toISOString(),
    };

    // Notify accepted provider, patient, and admin dashboard
    this.realtimeService.emitToRoom(`provider:${acceptedCandidate.userId}`, "offer_accepted", updatePayload);
    if (apt.patientId) {
      this.realtimeService.emitToRoom(`patient:${apt.patientId}`, "appointment_status_update", updatePayload);
    }
    this.realtimeService.emitToRoom("admin", "appointment_status_update", updatePayload);
    this.realtimeService.emitAppointmentUpdate(apt.id, "accepted", updatePayload);

    return { success: true, message: "Offer accepted successfully.", appointment: apt };
  }

  /**
   * Called when provider clicks "Decline" on mobile app.
   */
  async handleDecline(appointmentId: string, providerIdentifier: string): Promise<void> {
    const session = this.activeSessions.get(appointmentId);
    if (!session || session.status !== "active") return;

    const currentCandidate = session.candidates[session.currentIndex];
    if (!currentCandidate || (currentCandidate.userId !== providerIdentifier && currentCandidate.providerId !== providerIdentifier)) {
      return;
    }

    if (session.timer) clearTimeout(session.timer);

    this.realtimeService.emitToRoom(`provider:${currentCandidate.userId}`, "offer_cancelled", {
      appointmentId,
      reason: "declined",
    });

    this.logger.log(`Provider ${currentCandidate.name} declined offer for apt ${appointmentId}. Cascading to next clinician...`);

    // Cascade to next candidate
    session.currentIndex += 1;
    await this.sendOfferToCurrentCandidate(session);
  }

  /**
   * Called when 30-second countdown timer expires.
   */
  private async handleTimeout(appointmentId: string, providerUserId: string): Promise<void> {
    const session = this.activeSessions.get(appointmentId);
    if (!session || session.status !== "active") return;

    const currentCandidate = session.candidates[session.currentIndex];
    if (currentCandidate && currentCandidate.userId === providerUserId) {
      this.realtimeService.emitToRoom(`provider:${currentCandidate.userId}`, "offer_expired", {
        appointmentId,
        message: "Acceptance window (30s) expired.",
      });

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
