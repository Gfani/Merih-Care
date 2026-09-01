import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, LessThan } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Hourly background job: Dispatch upcoming appointment reminders
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processAppointmentReminders(): Promise<{ remindersSent: number }> {
    this.logger.log("[Cron] Running appointment reminder dispatcher...");

    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = next24Hours.toISOString().split("T")[0];

    try {
      const upcomingApts = await this.appointmentRepo.find({
        where: {
          status: In(["scheduled", "accepted"]),
          date: In([todayStr, tomorrowStr]),
        },
      });

      let remindersSent = 0;

      for (const apt of upcomingApts) {
        if (apt.patientId) {
          await this.notificationsService.sendNotification(apt.patientId, {
            type: "appointment_reminder",
            title: "Upcoming Appointment Reminder",
            body: `Reminder: You have a scheduled appointment on ${apt.date} at ${apt.time || "the scheduled time"}.`,
            data: { appointmentId: apt.id, date: apt.date, time: apt.time },
            idempotencyKey: `remind-pt-${apt.id}-${todayStr}`,
          }).catch((e) => this.logger.warn(`Failed to dispatch reminder to patient ${apt.patientId}: ${e.message}`));
          remindersSent += 1;
        }

        if (apt.providerId) {
          await this.notificationsService.sendNotification(apt.providerId, {
            type: "appointment_reminder",
            title: "Provider Visit Reminder",
            body: `Upcoming patient visit scheduled for ${apt.date} at ${apt.time || "scheduled time"}.`,
            data: { appointmentId: apt.id, date: apt.date, time: apt.time },
            idempotencyKey: `remind-pv-${apt.id}-${todayStr}`,
          }).catch((e) => this.logger.warn(`Failed to dispatch reminder to provider ${apt.providerId}: ${e.message}`));
          remindersSent += 1;
        }
      }

      this.logger.log(`[Cron] Appointment reminder run complete: ${remindersSent} reminders dispatched.`);
      return { remindersSent };
    } catch (err: any) {
      this.logger.error(`[Cron] Error processing appointment reminders: ${err.message}`);
      return { remindersSent: 0 };
    }
  }

  /**
   * Daily midnight background job: Clean up expired auth sessions
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions(): Promise<{ purgedSessions: number }> {
    this.logger.log("[Cron] Cleaning up expired user sessions...");

    try {
      const nowIso = new Date().toISOString();
      const expiredSessions = await this.sessionRepo.find({
        where: {
          tokenExpires: LessThan(nowIso),
          isRevoked: false,
        },
      });

      if (expiredSessions.length === 0) {
        this.logger.log("[Cron] No expired sessions found to purge.");
        return { purgedSessions: 0 };
      }

      for (const s of expiredSessions) {
        s.isRevoked = true;
      }
      await this.sessionRepo.save(expiredSessions);

      this.logger.log(`[Cron] Successfully revoked ${expiredSessions.length} expired sessions.`);
      return { purgedSessions: expiredSessions.length };
    } catch (err: any) {
      this.logger.error(`[Cron] Error purging expired sessions: ${err.message}`);
      return { purgedSessions: 0 };
    }
  }

  /**
   * 15-minute background job: Retry pending/failed webhook & notification deliveries
   */
  @Cron("*/15 * * * *")
  async retryPendingWebhooks(): Promise<{ retried: number }> {
    this.logger.log("[Cron] Retrying pending & failed notification deliveries...");

    try {
      await this.notificationsService.retryFailedDeliveries();
      this.logger.log("[Cron] Notification retry sweep completed.");
      return { retried: 1 };
    } catch (err: any) {
      this.logger.error(`[Cron] Error during notification delivery retry sweep: ${err.message}`);
      return { retried: 0 };
    }
  }
}
