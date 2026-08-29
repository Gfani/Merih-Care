import { Controller, Get, Param, UseGuards, Res } from "@nestjs/common";
import { ProviderEarningsService } from "./earnings.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { Response } from "express";

@Controller("earnings")
@UseGuards(JwtAuthGuard)
export class ProviderEarningsController {
  constructor(private readonly providerEarningsService: ProviderEarningsService) {}

  @Get("export/:providerId")
  async exportEarnings(
    @Param("providerId") providerId: string,
    @Res() res: Response
  ) {
    const csvContent = await this.providerEarningsService.exportEarningsCsv(providerId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=earnings-${providerId}.csv`);
    return res.send(csvContent);
  }

  @Get(":providerId")
  async getEarnings(@Param("providerId") providerId: string) {
    return this.providerEarningsService.getEarnings(providerId);
  }
}
