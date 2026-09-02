import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AvailabilityService } from "./availability.service";
import { AvailabilityController } from "./availability.controller";
import { AuthModule } from "../auth/auth.module";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { TimeOffEntity } from "../../database/entities/emergency-relation.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderEntity, AppointmentEntity, TimeOffEntity]),
    AuthModule,
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
