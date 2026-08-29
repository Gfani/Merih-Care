import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true; // Auth guard handles authentication

    // Super Admin and Admin bypass ownership checks
    if (user.role === "super_admin" || user.role === "admin" || user.role === "finance_admin" || user.role === "verifier") {
      return true;
    }

    const resourceUserId = request.params?.userId || request.params?.patientId || request.params?.providerId || request.body?.userId;
    if (resourceUserId && resourceUserId !== user.id) {
      throw new ForbiddenException("Access Denied: You do not possess ownership of this resource.");
    }

    return true;
  }
}
