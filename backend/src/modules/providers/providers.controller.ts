import { Controller, Get, Post, Put, Param, Body, UseGuards, Query, Req } from "@nestjs/common";
import { ProvidersService } from "./providers.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";
import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class ContactProviderDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  priority?: "normal" | "urgent";
}

export class ProviderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  verified?: string;

  @IsOptional()
  @IsString()
  lat?: string;

  @IsOptional()
  @IsString()
  lon?: string;

  @IsOptional()
  @IsString()
  fuzz?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  specialty?: string;
}

@Controller("providers")
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async getProviders(@Query() query: ProviderQueryDto) {
    const limit = query?.limit ? Number(query.limit) : 50;
    const page = query?.page ? Number(query.page) : 1;
    const offset = (page - 1) * limit;
    const fuzzLocation = query?.fuzz === "false" ? false : true;
    const userLat = query?.lat ? parseFloat(query.lat) : undefined;
    const userLon = query?.lon ? parseFloat(query.lon) : undefined;

    return this.providersService.getAllProviders(
      fuzzLocation,
      limit,
      offset,
      userLat,
      userLon,
      query?.verified,
      query?.search,
      query?.specialty
    );
  }

  @Get("me")
  @UseGuards(RolesGuard)
  @Roles("admin", "provider")
  async getMyProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const provider = await this.providersService.getProviderByUserId(userId);
    if (!provider) {
      return {
        id: `prov-${userId}`,
        userId: userId,
        name: req.user?.name || "Healthcare Provider",
        title: "Healthcare Specialist",
        available: true,
        pricePerVisit: 800,
        rating: 5.0,
        reviewCount: 0,
        experience: 0,
        verified: false,
        services: ["Doctor Visit", "Home Nursing"],
      };
    }
    return provider;
  }

  @Put("me")
  @UseGuards(RolesGuard)
  @Roles("admin", "provider")
  async updateMyProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.providersService.updateProviderByUserId(userId, body);
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

  @Post(":id/contact")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async contactProvider(
    @Param("id") id: string,
    @Body() body: ContactProviderDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || req.user?.sub || "admin";
    return this.providersService.contactProvider(id, actorId, body.title, body.message, body.priority);
  }
}
