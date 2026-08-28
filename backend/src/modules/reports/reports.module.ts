import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { ReviewEntity } from "../../database/entities/review.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProviderEntity,
      AppointmentEntity,
      ReviewEntity
    ]),
    AuthModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
