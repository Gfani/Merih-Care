import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("emergency_responders")
export class EmergencyResponderEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  emergencyId: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  dispatchedAt: string;

  @Column({ nullable: true })
  arrivedAt: string;
}

@Entity("emergency_escalation_history")
export class EmergencyEscalationHistoryEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  emergencyId: string;

  @Column()
  level: string;

  @Column({ nullable: true })
  reason: string;

  @Column()
  escalatedBy: string;

  @Column()
  createdAt: string;
}

@Entity("location_history")
export class LocationHistoryEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  x: number;

  @Column()
  y: number;

  @Column()
  @Index()
  timestamp: string;
}

@Entity("provider_time_off")
export class TimeOffEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  providerId: string;

  @Column()
  @Index()
  startDate: string;

  @Column()
  @Index()
  endDate: string;

  @Column({ nullable: true })
  reason: string;
}
