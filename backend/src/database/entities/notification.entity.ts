import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("notifications")
export class NotificationEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  type: string; // appointment_reminder | payment_update | chat_message | emergency | general

  @Column()
  title: string;

  @Column({ type: "text" })
  body: string;

  @Column({ nullable: true, type: "text" })
  data: string; // JSON payload for deep linking / context

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: string;

  @Column({ default: "in_app" })
  channel: string; // in_app | push | email | sms

  @Column({ default: "normal" })
  priority: string; // normal | critical

  @Column({ nullable: true })
  idempotencyKey: string; // prevent duplicate notifications

  @Column()
  @Index()
  createdAt: string;
}

@Entity("notification_preferences")
export class NotificationPreferenceEntity {
  @PrimaryColumn()
  userId: string;

  @Column({ default: true })
  inApp: boolean;

  @Column({ default: true })
  push: boolean;

  @Column({ default: true })
  email: boolean;

  @Column({ default: false })
  sms: boolean;

  @Column({ default: true })
  appointmentReminders: boolean;

  @Column({ default: true })
  chatMessages: boolean;

  @Column({ default: true })
  paymentUpdates: boolean;

  // Emergency alerts can never be disabled
  @Column({ default: true })
  emergencyAlerts: boolean;

  @Column({ nullable: true })
  pushToken: string;

  @Column({ nullable: true })
  devicePlatform: string;

  @Column({ nullable: true })
  updatedAt: string;
}
