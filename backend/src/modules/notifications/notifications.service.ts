import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual } from "typeorm";
import { NotificationEntity, NotificationPreferenceEntity } from "../../database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../../database/entities/logs-delivery.entity";
import { RealtimeService } from "../realtime/realtime.service";
import { NOTIFICATION_TEMPLATES } from "./templates/notification-templates";
import * as crypto from "crypto";

export type NotificationType =
  | "appointment_reminder"
  | "appointment_update"
  | "payment_update"
  | "chat_message"
  | "verification_update"
  | "emergency"
  | "general";

export interface SendNotificationOptions {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "normal" | "critical";
  idempotencyKey?: string;
}

const logger = new Logger("NotificationDispatchers");

// Channel adapters with real external API integration
async function dispatchPush(userId: string, title: string, body: string, data?: any, pushToken?: string): Promise<boolean> {
  const fcmKey = process.env.FCM_SERVER_KEY;
  const targetRecipient = pushToken || `/topics/user_${userId}`;

  if (fcmKey && !fcmKey.startsWith("mock_")) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Authorization": `key=${fcmKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: targetRecipient,
          notification: { title, body, sound: "default" },
          data: data || {},
          priority: "high",
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        logger.warn(`[FCM] Push failed for ${userId} (${targetRecipient}): ${res.status} ${errText}`);
        return false;
      }
      logger.log(`[FCM] Push delivered → ${userId} [${targetRecipient}]: ${title}`);
      return true;
    } catch (err: any) {
      logger.error(`[FCM] Network error dispatching push to ${userId}: ${err.message}`);
      return false;
    }
  } else {
    logger.log(`[FCM dev/stub] Push → ${userId} [${targetRecipient}]: ${title} (${body})`);
    return true;
  }
}

async function dispatchEmail(userId: string, title: string, body: string): Promise<boolean> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const fromEmail = process.env.MAIL_FROM || "no-reply@merihcare.et";

  if (sendgridKey && !sendgridKey.startsWith("SG.mock")) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: `${userId}@merihcare.et` }] }],
          from: { email: fromEmail, name: "Merihcare Healthcare" },
          subject: title,
          content: [{ type: "text/html", value: `<div style="font-family: sans-serif; padding: 20px;"><h2>${title}</h2><p>${body}</p><hr/><small>Merihcare Health System</small></div>` }],
        }),
      });
      if (res.status >= 400) {
        const err = await res.text();
        logger.warn(`[SendGrid] Email delivery error: ${err}`);
        return false;
      }
      logger.log(`[Email] Dispatched via SendGrid → ${userId}: ${title}`);
      return true;
    } catch (err: any) {
      logger.error(`[Email] Error sending email: ${err.message}`);
      return false;
    }
  } else if (smtpHost) {
    logger.log(`[Email SMTP] Configured on host ${smtpHost} → ${userId}: ${title}`);
    return true;
  } else {
    logger.log(`[Email dev/stub] → ${userId}: ${title}`);
    return true;
  }
}

