import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getEffectivePermissions } from "../constants/permissions";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>("permissions", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Missing authentication context");
    }

    const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();
    const isOwner =
      user.role === "owner" ||
      user.adminRole === "owner" ||
      (user.email && user.email.toLowerCase().trim() === ownerEmail);

    // Supreme Owner & Super administrator have all privileges
    if (isOwner || user.role === "super_admin" || user.adminRole === "super_admin" || user.permissions === "all") {
      return true;
    }

    const userPerms = getEffectivePermissions(user);
    const hasPermission = requiredPermissions.every(perm => userPerms.includes(perm));
    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions: operation requires [${requiredPermissions.join(", ")}], but account has [${userPerms.join(", ")}]`
      );
    }
    return true;
  }
}
