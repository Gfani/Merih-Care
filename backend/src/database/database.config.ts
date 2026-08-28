import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { 
  UserEntity, 
  ProviderEntity, 
  ServiceEntity, 
  AppointmentEntity, 
  ComplaintEntity, 
  ReviewEntity, 
  EmergencyEntity, 
  LocationEntity,
  SessionEntity,
  RoleEntity,
  PermissionEntity,
  UserRoleEntity,
  PatientProfileEntity,
  ProviderProfileEntity,
  ProviderQualificationEntity,
  ProviderLicenseEntity,
  CredentialDocumentEntity,
  VerificationReviewEntity,
  VerificationHistoryEntity,
  ServiceCategoryEntity,
  ProviderServiceEntity,
  AppointmentStatusHistoryEntity,
  CancellationReasonEntity,
  PaymentEventEntity,
  RefundEntity,
  CommissionRecordEntity,
  PayoutEntity,
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  NotificationDeliveryAttemptEntity,
  MedicalRecordAccessLogEntity,
  AuditLogEntity,
  FileMetadataEntity,
  EmergencyResponderEntity,
  EmergencyEscalationHistoryEntity,
  LocationHistoryEntity,
  TimeOffEntity
} from "./entities";

export const getDatabaseConfig = (configService: any): TypeOrmModuleOptions => {
  const dbType = process.env.DB_TYPE || "postgres";

  const entities = [
    UserEntity, 
    ProviderEntity, 
    ServiceEntity, 
    AppointmentEntity, 
    ComplaintEntity, 
    ReviewEntity, 
    EmergencyEntity, 
    LocationEntity,
    SessionEntity,
    RoleEntity,
    PermissionEntity,
    UserRoleEntity,
    PatientProfileEntity,
    ProviderProfileEntity,
    ProviderQualificationEntity,
    ProviderLicenseEntity,
    CredentialDocumentEntity,
    VerificationReviewEntity,
    VerificationHistoryEntity,
    ServiceCategoryEntity,
    ProviderServiceEntity,
    AppointmentStatusHistoryEntity,
    CancellationReasonEntity,
    PaymentEventEntity,
    RefundEntity,
    CommissionRecordEntity,
    PayoutEntity,
    ConversationEntity,
    ConversationParticipantEntity,
    MessageEntity,
    MessageAttachmentEntity,
    NotificationDeliveryAttemptEntity,
    MedicalRecordAccessLogEntity,
    AuditLogEntity,
    FileMetadataEntity,
    EmergencyResponderEntity,
    EmergencyEscalationHistoryEntity,
    LocationHistoryEntity,
    TimeOffEntity
  ];

  const isDev = process.env.NODE_ENV === "development";

  if (dbType === "sqlite") {
    return {
      type: "sqlite",
      database: process.env.DB_DATABASE || "merihcare.sqlite",
      entities,
      migrations: ["dist/database/migrations/*.js"],
      synchronize: isDev,
    };
  }

  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "merihcare_user",
    password: process.env.DB_PASSWORD || "merihcare_password",
    database: process.env.DB_DATABASE || "merihcare_db",
    entities,
    migrations: ["dist/database/migrations/*.js"],
    synchronize: isDev,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
};
