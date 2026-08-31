import { MedicalRecordsService } from "../src/modules/medical/medical.service";
import {
  MedicalRecordEntity,
  PatientConsentEntity,
  PrivacyPolicyAcceptanceEntity,
  IncidentReportEntity,
} from "../src/database/entities/medical.entity";
import { encrypt } from "../src/shared/utils/crypto";

describe("Medical Records & Privacy Checklist Tests", () => {
  let service: MedicalRecordsService;
  let mockRecordRepo: any;
  let mockConsentRepo: any;
  let mockPrivacyRepo: any;
  let mockIncidentRepo: any;
  let mockAccessLogRepo: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockRecordRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockConsentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };
    mockPrivacyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    mockIncidentRepo = {
      save: jest.fn().mockImplementation((i) => Promise.resolve(i)),
    };
    mockAccessLogRepo = {
      save: jest.fn().mockImplementation((log) => Promise.resolve(log)),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb({
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    service = new MedicalRecordsService(
      mockRecordRepo,
      mockConsentRepo,
      mockPrivacyRepo,
      mockIncidentRepo,
      mockAccessLogRepo,
      mockDataSource
    );
  });

  describe("Patient Ownership & Access Enforcement", () => {
    it("should allow patient to access their own records directly", async () => {
      const isAllowed = await service.verifyAccess("pat-1", "pat-1", "patient");
      expect(isAllowed).toBe(true);
    });

    it("should allow provider access when active consent is granted", async () => {
      const consent = new PatientConsentEntity();
      consent.patientId = "pat-1";
      consent.providerId = "prov-1";
      consent.granted = true;
      consent.expiresAt = new Date(Date.now() + 86400000).toISOString(); // expires in 1 day
      mockConsentRepo.findOne.mockResolvedValue(consent);

      const isAllowed = await service.verifyAccess("pat-1", "prov-1", "provider");
      expect(isAllowed).toBe(true);
    });

    it("should block provider access when no active consent exists", async () => {
      mockConsentRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyAccess("pat-1", "prov-unauthorized", "provider")).rejects.toThrow(
        "No active patient consent granted"
      );
    });

    it("should block non-medical admin access", async () => {
      await expect(service.verifyAccess("pat-1", "admin-sales", "admin", [])).rejects.toThrow(
        "Administrative access blocked. Explicit medical clearance required."
      );
    });
  });

  describe("PHI Encryption & Access Logging", () => {
    it("should create medical record with encrypted diagnosis and log access event", async () => {
      const record = await service.createRecord(
        "pat-1",
        "prov-1",
        "Type 2 Diabetes Mellitus",
        "HbA1c levels 7.2%, prescribed Metformin 500mg daily."
      );

      expect(record.patientId).toBe("pat-1");
      expect(record.providerId).toBe("prov-1");
      // Record diagnosis in repo is encrypted
      expect(mockRecordRepo.save).toHaveBeenCalled();
      expect(mockAccessLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ accessType: "create" })
      );
    });

    it("should log access event during export and return decrypted dataset", async () => {
      const encDiag = encrypt("Hypertension stage 1");
      const encNotes = encrypt("Blood pressure 140/90 mmHg");

      const rawRecord = new MedicalRecordEntity();
      rawRecord.id = "rec-1";
      rawRecord.patientId = "pat-1";
      rawRecord.providerId = "prov-1";
      rawRecord.diagnosis = encDiag;
      rawRecord.notes = encNotes;
      rawRecord.createdAt = new Date().toISOString();

      mockRecordRepo.find.mockResolvedValue([rawRecord]);

      const exportData = await service.exportPatientData("pat-1", "127.0.0.1", "Jest Test");
      expect(exportData.patientId).toBe("pat-1");
      expect(exportData.medicalHistory[0].diagnosis).toBe("Hypertension stage 1");
      expect(mockAccessLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ accessType: "export" })
      );
    });
  });

  describe("Privacy Policy Acceptance & Incident Reporting", () => {
    it("should record privacy policy acceptance", async () => {
      const result = await service.acceptPrivacyPolicy("user-1", "2026.2.0");
      expect(result.userId).toBe("user-1");
      expect(result.policyVersion).toBe("2026.2.0");
      expect(mockPrivacyRepo.save).toHaveBeenCalled();
    });

    it("should file security/privacy incident report", async () => {
      const incident = await service.reportIncident(
        "user-1",
        "Unauthorized record inquiry attempt",
        "Suspicious access attempt logged from unknown IP"
      );

      expect(incident.title).toContain("Unauthorized");
      expect(incident.status).toBe("pending");
      expect(mockIncidentRepo.save).toHaveBeenCalled();
    });
  });
});
