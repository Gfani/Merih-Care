import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationEntity, NotificationPreferenceEntity } from "../../database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../../database/entities/logs-delivery.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferenceEntity,
      NotificationDeliveryAttemptEntity,
    ]),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
