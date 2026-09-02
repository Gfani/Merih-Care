import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("payment_events")
export class PaymentEventEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  paymentId: string;

  @Column()
  eventType: string;

  @Column({ nullable: true })
  payload: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity("refunds")
export class RefundEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  paymentId: string;

  @Column()
  amount: number;

  @Column({ nullable: true })
  reason: string;

  @Column()
  status: string;

  @Column()
  createdAt: string;
}

@Entity("commission_records")
export class CommissionRecordEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  paymentId: string;

  @Column()
  amount: number;

  @Column()
  ratePercentage: number;

  @Column()
  status: string;

  @Column()
  createdAt: string;
}

@Entity("payouts")
export class PayoutEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  amount: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  bankAccount: string;

  @Column({ nullable: true })
  transactionReference: string;

  @Column()
  createdAt: string;
}

@Entity("payout_batches")
export class PayoutBatchEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  batchReference: string;

  @Column({ default: 0 })
  totalPayouts: number;

  @Column({ default: 0 })
  totalAmount: number;

  @Column({ default: "processing" })
  status: "pending" | "processing" | "completed" | "failed";

  @Column({ nullable: true })
  processedBy: string;

  @Column()
  createdAt: string;
}

@Entity("provider_earnings")
export class ProviderEarningsEntity {
  @PrimaryColumn()
  providerId: string;

  @Column({ default: 0 })
  balance: number;

  @Column({ default: 0 })
  totalEarned: number;

  @Column({ default: 0 })
  totalWithdrawn: number;

  @UpdateDateColumn()
  updatedAt: Date;
}

