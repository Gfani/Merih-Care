import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Insufficient platform role permissions");
    }

    const isSuperAdminEmail =
      user.email === "fanuelgoitom79@gmail.com" ||
      user.email === "fani@g.com" ||
      user.email === "admin@merihcare.et";

    const isAnyAdmin =
      isSuperAdminEmail ||
      user.role === "admin" ||
      user.role === "super_admin" ||
      !!user.adminRole ||
      (typeof user.role === "string" && user.role.includes("admin"));

    // If endpoint requires admin role (or any admin variant) and caller is any admin, grant access
    const requiresAdmin = requiredRoles.some((r) => r.includes("admin") || r === "verifier");
    if (isAnyAdmin && requiresAdmin) {
      return true;
    }

    if (requiredRoles.includes(user.role) || (user.adminRole && requiredRoles.includes(user.adminRole))) {
      return true;
    }

    throw new ForbiddenException("Insufficient platform role permissions");
  }
}
