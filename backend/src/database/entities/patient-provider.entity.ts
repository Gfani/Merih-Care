import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("patient_profiles")
export class PatientProfileEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ nullable: true })
  bloodType: string;

  @Column({ nullable: true })
  allergies: string;

  @Column({ nullable: true })
  medicalHistory: string;
}

@Entity("provider_profiles")
export class ProviderProfileEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ default: 0 })
  experienceYears: number;
}

@Entity("provider_qualifications")
export class ProviderQualificationEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  degree: string;

  @Column()
  institution: string;

  @Column()
  graduationYear: number;
}

@Entity("provider_licenses")
export class ProviderLicenseEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column({ unique: true })
  licenseNumber: string;

  @Column()
  issuingAuthority: string;

  @Column()
  expiryDate: string;
}

@Entity("credential_documents")
export class CredentialDocumentEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  docType: string;

  @Column()
  fileUrl: string;

  @Column({ default: "pending" })
  status: string;
}
