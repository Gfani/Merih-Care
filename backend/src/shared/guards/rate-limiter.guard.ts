import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private static requests: Map<string, number[]> = new Map();
  private readonly limit: number = 5;
  private readonly ttlMs: number = 60000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const timestamps = RateLimiterGuard.requests.get(ip) || [];

    const activeTimestamps = timestamps.filter((t) => now - t < this.ttlMs);

    if (activeTimestamps.length >= this.limit) {
      throw new HttpException(
        "Too Many Requests - Rate limit exceeded. Please retry later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    activeTimestamps.push(now);
    RateLimiterGuard.requests.set(ip, activeTimestamps);
    return true;
  }
}
