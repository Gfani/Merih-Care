import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("emergencies")
export class EmergencyEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  patient: string;

  @Column()
  location: string;

  @Column()
  phone: string;

  @Column()
  time: string;

  @Column()
  type: string; // Critical, Moderate, Minor

  @Column({ default: "active" })
  status: string; // active, dispatched, resolved

  @Column({ nullable: true })
  responder: string;
}
