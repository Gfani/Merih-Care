import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("medical_records")
export class MedicalRecordEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  patientId: string; // Patient User ID

  @Column({ nullable: true })
  @Index()
  providerId: string; // Doctor/Nurse who created the record

  @Column({ type: "text" })
  diagnosis: string; // Encrypted text

  @Column({ type: "text" })
  notes: string; // Encrypted text

  @Column({ type: "text", nullable: true })
  attachments: string; // Encrypted JSON string of file meta

  @Column()
  createdAt: string;

  @Column()
  updatedAt: string;
}

@Entity("patient_consents")
export class PatientConsentEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  patientId: string;

  @Column()
  @Index()
  providerId: string;

  @Column({ default: false })
  granted: boolean;

  @Column()
  expiresAt: string; // ISO string

  @Column()
  createdAt: string;
}

@Entity("privacy_policy_acceptances")
export class PrivacyPolicyAcceptanceEntity {
  @PrimaryColumn()
  userId: string;

  @Column()
  acceptedAt: string;

  @Column()
  policyVersion: string;
}

@Entity("incident_reports")
export class IncidentReportEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  reporterId: string; // User ID of reporter

  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ default: "pending" })
  status: string; // pending, investigated, resolved

  @Column()
  createdAt: string;
}
