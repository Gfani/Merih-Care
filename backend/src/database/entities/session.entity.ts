import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("sessions")
export class SessionEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  userId: string;

  @Column()
  refreshToken: string;

  @Column()
  tokenExpires: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ default: false })
  isRevoked: boolean;

  @Column()
  lastActive: string;
}
