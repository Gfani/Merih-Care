import { Controller, Get, Put, Param, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getServices() {
    return this.servicesService.getAllServices();
  }

  @Put(":id/toggle")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async toggleService(@Param("id") id: string) {
    return this.servicesService.toggleServiceActive(id);
  }
}
