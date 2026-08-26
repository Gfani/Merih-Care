import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("locations")
export class LocationEntity {
  @PrimaryColumn()
  id: string;

  // User Relationship
  @Column({ nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "userId" })
  user: UserEntity;

  @Column({ nullable: true })
  name: string;

  @Column()
  role: string; // provider, patient

  @Column("float")
  x: number;

  @Column("float")
  y: number;

  @Column({ default: "available" })
  @Index()
  status: string; // available, busy, critical

  // Audits
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Deletion
  @DeleteDateColumn()
  deletedAt: Date;
}
