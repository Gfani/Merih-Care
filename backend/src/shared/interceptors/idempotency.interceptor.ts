import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler, 
  ConflictException,
  BadRequestException
} from "@nestjs/common";
import { Observable, of, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";

interface CachedResponse {
  status: "processing" | "completed";
  body?: any;
  timestamp: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private cache = new Map<string, CachedResponse>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only apply idempotency to write operations
    if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
      return next.handle();
    }

    const key = request.headers["x-idempotency-key"] || request.headers["X-Idempotency-Key"];
    if (!key) {
      return next.handle();
    }

    if (Array.isArray(key)) {
      throw new BadRequestException("Multiple X-Idempotency-Key headers are not allowed.");
    }

    // Clean stale keys before lookup
    this.evictExpiredKeys();

    const cached = this.cache.get(key);
    if (cached) {
      if (cached.status === "processing") {
        throw new ConflictException(
          "A request with this idempotency key is already in progress. Please retry shortly."
        );
      }
      // Return cached body directly
      return of(cached.body);
    }

    // Register active key
    this.cache.set(key, {
      status: "processing",
      timestamp: Date.now(),
    });

    return next.handle().pipe(
      tap((result) => {
        // Cache successful response
        this.cache.set(key, {
          status: "completed",
          body: result,
          timestamp: Date.now(),
        });
      }),
      catchError((error) => {
        // Remove key on execution failure to allow subsequent retries
        this.cache.delete(key);
        return throwError(() => error);
      })
    );
  }

  private evictExpiredKeys() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}
