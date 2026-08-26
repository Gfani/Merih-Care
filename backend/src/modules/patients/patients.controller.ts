import { Controller, Get, UseGuards, Param } from "@nestjs/common";
import { PatientsService } from "./patients.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";

@Controller("patients")
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  async getPatients() {
    return this.patientsService.findPatients();
  }

  @Get(":id")
  async getPatientById(@Param("id") id: string) {
    return id;
  }
}
