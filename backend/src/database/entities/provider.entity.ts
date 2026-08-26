import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, Index } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("providers")
export class ProviderEntity {
  @PrimaryColumn()
  id: string;

  // Link to base UserEntity
  @Column({ nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserEntity;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar: string;

  @Column()
  title: string;

  @Column("float", { default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ default: 0 })
  experience: number;

  @Column({ default: true })
  @Index()
  available: boolean;

  @Column({ default: false })
  @Index()
  verified: boolean;

  @Column({ default: "active" })
  @Index()
  status: string; // active, suspended

  @Column({ default: 0 })
  pricePerVisit: number;

  @Column({ nullable: true })
  distance: string;

  @Column("text", { nullable: true })
  servicesRaw: string;

  get services(): string[] {
    try {
      return this.servicesRaw ? JSON.parse(this.servicesRaw) : [];
    } catch {
      return [];
    }
  }

  set services(val: string[]) {
    this.servicesRaw = JSON.stringify(val);
  }

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
