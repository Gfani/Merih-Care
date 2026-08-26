import { Controller, Get, Put, Param, UseGuards, Query } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers(@Query() query: PaginationQueryDto) {
    return this.usersService.getAllUsers();
  }

  @Put(":id/suspend")
  async suspendUser(@Param("id") id: string) {
    return this.usersService.toggleUserSuspension(id);
  }
}
