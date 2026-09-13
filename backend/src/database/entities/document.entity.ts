import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity("documents")
export class DocumentEntity {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  fileKey: string;

  @Column()
  @Index()
  ownerId: string;

  @Column({ default: "credential" })
  documentType: string;

  @Column()
  fileName: string;

  @Column({ default: 0 })
  fileSize: number;

  @Column({ default: "application/octet-stream" })
  mimeType: string;

  @Column({ nullable: true })
  @Index()
  verifierId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
