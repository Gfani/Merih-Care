import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("roles")
export class RoleEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ nullable: true })
  description: string;
}

@Entity("permissions")
export class PermissionEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ nullable: true })
  description: string;
}

@Entity("user_roles")
export class UserRoleEntity {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  roleId: string;
}
