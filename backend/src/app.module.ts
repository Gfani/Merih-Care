import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { RequestIdMiddleware } from "./shared/middleware/request-id.middleware";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getDatabaseConfig } from "./database/database.config";
import { DatabaseSeedService } from "./database/seed";

// Import entities (needed for database seeding feature injection)
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
} from "./database/entities";

// Import all 24 Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ServicesModule } from "./modules/services/services.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { ServiceRequestsModule } from "./modules/requests/requests.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ProviderEarningsModule } from "./modules/earnings/earnings.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { ChatModule } from "./modules/chat/chat.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { MedicalRecordsModule } from "./modules/medical/medical.module";
import { EmergencyModule } from "./modules/emergency/emergency.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { ComplaintsModule } from "./modules/complaints/complaints.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { HealthModule } from "./modules/health/health.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";

@Module({
  imports: [
    // Dynamic Environment Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : ".env",
    }),

    // Global Task Scheduler
    ScheduleModule.forRoot(),
    
    // Global API Rate Limiter
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    
    // Database Connection options
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: any) => getDatabaseConfig(configService),
    }),

    // Global entities feature loader for seeder usage
    TypeOrmModule.forFeature([
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
    ]),

    // Register all 24 feature modules
    AuthModule,
    UsersModule,
    PatientsModule,
    ProvidersModule,
    VerificationModule,
    ServicesModule,
    AvailabilityModule,
    ServiceRequestsModule,
    AppointmentsModule,
    PaymentsModule,
    ProviderEarningsModule,
    PayoutsModule,
    ChatModule,
    NotificationsModule,
    MedicalRecordsModule,
    EmergencyModule,
    LocationsModule,
    ComplaintsModule,
    ReviewsModule,
    AdminModule,
    AuditModule,
    ReportsModule,
    UploadsModule,
    HealthModule,
    RealtimeModule,
  ],
  providers: [
    DatabaseSeedService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes("*");
  }
}
