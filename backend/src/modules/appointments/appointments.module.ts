import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { DispatchCascadeService } from "./dispatch-cascade.service";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity } from "../../database/entities/appointment-history.entity";
import { CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatModule } from "../chat/chat.module";

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
    forwardRef(() => ChatModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, DispatchCascadeService],
  exports: [AppointmentsService, DispatchCascadeService],
})
export class AppointmentsModule {}
