import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import { UserEntity } from "../../database/entities/user.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AppointmentEntity, SessionEntity]),
    AuthModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ScheduledTasksService],
  exports: [AdminService, ScheduledTasksService],
})
export class AdminModule {}
