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

    // Super administrator has all privileges
    if (user.role === "super_admin" || user.adminRole === "super_admin") {
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
