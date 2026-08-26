import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNotEmpty, MaxLength, Length } from "class-validator";

export class SendNotificationDto {
  @IsNotEmpty()
  @Length(4, 50)
  userId: string;

  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("send")
  async send(@Body() body: SendNotificationDto) {
    return this.notificationsService.sendNotification(body.userId, body.title, body.body);
  }
}
