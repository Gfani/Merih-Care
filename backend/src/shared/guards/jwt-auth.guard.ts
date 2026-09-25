import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Optional } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { parseCookieString } from "../utils/cookie.util";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly dataSource?: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let token: string | undefined;

    // 1. Check HttpOnly cookies first (HIPAA compliance for web clients)
    if (request.cookies) {
      token = request.cookies.admin_token || request.cookies.token;
    } else if (request.headers?.cookie) {
      const parsed = parseCookieString(request.headers.cookie);
      token = parsed.admin_token || parsed.token;
    }

    // 2. Fallback to Authorization: Bearer header (Mobile Flutter app, automated test suites)
    const authHeader = request.headers?.authorization;
    if (!token && authHeader) {
      const [type, bearerToken] = authHeader.split(" ");
      if (type === "Bearer" && bearerToken) {
        token = bearerToken;
      } else {
        throw new UnauthorizedException("Invalid token format");
      }
    }

    if (!token) {
      throw new UnauthorizedException("Authorization header or cookie missing");
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    // Verify real-time database state for immediate removal & suspension enforcement
    if (this.dataSource && this.dataSource.isInitialized && payload?.sub) {
      const userRepo = this.dataSource.getRepository(UserEntity);
      const user = await userRepo.findOne({ where: { id: payload.sub } });

      if (!user) {
        throw new UnauthorizedException("Your account has been removed. Access denied.");
      }

      if (user.status === "suspended") {
        throw new UnauthorizedException("Your account has been suspended by administration. Please contact support.");
      }

      // Fail-closed tokenVersion check: tokens without a tokenVersion or with mismatched version are rejected
      const userVersion = user.tokenVersion ?? 0;
      if (
        payload.tokenVersion === undefined ||
        payload.tokenVersion !== userVersion
      ) {
        throw new UnauthorizedException("Session has been revoked or expired. Please log in again.");
      }

      // Multi-role aggregation: user can have patient, provider, and admin accounts simultaneously
      const rolesSet = new Set<string>();
      if (user.role) rolesSet.add(user.role);
      if (user.roles) {
        user.roles.split(",").map((r) => r.trim()).filter(Boolean).forEach((r) => rolesSet.add(r));
      }
      rolesSet.add("patient"); // Every user has patient capability
      const ownerEmail = (process.env.OWNER_EMAIL || "fanuelgoitom79@gmail.com").toLowerCase().trim();
      const userEmail = (user.email || "").toLowerCase().trim();
      const isOwner =
        user.role === "owner" ||
        user.adminRole === "owner" ||
        userEmail === "fanuelgoitom79@gmail.com" ||
        (ownerEmail && userEmail === ownerEmail);
      if (isOwner) {
        rolesSet.add("owner");
        rolesSet.add("super_admin");
        rolesSet.add("admin");
      }
      if (user.adminRole || user.role === "admin" || user.role === "super_admin" || isOwner) {
        rolesSet.add("admin");
        if (user.adminRole) rolesSet.add(user.adminRole);
      }

      let providerData: ProviderEntity | null = null;
      try {
        const provRepo = this.dataSource.getRepository(ProviderEntity);
        providerData = await provRepo.findOne({ where: { userId: user.id } });
        if (providerData) {
          rolesSet.add("provider");
        }
      } catch {}

      request.user = {
        ...payload,
        id: user.id,
        email: user.email,
        name: user.name,
        role: isOwner ? (user.role === "owner" ? "owner" : (payload.role || "owner")) : user.role,
        roles: Array.from(rolesSet),
        adminRole: isOwner ? (user.adminRole || "owner") : user.adminRole,
        permissions: isOwner ? "all" : user.permissions,
        status: user.status,
        mfaEnabled: !!user.mfaEnabled,
        provider: providerData,
      };
    } else {
      request.user = payload;
    }

    return true;
  }
}
