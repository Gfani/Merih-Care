import { Controller, Get, Put, Param, UseGuards, Query } from "@nestjs/common";
import { ProvidersService } from "./providers.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";

@Controller("providers")
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async getProviders(@Query() query: PaginationQueryDto) {
    return this.providersService.getAllProviders();
  }

  @Put(":id/suspend")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async suspendProvider(@Param("id") id: string) {
    return this.providersService.toggleProviderSuspension(id);
  }
}
