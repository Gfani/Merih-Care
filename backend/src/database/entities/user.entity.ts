import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, Index } from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  password?: string;

  @Column({ nullable: true })
  @Index()
  phone: string;

  @Column()
  role: string; // admin, provider, patient

  @Column({ default: "active" })
  @Index()
  status: string; // active, suspended

  @Column({ nullable: true })
  dateJoined: string;

  // Granular Administrative Roles
  @Column({ nullable: true })
  adminRole: string; // super_admin, operations_admin, finance_admin, verification_admin, support_admin

  // Permission tokens list (comma-separated string values)
  @Column({ nullable: true })
  permissions: string;

  // Administrative Approval Loop
  @Column({ default: true })
  isApproved: boolean; // True by default for patients/providers, false for new administrators

  // Email validation and resets
  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  emailVerificationExpires: string;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: string;

  // Totp Multi-factor Secret Keys
  @Column({ nullable: true })
  mfaSecret: string;

  @Column({ default: false })
  mfaEnabled: boolean;

  // Security Login Lockouts
  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  lockoutUntil: string;

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;

  // Optimistic Locking version tracker
  @VersionColumn()
  version: number;
}
