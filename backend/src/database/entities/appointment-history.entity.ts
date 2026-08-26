import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("appointment_status_history")
export class AppointmentStatusHistoryEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  appointmentId: string;

  @Column()
  status: string;

  @Column()
  changedBy: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  createdAt: string;
}

@Entity("appointment_cancellations")
export class CancellationReasonEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  appointmentId: string;

  @Column()
  reason: string;

  @Column()
  cancelledBy: string;

  @Column({ nullable: true })
  notes: string;
}
