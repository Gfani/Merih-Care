import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

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

    if (user.role === "admin" && user.adminRole === "super_admin") {
      return true;
    }

    const userPerms: string[] = typeof user.permissions === "string" 
      ? user.permissions.split(",").map(p => p.trim())
      : (Array.isArray(user.permissions) ? user.permissions : []);

    const hasPermission = requiredPermissions.every(perm => userPerms.includes(perm));
    if (!hasPermission) {
      throw new ForbiddenException("Insufficient permissions for this administrative endpoint");
    }
    return true;
  }
}
