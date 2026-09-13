import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private static compositeRequests: Map<string, number[]> = new Map();
  private static identifierRequests: Map<string, number[]> = new Map();
  private static ipRequests: Map<string, number[]> = new Map();

  private readonly limit: number = 5;
  private readonly ttlMs: number = 60000; // 1 minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();

    const ip = (request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress || "unknown").toString();
    const deviceId = (request.headers["x-device-id"] || request.headers["user-agent"] || "unknown").toString().slice(0, 32);
    const body = request.body || {};
    const identifier = (body.identifier || body.email || body.phone || request.user?.id || "").toString().toLowerCase().trim();
    const path = request.path || request.url || "auth";
    const purpose = path.includes("password-reset")
      ? "pwd-reset"
      : path.includes("email-verification")
      ? "email-verify"
      : path.includes("mfa")
      ? "mfa"
      : "general";

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
