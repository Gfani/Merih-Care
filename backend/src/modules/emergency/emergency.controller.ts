import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from "@nestjs/common";
import { EmergencyService } from "./emergency.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, MaxLength, IsOptional, IsIn, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateEmergencyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ enum: ["critical", "moderate", "minor"] })
  @IsNotEmpty()
  @IsIn(["critical", "moderate", "minor"])
  type: "critical" | "moderate" | "minor";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;
}

export class DispatchEmergencyDto {
  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  responder: string;
}

export class ReassignResponderDto {
  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  newResponder: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class ResolveEmergencyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(2000)
  clinicalSummary?: string;
}

export class EscalateEmergencyDto {
  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

@Controller("emergency")
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get()
  async getEmergencies() {
    return this.emergencyService.getAllEmergencies();
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  async createEmergency(@Body() body: CreateEmergencyDto, @Req() req: any) {
    const userId = req.user?.id || "anonymous";
    return this.emergencyService.createEmergency(
      userId,
      body.location,
      body.phone,
      body.type,
      body.patientName,
      body.emergencyContact
    );
  }

  @Put(":id/dispatch")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "provider")
  async dispatch(@Param("id") id: string, @Body() body: DispatchEmergencyDto) {
    return this.emergencyService.dispatchEmergency(id, body.responder);
  }

  @Put(":id/reassign")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async reassign(@Param("id") id: string, @Body() body: ReassignResponderDto, @Req() req: any) {
    const actorId = req.user?.id || "admin";
    return this.emergencyService.reassignResponder(id, body.newResponder, actorId, body.reason);
  }

  @Put(":id/arrive")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "provider")
  async markArrived(@Param("id") id: string, @Req() req: any) {
    const actorId = req.user?.id || "provider";
    return this.emergencyService.markResponderArrived(id, actorId);
  }

  @Put(":id/resolve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "provider")
  async resolve(@Param("id") id: string, @Body() body: ResolveEmergencyDto, @Req() req: any) {
    const actorId = req.user?.id || "responder";
    return this.emergencyService.resolveEmergency(id, actorId, body.clinicalSummary);
  }

  @Put(":id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("provider")
  async reject(@Param("id") id: string, @Body("reason") reason: string, @Req() req: any) {
    const providerId = req.user?.id || "provider";
    return this.emergencyService.rejectEmergency(id, providerId, reason);
  }

  @Post(":id/escalate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async escalate(@Param("id") id: string, @Body() body: EscalateEmergencyDto, @Req() req: any) {
    const actorId = req.user?.id || "admin";
    return this.emergencyService.escalateEmergency(id, actorId, body.reason);
  }
}
