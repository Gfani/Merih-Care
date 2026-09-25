import { Controller, Get, Query, UseGuards, Res, Req } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { Response } from "express";

@Controller(["dashboard", "reports"])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(["stats", "overview"])
  async getDashboardStats(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("service") service?: string
  ) {
    const stats = await this.reportsService.getDashboardStats({ startDate, endDate, service });
    const user = req?.user;
    const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();
    const isOwner =
      user?.role === "owner" ||
      user?.adminRole === "owner" ||
      (user?.email && user.email.toLowerCase().trim() === ownerEmail);
    const isSuperOrOwner = isOwner || user?.role === "super_admin" || user?.adminRole === "super_admin";

    // Revenue data must be strictly hidden from normal administrators and only visible to super_admin or owner roles
    if (!isSuperOrOwner && stats) {
      if (stats.kpis) {
        stats.kpis.totalRevenue = 0;
      }
      stats.revenueData = [];
    }

    return stats;
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
