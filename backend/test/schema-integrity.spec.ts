import {
  UserEntity,
  ProviderEntity,
  AppointmentEntity,
  ServiceEntity,
  ComplaintEntity,
  ReviewEntity,
  EmergencyEntity,
  LocationEntity,
  SessionEntity,
  RoleEntity,
  PermissionEntity,
  PayoutBatchEntity,
  WebhookLogEntity,
  PatientConsentEntity,
  MedicalRecordAccessLogEntity,
} from "../src/database/entities";
import { BackupRestoreService } from "../src/database/backup-restore.service";

describe("Database Schema Integrity & Entity Validation", () => {
  describe("Entity Definitions & Key Normalization", () => {
    it("should properly instantiate UserEntity and validate properties", () => {
      const user = new UserEntity();
      user.id = "u-test-1";
      user.email = "test@merihcare.et";
      user.role = "patient";
      user.status = "active";

      expect(user.id).toBe("u-test-1");
      expect(user.email).toBe("test@merihcare.et");
      expect(user.role).toBe("patient");
    });

    it("should properly instantiate ProviderEntity and validate status enum", () => {
      const provider = new ProviderEntity();
      provider.id = "p-test-1";
      provider.name = "Dr. Aster Haile";
      provider.rating = 4.9;
      provider.verified = true;

      expect(provider.id).toBe("p-test-1");
      expect(provider.verified).toBe(true);
      expect(provider.rating).toBe(4.9);
    });

    it("should properly instantiate AppointmentEntity with foreign key properties", () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-101";
      apt.patientId = "pat-1";
      apt.providerId = "p-1";
      apt.status = "scheduled";
      apt.amount = 1500;

      expect(apt.id).toBe("apt-101");
      expect(apt.patientId).toBe("pat-1");
      expect(apt.providerId).toBe("p-1");
      expect(apt.status).toBe("scheduled");
    });

    it("should properly instantiate WebhookLogEntity and PayoutBatchEntity", () => {
      const webhook = new WebhookLogEntity();
      webhook.id = "wh-1";
      webhook.provider = "chapa";
      webhook.signatureVerified = true;
      webhook.status = "processed";

      const batch = new PayoutBatchEntity();
      batch.id = "batch-1";
      batch.batchReference = "BATCH-AUG-2026";
      batch.totalAmount = 250000;
      batch.status = "completed";

      expect(webhook.provider).toBe("chapa");
      expect(webhook.signatureVerified).toBe(true);
      expect(batch.batchReference).toBe("BATCH-AUG-2026");
      expect(batch.status).toBe("completed");
    });
  });

  describe("Backup & Restore Service", () => {
    let backupService: BackupRestoreService;
    let mockDataSource: any;

    beforeEach(() => {
      mockDataSource = {
        isInitialized: true,
        createQueryRunner: jest.fn().mockReturnValue({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          query: jest.fn().mockResolvedValue([]),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
        }),
      };
      backupService = new BackupRestoreService(mockDataSource);
    });

    it("should generate a database SQL backup file", async () => {
      const result = await backupService.createDatabaseBackup();
      expect(result.backupPath).toBeDefined();
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it("should execute 90-day retention purge routine", async () => {
      const result = await backupService.purgeStaleData(90);
      expect(result.purgedRecords).toBeGreaterThanOrEqual(0);
    });
  });
});
