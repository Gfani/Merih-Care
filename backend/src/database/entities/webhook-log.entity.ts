import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from "typeorm";

@Entity("webhook_event_logs")
export class WebhookLogEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  provider: "telebirr" | "cbe_birr" | "chapa" | "stripe";

  @Column()
  @Index()
  eventType: string;

  @Column({ type: "text" })
  payload: string;

  @Column({ default: true })
  signatureVerified: boolean;

  @Column({ default: "processed" })
  @Index()
  status: "received" | "processed" | "failed" | "ignored";

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ type: "timestamptz" })
  @Index()
  createdAt: Date;
}
