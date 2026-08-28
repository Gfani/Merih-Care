import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VerificationService } from "./verification.service";
import { VerificationController } from "./verification.controller";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity } from "../../database/entities/verification.entity";
import { VerificationHistoryEntity } from "../../database/entities/verification.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderEntity, 
      VerificationReviewEntity, 
      VerificationHistoryEntity
    ]),
    AuthModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
