import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("service_categories")
export class ServiceCategoryEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ nullable: true })
  description: string;
}

@Entity("provider_services")
export class ProviderServiceEntity {
  @PrimaryColumn()
  providerId: string;

  @PrimaryColumn()
  serviceId: string;
}
