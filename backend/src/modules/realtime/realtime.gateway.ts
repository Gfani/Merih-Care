import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Optional } from "@nestjs/common";
import { RealtimeService } from "./realtime.service";
import { PresenceService } from "./presence.service";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { parseCookieString } from "../../shared/utils/cookie.util";


// In-memory socket tracking
const socketUserMap = new Map<string, { userId: string; role: string; rooms: Set<string>; lastPong: number; lastLocationAt: Map<string, number> }>();
const adminSocketCount = { count: 0 };
let adminMetricsInterval: NodeJS.Timeout | null = null;

// Flood protection tracking: socketId -> timestamps of recent events
const socketEventRateMap = new Map<string, number[]>();
const MAX_EVENTS_PER_SECOND = 20;

const allowedOrigins = process.env.NODE_ENV === "production"
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["https://admin.merihcare.et", "https://app.merihcare.et"])
  : true;

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  namespace: "/realtime",
  pingInterval: 25000,
  pingTimeout: 35000,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private presence: PresenceService;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    @InjectRepository(LocationEntity)
    private readonly locationRepo: Repository<LocationEntity>,
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    presenceService?: PresenceService,
  ) {
    this.presence = presenceService || new PresenceService();
  }

  afterInit(server: Server) {
    // Hand the server reference to the injectable service
    this.realtimeService.setServer(server);

    // JWT auth middleware — rejects unauthenticated connections & checks active state
    server.use(async (socket: Socket, next) => {
      try {
        let token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        // If no token in auth payload or header, extract from HttpOnly cookie header
        if (!token && socket.handshake.headers?.cookie) {
          const parsed = parseCookieString(socket.handshake.headers.cookie);
          token = parsed.admin_token || parsed.token;
        }

        if (!token) return next(new Error("Unauthorized: missing token"));

        const payload = await this.jwtService.verifyAsync(token);
        const userId = payload.sub || payload.id;
        const role = payload.role || "patient";

        // Check real-time database state for immediate suspension / removal / revocation enforcement
        if (this.dataSource && this.dataSource.isInitialized && userId) {
          const userRepo = this.dataSource.getRepository(UserEntity);
          const user = await userRepo.findOne({ where: { id: userId } });
          if (!user) {
            return next(new Error("Unauthorized: account has been removed"));
          }
          if (user.status === "suspended") {
            return next(new Error("Unauthorized: account has been suspended by administration"));
          }
          const userVersion = user.tokenVersion ?? 0;
          if (
            payload.tokenVersion === undefined ||
            payload.tokenVersion !== userVersion
          ) {
            return next(new Error("Unauthorized: session has been revoked"));
          }
        }

        (socket as any).userId = userId;
        (socket as any).role = role;
        (socket as any).roles = payload.roles || [];
        (socket as any).hasProviderAccount = payload.hasProviderAccount;
        (socket as any).hasAdminAccount = payload.hasAdminAccount;
        next();
      } catch {
        next(new Error("Unauthorized: invalid token"));
      }
    });

    // Server heartbeat — emit ping every 25 s to all connected namespace clients
    const heartbeatTimer = setInterval(() => {
      server.emit("ping", { ts: new Date().toISOString() });
    }, 25000);
    heartbeatTimer.unref();
  }

  handleConnection(socket: Socket) {
    const userId = (socket as any).userId;
    const role = (socket as any).role;
    const roles: string[] = (socket as any).roles || [];
    if (!userId) { socket.disconnect(); return; }

    const isProvider = role === "provider" || roles.includes("provider") || (socket as any).hasProviderAccount;
    const isAdmin =
      role === "admin" ||
      role === "super_admin" ||
      roles.includes("admin") ||
      (socket as any).hasAdminAccount ||
      !!(socket as any).adminRole ||
      (typeof role === "string" && role.includes("admin"));

    // Auto-join personal room
    const personalRoom = isProvider ? `provider:${userId}` : (isAdmin ? `admin:${userId}` : `patient:${userId}`);
    socket.join(personalRoom);

    // Join providers broadcast room
    if (isProvider) {
      socket.join("providers");
      socket.join(`provider:${userId}`);
    }

    // Auto-join admin room for immediate real-time dashboard events
    if (isAdmin) {
      socket.join("admin");
      socket.join(`admin:${userId}`);
      adminSocketCount.count += 1;
      if (!adminMetricsInterval) {
        adminMetricsInterval = setInterval(() => this.broadcastAdminMetrics(), 10000);
        adminMetricsInterval.unref();
      }
    }

    const roomsSet = new Set([personalRoom]);
    if (isAdmin) roomsSet.add("admin");
    if (isProvider) {
      roomsSet.add("providers");
      if (this.dataSource && this.dataSource.isInitialized) {
        this.dataSource.getRepository(ProviderEntity).findOne({ where: { userId } }).then((prov) => {
          if (prov) {
            const provRoom = `provider:${prov.id}`;
            socket.join(provRoom);
            roomsSet.add(provRoom);
          }
        }).catch(() => {});
      }
    }

    socketUserMap.set(socket.id, {
      userId, role,
      rooms: roomsSet,
      lastPong: Date.now(),
      lastLocationAt: new Map(),
    });

    this.presence.registerSession(socket.id, userId, role, Array.from(roomsSet));
    this.realtimeService.emitUserPresence(userId, role, "online");

    // Emit connection established — client must receive this to show LIVE badge
    socket.emit("connection_established", {
      v: 1,
      event: "connection_established",
      data: { userId, role, sessionId: socket.id },
      ts: new Date().toISOString(),
    });
  }

  handleDisconnect(socket: Socket) {
    const info = socketUserMap.get(socket.id);
    if (info) {
      if (info.role === "admin" || info.role === "super_admin") {
        adminSocketCount.count = Math.max(0, adminSocketCount.count - 1);
        if (adminSocketCount.count === 0 && adminMetricsInterval) {
          clearInterval(adminMetricsInterval);
          adminMetricsInterval = null;
        }
      }
      this.presence.unregisterSession(socket.id);
      if (!this.presence.isOnline(info.userId)) {
        this.realtimeService.emitUserPresence(info.userId, info.role, "offline");
      }
    }
    socketUserMap.delete(socket.id);
    socketEventRateMap.delete(socket.id);
  }

  // ─── Heartbeat ──────────────────────────────────────────────────

  @SubscribeMessage("pong")
  handlePong(@ConnectedSocket() socket: Socket) {
    const info = socketUserMap.get(socket.id);
    if (info) info.lastPong = Date.now();
    this.presence.heartbeat(socket.id);
  }

  // ─── Room Join Events ────────────────────────────────────────────

  private async canAccessAppointment(userId: string, role: string, appointmentId: string): Promise<boolean> {
    if (role === "admin" || role === "super_admin") return true;
    try {
      const apt = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
      if (!apt) return false;
      return apt.patientId === userId || apt.providerId === userId;
    } catch {
      return false;
    }
  }

  private async canAccessEmergency(userId: string, role: string, emergencyId: string): Promise<boolean> {
    if (role === "admin" || role === "super_admin") return true;
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        const emergencyRepo = this.dataSource.getRepository(EmergencyEntity);
        const em = await emergencyRepo.findOne({ where: { id: emergencyId } });
        if (!em) return false;
        if (em.patientId === userId || em.responderId === userId) return true;
        const providerRepo = this.dataSource.getRepository(ProviderEntity);
        const prov = await providerRepo.findOne({ where: { userId } });
        if (prov && em.responderId === prov.id) return true;
        return false;
      }
      return role === "provider";
    } catch {
      return false;
    }
  }

  @SubscribeMessage("join_appointment")
  async handleJoinAppointment(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { appointmentId: string },
  ) {
    const { userId, role } = (socket as any);
    const room = `appointment:${data.appointmentId}`;

    const allowed = await this.canAccessAppointment(userId, role, data.appointmentId);
    if (!allowed) {
      socket.emit("error", { message: "Not authorized for this appointment" });
      return { ok: false, error: "Not authorized" };
    }

    socket.join(room);
    socketUserMap.get(socket.id)?.rooms.add(room);
    return { ok: true, room, ts: new Date().toISOString() };
  }

  @SubscribeMessage("join_emergency")
  async handleJoinEmergency(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { emergencyId: string },
  ) {
    const { userId, role } = (socket as any);
    const allowed = await this.canAccessEmergency(userId, role, data.emergencyId);
    if (!allowed) {
      socket.emit("error", { message: "Not authorized for this emergency room" });
      return { ok: false, error: "Forbidden" };
    }
    const room = `emergency:${data.emergencyId}`;
    socket.join(room);
    socketUserMap.get(socket.id)?.rooms.add(room);
    return { ok: true, room, ts: new Date().toISOString() };
  }

  @SubscribeMessage("join_admin")
  handleJoinAdmin(@ConnectedSocket() socket: Socket) {
    const role = (socket as any).role;
    const roles: string[] = (socket as any).roles || [];
    const isAdmin =
      role === "admin" ||
      role === "super_admin" ||
      roles.includes("admin") ||
      (socket as any).hasAdminAccount ||
      !!(socket as any).adminRole ||
      (typeof role === "string" && role.includes("admin"));

    if (!isAdmin) {
      socket.emit("error", { message: "Admin role required" });
      return { ok: false, error: "Forbidden" };
    }

    socket.join("admin");
    socketUserMap.get(socket.id)?.rooms.add("admin");
    adminSocketCount.count += 1;

    // Start admin metrics broadcast if not already running
    if (!adminMetricsInterval) {
      adminMetricsInterval = setInterval(() => this.broadcastAdminMetrics(), 10000);
      adminMetricsInterval.unref();
      this.broadcastAdminMetrics(); // immediate first push
    }

    return { ok: true, room: "admin", ts: new Date().toISOString() };
  }

  @SubscribeMessage("join_providers")
  handleJoinProviders(@ConnectedSocket() socket: Socket) {
    socket.join("providers");
    socketUserMap.get(socket.id)?.rooms.add("providers");
    return { ok: true, room: "providers", ts: new Date().toISOString() };
  }

  /**
   * join_provider — Explicit post-auth room join for the Flutter provider app.
   * The app emits this event immediately after receiving connection_established.
   * Joins the provider into:
   *   • "providers" broadcast room (receives all open on-demand requests)
   *   • "provider:{userId}" personal room (receives targeted requests)
   *   • "provider:{providerEntityId}" entity room (receives requests keyed by ProviderEntity.id)
   */
  @SubscribeMessage("join_provider")
  async handleJoinProvider(@ConnectedSocket() socket: Socket) {
    const { userId, role, roles } = (socket as any);
    const isProvider = role === "provider" || (roles as string[])?.includes("provider") || (socket as any).hasProviderAccount;

    if (!isProvider) {
      socket.emit("error", { message: "Provider role required" });
      return { ok: false, error: "Forbidden" };
    }

    const joinedRooms: string[] = [];

    // Always join the broadcast room and personal user room
    socket.join("providers");
    socket.join(`provider:${userId}`);
    joinedRooms.push("providers", `provider:${userId}`);
    socketUserMap.get(socket.id)?.rooms.add("providers");
    socketUserMap.get(socket.id)?.rooms.add(`provider:${userId}`);

    // Look up the ProviderEntity to also join the entity-keyed room
    if (this.dataSource && this.dataSource.isInitialized) {
      try {
        const provRepo = this.dataSource.getRepository(ProviderEntity);
        const prov = await provRepo.findOne({ where: [{ userId }, { id: userId }] });
        if (prov && prov.id && prov.id !== userId) {
          const entityRoom = `provider:${prov.id}`;
          socket.join(entityRoom);
          joinedRooms.push(entityRoom);
          socketUserMap.get(socket.id)?.rooms.add(entityRoom);
        }
      } catch (_) {}
    }

    return { ok: true, rooms: joinedRooms, ts: new Date().toISOString() };
  }

  /**
   * search_providers — Patient emits their GPS coordinates to find nearby providers.
   * The gateway:
   *   1. Queries LocationEntity for all providers whose status is online/active.
   *   2. Filters to those within radiusKm (default 15 km) using the Haversine formula.
   *   3. Emits new_service_request to each nearby provider's personal room.
   *   4. Emits new_service_request to the "providers" room (catches any provider not in LocationEntity).
   *   5. Emits new_service_request to the "admin" room.
   *   6. Returns { ok, nearbyCount, appointmentId } acknowledgement to the patient.
   */
  @SubscribeMessage("search_providers")
  async handleSearchProviders(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      lat: number;
      lng: number;
      appointmentId?: string;
      service?: string;
      radiusKm?: number;
      payload?: Record<string, any>;
    },
  ) {
    const { userId, role } = (socket as any);
    const isPatient = role === "patient" || !role;
    if (!isPatient && role !== "admin") {
      socket.emit("error", { message: "Only patients may search for providers" });
      return { ok: false, error: "Forbidden" };
    }

    const patientLat = data?.lat;
    const patientLng = data?.lng;
    const radiusKm = data?.radiusKm ?? 15; // Default 15 km radius for Addis Ababa
    const eventPayload = {
      ...(data?.payload || {}),
      appointmentId: data?.appointmentId,
      service: data?.service,
      patientLat,
      patientLng,
      radiusKm,
      ts: new Date().toISOString(),
    };

    const nearbyProviderRooms = new Set<string>();

    // Query LocationEntity for online providers and filter by radius
    if (this.dataSource && this.dataSource.isInitialized && typeof patientLat === "number" && typeof patientLng === "number") {
      try {
        const locRepo = this.dataSource.getRepository(LocationEntity);
        const providerLocations = await locRepo
          .createQueryBuilder("loc")
          .where("loc.role = :role AND loc.status NOT IN (:...offlineStatuses)", {
            role: "provider",
            offlineStatuses: ["offline", "suspended"],
          })
          .getMany();

        for (const loc of providerLocations) {
          if (!loc.userId || typeof loc.y !== "number" || typeof loc.x !== "number") continue;
          // Haversine distance calculation
          const R = 6371;
          const dLat = (loc.y - patientLat) * Math.PI / 180;
          const dLon = (loc.x - patientLng) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(patientLat * Math.PI / 180) *
            Math.cos(loc.y * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          if (distanceKm <= radiusKm) {
            nearbyProviderRooms.add(`provider:${loc.userId}`);
          }
        }

        // Emit to each nearby provider's personal room
        for (const room of nearbyProviderRooms) {
          this.realtimeService.emitToRoom(room, "new_service_request", eventPayload);
        }
      } catch (_) {}
    }

    // Always also emit to the full "providers" room (catches providers not in LocationEntity)
    this.realtimeService.emitToRoom("providers", "new_service_request", eventPayload);

    // Always emit to admin room
    this.realtimeService.emitToRoom("admin", "new_service_request", eventPayload);

    return { ok: true, nearbyCount: nearbyProviderRooms.size, appointmentId: data?.appointmentId, ts: new Date().toISOString() };
  }

  // ─── Provider Location Updates ───────────────────────────────────

  @SubscribeMessage("location_update")
  async handleLocationUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { appointmentId: string; lat: number; lng: number },
  ) {
    const { userId, role } = (socket as any);
    if (role !== "provider") return { ok: false, error: "Only providers may send location" };

    const now = Date.now();
    const info = socketUserMap.get(socket.id);
    const lastUpdate = info?.lastLocationAt.get(data.appointmentId) || 0;

    // Rate-limit: minimum 3 seconds between GPS telemetry updates
    if (now - lastUpdate < 3000) {
      return { ok: false, error: "RATE_LIMITED", message: "Location updates throttled to once every 3s" };
    }

    if (info) info.lastLocationAt.set(data.appointmentId, now);

    // Persist to DB
    const loc = await this.locationRepo.findOne({ where: { userId } });
    if (loc) {
      loc.x = data.lng;
      loc.y = data.lat;
      await this.locationRepo.save(loc);
    }

    // Relay to appointment room (includes last-updated timestamp)
    const ts = new Date().toISOString();
    this.realtimeService.emitLocationUpdate(data.appointmentId, userId, data.lat, data.lng, ts);

    // Schedule stale detection after 90 s
    const staleTimer = setTimeout(() => {
      const current = socketUserMap.get(socket.id);
      const lastAt = current?.lastLocationAt.get(data.appointmentId) ?? 0;
      if (Date.now() - lastAt >= 90000) {
        this.realtimeService.emitLocationStale(data.appointmentId, userId);
      }
    }, 90000);
    staleTimer.unref();

    return { ok: true, ts };
  }

  // ─── Presence Inquiries ──────────────────────────────────────────

  isUserOnline(userId: string): boolean {
    return this.presence.isOnline(userId) || [...socketUserMap.values()].some((s) => s.userId === userId);
  }

  getOnlineUserCount(): { providers: number; patients: number; total: number } {
    const counts = this.presence.getOnlineCounts();
    return {
      providers: counts.providers,
      patients: counts.patients,
      total: counts.totalUsers || socketUserMap.size,
    };
  }

  // ─── Session Restore (Reconnect) ─────────────────────────────────

  @SubscribeMessage("restore_session")
  async handleRestoreSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { rooms?: string[] },
  ) {
    const { userId, role } = (socket as any);
    const info = socketUserMap.get(socket.id);
    const requestedRooms = data?.rooms ?? [];
    const authorizedRooms: string[] = [];

    // Verify ownership before re-joining rooms
    for (const room of requestedRooms) {
      if (typeof room !== "string") continue;
      if (room === "admin") {
        if (role === "admin" || role === "super_admin") {
          socket.join(room);
          info?.rooms.add(room);
          authorizedRooms.push(room);
        }
      } else if (room === "providers") {
        if (role === "provider") {
          socket.join(room);
          info?.rooms.add(room);
          authorizedRooms.push(room);
        }
      } else if (room.startsWith("appointment:")) {
        const appointmentId = room.replace("appointment:", "");
        const allowed = await this.canAccessAppointment(userId, role, appointmentId);
        if (allowed) {
          socket.join(room);
          info?.rooms.add(room);
          authorizedRooms.push(room);
        }
      } else if (room.startsWith("emergency:")) {
        const emergencyId = room.replace("emergency:", "");
        const allowed = await this.canAccessEmergency(userId, role, emergencyId);
        if (allowed) {
          socket.join(room);
          info?.rooms.add(room);
          authorizedRooms.push(room);
        }
      }
    }

    return { ok: true, rejoined: authorizedRooms, ts: new Date().toISOString() };
  }

  // ─── Admin Metrics Broadcast ─────────────────────────────────────

  private async broadcastAdminMetrics() {
    try {
      const [activeAppointments, pendingRequests] = await Promise.all([
        this.appointmentRepo.count({ where: { status: "in_progress" } } as any),
        this.appointmentRepo.count({ where: { status: "requested" } } as any),
      ]);

      const onlineProviders = [...socketUserMap.values()].filter(s => s.role === "provider").length;
      const onlinePatients = [...socketUserMap.values()].filter(s => s.role === "patient").length;
      const totalConnections = socketUserMap.size;

      this.realtimeService.emitAdminMetrics({
        activeAppointments,
        pendingRequests,
        onlineProviders,
        onlinePatients,
        totalConnections,
        updatedAt: Date.now(),
      });
    } catch { /* non-critical */ }
  }
}
