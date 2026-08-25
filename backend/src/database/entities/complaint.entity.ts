import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("complaints")
export class ComplaintEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  reporterName: string;

  @Column()
  reporterRole: string; // patient, provider

  @Column()
  subject: string;

  @Column()
  date: string;

  @Column({ default: "pending" })
  status: string; // pending, investigating, resolved

  @Column({ default: "medium" })
  priority: string; // low, medium, high

  @Column("text", { nullable: true })
  description: string;
}
