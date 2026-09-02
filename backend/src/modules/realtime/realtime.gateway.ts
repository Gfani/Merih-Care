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
import { Repository } from "typeorm";
import { Optional } from "@nestjs/common";
import { RealtimeService } from "./realtime.service";
import { PresenceService } from "./presence.service";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

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
    presenceService?: PresenceService,
  ) {
    this.presence = presenceService || new PresenceService();
  }

  afterInit(server: Server) {
    // Hand the server reference to the injectable service
    this.realtimeService.setServer(server);

    // JWT auth middleware — rejects unauthenticated connections
    server.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) return next(new Error("Unauthorized: missing token"));

        const payload = await this.jwtService.verifyAsync(token);
        const userId = payload.sub || payload.id;
        const role = payload.role || "patient";

        (socket as any).userId = userId;
        (socket as any).role = role;
        next();
      } catch {
        next(new Error("Unauthorized: invalid token"));
      }
    });

    // Redis adapter (only if REDIS_URL is configured)
    if (process.env.REDIS_URL) {
      try {
        const { createClient } = require("redis");
        const { createAdapter } = require("@socket.io/redis-adapter");
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();
        Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
          server.adapter(createAdapter(pubClient, subClient));
          console.log("[Realtime] Redis adapter connected");
        }).catch((e: any) => console.warn("[Realtime] Redis adapter failed, using in-memory:", e.message));
      } catch (e: any) {
        console.warn("[Realtime] Redis packages not found, using in-memory adapter");
      }
    }

    // Server heartbeat — emit ping every 25 s to all connected namespace clients
    setInterval(() => {
      server.emit("ping", { ts: new Date().toISOString() });
    }, 25000);
  }

  handleConnection(socket: Socket) {
    const userId = (socket as any).userId;
    const role = (socket as any).role;
    if (!userId) { socket.disconnect(); return; }

    // Auto-join personal room
    const personalRoom = role === "provider" ? `provider:${userId}` : `patient:${userId}`;
    socket.join(personalRoom);

    // Join providers broadcast room
    if (role === "provider") socket.join("providers");

    socketUserMap.set(socket.id, {
      userId, role,
      rooms: new Set([personalRoom]),
      lastPong: Date.now(),
      lastLocationAt: new Map(),
    });

    this.presence.registerSession(socket.id, userId, role, [personalRoom]);
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
      if (info.role === "admin") {
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

  @SubscribeMessage("join_appointment")
  async handleJoinAppointment(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { appointmentId: string },
  ) {
    const { userId, role } = (socket as any);
    const room = `appointment:${data.appointmentId}`;

    // Verify user is patient or provider of this appointment (or admin)
    if (role !== "admin") {
      const apt = await this.appointmentRepo.findOne({ where: { id: data.appointmentId } });
      if (!apt || (apt.patientId !== userId && apt.providerId !== userId)) {
        socket.emit("error", { message: "Not authorized for this appointment" });
        return { ok: false, error: "Not authorized" };
      }
    }

    socket.join(room);
    socketUserMap.get(socket.id)?.rooms.add(room);
    return { ok: true, room, ts: new Date().toISOString() };
  }

  @SubscribeMessage("join_emergency")
  handleJoinEmergency(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { emergencyId: string },
  ) {
    const role = (socket as any).role;
    if (role !== "provider" && role !== "admin") {
      socket.emit("error", { message: "Only providers and admins may join emergency rooms" });
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
    if (role !== "admin") {
      socket.emit("error", { message: "Admin role required" });
      return { ok: false, error: "Forbidden" };
    }

    socket.join("admin");
    socketUserMap.get(socket.id)?.rooms.add("admin");
    adminSocketCount.count += 1;

    // Start admin metrics broadcast if not already running
    if (!adminMetricsInterval) {
      adminMetricsInterval = setInterval(() => this.broadcastAdminMetrics(), 10000);
      this.broadcastAdminMetrics(); // immediate first push
    }

    return { ok: true, room: "admin", ts: new Date().toISOString() };
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
    setTimeout(() => {
      const current = socketUserMap.get(socket.id);
      const lastAt = current?.lastLocationAt.get(data.appointmentId) ?? 0;
      if (Date.now() - lastAt >= 90000) {
        this.realtimeService.emitLocationStale(data.appointmentId, userId);
      }
    }, 90000);

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
  handleRestoreSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { rooms?: string[] },
  ) {
    const info = socketUserMap.get(socket.id);
    const requestedRooms = data?.rooms ?? [];

    // Re-join previously known rooms
    for (const room of requestedRooms) {
      // Security: only allow appointment/emergency rooms they own (simplified here)
      if (room.startsWith("appointment:") || room.startsWith("emergency:") || room === "admin") {
        socket.join(room);
        info?.rooms.add(room);
      }
    }

    return { ok: true, rejoined: requestedRooms, ts: new Date().toISOString() };
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
