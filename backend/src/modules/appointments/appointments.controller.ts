import { Controller, Get, UseGuards, Param, Query } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";
import { PaginationQueryDto } from "../../shared/dtos/pagination-query.dto";

@Controller("appointments")
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async getAppointments(@Query() query: PaginationQueryDto) {
    return this.appointmentsService.getAllAppointments();
  }

  @Get(":appointmentId")
  async getAppointmentById(@Param("appointmentId") appointmentId: string) {
    return appointmentId;
  }
}
