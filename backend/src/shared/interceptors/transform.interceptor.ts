import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Request } from "express";

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  correlationId: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T> | T> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers["x-correlation-id"] as string) || request["id"] || `corr-${Date.now()}`;

    // If swagger spec, health check, or upload streaming endpoints, do not envelope
    if (
      request.url?.includes("/api/docs") ||
      request.url?.includes("/swagger") ||
      request.url?.includes("/health") ||
      request.url?.includes("/uploads/view") ||
      request.url?.includes("/uploads/download") ||
      request.url?.includes("/uploads/raw")
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If already enveloped or streaming/buffer, return as-is
        if (data && typeof data === "object" && "success" in data && "data" in data) {
          return data;
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          correlationId,
        };
      })
    );
  }
}
