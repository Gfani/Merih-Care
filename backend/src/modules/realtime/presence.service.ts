import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";

export interface UserPresenceSession {
  socketId: string;
  userId: string;
  role: string;
  connectedAt: number;
  lastHeartbeat: number;
  rooms: Set<string>;
  metadata?: Record<string, any>;
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly inMemorySessions = new Map<string, UserPresenceSession>();
  private readonly userSocketMap = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private cleanupInterval: NodeJS.Timeout | null = null;
  private redisClient: any = null;

  async onModuleInit() {
    if (process.env.REDIS_URL) {
      try {
        const { createClient } = require("redis");
        this.redisClient = createClient({ url: process.env.REDIS_URL });
        await this.redisClient.connect();
        this.logger.log("[Presence] Redis presence backend connected and authenticated");
      } catch (err: any) {
        if (process.env.REDIS_REQUIRED === "true") {
          this.logger.error(`[Presence CRITICAL] Redis is required but connection failed: ${err.message}`);
          throw new Error(`PresenceService failed to connect to required Redis instance: ${err.message}`);
        }
        this.logger.warn(`[Presence] Redis connection failed (${err.message}). Using in-memory fallback.`);
        this.redisClient = null;
      }
    } else if (process.env.REDIS_REQUIRED === "true") {
      throw new Error("PresenceService: REDIS_URL is required when REDIS_REQUIRED=true");
    }

    // Periodic stale socket cleanup sweeper (every 30s)
    this.cleanupInterval = setInterval(() => this.sweepStaleSessions(45000), 30000);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // ignore disconnect errors during teardown
      }
    }
  }

  /** Register user socket upon successful authenticated connection */
  async registerSession(
    socketId: string,
    userId: string,
    role: string,
    initialRooms: string[] = [],
    metadata: Record<string, any> = {},
  ): Promise<UserPresenceSession> {
    const session: UserPresenceSession = {
      socketId,
      userId,
      role,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      rooms: new Set(initialRooms),
      metadata,
    };

    this.inMemorySessions.set(socketId, session);

    if (!this.userSocketMap.has(userId)) {
      this.userSocketMap.set(userId, new Set());
    }
    this.userSocketMap.get(userId)!.add(socketId);

    if (this.redisClient) {
      try {
        await this.redisClient.hSet(`presence:user:${userId}`, {
          role,
          lastSeen: Date.now().toString(),
          status: "online",
        });
        await this.redisClient.sAdd(`presence:sockets:${userId}`, socketId);
        await this.redisClient.expire(`presence:user:${userId}`, 3600);
      } catch (err: any) {
        this.logger.warn(`[Presence] Redis write error: ${err.message}`);
      }
    }

    return session;
  }

  /** Unregister user socket upon disconnection */
  async unregisterSession(socketId: string): Promise<UserPresenceSession | null> {
    const session = this.inMemorySessions.get(socketId);
    if (!session) return null;

    this.inMemorySessions.delete(socketId);

    const userSockets = this.userSocketMap.get(session.userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userSocketMap.delete(session.userId);
      }
    }

    if (this.redisClient) {
      try {
        await this.redisClient.sRem(`presence:sockets:${session.userId}`, socketId);
        const remaining = await this.redisClient.sCard(`presence:sockets:${session.userId}`);
        if (remaining === 0) {
          await this.redisClient.hSet(`presence:user:${session.userId}`, {
            status: "offline",
            lastSeen: Date.now().toString(),
          });
        }
      } catch (err: any) {
        this.logger.warn(`[Presence] Redis remove error: ${err.message}`);
      }
    }

    return session;
  }

  /** Update heartbeat timestamp */
  heartbeat(socketId: string): boolean {
    const session = this.inMemorySessions.get(socketId);
    if (!session) return false;
    session.lastHeartbeat = Date.now();
    return true;
  }

  /** Add room to session */
  joinRoom(socketId: string, room: string) {
    const session = this.inMemorySessions.get(socketId);
    if (session) {
      session.rooms.add(room);
    }
  }

  /** Remove room from session */
  leaveRoom(socketId: string, room: string) {
    const session = this.inMemorySessions.get(socketId);
    if (session) {
      session.rooms.delete(room);
    }
  }

  /** Get session by socketId */
  getSession(socketId: string): UserPresenceSession | undefined {
    return this.inMemorySessions.get(socketId);
  }

  /** Check if a specific userId is currently online */
  isOnline(userId: string): boolean {
    const sockets = this.userSocketMap.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /** Get aggregated count of online users by role */
  getOnlineCounts(): { providers: number; patients: number; admins: number; totalUsers: number; totalSockets: number } {
    const onlineUserIds = new Set<string>();
    let providers = 0;
    let patients = 0;
    let admins = 0;

    for (const session of this.inMemorySessions.values()) {
      if (!onlineUserIds.has(session.userId)) {
        onlineUserIds.add(session.userId);
        if (session.role === "provider") providers++;
        else if (session.role === "patient") patients++;
        else if (session.role === "admin" || session.role === "super_admin") admins++;
      }
    }

    return {
      providers,
      patients,
      admins,
      totalUsers: onlineUserIds.size,
      totalSockets: this.inMemorySessions.size,
    };
  }

  /** Sweep stale sessions that haven't sent a heartbeat within staleThresholdMs */
  sweepStaleSessions(staleThresholdMs = 45000): string[] {
    const now = Date.now();
    const staleSocketIds: string[] = [];

    for (const [socketId, session] of this.inMemorySessions.entries()) {
      if (now - session.lastHeartbeat > staleThresholdMs) {
        staleSocketIds.push(socketId);
        this.unregisterSession(socketId);
      }
    }

    if (staleSocketIds.length > 0) {
      this.logger.debug(`[Presence] Swept ${staleSocketIds.length} stale socket sessions`);
    }

    return staleSocketIds;
  }
}
