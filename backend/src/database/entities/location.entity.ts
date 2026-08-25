import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("locations")
export class LocationEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  role: string; // provider, patient

  @Column("float")
  x: number;

  @Column("float")
  y: number;

  @Column({ default: "available" })
  status: string; // available, busy, critical
}
