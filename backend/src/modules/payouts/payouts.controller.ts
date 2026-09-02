import { Controller, Get, Post, Body, Param, UseGuards, Req } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("payouts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "finance_admin")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async getPayouts() {
    return this.payoutsService.getPayouts();
  }

  @Post(":id/status")
  async updatePayoutStatus(
    @Param("id") id: string,
    @Body("status") status: string,
    @Body("transactionReference") transactionReference?: string,
  ) {
    return this.payoutsService.updatePayoutStatus(id, status, transactionReference);
  }

  @Get("batches")
  async getPayoutBatches() {
    return this.payoutsService.getPayoutBatches();
  }

  @Post("batches")
  async createBatchSettlement(@Req() req: any) {
    const actorId = req.user?.id || "admin";
    return this.payoutsService.createBatchSettlement(actorId);
  }
}
