import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { MedicalRecordsService } from "./medical.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";

@Controller("medical-records")
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Get(":patientId")
  async getRecords(@Param("patientId") patientId: string) {
    return this.medicalRecordsService.getRecords(patientId);
  }
}
