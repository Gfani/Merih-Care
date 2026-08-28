import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProviderEarningsService } from "./earnings.service";
import { ProviderEarningsController } from "./earnings.controller";
import { ProviderEarningsEntity, PayoutEntity } from "../../database/entities/financial.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderEarningsEntity, PayoutEntity]),
    AuthModule
  ],
  controllers: [ProviderEarningsController],
  providers: [ProviderEarningsService],
  exports: [ProviderEarningsService],
})
export class ProviderEarningsModule {}
