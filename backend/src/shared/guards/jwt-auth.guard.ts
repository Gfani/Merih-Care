import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Optional } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly dataSource?: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException("Authorization header missing");
    }

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid token format");
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

      // Multi-role aggregation: user can have patient, provider, and admin accounts simultaneously
      const rolesSet = new Set<string>();
      if (user.role) rolesSet.add(user.role);
      if (user.roles) {
        user.roles.split(",").map((r) => r.trim()).filter(Boolean).forEach((r) => rolesSet.add(r));
      }
      rolesSet.add("patient"); // Every user has patient capability
      if (user.adminRole || user.role === "admin" || user.role === "super_admin") {
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
        role: user.role,
        roles: Array.from(rolesSet),
        adminRole: user.adminRole,
        permissions: user.permissions,
        status: user.status,
        provider: providerData,
      };
    } else {
      request.user = payload;
    }

    return true;
  }
}
