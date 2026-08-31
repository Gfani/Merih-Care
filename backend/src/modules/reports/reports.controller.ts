import { Controller, Get, Query, UseGuards, Res } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { Response } from "express";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("stats")
  async getDashboardStats(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("service") service?: string
  ) {
    return this.reportsService.getDashboardStats({ startDate, endDate, service });
  }

  @Get("export")
  async exportOperationalReport(
    @Res() res: Response,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("service") service?: string
  ) {
    const csvContent = await this.reportsService.exportOperationalReport({ startDate, endDate, service });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=merihcare-operational-report-${Date.now()}.csv`);
    return res.send(csvContent);
  }
}
