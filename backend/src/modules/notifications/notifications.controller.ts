import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Req
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNotEmpty, IsString, MaxLength, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendNotificationDto {
  @ApiProperty()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}

export class UpdatePreferencesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  appointmentReminders?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chatMessages?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  paymentUpdates?: boolean;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query("page") page: string,
    @Query("limit") limit: string,
  ) {
    return this.notificationsService.getUserNotifications(
      req.user?.id,
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  @Get("unread-count")
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user?.id);
    return { unread: count };
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string, @Req() req: any) {
    await this.notificationsService.markRead(req.user?.id, id);
    return { success: true };
  }

  @Patch("read-all")
  async markAllRead(@Req() req: any) {
    await this.notificationsService.markAllRead(req.user?.id);
    return { success: true };
  }

  @Get("preferences")
  async getPreferences(@Req() req: any) {
    return this.notificationsService.getPreferences(req.user?.id);
  }

  @Put("preferences")
  async updatePreferences(@Body() body: UpdatePreferencesDto, @Req() req: any) {
    return this.notificationsService.updatePreferences(req.user?.id, body);
  }

  @Post("device-token")
  async registerPushToken(
    @Body() body: { token: string; platform?: string },
    @Req() req: any
  ) {
    return this.notificationsService.registerDeviceToken(req.user?.id, body.token, body.platform);
  }

  @Post("register-device")
  async registerDeviceAlias(
    @Body() body: { token: string; platform?: string },
    @Req() req: any
  ) {
    return this.notificationsService.registerDeviceToken(req.user?.id, body.token, body.platform);
  }

  @Delete("device-token")
  async unregisterPushToken(@Req() req: any) {
    return this.notificationsService.unregisterDeviceToken(req.user?.id);
  }

  @Post("schedule")
  async scheduleNotification(
    @Body() body: { scheduledFor: string; type: any; title: string; body: string; data?: any },
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.notificationsService.scheduleNotification(
      userId,
      new Date(body.scheduledFor),
      {
        type: body.type,
        title: body.title,
        body: body.body,
        data: body.data,
      }
    );
  }

  @Get("delivery-logs")
  async getDeliveryLogs() {
    return this.notificationsService.getDeliveryLogs();
  }

  // Admin send endpoint (legacy)
  @Post("send")
  async send(@Body() body: SendNotificationDto) {
    return this.notificationsService.sendNotificationLegacy(body.userId, body.title, body.body);
  }

  // Quick SMS Dispatch / Test Endpoint
  @Post("test-sms")
  async testSms(@Body() body: { phone: string; message?: string }) {
    const msg = body.message || "Your MerihCare verification code is 849201. Valid for 5 minutes.";
    const success = await this.notificationsService.sendSmsDirect(body.phone, msg);
    return { success, phone: body.phone, message: msg };
  }
}

