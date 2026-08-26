import { Controller, Get, Put, Param, Body, UseGuards } from "@nestjs/common";
import { EmergencyService } from "./emergency.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, MaxLength } from "class-validator";

export class DispatchEmergencyDto {
  @IsNotEmpty()
  @MaxLength(100)
  responder: string;
}

@Controller("emergency")
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get()
  async getEmergencies() {
    return this.emergencyService.getAllEmergencies();
  }

  @Put(":id/dispatch")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async dispatch(@Param("id") id: string, @Body() body: DispatchEmergencyDto) {
    return this.emergencyService.dispatchEmergency(id, body.responder);
  }
}
