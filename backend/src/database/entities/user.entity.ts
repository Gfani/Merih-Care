import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password?: string;

  @Column({ nullable: true })
  phone: string;

  @Column()
  role: string; // admin, provider, patient

  @Column({ default: "active" })
  status: string; // active, suspended

  @Column({ nullable: true })
  dateJoined: string;
}
