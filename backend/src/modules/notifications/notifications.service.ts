import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual } from "typeorm";
import { NotificationEntity, NotificationPreferenceEntity } from "../../database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../../database/entities/logs-delivery.entity";
import { UserEntity } from "../../database/entities/user.entity";
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
  recipientEmail?: string;
  recipientPhone?: string;
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
    if (process.env.NODE_ENV === "production") {
      logger.error(`[FCM Error] Push notification credentials are not configured in production`);
      return false;
    }
    logger.log(`[FCM dev/stub] Push → ${userId} [${targetRecipient}]: ${title} (${body})`);
    return true;
  }
}

async function dispatchEmail(userId: string, title: string, body: string, recipientEmail?: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const gmailUser = process.env.GMAIL_USER || (process.env.SMTP_USER && process.env.SMTP_USER.includes("@gmail.com") ? process.env.SMTP_USER : undefined);
  const gmailPass = process.env.GMAIL_APP_PASSWORD || (gmailUser ? process.env.SMTP_PASSWORD : undefined);
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || process.env.MAIL_FROM || gmailUser || "otp@merihcare.live";
  const toEmail = recipientEmail && recipientEmail.includes("@")
    ? recipientEmail
    : `${userId}@merihcare.et`;

  // Always display prominent terminal notification banner
  console.log("\n====================================================================");
  console.log(`✉️  MERIHCARE OUTBOUND EMAIL DISPATCH`);
  console.log(`   TO:      ${toEmail}`);
  console.log(`   FROM:    ${fromEmail}`);
  console.log(`   SUBJECT: ${title}`);
  console.log(`   CONTENT: ${body}`);
  console.log("====================================================================\n");

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d7c6a; margin: 0; font-size: 24px; letter-spacing: 2px;">MERIHCARE</h1>
        <p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 0 0;">Premium Healthcare Network</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; font-size: 16px; margin: 0 0 12px 0;">${title}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">${body}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Security Notice: This OTP is valid for exactly 5 minutes. If you did not request this, please safeguard your account immediately.
      </p>
    </div>
  `;

  // 1. Resend API Dispatch (Official REST API with merihcare.live)
  if (resendApiKey && resendApiKey.startsWith("re_") && !resendApiKey.includes("xxxx")) {
    const fromFormatted = fromEmail.includes("<") ? fromEmail : `Merihcare Healthcare <${fromEmail}>`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromFormatted,
            to: [toEmail],
            subject: title,
            html: emailHtml,
          }),
        });
        const result = await res.json();
        if (res.ok && result.id) {
          logger.log(`[Resend] Email delivered successfully to ${toEmail} (ID: ${result.id})`);
          return true;
        } else {
          logger.warn(`[Resend Error] Delivery attempt ${attempt} failed to ${toEmail}: ${JSON.stringify(result)}`);
        }
      } catch (err: any) {
        logger.warn(`[Resend Attempt ${attempt} network error]: ${err.message}`);
      }
    }
  } else if (resendApiKey && resendApiKey.includes("xxxx")) {
    logger.warn(`[Resend Notice] RESEND_API_KEY contains placeholder 're_xxxxxxxxx'. Please supply your actual secret API key from resend.com/api-keys.`);
  }

  if (sendgridKey && !sendgridKey.startsWith("SG.mock") && sendgridKey.trim().length > 10) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: fromEmail, name: "Merihcare Healthcare" },
          subject: title,
          content: [{ type: "text/html", value: emailHtml }],
        }),
      });
      if (res.status >= 400) {
        const err = await res.text();
        logger.warn(`[SendGrid] Email delivery error: ${err}`);
        return false;
      }
      logger.log(`[Email] Dispatched via SendGrid → ${toEmail}: ${title}`);
      return true;
    } catch (err: any) {
      logger.error(`[Email] Error sending email via SendGrid: ${err.message}`);
      return false;
    }
  } else if (gmailUser && gmailPass) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      await transporter.sendMail({
        from: `Merihcare Healthcare <${fromEmail}>`,
        to: toEmail,
        subject: title,
        html: emailHtml,
      });
      logger.log(`[Email Gmail] Dispatched via Gmail SMTP → ${toEmail}: ${title}`);
      return true;
    } catch (err: any) {
      logger.error(`[Email Gmail] Dispatch failed: ${err.message}`);
      return false;
    }
  } else if (smtpHost) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        } : undefined,
      });
      await transporter.sendMail({
        from: `Merihcare Healthcare <${fromEmail}>`,
        to: toEmail,
        subject: title,
        html: emailHtml,
      });
      logger.log(`[Email SMTP] Dispatched via ${smtpHost} → ${toEmail}: ${title}`);
      return true;
    } catch (err: any) {
      logger.error(`[Email SMTP] Dispatch failed on ${smtpHost}: ${err.message}`);
      return false;
    }
  } else {
    logger.log(`[Email dev/stub] → ${toEmail}: ${title} (Content: ${body})`);
    return true;
  }
}

async function dispatchSms(userId: string, body: string, recipientPhone?: string): Promise<boolean> {
  const atKey = process.env.AFRICASTALKING_API_KEY || process.env.AFRICAS_TALKING_API_KEY;
  const atUsername = process.env.AFRICASTALKING_USERNAME || process.env.AFRICAS_TALKING_USERNAME || "sandbox";
  const targetPhone = recipientPhone || (userId.startsWith("+") ? userId : `+251${userId.replace(/^0/, "")}`);

  if (atKey && !atKey.startsWith("mock_")) {
    try {
      const endpoint = atUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging";

      const params = new URLSearchParams();
      params.append("username", atUsername);
      params.append("to", targetPhone);
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
      logger.log(`[SMS AfricaTalking] SMS sent → ${targetPhone}: ${body}`);
      return true;
    } catch (err: any) {
      logger.error(`[SMS] Failed to send SMS: ${err.message}`);
      return false;
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      logger.error(`[SMS Error] SMS provider credentials are not configured in production`);
      return false;
    }
    logger.log(`[SMS dev/stub] → ${targetPhone}: ${body}`);
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
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
  ) {}

  // ─── Core Dispatcher ──────────────────────────────────────────────

  async sendNotification(userId: string, opts: SendNotificationOptions): Promise<NotificationEntity> {
    // Deduplication check: explicit idempotencyKey or 60-second window auto-dedupe
    const autoDedupeKey = opts.idempotencyKey || `dedupe-${userId}-${opts.type}-${opts.title}`;
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const existing = await this.notificationRepo.findOne({
      where: { userId, idempotencyKey: autoDedupeKey },
    });
    if (existing && (opts.idempotencyKey || existing.createdAt > oneMinuteAgo)) {
      return existing;
    }

    // Resolve recipient email and phone (from options or database lookup)
    let recipientEmail = opts.recipientEmail || opts.data?.recipientEmail;
    let recipientPhone = opts.recipientPhone || opts.data?.recipientPhone;

    if ((!recipientEmail || !recipientPhone) && this.userRepo) {
      try {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user) {
          if (!recipientEmail && user.email) recipientEmail = user.email;
          if (!recipientPhone && user.phone) recipientPhone = user.phone;
        }
      } catch { /* graceful fallback */ }
    }

    const payloadData = {
      ...(opts.data || {}),
      ...(recipientEmail ? { recipientEmail } : {}),
      ...(recipientPhone ? { recipientPhone } : {}),
    };

    // 1. Persist in-app notification
    const notification = new NotificationEntity();
    notification.id = `notif-${crypto.randomUUID()}`;
    notification.userId = userId;
    notification.type = opts.type;
    notification.title = opts.title;
    notification.body = opts.body;
    notification.data = Object.keys(payloadData).length > 0 ? JSON.stringify(payloadData) : null;
    notification.isRead = false;
    notification.channel = "in_app";
    notification.priority = opts.priority || "normal";
    notification.idempotencyKey = autoDedupeKey;
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

    const isOtp = opts.data?.type === "password_reset" || opts.data?.type === "email_verification";

    if (isOtp) {
      // Fast-track OTP: deliver email immediately without waiting for other channels
      const emailPromise = (async () => {
        const ok = await dispatchEmail(userId, opts.title, opts.body, recipientEmail).catch(() => false);
        await this.attemptDelivery(notification, "email", ok, ok ? null : "Email dispatch failed").catch(() => {});
        return ok;
      })();

      // SMS backup dispatched concurrently in background if phone is provided
      if (recipientPhone && (isCritical || prefs.sms)) {
        dispatchSms(userId, opts.body, recipientPhone)
          .then(ok => this.attemptDelivery(notification, "sms", ok, ok ? null : "SMS dispatch failed"))
          .catch(() => {});
      }

      await emailPromise;
      return notification;
    }

    // Parallel multi-channel dispatch for regular notifications
    const channelTasks: Promise<any>[] = [];

    if (isCritical || prefs.push) {
      channelTasks.push(
        dispatchPush(userId, opts.title, opts.body, payloadData, prefs.pushToken)
          .catch(() => false)
          .then(ok => this.attemptDelivery(notification, "push", ok, ok ? null : "FCM dispatch failed"))
      );
    }

    if (isCritical || prefs.email) {
      channelTasks.push(
        dispatchEmail(userId, opts.title, opts.body, recipientEmail)
          .catch(() => false)
          .then(ok => this.attemptDelivery(notification, "email", ok, ok ? null : "Email dispatch failed"))
      );
    }

    if (isCritical || prefs.sms) {
      channelTasks.push(
        dispatchSms(userId, opts.body, recipientPhone)
          .catch(() => false)
          .then(ok => this.attemptDelivery(notification, "sms", ok, ok ? null : "SMS dispatch failed"))
      );
    }

    await Promise.allSettled(channelTasks);
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

    if (!success && (notification.priority === "critical" || channel === "email" || channel === "sms")) {
      logger.warn(`[DELIVERY FAILED] Channel '${channel}' failed for notification ${notification.id} (${notification.type}) to user ${notification.userId}: ${errorMessage || "Provider unconfigured or unavailable"}`);
    }
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

      let dataObj: any = {};
      try { dataObj = notification.data ? JSON.parse(notification.data) : {}; } catch {}
      const retryEmail = dataObj.recipientEmail;
      const retryPhone = dataObj.recipientPhone;

      let ok = false;
      try {
        if (attempt.channel === "push") ok = await dispatchPush(attempt.userId, notification.title, notification.body, dataObj);
        else if (attempt.channel === "email") ok = await dispatchEmail(attempt.userId, notification.title, notification.body, retryEmail);
        else if (attempt.channel === "sms") ok = await dispatchSms(attempt.userId, notification.body, retryPhone);
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

  async unregisterDeviceToken(userId: string): Promise<any> {
    const prefs = await this.preferenceRepo.findOne({ where: { userId } });
    if (prefs) {
      prefs.pushToken = null;
      prefs.devicePlatform = null;
      prefs.updatedAt = new Date().toISOString();
      await this.preferenceRepo.save(prefs);
    }
    return { success: true, userId, message: "Device unregistered successfully" };
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
