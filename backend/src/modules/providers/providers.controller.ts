import { Controller, Get, Post, Put, Param, Body, UseGuards, Query } from "@nestjs/common";
import { ProvidersService } from "./providers.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";

@Controller("providers")
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async getProviders(
    @Query() query: PaginationQueryDto,
    @Query("lat") lat?: string,
    @Query("lon") lon?: string,
    @Query("fuzz") fuzz?: string
  ) {
    const limit = query?.limit ? Number(query.limit) : 50;
    const page = query?.page ? Number(query.page) : 1;
    const offset = (page - 1) * limit;
    const fuzzLocation = fuzz === "false" ? false : true;
    const userLat = lat ? parseFloat(lat) : undefined;
    const userLon = lon ? parseFloat(lon) : undefined;

    return this.providersService.getAllProviders(fuzzLocation, limit, offset, userLat, userLon);
  }

  @Get(":id")
  async getProviderById(@Param("id") id: string) {
    return this.providersService.getProviderById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  async createProvider(@Body() body: any) {
    return this.providersService.createProvider(body);
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles("admin", "provider")
  async updateProvider(@Param("id") id: string, @Body() body: any) {
    return this.providersService.updateProvider(id, body);
  }

  @Put(":id/suspend")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async suspendProvider(@Param("id") id: string) {
    return this.providersService.toggleProviderSuspension(id);
  }
}
