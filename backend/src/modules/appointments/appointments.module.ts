import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity } from "../../database/entities/appointment-history.entity";
import { CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppointmentEntity, 
      AppointmentStatusHistoryEntity, 
      CancellationReasonEntity
    ]),
    AuthModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
