import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("notification_delivery_attempts")
export class NotificationDeliveryAttemptEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  notificationId: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  channel: string; // in_app | push | email | sms

  @Column()
  status: string; // pending | sent | failed

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  provider: string; // fcm | ses | twilio | africastalking

  @Column({ nullable: true })
  nextRetryAt: string; // ISO timestamp for exponential backoff retry

  @Column()
  createdAt: string;
}

@Entity("medical_record_access_logs")
export class MedicalRecordAccessLogEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  recordId: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  accessType: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column()
  createdAt: string;
}

@Entity("audit_logs")
export class AuditLogEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  actorId: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column()
  @Index()
  timestamp: string;

  @Column()
  status: string;

  @Column({ nullable: true })
  payload: string;
}

@Entity("file_metadata")
export class FileMetadataEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  fileName: string;

  @Column()
  mimeType: string;

  @Column()
  fileSize: number;

  @Column()
  url: string;

  @Column()
  @Index()
  uploaderId: string;

  @Column()
  createdAt: string;
}
