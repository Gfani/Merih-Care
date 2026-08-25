import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("appointments")
export class AppointmentEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  patientName: string;

  @Column({ nullable: true })
  patientAvatar: string;

  @Column()
  providerName: string;

  @Column({ nullable: true })
  providerAvatar: string;

  @Column()
  service: string;

  @Column()
  date: string;

  @Column()
  time: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: 0 })
  amount: number;

  @Column({ default: "pending" })
  status: string; // pending, completed, cancelled
}
