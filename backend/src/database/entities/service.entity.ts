import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("services")
export class ServiceEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 0 })
  priceFrom: number;

  @Column({ default: 0 })
  providerCount: number;

  @Column({ default: "active" })
  status: string; // active, closed
}
