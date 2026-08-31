import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from "@nestjs/common";
import { ComplaintsService } from "./complaints.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, IsString, MaxLength, IsIn, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateComplaintDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  @IsNotEmpty()
  @IsIn(["low", "medium", "high", "critical"])
  priority: "low" | "medium" | "high" | "critical";

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(3000)
  description: string;
}

export class AssignComplaintDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  investigatorId: string;
}

export class RespondComplaintDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  response: string;

  @ApiProperty({ required: false, enum: ["investigating", "resolved"] })
  @IsOptional()
  @IsIn(["investigating", "resolved"])
  status?: "investigating" | "resolved";
}

export class EscalateComplaintDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

@Controller("complaints")
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async getComplaints() {
    return this.complaintsService.getAllComplaints();
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  async createComplaint(@Body() body: CreateComplaintDto, @Req() req: any) {
    const userId = req.user?.id || "user-1";
    const userName = req.user?.name || "Anonymous";
    const role = req.user?.role || "patient";
    return this.complaintsService.createComplaint(
      userId,
      userName,
      role,
      body.subject,
      body.priority,
      body.description
    );
  }

  @Put(":id/assign")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async assignInvestigator(
    @Param("id") id: string,
    @Body() body: AssignComplaintDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "admin";
    return this.complaintsService.assignInvestigator(id, body.investigatorId, actorId);
  }

  @Post(":id/respond")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async respondToComplaint(
    @Param("id") id: string,
    @Body() body: RespondComplaintDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "admin";
    return this.complaintsService.respondToComplaint(id, body.response, body.status || "resolved", actorId);
  }

  @Post(":id/escalate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async escalateComplaint(
    @Param("id") id: string,
    @Body() body: EscalateComplaintDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "admin";
    return this.complaintsService.escalateComplaint(id, body.reason, actorId);
  }

  @Put(":id/resolve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async resolve(@Param("id") id: string) {
    return this.complaintsService.resolveComplaint(id);
  }
}
