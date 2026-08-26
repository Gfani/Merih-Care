import { Entity, Column, PrimaryColumn, Index } from "typeorm";

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

  @Column()
  createdAt: string;
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
