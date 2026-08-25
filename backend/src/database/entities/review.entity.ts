import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("reviews")
export class ReviewEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  reviewerName: string;

  @Column()
  providerName: string;

  @Column("float", { default: 5.0 })
  rating: number;

  @Column("text")
  comment: string;

  @Column()
  service: string;

  @Column()
  date: string;

  @Column({ default: "published" })
  status: string; // published, flagged, hidden
}
