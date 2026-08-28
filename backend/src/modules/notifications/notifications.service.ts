import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual } from "typeorm";
import { NotificationEntity, NotificationPreferenceEntity } from "../../database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../../database/entities/logs-delivery.entity";

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

// Channel adapter stubs — replace with real SDK calls when keys are set
async function dispatchPush(userId: string, title: string, body: string, data?: any): Promise<boolean> {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (fcmKey) {
    // TODO: call Firebase Cloud Messaging API
    console.log(`[FCM] Push → ${userId}: ${title}`);
  } else {
    console.log(`[FCM stub] Push → ${userId}: ${title}`);
  }
  return true;
}

async function dispatchEmail(userId: string, title: string, body: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    // TODO: call nodemailer
    console.log(`[Email] → ${userId}: ${title}`);
  } else {
    console.log(`[Email stub] → ${userId}: ${title}`);
  }
  return true;
}

async function dispatchSms(userId: string, body: string): Promise<boolean> {
  const atKey = process.env.AFRICASTALKING_API_KEY;
  if (atKey) {
    // TODO: call Africa's Talking SMS API (Ethiopian-compatible)
    console.log(`[SMS] → ${userId}: ${body}`);
  } else {
    console.log(`[SMS stub] → ${userId}: ${body}`);
  }
  return true;
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
    notification.id = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

    // 2. Load user preferences (critical alerts bypass prefs)
    const isCritical = opts.priority === "critical";
    const prefs = await this.getPreferences(userId);

    // 3. Dispatch to each enabled channel
    await this.attemptDelivery(notification, "in_app", true);

    if (isCritical || prefs.push) {
      const ok = await dispatchPush(userId, opts.title, opts.body, opts.data).catch(() => false);
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
    attempt.id = `del-${Date.now()}-${channel}-${Math.floor(Math.random() * 1000)}`;
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

  // Legacy stub compatibility
  async sendNotificationLegacy(userId: string, title: string, body: string): Promise<any> {
    const n = await this.sendNotification(userId, { type: "general", title, body });
    return { success: true, timestamp: n.createdAt };
  }
}
