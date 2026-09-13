import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";

let redisClient: any = null;
let redisInitialized = false;

function getRedisClient(): any {
  if (redisInitialized) return redisClient;
  redisInitialized = true;
  const redisUrl =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
  if (redisUrl) {
    try {
      const RedisLib = require("ioredis");
      const client = new RedisLib(redisUrl, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      client.on("error", () => {
        // Silently handle Redis offline errors to avoid crashing HTTP requests
      });
      client.connect().catch(() => {});
      redisClient = client;
    } catch {
      redisClient = null;
    }
  }
  return redisClient;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private static compositeRequests: Map<string, number[]> = new Map();
  private static identifierRequests: Map<string, number[]> = new Map();
  private static ipRequests: Map<string, number[]> = new Map();

  private readonly limit: number = 5;
  private readonly ttlMs: number = 60000; // 1 minute

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();

    const ip = (request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress || "unknown").toString();
    const deviceId = (request.headers["x-device-id"] || request.headers["user-agent"] || "unknown").toString().slice(0, 32);
    const body = request.body || {};
    const identifier = (body.identifier || body.email || body.phone || request.user?.id || "").toString().toLowerCase().trim();
    const path = request.path || request.url || "auth";
    const purpose = path.includes("login")
      ? "login"
      : path.includes("password-reset")
      ? "pwd-reset"
      : path.includes("email-verification")
      ? "email-verify"
      : path.includes("mfa")
      ? "mfa"
      : "general";

    // Distributed Redis rate limiting (if Redis is configured and ready)
    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      try {
        const ttlSec = Math.ceil(this.ttlMs / 1000);

        // 1. IP check
        const redisIpKey = `ratelimit:${purpose}:ip:${ip}`;
        const ipCount = await redis.incr(redisIpKey);
        if (ipCount === 1) await redis.expire(redisIpKey, ttlSec);
        if (ipCount > this.limit * 2) {
          throw new HttpException(
            "Too Many Requests - Rate limit exceeded for IP. Please retry later.",
            HttpStatus.TOO_MANY_REQUESTS
          );
        }

        // 2. Identifier check
        if (identifier) {
          const redisIdKey = `ratelimit:${purpose}:id:${identifier}`;
          const idCount = await redis.incr(redisIdKey);
          if (idCount === 1) await redis.expire(redisIdKey, ttlSec);
          if (idCount > this.limit) {
            throw new HttpException(
              "Too Many Requests - Rate limit exceeded for this account. Please retry later.",
              HttpStatus.TOO_MANY_REQUESTS
            );
          }
        }

        // 3. Composite check
        const redisCompKey = `ratelimit:${purpose}:${identifier || "anon"}:${ip}:${deviceId}`;
        const compCount = await redis.incr(redisCompKey);
        if (compCount === 1) await redis.expire(redisCompKey, ttlSec);
        if (compCount > this.limit) {
          throw new HttpException(
            "Too Many Requests - Rate limit exceeded. Please retry later.",
            HttpStatus.TOO_MANY_REQUESTS
          );
        }

        return true;
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
        // Fall back to process memory on Redis failure
      }
    }

    // In-memory fallback tracking
    // 1. Check IP-level rate limit
    const ipKey = `${purpose}:ip:${ip}`;
    const ipTimestamps = (RateLimiterGuard.ipRequests.get(ipKey) || []).filter(t => now - t < this.ttlMs);
    if (ipTimestamps.length >= this.limit * 2) {
      throw new HttpException(
        "Too Many Requests - Rate limit exceeded for IP. Please retry later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 2. Check identifier-level rate limit (prevents distributed IP attacks against same account)
    if (identifier) {
      const idKey = `${purpose}:id:${identifier}`;
      const idTimestamps = (RateLimiterGuard.identifierRequests.get(idKey) || []).filter(t => now - t < this.ttlMs);
      if (idTimestamps.length >= this.limit) {
        throw new HttpException(
          "Too Many Requests - Rate limit exceeded for this account. Please retry later.",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      idTimestamps.push(now);
      RateLimiterGuard.identifierRequests.set(idKey, idTimestamps);
    }

    // 3. Composite tracking
    const compKey = `${purpose}:${identifier || "anon"}:${ip}:${deviceId}`;
    const compTimestamps = (RateLimiterGuard.compositeRequests.get(compKey) || []).filter(t => now - t < this.ttlMs);
    if (compTimestamps.length >= this.limit) {
      throw new HttpException(
        "Too Many Requests - Rate limit exceeded. Please retry later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    ipTimestamps.push(now);
    RateLimiterGuard.ipRequests.set(ipKey, ipTimestamps);

    compTimestamps.push(now);
    RateLimiterGuard.compositeRequests.set(compKey, compTimestamps);

    return true;
  }
}
