import { Controller, Get, Put, Param, UseGuards } from "@nestjs/common";
import { ComplaintsService } from "./complaints.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("complaints")
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async getComplaints() {
    return this.complaintsService.getAllComplaints();
  }

  @Put(":id/resolve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async resolve(@Param("id") id: string) {
    return this.complaintsService.resolveComplaint(id);
  }
}
