import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("providers")
export class ProviderEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar: string;

  @Column()
  title: string;

  @Column("float", { default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ default: 0 })
  experience: number;

  @Column({ default: true })
  available: boolean;

  @Column({ default: false })
  verified: boolean;

  @Column({ default: "active" })
  status: string; // active, suspended

  @Column({ default: 0 })
  pricePerVisit: number;

  @Column({ nullable: true })
  distance: string;

  @Column("text", { nullable: true })
  servicesRaw: string;

  get services(): string[] {
    try {
      return this.servicesRaw ? JSON.parse(this.servicesRaw) : [];
    } catch {
      return [];
    }
  }

  set services(val: string[]) {
    this.servicesRaw = JSON.stringify(val);
  }
}
