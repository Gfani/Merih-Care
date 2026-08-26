import { Module } from "@nestjs/common";
import { MedicalRecordsService } from "./medical.service";
import { MedicalRecordsController } from "./medical.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
