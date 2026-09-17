import { Controller, Get, Put, Param, Query, Body, Req, UseGuards } from "@nestjs/common";
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

  @Put(":providerId/slots")
  async updateSlotForProvider(
    @Param("providerId") providerId: string,
    @Body() body: { slotId?: string; time?: string; date?: string; available: boolean }
  ) {
    return this.availabilityService.updateSlotAvailability(providerId, body);
  }

  @Put("slots")
  async updateSlotForSelf(
    @Req() req: any,
    @Body() body: { slotId?: string; time?: string; date?: string; available: boolean }
  ) {
    const providerId = req.user?.sub || req.user?.id || req.user?.providerId;
    return this.availabilityService.updateSlotAvailability(providerId, body);
  }
}
