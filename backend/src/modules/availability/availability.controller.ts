import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";

@Controller("availability")
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(":providerId")
  async getAvailability(@Param("providerId") providerId: string) {
    return this.availabilityService.getAvailability(providerId);
  }
}
