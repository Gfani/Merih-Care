import { Controller, Get, UseGuards } from "@nestjs/common";
import { ServiceRequestsService } from "./requests.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Get()
  async getServiceRequests() {
    return this.serviceRequestsService.getServiceRequests();
  }
}
