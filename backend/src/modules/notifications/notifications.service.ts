import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  async sendNotification(userId: string, title: string, body: string): Promise<any> {
    console.log(`Notification sent to ${userId}: [${title}] ${body}`);
    return { success: true, timestamp: new Date().toISOString() };
  }
}
