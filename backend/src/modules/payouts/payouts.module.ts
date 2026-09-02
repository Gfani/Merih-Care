import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PayoutsService } from "./payouts.service";
import { PayoutsController } from "./payouts.controller";
import { PayoutEntity, ProviderEarningsEntity, PayoutBatchEntity } from "../../database/entities/financial.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutEntity, ProviderEarningsEntity, PayoutBatchEntity]),
    AuthModule
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
