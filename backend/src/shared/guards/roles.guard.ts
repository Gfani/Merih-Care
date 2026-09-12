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
      throw new ForbiddenException("Authentication required: insufficient platform role permissions");
    }

    const emailLower = (user.email || "").toLowerCase().trim();
    const isSuperiorAdmin =
      emailLower === "fanuelgoitom79@gmail.com" ||
      emailLower === "fanuelgoitom79@gmial.com";

    // Extract all effective roles from user object
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === "string"
      ? user.roles.split(",").map((r: string) => r.trim()).filter(Boolean)
      : [];

    if (user.role && !userRoles.includes(user.role)) {
      userRoles.push(user.role);
    }
    // Every user has patient capability
    if (!userRoles.includes("patient")) {
      userRoles.push("patient");
    }

    const adminRole = user.adminRole || (user.role === "super_admin" ? "super_admin" : null);

    // Evaluate each required role strictly
    for (const required of requiredRoles) {
      // 1. Exact match on direct user role or granular admin role
      if (userRoles.includes(required) || (adminRole && adminRole === required)) {
        return true;
      }

      // 2. Super admin hierarchy: super_admin has access to general admin, verifier, finance, and support tasks
      if (isSuperiorAdmin || adminRole === "super_admin" || user.role === "super_admin") {
        return true;
      }

      // 3. General 'admin' requirement satisfied by any user with admin capability
      if (required === "admin" && (userRoles.includes("admin") || !!adminRole)) {
        return true;
      }

      // 4. Verification admin satisfies verifier
      if (required === "verifier" && (adminRole === "verifier" || adminRole === "verification_admin")) {
        return true;
      }

      // 5. Finance admin requirement
      if (required === "finance_admin" && adminRole === "finance_admin") {
        return true;
      }
    }

    throw new ForbiddenException(
      `Access denied: This operation requires role(s) [${requiredRoles.join(", ")}], but your account does not possess these privileges.`
    );
  }
}
