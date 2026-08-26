import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("complaints")
export class ComplaintEntity {
  @PrimaryColumn()
  id: string;

  // Reporter Relationship (Foreign Key)
  @Column({ nullable: true })
  @Index()
  reporterId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "reporterId" })
  reporter: UserEntity;

  @Column({ nullable: true })
  reporterName: string;

  @Column()
  reporterRole: string; // patient, provider

  @Column()
  subject: string;

  @Column()
  @Index()
  date: string;

  @Column({ default: "pending" })
  @Index()
  status: string; // pending, investigating, resolved

  @Column({ default: "medium" })
  @Index()
  priority: string; // low, medium, high

  @Column("text", { nullable: true })
  description: string;

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;
}
