import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { PaymentEventEntity, RefundEntity, CommissionRecordEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppointmentEntity, 
      PaymentEventEntity, 
      RefundEntity, 
      CommissionRecordEntity, 
      ProviderEarningsEntity
    ]),
    AuthModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
