import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { VerificationService } from "./verification.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("verification")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  async getVerifications() {
    return this.verificationService.getVerificationQueue();
  }

  @Post(":id/approve")
  async approve(@Param("id") id: string) {
    return this.verificationService.approveProvider(id);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string) {
    return this.verificationService.rejectProvider(id);
  }
}
