import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";
import { ProviderEntity } from "./provider.entity";
import { ServiceEntity } from "./service.entity";

@Entity("reviews")
export class ReviewEntity {
  @PrimaryColumn()
  id: string;

  // Reviewer (Patient) Relationship
  @Column({ nullable: true })
  @Index()
  reviewerId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "reviewerId" })
  reviewer: UserEntity;

  // Provider Relationship
  @Column({ nullable: true })
  @Index()
  providerId: string;

  @ManyToOne(() => ProviderEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "providerId" })
  providerRelation: ProviderEntity;

  // Service Relationship
  @Column({ nullable: true })
  @Index()
  serviceId: string;

  @ManyToOne(() => ServiceEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "serviceId" })
  serviceRelation: ServiceEntity;

  // Backward compatibility columns
  @Column({ nullable: true })
  reviewerName: string;

  @Column({ nullable: true })
  providerName: string;

  @Column({ nullable: true })
  service: string;

  @Column("float", { default: 5.0 })
  rating: number;

  @Column("text")
  comment: string;

  @Column()
  @Index()
  date: string;

  @Column({ default: "published" })
  @Index()
  status: string; // published, flagged, hidden

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;
}
