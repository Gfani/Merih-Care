import { Controller, Get, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("stats")
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }
}
