import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";
import { ProviderEntity } from "./provider.entity";

@Entity("emergencies")
export class EmergencyEntity {
  @PrimaryColumn()
  id: string;

  // Patient Relationship
  @Column({ nullable: true })
  @Index()
  patientId: string;

  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "patientId" })
  patientRelation: UserEntity;

  // Responder Relationship
  @Column({ nullable: true })
  @Index()
  responderId: string;

  @ManyToOne(() => ProviderEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "responderId" })
  responderRelation: ProviderEntity;

  // Backward compatibility columns
  @Column({ nullable: true })
  patient: string;

  @Column({ nullable: true })
  responder: string;

  @Column()
  location: string;

  @Column()
  @Index()
  phone: string;

  @Column()
  time: string;

  @Column()
  @Index()
  type: string; // Critical, Moderate, Minor

  @Column({ default: "active" })
  @Index()
  status: string; // active, dispatched, resolved

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;
}
