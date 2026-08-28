import { Controller, Get, Post, Param, UseGuards, Body, Req } from "@nestjs/common";
import { VerificationService } from "./verification.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RejectProviderDto {
  @ApiProperty({ description: "Rejection reason" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class RequestCorrectionsDto {
  @ApiProperty({ description: "Correction request comments/instructions" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  comments: string;
}

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
  async approve(@Param("id") id: string, @Req() req: any) {
    const actorId = req.user?.id || "u-admin";
    return this.verificationService.approveProvider(id, actorId);
  }

  @Post(":id/reject")
  async reject(
    @Param("id") id: string,
    @Body() body: RejectProviderDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "u-admin";
    return this.verificationService.rejectProvider(id, body.reason, actorId);
  }

  @Post(":id/request-corrections")
  async requestCorrections(
    @Param("id") id: string,
    @Body() body: RequestCorrectionsDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "u-admin";
    return this.verificationService.requestCorrections(id, body.comments, actorId);
  }
}
