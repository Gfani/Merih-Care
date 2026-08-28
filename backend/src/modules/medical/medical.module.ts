import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MedicalRecordsService } from "./medical.service";
import { MedicalRecordsController } from "./medical.controller";
import { 
  MedicalRecordEntity, 
  PatientConsentEntity, 
  PrivacyPolicyAcceptanceEntity, 
  IncidentReportEntity 
} from "../../database/entities/medical.entity";
import { MedicalRecordAccessLogEntity } from "../../database/entities/logs-delivery.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecordEntity,
      PatientConsentEntity,
      PrivacyPolicyAcceptanceEntity,
      IncidentReportEntity,
      MedicalRecordAccessLogEntity,
    ]),
    AuthModule,
  ],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
