import { Controller, Get, Post, Put, UseGuards, Param, Query, Body, Req } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString, Matches, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAppointmentDto {
  @ApiProperty({ description: "Patient ID" })
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional({ description: "Patient Display Name" })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ description: "Patient Display Avatar" })
  @IsOptional()
  @IsString()
  patientAvatar?: string;

  @ApiPropertyOptional({ description: "Provider ID" })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ description: "Provider Name" })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ description: "Provider Avatar" })
  @IsOptional()
  @IsString()
  providerAvatar?: string;

  @ApiProperty({ description: "Service Category/ID" })
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @ApiPropertyOptional({ description: "Service Display Name" })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({ description: "Booking Date (YYYY-MM-DD)" })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ description: "Booking Time (HH:MM)" })
  @IsNotEmpty()
  @Matches(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Time must be in HH:MM format" })
  time: string;

  @ApiProperty({ description: "Visit Location Address" })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiPropertyOptional({ description: "Total Payment Amount" })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: "Initial Status override" })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ description: "Target lifecycle status" })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: "Visit summary/completion notes" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  visitNotes?: string;

  @ApiPropertyOptional({ description: "Dispute reason" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  disputeReason?: string;
}

export class CancelAppointmentDto {
  @ApiProperty({ description: "Cancellation reason description" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class RescheduleDto {
  @ApiProperty({ description: "New appointment date (YYYY-MM-DD)" })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ description: "New appointment time (HH:MM)" })
  @IsNotEmpty()
  @Matches(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Time must be in HH:MM format" })
  time: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ description: "Provider live arrival coordinates" })
  @IsOptional()
  coordinates?: { latitude: number; longitude: number };
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: "Clinical vitals summary" })
  @IsOptional()
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    bloodSugar?: string;
    clinicalNotes?: string;
  };

  @ApiPropertyOptional({ description: "Prescribed medications" })
  @IsOptional()
  prescriptions?: string[];
}

export class NoShowDto {
  @ApiProperty({ description: "No-show party" })
  @IsNotEmpty()
  @IsString()
  party: "patient" | "provider";

  @ApiPropertyOptional({ description: "Wait duration notes" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OverrideDto {
  @ApiProperty({ description: "Forced status override" })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({ description: "Override execution reasoning/notes" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  notes: string;
}

@Controller("appointments")
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async getAppointments(@Query() query: PaginationQueryDto) {
    return this.appointmentsService.getAllAppointments();
  }

  @Get(":appointmentId")
  @UseGuards(OwnershipGuard)
  async getAppointmentById(@Param("appointmentId") appointmentId: string) {
    return this.appointmentsService.getAppointmentById(appointmentId);
  }

  @Post()
  async createAppointment(@Body() body: CreateAppointmentDto) {
    return this.appointmentsService.createAppointment(body);
  }

  @Put(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateStatusDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "unknown";
    return this.appointmentsService.updateStatus(
      id,
      body.status,
      actorId,
      body.visitNotes,
      body.disputeReason
    );
  }

  @Post(":id/check-in")
  async checkIn(
    @Param("id") id: string,
    @Body() body: CheckInDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "provider";
    return this.appointmentsService.checkInProvider(id, actorId, body.coordinates);
  }

  @Post(":id/check-out")
  async checkOut(
    @Param("id") id: string,
    @Body() body: CheckOutDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "provider";
    return this.appointmentsService.checkOutProvider(id, actorId, body.vitals, body.prescriptions);
  }

  @Post(":id/no-show")
  async markNoShow(
    @Param("id") id: string,
    @Body() body: NoShowDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "unknown";
    return this.appointmentsService.markNoShow(id, body.party, actorId, body.notes);
  }

  @Post(":id/cancel")
  async cancelAppointment(
    @Param("id") id: string,
    @Body() body: CancelAppointmentDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "unknown";
    return this.appointmentsService.cancelAppointment(id, body?.reason || "Cancelled by user", actorId);
  }

  @Put(":id/cancel")
  async cancelAppointmentPut(
    @Param("id") id: string,
    @Body() body: CancelAppointmentDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "unknown";
    return this.appointmentsService.cancelAppointment(id, body?.reason || "Cancelled by user", actorId);
  }

  @Post(":id/assign")
  async assignProvider(
    @Param("id") id: string,
    @Body() body: { providerId: string; providerName: string },
    @Req() req: any
  ) {
    const actorId = req.user?.id || "admin";
    return this.appointmentsService.assignProvider(id, body.providerId, body.providerName, actorId);
  }

  @Post(":id/reschedule")
  async rescheduleAppointment(
    @Param("id") id: string,
    @Body() body: RescheduleDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "unknown";
    return this.appointmentsService.rescheduleAppointment(id, body.date, body.time, actorId);
  }

  @Post(":id/override")
  async adminOverride(
    @Param("id") id: string,
    @Body() body: OverrideDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || "admin";
    return this.appointmentsService.adminOverride(id, body.status, body.notes, actorId);
  }

  @Post("sweeper/expire")
  async expireRequests() {
    const count = await this.appointmentsService.expirePendingRequests();
    return { expiredCount: count };
  }
}
