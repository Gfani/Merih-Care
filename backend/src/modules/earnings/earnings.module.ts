import { Module } from "@nestjs/common";
import { ProviderEarningsService } from "./earnings.service";
import { ProviderEarningsController } from "./earnings.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ProviderEarningsController],
  providers: [ProviderEarningsService],
  exports: [ProviderEarningsService],
})
export class ProviderEarningsModule {}
