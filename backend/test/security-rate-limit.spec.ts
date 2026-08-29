import { HttpException, HttpStatus } from "@nestjs/common";

class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly limit: number;
  private readonly ttlMs: number;

  constructor(limit = 5, ttlMs = 60000) {
    this.limit = limit;
    this.ttlMs = ttlMs;
  }

  public checkLimit(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];

    // Filter out expired timestamps
    const activeTimestamps = timestamps.filter((t) => now - t < this.ttlMs);

    if (activeTimestamps.length >= this.limit) {
      throw new HttpException(
        "Too Many Requests - Rate limit exceeded. Please retry later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    activeTimestamps.push(now);
    this.requests.set(ip, activeTimestamps);
    return true;
  }

  public getRemaining(ip: string): number {
    const now = Date.now();
    const timestamps = (this.requests.get(ip) || []).filter((t) => now - t < this.ttlMs);
    return Math.max(0, this.limit - timestamps.length);
  }
}

describe("Security - API Rate Limiting & Throttling Tests", () => {
  let rateLimiter: InMemoryRateLimiter;

  beforeEach(() => {
    rateLimiter = new InMemoryRateLimiter(5, 60000);
  });

  it("should permit requests within rate limit thresholds", () => {
    const clientIp = "10.0.0.1";

    for (let i = 0; i < 5; i++) {
      const allowed = rateLimiter.checkLimit(clientIp);
      expect(allowed).toBe(true);
    }

    expect(rateLimiter.getRemaining(clientIp)).toBe(0);
  });

  it("should trigger HTTP 429 Too Many Requests when burst limit is exceeded", () => {
    const clientIp = "10.0.0.2";

    // Consume all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(clientIp);
    }

    // 6th attempt must throw 429
    expect(() => rateLimiter.checkLimit(clientIp)).toThrow(HttpException);

    try {
      rateLimiter.checkLimit(clientIp);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain("Too Many Requests");
    }
  });

  it("should track rate limits independently across different client IPs", () => {
    const ip1 = "192.168.1.10";
    const ip2 = "192.168.1.20";

    // Exhaust limit for IP 1
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(ip1);
    }
    expect(() => rateLimiter.checkLimit(ip1)).toThrow(HttpException);

    // IP 2 should still be unblocked and have full limit
    expect(rateLimiter.getRemaining(ip2)).toBe(5);
    expect(rateLimiter.checkLimit(ip2)).toBe(true);
  });
});
