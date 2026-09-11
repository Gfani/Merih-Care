import { Controller, Get, Put, Delete, Body, Param, UseGuards, Query, Req, ForbiddenException, Optional } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";
import { IsNotEmpty, IsIn } from "class-validator";
import { RealtimeService } from "../realtime/realtime.service";

export class UpdateUserRoleDto {
  @IsNotEmpty()
  @IsIn(["patient", "provider", "admin", "super_admin", "finance_admin", "verifier"])
  role: string;
}

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "super_admin")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  @Get()
  async getUsers(@Query() query: any) {
    return this.usersService.getAllUsers(query?.role || "all");
  }

  @Put(":id/suspend")
  async suspendUser(@Param("id") id: string) {
    const res = await this.usersService.toggleUserSuspension(id);
    if (this.realtimeService) {
      this.realtimeService.emitUserStatusChanged(id, (res as any)?.status || "suspended");
    }
    return res;
  }

  @Put(":id/reactivate")
  async reactivateUser(@Param("id") id: string) {
    const res = await this.usersService.reactivateUser(id);
    if (this.realtimeService) {
      this.realtimeService.emitUserStatusChanged(id, "active");
    }
    return res;
  }

  @Put(":id/role")
  async updateUserRole(@Param("id") id: string, @Body() body: UpdateUserRoleDto) {
    return this.usersService.updateUserRole(id, body.role);
  }

  @Delete(":id")
  async deleteUser(@Param("id") id: string, @Req() req: any) {
    const actorId = req.user?.id || req.user?.sub;
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin" && !req.user?.adminRole) {
      throw new ForbiddenException("Only administrators can remove members");
    }
    if (actorId === id) {
      throw new ForbiddenException("Administrators cannot delete their own account");
    }
    const result = await this.usersService.deleteUser(id);
    if (this.realtimeService) {
      this.realtimeService.emitUserRemoved(id);
    }
    return result;
  }
}
