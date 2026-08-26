import { Controller, Get, UseGuards } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";

@Controller("payouts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async getPayouts() {
    return this.payoutsService.getPayouts();
  }
}
