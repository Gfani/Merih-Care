import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";

@Controller("availability")
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(":providerId")
  async getAvailability(
    @Param("providerId") providerId: string,
    @Query("date") date?: string,
  ) {
    return this.availabilityService.getAvailability(providerId, date);
  }
}