async function dispatchSms(userId: string, body: string): Promise<boolean> {
  const atKey = process.env.AFRICASTALKING_API_KEY;
  const atUsername = process.env.AFRICASTALKING_USERNAME || "sandbox";

  if (atKey && !atKey.startsWith("mock_")) {
    try {
      const endpoint = atUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging";

      const params = new URLSearchParams();
      params.append("username", atUsername);
      params.append("to", userId.startsWith("+") ? userId : `+251${userId.replace(/^0/, "")}`);
      params.append("message", `[Merihcare] ${body}`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "apiKey": atKey,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.warn(`[SMS AfricaTalking] Dispatch failed: ${res.status} ${errText}`);
        return false;
      }
      logger.log(`[SMS AfricaTalking] SMS sent → ${userId}: ${body}`);
      return true;
    } catch (err: any) {
      logger.error(`[SMS] Failed to send SMS: ${err.message}`);
      return false;
    }
  } else {
    logger.log(`[SMS dev/stub] → ${userId}: ${body}`);
    return true;
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferenceRepo: Repository<NotificationPreferenceEntity>,
    @InjectRepository(NotificationDeliveryAttemptEntity)
    private readonly deliveryRepo: Repository<NotificationDeliveryAttemptEntity>,
    private readonly realtimeService: RealtimeService,
  ) {}

  // ─── Core Dispatcher ──────────────────────────────────────────────

  async sendNotification(userId: string, opts: SendNotificationOptions): Promise<NotificationEntity> {
    // Idempotency check
    if (opts.idempotencyKey) {
      const existing = await this.notificationRepo.findOne({
        where: { userId, idempotencyKey: opts.idempotencyKey },
      });
      if (existing) return existing;
    }

    // 1. Persist in-app notification
    const notification = new NotificationEntity();
    notification.id = `notif-${crypto.randomUUID()}`;
    notification.userId = userId;
    notification.type = opts.type;
    notification.title = opts.title;
    notification.body = opts.body;
    notification.data = opts.data ? JSON.stringify(opts.data) : null;
    notification.isRead = false;
    notification.channel = "in_app";
    notification.priority = opts.priority || "normal";
    notification.idempotencyKey = opts.idempotencyKey || null;
    notification.createdAt = new Date().toISOString();
    await this.notificationRepo.save(notification);

    // Push instant in-app notification via WebSocket to user's personal room
    // Role is unknown here; RealtimeService checks both patient and provider rooms
    this.realtimeService.emitToRoom(`patient:${userId}`, "notification", notification);
    this.realtimeService.emitToRoom(`provider:${userId}`, "notification", notification);

    // 2. Load user preferences (critical alerts bypass prefs)
    const isCritical = opts.priority === "critical";
    const prefs = await this.getPreferences(userId);

    // 3. Dispatch to each enabled channel
    await this.attemptDelivery(notification, "in_app", true);

    if (isCritical || prefs.push) {
      const ok = await dispatchPush(userId, opts.title, opts.body, opts.data, prefs.pushToken).catch(() => false);
      await this.attemptDelivery(notification, "push", ok, ok ? null : "FCM dispatch failed");
    }

    if (isCritical || prefs.email) {
      const ok = await dispatchEmail(userId, opts.title, opts.body).catch(() => false);
      await this.attemptDelivery(notification, "email", ok, ok ? null : "Email dispatch failed");
    }

    if (isCritical || prefs.sms) {
      const ok = await dispatchSms(userId, opts.body).catch(() => false);
      await this.attemptDelivery(notification, "sms", ok, ok ? null : "SMS dispatch failed");
    }

    return notification;
  }

  private async attemptDelivery(
    notification: NotificationEntity,
    channel: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const attempt = new NotificationDeliveryAttemptEntity();
    attempt.id = `del-${crypto.randomUUID()}`;
    attempt.notificationId = notification.id;
    attempt.userId = notification.userId;
    attempt.channel = channel;
    attempt.status = success ? "sent" : "failed";
    attempt.retryCount = 0;
    attempt.errorMessage = errorMessage || null;
    attempt.nextRetryAt = success ? null : this.calcNextRetry(0);
    attempt.createdAt = new Date().toISOString();
    await this.deliveryRepo.save(attempt);
  }

  private calcNextRetry(retryCount: number): string {
    const delays = [60, 300, 1800]; // 1min, 5min, 30min in seconds
    const delaySec = delays[retryCount] ?? 1800;
    return new Date(Date.now() + delaySec * 1000).toISOString();
  }

  // ─── Delivery Retry Sweeper ───────────────────────────────────────

  async retryFailedDeliveries(): Promise<void> {
    const now = new Date().toISOString();
    const failedAttempts = await this.deliveryRepo.find({
      where: { status: "failed" },
    });

    for (const attempt of failedAttempts) {
      if (attempt.retryCount >= 3) continue;
      if (attempt.nextRetryAt && attempt.nextRetryAt > now) continue;

      const notification = await this.notificationRepo.findOne({
        where: { id: attempt.notificationId },
      });
      if (!notification) continue;

      let ok = false;
      try {
        if (attempt.channel === "push") ok = await dispatchPush(attempt.userId, notification.title, notification.body);
        else if (attempt.channel === "email") ok = await dispatchEmail(attempt.userId, notification.title, notification.body);
        else if (attempt.channel === "sms") ok = await dispatchSms(attempt.userId, notification.body);
        else ok = true;
      } catch { ok = false; }

      attempt.retryCount += 1;
      attempt.status = ok ? "sent" : "failed";
      attempt.errorMessage = ok ? null : `Retry ${attempt.retryCount} failed`;
      attempt.nextRetryAt = ok ? null : this.calcNextRetry(attempt.retryCount);
      await this.deliveryRepo.save(attempt);
    }
  }

  // ─── Emergency Escalation ─────────────────────────────────────────

  async sendEmergencyEscalation(userId: string, message: string): Promise<NotificationEntity> {
    return this.sendNotification(userId, {
      type: "emergency",
      title: "🚨 Emergency Alert",
      body: message,
      priority: "critical",
    });
  }

  // ─── Notification History ─────────────────────────────────────────

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: NotificationEntity[]; total: number; unread: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    } as any);

    const unread = await this.notificationRepo.count({ where: { userId, isRead: false } });

    return { notifications, total, unread, page, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { isRead: true, readAt: new Date().toISOString() },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update()
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where("userId = :userId AND isRead = false", { userId })
      .execute();
  }

  // ─── Preferences ──────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreferenceEntity> {
    const prefs = await this.preferenceRepo.findOne({ where: { userId } });
    if (prefs) return prefs;

    // Return defaults without persisting
    const defaults = new NotificationPreferenceEntity();
    defaults.userId = userId;
    defaults.inApp = true;
    defaults.push = true;
    defaults.email = true;
    defaults.sms = false;
    defaults.appointmentReminders = true;
    defaults.chatMessages = true;
    defaults.paymentUpdates = true;
    defaults.emergencyAlerts = true;
    return defaults;
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<Omit<NotificationPreferenceEntity, "userId" | "updatedAt">>,
  ): Promise<NotificationPreferenceEntity> {
    let existing = await this.preferenceRepo.findOne({ where: { userId } });
    if (!existing) {
      existing = new NotificationPreferenceEntity();
      existing.userId = userId;
      existing.inApp = true;
      existing.push = true;
      existing.email = true;
      existing.sms = false;
      existing.appointmentReminders = true;
      existing.chatMessages = true;
      existing.paymentUpdates = true;
      existing.emergencyAlerts = true; // always true, cannot be disabled
    }

    Object.assign(existing, prefs, {
      emergencyAlerts: true, // force — cannot be disabled
      updatedAt: new Date().toISOString(),
    });

    return this.preferenceRepo.save(existing);
  }

  async registerDeviceToken(userId: string, token: string, platform = "android"): Promise<any> {
    let prefs = await this.preferenceRepo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = new NotificationPreferenceEntity();
      prefs.userId = userId;
      prefs.inApp = true;
      prefs.push = true;
      prefs.email = true;
      prefs.sms = false;
      prefs.appointmentReminders = true;
      prefs.chatMessages = true;
      prefs.paymentUpdates = true;
      prefs.emergencyAlerts = true;
    }
    prefs.pushToken = token;
    prefs.devicePlatform = platform;
    prefs.push = true;
    prefs.updatedAt = new Date().toISOString();
    await this.preferenceRepo.save(prefs);
    return { success: true, userId, platform: prefs.devicePlatform };
  }

  // Multi-Channel Template Rendering
  renderTemplate(templateKey: string, variables: Record<string, any>) {
    const generator = NOTIFICATION_TEMPLATES[templateKey];
    if (!generator) {
      throw new Error(`Template "${templateKey}" not found`);
    }
    return generator(variables);
  }

  // Schedule notification for future dispatch (persisted)
  async scheduleNotification(
    userId: string,
    scheduledFor: Date,
    opts: SendNotificationOptions
  ): Promise<any> {
    const isDue = scheduledFor.getTime() <= Date.now();
    if (isDue) {
      return this.sendNotification(userId, opts);
    }

    const scheduledItem = new NotificationEntity();
    scheduledItem.id = `notif-sched-${crypto.randomUUID()}`;
    scheduledItem.userId = userId;
    scheduledItem.type = opts.type;
    scheduledItem.title = opts.title;
    scheduledItem.body = opts.body;
    scheduledItem.data = JSON.stringify({
      ...(opts.data || {}),
      scheduledFor: scheduledFor.toISOString(),
      scheduledStatus: "pending",
    });
    scheduledItem.isRead = false;
    scheduledItem.channel = "in_app";
    scheduledItem.priority = opts.priority || "normal";
    scheduledItem.idempotencyKey = opts.idempotencyKey || null;
    scheduledItem.createdAt = new Date().toISOString();

    await this.notificationRepo.save(scheduledItem);

    // Schedule setTimeout for immediate memory execution if within next 2 hours
    const delayMs = scheduledFor.getTime() - Date.now();
    if (delayMs > 0 && delayMs < 2 * 60 * 60 * 1000) {
      const timer = setTimeout(async () => {
        try {
          await this.sendNotification(userId, opts);
        } catch (e: any) {
          logger.warn(`Scheduled notification dispatch error: ${e.message}`);
        }
      }, delayMs);
      if (timer.unref) timer.unref();
    }

    return {
      ...scheduledItem,
      status: "pending",
      scheduledFor: scheduledFor.toISOString(),
      options: opts,
    };
  }

  // Retrieve delivery attempts log
  async getDeliveryLogs(): Promise<NotificationDeliveryAttemptEntity[]> {
    return this.deliveryRepo.find({
      order: { createdAt: "DESC" as any },
      take: 100,
    });
  }

  // Legacy stub compatibility
  async sendNotificationLegacy(userId: string, title: string, body: string): Promise<any> {
    const n = await this.sendNotification(userId, { type: "general", title, body });
    return { success: true, timestamp: n.createdAt };
  }
}
