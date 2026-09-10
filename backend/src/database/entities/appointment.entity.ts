import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";
import { ProviderEntity } from "./provider.entity";
import { ServiceEntity } from "./service.entity";

@Entity("appointments")
export class AppointmentEntity {
  @PrimaryColumn()
  id: string;

  // Patient Relationship (Foreign Key)
  @Column({ nullable: true })
  @Index()
  patientId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "patientId" })
  patient: UserEntity;

  // Provider Relationship (Foreign Key)
  @Column({ nullable: true })
  @Index()
  providerId: string;

  @ManyToOne(() => ProviderEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "providerId" })
  provider: ProviderEntity;

  // Service Relationship (Foreign Key)
  @Column({ nullable: true })
  @Index()
  serviceId: string;

  @ManyToOne(() => ServiceEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "serviceId" })
  serviceRelation: ServiceEntity;

  // Backward compatibility strings
  @Column({ nullable: true })
  patientName: string;

  @Column({ nullable: true })
  patientAvatar: string;

  @Column({ nullable: true })
  providerName: string;

  @Column({ nullable: true })
  providerAvatar: string;

  @Column({ nullable: true })
  providerPhone: string;

  @Column({ nullable: true })
  patientPhone: string;

  @Column({ nullable: true })
  service: string;

  @Column()
  @Index()
  date: string;

  @Column()
  time: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: 0 })
  amount: number;

  @Column({ default: "pending" })
  @Index()
  status: string; // pending, completed, cancelled

  @Column({ nullable: true })
  visitNotes: string;

  @Column({ nullable: true })
  disputeReason: string;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ nullable: true })
  cancellationReason: string;

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;

  // Optimistic Locking version
  @VersionColumn()
  version: number;
}
