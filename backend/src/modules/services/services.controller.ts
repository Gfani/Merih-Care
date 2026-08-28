import { Controller, Get, Put, Post, Param, Body, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, IsString, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateServiceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty()
  @IsNumber()
  priceFrom: number;
}

@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getServices() {
    return this.servicesService.getAllServices();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async create(@Body() body: CreateServiceDto) {
    return this.servicesService.createService(body);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async update(@Param("id") id: string, @Body() body: CreateServiceDto) {
    return this.servicesService.updateService(id, body);
  }

  @Put(":id/toggle")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async toggleService(@Param("id") id: string) {
    return this.servicesService.toggleServiceActive(id);
  }
}
