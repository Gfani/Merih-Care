import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity } from "../../database/entities/appointment-history.entity";
import { CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppointmentEntity, 
      AppointmentStatusHistoryEntity, 
      CancellationReasonEntity
    ]),
    AuthModule,
    RealtimeModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
