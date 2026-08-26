import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("verification_reviews")
export class VerificationReviewEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  reviewerId: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  decision: string;
}

@Entity("verification_history")
export class VerificationHistoryEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  status: string;

  @Column()
  changedBy: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  createdAt: string;
}
