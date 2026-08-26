import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ProviderEarningsService } from "./earnings.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";

@Controller("earnings")
@UseGuards(JwtAuthGuard)
export class ProviderEarningsController {
  constructor(private readonly providerEarningsService: ProviderEarningsService) {}

  @Get(":providerId")
  async getEarnings(@Param("providerId") providerId: string) {
    return this.providerEarningsService.getEarnings(providerId);
  }
}
